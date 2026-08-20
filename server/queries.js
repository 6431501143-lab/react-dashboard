/**
 * SQL Queries for PostgreSQL (Read-Only)
 * 100% Resilient against dirty/impossible calendar dates in DB (e.g. 2026-11-31, 2025-02-30).
 */

export const QUERIES = {
  // =========================================================================
  // 1. หน้าสินค้าค้าง 1 ปี (Stagnant Stock Tab)
  // =========================================================================
  stagnant: `
    WITH latest_per_warehouse AS (
        -- Step 1: ดึงเฉพาะสถานะล่าสุดของแต่ละล็อตในแต่ละคลัง
        SELECT DISTINCT ON (sc.item_id, sc.stock_id, sc.lot_number_id)
               sc.item_id,
               sc.lot_number_id,
               sc.stock_id,
               sc.small_unit_id,
               sc.update_qty_lot::numeric AS cur_quantity,   
               sc.update_date AS last_move_date,             
               sc.cost_purchase::numeric
        FROM stock_card sc
        WHERE sc.lot_number_id IS NOT NULL 
          AND sc.lot_number_id <> ''
          AND SUBSTRING(sc.update_date::text FROM 1 FOR 10) >= '2021-01-01'
        ORDER BY sc.item_id, sc.stock_id, sc.lot_number_id, sc.update_date DESC, sc.update_time DESC, sc.stock_card_id DESC
    ),
    latest_with_overall AS (
        -- Step 2: คำนวณยอดภาพรวมบนข้อมูลที่คัดแยกแล้ว
        SELECT 
            lpw.*,
            SUM(lpw.cur_quantity) OVER (PARTITION BY lpw.item_id, lpw.lot_number_id) AS absolute_last_qty
        FROM latest_per_warehouse lpw
    )
    SELECT     
        lu.item_id AS "รหัสสินค้า",
        i.common_name AS "ชื่อสามัญ",
        s.stock_name AS "คลัง",       
        lu.lot_number_id,
        lu.cur_quantity AS "จำนวน",            
        lu.small_unit_id AS "หน่วย",
        TO_CHAR(TO_DATE(SUBSTRING(lu.last_move_date::text FROM 1 FOR 10), 'YYYY-MM-DD'), 'YYYY-MM-DD') AS "วันที่เคลื่อนไหวล่าสุ",
        TO_CHAR(TO_DATE(SUBSTRING(lu.last_move_date::text FROM 1 FOR 10), 'YYYY-MM-DD'), 'YYYY-MM-DD') AS "วันโอน",
        AGE(CURRENT_DATE, TO_DATE(SUBSTRING(lu.last_move_date::text FROM 1 FOR 10), 'YYYY-MM-DD'))::text AS "ระยะเวลารวม", 
        ROUND(lu.cost_purchase, 1) AS "ราคาต่อหน่วย",
        ROUND((lu.cur_quantity * lu.cost_purchase), 0) AS "มูลค่ารวม"
    FROM latest_with_overall lu
    JOIN item i ON lu.item_id = i.item_id
    JOIN stock s ON lu.stock_id = s.stock_id 
    WHERE lu.cur_quantity > 0                             
      AND lu.absolute_last_qty > 0                                                          
      AND lu.last_move_date !~ '^[0-9]{4}-(04|06|09|11)-31'
      AND lu.last_move_date !~ '^[0-9]{4}-02-(30|31)'
      AND TO_DATE(SUBSTRING(lu.last_move_date::text FROM 1 FOR 10), 'YYYY-MM-DD') < CURRENT_DATE - INTERVAL '1 Year'
      AND lu.lot_number_id IS NOT NULL AND lu.lot_number_id <> ''
    ORDER BY "มูลค่ารวม" DESC;
  `,

  // =========================================================================
  // 2. หน้าสินค้าหมดอายุ (Expired Stock Tab)
  // =========================================================================
  expiry: `
    WITH latest_per_warehouse AS (
        -- Step 1: ดึงสถานะล่าสุดของแต่ละล็อตในแต่ละคลัง
        SELECT DISTINCT ON (sc.item_id, sc.stock_id, sc.lot_number_id)
            sc.stock_id,
            sc.item_id,
            sc.item_trade_name,           
            sc.lot_number_id,
            sc.update_date,
            sc.update_qty_lot::numeric,
            sc.small_unit_id,
            sc.cost_purchase::numeric,
            sc.expire_date,
            sc.stock_card_id
        FROM stock_card sc
        WHERE sc.lot_number_id IS NOT NULL 
          AND sc.lot_number_id <> ''
          AND sc.expire_date IS NOT NULL 
          AND sc.expire_date <> ''
          AND LOWER(sc.expire_date) <> 'null'
          AND SUBSTRING(sc.expire_date FROM 1 FOR 10) >= '2023-01-01'
        ORDER BY sc.item_id, sc.stock_id, sc.lot_number_id, sc.update_date DESC, sc.update_time DESC, sc.stock_card_id DESC
    ),
    latest_with_overall AS (
        -- Step 2: คำนวณยอดภาพรวมบนข้อมูลที่คัดแยกแล้ว
        SELECT 
            lpw.*,
            SUM(lpw.update_qty_lot) OVER (PARTITION BY lpw.item_id, lpw.lot_number_id) AS absolute_last_qty
        FROM latest_per_warehouse lpw
    )
    SELECT  
        s.stock_name AS "คลัง",
        lu.item_id AS "รหัสสินค้า",
        lu.item_trade_name AS "ชื่อสินค้า",
        lu.item_trade_name AS "ชื่อสามัญ",
        lu.lot_number_id,
        TO_CHAR(TO_DATE(lu.expire_date, 'YYYY-MM-DD'), 'YYYY-MM-DD') AS "วันหมดอายุ",
        lu.update_qty_lot AS "จำนวน",
        lu.small_unit_id AS "หน่วย",
        ROUND(lu.cost_purchase, 2) AS "ราคาต่อหน่วย",
        ROUND((lu.update_qty_lot * lu.cost_purchase), 0) AS "มูลค่ารวม",
        -- ทำการสร้างสถานะวันหมดอายุจากฟิลด์ที่แปลงมาแล้ว
        CASE 
            WHEN TO_DATE(lu.expire_date, 'YYYY-MM-DD') < CURRENT_DATE THEN 'หมดอายุแล้ว'
            WHEN TO_DATE(lu.expire_date, 'YYYY-MM-DD') BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '1 Month' THEN 'อีกไม่เกิน 1 เดือนหมด'
            WHEN TO_DATE(lu.expire_date, 'YYYY-MM-DD') BETWEEN CURRENT_DATE + INTERVAL '1 Month' AND CURRENT_DATE + INTERVAL '2 Month' THEN 'อีกไม่เกิน 2 เดือนหมด'
            ELSE 'ปกติ'
        END AS "สถานะ",
        AGE(CURRENT_DATE, TO_DATE(lu.expire_date, 'YYYY-MM-DD'))::text AS "ระยะเวลาหมดอายุ"
    FROM latest_with_overall lu
    JOIN stock s ON lu.stock_id = s.stock_id
    WHERE lu.update_qty_lot > 0  
      AND lu.absolute_last_qty > 0
      AND lu.item_trade_name IS NOT NULL 
      AND lu.item_trade_name <> ''
      AND LOWER(lu.item_trade_name) <> 'null'
      AND lu.expire_date IS NOT NULL 
      AND lu.expire_date <> ''
      AND lu.expire_date !~ '^[0-9]{4}-(04|06|09|11)-31'
      AND lu.expire_date !~ '^[0-9]{4}-02-(30|31)'
      AND TO_DATE(lu.expire_date, 'YYYY-MM-DD') >= '2023-01-01'
      AND TO_DATE(lu.expire_date, 'YYYY-MM-DD') <= CURRENT_DATE + INTERVAL '6 Month'
    ORDER BY "วันหมดอายุ" DESC;
  `,

  // =========================================================================
  // 3. หน้ายอดสินค้าคงคลัง (Inventory Balance Tab)
  // =========================================================================
  inventory: `
    WITH latest_stock_per_warehouse AS (
        SELECT DISTINCT ON (sc.stock_id, sc.item_id)
            sc.stock_id,
            sc.item_id,
            sc.update_date,
            GREATEST(COALESCE(NULLIF(TRIM(sc.update_qty::text), ''), '0')::numeric, 0) AS cur_quantity,
            COALESCE(NULLIF(TRIM(sc.min_qty::text), ''), '0')::numeric AS min_qty,
            COALESCE(NULLIF(TRIM(sc.max_qty::text), ''), '0')::numeric AS max_qty
        FROM stock_card sc
        WHERE sc.update_date IS NOT NULL 
          AND SUBSTRING(sc.update_date::text FROM 1 FOR 10) >= '2024-01-01'
        ORDER BY sc.stock_id, sc.item_id, sc.update_date DESC, sc.update_time DESC
    ),
    item_usage AS ( 
        SELECT 
            sc.stock_id,
            sc.item_id,                    
            SUM(ABS(COALESCE(NULLIF(TRIM(sc.qty::text), ''), '0')::numeric)) AS total_used_qty,
            GREATEST(CURRENT_DATE - TO_DATE(SUBSTRING(MIN(sc.update_date::text) FROM 1 FOR 7) || '-01', 'YYYY-MM-DD'), 1) AS actual_days_in_system,
            ROUND(SUM(ABS(COALESCE(NULLIF(TRIM(sc.qty::text), ''), '0')::numeric)) / GREATEST(CURRENT_DATE - TO_DATE(SUBSTRING(MIN(sc.update_date::text) FROM 1 FOR 7) || '-01', 'YYYY-MM-DD'), 1), 2) AS avg_daily_usage
        FROM stock_card sc
        WHERE SUBSTRING(sc.update_date::text FROM 1 FOR 10) >= '2025-01-01'
          AND sc.fix_stock_method_id LIKE '-%'
          AND COALESCE(NULLIF(TRIM(sc.qty::text), ''), '0')::numeric < 0
        GROUP BY sc.stock_id, sc.item_id  
    )
    SELECT 
        ls.stock_id AS "stock_id",
        COALESCE(s.stock_name, 'คลังหลัก') AS "warehouse",
        SUBSTRING(ls.update_date::text FROM 1 FOR 10) AS "last_update",
        ls.item_id AS "item_id",
        COALESCE(NULLIF(TRIM(i.common_name), ''), ls.item_id) AS "name",
        i.fix_item_type_id AS "item_type",
        i.active AS "active_status",
        ls.cur_quantity AS "balance",
        COALESCE(iu.avg_daily_usage, 0) AS "avg_daily_usage",
        CASE 
            WHEN COALESCE(iu.avg_daily_usage, 0) > 0 
            THEN ROUND(ls.cur_quantity / iu.avg_daily_usage, 1)
            ELSE NULL 
        END AS "days_remaining",
        ls.min_qty AS "min_qty", 
        ls.max_qty AS "max_qty", 
        CASE 
            WHEN ls.cur_quantity = 0 THEN 'สินค้าหมดคลัง'
            WHEN ls.min_qty > 0 AND ls.cur_quantity < ls.min_qty THEN 'ต่ำกว่าเกณฑ์'
            WHEN ls.max_qty > 0 AND ls.cur_quantity > ls.max_qty THEN 'เกินเกณฑ์สูงสุด'
            ELSE 'ปริมาณปกติ'
        END AS "status"
    FROM latest_stock_per_warehouse ls
    LEFT JOIN item i ON ls.item_id = i.item_id
    LEFT JOIN stock s ON ls.stock_id = s.stock_id 
    LEFT JOIN item_usage iu ON ls.stock_id = iu.stock_id AND ls.item_id = iu.item_id 
    ORDER BY ls.cur_quantity DESC;
  `,

  // =========================================================================
  // 4. หน้าประวัติการจ่ายสินค้า (Outbound Dispatch Tab)
  // =========================================================================
  dispatch: `
    WITH raw_dispatch AS (
        SELECT 
            sc.item_id,
            sc.stock_id,
            sc.in_id,
            SUBSTRING(sc.update_date::text FROM 1 FOR 10) AS date_str,
            SUM(ABS(sc.qty::numeric)) AS total_qty
        FROM stock_card sc
        WHERE sc.fix_stock_method_id IN ('-10', '-11')
          AND SUBSTRING(sc.update_date::text FROM 1 FOR 10) >= '2021-01-01'
          AND sc.qty::numeric < 0
        GROUP BY sc.item_id, sc.stock_id, sc.in_id, SUBSTRING(sc.update_date::text FROM 1 FOR 10)
    )
    SELECT 
        rd.item_id,
        COALESCE(NULLIF(TRIM(i.common_name), ''), rd.item_id) AS "สินค้า",
        rd.total_qty AS "จำนวน", 
        COALESCE(s_in.stock_name, s.stock_name, 'ไม่ระบุคลัง') AS "คลังปลายทาง",
        COALESCE(dept.description, bd_in.description, bd.description, 'ไม่ระบุแผนก') AS "แผนก",   
        rd.date_str AS "วันที่"
    FROM raw_dispatch rd
    LEFT JOIN item i ON rd.item_id = i.item_id
    LEFT JOIN stock s ON rd.stock_id = s.stock_id
    LEFT JOIN stock s_in ON rd.in_id = s_in.stock_id
    LEFT JOIN base_department bd ON s.base_department_id = bd.base_department_id
    LEFT JOIN base_department bd_in ON s_in.base_department_id = bd_in.base_department_id
    LEFT JOIN base_department dept ON rd.in_id::text = dept.base_department_id::text
    ORDER BY "วันที่" DESC, "จำนวน" DESC;
  `,

  // =========================================================================
  // 5. หน้าอัตราหมุนเวียนเวชภัณฑ์ (Turnover & Movement Aggregation in PostgreSQL)
  // =========================================================================
  turnoverMonthlyAgg: `
    WITH raw_in AS (
        SELECT 
            SUBSTRING(sc.update_date::text FROM 1 FOR 7) AS month_str,
            'เข้า' AS direction,
            sc.out_id,
            sc.in_id,
            sc.item_id,
            SUM(ABS(sc.qty::numeric)) AS total_qty,
            COUNT(*) AS tx_count
        FROM stock_card sc
        WHERE sc.qty LIKE '+%' 
          AND sc.qty::numeric > 0
          AND SUBSTRING(sc.update_date::text FROM 1 FOR 10) >= '2021-01-01'
        GROUP BY 1, 2, 3, 4, 5
    ),
    raw_out AS (
        SELECT 
            SUBSTRING(sc.update_date::text FROM 1 FOR 7) AS month_str,
            'ออก' AS direction,
            sc.out_id,
            sc.in_id,
            sc.item_id,
            SUM(ABS(sc.qty::numeric)) AS total_qty,
            COUNT(*) AS tx_count
        FROM stock_card sc
        WHERE sc.fix_stock_method_id LIKE '-%'
          AND sc.qty::numeric < 0
          AND SUBSTRING(sc.update_date::text FROM 1 FOR 10) >= '2021-01-01'
        GROUP BY 1, 2, 3, 4, 5
    ),
    unioned AS (
        SELECT * FROM raw_in
        UNION ALL
        SELECT * FROM raw_out
    )
    SELECT 
        u.month_str,
        u.direction,
        CASE
            WHEN u.direction = 'เข้า' THEN
                CASE
                    WHEN LENGTH(u.out_id::text) > 6 THEN 'ผู้แทนจำหน่าย (Supplier)'
                    WHEN u.out_id = '' OR u.out_id IS NULL THEN 'ไม่ระบุ'
                    WHEN s_out.stock_name IS NOT NULL THEN s_out.stock_name
                    ELSE 'หน่วยงาน/แผนกภายในโรงพยาบาล'
                END
            ELSE COALESCE(s_out.stock_name, '-')
        END AS src_wh,
        CASE
            WHEN u.direction = 'เข้า' THEN COALESCE(s_in.stock_name, 'ไม่ระบุคลังปลายทาง')
            ELSE
                CASE
                    WHEN LENGTH(u.in_id::text) > 10 THEN 'ผู้ป่วยรับสินค้า'
                    WHEN u.in_id = '' OR u.in_id IS NULL THEN 'ไม่ระบุคลังปลายทาง'
                    WHEN s_in.stock_name IS NOT NULL THEN s_in.stock_name
                    ELSE COALESCE(dept.description, 'หน่วยงานภายในโรงพยาบาล')
                END
        END AS dest_wh,
        u.item_id,
        COALESCE(NULLIF(TRIM(i.common_name), ''), u.item_id) AS item_name,
        SUM(u.total_qty) AS total_qty,
        SUM(u.tx_count) AS tx_count
    FROM unioned u
    LEFT JOIN item i ON u.item_id = i.item_id
    LEFT JOIN stock s_in ON u.in_id = s_in.stock_id
    LEFT JOIN stock s_out ON u.out_id = s_out.stock_id
    LEFT JOIN base_department dept ON u.in_id::text = dept.base_department_id::text
    GROUP BY 1, 2, 3, 4, 5, 6
    ORDER BY u.month_str DESC, total_qty DESC;
  `,

  turnoverDowAgg: `
    WITH raw_in AS (
        SELECT 
            SUBSTRING(sc.update_date::text FROM 1 FOR 7) AS month_str,
            EXTRACT(DOW FROM TO_DATE(SUBSTRING(sc.update_date::text FROM 1 FOR 10), 'YYYY-MM-DD'))::integer AS dow,
            'เข้า' AS direction,
            sc.out_id,
            sc.in_id,
            SUM(ABS(sc.qty::numeric)) AS total_qty
        FROM stock_card sc
        WHERE sc.qty LIKE '+%' 
          AND sc.qty::numeric > 0
          AND SUBSTRING(sc.update_date::text FROM 1 FOR 10) >= '2021-01-01'
          AND sc.update_date !~ '^[0-9]{4}-(04|06|09|11)-31'
          AND sc.update_date !~ '^[0-9]{4}-02-(30|31)'
        GROUP BY 1, 2, 3, 4, 5
    ),
    raw_out AS (
        SELECT 
            SUBSTRING(sc.update_date::text FROM 1 FOR 7) AS month_str,
            EXTRACT(DOW FROM TO_DATE(SUBSTRING(sc.update_date::text FROM 1 FOR 10), 'YYYY-MM-DD'))::integer AS dow,
            'ออก' AS direction,
            sc.out_id,
            sc.in_id,
            SUM(ABS(sc.qty::numeric)) AS total_qty
        FROM stock_card sc
        WHERE sc.fix_stock_method_id LIKE '-%'
          AND sc.qty::numeric < 0
          AND SUBSTRING(sc.update_date::text FROM 1 FOR 10) >= '2021-01-01'
          AND sc.update_date !~ '^[0-9]{4}-(04|06|09|11)-31'
          AND sc.update_date !~ '^[0-9]{4}-02-(30|31)'
        GROUP BY 1, 2, 3, 4, 5
    ),
    unioned AS (
        SELECT * FROM raw_in
        UNION ALL
        SELECT * FROM raw_out
    )
    SELECT 
        u.month_str,
        u.dow,
        u.direction,
        CASE
            WHEN u.direction = 'เข้า' THEN
                CASE
                    WHEN LENGTH(u.out_id::text) > 6 THEN 'ผู้แทนจำหน่าย (Supplier)'
                    WHEN u.out_id = '' OR u.out_id IS NULL THEN 'ไม่ระบุ'
                    WHEN s_out.stock_name IS NOT NULL THEN s_out.stock_name
                    ELSE 'หน่วยงาน/แผนกภายในโรงพยาบาล'
                END
            ELSE COALESCE(s_out.stock_name, '-')
        END AS src_wh,
        CASE
            WHEN u.direction = 'เข้า' THEN COALESCE(s_in.stock_name, 'ไม่ระบุคลังปลายทาง')
            ELSE
                CASE
                    WHEN LENGTH(u.in_id::text) > 10 THEN 'ผู้ป่วยรับสินค้า'
                    WHEN u.in_id = '' OR u.in_id IS NULL THEN 'ไม่ระบุคลังปลายทาง'
                    WHEN s_in.stock_name IS NOT NULL THEN s_in.stock_name
                    ELSE COALESCE(dept.description, 'หน่วยงานภายในโรงพยาบาล')
                END
        END AS dest_wh,
        SUM(u.total_qty) AS total_qty
    FROM unioned u
    LEFT JOIN stock s_in ON u.in_id = s_in.stock_id
    LEFT JOIN stock s_out ON u.out_id = s_out.stock_id
    LEFT JOIN base_department dept ON u.in_id::text = dept.base_department_id::text
    GROUP BY 1, 2, 3, 4, 5;
  `,

  turnoverRecentDetails: `
    WITH raw_in AS (
        SELECT
            SUBSTRING(sc.update_date::text FROM 1 FOR 10) AS date_str,
            sc.item_id,
            sc.out_id,
            sc.in_id,
            'เข้า' AS direction,
            ABS(sc.qty::numeric) AS qty
        FROM stock_card sc
        WHERE sc.qty LIKE '+%'
          AND sc.qty::numeric > 0
          AND SUBSTRING(sc.update_date::text FROM 1 FOR 10) >= '2021-01-01'
        ORDER BY ABS(sc.qty::numeric) DESC
        LIMIT 15000
    ),
    raw_out AS (
        SELECT
            SUBSTRING(sc.update_date::text FROM 1 FOR 10) AS date_str,
            sc.item_id,
            sc.out_id,
            sc.in_id,
            'ออก' AS direction,
            ABS(sc.qty::numeric) AS qty
        FROM stock_card sc
        WHERE sc.fix_stock_method_id LIKE '-%'
          AND sc.qty::numeric < 0
          AND SUBSTRING(sc.update_date::text FROM 1 FOR 10) >= '2021-01-01'
        ORDER BY ABS(sc.qty::numeric) DESC
        LIMIT 15000
    ),
    unioned AS (
        SELECT * FROM raw_in
        UNION ALL
        SELECT * FROM raw_out
    )
    SELECT
        f.date_str,
        f.item_id,
        COALESCE(NULLIF(TRIM(i.common_name), ''), f.item_id) AS name,
        f.direction,
        CASE
            WHEN f.direction = 'เข้า' THEN
                CASE
                    WHEN LENGTH(f.out_id::text) > 6 THEN 'ผู้แทนจำหน่าย (Supplier)'
                    WHEN f.out_id = '' OR f.out_id IS NULL THEN 'ไม่ระบุ'
                    WHEN s_out.stock_name IS NOT NULL THEN s_out.stock_name
                    ELSE 'หน่วยงาน/แผนกภายในโรงพยาบาล'
                END
            ELSE COALESCE(s_out.stock_name, '-')
        END AS src_wh,
        CASE
            WHEN f.direction = 'เข้า' THEN COALESCE(s_in.stock_name, 'ไม่ระบุคลังปลายทาง')
            ELSE
                CASE
                    WHEN LENGTH(f.in_id::text) > 10 THEN 'ผู้ป่วยรับสินค้า'
                    WHEN f.in_id = '' OR f.in_id IS NULL THEN 'ไม่ระบุคลังปลายทาง'
                    WHEN s_in.stock_name IS NOT NULL THEN s_in.stock_name
                    ELSE COALESCE(dept.description, 'หน่วยงานภายในโรงพยาบาล')
                END
        END AS dest_wh,
        f.qty
    FROM unioned f
    LEFT JOIN item i ON f.item_id = i.item_id
    LEFT JOIN stock s_in ON f.in_id = s_in.stock_id
    LEFT JOIN stock s_out ON f.out_id = s_out.stock_id
    LEFT JOIN base_department dept ON f.in_id::text = dept.base_department_id::text
    ORDER BY f.qty DESC, f.date_str DESC;
  `
};
