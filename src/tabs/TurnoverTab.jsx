import React, { useState, useMemo, useEffect } from 'react';
import Chart from 'react-apexcharts';
import KpiCard from '../components/KpiCard';
import ResponsiveTable from '../components/ResponsiveTable';
import DrilldownModal from '../components/DrilldownModal';
import { 
  ArrowUpRight, 
  Search, 
  ArrowRightLeft, 
  Package, 
  Home, 
  Layers, 
  ArrowUpDown, 
  ArrowDownLeft, 
  TrendingUp, 
  BarChart2, 
  Calendar, 
  LogIn, 
  LogOut 
} from 'lucide-react';
import { formatDateToDDMMYY } from '../utils/helpers';

export default function TurnoverTab({ 
  turnoverData = {}, // { products, warehouses, months, aggregated, details, dowAggregated }
  selectedWarehouses = [],
  selectedProducts = [],
  startDate: _ignoredStartDate,
  endDate: _ignoredEndDate
}) {
  const startDate = null;
  const endDate = null;
  const [searchTerm, setSearchTerm] = useState('');
  const [directionFilter, setDirectionFilter] = useState('All'); // 'All', 'In', 'Out'
  
  // Dynamic Animation Series States
  const [monthlyAnimatedSeries, setMonthlyAnimatedSeries] = useState([]);
  const [yearlyAnimatedSeries, setYearlyAnimatedSeries] = useState([]);
  const [dowAnimatedSeries, setDowAnimatedSeries] = useState([]);
  const [topProductsAnimatedSeries, setTopProductsAnimatedSeries] = useState([]);
  const [inboundDestAnimatedSeries, setInboundDestAnimatedSeries] = useState([]);
  const [outboundSrcAnimatedSeries, setOutboundSrcAnimatedSeries] = useState([]);

  // Drilldown modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [drilldownType, setDrilldownType] = useState(null);
  const [drilldownKey, setDrilldownKey] = useState(null);
  const [drilldownTitle, setDrilldownTitle] = useState('');
  const [drilldownHistory, setDrilldownHistory] = useState([]);

  // Modal filters
  const [modalQtyTab, setModalQtyTab] = useState('All'); // 'All', 'In', 'Out'
  const [modalNetTab, setModalNetTab] = useState('All'); // 'All', 'Positive', 'Negative'
  const [modalYearlyDay, setModalYearlyDay] = useState('All'); // 'All', '0'...'6'
  const [modalYearlyMonth, setModalYearlyMonth] = useState('All'); // 'All', '01'...'12'
  const [modalYearFilter, setModalYearFilter] = useState('All');

  // Main table dropdown filters (2024-2026)
  const [tableDayFilter, setTableDayFilter] = useState('All');
  const [tableMonthFilter, setTableMonthFilter] = useState('All');
  const [tableYearFilter, setTableYearFilter] = useState('All');

  const { 
    products = [], 
    warehouses = [], 
    months = [], 
    aggregated = [], 
    details: rawDetails = [],
    dowAggregated = []
  } = turnoverData;

  const formatMonthYearThai = (mStr) => {
    if (!mStr || !mStr.includes('-')) return mStr;
    const [yearStr, monthStr] = mStr.split('-');
    const shortYear = yearStr.substring(2); // "20", "24" etc.
    const monthIdx = parseInt(monthStr, 10) - 1;
    const thaiMonths = ["ม.ค", "ก.พ", "มี.ค", "เม.ย", "พ.ค", "มิ.ย", "ก.ค", "ส.ค", "ก.ย", "ต.ค", "พ.ย", "ธ.ค"];
    return `${thaiMonths[monthIdx]} ${shortYear}`;
  };

  const formatMonthYearThaiLong = (mStr) => {
    if (!mStr) return 'ทั้งหมด';
    if (!mStr.includes('-')) return mStr;
    const [yearStr, monthStr] = mStr.split('-');
    const christianYear = parseInt(yearStr, 10);
    const monthIdx = parseInt(monthStr, 10) - 1;
    const thaiMonthsLong = [
      "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
      "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
    ];
    return `${thaiMonthsLong[monthIdx]} ${christianYear}`;
  };

  const getLocalYYYYMM = (date) => {
    if (!date) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  };

  // Convert Date to YYYY-MM-DD
  const getLocalYYYYMMDD = (date) => {
    if (!date) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const formatIntegerMk = (val) => {
    if (val === undefined || val === null) return '';
    const num = Number(val);
    if (isNaN(num)) return '';
    if (num >= 1000000) {
      const formatted = (num / 1000000).toFixed(1);
      return (formatted.endsWith('.0') ? formatted.slice(0, -2) : formatted) + 'M';
    }
    if (num >= 1000) {
      const formatted = (num / 1000).toFixed(1);
      return (formatted.endsWith('.0') ? formatted.slice(0, -2) : formatted) + 'k';
    }
    const formatted = num.toFixed(1);
    return formatted.endsWith('.0') ? formatted.slice(0, -2) : formatted;
  };

  // Dynamic Available Years from rawDetails and months
  const availableYears = useMemo(() => {
    const ySet = new Set();
    rawDetails.forEach(row => {
      const dateStr = String(row[0] || '');
      if (dateStr && dateStr.length >= 4) {
        const y = dateStr.substring(0, 4);
        if (!isNaN(Number(y)) && Number(y) > 2000) ySet.add(y);
      }
    });
    months.forEach(m => {
      if (m && m.length >= 4) {
        const y = m.substring(0, 4);
        if (!isNaN(Number(y)) && Number(y) > 2000) ySet.add(y);
      }
    });
    const arr = Array.from(ySet).sort();
    return arr.length > 0 ? arr : ['2024', '2025', '2026'];
  }, [rawDetails, months]);

  const tableTitle = useMemo(() => {
    const yearText = availableYears.length === 1 ? `ปี ${availableYears[0]}` : `ปี ${availableYears[0]} - ${availableYears[availableYears.length - 1]}`;
    return `รายการความเคลื่อนไหวสินค้าเรียงลำดับจำนวนมากที่สุด (${yearText})`;
  }, [availableYears]);

  // 1. Filter raw details for the transaction table and details charts using the compact format
  const startStr = useMemo(() => getLocalYYYYMMDD(startDate), [startDate]);
  const endStr = useMemo(() => getLocalYYYYMMDD(endDate), [endDate]);

  const searchedTableRows = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    
    const filteredRows = rawDetails.filter(row => {
      if (!row || row.length === 0) return false;
      const isCompact = typeof row[1] === 'number';
      const dateStr = String(row[0] || '');

      // Apply table Day of Month dropdown filter (1-31)
      if (tableDayFilter !== 'All' && dateStr.includes('-')) {
        const dayVal = parseInt(dateStr.split('-')[2], 10).toString();
        if (dayVal !== tableDayFilter) return false;
      }

      // Apply table Month of Year dropdown filter (01-12)
      if (tableMonthFilter !== 'All' && dateStr.length >= 7) {
        const monthVal = dateStr.substring(5, 7);
        if (monthVal !== tableMonthFilter) return false;
      }

      // Apply table Year dropdown filter (2024-2026)
      if (tableYearFilter !== 'All' && dateStr.length >= 4) {
        const yearVal = dateStr.substring(0, 4);
        if (yearVal !== tableYearFilter) return false;
      }

      if (startStr && dateStr < startStr) return false;
      if (endStr && dateStr > endStr) return false;

      const dirStr = isCompact ? (row[2] === 0 ? 'เข้า' : 'ออก') : String(row[3] || '');
      if (directionFilter === 'In' && dirStr !== 'เข้า') return false;
      if (directionFilter === 'Out' && dirStr !== 'ออก') return false;

      const prodInfo = isCompact ? products[row[1]] : null;
      const prodCode = isCompact ? (prodInfo ? prodInfo[0] : '') : String(row[1] || '');
      const prodName = isCompact ? (prodInfo ? prodInfo[1] : '') : String(row[2] || '');
      if (selectedProducts.length > 0 && prodCode && !selectedProducts.includes(prodCode)) return false;

      const srcWh = isCompact ? (warehouses[row[3]] || '') : String(row[4] || '');
      const destWh = isCompact ? (warehouses[row[4]] || '') : String(row[5] || '');
      const relevantWh = dirStr === 'เข้า' ? destWh : srcWh;
      if (selectedWarehouses.length > 0 && relevantWh && !selectedWarehouses.includes(relevantWh)) return false;

      if (term) {
        const code = prodCode.toLowerCase();
        const name = prodName.toLowerCase();
        const sWh = srcWh.toLowerCase();
        const dWh = destWh.toLowerCase();
        if (
          !code.includes(term) &&
          !name.includes(term) &&
          !sWh.includes(term) &&
          !dWh.includes(term)
        ) {
          return false;
        }
      }

      return true;
    });

    const limitedRows = filteredRows.slice(0, 1500000);

    const mapped = limitedRows.map(row => {
      const isCompact = typeof row[1] === 'number';
      const prodInfo = isCompact ? products[row[1]] : null;
      return [
        row[0], // date_str
        isCompact ? (prodInfo ? prodInfo[0] : '') : row[1], // item_id
        isCompact ? (prodInfo ? prodInfo[1] : '') : row[2], // name
        isCompact ? (row[2] === 0 ? 'เข้า' : 'ออก') : row[3], // direction
        isCompact ? (warehouses[row[3]] || '') : row[4], // src_wh
        isCompact ? (warehouses[row[4]] || '') : row[5], // dest_wh
        isCompact ? (row[5] || 0) : (row[6] || 0) // qty
      ];
    });

    // เรียงลำดับจากจำนวนมากไปน้อย (Quantity Descending) ไม่สนวัน
    return mapped.sort((a, b) => (Number(b[6]) || 0) - (Number(a[6]) || 0));
  }, [rawDetails, products, warehouses, startStr, endStr, directionFilter, searchTerm, selectedProducts, selectedWarehouses, tableDayFilter, tableMonthFilter, tableYearFilter]);

  // 1. Convert Date to YYYY-MM
  const startMonth = useMemo(() => getLocalYYYYMM(startDate), [startDate]);
  const endMonth = useMemo(() => getLocalYYYYMM(endDate), [endDate]);

  // 2. Compute Turnover stats (KPIs) from full aggregated data
  const stats = useMemo(() => {
    let movements = 0;
    let inboundCount = 0;
    let outboundCount = 0;
    const uniqueProds = new Set();
    const uniqueWhs = new Set();
    let qtyTotal = 0;
    let qtyIn = 0;
    let qtyOut = 0;

    aggregated.forEach(row => {
      // row: [month_idx, dir_idx, src_wh_idx, dest_wh_idx, prod_idx, qty, count]
      const monthStr = months[row[0]];
      if (!monthStr) return;
      if (startMonth && monthStr < startMonth) return;
      if (endMonth && monthStr > endMonth) return;

      const prodInfo = products[row[4]];
      if (!prodInfo) return;
      const prodCode = prodInfo[0];
      if (selectedProducts.length > 0 && !selectedProducts.includes(prodCode)) return;

      const dirIdx = row[1];
      const srcWh = warehouses[row[2]];
      const destWh = warehouses[row[3]];
      const relevantWh = dirIdx === 0 ? destWh : srcWh;

      if (selectedWarehouses.length > 0 && relevantWh && !selectedWarehouses.includes(relevantWh)) return;

      const qty = row[5] || 0;
      const count = row[6] || 0;

      movements += count;
      uniqueProds.add(prodCode);
      if (relevantWh && relevantWh !== '-') {
        uniqueWhs.add(relevantWh);
      }

      if (dirIdx === 0) {
        qtyIn += qty;
        inboundCount += count;
      } else {
        qtyOut += qty;
        outboundCount += count;
      }
      qtyTotal += qty;
    });

    const netChange = qtyIn - qtyOut;

    return {
      movements,
      inboundCount,
      outboundCount,
      uniqueProds: uniqueProds.size,
      uniqueWhs: uniqueWhs.size,
      qtyTotal,
      qtyIn,
      qtyOut,
      netChange
    };
  }, [aggregated, months, products, warehouses, startMonth, endMonth, selectedProducts, selectedWarehouses]);

  // 3. Monthly Trends Chart data
  const monthlyChartData = useMemo(() => {
    const activeMonths = [];
    const mIdxMap = {};

    months.forEach((mStr, idx) => {
      if (startMonth && mStr < startMonth) return;
      if (endMonth && mStr > endMonth) return;
      mIdxMap[idx] = activeMonths.length;
      activeMonths.push(mStr);
    });

    const monthlyIn = new Array(activeMonths.length).fill(0);
    const monthlyOut = new Array(activeMonths.length).fill(0);

    // Aggregate monthly data from turnoverAggregated (aggregated)
    aggregated.forEach(row => {
      // row: [month_idx, dir_idx, src_wh_idx, dest_wh_idx, prod_idx, qty, count]
      const mIdx = row[0];
      const dirIdx = row[1];
      const qty = row[5];
      const srcWh = warehouses[row[2]];
      const destWh = warehouses[row[3]];
      const relevantWh = dirIdx === 0 ? destWh : srcWh;

      // Warehouse Filter
      if (selectedWarehouses.length > 0 && relevantWh && !selectedWarehouses.includes(relevantWh)) return;

      // Product Filter
      const prodInfo = products[row[4]];
      if (!prodInfo) return;
      const prodCode = prodInfo[0];
      if (selectedProducts.length > 0 && !selectedProducts.includes(prodCode)) return;

      if (mIdxMap.hasOwnProperty(mIdx)) {
        const newMIdx = mIdxMap[mIdx];
        if (dirIdx === 0) monthlyIn[newMIdx] += qty;
        else monthlyOut[newMIdx] += qty;
      }
    });

    return {
      months: activeMonths,
      inSeries: monthlyIn,
      outSeries: monthlyOut
    };
  }, [aggregated, months, warehouses, products, startMonth, endMonth, selectedWarehouses, selectedProducts]);

  // 4. Yearly YoY Chart data
  const yearlyChartData = useMemo(() => {
    const yearlyMap = {};

    aggregated.forEach(row => {
      // row: [month_idx, dir_idx, src_wh_idx, dest_wh_idx, prod_idx, qty, count]
      const monthStr = months[row[0]];
      if (!monthStr) return;
      if (startMonth && monthStr < startMonth) return;
      if (endMonth && monthStr > endMonth) return;

      const prodInfo = products[row[4]];
      if (!prodInfo) return;
      const prodCode = prodInfo[0];
      if (selectedProducts.length > 0 && !selectedProducts.includes(prodCode)) return;

      const dirIdx = row[1];
      const srcWh = warehouses[row[2]];
      const destWh = warehouses[row[3]];
      const relevantWh = dirIdx === 0 ? destWh : srcWh;

      if (selectedWarehouses.length > 0 && relevantWh && !selectedWarehouses.includes(relevantWh)) return;

      const year = monthStr.split('-')[0];
      const qty = row[5] || 0;

      if (!yearlyMap[year]) {
        yearlyMap[year] = { in: 0, out: 0 };
      }
      if (dirIdx === 0) yearlyMap[year].in += qty;
      else yearlyMap[year].out += qty;
    });

    const sortedYears = Object.keys(yearlyMap).sort();
    return {
      years: sortedYears,
      inSeries: sortedYears.map(y => yearlyMap[y].in),
      outSeries: sortedYears.map(y => yearlyMap[y].out)
    };
  }, [aggregated, months, products, warehouses, startMonth, endMonth, selectedProducts, selectedWarehouses]);

  // 5. Day of Week Chart data
  const dowChartData = useMemo(() => {
    const dows = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
    const inSeries = new Array(7).fill(0);
    const outSeries = new Array(7).fill(0);

    dowAggregated.forEach(row => {
      // row: [month_idx, day_of_week, dir_idx, src_wh_idx, dest_wh_idx, qty]
      const monthStr = months[row[0]];
      if (!monthStr) return;
      if (startMonth && monthStr < startMonth) return;
      if (endMonth && monthStr > endMonth) return;

      const dirIdx = row[2];
      const srcWh = warehouses[row[3]];
      const destWh = warehouses[row[4]];
      const relevantWh = dirIdx === 0 ? destWh : srcWh;

      if (selectedWarehouses.length > 0 && relevantWh && !selectedWarehouses.includes(relevantWh)) return;

      const jsDow = row[1];

      const qty = row[5] || 0;
      if (dirIdx === 0) {
        inSeries[jsDow] += qty;
      } else {
        outSeries[jsDow] += qty;
      }
    });

    return {
      categories: dows,
      inSeries,
      outSeries
    };
  }, [dowAggregated, months, warehouses, startMonth, endMonth, selectedWarehouses]);

  // 6. Top 10 product usage chart data
  const topProductsChartData = useMemo(() => {
    const productMap = {};

    aggregated.forEach(row => {
      // row: [month_idx, dir_idx, src_wh_idx, dest_wh_idx, prod_idx, qty, count]
      const monthStr = months[row[0]];
      if (!monthStr) return;
      if (startMonth && monthStr < startMonth) return;
      if (endMonth && monthStr > endMonth) return;

      const prodInfo = products[row[4]];
      if (!prodInfo) return;
      const prodCode = prodInfo[0];
      if (selectedProducts.length > 0 && !selectedProducts.includes(prodCode)) return;

      const dirIdx = row[1];
      const srcWh = warehouses[row[2]];
      const destWh = warehouses[row[3]];
      const relevantWh = dirIdx === 0 ? destWh : srcWh;

      if (selectedWarehouses.length > 0 && relevantWh && !selectedWarehouses.includes(relevantWh)) return;

      const prodName = prodInfo[1];
      const qty = row[5] || 0;

      if (!productMap[prodName]) productMap[prodName] = 0;
      productMap[prodName] += qty;
    });

    const sorted = Object.keys(productMap)
      .map(name => ({ name, value: productMap[name] }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    return {
      categories: sorted.map(p => (p.name && p.name.length > 28 ? p.name.substring(0, 28) + '...' : p.name)),
      fullCategories: sorted.map(p => p.name),
      values: sorted.map(p => p.value)
    };
  }, [aggregated, months, products, warehouses, startMonth, endMonth, selectedProducts, selectedWarehouses]);

  // 7. Warehouse transfers: Inbound Dest, Inbound Src, Outbound Src, Outbound Dest
  const transfersChartData = useMemo(() => {
    const inboundDestMap = {};
    const inboundSrcMap = {};
    const outboundSrcMap = {};
    const outboundDestMap = {};

    aggregated.forEach(row => {
      // row: [month_idx, dir_idx, src_wh_idx, dest_wh_idx, prod_idx, qty, count]
      const monthStr = months[row[0]];
      if (!monthStr) return;
      if (startMonth && monthStr < startMonth) return;
      if (endMonth && monthStr > endMonth) return;

      const prodInfo = products[row[4]];
      if (!prodInfo) return;
      const prodCode = prodInfo[0];
      if (selectedProducts.length > 0 && !selectedProducts.includes(prodCode)) return;

      const dirIdx = row[1];
      const srcWh = warehouses[row[2]];
      const destWh = warehouses[row[3]];
      const relevantWh = dirIdx === 0 ? destWh : srcWh;

      if (selectedWarehouses.length > 0 && relevantWh && !selectedWarehouses.includes(relevantWh)) return;

      const qty = row[5] || 0;

      if (dirIdx === 0) {
        if (destWh && destWh !== '-') {
          inboundDestMap[destWh] = (inboundDestMap[destWh] || 0) + qty;
        }
        if (srcWh && srcWh !== '-') {
          inboundSrcMap[srcWh] = (inboundSrcMap[srcWh] || 0) + qty;
        }
      } else if (dirIdx === 1) {
        if (srcWh && srcWh !== '-') {
          outboundSrcMap[srcWh] = (outboundSrcMap[srcWh] || 0) + qty;
        }
        if (destWh && destWh !== '-') {
          outboundDestMap[destWh] = (outboundDestMap[destWh] || 0) + qty;
        }
      }
    });

    const getTop10 = (map) => {
      return Object.keys(map)
        .map(name => ({ name, value: Math.round(map[name]) }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);
    };

    return {
      inboundDest: getTop10(inboundDestMap),
      inboundSrc: getTop10(inboundSrcMap),
      outboundSrc: getTop10(outboundSrcMap),
      outboundDest: getTop10(outboundDestMap)
    };
  }, [aggregated, months, products, warehouses, startMonth, endMonth, selectedProducts, selectedWarehouses]);

  // Trigger dynamic entrance animation for Monthly Line Chart
  useEffect(() => {
    setMonthlyAnimatedSeries([]);
    const timer = setTimeout(() => {
      if (monthlyChartData.months && monthlyChartData.months.length > 0) {
        setMonthlyAnimatedSeries([
          { name: 'Qty In (เข้า)', data: monthlyChartData.inSeries },
          { name: 'Qty Out (ออก)', data: monthlyChartData.outSeries }
        ]);
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [monthlyChartData]);

  // Trigger dynamic entrance animation for Yearly Bar Chart
  useEffect(() => {
    setYearlyAnimatedSeries([]);
    const timer = setTimeout(() => {
      if (yearlyChartData.years && yearlyChartData.years.length > 0) {
        setYearlyAnimatedSeries([
          { name: 'Qty In (เข้า)', data: yearlyChartData.inSeries },
          { name: 'Qty Out (ออก)', data: yearlyChartData.outSeries }
        ]);
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [yearlyChartData]);

  // Trigger dynamic entrance animation for Day-of-Week Bar Chart
  useEffect(() => {
    setDowAnimatedSeries([]);
    const timer = setTimeout(() => {
      if (dowChartData.categories && dowChartData.categories.length > 0) {
        setDowAnimatedSeries([
          { name: 'Qty In (เข้า)', data: dowChartData.inSeries },
          { name: 'Qty Out (ออก)', data: dowChartData.outSeries }
        ]);
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [dowChartData]);

  // Trigger dynamic entrance animation for Top Products Bar Chart
  useEffect(() => {
    setTopProductsAnimatedSeries([]);
    const timer = setTimeout(() => {
      if (topProductsChartData.values && topProductsChartData.values.length > 0) {
        setTopProductsAnimatedSeries([{
          name: 'ยอดโอนย้ายสะสม',
          data: topProductsChartData.values
        }]);
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [topProductsChartData]);

  // Trigger dynamic entrance animation for Inbound & Outbound Warehouse Charts
  useEffect(() => {
    setInboundDestAnimatedSeries([]);
    setOutboundSrcAnimatedSeries([]);
    const timer = setTimeout(() => {
      if (transfersChartData.inboundDest && transfersChartData.inboundDest.length > 0) {
        setInboundDestAnimatedSeries([{
          name: 'ปริมาณสินค้าเข้า',
          data: transfersChartData.inboundDest.map(d => d.value)
        }]);
      }
      if (transfersChartData.outboundSrc && transfersChartData.outboundSrc.length > 0) {
        setOutboundSrcAnimatedSeries([{
          name: 'ปริมาณสินค้าออก',
          data: transfersChartData.outboundSrc.map(d => d.value)
        }]);
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [transfersChartData]);

  // Helper to clean product codes from float string representations
  const cleanProductCode = (code) => {
    if (!code) return '';
    const str = String(code);
    if (str.length > 8 && /^\d+$/.test(str)) {
      return str.replace(/0+$/, '');
    }
    return str;
  };

  const detailHeaders = useMemo(() => [
    { key: 'item_id', label: 'รหัสสินค้า', style: { width: '180px', minWidth: '180px', whiteSpace: 'nowrap' }, cellRender: (row, val) => cleanProductCode(val) },
    { key: 'name', label: 'ชื่อสินค้า', style: { whiteSpace: 'normal', width: '380px', minWidth: '380px' } },
    { key: 'qtyIn', label: 'ปริมาณรับเข้า (ชิ้น)', align: 'right', style: { width: '160px', minWidth: '160px' }, cellRender: (row, val) => (
      <span style={{ color: val > 0 ? '#16a34a' : 'var(--text-muted)', fontWeight: val > 0 ? '600' : 'normal' }}>
        {(val || 0).toLocaleString()}
      </span>
    ) },
    { key: 'qtyOut', label: 'ปริมาณจ่ายออก (ชิ้น)', align: 'right', style: { width: '160px', minWidth: '160px' }, cellRender: (row, val) => (
      <span style={{ color: val > 0 ? '#ea580c' : 'var(--text-muted)', fontWeight: val > 0 ? '600' : 'normal' }}>
        {(val || 0).toLocaleString()}
      </span>
    ) },
    { key: 'qtyTotal', label: 'ยอดรวม (ชิ้น)', align: 'right', style: { width: '160px', minWidth: '160px' }, cellRender: (row, val) => (
      <span style={{ fontWeight: '700', color: 'var(--text)' }}>
        {(val || 0).toLocaleString()}
      </span>
    ) }
  ], []);

  const itemsHeaders = useMemo(() => [
    { key: 'code', label: 'รหัสสินค้า', style: { width: '200px', minWidth: '200px', whiteSpace: 'nowrap' }, cellRender: (row, val) => cleanProductCode(val) },
    { key: 'name', label: 'ชื่อสินค้า', style: { whiteSpace: 'normal', width: '800px', minWidth: '800px' } }
  ], []);

  const movementsHeaders = useMemo(() => [
    { key: 'code', label: 'รหัสสินค้า', style: { width: '180px', minWidth: '180px', whiteSpace: 'nowrap' }, cellRender: (row, val) => cleanProductCode(val) },
    { key: 'name', label: 'ชื่อสินค้า', style: { whiteSpace: 'nowrap', width: '380px', minWidth: '380px' } },
    { key: 'inCount', label: 'จำนวนรับเข้า (ครั้ง)', align: 'right', style: { width: '160px', minWidth: '160px' }, cellRender: (row, val) => (
      <span style={{ color: val > 0 ? '#16a34a' : 'var(--text-muted)', fontWeight: val > 0 ? '600' : 'normal' }}>
        {(val || 0).toLocaleString()}
      </span>
    ) },
    { key: 'outCount', label: 'จำนวนจ่ายออก (ครั้ง)', align: 'right', style: { width: '160px', minWidth: '160px' }, cellRender: (row, val) => (
      <span style={{ color: val > 0 ? '#ea580c' : 'var(--text-muted)', fontWeight: val > 0 ? '600' : 'normal' }}>
        {(val || 0).toLocaleString()}
      </span>
    ) },
    { key: 'totalCount', label: 'จำนวนทั้งหมด (ครั้ง)', align: 'right', style: { width: '160px', minWidth: '160px' }, cellRender: (row, val) => (
      <span style={{ fontWeight: '700', color: 'var(--text)' }}>
        {(val || 0).toLocaleString()}
      </span>
    ) }
  ], []);

  const stocksHeaders = useMemo(() => [
    { key: 'name', label: 'ชื่อคลังสินค้า', style: { width: '600px', minWidth: '600px' } }
  ], []);

  const netHeaders = useMemo(() => [
    { key: 'item_id', label: 'รหัสสินค้า', style: { width: '180px', minWidth: '180px', whiteSpace: 'nowrap' }, cellRender: (row, val) => cleanProductCode(val) },
    { key: 'name', label: 'ชื่อสินค้า', style: { whiteSpace: 'normal', width: '320px', minWidth: '320px' } },
    { key: 'qtyIn', label: 'ยอดรับเข้า (ชิ้น)', align: 'right', style: { width: '130px', minWidth: '130px' }, cellRender: (row, val) => (val || 0).toLocaleString() },
    { key: 'qtyOut', label: 'ยอดจ่ายออก (ชิ้น)', align: 'right', style: { width: '130px', minWidth: '130px' }, cellRender: (row, val) => (val || 0).toLocaleString() },
    { key: 'net', label: 'ยอดสุทธิ (ชิ้น)', align: 'right', style: { width: '130px', minWidth: '130px' }, cellRender: (row, val) => {
      const color = val > 0 ? '#16a34a' : val < 0 ? '#dc2626' : 'var(--text)';
      return (
        <span style={{ color, fontWeight: '700' }}>
          {(val > 0 ? '+' : '') + val.toLocaleString()}
        </span>
      );
    } },
    { key: 'total', label: 'ยอดรวม (ชิ้น)', align: 'right', style: { width: '130px', minWidth: '130px' }, cellRender: (row, val) => (val || 0).toLocaleString() }
  ], []);

  const transactionHeaders = useMemo(() => [
    { key: '0', label: 'วันที่', style: { width: '90px', minWidth: '90px' }, cellRender: (row, val) => formatDateToDDMMYY(val) },
    { key: '1', label: 'รหัสสินค้า', style: { width: '110px', minWidth: '110px' }, cellRender: (row, val) => cleanProductCode(val) },
    { key: '2', label: 'ชื่อสินค้า', style: { whiteSpace: 'normal', width: '280px', minWidth: '280px' } },
    { key: '3', label: 'ทิศทาง', style: { width: '90px', minWidth: '90px' }, cellRender: (row, val) => (
      <span className={`kpi-badge ${val === 'เข้า' ? 'badge-success' : 'badge-warning'}`} style={{ width: '60px', minWidth: '60px', padding: '4px 8px' }}>
        {val}
      </span>
    ) },
    { key: '4', label: 'คลังต้นทาง', style: { width: '220px', minWidth: '220px' }, cellRender: (row, val) => val || '-' },
    { key: '5', label: 'คลังปลายทาง', style: { width: '220px', minWidth: '220px' }, cellRender: (row, val) => val || '-' },
    { key: '6', label: 'จำนวน', align: 'right', style: { width: '100px', minWidth: '100px' }, cellRender: (row, val) => val.toLocaleString() }
  ], []);

  // Compute drilldown contents reactively based on state filters
  const drilldownData = useMemo(() => {
    if (!drilldownType) return { rows: [], headers: [], summary: [], title: '' };

    let rows = [];
    let headers = [];
    let summary = [];
    let titleStr = '';

    const thaiMonth = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
    const dayNamesThai = ["วันอาทิตย์", "วันจันทร์", "วันอังคาร", "วันพุธ", "วันพฤหัสบดี", "วันศุกร์", "วันเสาร์"];

    if (drilldownType === 'turnover_kpi_items') {
      titleStr = "รายชื่อสินค้าที่มีการเคลื่อนไหว (Unique Items)";
      const uniqueProductsMap = {};
      aggregated.forEach(row => {
        const monthStr = months[row[0]];
        if (!monthStr) return;
        if (startMonth && monthStr < startMonth) return;
        if (endMonth && monthStr > endMonth) return;

        const prodInfo = products[row[4]];
        if (!prodInfo) return;
        const prodCode = prodInfo[0];
        if (selectedProducts.length > 0 && !selectedProducts.includes(prodCode)) return;

        const dirIdx = row[1];
        const srcWh = warehouses[row[2]];
        const destWh = warehouses[row[3]];
        const relevantWh = dirIdx === 0 ? destWh : srcWh;
        if (selectedWarehouses.length > 0 && relevantWh && !selectedWarehouses.includes(relevantWh)) return;

        if (!uniqueProductsMap[prodCode]) {
          uniqueProductsMap[prodCode] = {
            code: prodCode,
            name: prodInfo[1]
          };
        }
      });
      rows = Object.values(uniqueProductsMap).sort((a, b) => a.code.localeCompare(b.code));
      headers = itemsHeaders;
      summary = [{ label: 'จำนวนรายการสินค้า', value: `${rows.length.toLocaleString()} รายการ`, color: 'var(--primary)' }];

    } else if (drilldownType === 'turnover_kpi_movements') {
      titleStr = "สรุปความถี่จำนวนครั้งที่เคลื่อนไหวรายสินค้า – Movements Frequency Details";
      const movementsMap = {};
      aggregated.forEach(row => {
        const monthStr = months[row[0]];
        if (!monthStr) return;
        if (startMonth && monthStr < startMonth) return;
        if (endMonth && monthStr > endMonth) return;

        const prodInfo = products[row[4]];
        if (!prodInfo) return;
        const prodCode = prodInfo[0];
        if (selectedProducts.length > 0 && !selectedProducts.includes(prodCode)) return;

        const dirIdx = row[1];
        const srcWh = warehouses[row[2]];
        const destWh = warehouses[row[3]];
        const relevantWh = dirIdx === 0 ? destWh : srcWh;
        if (selectedWarehouses.length > 0 && relevantWh && !selectedWarehouses.includes(relevantWh)) return;

        const count = row[6] || 0;

        if (!movementsMap[prodCode]) {
          movementsMap[prodCode] = {
            code: prodCode,
            name: prodInfo[1],
            inCount: 0,
            outCount: 0,
            totalCount: 0
          };
        }
        if (dirIdx === 0) movementsMap[prodCode].inCount += count;
        else movementsMap[prodCode].outCount += count;
        movementsMap[prodCode].totalCount += count;
      });
      rows = Object.values(movementsMap).sort((a, b) => b.totalCount - a.totalCount);
      headers = movementsHeaders;
      const totalMovementsSum = rows.reduce((sum, r) => sum + r.totalCount, 0);
      summary = [{ label: 'จำนวนธุรกรรมรวม', value: `${totalMovementsSum.toLocaleString()} ครั้ง (${rows.length.toLocaleString()} รายการสินค้า)`, color: 'var(--primary)' }];

    } else if (drilldownType === 'turnover_kpi_stocks') {
      titleStr = "รายชื่อคลังสินค้าที่มีการเคลื่อนไหว – Unique Warehouses List";
      const uniqueWarehouses = new Set();
      aggregated.forEach(row => {
        const monthStr = months[row[0]];
        if (!monthStr) return;
        if (startMonth && monthStr < startMonth) return;
        if (endMonth && monthStr > endMonth) return;

        const prodInfo = products[row[4]];
        if (!prodInfo) return;
        const prodCode = prodInfo[0];
        if (selectedProducts.length > 0 && !selectedProducts.includes(prodCode)) return;

        const dirIdx = row[1];
        const srcWh = warehouses[row[2]];
        const destWh = warehouses[row[3]];
        const relevantWh = dirIdx === 0 ? destWh : srcWh;
        if (selectedWarehouses.length > 0 && relevantWh && !selectedWarehouses.includes(relevantWh)) return;

        if (srcWh && srcWh !== '-') uniqueWarehouses.add(srcWh);
        if (destWh && destWh !== '-') uniqueWarehouses.add(destWh);
      });
      rows = Array.from(uniqueWarehouses).map(whName => ({ name: whName })).sort((a, b) => a.name.localeCompare(b.name));
      headers = stocksHeaders;
      summary = [{ label: 'จำนวนคลังสินค้า', value: `${rows.length.toLocaleString()} คลัง`, color: 'var(--primary)' }];

    } else if (drilldownType === 'turnover_kpi_net') {
      titleStr = "ผลต่างการรับเข้า-จ่ายออกสุทธิรายสินค้า – Net Quantity Details";
      const summaryMap = {};

      rawDetails.forEach(row => {
        // row: [date_str, prod_idx, dir_idx, src_wh_idx, dest_wh_idx, qty]
        const dateStr = row[0];
        if (startStr && dateStr < startStr) return;
        if (endStr && dateStr > endStr) return;

        const dirIdx = row[2];
        const prodInfo = products[row[1]];
        if (!prodInfo) return;
        const prodCode = prodInfo[0];
        if (selectedProducts.length > 0 && !selectedProducts.includes(prodCode)) return;

        const srcWh = warehouses[row[3]];
        const destWh = warehouses[row[4]];
        const relevantWh = dirIdx === 0 ? destWh : srcWh;
        if (selectedWarehouses.length > 0 && relevantWh && !selectedWarehouses.includes(relevantWh)) return;

        const qty = row[5] || 0;

        if (!summaryMap[prodCode]) {
          summaryMap[prodCode] = { 
            item_id: prodCode, 
            name: prodInfo[1], 
            qtyIn: 0, 
            qtyOut: 0, 
            net: 0,
            total: 0,
            count: 0 
          };
        }
        const p = summaryMap[prodCode];
        if (dirIdx === 0) p.qtyIn += qty;
        else p.qtyOut += qty;
        p.count += 1;
      });

      let tempNetRows = Object.values(summaryMap).map(p => {
        p.net = p.qtyIn - p.qtyOut;
        p.total = p.qtyIn + p.qtyOut;
        return p;
      });

      if (modalNetTab === 'Positive') {
        tempNetRows = tempNetRows.filter(r => r.net > 0).sort((a, b) => b.net - a.net);
      } else if (modalNetTab === 'Negative') {
        tempNetRows = tempNetRows.filter(r => r.net < 0).sort((a, b) => a.net - b.net);
      } else {
        tempNetRows.sort((a, b) => b.total - a.total);
      }

      rows = tempNetRows;
      headers = netHeaders;
      summary = [];

    } else if (
      drilldownType === 'turnover_kpi_qty' ||
      drilldownType === 'turnover_kpi_qtyin' ||
      drilldownType === 'turnover_kpi_qtyout' ||
      drilldownType === 'turnover_monthly'
    ) {
      if (drilldownType === 'turnover_kpi_qty') titleStr = "รายการความเคลื่อนไหวสินค้าทั้งหมด – Total Quantity Details";
      else if (drilldownType === 'turnover_kpi_qtyin') titleStr = "รายการรับเข้าสินค้าทั้งหมด – Inbound Quantity Details";
      else if (drilldownType === 'turnover_kpi_qtyout') titleStr = "รายการจ่ายออกสินค้าทั้งหมด – Outbound Quantity Details";
      else if (drilldownType === 'turnover_monthly') {
        if (drilldownKey.month) {
          const [year, month] = drilldownKey.month.split('-');
          titleStr = `ความเคลื่อนไหวเดือน ${thaiMonth[parseInt(month, 10)-1]} ${year} – Turnover Details`;
        } else {
          titleStr = drilldownKey.direction === 'เข้า' ? 'เจาะลึกข้อมูลสินค้าเข้าคลังทั้งหมด' : (drilldownKey.direction === 'ออก' ? 'เจาะลึกข้อมูลสินค้าออกคลังทั้งหมด' : 'เจาะลึกข้อมูลสินค้าเข้า-ออกสุทธิ');
        }
      }

      const summaryMap = {};
      const targetDirIdx = (drilldownType === 'turnover_kpi_qtyin' || (drilldownType === 'turnover_monthly' && drilldownKey.direction === 'เข้า')) 
        ? 0 
        : ((drilldownType === 'turnover_kpi_qtyout' || (drilldownType === 'turnover_monthly' && drilldownKey.direction === 'ออก')) ? 1 : null);

      let totalQtyCount = 0;
      let transactionCount = 0;

      aggregated.forEach(row => {
        const monthStr = months[row[0]];
        if (!monthStr) return;
        if (startMonth && monthStr < startMonth) return;
        if (endMonth && monthStr > endMonth) return;

        if (drilldownType === 'turnover_monthly' && drilldownKey.month && monthStr !== drilldownKey.month) return;

        const dirIdx = row[1];
        if (targetDirIdx !== null && dirIdx !== targetDirIdx) return;
        
        if (modalQtyTab === 'In' && dirIdx !== 0) return;
        if (modalQtyTab === 'Out' && dirIdx !== 1) return;

        const prodInfo = products[row[4]];
        if (!prodInfo) return;
        const prodCode = prodInfo[0];
        if (selectedProducts.length > 0 && !selectedProducts.includes(prodCode)) return;

        const srcWh = warehouses[row[2]];
        const destWh = warehouses[row[3]];
        const relevantWh = dirIdx === 0 ? destWh : srcWh;
        if (selectedWarehouses.length > 0 && relevantWh && !selectedWarehouses.includes(relevantWh)) return;

        const qty = row[5] || 0;
        const count = row[6] || 0;

        if (!summaryMap[prodCode]) {
          summaryMap[prodCode] = { item_id: prodCode, name: prodInfo[1], qtyIn: 0, qtyOut: 0, qtyTotal: 0 };
        }
        if (dirIdx === 0) {
          summaryMap[prodCode].qtyIn += qty;
        } else {
          summaryMap[prodCode].qtyOut += qty;
        }
        summaryMap[prodCode].qtyTotal += qty;
        totalQtyCount += qty;
        transactionCount += count;
      });

      rows = Object.values(summaryMap).sort((a, b) => b.qtyTotal - a.qtyTotal);
      if (drilldownType === 'turnover_kpi_qtyin' || (drilldownType === 'turnover_monthly' && drilldownKey?.direction === 'เข้า')) {
        headers = detailHeaders.filter(h => h.key !== 'qtyOut');
      } else if (drilldownType === 'turnover_kpi_qtyout' || (drilldownType === 'turnover_monthly' && drilldownKey?.direction === 'ออก')) {
        headers = detailHeaders.filter(h => h.key !== 'qtyIn');
      } else {
        headers = detailHeaders;
      }
      summary = [];

    } else if (drilldownType === 'turnover_yearly') {
      const parts = drilldownKey.split('|');
      const year = parts[0];
      const direction = parts[1];
      const targetDirIdx = direction === 'In' ? 0 : 1;

      titleStr = `ความเคลื่อนไหวปี ${year}${direction === 'In' ? ' (เข้า)' : direction === 'Out' ? ' (ออก)' : ''} – Turnover Details`;

      const summaryMap = {};
      let totalQtyCount = 0;
      let transactionCount = 0;

      aggregated.forEach(row => {
        const monthStr = months[row[0]];
        if (!monthStr || !monthStr.startsWith(year)) return;

        if (modalYearlyMonth !== 'All') {
          const monthPart = monthStr.split('-')[1];
          if (monthPart !== modalYearlyMonth) return;
        }

        const dirIdx = row[1];
        if (dirIdx !== targetDirIdx) return;

        const prodInfo = products[row[4]];
        if (!prodInfo) return;
        const prodCode = prodInfo[0];
        if (selectedProducts.length > 0 && !selectedProducts.includes(prodCode)) return;

        const srcWh = warehouses[row[2]];
        const destWh = warehouses[row[3]];
        const relevantWh = dirIdx === 0 ? destWh : srcWh;
        if (selectedWarehouses.length > 0 && relevantWh && !selectedWarehouses.includes(relevantWh)) return;

        const qty = row[5] || 0;
        const count = row[6] || 0;

        if (!summaryMap[prodCode]) {
          summaryMap[prodCode] = { item_id: prodCode, name: prodInfo[1], qtyIn: 0, qtyOut: 0, qtyTotal: 0 };
        }
        if (dirIdx === 0) {
          summaryMap[prodCode].qtyIn += qty;
        } else {
          summaryMap[prodCode].qtyOut += qty;
        }
        summaryMap[prodCode].qtyTotal += qty;
        totalQtyCount += qty;
        transactionCount += count;
      });

      if (modalYearlyDay !== 'All') {
        const dayIdx = parseInt(modalYearlyDay, 10);
        const yearlyDayMap = {};
        totalQtyCount = 0;
        transactionCount = 0;

        rawDetails.forEach(row => {
          // row: [date_str, prod_idx, dir_idx, src_wh_idx, dest_wh_idx, qty]
          const dateStr = row[0];
          if (!dateStr.startsWith(year)) return;

          if (modalYearlyMonth !== 'All') {
            const m = dateStr.split('-')[1];
            if (m !== modalYearlyMonth) return;
          }

          const dirIdx = row[2];
          const dir = dirIdx === 0 ? 'เข้า' : 'ออก';
          if (direction === 'In' && dir !== 'เข้า') return;
          if (direction === 'Out' && dir !== 'ออก') return;

          const parts = dateStr.split('-');
          const dObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
          if (dObj.getDay() !== dayIdx) return;

          const prodInfo = products[row[1]];
          if (!prodInfo) return;
          const prodCode = prodInfo[0];
          if (selectedProducts.length > 0 && !selectedProducts.includes(prodCode)) return;

          const srcWh = warehouses[row[3]];
          const destWh = warehouses[row[4]];
          const relevantWh = direction === 'In' ? destWh : srcWh;
          if (selectedWarehouses.length > 0 && relevantWh && !selectedWarehouses.includes(relevantWh)) return;

          const qty = row[5] || 0;

          if (!yearlyDayMap[prodCode]) {
            yearlyDayMap[prodCode] = { item_id: prodCode, name: prodInfo[1], qtyIn: 0, qtyOut: 0, qtyTotal: 0 };
          }
          if (dir === 'เข้า') {
            yearlyDayMap[prodCode].qtyIn += qty;
          } else {
            yearlyDayMap[prodCode].qtyOut += qty;
          }
          yearlyDayMap[prodCode].qtyTotal += qty;
          totalQtyCount += qty;
          transactionCount += 1;
        });

        rows = Object.values(yearlyDayMap);
      } else {
        rows = Object.values(summaryMap);
      }

      rows.sort((a, b) => b.qtyTotal - a.qtyTotal);

      if (direction === 'In') {
        headers = detailHeaders.filter(h => h.key !== 'qtyOut');
      } else {
        headers = detailHeaders.filter(h => h.key !== 'qtyIn');
      }
      summary = [{
        label: direction === 'In' ? 'ปริมาณรับเข้ารวม' : 'ปริมาณจ่ายออกรวม',
        value: `${totalQtyCount.toLocaleString()} ชิ้น`,
        color: 'var(--primary)'
      }];

    } else if (drilldownType === 'turnover_dow') {
      const parts = drilldownKey.split('|');
      const dowIdx = parseInt(parts[0], 10);
      const direction = parts[1];

      titleStr = `ประวัติความเคลื่อนไหว: ${dayNamesThai[dowIdx]} (${direction === 'In' ? 'เข้า' : 'ออก'}) – Turnover Details`;

      const summaryMap = {};
      let totalQtyCount = 0;
      let transactionCount = 0;

      rawDetails.forEach(row => {
        // row: [date_str, prod_idx, dir_idx, src_wh_idx, dest_wh_idx, qty]
        const dateStr = row[0];
        if (startStr && dateStr < startStr) return;
        if (endStr && dateStr > endStr) return;

        const dirIdx = row[2];
        const dir = dirIdx === 0 ? 'เข้า' : 'ออก';
        if (direction === 'In' && dir !== 'เข้า') return;
        if (direction === 'Out' && dir !== 'ออก') return;

        const dateParts = dateStr.split('-');
        const dObj = new Date(parseInt(dateParts[0], 10), parseInt(dateParts[1], 10) - 1, parseInt(dateParts[2], 10));
        if (dObj.getDay() !== dowIdx) return;

        const prodInfo = products[row[1]];
        if (!prodInfo) return;
        const prodCode = prodInfo[0];
        if (selectedProducts.length > 0 && !selectedProducts.includes(prodCode)) return;

        const srcWh = warehouses[row[3]];
        const destWh = warehouses[row[4]];
        const relevantWh = direction === 'In' ? destWh : srcWh;
        if (selectedWarehouses.length > 0 && relevantWh && !selectedWarehouses.includes(relevantWh)) return;

        const qty = row[5] || 0;

        if (!summaryMap[prodCode]) {
          summaryMap[prodCode] = { item_id: prodCode, name: prodInfo[1], qtyIn: 0, qtyOut: 0, qtyTotal: 0 };
        }
        if (dir === 'เข้า') {
          summaryMap[prodCode].qtyIn += qty;
        } else {
          summaryMap[prodCode].qtyOut += qty;
        }
        summaryMap[prodCode].qtyTotal += qty;
        totalQtyCount += qty;
        transactionCount += 1;
      });

      rows = Object.values(summaryMap).sort((a, b) => b.qtyTotal - a.qtyTotal);
      headers = detailHeaders;
      summary = [];

    } else if (
      drilldownType === 'turnover_warehouse_in_dest' ||
      drilldownType === 'turnover_warehouse_in_src' ||
      drilldownType === 'turnover_warehouse_out_src' ||
      drilldownType === 'turnover_warehouse_out_dest'
    ) {
      titleStr = `ประวัติความเคลื่อนไหว คลัง: ${drilldownKey} – Turnover Details`;
      const isSrc = drilldownType.endsWith('_src');
      const isIn = drilldownType.startsWith('turnover_warehouse_in');

      const summaryMap = {};
      let totalQtyCount = 0;
      let transactionCount = 0;

      aggregated.forEach(row => {
        const monthStr = months[row[0]];
        if (!monthStr) return;
        if (startMonth && monthStr < startMonth) return;
        if (endMonth && monthStr > endMonth) return;

        const dirIdx = row[1];
        if (isIn && dirIdx !== 0) return;
        if (!isIn && dirIdx !== 1) return;

        const targetWh = warehouses[isSrc ? row[2] : row[3]];
        if (targetWh !== drilldownKey) return;

        const prodInfo = products[row[4]];
        if (!prodInfo) return;
        const prodCode = prodInfo[0];
        if (selectedProducts.length > 0 && !selectedProducts.includes(prodCode)) return;

        const qty = row[5] || 0;
        const count = row[6] || 0;

        if (!summaryMap[prodCode]) {
          summaryMap[prodCode] = { item_id: prodCode, name: prodInfo[1], qtyIn: 0, qtyOut: 0, qtyTotal: 0 };
        }
        if (dirIdx === 0) {
          summaryMap[prodCode].qtyIn += qty;
        } else {
          summaryMap[prodCode].qtyOut += qty;
        }
        summaryMap[prodCode].qtyTotal += qty;
        totalQtyCount += qty;
        transactionCount += count;
      });

      rows = Object.values(summaryMap).sort((a, b) => b.qtyTotal - a.qtyTotal);
      headers = detailHeaders;
      summary = [];

    } else if (drilldownType === 'turnover_product') {
      titleStr = `ประวัติความเคลื่อนไหวสินค้า: ${drilldownKey}`;
      
      const summaryMap = {};
      let totalQtyCount = 0;
      let transactionCount = 0;

      aggregated.forEach(row => {
        const monthStr = months[row[0]];
        if (!monthStr) return;
        if (startMonth && monthStr < startMonth) return;
        if (endMonth && monthStr > endMonth) return;

        const prodInfo = products[row[4]];
        if (!prodInfo) return;
        const prodCode = prodInfo[0];
        const prodName = prodInfo[1];
        if (prodName !== drilldownKey && prodCode !== drilldownKey) return;

        const dirIdx = row[1];
        const srcWh = warehouses[row[2]];
        const destWh = warehouses[row[3]];
        const relevantWh = dirIdx === 0 ? destWh : srcWh;
        if (selectedWarehouses.length > 0 && relevantWh && !selectedWarehouses.includes(relevantWh)) return;

        const qty = row[5] || 0;
        const count = row[6] || 0;

        if (!summaryMap[prodCode]) {
          summaryMap[prodCode] = { item_id: prodCode, name: prodName, qtyIn: 0, qtyOut: 0, qtyTotal: 0 };
        }
        if (dirIdx === 0) {
          summaryMap[prodCode].qtyIn += qty;
        } else {
          summaryMap[prodCode].qtyOut += qty;
        }
        summaryMap[prodCode].qtyTotal += qty;
        totalQtyCount += qty;
        transactionCount += count;
      });

      rows = Object.values(summaryMap);
      headers = detailHeaders;
      summary = [{ label: 'รายละเอียดสินค้า', value: `ชื่อสินค้า: ${drilldownKey} | จำนวนรวม: ${totalQtyCount.toLocaleString()} ชิ้น (${transactionCount.toLocaleString()} ธุรกรรม)`, color: 'var(--primary)' }];

    } else if (drilldownType === 'turnover_product_details') {
      const parts = drilldownKey.split('|');
      const parentType = parts[0];
      const contextVal = parts[1];
      const prodCode = parts[2];
      const direction = parts[3] || 'All';

      const productItem = products.find(p => p[0] === prodCode);
      const name = productItem ? productItem[1] : prodCode;
      titleStr = `รายละเอียดสินค้า: ${name} (${direction === 'In' ? 'รับเข้า' : direction === 'Out' ? 'จ่ายออก' : 'ทั้งหมด'})`;

      // 1. Calculate aggregated transfer routes for this product / context (100% complete coverage)
      const prodIdx = products.findIndex(p => p[0] === prodCode);
      const aggMatches = [];
      let aggTotalQty = 0;

      if (prodIdx !== -1 && aggregated && aggregated.length > 0) {
        aggregated.forEach(aggRow => {
          // aggRow: [month_idx, dir_idx, src_wh_idx, dest_wh_idx, prod_idx, qty, count]
          if (aggRow[4] !== prodIdx) return;
          const mStr = months[aggRow[0]];
          if (!mStr) return;

          if (parentType === 'turnover_monthly' && contextVal && mStr !== contextVal) return;
          if (parentType === 'turnover_yearly' && contextVal && !mStr.startsWith(contextVal)) return;

          const dirIdx = aggRow[1];
          if (direction === 'In' && dirIdx !== 0) return;
          if (direction === 'Out' && dirIdx !== 1) return;

          const srcWh = warehouses[aggRow[2]] || '-';
          const destWh = warehouses[aggRow[3]] || '-';
          const relevantWh = dirIdx === 0 ? destWh : srcWh;
          if (selectedWarehouses.length > 0 && relevantWh && !selectedWarehouses.includes(relevantWh)) return;

          // Apply Month dropdown filter
          if (modalYearlyMonth !== 'All' && mStr.substring(5, 7) !== modalYearlyMonth) return;
          // Apply Year dropdown filter
          if (modalYearFilter !== 'All' && mStr.substring(0, 4) !== modalYearFilter) return;

          const qty = aggRow[5] || 0;
          if (qty <= 0) return;

          aggTotalQty += qty;
          aggMatches.push([
            `${mStr}-01`,
            prodCode,
            name,
            dirIdx === 0 ? 'เข้า' : 'ออก',
            srcWh,
            destWh,
            qty
          ]);
        });
      }

      // 2. Filter rawDetails (daily transactions)
      const rawMatches = [];
      let rawTotalQty = 0;

      rawDetails.forEach(row => {
        // row can be compact: [date_str, prod_idx, dir_idx, src_wh_idx, dest_wh_idx, qty]
        // or non-compact: [date_str, item_id, name, dir, src_wh, dest_wh, qty]
        const isCompact = typeof row[1] === 'number';
        const dateStr = String(row[0] || '');
        const prodInfo = isCompact ? products[row[1]] : null;
        const prodCodeRaw = isCompact ? (prodInfo ? prodInfo[0] : '') : String(row[1] || '');
        if (prodCodeRaw !== prodCode) return;

        const dirStr = isCompact ? (row[2] === 0 ? 'เข้า' : 'ออก') : String(row[3] || '');
        if (direction === 'In' && dirStr !== 'เข้า') return;
        if (direction === 'Out' && dirStr !== 'ออก') return;

        if (startStr && dateStr < startStr) return;
        if (endStr && dateStr > endStr) return;

        const srcWh = isCompact ? (warehouses[row[3]] || '') : String(row[4] || '');
        const destWh = isCompact ? (warehouses[row[4]] || '') : String(row[5] || '');
        const relevantWh = dirStr === 'เข้า' ? destWh : srcWh;
        if (selectedWarehouses.length > 0 && relevantWh && !selectedWarehouses.includes(relevantWh)) return;

        let matchParent = true;
        if (parentType === 'turnover_monthly' && contextVal) {
          matchParent = (dateStr.substring(0, 7) === contextVal);
        } else if (parentType === 'turnover_yearly' && contextVal) {
          matchParent = (dateStr.substring(0, 4) === contextVal);
        } else if (parentType.startsWith('turnover_warehouse_') && contextVal) {
          matchParent = (relevantWh === contextVal);
        } else if (parentType === 'turnover_dow' && contextVal) {
          const dateParts = dateStr.split('-');
          const dObj = new Date(parseInt(dateParts[0], 10), parseInt(dateParts[1], 10) - 1, parseInt(dateParts[2], 10));
          matchParent = (dObj.getDay() === parseInt(contextVal, 10));
        }

        if (!matchParent) return;

        // Apply Day of Month dropdown filter (1-31)
        if (modalYearlyDay !== 'All' && dateStr.includes('-')) {
          const dayVal = parseInt(dateStr.split('-')[2], 10).toString();
          if (dayVal !== modalYearlyDay) return;
        }

        // Apply Month of Year dropdown filter (01-12)
        if (modalYearlyMonth !== 'All' && dateStr.length >= 7) {
          const monthVal = dateStr.substring(5, 7);
          if (monthVal !== modalYearlyMonth) return;
        }

        // Apply Year dropdown filter (2019-2026)
        if (modalYearFilter !== 'All' && dateStr.length >= 4) {
          const yearVal = dateStr.substring(0, 4);
          if (yearVal !== modalYearFilter) return;
        }

        const qty = isCompact ? (row[5] || 0) : (row[6] || 0);
        rawTotalQty += qty;

        rawMatches.push([
          dateStr,
          isCompact ? (prodInfo ? prodInfo[0] : '') : row[1],
          isCompact ? (prodInfo ? prodInfo[1] : '') : row[2],
          dirStr,
          srcWh,
          destWh,
          qty
        ]);
      });

      // 3. Choose the complete dataset:
      // If rawMatches has equal or greater quantity than aggTotalQty (e.g. fully detailed file), use rawMatches.
      // Otherwise, use aggMatches (which contains 100% of all warehouse transfers matching Level 1 exactly).
      if (rawMatches.length > 0 && (rawTotalQty >= aggTotalQty || modalYearlyDay !== 'All')) {
        rows = rawMatches.sort((a, b) => (Number(b[6]) || 0) - (Number(a[6]) || 0));
      } else if (aggMatches.length > 0) {
        rows = aggMatches.sort((a, b) => (Number(b[6]) || 0) - (Number(a[6]) || 0));
      } else {
        rows = rawMatches.sort((a, b) => (Number(b[6]) || 0) - (Number(a[6]) || 0));
      }

      headers = transactionHeaders;
      summary = [];
    }

    return { rows, headers, summary, title: titleStr };
  }, [
    drilldownType, 
    drilldownKey, 
    aggregated, 
    months, 
    products, 
    warehouses, 
    rawDetails,
    startMonth, 
    endMonth, 
    startStr, 
    endStr,
    selectedProducts, 
    selectedWarehouses,
    modalQtyTab, 
    modalNetTab, 
    modalYearlyDay, 
    modalYearlyMonth, 
    modalYearFilter,
    itemsHeaders,
    movementsHeaders,
    stocksHeaders,
    netHeaders,
    detailHeaders,
    transactionHeaders
  ]);

  const modalFilterBar = useMemo(() => {
    if (
      drilldownType === 'turnover_kpi_qty' || 
      drilldownType === 'turnover_monthly'
    ) {
      return (
        <div className="modal-pills-bar" style={{ display: 'flex', gap: '10px', padding: '8px 0 12px 0', borderBottom: '1px solid var(--border)', marginBottom: '12px' }}>
          {[
            { id: 'All', label: 'ทั้งหมด (All)', color: '#2563eb', bg: 'rgba(37, 99, 235, 0.1)' },
            { id: 'In', label: 'ขาเข้า (Inbound)', color: '#16a34a', bg: 'rgba(22, 163, 74, 0.1)' },
            { id: 'Out', label: 'ขาออก (Outbound)', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setModalQtyTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 16px',
                borderRadius: '50px',
                border: modalQtyTab === tab.id ? `1.5px solid ${tab.color}` : '1px solid var(--border)',
                backgroundColor: modalQtyTab === tab.id ? tab.bg : 'var(--card-bg)',
                color: modalQtyTab === tab.id ? tab.color : 'var(--text)',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 500,
                transition: 'all 0.2s'
              }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: tab.color }}></span>
              {tab.label}
            </button>
          ))}
        </div>
      );
    }

    if (drilldownType === 'turnover_kpi_net') {
      return (
        <div className="modal-pills-bar" style={{ display: 'flex', gap: '10px', padding: '8px 0 12px 0', borderBottom: '1px solid var(--border)', marginBottom: '12px' }}>
          {[
            { id: 'All', label: 'ทั้งหมด (All)', color: '#2563eb', bg: 'rgba(37, 99, 235, 0.1)' },
            { id: 'Positive', label: 'รับสุทธิ (+)', color: '#16a34a', bg: 'rgba(22, 163, 74, 0.1)' },
            { id: 'Negative', label: 'จ่ายสุทธิ (-)', color: '#dc2626', bg: 'rgba(220, 38, 38, 0.1)' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setModalNetTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 16px',
                borderRadius: '50px',
                border: modalNetTab === tab.id ? `1.5px solid ${tab.color}` : '1px solid var(--border)',
                backgroundColor: modalNetTab === tab.id ? tab.bg : 'var(--card-bg)',
                color: modalNetTab === tab.id ? tab.color : 'var(--text)',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 500,
                transition: 'all 0.2s'
              }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: tab.color }}></span>
              {tab.label}
            </button>
          ))}
        </div>
      );
    }

    if (drilldownType === 'turnover_product_details') {
      const parts = drilldownKey ? drilldownKey.split('|') : [];
      const parentType = parts[0];

      const daysOfMonth = Array.from({ length: 31 }, (_, i) => (i + 1).toString());
      const monthsOfYear = [
        { id: '01', label: 'มกราคม' },
        { id: '02', label: 'กุมภาพันธ์' },
        { id: '03', label: 'มีนาคม' },
        { id: '04', label: 'เมษายน' },
        { id: '05', label: 'พฤษภาคม' },
        { id: '06', label: 'มิถุนายน' },
        { id: '07', label: 'กรกฎาคม' },
        { id: '08', label: 'สิงหาคม' },
        { id: '09', label: 'กันยายน' },
        { id: '10', label: 'ตุลาคม' },
        { id: '11', label: 'พฤศจิกายน' },
        { id: '12', label: 'ธันวาคม' }
      ];
      const yearsList = ['2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026'];

      const showDay = parentType === 'turnover_monthly' || parentType === 'turnover_yearly' || parentType === 'turnover_product';
      const showMonth = parentType === 'turnover_yearly' || parentType === 'turnover_dow' || parentType === 'turnover_product';
      const showYear = parentType === 'turnover_dow' || parentType === 'turnover_product';

      return (
        <div style={{ display: 'flex', gap: '15px', padding: '8px 0 12px 0', borderBottom: '1px solid var(--border)', marginBottom: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          {showDay && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--secondary)' }}>กรองตามวันที่:</span>
              <select
                value={modalYearlyDay}
                onChange={(e) => setModalYearlyDay(e.target.value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--card-bg)',
                  color: 'var(--text)',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  minWidth: '130px'
                }}
              >
                <option value="All">ทุกวัน</option>
                {daysOfMonth.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          )}

          {showMonth && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--secondary)' }}>กรองตามเดือน:</span>
              <select
                value={modalYearlyMonth}
                onChange={(e) => setModalYearlyMonth(e.target.value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--card-bg)',
                  color: 'var(--text)',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  minWidth: '150px'
                }}
              >
                <option value="All">ทุกเดือน</option>
                {monthsOfYear.map(m => (
                  <option key={m.id} value={m.id}>{m.label} ({m.id})</option>
                ))}
              </select>
            </div>
          )}

          {showYear && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--secondary)' }}>กรองตามปี:</span>
              <select
                value={modalYearFilter}
                onChange={(e) => setModalYearFilter(e.target.value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--card-bg)',
                  color: 'var(--text)',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  minWidth: '130px'
                }}
              >
                <option value="All">ทุกปี</option>
                {yearsList.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      );
    }

    return null;
  }, [
    drilldownType, 
    drilldownKey,
    modalQtyTab, 
    modalNetTab, 
    modalYearlyDay, 
    modalYearlyMonth, 
    modalYearFilter
  ]);

  // Nested drilldown push/pop
  const pushDrilldown = (type, key, title) => {
    setDrilldownHistory(prev => [...prev, { type: drilldownType, key: drilldownKey, title: drilldownTitle }]);
    setDrilldownType(type);
    setDrilldownKey(key);
    setDrilldownTitle(title);
  };

  const popDrilldown = () => {
    if (drilldownHistory.length === 0) return;
    const prev = drilldownHistory[drilldownHistory.length - 1];
    setDrilldownHistory(prevHistory => prevHistory.slice(0, -1));
    setDrilldownType(prev.type);
    setDrilldownKey(prev.key);
    setDrilldownTitle(prev.title);
  };

  const handleOpenDrilldown = (type, key, titleStr) => {
    setDrilldownType(type);
    setDrilldownKey(key);
    setDrilldownTitle(titleStr);
    setDrilldownHistory([]);
    setModalQtyTab('All');
    setModalNetTab('All');
    setModalYearlyDay('All');
    setModalYearlyMonth('All');
    setModalYearlySort('date_asc');
    setModalYearFilter('All');
    setIsModalOpen(true);
  };

  const handleModalRowClick = (row) => {
    const prodCode = row.item_id || row.code;
    if (!prodCode) return;
    if (drilldownType === 'turnover_product_details') return;

    let parentType = drilldownType;
    let contextVal = drilldownKey || '';
    if (typeof contextVal === 'object') {
      contextVal = contextVal.month || '';
    }

    let direction = 'All';
    if (drilldownType === 'turnover_kpi_qtyin' || (drilldownType === 'turnover_monthly' && drilldownKey?.direction === 'เข้า')) {
      direction = 'In';
    } else if (drilldownType === 'turnover_kpi_qtyout' || (drilldownType === 'turnover_monthly' && drilldownKey?.direction === 'ออก')) {
      direction = 'Out';
    } else if (drilldownType === 'turnover_yearly') {
      const parts = drilldownKey.split('|');
      direction = parts[1] || 'All';
      contextVal = parts[0] || '';
    } else if (drilldownType === 'turnover_dow') {
      const parts = drilldownKey.split('|');
      direction = parts[1] || 'All';
      contextVal = parts[0] || '';
    } else if (drilldownType.startsWith('turnover_warehouse_in')) {
      direction = 'In';
    } else if (drilldownType.startsWith('turnover_warehouse_out')) {
      direction = 'Out';
    }

    const key = `${parentType}|${contextVal}|${prodCode}|${direction}`;
    pushDrilldown('turnover_product_details', key, `รายละเอียดสินค้า: ${row.name || prodCode}`);
  };

  const tableHeaders = [
    { key: '0', label: 'วันที่', style: { width: '90px', minWidth: '90px' }, cellRender: (row, val) => formatDateToDDMMYY(val) },
    { key: '1', label: 'รหัสสินค้า', style: { width: '130px', minWidth: '110px' }, cellRender: (row, val) => val || '-' },
    { key: '2', label: 'ชื่อสินค้า', style: { whiteSpace: 'normal', width: '320px', minWidth: '280px' }, cellRender: (row, val) => val || '-' },
    { key: '3', label: 'ทิศทาง', style: { width: '120px', minWidth: '90px' }, cellRender: (row, val) => (
      <span className={`kpi-badge ${val === 'เข้า' ? 'badge-success' : 'badge-warning'}`} style={{ width: '60px', minWidth: '60px', padding: '4px 8px' }}>
        {val}
      </span>
    ) },
    { key: '4', label: 'คลังต้นทาง', style: { width: '140px', minWidth: '220px' }, cellRender: (row, val) => val || '-' },
    { key: '5', label: 'คลังปลายทาง', style: { width: '140px', minWidth: '220px' }, cellRender: (row, val) => val || '-' },
    { key: '6', label: 'จำนวน', align: 'right', style: { width: '100px', minWidth: '100px' }, cellRender: (row, val) => (Number(val) || 0).toLocaleString() }
  ];

  const drilldownDisablePills = (
    drilldownType === 'turnover_kpi_qtyin' ||
    drilldownType === 'turnover_kpi_qtyout' ||
    drilldownType === 'turnover_kpi_net' ||
    drilldownType === 'turnover_yearly' ||
    drilldownType === 'turnover_dow' ||
    drilldownType === 'turnover_product' ||
    drilldownType === 'turnover_warehouse_in_dest' ||
    drilldownType === 'turnover_warehouse_in_src' ||
    drilldownType === 'turnover_warehouse_out_src' ||
    drilldownType === 'turnover_warehouse_out_dest'
  );

  return (
    <div className="tab-container">
      {/* KPI Row */}
      <section className="kpi-row" style={{ marginBottom: '24px' }}>
        <KpiCard 
          title="จำนวนสินค้า"
          value={Math.round(stats.qtyTotal).toLocaleString('th-TH', { maximumFractionDigits: 0 }) + ' <span style="font-size:0.85rem; color:var(--text-muted);">ชิ้น</span>'}
          icon={Layers}
          accentClass="info"
          subtext="จำนวนรวมสินค้าที่มีการหมุนเวียน"
          onClick={() => handleOpenDrilldown('turnover_kpi_qty', 'qty', 'รายการความเคลื่อนไหวสินค้าทั้งหมด – Total Quantity Details')}
        />
        <KpiCard 
          title="จำนวนรายการสินค้า"
          value={Math.round(stats.uniqueProds).toLocaleString('th-TH', { maximumFractionDigits: 0 }) + ' <span style="font-size:0.85rem; color:var(--text-muted);">รายการ</span>'}
          icon={Package}
          accentClass="success"
          subtext="จำนวนรวมรายการสินค้าที่มีการหมุนเวียน"
          onClick={() => handleOpenDrilldown('turnover_kpi_items', 'items', 'รายชื่อสินค้าที่มีการเคลื่อนไหว (Unique Items)')}
        />
        <KpiCard 
          title="จำนวนธุรกรรม"
          value={Math.round(stats.movements).toLocaleString('th-TH', { maximumFractionDigits: 0 }) + ' <span style="font-size:0.85rem; color:var(--text-muted);">ครั้ง</span>'}
          icon={ArrowRightLeft}
          accentClass="warning"
          subtext="จำนวนรายการธุรกรรมทั้งหมด"
          onClick={() => handleOpenDrilldown('turnover_kpi_movements', 'movements', 'สรุปความถี่จำนวนครั้งที่เคลื่อนไหวรายสินค้า – Movements Frequency Details')}
        />
        <KpiCard 
          title="จำนวนคลังสินค้า"
          value={Math.round(stats.uniqueWhs).toLocaleString('th-TH', { maximumFractionDigits: 0 }) + ' <span style="font-size:0.85rem; color:var(--text-muted);">คลัง</span>'}
          icon={Home}
          accentClass="purple"
          subtext="จำนวนรวมคลังสินค้าที่มีการเคลื่อนไหว"
          onClick={() => handleOpenDrilldown('turnover_kpi_stocks', 'stocks', 'รายชื่อคลังสินค้าที่มีการเคลื่อนไหว – Unique Warehouses List')}
        />
      </section>

      {/* Charts Layout section */}
      <section className="charts-layout-container" style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '24px' }}>
        
        {/* Row 1: Line Chart Monthly In vs Out with side panel KPI stack */}
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          {/* Left Stack: KPI Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '280px', flexShrink: 0, minWidth: '250px' }}>
            {/* Card T5: Total Quantity In */}
            <div 
              className="kpi-card success" 
              style={{ cursor: 'pointer', width: '100%', marginBottom: 0 }}
              onClick={() => handleOpenDrilldown('turnover_kpi_qtyin', 'qtyin', 'รายการรับเข้าสินค้าทั้งหมด – Inbound Quantity Details')}
            >
              <div className="kpi-card-header">
                <span className="kpi-title" style={{ fontWeight: 600, color: 'var(--text)' }}>จำนวนขาเข้าทั้งหมด</span>
                <div className="card-icon-wrapper" style={{ color: 'var(--success)', backgroundColor: 'transparent', border: 'none', padding: 0 }}>
                  <ArrowDownLeft style={{ width: '24px', height: '24px', strokeWidth: 2.5 }} />
                </div>
              </div>
              <div className="kpi-value-container">
                <div className="kpi-value">{Math.round(stats.qtyIn).toLocaleString('th-TH', { maximumFractionDigits: 0 })}</div>
              </div>
              <p className="kpi-subtext" style={{ marginTop: '4px', lineHeight: 1.4, borderTop: '1px solid var(--border)', paddingTop: '4px' }}>
                <span>{Math.round(stats.inboundCount).toLocaleString('th-TH', { maximumFractionDigits: 0 })} ธุรกรรม</span>
              </p>
            </div>

            {/* Card T6: Total Quantity Out */}
            <div 
              className="kpi-card danger" 
              style={{ cursor: 'pointer', width: '100%', marginBottom: 0 }}
              onClick={() => handleOpenDrilldown('turnover_kpi_qtyout', 'qtyout', 'รายการจ่ายออกสินค้าทั้งหมด – Outbound Quantity Details')}
            >
              <div className="kpi-card-header">
                <span className="kpi-title" style={{ fontWeight: 600, color: 'var(--text)' }}>จำนวนขาออกทั้งหมด</span>
                <div className="card-icon-wrapper" style={{ color: 'var(--danger)', backgroundColor: 'transparent', border: 'none', padding: 0 }}>
                  <ArrowUpRight style={{ width: '24px', height: '24px', strokeWidth: 2.5 }} />
                </div>
              </div>
              <div className="kpi-value-container">
                <div className="kpi-value">{Math.round(stats.qtyOut).toLocaleString('th-TH', { maximumFractionDigits: 0 })}</div>
              </div>
              <p className="kpi-subtext" style={{ marginTop: '4px', lineHeight: 1.4, borderTop: '1px solid var(--border)', paddingTop: '4px' }}>
                <span>{Math.round(stats.outboundCount).toLocaleString('th-TH', { maximumFractionDigits: 0 })} ธุรกรรม</span>
              </p>
            </div>

            {/* Card T7: Net Quantity (In - Out) */}
            <div 
              className="kpi-card info" 
              style={{ cursor: 'pointer', width: '100%', marginBottom: 0 }}
              onClick={() => handleOpenDrilldown('turnover_kpi_net', 'net', 'ผลต่างการรับเข้า-จ่ายออกสุทธิรายสินค้า – Net Quantity Details')}
            >
              <div className="kpi-card-header">
                <span className="kpi-title" style={{ fontWeight: 600, color: 'var(--text)' }}>จำนวนสุทธิ</span>
                <div className="card-icon-wrapper" style={{ color: 'var(--info)', backgroundColor: 'transparent', border: 'none', padding: 0 }}>
                  <ArrowUpDown style={{ width: '24px', height: '24px', strokeWidth: 2.5 }} />
                </div>
              </div>
              <div className="kpi-value-container">
                <div className="kpi-value">{(stats.netChange >= 0 ? '+' : '') + Math.round(stats.netChange).toLocaleString('th-TH', { maximumFractionDigits: 0 })}</div>
              </div>
              <p className="kpi-subtext" style={{ marginTop: '4px', lineHeight: 1.4, borderTop: '1px solid var(--border)', paddingTop: '4px' }}>ผลต่างจำนวนสินค้า เข้า - ออก</p>
            </div>
          </div>

          {/* Right: Monthly Chart */}
          <div className="chart-card" style={{ flex: 1, minWidth: '350px' }}>
            <div className="chart-header">
              <div className="chart-title">
                <TrendingUp style={{ color: 'var(--accent)', width: '20px', height: '20px' }} />
                <span>เปรียบเทียบปริมาณรายเดือน: เข้า - ออก</span>
              </div>
            </div>
            <div className="chart-body" style={{ display: 'block', width: '100%' }}>
              <Chart 
                key={`turnover-monthly-${monthlyChartData.months.length}`}
                width="100%" 
                options={{
                  chart: {
                    type: 'line',
                    toolbar: { show: false },
                    animations: {
                      enabled: true,
                      easing: 'easeinout',
                      speed: 1200,
                      animateGradually: { enabled: true, delay: 150 },
                      dynamicAnimation: { enabled: true, speed: 1200 }
                    },
                    events: {
                      markerClick: (e, chartCtx, config) => {
                        const mIdx = config.dataPointIndex;
                        const month = monthlyChartData.months[mIdx];
                        if (month) {
                          handleOpenDrilldown('turnover_monthly', { month, direction: 'สุทธิ' }, `ความเคลื่อนไหวเดือน ${formatMonthYearThaiLong(month)} - Turnover Details`);
                        }
                      }
                    }
                  },
                  colors: ['#22c55e', '#ef4444'],
                  stroke: { width: 3, curve: 'smooth' },
                  markers: { size: 3, strokeWidth: 0, hover: { size: 5 } },
                  xaxis: {
                    categories: monthlyChartData.months.map(formatMonthYearThai),
                    labels: { style: { colors: 'var(--secondary)' } }
                  },
                  yaxis: {
                    labels: {
                      formatter: (val) => val.toLocaleString() + ' ชิ้น',
                      style: { colors: 'var(--secondary)' }
                    }
                  },
                  grid: { borderColor: 'var(--border)', strokeDashArray: 4 },
                  tooltip: {
                    custom: function({series, _seriesIndex, dataPointIndex, _w}) {
                      const month = monthlyChartData.months[dataPointIndex];
                      const inVal = series[0][dataPointIndex] || 0;
                      const outVal = series[1][dataPointIndex] || 0;
                      const net = inVal - outVal;
                      return `
                        <div class="custom-chart-tooltip">
                          <div class="tooltip-header">เดือน ${formatMonthYearThaiLong(month)}</div>
                          <div class="tooltip-body">
                            <div><strong>เข้า (In):</strong> ${Math.round(inVal).toLocaleString()} ชิ้น</div>
                            <div><strong>ออก (Out):</strong> ${Math.round(outVal).toLocaleString()} ชิ้น</div>
                            <div><strong>สุทธิ (Net):</strong> <span style="font-weight:700; color:${net >= 0 ? '#16a34a' : '#dc2626'}">${net >= 0 ? '+' : ''}${Math.round(net).toLocaleString()} ชิ้น</span></div>
                          </div>
                        </div>
                      `;
                    }
                  }
                }}
                series={monthlyAnimatedSeries.length > 0 ? monthlyAnimatedSeries : [{ name: 'Qty In (เข้า)', data: [] }, { name: 'Qty Out (ออก)', data: [] }]}
                type="line"
                height={350}
              />
            </div>
          </div>
        </div>

        {/* Row 2: Yearly Comparison: Qty by Direction (Full Width) */}
        <div className="charts-row-full">
          <div className="chart-card">
            <div className="chart-header">
              <div className="chart-title">
                <BarChart2 style={{ color: 'var(--info)', width: '20px', height: '20px' }} />
                <span>เปรียบเทียบปริมาณรายปี: ตามทิศทาง</span>
              </div>
            </div>
            <div className="chart-body" style={{ display: 'block', width: '100%' }}>
              <Chart 
                key={`turnover-yearly-${yearlyChartData.years.length}`}
                width="100%" 
                options={{
                  chart: {
                    type: 'bar',
                    toolbar: { show: false },
                    animations: {
                      enabled: true,
                      easing: 'easeinout',
                      speed: 1200,
                      animateGradually: { enabled: true, delay: 150 },
                      dynamicAnimation: { enabled: true, speed: 1200 }
                    },
                    events: {
                      dataPointSelection: (e, chartCtx, config) => {
                        const mIdx = config.dataPointIndex;
                        const sIdx = config.seriesIndex;
                        const year = yearlyChartData.years[mIdx];
                        const dir = sIdx === 0 ? 'In' : 'Out';
                        if (year) {
                          handleOpenDrilldown('turnover_yearly', `${year}|${dir}`, `เจาะลึกข้อมูลปี ${year} [ทิศทาง: ${dir === 'In' ? 'เข้า' : 'ออก'}]`);
                        }
                      }
                    }
                  },
                  plotOptions: {
                    bar: { 
                      borderRadius: 4, 
                      columnWidth: '55%',
                      dataLabels: { position: 'top' }
                    }
                  },
                  dataLabels: {
                    enabled: true,
                    style: {
                      colors: ['#4b5563'],
                      fontSize: '11px',
                      fontWeight: 600
                    },
                    offsetY: -20,
                    formatter: (val) => formatIntegerMk(val)
                  },
                  colors: ['#22c55e', '#ef4444'],
                  xaxis: {
                    categories: yearlyChartData.years.map(y => `ปี ${y}`),
                    labels: { style: { colors: 'var(--secondary)', fontWeight: 600 } }
                  },
                  yaxis: {
                    labels: {
                      formatter: (val) => val.toLocaleString() + ' ชิ้น',
                      style: { colors: 'var(--secondary)' }
                    }
                  },
                  grid: { borderColor: 'var(--border)', strokeDashArray: 4 },
                  tooltip: {
                    custom: function({series, _seriesIndex, dataPointIndex, _w}) {
                      const year = yearlyChartData.years[dataPointIndex];
                      const inVal = series[0][dataPointIndex] || 0;
                      const outVal = series[1][dataPointIndex] || 0;
                      return `
                        <div class="custom-chart-tooltip">
                          <div class="tooltip-header">ปี ${year}</div>
                          <div class="tooltip-body">
                            <div><strong>เข้า (In):</strong> ${Math.round(inVal).toLocaleString()} ชิ้น</div>
                            <div><strong>ออก (Out):</strong> ${Math.round(outVal).toLocaleString()} ชิ้น</div>
                          </div>
                        </div>
                      `;
                    }
                  }
                }}
                series={yearlyAnimatedSeries.length > 0 ? yearlyAnimatedSeries : [{ name: 'Qty In (เข้า)', data: [] }, { name: 'Qty Out (ออก)', data: [] }]}
                type="bar"
                height={350}
              />
            </div>
          </div>
        </div>

        {/* Row 3: Day of Week and Top 10 Products by Quantity split 50/50 */}
        <div className="charts-row-half">
          {/* Chart C: Qty Volume by Day of Week */}
          <div className="chart-card">
            <div className="chart-header">
              <div className="chart-title">
                <Calendar style={{ color: 'var(--warning)', width: '20px', height: '20px' }} />
                <span>ปริมาณต่อวันในสัปดาห์</span>
              </div>
            </div>
            <div className="chart-body" style={{ display: 'block', width: '100%' }}>
              <Chart 
                key={`turnover-dow-${dowChartData.categories.length}`}
                width="100%" 
                options={{
                  chart: {
                    type: 'bar',
                    toolbar: { show: false },
                    animations: {
                      enabled: true,
                      easing: 'easeinout',
                      speed: 1200,
                      animateGradually: { enabled: true, delay: 150 },
                      dynamicAnimation: { enabled: true, speed: 1200 }
                    },
                    events: {
                      dataPointSelection: (e, chartCtx, config) => {
                        const mIdx = config.dataPointIndex;
                        const sIdx = config.seriesIndex;
                        const dir = sIdx === 0 ? 'In' : 'Out';
                        if (mIdx !== undefined) {
                          handleOpenDrilldown('turnover_dow', `${mIdx}|${dir}`, `เจาะลึกประวัติธุรกรรมประจำวันในสัปดาห์ [ทิศทาง: ${dir === 'In' ? 'เข้า' : 'ออก'}]`);
                        }
                      }
                    }
                  },
                  plotOptions: {
                    bar: { 
                      borderRadius: 4, 
                      columnWidth: '55%',
                      dataLabels: { position: 'top' }
                    }
                  },
                  dataLabels: {
                    enabled: true,
                    style: {
                      colors: ['#4b5563'],
                      fontSize: '11px',
                      fontWeight: 600
                    },
                    offsetY: -20,
                    formatter: (val) => formatIntegerMk(val)
                  },
                  colors: ['#22c55e', '#ef4444'],
                  xaxis: {
                    categories: dowChartData.categories,
                    labels: { style: { colors: 'var(--secondary)', fontWeight: 600 } }
                  },
                  yaxis: {
                    labels: {
                      formatter: (val) => val.toLocaleString() + ' ชิ้น',
                      style: { colors: 'var(--secondary)' }
                    }
                  },
                  grid: { borderColor: 'var(--border)', strokeDashArray: 4 },
                  tooltip: {
                    custom: function({series, _seriesIndex, dataPointIndex, _w}) {
                      const dow = dowChartData.categories[dataPointIndex];
                      const inVal = series[0][dataPointIndex] || 0;
                      const outVal = series[1][dataPointIndex] || 0;
                      return `
                        <div class="custom-chart-tooltip">
                          <div class="tooltip-header">วัน${dow}</div>
                          <div class="tooltip-body">
                            <div><strong>เข้า (In):</strong> ${Math.round(inVal).toLocaleString()} ชิ้น</div>
                            <div><strong>ออก (Out):</strong> ${Math.round(outVal).toLocaleString()} ชิ้น</div>
                          </div>
                        </div>
                      `;
                    }
                  }
                }}
                series={dowAnimatedSeries.length > 0 ? dowAnimatedSeries : [{ name: 'Qty In (เข้า)', data: [] }, { name: 'Qty Out (ออก)', data: [] }]}
                type="bar"
                height={350}
              />
            </div>
          </div>

          {/* Chart D: Top 10 Products by Quantity */}
          <div className="chart-card">
            <div className="chart-header">
              <div className="chart-title">
                <Package style={{ color: 'var(--danger)', width: '20px', height: '20px' }} />
                <span>10 อันดับสินค้าที่มียอดรวมปริมาณความเคลื่อนไหวมากที่สุด</span>
              </div>
            </div>
            <div className="chart-body" style={{ display: 'block', width: '100%' }}>
              <Chart 
                key={`turnover-top-prods-${topProductsChartData.categories.length}`}
                width="100%" 
                options={{
                  chart: {
                    type: 'bar',
                    toolbar: { show: false },
                    animations: {
                      enabled: true,
                      easing: 'easeinout',
                      speed: 1200,
                      animateGradually: { enabled: true, delay: 150 },
                      dynamicAnimation: { enabled: true, speed: 1200 }
                    },
                    events: {
                      dataPointSelection: (e, chartCtx, config) => {
                        const idx = config.dataPointIndex;
                        if (idx !== undefined) {
                          const name = topProductsChartData.fullCategories ? topProductsChartData.fullCategories[idx] : topProductsChartData.categories[idx];
                          if (name) {
                            handleOpenDrilldown('turnover_product', name, `เจาะลึกธุรกรรมสินค้า: ${name}`);
                          }
                        }
                      }
                    }
                  },
                  legend: { show: false },
                  plotOptions: {
                    bar: {
                      horizontal: true,
                      borderRadius: 4,
                      barHeight: '70%',
                      distributed: true,
                      dataLabels: { position: 'top' }
                    }
                  },
                  dataLabels: {
                    enabled: true,
                    textAnchor: 'start',
                    formatter: (val) => formatIntegerMk(val),
                    style: {
                      colors: ['#4b5563'],
                      fontSize: '12px',
                      fontWeight: 700
                    },
                    offsetX: 10
                  },
                  colors: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#0ea5e9', '#0d9488'],
                  stroke: { show: false, width: 0 },
                  xaxis: {
                    categories: topProductsChartData.categories,
                    labels: {
                      formatter: (val) => formatIntegerMk(val) + ' ชิ้น',
                      style: { colors: 'var(--secondary)', fontSize: '12px' }
                    }
                  },
                  yaxis: {
                    labels: {
                      maxWidth: 280,
                      style: { colors: '#0f172a', fontWeight: 400, fontSize: '12px' }
                    }
                  },
                  grid: { borderColor: 'var(--border)', strokeDashArray: 4, padding: { right: 65, left: 10 } },
                  tooltip: {
                    custom: function({series, seriesIndex, dataPointIndex, _w}) {
                      const name = topProductsChartData.fullCategories ? topProductsChartData.fullCategories[dataPointIndex] : topProductsChartData.categories[dataPointIndex];
                      const val = series[seriesIndex][dataPointIndex] || 0;
                      return `
                        <div class="custom-chart-tooltip">
                          <div class="tooltip-header">${name}</div>
                          <div class="tooltip-body">
                            <div><strong>ปริมาณความเคลื่อนไหวรวม:</strong> ${Math.round(val).toLocaleString()} ชิ้น</div>
                          </div>
                        </div>
                      `;
                    }
                  }
                }}
                series={topProductsAnimatedSeries.length > 0 ? topProductsAnimatedSeries : [{ name: 'ยอดโอนย้ายสะสม', data: [] }]}
                type="bar"
                height={340}
              />
            </div>
          </div>
        </div>

        {/* Warehouses Inbound/Outbound Section Header */}
        <div style={{ borderBottom: '2px solid var(--accent)', paddingBottom: '8px', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Home style={{ width: '20px', height: '20px' }} />
            <span>สินค้าเข้าคลัง และ สินค้าออกคลัง (แยกตามคลังสินค้า)</span>
          </h3>
        </div>

        <div className="charts-row-half">
          {/* Chart E: 10 อันดับคลังสินค้าที่มีสินค้าเข้ามากที่สุด */}
          <div className="chart-card">
            <div className="chart-header">
              <div className="chart-title">
                <LogIn style={{ color: 'var(--accent)', width: '20px', height: '20px' }} />
                <span>10 อันดับคลังสินค้าที่มีสินค้าเข้ามากที่สุด</span>
              </div>
            </div>
            <div className="chart-body" style={{ display: 'block', width: '100%' }}>
              <Chart 
                key={`turnover-in-wh-${transfersChartData.inboundDest.length}`}
                width="100%" 
                options={{
                  chart: {
                    type: 'bar',
                    toolbar: { show: false },
                    animations: {
                      enabled: true,
                      easing: 'easeinout',
                      speed: 1200,
                      animateGradually: { enabled: true, delay: 150 },
                      dynamicAnimation: { enabled: true, speed: 1200 }
                    },
                    events: {
                      dataPointSelection: (e, chartCtx, config) => {
                        const idx = config.dataPointIndex;
                        if (idx !== undefined && transfersChartData.inboundDest[idx]) {
                          const name = transfersChartData.inboundDest[idx].name;
                          handleOpenDrilldown('turnover_warehouse_in_dest', name, `เจาะลึกสินค้าเข้ารับปลายทางคลัง: ${name}`);
                        }
                      }
                    }
                  },
                  legend: { show: false },
                  plotOptions: {
                    bar: {
                      horizontal: true,
                      borderRadius: 4,
                      distributed: true,
                      dataLabels: { position: 'top' }
                    }
                  },
                  dataLabels: {
                    enabled: true,
                    textAnchor: 'start',
                    formatter: (val) => formatIntegerMk(val),
                    style: {
                      colors: ['#4b5563'],
                      fontSize: '11px',
                      fontWeight: 600
                    },
                    offsetX: 10
                  },
                  colors: ['#2563eb', '#3b82f6', '#0284c7', '#0ea5e9', '#06b6d4', '#0d9488', '#10b981', '#16a34a', '#4f46e5', '#6366f1'],
                  stroke: { show: false, width: 0 },
                  xaxis: {
                    categories: transfersChartData.inboundDest.map(d => d.name),
                    labels: { formatter: (val) => formatIntegerMk(val) + ' ชิ้น', style: { colors: 'var(--secondary)', fontSize: '12px' } }
                  },
                  yaxis: {
                    labels: {
                      maxWidth: 220,
                      style: { colors: 'var(--text)', fontWeight: 500, fontSize: '12px' }
                    }
                  },
                  grid: { borderColor: 'var(--border)', strokeDashArray: 4, padding: { right: 50, left: 10 } }
                }}
                series={inboundDestAnimatedSeries.length > 0 ? inboundDestAnimatedSeries : [{ name: 'ปริมาณสินค้าเข้า', data: [] }]}
                type="bar"
                height={350}
              />
            </div>
          </div>

          {/* Chart G: 10 อันดับคลังสินค้าที่มีสินค้าออกมากที่สุด */}
          <div className="chart-card">
            <div className="chart-header">
              <div className="chart-title">
                <LogOut style={{ color: 'var(--warning)', width: '20px', height: '20px' }} />
                <span>10 อันดับคลังสินค้าที่มีสินค้าออกมากที่สุด</span>
              </div>
            </div>
            <div className="chart-body" style={{ display: 'block', width: '100%' }}>
              <Chart 
                key={`turnover-out-wh-${transfersChartData.outboundSrc.length}`}
                width="100%" 
                options={{
                  chart: {
                    type: 'bar',
                    toolbar: { show: false },
                    animations: {
                      enabled: true,
                      easing: 'easeinout',
                      speed: 1200,
                      animateGradually: { enabled: true, delay: 150 },
                      dynamicAnimation: { enabled: true, speed: 1200 }
                    },
                    events: {
                      dataPointSelection: (e, chartCtx, config) => {
                        const idx = config.dataPointIndex;
                        if (idx !== undefined && transfersChartData.outboundSrc[idx]) {
                          const name = transfersChartData.outboundSrc[idx].name;
                          handleOpenDrilldown('turnover_warehouse_out_src', name, `เจาะลึกสินค้าออกจ่ายจากคลังต้นทาง: ${name}`);
                        }
                      }
                    }
                  },
                  legend: { show: false },
                  plotOptions: {
                    bar: {
                      horizontal: true,
                      borderRadius: 4,
                      distributed: true,
                      dataLabels: { position: 'top' }
                    }
                  },
                  dataLabels: {
                    enabled: true,
                    textAnchor: 'start',
                    formatter: (val) => formatIntegerMk(val),
                    style: {
                      colors: ['#4b5563'],
                      fontSize: '11px',
                      fontWeight: 600
                    },
                    offsetX: 10
                  },
                  colors: ['#ea580c', '#f97316', '#fb923c', '#d97706', '#f59e0b', '#e11d48', '#f43f5e', '#ef4444', '#dc2626', '#b91c1c'],
                  stroke: { show: false, width: 0 },
                  xaxis: {
                    categories: transfersChartData.outboundSrc.map(d => d.name),
                    labels: { formatter: (val) => formatIntegerMk(val) + ' ชิ้น', style: { colors: 'var(--secondary)', fontSize: '12px' } }
                  },
                  yaxis: {
                    labels: {
                      maxWidth: 220,
                      style: { colors: 'var(--text)', fontWeight: 500, fontSize: '12px' }
                    }
                  },
                  grid: { borderColor: 'var(--border)', strokeDashArray: 4, padding: { right: 50, left: 10 } }
                }}
                series={outboundSrcAnimatedSeries.length > 0 ? outboundSrcAnimatedSeries : [{ name: 'ปริมาณสินค้าออก', data: [] }]}
                type="bar"
                height={350}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Transaction table */}
      <section className="table-card">
        <div className="table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <h2 className="table-title">{tableTitle}</h2>
          
          <div className="table-actions" style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Dropdown selectors for Day, Month, Year in front of tabs */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {/* Day Dropdown */}
              <select
                value={tableDayFilter}
                onChange={(e) => setTableDayFilter(e.target.value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--card-bg)',
                  color: 'var(--text)',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  minWidth: '85px'
                }}
              >
                <option value="All">ทุกวัน</option>
                {Array.from({ length: 31 }, (_, i) => (i + 1).toString()).map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>

              {/* Month Dropdown */}
              <select
                value={tableMonthFilter}
                onChange={(e) => setTableMonthFilter(e.target.value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--card-bg)',
                  color: 'var(--text)',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  minWidth: '120px'
                }}
              >
                <option value="All">ทุกเดือน</option>
                {[
                  { id: '01', label: 'มกราคม' },
                  { id: '02', label: 'กุมภาพันธ์' },
                  { id: '03', label: 'มีนาคม' },
                  { id: '04', label: 'เมษายน' },
                  { id: '05', label: 'พฤษภาคม' },
                  { id: '06', label: 'มิถุนายน' },
                  { id: '07', label: 'กรกฎาคม' },
                  { id: '08', label: 'สิงหาคม' },
                  { id: '09', label: 'กันยายน' },
                  { id: '10', label: 'ตุลาคม' },
                  { id: '11', label: 'พฤศจิกายน' },
                  { id: '12', label: 'ธันวาคม' }
                ].map(m => (
                  <option key={m.id} value={m.id}>{m.label} ({m.id})</option>
                ))}
              </select>

              {/* Year Dropdown */}
              <select
                value={tableYearFilter}
                onChange={(e) => setTableYearFilter(e.target.value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--card-bg)',
                  color: 'var(--text)',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  minWidth: '85px'
                }}
              >
                <option value="All">ทุกปี</option>
                {availableYears.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {/* Direction Filter Button group inside table-actions */}
            <div className="table-qty-tabs">
              <button 
                type="button" 
                className={`tab-btn-qty ${directionFilter === 'All' ? 'active' : ''}`}
                onClick={() => setDirectionFilter('All')}
              >
                ทั้งหมด
              </button>
              <button 
                type="button" 
                className={`tab-btn-qty ${directionFilter === 'In' ? 'active' : ''}`}
                onClick={() => setDirectionFilter('In')}
              >
                รับเข้า
              </button>
              <button 
                type="button" 
                className={`tab-btn-qty ${directionFilter === 'Out' ? 'active' : ''}`}
                onClick={() => setDirectionFilter('Out')}
              >
                จ่ายออก
              </button>
            </div>

            <div className="search-container" style={{ display: 'flex', alignItems: 'center', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: '4px', padding: '4px 8px', gap: '6px' }}>
              <Search size={16} style={{ color: 'var(--text-muted)' }} />
              <input 
                type="text" 
                placeholder="ค้นหาบิล, รหัสสินค้า, คลัง..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ background: 'none', border: 'none', color: 'inherit', outline: 'none', fontSize: '0.85rem' }}
              />
            </div>
          </div>
        </div>

        <ResponsiveTable 
          headers={tableHeaders}
          rows={searchedTableRows}
          itemsPerPage={10}
        />
      </section>

      {/* Drilldown Modal popup */}
      <DrilldownModal 
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setDrilldownType(null);
          setDrilldownKey(null);
          setDrilldownHistory([]);
        }}
        title={drilldownData.title || drilldownTitle}
        summaryItems={drilldownData.summary}
        headers={drilldownData.headers}
        rows={drilldownData.rows}
        filename={`${(drilldownData.title || drilldownTitle).replace(/\s+/g, '_')}.xlsx`}
        filterBar={modalFilterBar}
        onRowClick={handleModalRowClick}
        onBack={drilldownHistory.length > 0 ? popDrilldown : null}
        disablePills={drilldownDisablePills}
      />
    </div>
  );
}
