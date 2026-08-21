import * as XLSX from 'xlsx';
import { cleanExcelRows, cleanExpiryRows, normalizeToISODate } from './helpers';

// Helper: Clean key from BOM and whitespace
function cleanKey(str) {
  if (!str && str !== 0) return '';
  return String(str).replace(/^\uFEFF/, '').trim();
}

// Helper: Decode binary buffer to text with automatic Thai Windows-874 / UTF-8 fallback
function decodeBufferToText(buffer) {
  try {
    const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
    return utf8Decoder.decode(buffer);
  } catch {
    try {
      const thaiDecoder = new TextDecoder('windows-874');
      return thaiDecoder.decode(buffer);
    } catch {
      const latinDecoder = new TextDecoder('latin1');
      return latinDecoder.decode(buffer);
    }
  }
}

// Helper: Detect and extract data rows even if header is not on row 0 (e.g. title rows in hospital exports)
function extractSmartRowsFromSheet(sheet) {
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (!matrix || matrix.length === 0) {
    return XLSX.utils.sheet_to_json(sheet, { defval: '' });
  }

  const headerKeywords = [
    'รหัส', 'ชื่อ', 'คลัง', 'จำนวน', 'คงเหลือ', 'หมดอายุ', 'lot', 'ราคา', 'มูลค่า',
    'item', 'name', 'qty', 'exp', 'date', 'balance', 'warehouse', 'dept'
  ];

  let headerRowIndex = 0;
  for (let r = 0; r < Math.min(matrix.length, 12); r++) {
    const row = matrix[r];
    if (Array.isArray(row)) {
      const matched = row.filter(cell => {
        const cStr = cleanKey(cell).toLowerCase();
        return headerKeywords.some(kw => cStr.includes(kw));
      });
      if (matched.length >= 2) {
        headerRowIndex = r;
        break;
      }
    }
  }

  const headers = matrix[headerRowIndex].map(h => cleanKey(h));
  const resultRows = [];

  for (let r = headerRowIndex + 1; r < matrix.length; r++) {
    const row = matrix[r];
    if (!row || row.length === 0) continue;
    const obj = {};
    let hasData = false;
    headers.forEach((h, colIdx) => {
      const colKey = h || `col_${colIdx}`;
      const cellVal = row[colIdx] !== undefined ? row[colIdx] : '';
      obj[colKey] = cellVal;
      if (cellVal !== '' && cellVal !== null && cellVal !== undefined) {
        hasData = true;
      }
    });
    if (hasData) {
      resultRows.push(obj);
    }
  }

  return resultRows.length > 0 ? resultRows : XLSX.utils.sheet_to_json(sheet, { defval: '' });
}

