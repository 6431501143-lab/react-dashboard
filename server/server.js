import express from 'express';
import cors from 'cors';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { QUERIES } from './queries.js';
import { initLocalDb, getSyncMetadata } from './local_db.js';
import { 
  syncSnapshotFromPostgres, 
  getLocalStagnantData, 
  getLocalExpiryData, 
  getLocalInventoryData, 
  getLocalDispatchData, 
  getLocalTurnoverData 
} from './sync_service.js';

// Auto-load .env configuration file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '..', '.env'),
  path.resolve(__dirname, '.env')
];

for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...vals] = trimmed.split('=');
        const val = vals.join('=').trim().replace(/^["']|["']$/g, '');
        const cleanKey = key.trim();
        if (cleanKey && !process.env[cleanKey]) {
          process.env[cleanKey] = val;
        }
      }
    }
    break;
  }
}

const { Pool } = pg;
const app = express();
const PORT = process.env.PORT || 5000;

// Daily Auto-Sync Schedule Configuration
const SYNC_TARGET_HOUR = parseInt(process.env.SYNC_HOUR || '8', 10);
const SYNC_TARGET_MINUTE = parseInt(process.env.SYNC_MINUTE || '0', 10);

function getNextScheduledSyncISO() {
  const now = new Date();
  const nextTarget = new Date(now);
  nextTarget.setHours(SYNC_TARGET_HOUR, SYNC_TARGET_MINUTE, 0, 0);
  if (now.getTime() >= nextTarget.getTime()) {
    nextTarget.setDate(nextTarget.getDate() + 1);
  }
  return nextTarget.toISOString();
}

app.use(cors());
app.use(express.json());

// Initialize Local SQLite Database
initLocalDb();

// Active Connection Pool
let dbPool = null;

// Global read-only query runner
async function runReadOnlyQuery(sql) {
  if (!dbPool) {
    throw new Error('Database is not connected');
  }
  const client = await dbPool.connect();
  try {
    await client.query('SET default_transaction_read_only = on;');
    await client.query("SET work_mem = '128MB';");
    const res = await client.query(sql);
    return res.rows;
  } finally {
    client.release();
  }
}

// ================= API ENDPOINTS ================= //

