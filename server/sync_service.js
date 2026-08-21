import { localDb, setSyncMetadata } from './local_db.js';
import { QUERIES } from './queries.js';

let isSyncInProgress = false;

/**
 * Format datetime to Thai display string
 */
export function getThaiFormattedTimestamp() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('th-TH', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
  const timeStr = now.toLocaleTimeString('th-TH', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  return `${dateStr} ${timeStr} น.`;
}

/**
 * Perform full snapshot sync from PostgreSQL to local SQLite
 */
export async function syncSnapshotFromPostgres(runReadOnlyQuery) {
  if (isSyncInProgress) {
    throw new Error('การซิงค์ข้อมูลกำลังดำเนินการอยู่ โปรดรอสักครู่...');
  }

  isSyncInProgress = true;
  const startTime = Date.now();

  try {
    console.log('\n🔄 [Snapshot Sync] กำลังเริ่มดึงข้อมูลสรุปจาก PostgreSQL โรงพยาบาล...');

    // 1. Fetch Stagnant
    console.log('  1/5 ⏳ กำลังดึงข้อมูลสินค้าค้าง 1 ปี...');
    const stagnantRows = await runReadOnlyQuery(QUERIES.stagnant);
    console.log(`  1/5 ✅ ได้รับ ${stagnantRows.length.toLocaleString()} แถว`);

    // 2. Fetch Expiry
    console.log('  2/5 ⏳ กำลังดึงข้อมูลสินค้าหมดอายุ...');
    const expiryRows = await runReadOnlyQuery(QUERIES.expiry);
    console.log(`  2/5 ✅ ได้รับ ${expiryRows.length.toLocaleString()} แถว`);

    // 3. Fetch Inventory
    console.log('  3/5 ⏳ กำลังดึงข้อมูลยอดสินค้าคงคลัง...');
    const inventoryRows = await runReadOnlyQuery(QUERIES.inventory);
    console.log(`  3/5 ✅ ได้รับ ${inventoryRows.length.toLocaleString()} แถว`);

    // 4. Fetch Dispatch
    console.log('  4/5 ⏳ กำลังดึงข้อมูลประวัติการจ่ายสินค้า...');
    const dispatchRows = await runReadOnlyQuery(QUERIES.dispatch);
    console.log(`  4/5 ✅ ได้รับ ${dispatchRows.length.toLocaleString()} แถว`);

    // 5. Fetch Turnover
    console.log('  5/5 ⏳ กำลังดึงข้อมูลอัตราหมุนเวียนเวชภัณฑ์...');
    const turnoverMonthlyRows = await runReadOnlyQuery(QUERIES.turnoverMonthlyAgg);
    const turnoverDowRows = await runReadOnlyQuery(QUERIES.turnoverDowAgg);
    const turnoverDetailRows = await runReadOnlyQuery(QUERIES.turnoverRecentDetails);
    console.log(`  5/5 ✅ ได้รับข้อมูลอัตราหมุนเวียนครบถ้วน`);

    // ================= POPULATE SQLITE DATABASE ================= //
    console.log('💾 กำลังบันทึกและสร้าง Index ลงไฟล์ SQLite ในเครื่อง...');

    const insertAll = localDb.transaction(() => {
      // 1. Clear old data
      localDb.exec(`
        DELETE FROM stagnant_stock;
        DELETE FROM expiry_stock;
        DELETE FROM inventory_balance;
        DELETE FROM dispatch_history;
        DELETE FROM turnover_monthly;
        DELETE FROM turnover_dow;
        DELETE FROM turnover_details;
      `);

      // 2. Insert Stagnant
      const stmtStagnant = localDb.prepare(`
        INSERT INTO stagnant_stock (
          item_id, common_name, stock_name, lot_number_id, quantity, unit,
          last_move_date, transfer_date, total_duration, unit_price, total_value
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const r of stagnantRows) {
        stmtStagnant.run(
          String(r["รหัสสินค้า"] || r.item_id || '').trim(),
          String(r["ชื่อสามัญ"] || r.common_name || '').trim(),
          String(r["คลัง"] || r.stock_name || '').trim(),
          String(r.lot_number_id || '').trim(),
          parseFloat(r["จำนวน"] || r.cur_quantity) || 0,
          String(r["หน่วย"] || r.small_unit_id || 'ea').trim(),
          String(r["วันที่เคลื่อนไหวล่าสุด"] || r["วันที่เคลื่อนไหวล่าสุ"] || r.last_move_date || '').trim(),
          String(r["วันโอน"] || r.last_move_date || '').trim(),
          String(r["ระยะเวลารวม"] || '1 year').trim(),
          parseFloat(r["ราคาต่อหน่วย"] || r.cost_purchase) || 0,
          parseFloat(r["มูลค่ารวม"] || r["มูลค่า"]) || 0
        );
      }

      // 3. Insert Expiry
      const stmtExpiry = localDb.prepare(`
        INSERT INTO expiry_stock (
          stock_name, item_id, trade_name, common_name, lot_number_id,
          expire_date, quantity, unit, unit_price, total_value, status, expire_duration
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const r of expiryRows) {
        stmtExpiry.run(
          String(r["คลัง"] || r.stock_name || '').trim(),
          String(r["รหัสสินค้า"] || r.item_id || '').trim(),
          String(r["ชื่อสินค้า"] || r.item_trade_name || '').trim(),
          String(r["ชื่อสามัญ"] || r["ชื่อสินค้า"] || r.item_trade_name || '').trim(),
          String(r.lot_number_id || '').trim(),
          String(r["วันหมดอายุ"] || r.expire_date || '').trim(),
          parseFloat(r["จำนวน"] || r.update_qty_lot) || 0,
          String(r["หน่วย"] || r.small_unit_id || 'ea').trim(),
          parseFloat(r["ราคาต่อหน่วย"] || r.cost_purchase) || 0,
          parseFloat(r["มูลค่ารวม"] || r["มูลค่า"]) || 0,
          String(r["สถานะ"] || 'หมดอายุแล้ว').trim(),
          String(r["ระยะเวลาหมดอายุ"] || '0 days').trim()
        );
      }

      // 4. Insert Inventory
      const stmtInventory = localDb.prepare(`
        INSERT INTO inventory_balance (
          stock_id, warehouse, last_update, item_id, name, item_type, active_status,
          balance, avg_daily_usage, days_remaining, min_qty, max_qty, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const r of inventoryRows) {
        stmtInventory.run(
          String(r.stock_id || '').trim(),
          String(r.warehouse || '').trim(),
          String(r.last_update || '').trim(),
          String(r.item_id || '').trim(),
          String(r.name || '').trim(),
          String(r.item_type || '').trim(),
          String(r.active_status || 'Y').trim(),
          parseFloat(r.balance) || 0,
          parseFloat(r.avg_daily_usage) || 0,
          r.days_remaining !== null ? parseFloat(r.days_remaining) : null,
          parseFloat(r.min_qty) || 0,
          parseFloat(r.max_qty) || 0,
          String(r.status || 'ปริมาณปกติ').trim()
        );
      }

      // 5. Insert Dispatch
      const stmtDispatch = localDb.prepare(`
        INSERT INTO dispatch_history (
          item_id, name, quantity, destination, department, date
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const r of dispatchRows) {
        stmtDispatch.run(
          String(r.item_id || '').trim(),
          String(r["สินค้า"] || r.item_name || '').trim(),
          parseFloat(r["จำนวน"] || r.quantity) || 0,
          String(r["คลังปลายทาง"] || '').trim(),
          String(r["แผนก"] || '').trim(),
          String(r["วันที่"] || '').trim()
        );
      }

      // 6. Insert Turnover
      const stmtTurnoverM = localDb.prepare(`
        INSERT INTO turnover_monthly (
          month_str, direction, src_wh, dest_wh, item_id, item_name, total_qty, tx_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const r of turnoverMonthlyRows) {
        stmtTurnoverM.run(
          String(r.month_str || '').trim(),
          String(r.direction || '').trim(),
          String(r.src_wh || '').trim(),
          String(r.dest_wh || '').trim(),
          String(r.item_id || '').trim(),
          String(r.item_name || '').trim(),
          parseFloat(r.total_qty) || 0,
          parseInt(r.tx_count, 10) || 1
        );
      }

      const stmtTurnoverDow = localDb.prepare(`
        INSERT INTO turnover_dow (month_str, dow, direction, src_wh, dest_wh, total_qty)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const r of turnoverDowRows) {
        stmtTurnoverDow.run(
          String(r.month_str || '').trim(),
          parseInt(r.dow, 10) || 0,
          String(r.direction || '').trim(),
          String(r.src_wh || '').trim(),
          String(r.dest_wh || '').trim(),
          parseFloat(r.total_qty) || 0
        );
      }

      const stmtTurnoverDet = localDb.prepare(`
        INSERT INTO turnover_details (date_str, item_id, name, direction, src_wh, dest_wh, qty)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const r of turnoverDetailRows) {
        stmtTurnoverDet.run(
          String(r.date_str || '').trim(),
          String(r.item_id || '').trim(),
          String(r.name || '').trim(),
          String(r.direction || '').trim(),
          String(r.src_wh || '').trim(),
          String(r.dest_wh || '').trim(),
          parseFloat(r.qty) || 0
        );
      }

      // Set timestamp
      const thaiTimestamp = getThaiFormattedTimestamp();
      const todayDateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
      setSyncMetadata(thaiTimestamp, todayDateStr);
    });

    insertAll();

    const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✨ [Snapshot Sync สำเร็จ] ใช้เวลา ${durationSec} วินาที ข้อมูลพร้อมตอบกลับใน 0.002s ทันที!\n`);

    return {
      success: true,
      durationSec,
      lastSyncedAt: getThaiFormattedTimestamp(),
      rowCounts: {
        stagnant: stagnantRows.length,
        expiry: expiryRows.length,
        inventory: inventoryRows.length,
        dispatch: dispatchRows.length
      }
    };
  } finally {
    isSyncInProgress = false;
  }
}

// ================= READ FAST FROM LOCAL SQLITE (0.002s) ================= //

export function getLocalStagnantData() {
  const rows = localDb.prepare(`
    SELECT 
      item_id AS "รหัสสินค้า",
      common_name AS "ชื่อสามัญ",
      stock_name AS "คลัง",
      lot_number_id,
      quantity AS "จำนวน",
      unit AS "หน่วย",
      last_move_date AS "วันที่เคลื่อนไหวล่าสุด",
      last_move_date AS "วันที่เคลื่อนไหวล่าสุ",
      transfer_date AS "วันโอน",
      total_duration AS "ระยะเวลารวม",
      unit_price AS "ราคาต่อหน่วย",
      total_value AS "มูลค่ารวม",
      total_value AS "มูลค่า"
    FROM stagnant_stock
    ORDER BY total_value DESC
  `).all();
  return rows;
}

export function getLocalExpiryData() {
  const rows = localDb.prepare(`
    SELECT 
      stock_name AS "คลัง",
      item_id AS "รหัสสินค้า",
      trade_name AS "ชื่อสินค้า",
      common_name AS "ชื่อสามัญ",
      lot_number_id,
      expire_date AS "วันหมดอายุ",
      quantity AS "จำนวน",
      unit AS "หน่วย",
      unit_price AS "ราคาต่อหน่วย",
      total_value AS "มูลค่ารวม",
      total_value AS "มูลค่า",
      status AS "สถานะ",
      expire_duration AS "ระยะเวลาหมดอายุ"
    FROM expiry_stock
    ORDER BY expire_date DESC
  `).all();
  return rows;
}

export function getLocalInventoryData() {
  const rows = localDb.prepare(`
    SELECT 
      stock_id,
      warehouse,
      last_update,
      item_id,
      name,
      item_type,
      active_status,
      balance,
      avg_daily_usage,
      days_remaining,
      min_qty,
      max_qty,
      status
    FROM inventory_balance
    ORDER BY balance DESC
  `).all();
  return rows;
}

export function getLocalDispatchData() {
  const rows = localDb.prepare(`
    SELECT 
      item_id,
      name,
      quantity,
      destination,
      department,
      date
    FROM dispatch_history
    ORDER BY date DESC, quantity DESC
  `).all();

  const productMap = new Map();
  const destSet = new Set();
  const deptSet = new Set();

  rows.forEach(r => {
    const itemId = String(r.item_id || '').trim();
    const itemName = String(r.name || 'ไม่ระบุ').trim();
    const dest = String(r.destination || 'ไม่ระบุคลัง').trim();
    const dept = String(r.department || 'ไม่ระบุแผนก').trim();

    if (itemId) {
      if (!productMap.has(itemId)) {
        productMap.set(itemId, itemName || itemId);
      }
    }
    if (dest) destSet.add(dest);
    if (dept) deptSet.add(dept);
  });

  const products = Array.from(productMap.entries()).map(([id, name]) => [id, name]);
  const prodIdxMap = new Map();
  products.forEach((p, idx) => prodIdxMap.set(p[0], idx));

  const destinations = Array.from(destSet).sort();
  const destIdxMap = new Map();
  destinations.forEach((d, idx) => destIdxMap.set(d, idx));

  const departments = Array.from(deptSet).sort();
  const deptIdxMap = new Map();
  departments.forEach((dp, idx) => deptIdxMap.set(dp, idx));

  const transactions = [];
  rows.forEach(r => {
    const itemId = String(r.item_id || '').trim();
    const dest = String(r.destination || 'ไม่ระบุคลัง').trim();
    const dept = String(r.department || 'ไม่ระบุแผนก').trim();
    const qty = parseFloat(r.quantity) || 0;
    const date = String(r.date || '').trim();

    const prodIdx = prodIdxMap.has(itemId) ? prodIdxMap.get(itemId) : 0;
    const destIdx = destIdxMap.has(dest) ? destIdxMap.get(dest) : 0;
    const deptIdx = deptIdxMap.has(dept) ? deptIdxMap.get(dept) : 0;

    transactions.push([
      date,
      prodIdx,
      destIdx,
      deptIdx,
      qty
    ]);
  });

  return {
    products,
    destinations,
    departments,
    transactions
  };
}

export function getLocalTurnoverData() {
  const monthlyRows = localDb.prepare(`SELECT * FROM turnover_monthly ORDER BY month_str DESC, total_qty DESC`).all();
  const dowRows = localDb.prepare(`SELECT * FROM turnover_dow`).all();
  const detailRows = localDb.prepare(`SELECT * FROM turnover_details ORDER BY qty DESC, date_str DESC`).all();

  const productMap = new Map();
  const whSet = new Set();
  const monthSet = new Set();

  monthlyRows.forEach(r => {
    const itemId = String(r.item_id || '').trim();
    const itemName = String(r.item_name || 'ไม่ระบุ').trim();
    if (itemId) {
      if (!productMap.has(itemId)) {
        productMap.set(itemId, itemName || itemId);
      }
    }
    if (r.src_wh) whSet.add(r.src_wh);
    if (r.dest_wh) whSet.add(r.dest_wh);
    if (r.month_str) monthSet.add(r.month_str);
  });

  detailRows.forEach(r => {
    const itemId = String(r.item_id || '').trim();
    const itemName = String(r.name || 'ไม่ระบุ').trim();
    if (itemId) {
      if (!productMap.has(itemId)) {
        productMap.set(itemId, itemName || itemId);
      }
    }
    if (r.src_wh) whSet.add(r.src_wh);
    if (r.dest_wh) whSet.add(r.dest_wh);
  });

  const products = Array.from(productMap.entries()).map(([id, name]) => [id, name]);
  const prodIdxMap = new Map();
  products.forEach((p, idx) => prodIdxMap.set(p[0], idx));

  const warehouses = Array.from(whSet).sort();
  const whIdxMap = new Map();
  warehouses.forEach((w, idx) => whIdxMap.set(w, idx));

  const months = Array.from(monthSet).sort();
  const monthIdxMap = new Map();
  months.forEach((m, idx) => monthIdxMap.set(m, idx));

  // Map aggregated: [month_idx, dir_idx, src_wh_idx, dest_wh_idx, prod_idx, qty, count]
  const aggregated = [];
  monthlyRows.forEach(r => {
    const mIdx = monthIdxMap.has(r.month_str) ? monthIdxMap.get(r.month_str) : 0;
    const dirIdx = r.direction === 'เข้า' ? 0 : 1;
    const srcIdx = whIdxMap.has(r.src_wh) ? whIdxMap.get(r.src_wh) : 0;
    const destIdx = whIdxMap.has(r.dest_wh) ? whIdxMap.get(r.dest_wh) : 0;
    const prodIdx = prodIdxMap.has(r.item_id) ? prodIdxMap.get(r.item_id) : 0;
    const qty = parseFloat(r.total_qty) || 0;
    const count = parseInt(r.tx_count, 10) || 1;

    aggregated.push([mIdx, dirIdx, srcIdx, destIdx, prodIdx, qty, count]);
  });

  // Map dowAggregated: [month_idx, dow, dir_idx, src_wh_idx, dest_wh_idx, qty]
  const dowAggregated = [];
  dowRows.forEach(r => {
    const mIdx = monthIdxMap.has(r.month_str) ? monthIdxMap.get(r.month_str) : 0;
    const dow = parseInt(r.dow, 10) || 0;
    const dirIdx = r.direction === 'เข้า' ? 0 : 1;
    const srcIdx = whIdxMap.has(r.src_wh) ? whIdxMap.get(r.src_wh) : 0;
    const destIdx = whIdxMap.has(r.dest_wh) ? whIdxMap.get(r.dest_wh) : 0;
    const qty = parseFloat(r.total_qty) || 0;

    dowAggregated.push([mIdx, dow, dirIdx, srcIdx, destIdx, qty]);
  });

  // Map details: [date_str, prod_idx, dir_idx, src_wh_idx, dest_wh_idx, qty]
  const details = [];
  detailRows.forEach(r => {
    const dateStr = String(r.date_str || '').trim();
    const prodIdx = prodIdxMap.has(r.item_id) ? prodIdxMap.get(r.item_id) : 0;
    const dirIdx = r.direction === 'เข้า' ? 0 : 1;
    const srcIdx = whIdxMap.has(r.src_wh) ? whIdxMap.get(r.src_wh) : 0;
    const destIdx = whIdxMap.has(r.dest_wh) ? whIdxMap.get(r.dest_wh) : 0;
    const qty = parseFloat(r.qty) || 0;

    details.push([dateStr, prodIdx, dirIdx, srcIdx, destIdx, qty]);
  });

  return {
    products,
    warehouses,
    months,
    aggregated,
    dowAggregated,
    details
  };
}