// Helper: Extract field from row by checking exact keys and fuzzy aliases
function extractRowField(row, aliases, fallback = '') {
  if (!row || typeof row !== 'object') return fallback;

  // 1. Exact match
  for (const alias of aliases) {
    if (row[alias] !== undefined && row[alias] !== null && String(row[alias]).trim() !== '') {
      return String(row[alias]).trim();
    }
  }

  // 2. Normalized key match (lowercase, no spaces/underscores)
  const normalizedKeys = Object.keys(row).map(k => ({
    orig: k,
    norm: k.toLowerCase().replace(/[\s_\-\.\(\)\[\]"]/g, '')
  }));

  for (const alias of aliases) {
    const normAlias = alias.toLowerCase().replace(/[\s_\-\.\(\)\[\]"]/g, '');
    const found = normalizedKeys.find(k => k.norm === normAlias);
    if (found && row[found.orig] !== undefined && row[found.orig] !== null && String(row[found.orig]).trim() !== '') {
      return String(row[found.orig]).trim();
    }
  }

  // 3. Substring key match
  for (const alias of aliases) {
    const normAlias = alias.toLowerCase().replace(/[\s_\-\.\(\)\[\]"]/g, '');
    if (normAlias.length < 2) continue;
    const found = normalizedKeys.find(k => k.norm.includes(normAlias) || normAlias.includes(k.norm));
    if (found && row[found.orig] !== undefined && row[found.orig] !== null && String(row[found.orig]).trim() !== '') {
      return String(row[found.orig]).trim();
    }
  }

  return fallback;
}

// Helper: Extract numeric value from row by aliases
function extractNumericField(row, aliases, fallback = 0) {
  const valStr = extractRowField(row, aliases, '');
  if (valStr === '') return fallback;
  const num = parseFloat(String(valStr).replace(/,/g, ''));
  return isNaN(num) ? fallback : num;
}

/**
 * Smart Excel/CSV parser that parses an uploaded File object
 * supporting UTF-8, Thai TIS-620/Windows-874, and multi-row header reports.
 */
export async function parseUploadedFile(file, activeTab = 'stagnant') {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const buffer = e.target.result;
        const isCsv = file.name.toLowerCase().endsWith('.csv') || file.type.includes('csv') || file.type.includes('text');

        let workbook = null;

        if (isCsv) {
          // Decode text properly handling Thai Windows-874 / UTF-8
          const textContent = decodeBufferToText(buffer);
          workbook = XLSX.read(textContent, { type: 'string', raw: false });
        } else {
          // Parse Excel binary (.xlsx, .xls)
          try {
            workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
          } catch {
            const textContent = decodeBufferToText(buffer);
            workbook = XLSX.read(textContent, { type: 'string', raw: false });
          }
        }
        
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          throw new Error('ไม่พบข้อมูล Sheet ในไฟล์ที่อัปโหลด');
        }

        // Try to match sheet name by activeTab or take the first sheet
        let sheetName = workbook.SheetNames[0];
        const tabLower = activeTab.toLowerCase();
        for (const s of workbook.SheetNames) {
          const sLower = s.toLowerCase();
          if (sLower.includes(tabLower) || 
              (tabLower === 'stagnant' && (sLower.includes('stagnant') || sLower.includes('ไม่เคลื่อนไหว') || sLower.includes('ค้าง'))) ||
              (tabLower === 'expiry' && (sLower.includes('expiry') || sLower.includes('expire') || sLower.includes('หมดอายุ'))) ||
              (tabLower === 'dispatch' && (sLower.includes('dispatch') || sLower.includes('จ่าย') || sLower.includes('เบิก'))) ||
              (tabLower === 'inventory' && (sLower.includes('inventory') || sLower.includes('คงคลัง') || sLower.includes('สต็อก'))) ||
              (tabLower === 'turnover' && (sLower.includes('turnover') || sLower.includes('หมุนเวียน') || sLower.includes('โอนย้าย')))
          ) {
            sheetName = s;
            break;
          }
        }

        const sheet = workbook.Sheets[sheetName];
        const rawJson = extractSmartRowsFromSheet(sheet);

        if (!rawJson || rawJson.length === 0) {
          throw new Error('ไฟล์ที่อัปโหลดไม่มีข้อมูลแถว (Empty Sheet)');
        }

        let resultType = activeTab;
        let parsedData = null;

        if (activeTab === 'expiry') {
          resultType = 'expiry';
          parsedData = cleanExpiryRows(rawJson);
        } else if (activeTab === 'dispatch') {
          resultType = 'dispatch';
          const productsMap = new Map(); // id -> { id, name }
          const destinationsMap = new Map(); // name -> idx
          const departmentsMap = new Map(); // name -> idx
          const destinationsList = [];
          const departmentsList = [];
          const productsList = [];
          const transactions = [];

          rawJson.forEach(row => {
            const rawDate = extractRowField(row, ['วันที่', 'วันที่จ่าย', 'วันจ่าย', 'วันที่ส่งออก', 'วันที่เบิก', 'วันเบิก', 'วัน', 'date', 'Date', 'Transaction Date', 'tx_date', 'dispatch_date', 'issue_date', 'timestamp']);
            const dateStr = normalizeToISODate(rawDate);
            if (!dateStr || dateStr === 'Unknown') return;

            const itemId = extractRowField(row, ['item_id', 'item_code', 'code', 'product_id', 'product_code', 'รหัสสินค้า', 'รหัสยา', 'รหัสเวชภัณฑ์', 'รหัสรายการ', 'รหัส']);
            const itemName = extractRowField(row, ['สินค้า', 'ชื่อสินค้า', 'ชื่อยา', 'ชื่อเวชภัณฑ์', 'ชื่อสามัญ', 'ชื่อรายการ', 'รายการ', 'name', 'item_name', 'product_name', 'description'], itemId || 'ไม่ระบุชื่อสินค้า');
            const destWh = extractRowField(row, ['คลังปลายทาง', 'คลังรับ', 'คลังสินค้าปลายทาง', 'คลังที่รับ', 'คลังส่งมอบ', 'ปลายทาง', 'สถานที่จัดเก็บ', 'หน่วยงานรับ', 'แผนกรับ', 'destination', 'dest_wh', 'to_wh', 'target_warehouse', 'warehouse', 'คลัง'], 'ไม่ระบุคลัง');
            const dept = extractRowField(row, ['แผนก', 'หน่วยงาน', 'ฝ่าย', 'กอง', 'งาน', 'ผู้เบิก', 'department', 'dept', 'division', 'section', 'requester'], 'ไม่ระบุแผนก');
            const qty = Math.abs(extractNumericField(row, [
              'จำนวนสินค้าที่ส่งออก', 'จำนวนที่ส่งออก', 'จำนวนสินค้าที่จ่าย', 'จำนวนที่จ่าย',
              'จำนวนสินค้า', 'จำนวนจ่าย', 'ยอดจ่าย', 'ยอดส่งออก', 'จำนวนเบิก', 'ยอดเบิก',
              'จำนวน', 'ยอด', 'ปริมาณ', 'qty', 'quantity', 'amount', 'dispatch_qty',
              'dispatched_qty', 'export_qty', 'out_qty', 'issue_qty'
            ], 0));

            if (!itemId && !itemName && qty === 0) return;

            const finalItemId = itemId || itemName;
            if (!productsMap.has(finalItemId)) {
              const pIdx = productsList.length;
              productsMap.set(finalItemId, pIdx);
              productsList.push([finalItemId, itemName]);
            }
            const pIdx = productsMap.get(finalItemId);

            if (!destinationsMap.has(destWh)) {
              const dIdx = destinationsList.length;
              destinationsMap.set(destWh, dIdx);
              destinationsList.push(destWh);
            }
            const destIdx = destinationsMap.get(destWh);

            if (!departmentsMap.has(dept)) {
              const dpIdx = departmentsList.length;
              departmentsMap.set(dept, dpIdx);
              departmentsList.push(dept);
            }
            const deptIdx = departmentsMap.get(dept);

            transactions.push([dateStr, pIdx, destIdx, deptIdx, qty]);
          });

          parsedData = {
            products: productsList,
            destinations: destinationsList,
            departments: departmentsList,
            transactions
          };
        } else if (activeTab === 'inventory') {
          resultType = 'inventory';
          parsedData = rawJson.map(row => {
            const itemId = extractRowField(row, ['item_id', 'item_code', 'code', 'product_id', 'รหัสสินค้า', 'รหัสยา', 'รหัสเวชภัณฑ์', 'รหัสรายการ', 'รหัส']);
            const name = extractRowField(row, ['สินค้า', 'ชื่อสินค้า', 'ชื่อยา', 'ชื่อเวชภัณฑ์', 'ชื่อสามัญ', 'ชื่อรายการ', 'รายการ', 'name', 'item_name', 'product_name', 'description'], itemId || '');
            const warehouse = extractRowField(row, ['คลัง', 'คลังสินค้า', 'สถานที่จัดเก็บ', 'warehouse', 'wh_name'], 'คลังหลัก');
            const stock = extractNumericField(row, ['คงเหลือ', 'ยอดคงเหลือ', 'ยอดคงคลัง', 'จำนวนคงเหลือ', 'จำนวน', 'stock', 'balance', 'quantity', 'qty'], 0);
            const unit = extractRowField(row, ['หน่วย', 'หน่วยนับ', 'unit', 'uom'], 'ea');
            const min_threshold = extractNumericField(row, ['min_stock', 'เกณฑ์ต่ำสุด', 'min', 'Min', 'min_threshold', 'จุดสั่งซื้อ'], 0);
            const max_threshold = extractNumericField(row, ['max_stock', 'เกณฑ์สูงสุด', 'max', 'Max', 'max_threshold'], 0);
            const daily_usage = extractNumericField(row, ['daily_usage', 'อัตราใช้ต่อวัน', 'อัตราใช้', 'usage'], (stock > 0 ? parseFloat((stock / 30).toFixed(2)) : 0));
            const unit_price = extractNumericField(row, ['ราคาต่อหน่วย', 'ราคา', 'ราคาซื้อ', 'unit_price', 'price', 'cost'], 0);
            const total_value = extractNumericField(row, ['มูลค่ารวม', 'มูลค่า', 'total_value', 'amount'], (stock * unit_price));

            let status = 'Normal';
            let status_th = 'ปกติ';
            if (stock === 0) {
              status = 'Out of Stock';
              status_th = 'หมดคลัง';
            } else if (min_threshold === 0 && max_threshold === 0) {
              status = 'Unspecified';
              status_th = 'ไม่ได้ระบุ';
            } else if (min_threshold > 0 && stock < min_threshold) {
              status = 'Below Min';
              status_th = 'ต่ำกว่าเกณฑ์';
            } else if (max_threshold > 0 && stock > max_threshold) {
              status = 'Over Max';
              status_th = 'เกินเกณฑ์';
            }

            return {
              item_id: itemId || '-',
              name: name || 'Unknown Item',
              warehouse,
              stock,
              quantity: stock,
              unit,
              min_threshold,
              max_threshold,
              min_stock: min_threshold,
              max_stock: max_threshold,
              daily_usage,
              unit_price,
              total_value,
              status,
              status_th,
              active_status: 1,
              date: new Date().toISOString().split('T')[0]
            };
          }).filter(r => r.item_id !== '-' || r.name !== 'Unknown Item');
        } else if (activeTab === 'turnover') {
          resultType = 'turnover';
          const productsMap = new Map();
          const warehousesSet = new Set();
          const monthsSet = new Set();
          const details = [];

          rawJson.forEach(row => {
            const rawDate = extractRowField(row, ['วันที่', 'date', 'Date', 'วันโอน', 'วันที่เคลื่อนไหวล่าสุด', 'วันที่ทำรายการ', 'timestamp']);
            const dateStr = normalizeToISODate(rawDate);
            if (!dateStr || dateStr === 'Unknown') return;

            const itemId = extractRowField(row, ['item_id', 'item_code', 'code', 'product_id', 'รหัสสินค้า', 'รหัสยา', 'รหัสเวชภัณฑ์', 'รหัสรายการ', 'รหัส']);
            const itemName = extractRowField(row, ['สินค้า', 'ชื่อสินค้า', 'ชื่อยา', 'ชื่อเวชภัณฑ์', 'ชื่อสามัญ', 'ชื่อรายการ', 'รายการ', 'name', 'item_name', 'product_name', 'description'], itemId || 'Unknown');
            const dirStr = extractRowField(row, ['ทิศทาง', 'ประเภท', 'direction', 'type'], '');
            const rawQty = extractNumericField(row, ['จำนวน', 'qty', 'ยอด', 'quantity', 'amount'], 0);
            const dir = dirStr.includes('ออก') || dirStr.toLowerCase().includes('out') || rawQty < 0 ? 'ออก' : 'เข้า';
            const srcWh = extractRowField(row, ['คลังต้นทาง', 'คลังจ่าย', 'คลัง', 'src_wh', 'from_wh'], '-');
            const destWh = extractRowField(row, ['คลังปลายทาง', 'คลังรับ', 'dest_wh', 'to_wh'], '-');
            const qty = Math.abs(rawQty);

            if (itemId) productsMap.set(itemId, itemName);
            if (srcWh && srcWh !== '-') warehousesSet.add(srcWh);
            if (destWh && destWh !== '-') warehousesSet.add(destWh);

            const mKey = dateStr.substring(0, 7);
            if (mKey.length === 7) monthsSet.add(mKey);

            details.push([dateStr, itemId, itemName, dir, srcWh, destWh, qty]);
          });

          const sortedMonths = Array.from(monthsSet).sort();
          const sortedWarehouses = Array.from(warehousesSet).sort();
          const productList = Array.from(productsMap.entries()).map(([id, name]) => [id, name]);

          const mIdxMap = new Map(sortedMonths.map((m, i) => [m, i]));
          const whIdxMap = new Map(sortedWarehouses.map((w, i) => [w, i]));
          const prodIdxMap = new Map(productList.map(([id], i) => [id, i]));

          const aggMap = new Map();
          const dowMap = new Map();

          details.forEach(d => {
            const [dateStr, itemId, , dir, srcWh, destWh, qty] = d;
            const mKey = dateStr.substring(0, 7);
            const mIdx = mIdxMap.get(mKey);
            const dirIdx = dir === 'เข้า' ? 0 : 1;
            const srcWhIdx = whIdxMap.get(srcWh) ?? -1;
            const destWhIdx = whIdxMap.get(destWh) ?? -1;
            const prodIdx = prodIdxMap.get(itemId) ?? -1;

            if (mIdx !== undefined && prodIdx !== -1) {
              const aggKey = `${mIdx}_${dirIdx}_${srcWhIdx}_${destWhIdx}_${prodIdx}`;
              if (!aggMap.has(aggKey)) {
                aggMap.set(aggKey, [mIdx, dirIdx, srcWhIdx, destWhIdx, prodIdx, 0, 0]);
              }
              const entry = aggMap.get(aggKey);
              entry[5] += qty;
              entry[6] += 1;
            }

            const dt = new Date(dateStr);
            if (!isNaN(dt.getTime()) && mIdx !== undefined) {
              const dow = dt.getDay();
              const dowKey = `${mIdx}_${dow}_${dirIdx}_${srcWhIdx}_${destWhIdx}`;
              if (!dowMap.has(dowKey)) {
                dowMap.set(dowKey, [mIdx, dow, dirIdx, srcWhIdx, destWhIdx, 0]);
              }
              dowMap.get(dowKey)[5] += qty;
            }
          });

          parsedData = {
            products: productList,
            warehouses: sortedWarehouses,
            months: sortedMonths,
            aggregated: Array.from(aggMap.values()),
            details,
            dowAggregated: Array.from(dowMap.values())
          };
        } else {
          resultType = 'stagnant';
          parsedData = cleanExcelRows(rawJson);
        }

        resolve({
          fileName: file.name,
          sheetName,
          rowCount: Array.isArray(parsedData) 
            ? parsedData.length 
            : (parsedData.transactions?.length || parsedData.details?.length || parsedData.aggregated?.length || 0),
          tabType: resultType,
          data: parsedData
        });

      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => reject(new Error('เกิดข้อผิดพลาดในการอ่านไฟล์'));
    reader.readAsArrayBuffer(file);
  });
}
