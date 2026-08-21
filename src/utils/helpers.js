// =========================================================================
// ENTERPRISE DATA UTILITIES & NORMALIZATION HELPERS
// =========================================================================

/**
 * Get current date string in Bangkok timezone (UTC+7) as YYYY-MM-DD
 */
export function getBangkokDateString(date = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-CA', { 
      timeZone: 'Asia/Bangkok', 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    }).format(date);
  } catch {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}

/**
 * Validate whether a string is a strictly valid ISO calendar date (YYYY-MM-DD)
 */
export function isValidISODate(str) {
  if (typeof str !== 'string' || str.length !== 10) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const [y, m, d] = str.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/**
 * Format Date to DD/MM/YY
 */
export function formatDateToDDMMYY(dateStr) {
  if (!dateStr) return '';
  const str = String(dateStr).trim();
  const datePart = str.split('T')[0].split(' ')[0];
  
  if (datePart.includes('-')) {
    const parts = datePart.split('-');
    if (parts.length === 3) {
      let [y, m, d] = parts;
      if (y.length === 4) {
        return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y.substring(2)}`;
      }
    }
  }
  
  if (datePart.includes('/')) {
    const parts = datePart.split('/');
    if (parts.length === 3) {
      let [d, m, y] = parts;
      if (y.length === 4) {
        y = y.substring(2);
      }
      return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
    }
  }
  
  return datePart;
}

/**
 * Format Thai Baht currency
 */
export function formatBahtCurrency(val) {
  if (val === undefined || val === null || isNaN(val)) return '฿0';
  const num = Number(val);
  if (num === 0) return '฿0';
  const absVal = Math.abs(num);
  if (absVal >= 1e6) {
    return '฿' + (num / 1e6).toFixed(2) + 'M';
  }
  return new Intl.NumberFormat('th-TH', { 
    style: 'currency', 
    currency: 'THB', 
    maximumFractionDigits: 0 
  }).format(num);
}

/**
 * Clean product codes with floating zeros (e.g. 120000 -> 12)
 */
export function cleanProductCode(code) {
  if (!code) return '';
  const str = String(code).trim();
  if (/^\d+$/.test(str) && str.length >= 12 && str.endsWith('0000')) {
    const cleaned = str.replace(/0+$/, '');
    return cleaned || '0';
  }
  return str;
}

function validateAndFormatISODate(year, month, day) {
  let y = parseInt(year, 10);
  const m = parseInt(month, 10);
  const d = parseInt(day, 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  if (y > 2400) y -= 543; // Thai Buddhist Era to CE
  if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    return null;
  }
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Normalize any Date object, numeric Excel serial date, or Thai/Western date string
 * to standard ISO YYYY-MM-DD. Returns null if invalid.
 * GUARANTEED CONTRACT: Returns string in format 'YYYY-MM-DD' or null.
 */
export function normalizeToISODate(val) {
  if (val === null || val === undefined || val === '' || val === '-' || val === 'Unknown') {
    return null;
  }

  // 1. JS Date instance
  if (val instanceof Date && !isNaN(val.getTime())) {
    return validateAndFormatISODate(val.getFullYear(), val.getMonth() + 1, val.getDate());
  }

  // 2. Numeric Excel serial number (with UTC Math & 1900 Leap Year Bug handling)
  const numVal = typeof val === 'number' ? val : (typeof val === 'string' && !isNaN(Number(val)) && !val.includes('-') && !val.includes('/') ? Number(val) : NaN);
  if (!isNaN(numVal) && numVal > 0 && numVal < 100000) {
    // Excel bug: 1900 was not a leap year, but Excel considers serial 60 as 1900-02-29
    const days = numVal > 60 ? numVal - 25569 : numVal - 25568;
    const millis = Math.round(days * 86400000);
    const excelDate = new Date(millis);
    if (!isNaN(excelDate.getTime())) {
      return validateAndFormatISODate(excelDate.getUTCFullYear(), excelDate.getUTCMonth() + 1, excelDate.getUTCDate());
    }
  }

  let str = String(val).trim();
  if (!str || str === 'Unknown' || str === '-') return null;

  // Strip time part
  str = str.split('T')[0].split(' ')[0];

  // 3. Match YYYY-MM-DD or YYYY/MM/DD
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(str)) {
    const parts = str.split(/[-/]/);
    return validateAndFormatISODate(parts[0], parts[1], parts[2]);
  }

  // 4. Match YY-MM-DD (e.g. 26-08-20 -> 2026-08-20)
  if (/^\d{2}[-/]\d{1,2}[-/]\d{1,2}$/.test(str)) {
    const parts = str.split(/[-/]/);
    return validateAndFormatISODate(2000 + parseInt(parts[0], 10), parts[1], parts[2]);
  }

  // 5. Match DD/MM/YYYY or DD-MM-YYYY or DD/MM/YY
  if (/^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/.test(str)) {
    const parts = str.split(/[-/]/);
    let y = parseInt(parts[2], 10);
    if (y < 100) y = 2000 + y;
    return validateAndFormatISODate(y, parts[1], parts[0]);
  }

  // 6. Native Date parse fallback
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return validateAndFormatISODate(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
  }

  return null;
}

/**
 * Helper: Pre-compute normalized key map for O(1) row lookups
 */
function createRowKeyLookup(row) {
  const map = new Map();
  if (!row || typeof row !== 'object') return () => '';

  for (const [k, v] of Object.entries(row)) {
    if (v !== undefined && v !== null && v !== '') {
      const cleanK = String(k).trim();
      const normK = cleanK.toLowerCase().replace(/[\s_\-.()[\]"']/g, '');
      map.set(cleanK, v);
      if (!map.has(normK)) map.set(normK, v);
    }
  }

  return (...keys) => {
    for (const key of keys) {
      if (map.has(key)) return map.get(key);
      const normKey = String(key).toLowerCase().replace(/[\s_\-.()[\]"']/g, '');
      if (map.has(normKey)) return map.get(normKey);
    }
    return '';
  };
}

/**
 * Clean and standardize Stagnant dataset rows
 */
export function cleanExcelRows(rows) {
  if (!Array.isArray(rows)) return [];
  const todayBkkStr = getBangkokDateString();
  const today = new Date(todayBkkStr);
  today.setHours(0, 0, 0, 0);

  return rows.map(row => {
    const getVal = createRowKeyLookup(row);

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

    const rawDate = getVal('วันที่นำเข้าคลัง', 'วันนำเข้า', 'วันที่รับเข้า', 'วันที่เคลื่อนไหวล่าสุด', 'วันที่เคลื่อนไหวล่าสุ', 'วันเคลื่อนไหวล่าสุด', 'วันโอน', 'วันที่', 'date', 'Date', 'last_movement', 'tx_date');
    const normalizedDate = normalizeToISODate(rawDate);

    // Calculate duration string
    let durationStr = getVal('ระยะเวลารวม', 'ระยะเวลาเฉลี่ย', 'ระยะเวลา', 'duration', 'stagnant_period');
    if (!durationStr && normalizedDate) {
      const target = new Date(normalizedDate);
      target.setHours(0, 0, 0, 0);
      const diffMs = today.getTime() - target.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffDays >= 365) {
        const yrs = Math.floor(diffDays / 365);
        const mons = Math.floor((diffDays % 365) / 30.4375);
        durationStr = mons > 0 ? `${yrs} year ${mons} mons` : `${yrs} year`;
      } else if (diffDays > 0) {
        const mons = Math.floor(diffDays / 30.4375);
        durationStr = mons > 0 ? `${mons} mons` : `${diffDays} days`;
      } else {
        durationStr = '0 days';
      }
    } else if (!durationStr) {
      durationStr = '1 year';
    }

    const itemId = String(rawItemId || '-').trim();
    const itemName = String(rawItemName || rawItemId || 'Unknown Item').trim();

    return {
      'รหัสสินค้า': itemId,
      'ชื่อสามัญ': itemName,
      'คลัง': String(rawWh || 'คลังหลัก').trim(),
      'lot_number_id': String(rawLot || '-').trim(),
      'จำนวน': rawQty,
      'หน่วย': String(rawUnit).trim(),
      'ระยะเวลารวม': String(durationStr).trim(),
      'ราคาต่อหน่วย': finalUnitPrice,
      'มูลค่า': finalTotalValue,
      'มูลค่ารวม': finalTotalValue,
      'วันที่เคลื่อนไหวล่าสุด': normalizedDate,
      'วันที่เคลื่อนไหวล่าสุ': normalizedDate, // Backward compatible alias
      'วันโอน': normalizedDate
    };
  }).filter(r => (r['รหัสสินค้า'] !== '-' || r['ชื่อสามัญ'] !== 'Unknown Item') && (r['จำนวน'] > 0 || r['มูลค่ารวม'] > 0 || r['lot_number_id'] !== '-'));
}

/**
 * Clean and standardize Expiry dataset rows
 */
export function cleanExpiryRows(rows) {
  if (!Array.isArray(rows)) return [];
  const todayBkkStr = getBangkokDateString();
  const today = new Date(todayBkkStr);
  today.setHours(0, 0, 0, 0);

  return rows.map(row => {
    const getVal = createRowKeyLookup(row);

    const rawItemId = getVal('รหัสสินค้า', 'รหัส', 'item_id', 'code', 'product_id');
    const rawItemName = getVal('ชื่อสินค้า', 'ชื่อสามัญ', 'ชื่อสินค้า (ชื่อสามัญ)', 'ชื่อยา', 'รายการ', 'รายการยา', 'ชื่อ', 'name', 'item_name');
    const rawWh = getVal('คลัง', 'คลังสินค้า', 'ห้องยา', 'warehouse', 'stock_name', 'dept');
    const rawLot = getVal('lot_number_id', 'lot', 'lot_no', 'lot number', 'เลขล็อต', 'ล็อต');
    const rawQty = Math.abs(parseFloat(String(getVal('จำนวน', 'คงเหลือ', 'ยอดคงเหลือ', 'จำนวนคงเหลือ', 'qty', 'quantity', 'balance')).replace(/,/g, ''))) || 0;
    const rawUnit = getVal('หน่วย', 'หน่วยนับ', 'unit', 'uom') || 'ea';
    const rawDate = getVal('วันหมดอายุ', 'วันที่หมดอายุ', 'exp_date', 'expire_date', 'expire', 'expiry', 'exp', 'วันที่');
    const rawPrice = Math.abs(parseFloat(String(getVal('ราคาต่อหน่วย', 'ราคา', 'unit_price', 'price', 'cost')).replace(/,/g, ''))) || 0.0;
    const rawTotal = Math.abs(parseFloat(String(getVal('มูลค่ารวม', 'มูลค่า', 'ราคารวม', 'ยอดเงิน', 'total_value', 'total_price', 'amount', 'sum_price')).replace(/,/g, '')));
    const parsedTotal = !isNaN(rawTotal) && rawTotal > 0 ? rawTotal : parseFloat((rawQty * rawPrice).toFixed(2));

    const isoDate = normalizeToISODate(rawDate);

    // Calculate duration string
    let durationStr = getVal('ระยะเวลาหมดอายุ', 'ระยะเวลา');
    if (!durationStr && isoDate) {
      const target = new Date(isoDate);
      target.setHours(0, 0, 0, 0);
      const diffMs = today.getTime() - target.getTime();
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

    const isExpired = isoDate && isoDate <= todayBkkStr;

    const finalItemId = String(rawItemId || '-').trim();
    const finalItemName = String(rawItemName || rawItemId || 'Unknown Item').trim();

    return {
      'รหัสสินค้า': finalItemId,
      'ชื่อสินค้า': finalItemName,
      'ชื่อสามัญ': finalItemName,
      'คลัง': String(rawWh || 'คลังหลัก').trim(),
      'lot_number_id': String(rawLot || '-').trim(),
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
  }).filter(r => (r['รหัสสินค้า'] !== '-' || r['ชื่อสินค้า'] !== 'Unknown Item') && (r['จำนวน'] > 0 || r['มูลค่ารวม'] > 0 || r['lot_number_id'] !== '-'));
}
