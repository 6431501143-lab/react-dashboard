import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'dashboard_snapshot.db');
export const localDb = new Database(DB_PATH);

// Enable WAL (Write-Ahead Logging) for lightning-fast reads & concurrent performance
localDb.pragma('journal_mode = WAL');
localDb.pragma('synchronous = NORMAL');

/**
 * Initialize all snapshot tables and local indexes
 */
export function initLocalDb() {
  localDb.exec(`
    -- 1. Metadata table
    CREATE TABLE IF NOT EXISTS sync_metadata (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 2. Stagnant Stock (สินค้าค้าง 1 ปี)
    CREATE TABLE IF NOT EXISTS stagnant_stock (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id TEXT,
      common_name TEXT,
      stock_name TEXT,
      lot_number_id TEXT,
      quantity REAL,
      unit TEXT,
      last_move_date TEXT,
      transfer_date TEXT,
      total_duration TEXT,
      unit_price REAL,
      total_value REAL
    );
    CREATE INDEX IF NOT EXISTS idx_stagnant_item ON stagnant_stock(item_id);
    CREATE INDEX IF NOT EXISTS idx_stagnant_stock ON stagnant_stock(stock_name);

    -- 3. Expired Stock (สินค้าหมดอายุ)
    CREATE TABLE IF NOT EXISTS expiry_stock (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stock_name TEXT,
      item_id TEXT,
      trade_name TEXT,
      common_name TEXT,
      lot_number_id TEXT,
      expire_date TEXT,
      quantity REAL,
      unit TEXT,
      unit_price REAL,
      total_value REAL,
      status TEXT,
      expire_duration TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_expiry_date ON expiry_stock(expire_date);
    CREATE INDEX IF NOT EXISTS idx_expiry_item ON expiry_stock(item_id);
    CREATE INDEX IF NOT EXISTS idx_expiry_stock ON expiry_stock(stock_name);

    -- 4. Inventory Balance (ยอดสินค้าคงคลัง)
    CREATE TABLE IF NOT EXISTS inventory_balance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stock_id TEXT,
      warehouse TEXT,
      last_update TEXT,
      item_id TEXT,
      name TEXT,
      item_type TEXT,
      active_status TEXT,
      balance REAL,
      avg_daily_usage REAL,
      days_remaining REAL,
      min_qty REAL,
      max_qty REAL,
      status TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_inv_item ON inventory_balance(item_id);
    CREATE INDEX IF NOT EXISTS idx_inv_warehouse ON inventory_balance(warehouse);
    CREATE INDEX IF NOT EXISTS idx_inv_status ON inventory_balance(status);

    -- 5. Outbound Dispatch (ประวัติการจ่ายสินค้า)
    CREATE TABLE IF NOT EXISTS dispatch_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id TEXT,
      name TEXT,
      quantity REAL,
      destination TEXT,
      department TEXT,
      date TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_dispatch_date ON dispatch_history(date);
    CREATE INDEX IF NOT EXISTS idx_dispatch_item ON dispatch_history(item_id);

    -- 6. Turnover Tables (อัตราหมุนเวียนเวชภัณฑ์)
    CREATE TABLE IF NOT EXISTS turnover_monthly (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month_str TEXT,
      direction TEXT,
      src_wh TEXT,
      dest_wh TEXT,
      item_id TEXT,
      item_name TEXT,
      total_qty REAL,
      tx_count INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_turnover_month ON turnover_monthly(month_str);

    CREATE TABLE IF NOT EXISTS turnover_dow (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month_str TEXT,
      dow INTEGER,
      direction TEXT,
      src_wh TEXT,
      dest_wh TEXT,
      total_qty REAL
    );

    CREATE TABLE IF NOT EXISTS turnover_details (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date_str TEXT,
      item_id TEXT,
      name TEXT,
      direction TEXT,
      src_wh TEXT,
      dest_wh TEXT,
      qty REAL
    );
    CREATE INDEX IF NOT EXISTS idx_turnover_detail_date ON turnover_details(date_str);
  `);
}

/**
 * Get sync metadata
 */
export function getSyncMetadata() {
  try {
    const row = localDb.prepare("SELECT value FROM sync_metadata WHERE key = 'last_synced_at'").get();
    const dateRow = localDb.prepare("SELECT value FROM sync_metadata WHERE key = 'last_synced_date'").get();
    const countRow = localDb.prepare(`
      SELECT 
        (SELECT COUNT(*) FROM stagnant_stock) as stagnant_count,
        (SELECT COUNT(*) FROM expiry_stock) as expiry_count,
        (SELECT COUNT(*) FROM inventory_balance) as inventory_count,
        (SELECT COUNT(*) FROM dispatch_history) as dispatch_count,
        (SELECT COUNT(*) FROM turnover_monthly) as turnover_count
    `).get();

    return {
      lastSyncedAt: row ? row.value : null,
      lastSyncedDate: dateRow ? dateRow.value : null,
      hasData: Boolean(row && countRow.stagnant_count > 0),
      rowCounts: countRow || {}
    };
  } catch {
    return { lastSyncedAt: null, lastSyncedDate: null, hasData: false, rowCounts: {} };
  }
}

/**
 * Save sync metadata
 */
export function setSyncMetadata(timestampStr, dateStr) {
  const stmt = localDb.prepare(`
    INSERT INTO sync_metadata (key, value, updated_at) 
    VALUES ('last_synced_at', ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `);
  stmt.run(timestampStr);

  if (dateStr) {
    const dateStmt = localDb.prepare(`
      INSERT INTO sync_metadata (key, value, updated_at) 
      VALUES ('last_synced_date', ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `);
    dateStmt.run(dateStr);
  }
}
