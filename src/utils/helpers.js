// Format Date to DD/MM/YY
export function formatDateToDDMMYY(dateStr) {
  if (!dateStr) return '';
  dateStr = dateStr.trim();
  const datePart = dateStr.split(' ')[0];
  
  if (datePart.includes('-')) {
    const parts = datePart.split('-');
    if (parts.length === 3) {
      const y = parts[0];
      const m = parts[1];
      const d = parts[2];
      if (y.length === 4) {
        return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y.substring(2)}`;
      }
    }
  }
  
  if (datePart.includes('/')) {
    const parts = datePart.split('/');
    if (parts.length === 3) {
      let d = parts[0];
      let m = parts[1];
      let y = parts[2];
      if (y.length === 4) {
        y = y.substring(2);
      }
      return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
    }
  }
  
  return dateStr;
}

// Normalize any Date object, numeric Excel serial date, or Thai/Western date string to standard ISO YYYY-MM-DD
export function normalizeToISODate(val) {
  if (!val && val !== 0) return 'Unknown';

  // 1. JS Date instance (from XLSX cellDates: true)
  if (val instanceof Date && !isNaN(val.getTime())) {
    let y = val.getFullYear();
    if (y > 2400) y -= 543; // Thai BE to AD
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // 2. Numeric Excel serial timestamp (e.g. 45838 or "45678.29171")
  const numVal = typeof val === 'number' ? val : (typeof val === 'string' && !isNaN(Number(val)) && !val.includes('-') && !val.includes('/') ? Number(val) : NaN);
  if (!isNaN(numVal) && numVal > 10000 && numVal < 70000) {
    const excelDate = new Date((numVal - 25569) * 86400 * 1000);
    if (!isNaN(excelDate.getTime())) {
      let y = excelDate.getUTCFullYear();
      if (y > 2400) y -= 543;
      const m = String(excelDate.getUTCMonth() + 1).padStart(2, '0');
      const d = String(excelDate.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  let str = String(val).trim();
  if (!str || str === 'Unknown' || str === '-') return 'Unknown';

  // Strip time part if present
  if (str.includes('T')) {
    str = str.split('T')[0];
  } else if (str.includes(' ')) {
    str = str.split(' ')[0];
  }

  // 3. Match YYYY-MM-DD or YYYY/MM/DD
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(str)) {
    const parts = str.split(/[-/]/);
    let y = parseInt(parts[0], 10);
    if (y > 2400) y -= 543;
    const m = parts[1].padStart(2, '0');
    const d = parts[2].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // 4. Match YY-MM-DD (e.g. 25-08-30 -> 2025-08-30)
  if (/^\d{2}[-/]\d{1,2}[-/]\d{1,2}$/.test(str)) {
    const parts = str.split(/[-/]/);
    let y = 2000 + parseInt(parts[0], 10);
    const m = parts[1].padStart(2, '0');
    const d = parts[2].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // 5. Match DD/MM/YYYY or DD-MM-YYYY or DD/MM/YY (e.g. 30/08/25 -> 2025-08-30)
  if (/^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/.test(str)) {
    const parts = str.split(/[-/]/);
    let d = parts[0].padStart(2, '0');
    let m = parts[1].padStart(2, '0');
    let y = parseInt(parts[2], 10);
    if (y < 100) {
      y = 2000 + y; // 25 -> 2025, 26 -> 2026
    }
    if (y > 2400) y -= 543;
    return `${y}-${m}-${d}`;
  }

  // 5. Native Date parse fallback
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    let y = parsed.getFullYear();
    if (y > 2400) y -= 543;
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return str;
}

// Clean and standardize Stagnant dataset rows
export function cleanExcelRows(rows) {
  return rows.map(row => {
    const cleaned = {};
    for (let key in row) {
      if (key) cleaned[key.trim()] = row[key];
    }

    const getVal = (...keys) => {
      for (const k of keys) {
        if (cleaned[k] !== undefined && cleaned[k] !== null && cleaned[k] !== '') {
          return cleaned[k];
        }
      }
      for (const k of keys) {
        const lower = k.toLowerCase().replace(/[\s_\-\.\(\)\[\]"]/g, '');
        for (const actualKey in cleaned) {
          const actNorm = actualKey.toLowerCase().replace(/[\s_\-\.\(\)\[\]"]/g, '');
          if (actNorm === lower || actNorm.includes(lower) || lower.includes(actNorm)) {
            if (cleaned[actualKey] !== undefined && cleaned[actualKey] !== null && cleaned[actualKey] !== '') {
              return cleaned[actualKey];
            }
          }
        }
      }
      return '';
    };

    const rawItemId = getVal('รหัสสินค้า', 'รหัส', 'item_id', 'code', 'product_id', 'itemcode', 'รหัสยา');
    const rawItemName = getVal('ชื่อสามัญ', 'ชื่อสินค้า (ชื่อสามัญ)', 'ชื่อสินค้า', 'ชื่อยา', 'สินค้า', 'รายการ', 'ชื่อ', 'name', 'item_name', 'product_name');
    const rawWh = getVal('คลัง', 'คลังสินค้า', 'ห้องยา', 'สถานที่จัดเก็บ', 'warehouse', 'dept');
    const rawLot = getVal('lot_number_id', 'lot', 'lot_no', 'lot_number', 'เลขล็อต', 'ล็อต');
    const rawQty = Math.abs(parseFloat(String(getVal('จำนวน', 'จำนวนชิ้น', 'คงเหลือ', 'ยอดคงเหลือ', 'จำนวนคงเหลือ', 'qty', 'quantity', 'balance')).replace(/,/g, ''))) || 0;
    const rawUnit = getVal('หน่วย', 'หน่วยนับ', 'unit', 'uom') || 'ea';
    const rawPrice = Math.abs(parseFloat(String(getVal('ราคาต่อหน่วย', 'ราคา', 'ราคาซื้อ', 'unit_price', 'price', 'cost')).replace(/,/g, ''))) || 0.0;
    const rawTotalValue = Math.abs(parseFloat(String(getVal('มูลค่ารวมทั้งหมด', 'มูลค่ารวม', 'ราคารวม', 'ยอดเงิน', 'total_value', 'total_price', 'มูลค่า', 'amount')).replace(/,/g, '')));
    const finalTotalValue = !isNaN(rawTotalValue) && rawTotalValue > 0 ? rawTotalValue : (rawQty * rawPrice > 0 ? parseFloat((rawQty * rawPrice).toFixed(2)) : 0.0);
    const finalUnitPrice = rawPrice > 0 ? rawPrice : (rawQty > 0 && finalTotalValue > 0 ? parseFloat((finalTotalValue / rawQty).toFixed(2)) : 0.0);

    const rawDate = getVal('วันที่นำเข้าคลัง', 'วันนำเข้า', 'วันที่รับเข้า', 'วันที่เคลื่อนไหวล่าสุ', 'วันเคลื่อนไหวล่าสุด', 'วันโอน', 'วันที่', 'date', 'Date', 'last_movement', 'tx_date');
    const normalizedDate = normalizeToISODate(rawDate);

    // Calculate duration string e.g. "1 year 2 mons", "2 years 19 days" if not provided
    let durationStr = getVal('ระยะเวลารวม', 'ระยะเวลาเฉลี่ย', 'ระยะเวลา', 'duration', 'stagnant_period');
    if (!durationStr && normalizedDate && normalizedDate !== 'Unknown' && normalizedDate.includes('-')) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const target = new Date(normalizedDate);
      target.setHours(0, 0, 0, 0);
      const diffMs = today - target;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays >= 365) {
        const yrs = Math.floor(diffDays / 365);
        const mons = Math.floor((diffDays % 365) / 30.4375);
        durationStr = mons > 0 ? `${yrs} year ${mons} mons` : `${yrs} year`;
      } else if (diffDays > 0) {
        const mons = Math.floor(diffDays / 30.4375);
        durationStr = mons > 0 ? `${mons} mons` : `${diffDays} days`;
      } else {
        durationStr = '1 year';
      }
    } else if (!durationStr) {
      durationStr = '1 year';
    }

    const cleanedRow = {
      'รหัสสินค้า': String(rawItemId || '-').trim(),
      'ชื่อสามัญ': String(rawItemName || rawItemId || 'Unknown Item').trim(),
      'คลัง': String(rawWh || 'คลังหลัก').trim(),
      'lot_number_id': String(rawLot || '-').trim(),
      'จำนวน': rawQty,
      'หน่วย': String(rawUnit).trim(),
      'ระยะเวลารวม': String(durationStr).trim(),
      'ราคาต่อหน่วย': finalUnitPrice,
      'มูลค่า': finalTotalValue,
      'มูลค่ารวม': finalTotalValue,
      'วันที่เคลื่อนไหวล่าสุ': normalizedDate,
      'วันโอน': normalizedDate
    };

    return cleanedRow;
  }).filter(r => r['รหัสสินค้า'] !== '-' || r['ชื่อสามัญ'] !== 'Unknown Item');
}

// Clean and standardize Expiry dataset rows
export function cleanExpiryRows(rows) {
  return rows.map(row => {
    const cleaned = {};
    for (let key in row) {
      if (key) cleaned[key.trim()] = row[key];
    }

    const getVal = (...keys) => {
      for (const k of keys) {
        if (cleaned[k] !== undefined && cleaned[k] !== null && cleaned[k] !== '') {
          return cleaned[k];
        }
      }
      for (const k of keys) {
        const lower = k.toLowerCase();
        for (const actualKey in cleaned) {
          if (actualKey.toLowerCase() === lower || actualKey.includes(k)) {
            if (cleaned[actualKey] !== undefined && cleaned[actualKey] !== null && cleaned[actualKey] !== '') {
              return cleaned[actualKey];
            }
          }
        }
      }
      return '';
    };

    const rawItemId = getVal('รหัสสินค้า', 'รหัส', 'item_id', 'code', 'product_id');
    const rawItemName = getVal('ชื่อสินค้า', 'ชื่อสามัญ', 'ชื่อสินค้า (ชื่อสามัญ)', 'ชื่อยา', 'รายการ', 'รายการยา', 'ชื่อ', 'name', 'item_name');
    const rawWh = getVal('คลัง', 'คลังสินค้า', 'ห้องยา', 'warehouse', 'stock_name', 'dept');
    const rawLot = getVal('lot_number_id', 'lot', 'lot_no', 'lot number', 'เลขล็อต', 'ล็อต');
    const rawQty = parseFloat(getVal('จำนวน', 'คงเหลือ', 'ยอดคงเหลือ', 'จำนวนคงเหลือ', 'qty', 'quantity', 'balance')) || 0;
    const rawUnit = getVal('หน่วย', 'หน่วยนับ', 'unit', 'uom') || 'ea';
    const rawDate = getVal('วันหมดอายุ', 'วันที่หมดอายุ', 'exp_date', 'expire_date', 'expire', 'expiry', 'exp', 'วันที่');
    const rawPrice = parseFloat(getVal('ราคาต่อหน่วย', 'ราคา', 'unit_price', 'price', 'cost')) || 0.0;
    const rawTotal = parseFloat(getVal('มูลค่ารวม', 'มูลค่า', 'ราคารวม', 'ยอดเงิน', 'total_value', 'total_price', 'amount', 'sum_price'));
    const parsedTotal = !isNaN(rawTotal) && rawTotal > 0 ? rawTotal : parseFloat((rawQty * rawPrice).toFixed(2));

    const isoDate = normalizeToISODate(rawDate);

    // Calculate duration string e.g. "1 year 2 mon", "2 mon 5 days", "13 days", "0 days"
    let durationStr = getVal('ระยะเวลาหมดอายุ', 'ระยะเวลา');
    if (!durationStr && isoDate.includes('-')) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const target = new Date(isoDate);
      target.setHours(0, 0, 0, 0);
      const diffMs = today - target;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays >= 365) {
        const yrs = Math.floor(diffDays / 365);
        const mons = Math.floor((diffDays % 365) / 30.4375);
        durationStr = mons > 0 ? `${yrs} year ${mons} mon` : `${yrs} year`;
      } else if (diffDays >= 30) {
        const mons = Math.floor(diffDays / 30.4375);
        const days = Math.floor(diffDays % 30.4375);
        durationStr = days > 0 ? `${mons} mon ${days} days` : `${mons} mon`;
      } else if (diffDays > 0) {
        durationStr = `${diffDays} days`;
      } else {
        durationStr = '0 days';
      }
    }

    const isExpired = isoDate !== 'Unknown' && isoDate <= new Date().toISOString().split('T')[0];

    let finalItemId = String(rawItemId).trim();
    let finalItemName = String(rawItemName || rawItemId || '').trim();

    if (!finalItemId && !finalItemName) {
      const stringKeys = Object.keys(cleaned).filter(k => typeof cleaned[k] === 'string' && cleaned[k].trim());
      if (stringKeys.length > 0) {
        finalItemName = String(cleaned[stringKeys[0]]).trim();
      } else {
        finalItemName = 'Unknown Item';
      }
    }

    return {
      'รหัสสินค้า': finalItemId || '-',
      'ชื่อสินค้า': finalItemName,
      'ชื่อสามัญ': finalItemName,
      'คลัง': String(rawWh || 'คลังหลัก').trim(),
      'lot_number_id': String(rawLot).trim(),
      'จำนวน': rawQty,
      'หน่วย': String(rawUnit).trim(),
      'วันหมดอายุ': isoDate,
      'day_expiry': isoDate,
      'ระยะเวลาหมดอายุ': durationStr || '0 days',
      'ราคาต่อหน่วย': rawPrice,
      'มูลค่า': parsedTotal,
      'มูลค่ารวม': parsedTotal,
      'สถานะ': getVal('สถานะ') || (isExpired ? 'หมดอายุแล้ว' : 'ใกล้หมดอายุ')
    };
  }).filter(r => (r['รหัสสินค้า'] && r['รหัสสินค้า'] !== '-') || (r['ชื่อสินค้า'] && r['ชื่อสินค้า'] !== 'Unknown Item') || r['จำนวน'] > 0 || r['มูลค่ารวม'] > 0);
}