// Health check & DB status
app.get('/api/health', async (req, res) => {
  try {
    const result = await runReadOnlyQuery("SELECT current_database() as db, current_user as user, current_setting('default_transaction_read_only') as read_only;");
    const syncMeta = getSyncMetadata();
    res.json({
      status: 'online',
      readOnly: result[0].read_only === 'on',
      database: result[0].db,
      user: result[0].user,
      lastSyncedAt: syncMeta.lastSyncedAt,
      hasLocalData: syncMeta.hasData
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Snapshot Status Endpoint
app.get('/api/snapshot/status', (req, res) => {
  try {
    const status = getSyncMetadata();
    const timeDisplay = `${String(SYNC_TARGET_HOUR).padStart(2, '0')}:${String(SYNC_TARGET_MINUTE).padStart(2, '0')} น.`;
    res.json({
      ...status,
      autoSyncTime: timeDisplay,
      nextScheduledSync: getNextScheduledSyncISO()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Snapshot Sync Trigger Endpoint
app.post('/api/snapshot/sync', async (req, res) => {
  try {
    const result = await syncSnapshotFromPostgres(runReadOnlyQuery);
    res.json(result);
  } catch (err) {
    console.error('Snapshot sync failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});// 1. Stagnant Stock (สินค้าไม่เคลื่อนไหวเกิน 1 ปี)
app.get('/api/stagnant', (req, res) => {
  try {
    const data = getLocalStagnantData();
    res.json(data);
  } catch (err) {
    console.error('Error fetching stagnant data:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 2. Expired Stock (สินค้าหมดอายุ)
app.get('/api/expiry', (req, res) => {
  try {
    const data = getLocalExpiryData();
    res.json(data);
  } catch (err) {
    console.error('Error fetching expiry data:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 3. Inventory Balance (ยอดสินค้าคงคลัง)
app.get('/api/inventory', (req, res) => {
  try {
    const rawData = getLocalInventoryData();
    
    // Map with computed thresholds & days remaining
    const mapped = rawData.map(r => {
      const balance = parseFloat(r.balance) || 0;
      const minQty = parseFloat(r.min_qty) || 0;
      const maxQty = parseFloat(r.max_qty) || 0;
      const dailyUsage = parseFloat(r.avg_daily_usage) || 0;
      const daysRem = r.days_remaining !== null ? parseFloat(r.days_remaining) : (dailyUsage > 0 ? parseFloat((balance / dailyUsage).toFixed(1)) : 0);

      let statusStr = String(r.status || 'Normal');
      let statusTh = 'ปกติ';

      if (minQty === 0 && maxQty === 0) {
        statusStr = 'Unspecified';
        statusTh = 'ไม่ได้ระบุ';
      } else if (balance === 0) {
        statusStr = 'Out of Stock';
        statusTh = 'สินค้าหมดคลัง';
      } else if (minQty > 0 && balance < minQty) {
        statusStr = 'Below Min';
        statusTh = 'ต่ำกว่าเกณฑ์';
      } else if (maxQty > 0 && balance > maxQty) {
        statusStr = 'Over Max';
        statusTh = 'เกินเกณฑ์สูงสุด';
      } else {
        statusStr = 'Normal';
        statusTh = 'ปริมาณปกติ';
      }

      return {
        warehouse_id: String(r.stock_id || '').trim(),
        warehouse: String(r.warehouse || '').trim(),
        item_id: String(r.item_id || '').trim(),
        name: String(r.name || '').trim(),
        stock: balance,
        balance: balance,
        daily_usage: dailyUsage,
        avg_daily_usage: dailyUsage,
        min_threshold: minQty,
        max_threshold: maxQty,
        min_qty: minQty,
        max_qty: maxQty,
        status_th: statusTh,
        status: statusStr,
        date: String(r.last_update || '').trim(),
        active_status: 1,
        remaining_days: daysRem,
        days_remaining: daysRem
      };
    });

    res.json(mapped);
  } catch (err) {
    console.error('Error fetching inventory data:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 4. Outbound Dispatch (ประวัติการจ่ายสินค้า)
app.get('/api/dispatch', (req, res) => {
  try {
    const result = getLocalDispatchData();
    res.json(result);
  } catch (err) {
    console.error('Error fetching dispatch data:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 5. Turnover & Movements (อัตราหมุนเวียนเวชภัณฑ์)
app.get('/api/turnover', (req, res) => {
  try {
    const data = getLocalTurnoverData();
    res.json(data);
  } catch (err) {
    console.error('Error fetching turnover data:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ================= DAILY AUTO-SYNC SCHEDULER ================= //

let isScheduledSyncRunning = false;

function getBangkokDateString() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }); // YYYY-MM-DD
}

function scheduleDailyAutoSync(hour = SYNC_TARGET_HOUR, minute = SYNC_TARGET_MINUTE) {
  const timeDisplay = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} น.`;
  console.log(`⏰ [Auto-Sync Scheduler]: ระบบตั้งเวลาซิงค์อัตโนมัติประจำวันเวลา ${timeDisplay}`);

  async function performDailySync(reason = 'เวลาประจำวัน') {
    if (isScheduledSyncRunning) return;
    if (!dbPool) {
      console.warn(`⚠️ [Auto-Sync]: ยังไม่ได้เชื่อมต่อ PostgreSQL ข้ามรอบนี้ (${reason})`);
      return;
    }

    isScheduledSyncRunning = true;
    console.log(`\n======================================================`);
    console.log(`⚡ [Auto-Sync]: ⏰ เริ่มต้น Auto-Sync ข้อมูลประจำวัน (${reason})...`);
    console.log(`======================================================\n`);

    try {
      const result = await syncSnapshotFromPostgres(runReadOnlyQuery);
      console.log(`✅ [Auto-Sync]: ซิงค์ข้อมูลประจำวันสำเร็จเรียบร้อย (${result.lastSyncedAt})\n`);
    } catch (err) {
      console.error(`❌ [Auto-Sync Error]:`, err.message);
    } finally {
      isScheduledSyncRunning = false;
    }
  }

  // 1. Startup Check: เมื่อเปิดเซิร์ฟเวอร์ขึ้นมา ตรวจสอบทันทีว่าวันนี้ซิงค์แล้วหรือยัง
  setTimeout(() => {
    try {
      const todayStr = getBangkokDateString();
      const meta = getSyncMetadata();
      if (!meta.lastSyncedDate || meta.lastSyncedDate !== todayStr) {
        console.log(`📌 [Auto-Sync]: ตรวจพบวันใหม่ (ซิงค์ล่าสุด: ${meta.lastSyncedAt || 'ยังไม่มี'}) -> กำลังเริ่มซิงค์ข้อมูลของวันใหม่อัตโนมัติ...`);
        performDailySync('เปิดเซิร์ฟเวอร์วันใหม่');
      } else {
        console.log(`✅ [Auto-Sync]: วันนี้ (${todayStr}) มีข้อมูลที่ซิงค์แล้ว (${meta.lastSyncedAt})`);
      }
    } catch (e) {
      console.error('Startup sync check error:', e);
    }
  }, 3000);

  // 2. Heartbeat Monitor: ตรวจสอบทุกๆ 30 วินาทีอย่างแม่นยำ (รองรับทั้งการตื่นจาก Sleep Mode และการเปลี่ยนวัน)
  let lastTriggeredDay = '';

  setInterval(() => {
    try {
      const now = new Date();
      const bkkHour = parseInt(now.toLocaleTimeString('en-US', { timeZone: 'Asia/Bangkok', hour: '2-digit', hour12: false }), 10);
      const bkkMinute = parseInt(now.toLocaleTimeString('en-US', { timeZone: 'Asia/Bangkok', minute: '2-digit', hour12: false }), 10);
      const todayStr = getBangkokDateString();

      const isPastTargetTime = (bkkHour > hour) || (bkkHour === hour && bkkMinute >= minute);
      const meta = getSyncMetadata();

      if (isPastTargetTime && meta.lastSyncedDate !== todayStr && lastTriggeredDay !== todayStr) {
        lastTriggeredDay = todayStr;
        console.log(`🔔 [Auto-Sync Trigger]: ถึงรอบเวลาซิงค์ประจำวัน ${timeDisplay} (${todayStr})`);
        performDailySync(`รอบเวลา ${timeDisplay}`);
      }
    } catch (e) {
      console.error('Auto-sync heartbeat error:', e);
    }
  }, 30000);
}

// ================= BOOTSTRAP ================= //

async function startServer() {
  console.log('\n======================================================');
  console.log('   🚀 EXECUTIVE DASHBOARD - SNAPSHOT API SERVER       ');
  console.log('======================================================\n');

  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT;
  const user = process.env.DB_USER;
  const database = process.env.DB_NAME;
  const password = process.env.DB_PASSWORD;

  let isPgConnected = false;

  if (host && port && user && database && password) {
    console.log('⏳ กำลังทดสอบเชื่อมต่อฐานข้อมูล PostgreSQL...');
    try {
      dbPool = new Pool({
        host,
        port: parseInt(port, 10),
        user,
        database,
        password,
        options: '-c default_transaction_read_only=on',
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000
      });

      const testClient = await dbPool.connect();
      await testClient.query("SELECT current_database() as db;");
      testClient.release();
      isPgConnected = true;
      console.log('✅ เชื่อมต่อ PostgreSQL สดของโรงพยาบาลสำเร็จ!');
    } catch (err) {
      console.log('⚠️ ไม่สามารถเชื่อมต่อ PostgreSQL ได้ (อยู่นอกวง LAN หรือเซิร์ฟเวอร์ออฟไลน์):', err.message);
      console.log('💡 ระบบจะสลับไปทำงานในโหมด Snapshot Engine (ข้อมูลแคชในเครื่อง) อัตโนมัติ\n');
      dbPool = null;
    }
  } else {
    console.log('ℹ️ ไม่พบการตั้งค่าฐานข้อมูลในไฟล์ .env');
    console.log('💡 เริ่มต้นทำงานในโหมด Snapshot Engine (แสดงข้อมูลในเครื่องและรองรับไฟล์ Excel)\n');
  }

  const syncMeta = getSyncMetadata();
  if (syncMeta.hasData) {
    console.log(`📌 อัปเดตข้อมูลล่าสุด: ${syncMeta.lastSyncedAt}`);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 API Server พร้อมทำงานที่ http://0.0.0.0:${PORT}`);
    if (isPgConnected) {
      scheduleDailyAutoSync();
    }
  });
}

startServer();

