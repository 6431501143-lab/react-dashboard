import React, { useState, useMemo, useEffect } from 'react';
import Chart from 'react-apexcharts';
import KpiCard from '../components/KpiCard';
import ResponsiveTable from '../components/ResponsiveTable';
import ApexDonut from '../components/ApexDonut';
import DrilldownModal from '../components/DrilldownModal';
import { 
  Package, 
  ListOrdered, 
  List, 
  Home, 
  Search, 
  TrendingUp, 
  BarChartHorizontal, 
  PieChart, 
  BarChart2
} from 'lucide-react';
import { formatDateToDDMMYY, cleanProductCode } from '../utils/helpers';

export default function DispatchTab({ 
  dispatchData = {}, 
  selectedWarehouses = [], 
  selectedProducts = [],
  startDate,
  endDate
}) {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Dynamic Animation Series States
  const [monthlyAnimatedSeries, setMonthlyAnimatedSeries] = useState([]);
  const [topProductsAnimatedSeries, setTopProductsAnimatedSeries] = useState([]);
  const [topDestinationsAnimatedSeries, setTopDestinationsAnimatedSeries] = useState([]);
  const [yoyAnimatedSeries, setYoyAnimatedSeries] = useState([]);

  // Drilldown modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [drilldownType, setDrilldownType] = useState('');
  const [drilldownKey, setDrilldownKey] = useState('');
  const [modalTitle, setModalTitle] = useState('');
  const [activeYoYYear, setActiveYoYYear] = useState('All');

  // Normalize dispatchData whether provided as structured object or flat row array
  const normalizedData = useMemo(() => {
    if (Array.isArray(dispatchData)) {
      const pMap = new Map();
      const dMap = new Map();
      const dpMap = new Map();
      const pList = [];
      const dList = [];
      const dpList = [];
      const txs = [];

      dispatchData.forEach(row => {
        const rawDate = row.date || row.วันที่ || row.Date || '';
        const dateStr = String(rawDate).split('T')[0];
        const itemId = String(row.item_id || row.code || row.รหัสสินค้า || row.รหัส || '').trim();
        const itemName = String(row.name || row.item_name || row.ชื่อสินค้า || row.ชื่อสามัญ || itemId || 'ไม่ระบุชื่อสินค้า').trim();
        const destWh = String(row.destination || row.warehouse || row.dest_wh || row.คลังปลายทาง || row.คลัง || 'ไม่ระบุคลัง').trim();
        const dept = String(row.department || row.dept || row.แผนก || row.หน่วยงาน || 'ไม่ระบุแผนก').trim();
        const qty = Math.abs(parseFloat(row.qty || row.quantity || row.จำนวน || 0)) || 0;

        const finalItemId = itemId || itemName;
        if (!pMap.has(finalItemId)) {
          pMap.set(finalItemId, pList.length);
          pList.push([finalItemId, itemName]);
        }
        const pIdx = pMap.get(finalItemId);

        if (!dMap.has(destWh)) {
          dMap.set(destWh, dList.length);
          dList.push(destWh);
        }
        const destIdx = dMap.get(destWh);

        if (!dpMap.has(dept)) {
          dpMap.set(dept, dpList.length);
          dpList.push(dept);
        }
        const deptIdx = dpMap.get(dept);

        txs.push([dateStr, pIdx, destIdx, deptIdx, qty]);
      });

      return {
        products: pList,
        destinations: dList,
        departments: dpList,
        transactions: txs
      };
    }

    return dispatchData || { products: [], destinations: [], departments: [], transactions: [] };
  }, [dispatchData]);

  const { products = [], destinations = [], departments = [], transactions = [] } = normalizedData;

  // Safe Lookups that prevent "Unknown" errors
  const getProductInfo = (prodRef) => {
    if (prodRef === undefined || prodRef === null) return { code: '-', name: 'ไม่ระบุ' };
    if (typeof prodRef === 'number') {
      const p = products[prodRef];
      if (p) return { code: cleanProductCode(p[0]) || '-', name: p[1] || '-' };
    }
    if (typeof prodRef === 'string') {
      const num = parseInt(prodRef, 10);
      if (!isNaN(num) && String(num) === prodRef && products[num]) {
        return { code: cleanProductCode(products[num][0]) || '-', name: products[num][1] || '-' };
      }
      return { code: cleanProductCode(prodRef), name: prodRef };
    }
    return { code: '-', name: 'ไม่ระบุ' };
  };

  const getDestinationName = (destRef) => {
    if (destRef === undefined || destRef === null) return 'ไม่ระบุคลัง';
    if (typeof destRef === 'number') return destinations[destRef] || 'ไม่ระบุคลัง';
    if (typeof destRef === 'string') {
      const num = parseInt(destRef, 10);
      if (!isNaN(num) && String(num) === destRef && destinations[num]) return destinations[num];
      return destRef;
    }
    return 'ไม่ระบุคลัง';
  };

  const getDepartmentName = (deptRef) => {
    if (deptRef === undefined || deptRef === null) return 'ไม่ระบุแผนก';
    if (typeof deptRef === 'number') return departments[deptRef] || 'ไม่ระบุแผนก';
    if (typeof deptRef === 'string') {
      const num = parseInt(deptRef, 10);
      if (!isNaN(num) && String(num) === deptRef && departments[num]) return departments[num];
      return deptRef;
    }
    return 'ไม่ระบุแผนก';
  };

  const startStr = useMemo(() => {
    if (!startDate) return '';
    const y = startDate.getFullYear();
    const m = String(startDate.getMonth() + 1).padStart(2, '0');
    const d = String(startDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [startDate]);

  const endStr = useMemo(() => {
    if (!endDate) return '';
    const y = endDate.getFullYear();
    const m = String(endDate.getMonth() + 1).padStart(2, '0');
    const d = String(endDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [endDate]);

  // 1. Filtered Dataset
  const filteredDataset = useMemo(() => {
    return transactions.filter(row => {
      // row: [date_str, prod_idx, dest_idx, dept_idx, qty]
      
      // Warehouse Filter (mapped to Destinations)
      const destWh = getDestinationName(row[2]);
      if (selectedWarehouses.length > 0 && !selectedWarehouses.includes(destWh)) return false;

      // Product Filter
      const prodCode = getProductInfo(row[1]).code;
      if (selectedProducts.length > 0 && !selectedProducts.includes(prodCode)) return false;

      // Date Range Filter
      if (startStr && row[0] < startStr) return false;
      if (endStr && row[0] > endStr) return false;

      return true;
    });
  }, [transactions, destinations, products, selectedWarehouses, selectedProducts, startStr, endStr]);

  // Searched Table rows
  const searchedTableRows = useMemo(() => {
    if (!searchTerm.trim()) return filteredDataset;
    const term = searchTerm.toLowerCase().trim();
    return filteredDataset.filter(row => {
      const prod = getProductInfo(row[1]);
      const dest = getDestinationName(row[2]).toLowerCase();
      const dept = getDepartmentName(row[3]).toLowerCase();
      return prod.code.toLowerCase().includes(term) || prod.name.toLowerCase().includes(term) || dest.includes(term) || dept.includes(term);
    });
  }, [filteredDataset, products, destinations, departments, searchTerm]);

  // 2. Compute KPIs
  const stats = useMemo(() => {
    const totalQty = filteredDataset.reduce((sum, r) => sum + (r[4] || 0), 0);
    const uniqueProdsCount = new Set(filteredDataset.map(r => r[1])).size;
    const totalTransactions = filteredDataset.length;
    const uniqueDestsCount = new Set(filteredDataset.map(r => r[2])).size;

    return {
      totalQty,
      uniqueProdsCount,
      totalTransactions,
      uniqueDestsCount
    };
  }, [filteredDataset]);

  // Monthly Line chart trend
  const monthlyChartData = useMemo(() => {
    const monthlyMap = {};
    filteredDataset.forEach(row => {
      const month = row[0].substring(0, 7); // YYYY-MM
      if (!monthlyMap[month]) {
        monthlyMap[month] = { qty: 0, count: 0 };
      }
      monthlyMap[month].qty += (row[4] || 0);
      monthlyMap[month].count += 1;
    });

    const sortedMonths = Object.keys(monthlyMap).sort();
    const thaiMonthsShort = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    const categories = sortedMonths.map(m => {
      const [y, mm] = m.split('-');
      return `${thaiMonthsShort[parseInt(mm) - 1]} ${y.substring(2)}`;
    });

    return {
      months: sortedMonths,
      categories,
      values: sortedMonths.map(m => Math.round(monthlyMap[m].qty)),
      fullMap: monthlyMap
    };
  }, [filteredDataset]);

  // Top 15 Products by quantity
  const topProductsChartData = useMemo(() => {
    const productQtyMap = {};
    filteredDataset.forEach(row => {
      const prodIdx = row[1];
      if (!productQtyMap[prodIdx]) productQtyMap[prodIdx] = 0;
      productQtyMap[prodIdx] += (row[4] || 0);
    });

    const sorted = Object.keys(productQtyMap)
      .map(idx => ({ idx: parseInt(idx), qty: productQtyMap[idx] }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 15);

    const categories = sorted.map(d => {
      const prod = getProductInfo(d.idx);
      const name = prod.name;
      const code = prod.code;
      return name.length > 25 ? `${name.substring(0, 25)}... (${code})` : `${name} (${code})`;
    });

    return {
      categories,
      values: sorted.map(d => Math.round(d.qty)),
      fullList: sorted
    };
  }, [filteredDataset, products]);

  // Top 15 Destinations by quantity
  const topDestinationsChartData = useMemo(() => {
    const destQtyMap = {};
    const destCountMap = {};
    filteredDataset.forEach(row => {
      const destIdx = row[2];
      if (!destQtyMap[destIdx]) {
        destQtyMap[destIdx] = 0;
        destCountMap[destIdx] = 0;
      }
      destQtyMap[destIdx] += (row[4] || 0);
      destCountMap[destIdx] += 1;
    });

    const sorted = Object.keys(destQtyMap)
      .map(idx => ({ idx: parseInt(idx), qty: destQtyMap[idx], count: destCountMap[idx] }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 15);

    return {
      categories: sorted.map(d => getDestinationName(d.idx)),
      values: sorted.map(d => Math.round(d.qty)),
      fullList: sorted
    };
  }, [filteredDataset, destinations]);

  // Department Donut chart
  const departmentDonutData = useMemo(() => {
    const deptQtyMap = {};
    filteredDataset.forEach(row => {
      const deptIdx = row[3];
      if (!deptQtyMap[deptIdx]) deptQtyMap[deptIdx] = 0;
      deptQtyMap[deptIdx] += (row[4] || 0);
    });

    const sorted = Object.keys(deptQtyMap)
      .map(idx => ({ idx: parseInt(idx), qty: deptQtyMap[idx] }))
      .sort((a, b) => b.qty - a.qty);

    const top10 = sorted.slice(0, 10);
    const othersQty = sorted.slice(10).reduce((sum, d) => sum + d.qty, 0);

    const series = top10.map(d => Math.round(d.qty));
    const labels = top10.map(d => getDepartmentName(d.idx));
    
    if (othersQty > 0) {
      series.push(Math.round(othersQty));
      labels.push('แผนกอื่น ๆ (Others)');
    }

    return {
      series,
      labels,
      top10,
      othersQty
    };
  }, [filteredDataset, departments]);

  // YoY Chart data (ทั้งแบบรายเดือน 12 เดือน และแบบเปรียบเทียบยอดรวมรายปี)
  const yoyChartData = useMemo(() => {
    const yearsSet = new Set();
    filteredDataset.forEach(row => {
      const year = row[0].split('-')[0];
      if (year) yearsSet.add(parseInt(year, 10));
    });
    const yearsList = Array.from(yearsSet).sort();

    const yoyGrid = {};
    const yearlyTotals = {};
    yearsList.forEach(yr => {
      yoyGrid[yr] = new Array(12).fill(0);
      yearlyTotals[yr] = 0;
    });

    filteredDataset.forEach(row => {
      const [yrStr, mmStr] = row[0].split('-');
      const yr = parseInt(yrStr, 10);
      const mmIdx = parseInt(mmStr, 10) - 1;
      const qty = row[4] || 0;
      if (yoyGrid[yr] && mmIdx >= 0 && mmIdx < 12) {
        yoyGrid[yr][mmIdx] += qty;
        yearlyTotals[yr] += qty;
      }
    });

    // 1. Monthly Grouped Series
    const monthlySeries = yearsList.map(yr => ({
      name: `ปี ${yr}`,
      data: yoyGrid[yr].map(v => Math.round(v))
    }));

    // 2. Annual Total Bar Chart Data
    const annualCategories = yearsList.map(yr => `ปี ${yr}`);
    const annualValues = yearsList.map(yr => Math.round(yearlyTotals[yr]));
    
    const annualGrowth = yearsList.map((yr, idx) => {
      if (idx === 0) return null;
      const prev = yearlyTotals[yearsList[idx - 1]];
      const curr = yearlyTotals[yr];
      if (prev === 0) return 0;
      return Number((((curr - prev) / prev) * 100).toFixed(1));
    });

    return {
      monthlySeries,
      annualCategories,
      annualValues,
      annualGrowth,
      yearlyTotals,
      yearsList,
      fullGrid: yoyGrid
    };
  }, [filteredDataset]);

  // YoY Years available list for pills filter
  const yoyYearsList = useMemo(() => {
    return yoyChartData.yearsList;
  }, [yoyChartData]);

  // Open detailed drilldown modals
  const handleOpenDrilldown = (type, key, initialTitle, defaultYear = 'All') => {
    setDrilldownType(type);
    setDrilldownKey(key);
    setModalTitle(initialTitle);
    setActiveYoYYear(defaultYear);
    setIsModalOpen(true);
  };

  // 3. Computed Drilldown Rows, Headers and Dynamic Title
  const modalHeaders = useMemo(() => {
    if (drilldownType === 'dispatch_destination' || drilldownType === 'dispatch_products_summary') {
      return [
        { key: 'index', label: 'ลำดับ', style: { width: '80px', minWidth: '60px' } },
        { key: 'code', label: 'รหัสสินค้า', style: { width: '140px', minWidth: '110px' } },
        { key: 'name', label: 'ชื่อสินค้า', style: { whiteSpace: 'normal', minWidth: '240px' } },
        { key: 'qty', label: drilldownType === 'dispatch_destination' ? 'จำนวนที่จ่าย (ชิ้น)' : 'ยอดรวมที่จ่ายออก (ชิ้น)', align: 'right', style: { width: '160px', minWidth: '120px' }, cellRender: (_, val) => val.toLocaleString() }
      ];
    }

    if (drilldownType === 'dispatch_destinations_summary') {
      return [
        { key: 'index', label: 'ลำดับ', style: { width: '80px', minWidth: '60px' } },
        { key: 'dest', label: 'คลังปลายทาง', style: { width: '300px', minWidth: '200px' } },
        { key: 'qty', label: 'ยอดรวมที่ได้รับ (ชิ้น)', align: 'right', style: { width: '160px', minWidth: '120px' }, cellRender: (_, val) => val.toLocaleString() }
      ];
    }

    if (drilldownType === 'dispatch_department' && drilldownKey === 'Others') {
      return [
        { key: 'dept', label: 'หน่วยงาน (Department)', style: { width: '450px', minWidth: '300px' } },
        { key: 'qty', label: 'จำนวนที่จ่าย (ชิ้น)', align: 'right', style: { width: '160px', minWidth: '120px' }, cellRender: (_, val) => val.toLocaleString() }
      ];
    }

    if (drilldownType === 'dispatch_department') {
      return [
        { key: 'code', label: 'รหัสสินค้า', style: { width: '140px', minWidth: '110px' } },
        { key: 'name', label: 'ชื่อสินค้า', style: { whiteSpace: 'normal', width: '380px', minWidth: '240px' } },
        { key: 'qty', label: 'จำนวนที่จ่าย (ชิ้น)', align: 'right', style: { width: '160px', minWidth: '120px' }, cellRender: (_, val) => val.toLocaleString() }
      ];
    }

    if (drilldownType === 'dispatch_product') {
      return [
        { key: 'date', label: 'วันที่จ่าย', style: { width: '120px', minWidth: '100px' }, cellRender: (_, val) => formatDateToDDMMYY(val) },
        { key: 'dest', label: 'คลังปลายทาง', style: { width: '220px', minWidth: '150px' } },
        { key: 'dept', label: 'หน่วยงาน (Department)', style: { width: '220px', minWidth: '150px' } },
        { key: 'qty', label: 'จำนวนที่จ่าย (ชิ้น)', align: 'right', style: { width: '140px', minWidth: '100px' }, cellRender: (_, val) => val.toLocaleString() }
      ];
    }

    // Default table columns (dispatch_all, dispatch_monthly, dispatch_yoy)
    return [
      { key: 'date', label: 'วันที่จ่าย', style: { width: '120px', minWidth: '100px' }, cellRender: (_, val) => formatDateToDDMMYY(val) },
      { key: 'code', label: 'รหัสสินค้า', style: { width: '140px', minWidth: '110px' } },
      { key: 'name', label: 'ชื่อสินค้า', style: { whiteSpace: 'normal', width: '320px', minWidth: '220px' } },
      { key: 'dest', label: 'คลังปลายทาง', style: { width: '200px', minWidth: '150px' } },
      { key: 'dept', label: 'หน่วยงาน (Department)', style: { width: '200px', minWidth: '150px' } },
      { key: 'qty', label: 'จำนวนที่จ่าย (ชิ้น)', align: 'right', style: { width: '140px', minWidth: '100px' }, cellRender: (_, val) => val.toLocaleString() }
    ];
  }, [drilldownType, drilldownKey]);

  const modalRows = useMemo(() => {
    if (!drilldownType) return [];

    let filtered = [];

    // Sort transaction-level logs by date descending (latest date first)
    if (drilldownType === 'dispatch_all') {
      filtered = [...filteredDataset].sort((a, b) => b[0].localeCompare(a[0]));
    } else if (drilldownType === 'dispatch_monthly') {
      filtered = filteredDataset.filter(r => r[0].startsWith(drilldownKey)).sort((a, b) => b[0].localeCompare(a[0]));
    } else if (drilldownType === 'dispatch_yoy') {
      if (drilldownKey === 'All') {
        filtered = filteredDataset;
      } else {
        filtered = filteredDataset.filter(r => r[0].split('-')[1] === drilldownKey);
      }
      if (activeYoYYear !== 'All') {
        filtered = filtered.filter(r => r[0].split('-')[0] === activeYoYYear);
      }
      filtered.sort((a, b) => b[0].localeCompare(a[0]));
    } else if (drilldownType === 'dispatch_product') {
      filtered = filteredDataset.filter(r => r[1] === parseInt(drilldownKey)).sort((a, b) => b[0].localeCompare(a[0]));
    } else if (drilldownType === 'dispatch_destination') {
      filtered = filteredDataset.filter(r => r[2] === parseInt(drilldownKey));
    } else if (drilldownType === 'dispatch_department') {
      if (drilldownKey === 'Others') {
        filtered = filteredDataset;
      } else {
        filtered = filteredDataset.filter(r => r[3] === parseInt(drilldownKey));
      }
    } else if (drilldownType === 'dispatch_products_summary' || drilldownType === 'dispatch_destinations_summary') {
      filtered = filteredDataset;
    }

    // Standard list mapping for transaction details
    if (
      drilldownType === 'dispatch_all' || 
      drilldownType === 'dispatch_monthly' || 
      drilldownType === 'dispatch_yoy'
    ) {
      return filtered.map(r => {
        const prod = getProductInfo(r[1]);
        return {
          date: r[0],
          code: prod.code,
          name: prod.name,
          dest: getDestinationName(r[2]),
          dept: getDepartmentName(r[3]),
          qty: r[4] || 0
        };
      });
    }

    // Product-specific details (Redundant product columns omitted)
    if (drilldownType === 'dispatch_product') {
      return filtered.map(r => ({
        date: r[0],
        dest: getDestinationName(r[2]),
        dept: getDepartmentName(r[3]),
        qty: r[4] || 0
      }));
    }

    // Grouping by product for a single warehouse destination (Top 50)
    if (drilldownType === 'dispatch_destination') {
      const grouped = {};
      filtered.forEach(r => {
        const prodIdx = r[1];
        if (!grouped[prodIdx]) grouped[prodIdx] = 0;
        grouped[prodIdx] += (r[4] || 0);
      });
      const sorted = Object.keys(grouped)
        .map(pIdx => ({ idx: parseInt(pIdx), qty: grouped[pIdx] }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 50);

      return sorted.map((item, i) => {
        const prod = getProductInfo(item.idx);
        return {
          index: i + 1,
          code: prod.code,
          name: prod.name,
          qty: item.qty
        };
      });
    }

    // Grouping for department dispatches
    if (drilldownType === 'dispatch_department') {
      if (drilldownKey === 'Others') {
        const allDeptGrouped = {};
        filtered.forEach(r => {
          if (!allDeptGrouped[r[3]]) allDeptGrouped[r[3]] = 0;
          allDeptGrouped[r[3]] += (r[4] || 0);
        });
        const topDepts = Object.keys(allDeptGrouped)
          .map(d => ({ dIdx: parseInt(d), qty: allDeptGrouped[d] }))
          .sort((a, b) => b.qty - a.qty)
          .slice(0, 10)
          .map(x => x.dIdx);
        const topDeptsSet = new Set(topDepts);

        const grouped = {};
        filtered.forEach(r => {
          if (!topDeptsSet.has(r[3])) {
            if (!grouped[r[3]]) grouped[r[3]] = 0;
            grouped[r[3]] += (r[4] || 0);
          }
        });
        const sorted = Object.keys(grouped)
          .map(dIdx => ({ idx: parseInt(dIdx), qty: grouped[dIdx] }))
          .sort((a, b) => b.qty - a.qty);

        return sorted.map(item => ({
          dept: getDepartmentName(item.idx),
          qty: item.qty
        }));
      } else {
        const grouped = {};
        filtered.forEach(r => {
          const prodIdx = r[1];
          if (!grouped[prodIdx]) grouped[prodIdx] = 0;
          grouped[prodIdx] += (r[4] || 0);
        });
        const sorted = Object.keys(grouped)
          .map(pIdx => ({ idx: parseInt(pIdx), qty: grouped[pIdx] }))
          .sort((a, b) => b.qty - a.qty);

        return sorted.map(item => {
          const prod = getProductInfo(item.idx);
          return {
            code: prod.code,
            name: prod.name,
            qty: item.qty
          };
        });
      }
    }

    // Products aggregate summary
    if (drilldownType === 'dispatch_products_summary') {
      const grouped = {};
      filtered.forEach(r => {
        const prodIdx = r[1];
        if (!grouped[prodIdx]) grouped[prodIdx] = 0;
        grouped[prodIdx] += (r[4] || 0);
      });
      const sorted = Object.keys(grouped)
        .map(pIdx => ({ idx: parseInt(pIdx), qty: grouped[pIdx] }))
        .sort((a, b) => b.qty - a.qty);

      return sorted.map((item, i) => {
        const prod = getProductInfo(item.idx);
        return {
          index: i + 1,
          code: prod.code,
          name: prod.name,
          qty: item.qty
        };
      });
    }

    // Destinations aggregate summary
    if (drilldownType === 'dispatch_destinations_summary') {
      const grouped = {};
      filtered.forEach(r => {
        const destIdx = r[2];
        if (!grouped[destIdx]) grouped[destIdx] = 0;
        grouped[destIdx] += (r[4] || 0);
      });
      const sorted = Object.keys(grouped)
        .map(dIdx => ({ idx: parseInt(dIdx), qty: grouped[dIdx] }))
        .sort((a, b) => b.qty - a.qty);

      return sorted.map((item, i) => ({
        index: i + 1,
        dest: getDestinationName(item.idx),
        qty: item.qty
      }));
    }

    return [];
  }, [drilldownType, drilldownKey, filteredDataset, activeYoYYear, products, destinations, departments]);

  const modalTitleComputed = useMemo(() => {
    if (drilldownType === 'dispatch_yoy') {
      if (drilldownKey === 'All') {
        if (activeYoYYear === 'All') {
          return `การจ่ายสินค้าทั้งหมด (ทุกปี) — Dispatch Details`;
        } else {
          return `การจ่ายสินค้ารวมประจำปี ${activeYoYYear} — Dispatch Details`;
        }
      }
      const monthNamesThai = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
      const monthName = monthNamesThai[parseInt(drilldownKey, 10) - 1] || '';
      if (activeYoYYear === 'All') {
        return `การจ่ายสินค้าเดือน${monthName} (ทุกปี) — Dispatch Details`;
      } else {
        return `การจ่ายสินค้าเดือน${monthName} ปี ${activeYoYYear} — Dispatch Details`;
      }
    }
    return modalTitle;
  }, [drilldownType, drilldownKey, activeYoYYear, modalTitle]);

  const modalSummaryItems = useMemo(() => {
    if (!drilldownType || modalRows.length === 0) return [];
    
    const totalCount = modalRows.length;
    const sumQty = modalRows.reduce((sum, r) => sum + (r.qty || 0), 0);

    if (drilldownType === 'dispatch_all') {
      return [{ label: 'รายละเอียดฟิลเตอร์', value: `ทั้งหมด | จำนวนจ่ายออกรวม: ${sumQty.toLocaleString()} ชิ้น (${totalCount} รายการ)`, color: 'var(--accent)' }];
    }
    if (drilldownType === 'dispatch_monthly') {
      return [{ label: 'รายละเอียดฟิลเตอร์', value: `เดือน: ${drilldownKey} | จำนวนจ่ายออกรวม: ${sumQty.toLocaleString()} ชิ้น (${totalCount} รายการ)`, color: 'var(--accent)' }];
    }
    if (drilldownType === 'dispatch_yoy') {
      const monthNamesThai = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
      const monthName = drilldownKey !== 'All' ? `เดือน: ${monthNamesThai[parseInt(drilldownKey, 10) - 1] || drilldownKey}` : 'ทุกเดือน';
      return [{ label: 'รายละเอียดฟิลเตอร์', value: `${monthName} | ปี: ${activeYoYYear === 'All' ? 'ทุกปี' : activeYoYYear} | จำนวนจ่ายออกรวม: ${sumQty.toLocaleString()} ชิ้น (${totalCount} รายการ)`, color: 'var(--accent)' }];
    }
    if (drilldownType === 'dispatch_product') {
      const prod = getProductInfo(drilldownKey);
      return [{ label: 'รายละเอียดฟิลเตอร์', value: `สินค้า: ${prod.name} | จำนวนจ่ายออกรวม: ${sumQty.toLocaleString()} ชิ้น (${totalCount} รายการ)`, color: 'var(--accent)' }];
    }
    if (drilldownType === 'dispatch_destination') {
      const dest = getDestinationName(drilldownKey);
      return [{ label: 'รายละเอียดฟิลเตอร์', value: `คลังปลายทาง: ${dest} | จำนวนจ่ายออกรวม: ${sumQty.toLocaleString()} ชิ้น (เวชภัณฑ์รวม ${totalCount} รายการ)`, color: 'var(--accent)' }];
    }
    if (drilldownType === 'dispatch_department') {
      const dept = drilldownKey === 'Others' ? 'แผนกอื่น ๆ (Others)' : getDepartmentName(drilldownKey);
      return [{ label: 'รายละเอียดฟิลเตอร์', value: `แผนกเบิก: ${dept} | จำนวนจ่ายออกรวม: ${sumQty.toLocaleString()} ชิ้น (เวชภัณฑ์รวม ${totalCount} รายการ)`, color: 'var(--accent)' }];
    }
    if (drilldownType === 'dispatch_products_summary') {
      return [{ label: 'รายละเอียดฟิลเตอร์', value: `ปริมาณจ่ายสะสมรวม: ${stats.totalQty.toLocaleString()} ชิ้น (เวชภัณฑ์ทั้งหมด ${totalCount} รายการ)`, color: 'var(--accent)' }];
    }
    if (drilldownType === 'dispatch_destinations_summary') {
      return [{ label: 'รายละเอียดฟิลเตอร์', value: `ปริมาณจ่ายสะสมรวม: ${stats.totalQty.toLocaleString()} ชิ้น (คลังสินค้าปลายทางรวม ${totalCount} แห่ง)`, color: 'var(--accent)' }];
    }
    return [];
  }, [drilldownType, drilldownKey, modalRows, activeYoYYear, products, destinations, departments, stats.totalQty]);

  // Trigger dynamic entrance animation for Monthly Line Chart
  useEffect(() => {
    setMonthlyAnimatedSeries([]);
    const timer = setTimeout(() => {
      if (monthlyChartData.values && monthlyChartData.values.length > 0) {
        setMonthlyAnimatedSeries([{
          name: 'ยอดจ่ายรวม',
          data: monthlyChartData.values
        }]);
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [monthlyChartData]);

  // Trigger dynamic entrance animation for Top 15 Products Bar Chart
  useEffect(() => {
    setTopProductsAnimatedSeries([]);
    const timer = setTimeout(() => {
      if (topProductsChartData.values && topProductsChartData.values.length > 0) {
        setTopProductsAnimatedSeries([{
          name: 'จำนวน',
          data: topProductsChartData.values
        }]);
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [topProductsChartData]);

  // Trigger dynamic entrance animation for Top 15 Destinations Bar Chart
  useEffect(() => {
    setTopDestinationsAnimatedSeries([]);
    const timer = setTimeout(() => {
      if (topDestinationsChartData.values && topDestinationsChartData.values.length > 0) {
        setTopDestinationsAnimatedSeries([{
          name: 'จำนวน',
          data: topDestinationsChartData.values
        }]);
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [topDestinationsChartData]);

  // Trigger dynamic entrance animation for YoY Bar Chart
  useEffect(() => {
    setYoyAnimatedSeries([]);
    const timer = setTimeout(() => {
      if (yoyChartData.annualValues && yoyChartData.annualValues.length > 0) {
        setYoyAnimatedSeries([{
          name: 'ยอดจ่ายรวมประจำปี',
          data: yoyChartData.annualValues
        }]);
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [yoyChartData]);

  // Palette colors mapping matching legacy YoY palette
  const dispatchChartPalette = useMemo(() => {
    return ['#6366F1', '#8B5CF6', '#3B82F6', '#0EA5E9', '#14B8A6', '#22C55E', '#FACC15', '#FB923C', '#EF4444', '#EC4899'];
  }, []);

  // Pills selector component for YoY drilldown modal
  const yoyPillsBar = useMemo(() => {
    if (drilldownType !== 'dispatch_yoy') return null;

    return (
      <div className="modal-pills-bar" style={{ display: 'flex', gap: '10px', padding: '8px 0 12px 0', borderBottom: '1px solid var(--border)', marginBottom: '12px', overflowX: 'auto' }}>
        <button
          onClick={() => setActiveYoYYear('All')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            borderRadius: '20px',
            border: activeYoYYear === 'All' ? '1px solid #64748b' : '1px solid var(--border)',
            backgroundColor: activeYoYYear === 'All' ? 'rgba(100, 116, 139, 0.1)' : 'var(--card-bg)',
            color: activeYoYYear === 'All' ? '#64748b' : 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 600,
            transition: 'all 0.2s',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
          }}
        >
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#64748b' }}></span>
          ทุกปี (All)
        </button>
        {yoyYearsList.map((yr, idx) => {
          const color = dispatchChartPalette[idx % 10] || '#64748b';
          const isActive = activeYoYYear === String(yr);
          return (
            <button
              key={yr}
              onClick={() => setActiveYoYYear(String(yr))}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '20px',
                border: isActive ? `1px solid ${color}` : '1px solid var(--border)',
                backgroundColor: isActive ? `${color}15` : 'var(--card-bg)',
                color: isActive ? color : 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600,
                transition: 'all 0.2s',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color }}></span>
              ปี {yr}
            </button>
          );
        })}
      </div>
    );
  }, [drilldownType, activeYoYYear, yoyYearsList, dispatchChartPalette]);

  // Main table column headers
  const tableHeaders = [
    { key: '0', label: 'วันที่', style: { width: '110px', minWidth: '90px' }, cellRender: (row, val) => formatDateToDDMMYY(val || row[0]) },
    { key: '1', label: 'Item ID', style: { width: '130px', minWidth: '110px' }, cellRender: (row, val) => getProductInfo(val !== undefined ? val : row[1]).code },
    { key: '1', label: 'ชื่อสินค้า', style: { whiteSpace: 'normal', width: '320px', minWidth: '220px' }, cellRender: (row, val) => getProductInfo(val !== undefined ? val : row[1]).name },
    { key: '4', label: 'จำนวน', align: 'right', style: { width: '110px', minWidth: '90px' }, cellRender: (row, val) => (val !== undefined && val !== null ? val : row[4] || 0).toLocaleString() },
    { key: '2', label: 'คลังปลายทาง', style: { width: '200px', minWidth: '150px' }, cellRender: (row, val) => getDestinationName(val !== undefined ? val : row[2]) },
    { key: '3', label: 'แผนก', style: { width: '200px', minWidth: '150px' }, cellRender: (row, val) => getDepartmentName(val !== undefined ? val : row[3]) }
  ];

  return (
    <div className="tab-container">
      {/* KPI Cards Row (Qty, SKUs, Transactions, Destinations) */}
      <section className="kpi-row" style={{ marginBottom: '24px' }}>
        <KpiCard 
          title="จำนวนสินค้า"
          value={stats.totalQty.toLocaleString()}
          icon={Package}
          accentClass="info"
          subtext="จำนวนรวมสินค้าที่มีการจ่ายออก"
          onClick={() => handleOpenDrilldown('dispatch_all', 'All', 'รายการจ่ายสินค้าทั้งหมด — Dispatch Transactions')}
        />
        <KpiCard 
          title="จำนวนรายการสินค้า"
          value={stats.uniqueProdsCount.toLocaleString()}
          icon={ListOrdered}
          accentClass="success"
          subtext="จำนวนรายการสินค้าที่มีการจ่ายออก"
          onClick={() => handleOpenDrilldown('dispatch_products_summary', 'All', 'สรุปยอดการจ่ายสินค้าแยกตามประเภทสินค้า — Dispatched Products Summary')}
        />
        <KpiCard 
          title="จำนวนธุรกรรม"
          value={stats.totalTransactions.toLocaleString()}
          icon={List}
          accentClass="warning"
          subtext="จำนวนรายการธุรกรรมทั้งหมด"
          onClick={() => handleOpenDrilldown('dispatch_all', 'All', 'รายการจ่ายสินค้าทั้งหมด — Dispatch Transactions')}
        />
        <KpiCard 
          title="จำนวนคลังสินค้า"
          value={stats.uniqueDestsCount.toLocaleString()}
          icon={Home}
          accentClass="purple"
          subtext="จำนวนคลังสินค้าที่มีการจ่ายออก"
          onClick={() => handleOpenDrilldown('dispatch_destinations_summary', 'All', 'สรุปยอดการจ่ายสินค้าแยกตามคลังปลายทาง — Dispatched Destinations Summary')}
        />
      </section>

      {/* Charts Layout Section */}
      <section className="charts-layout-container" style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '24px' }}>
        
        {/* Row 1: Line chart Monthly Dispatch (Full Width) */}
        <div className="charts-row-full">
          <div className="chart-card" style={{ minHeight: '400px' }}>
            <div className="chart-header">
              <div className="chart-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendingUp style={{ color: 'var(--accent)', width: '20px', height: '20px' }} />
                <span>ยอดรวมปริมาณการจ่ายสินค้าในแต่ละเดือน</span>
              </div>
            </div>
            <div className="chart-body" style={{ display: 'block', width: '100%' }}>
              {monthlyChartData.categories.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '220px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  ไม่มีข้อมูลการจ่ายสินค้าในช่วงเวลาที่เลือก
                </div>
              ) : (
                <Chart 
                  key={`dispatch-monthly-${monthlyChartData.categories.length}`}
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
                        markerClick: (event, chartContext, { dataPointIndex }) => {
                          const monthKey = monthlyChartData.months[dataPointIndex];
                          if (monthKey) {
                            handleOpenDrilldown('dispatch_monthly', monthKey, `การจ่ายสินค้าเดือน ${monthlyChartData.categories[dataPointIndex]} — Dispatch Details`);
                          }
                        }
                      }
                    },
                    stroke: { curve: 'smooth', width: 3 },
                    colors: ['#0d9488'],
                    xaxis: {
                      categories: monthlyChartData.categories,
                      labels: { style: { colors: 'var(--secondary)', fontSize: '11px' } }
                    },
                    yaxis: {
                      labels: {
                        formatter: (val) => val ? val.toLocaleString() : '0',
                        style: { colors: 'var(--secondary)' }
                      }
                    },
                    grid: { borderColor: 'var(--border)', strokeDashArray: 4 },
                    tooltip: {
                      custom: function({series, seriesIndex, dataPointIndex, w}) {
                        const monthKey = monthlyChartData.months[dataPointIndex];
                        const val = series[seriesIndex][dataPointIndex];
                        const count = monthlyChartData.fullMap[monthKey]?.count || 0;
                        return `
                          <div class="custom-chart-tooltip">
                            <div class="tooltip-header">${monthlyChartData.categories[dataPointIndex]}</div>
                            <div class="tooltip-body">
                              <div><strong>ยอดจ่ายรวม:</strong> ${val.toLocaleString()} ชิ้น</div>
                              <div><strong>จำนวนรายการ:</strong> ${count.toLocaleString()} ครั้ง</div>
                            </div>
                          </div>
                        `;
                      }
                    }
                  }}
                  series={monthlyAnimatedSeries.length > 0 ? monthlyAnimatedSeries : [{ name: 'ยอดจ่ายรวม', data: [] }]}
                  type="line"
                  height={320}
                />
              )}
            </div>
          </div>
        </div>

        {/* Row 2: Top Products and Top Destinations (50/50 Split) */}
        <div className="charts-row-half">
          {/* Top Products */}
          <div className="chart-card">
            <div className="chart-header">
              <div className="chart-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarChartHorizontal style={{ color: 'var(--success)', width: '20px', height: '20px' }} />
                <span>
                  {topProductsChartData.categories.length > 0 ? `${Math.min(15, topProductsChartData.categories.length)} อันดับสินค้าที่มีการจ่ายออกมากที่สุด` : 'อันดับสินค้าที่มีการจ่ายออกมากที่สุด'}
                </span>
              </div>
            </div>
            <div className="chart-body" style={{ display: 'block', width: '100%' }}>
              {topProductsChartData.categories.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '220px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  ไม่มีข้อมูลสินค้าจ่ายออกในช่วงที่เลือก
                </div>
              ) : (
                <Chart 
                  key={`dispatch-top15-prods-${topProductsChartData.categories.length}`}
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
                        dataPointSelection: (event, chartContext, { dataPointIndex }) => {
                          const item = topProductsChartData.fullList[dataPointIndex];
                          if (item) {
                            const prod = getProductInfo(item.idx);
                            handleOpenDrilldown('dispatch_product', String(item.idx), `ประวัติการจ่ายสินค้า: ${prod.name} (${prod.code})`);
                          }
                        }
                      }
                    },
                    plotOptions: {
                      bar: {
                        horizontal: true,
                        borderRadius: 4,
                        barHeight: '70%',
                        distributed: true,
                        dataLabels: {
                          position: 'top'
                        }
                      }
                    },
                    colors: ['#6366F1', '#8B5CF6', '#3B82F6', '#0EA5E9', '#14B8A6', '#22C55E', '#FACC15', '#FB923C', '#EF4444', '#EC4899', '#6366F1', '#8B5CF6', '#3B82F6', '#0EA5E9', '#14B8A6'],
                    fill: { opacity: 0.65 },
                    stroke: {
                      show: true,
                      width: 1,
                      colors: ['#6366F1', '#8B5CF6', '#3B82F6', '#0EA5E9', '#14B8A6', '#22C55E', '#FACC15', '#FB923C', '#EF4444', '#EC4899', '#6366F1', '#8B5CF6', '#3B82F6', '#0EA5E9', '#14B8A6']
                    },
                    dataLabels: {
                      enabled: true,
                      textAnchor: 'start',
                      style: {
                        colors: ['#374151'],
                        fontWeight: 700,
                        fontSize: '11px'
                      },
                      formatter: (val) => val.toLocaleString(),
                      offsetX: 10
                    },
                    xaxis: {
                      categories: topProductsChartData.categories,
                      labels: {
                        formatter: (val) => val ? val.toLocaleString() : '0',
                        style: { colors: 'var(--secondary)', fontSize: '11px' }
                      }
                    },
                    yaxis: {
                      labels: {
                        maxWidth: 250,
                        style: { colors: '#000000', fontWeight: 600, fontSize: '11px' }
                      }
                    },
                    legend: { show: false },
                    grid: { borderColor: 'var(--border)', strokeDashArray: 4, padding: { right: 65 } },
                    tooltip: {
                      custom: function({series, seriesIndex, dataPointIndex, w}) {
                        const item = topProductsChartData.fullList[dataPointIndex];
                        if (!item) return '';
                        const prod = getProductInfo(item.idx);
                        return `
                          <div class="custom-chart-tooltip">
                            <div class="tooltip-header">${prod.name}</div>
                            <div class="tooltip-body">
                              <div><strong>รหัสสินค้า:</strong> ${prod.code}</div>
                              <div><strong>ยอดจ่ายรวม:</strong> ${item.qty.toLocaleString()} ชิ้น</div>
                            </div>
                          </div>
                        `;
                      }
                    }
                  }}
                  series={topProductsAnimatedSeries.length > 0 ? topProductsAnimatedSeries : [{ name: 'จำนวน', data: [] }]}
                  type="bar"
                  height={Math.max(260, Math.min(480, topProductsChartData.categories.length * 28 + 60))}
                />
              )}
            </div>
          </div>

          {/* Top Destinations */}
          <div className="chart-card">
            <div className="chart-header">
              <div className="chart-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Home style={{ color: 'var(--info)', width: '20px', height: '20px' }} />
                <span>
                  {topDestinationsChartData.categories.length > 0 ? `${Math.min(15, topDestinationsChartData.categories.length)} อันดับคลังปลายทางที่มีการรับสินค้ามากที่สุด` : 'อันดับคลังปลายทางที่มีการรับสินค้ามากที่สุด'}
                </span>
              </div>
            </div>
            <div className="chart-body" style={{ display: 'block', width: '100%' }}>
              {topDestinationsChartData.categories.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '220px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  ไม่มีข้อมูลคลังปลายทางในช่วงที่เลือก
                </div>
              ) : (
                <Chart 
                  key={`dispatch-top15-dests-${topDestinationsChartData.categories.length}`}
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
                        dataPointSelection: (event, chartContext, { dataPointIndex }) => {
                          const item = topDestinationsChartData.fullList[dataPointIndex];
                          if (item) {
                            const destName = getDestinationName(item.idx);
                            handleOpenDrilldown('dispatch_destination', String(item.idx), `สินค้าที่จ่ายเข้าคลัง: ${destName}`);
                          }
                        }
                      }
                    },
                    plotOptions: {
                      bar: {
                        horizontal: true,
                        borderRadius: 4,
                        barHeight: '70%',
                        distributed: true,
                        dataLabels: {
                          position: 'top'
                        }
                      }
                    },
                    colors: ['#6366F1', '#8B5CF6', '#3B82F6', '#0EA5E9', '#14B8A6', '#22C55E', '#FACC15', '#FB923C', '#EF4444', '#EC4899', '#6366F1', '#8B5CF6', '#3B82F6', '#0EA5E9', '#14B8A6'],
                    fill: { opacity: 0.65 },
                    stroke: {
                      show: true,
                      width: 1,
                      colors: ['#6366F1', '#8B5CF6', '#3B82F6', '#0EA5E9', '#14B8A6', '#22C55E', '#FACC15', '#FB923C', '#EF4444', '#EC4899', '#6366F1', '#8B5CF6', '#3B82F6', '#0EA5E9', '#14B8A6']
                    },
                    dataLabels: {
                      enabled: true,
                      textAnchor: 'start',
                      style: {
                        colors: ['#374151'],
                        fontWeight: 700,
                        fontSize: '11px'
                      },
                      formatter: (val) => val.toLocaleString(),
                      offsetX: 10
                    },
                    xaxis: {
                      categories: topDestinationsChartData.categories,
                      labels: {
                        formatter: (val) => val ? val.toLocaleString() : '0',
                        style: { colors: 'var(--secondary)', fontSize: '11px' }
                      }
                    },
                    yaxis: {
                      labels: {
                        maxWidth: 250,
                        style: { colors: '#000000', fontWeight: 600, fontSize: '11px' }
                      }
                    },
                    legend: { show: false },
                    grid: { borderColor: 'var(--border)', strokeDashArray: 4, padding: { right: 65 } },
                    tooltip: {
                      custom: function({series, seriesIndex, dataPointIndex, w}) {
                        const item = topDestinationsChartData.fullList[dataPointIndex];
                        if (!item) return '';
                        const destName = getDestinationName(item.idx);
                        return `
                          <div class="custom-chart-tooltip">
                            <div class="tooltip-header">${destName}</div>
                            <div class="tooltip-body">
                              <div><strong>ยอดจ่ายรับเข้า:</strong> ${item.qty.toLocaleString()} ชิ้น</div>
                              <div><strong>จำนวนรายการ:</strong> ${item.count.toLocaleString()} ครั้ง</div>
                            </div>
                          </div>
                        `;
                      }
                    }
                  }}
                  series={topDestinationsAnimatedSeries.length > 0 ? topDestinationsAnimatedSeries : [{ name: 'จำนวน', data: [] }]}
                  type="bar"
                  height={Math.max(260, Math.min(480, topDestinationsChartData.categories.length * 28 + 60))}
                />
              )}
            </div>
          </div>
        </div>

        {/* Row 3: Department Donut Chart */}
        <div className="charts-row-full">
          <div className="chart-card" style={{ minHeight: '400px' }}>
            <div className="chart-header">
              <div className="chart-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <PieChart style={{ color: 'var(--warning)', width: '20px', height: '20px' }} />
                <span>
                  {departmentDonutData.top10.length > 0 ? `สัดส่วนการจ่ายสินค้าแยกตามหน่วยงาน (Top ${departmentDonutData.top10.length} Departments)` : 'สัดส่วนการจ่ายสินค้าแยกตามหน่วยงาน'}
                </span>
              </div>
            </div>
            <div className="chart-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
              {departmentDonutData.series.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '220px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  ไม่มีข้อมูลหน่วยงานในช่วงที่เลือก
                </div>
              ) : (
                <ApexDonut 
                  series={departmentDonutData.series}
                  labels={departmentDonutData.labels}
                  colors={['#EC4899', '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#10B981', '#14B8A6', '#06B6D4', '#3B82F6', '#8B5CF6', '#64748B']}
                  totalLabel="ยอดจ่ายรวม"
                  totalValueFormatter={() => stats.totalQty.toLocaleString()}
                  maxWidth="960px"
                  height={370}
                  legendFontSize="11.5px"
                  legendOptions={{
                    itemMargin: { horizontal: 10, vertical: 4 }
                  }}
                  onPointSelected={(idx) => {
                    if (idx < departmentDonutData.top10.length) {
                      const dIdx = departmentDonutData.top10[idx].idx;
                      const deptName = getDepartmentName(dIdx);
                      handleOpenDrilldown('dispatch_department', String(dIdx), `สินค้าที่จ่ายให้แผนก: ${deptName}`);
                    } else {
                      handleOpenDrilldown('dispatch_department', 'Others', 'สินค้าที่จ่ายให้แผนกอื่น ๆ (Others)');
                    }
                  }}
                />
              )}
            </div>
          </div>
        </div>

        {/* Row 4: YoY Comparison Bar Chart (เปรียบเทียบยอดรวมรายปี) */}
        <div className="charts-row-full">
          <div className="chart-card" style={{ minHeight: '440px' }}>
            <div className="chart-header">
              <div className="chart-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarChart2 style={{ color: 'var(--purple)', width: '20px', height: '20px' }} />
                <span>
                  {yoyChartData.yearsList.length > 0 ? `การเปรียบเทียบปริมาณการจ่ายสินค้าในแต่ละปี` : 'การเปรียบเทียบปริมาณการจ่ายสินค้าในแต่ละปี'}
                </span>
              </div>
            </div>

            <div className="chart-body" style={{ display: 'block', width: '100%' }}>
              {yoyChartData.annualCategories.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '220px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  ไม่มีข้อมูลเปรียบเทียบรายปี
                </div>
              ) : (
                <Chart 
                  key={`dispatch-yoy-${yoyChartData.annualCategories.length}`}
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
                        dataPointSelection: (event, chartContext, config) => {
                          const idx = config.dataPointIndex;
                          if (idx !== undefined && idx !== -1 && yoyChartData.yearsList[idx]) {
                            const yr = String(yoyChartData.yearsList[idx]);
                            handleOpenDrilldown('dispatch_yoy', 'All', `การจ่ายสินค้ารวมประจำปี ${yr} — Dispatch Details`, yr);
                          }
                        }
                      }
                    },
                    states: {
                      active: {
                        allowMultipleDataPointsSelection: false,
                        filter: { type: 'none' }
                      }
                    },
                    plotOptions: {
                      bar: {
                        horizontal: false,
                        columnWidth: '45%',
                        borderRadius: 4,
                        distributed: true,
                        dataLabels: {
                          position: 'top'
                        }
                      }
                    },
                    colors: ['#6366F1', '#8B5CF6', '#3B82F6', '#0EA5E9', '#14B8A6', '#22C55E', '#FACC15', '#FB923C', '#EF4444', '#EC4899', '#6366F1', '#8B5CF6'],
                    dataLabels: {
                      enabled: true,
                      offsetY: -20,
                      style: {
                        colors: ['#374151'],
                        fontWeight: 700,
                        fontSize: '12px'
                      },
                      formatter: (val) => val ? val.toLocaleString() + ' ชิ้น' : '0'
                    },
                    legend: { show: false },
                    xaxis: {
                      categories: yoyChartData.annualCategories,
                      labels: { style: { colors: 'var(--secondary)', fontSize: '12px', fontWeight: 600 } }
                    },
                    yaxis: {
                      labels: {
                        formatter: (val) => val ? val.toLocaleString() : '0',
                        style: { colors: 'var(--secondary)' }
                      }
                    },
                    grid: { borderColor: 'var(--border)', strokeDashArray: 4, padding: { top: 25 } },
                    tooltip: {
                      custom: function({series, seriesIndex, dataPointIndex, w}) {
                        const yr = yoyChartData.yearsList[dataPointIndex];
                        const val = yoyChartData.annualValues[dataPointIndex] || 0;
                        const growth = yoyChartData.annualGrowth[dataPointIndex];
                        
                        let growthBadge = '';
                        if (growth !== null && growth !== undefined) {
                          const isPos = growth >= 0;
                          growthBadge = `<div><strong>เทียบปีก่อนหน้า:</strong> <span style="color: ${isPos ? '#16a34a' : '#dc2626'}; font-weight: 700;">${isPos ? '+' : ''}${growth}%</span></div>`;
                        }

                        return `
                          <div class="custom-chart-tooltip">
                            <div class="tooltip-header">ยอดจ่ายสินค้ารวมปี ${yr}</div>
                            <div class="tooltip-body">
                              <div><strong>ปริมาณจ่ายรวม:</strong> ${val.toLocaleString()} ชิ้น</div>
                              ${growthBadge}
                            </div>
                          </div>
                        `;
                      }
                    }
                  }}
                  series={yoyAnimatedSeries.length > 0 ? yoyAnimatedSeries : [{ name: 'ยอดจ่ายรวมประจำปี', data: [] }]}
                  type="bar"
                  height={350}
                />
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Dispatch Table Card */}
      <section className="table-card">
        <div className="table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <h2 className="table-title">รายการจ่ายสินค้าทั้งหมด</h2>
          <div className="table-actions">
            <div className="search-container" style={{ display: 'flex', alignItems: 'center', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: '4px', padding: '4px 8px', gap: '6px' }}>
              <Search size={16} style={{ color: 'var(--text-muted)' }} />
              <input 
                type="text" 
                placeholder="ค้นหาด้วยรหัสสินค้า, ชื่อ, คลัง, แผนก..." 
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
        onClose={() => setIsModalOpen(false)}
        title={modalTitleComputed}
        summaryItems={modalSummaryItems}
        headers={modalHeaders}
        rows={modalRows}
        filename={`${modalTitleComputed.replace(/\s+/g, '_')}.xlsx`}
        filterBar={yoyPillsBar}
        tableMaxWidth={
          drilldownType === 'dispatch_product' || 
          drilldownType === 'dispatch_destination' || 
          drilldownType === 'dispatch_products_summary' || 
          drilldownType === 'dispatch_destinations_summary' ||
          drilldownType === 'dispatch_department'
            ? '900px' 
            : 'none'
        }
      />
    </div>
  );
}
