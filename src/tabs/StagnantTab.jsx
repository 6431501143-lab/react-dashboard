import React, { useState, useMemo, useEffect } from 'react';
import Chart from 'react-apexcharts';
import KpiCard from '../components/KpiCard';
import ResponsiveTable from '../components/ResponsiveTable';
import ApexDonut from '../components/ApexDonut';
import DrilldownModal from '../components/DrilldownModal';
import { Package, List, DollarSign, Home, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { 
  formatDateToDDMMYY, 
  isValidISODate, 
  formatBahtCurrency, 
  formatFullBahtCurrency, 
  getStagnantYears 
} from '../utils/helpers';
import { CHART_PALETTE_PRIMARY, RISK_COLOR_PALETTE } from '../constants/chartColors';

export default function StagnantTab({ rawDataset = [], selectedWarehouses = [], selectedProducts = [], selectedYear = 'All' }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [warehouseChartPage, setWarehouseChartPage] = useState(1);
  const [top10AnimatedSeries, setTop10AnimatedSeries] = useState([]);
  const [warehouseAnimatedSeries, setWarehouseAnimatedSeries] = useState([]);
  
  // Drilldown Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalRows, setModalRows] = useState([]);
  const [modalSummaryItems, setModalSummaryItems] = useState([]);
  const [modalCustomHeaders, setModalCustomHeaders] = useState(null);

  const chartPageSize = 11;

  // 1. Filter Stagnant Dataset based on selection criteria
  const filteredDataset = useMemo(() => {
    return rawDataset.filter(row => {
      // Warehouse Filter
      if (selectedWarehouses.length > 0 && !selectedWarehouses.includes(row.คลัง)) return false;

      // Product Filter
      if (selectedProducts.length > 0 && !selectedProducts.includes(row.รหัสสินค้า)) return false;

      // Year Filter (based on Transfer Date)
      if (selectedYear !== 'All') {
        const dateStr = row.วันโอน || row.วันที่เคลื่อนไหวล่าสุด || row.วันที่เคลื่อนไหวล่าสุ;
        if (!isValidISODate(dateStr)) return false;
        const year = dateStr.split('-')[0];
        if (year !== selectedYear) return false;
      }
      return true;
    });
  }, [rawDataset, selectedWarehouses, selectedProducts, selectedYear]);

  // 2. Local Table filter based on Search input
  const searchedTableRows = useMemo(() => {
    if (!searchTerm.trim()) return filteredDataset;
    const term = searchTerm.toLowerCase().trim();
    return filteredDataset.filter(row => {
      return (
        (row.รหัสสินค้า && row.รหัสสินค้า.toLowerCase().includes(term)) ||
        (row.ชื่อสามัญ && row.ชื่อสามัญ.toLowerCase().includes(term)) ||
        (row.คลัง && row.คลัง.toLowerCase().includes(term)) ||
        (row.lot_number_id && row.lot_number_id.toLowerCase().includes(term))
      );
    });
  }, [filteredDataset, searchTerm]);

  // 3. Compute KPI Statistics matching original exactly
  const stats = useMemo(() => {
    const totalVal = filteredDataset.reduce((sum, r) => sum + (r.มูลค่ารวม || 0), 0);
    const totalQty = filteredDataset.reduce((sum, r) => sum + (r.จำนวน || 0), 0);
    const totalLots = filteredDataset.length;
    const totalWh = new Set(filteredDataset.map(r => r.คลัง)).size;

    return {
      totalVal,
      totalQty,
      totalLots,
      totalWh
    };
  }, [filteredDataset]);

  // Currency formatter helper
  const formatBahtCurrency = (val) => {
    if (val === undefined || val === null || isNaN(val)) return '';
    if (val === 0) return '฿0';
    const absVal = Math.abs(val);
    if (absVal >= 1e6) {
      return '฿' + (val / 1e6).toFixed(2) + 'M';
    } else if (absVal >= 1e3) {
      return '฿' + (val / 1e3).toFixed(1) + 'K';
    }
    return '฿' + val.toLocaleString();
  };

  const formatFullBahtCurrency = (val) => {
    if (val === undefined || val === null || isNaN(val)) return '';
    return '฿' + Math.round(val).toLocaleString();
  };

  // 4. Stagnant Risk Distribution (Donut Chart - Dynamic by Stagnant Years)
  const donutData = useMemo(() => {
    const yearMap = new Map();

    filteredDataset.forEach(row => {
      const years = getStagnantYears(row.ระยะเวลารวม);
      const val = row.มูลค่ารวม || 0;
      yearMap.set(years, (yearMap.get(years) || 0) + val);
    });

    // Sort distinct years ascending (e.g. 1, 2, 3, 4, 5...)
    const sortedYears = Array.from(yearMap.keys())
      .filter(y => (yearMap.get(y) || 0) > 0)
      .sort((a, b) => a - b);

    const series = sortedYears.map(y => Math.round(yearMap.get(y)));
    const labels = sortedYears.map(y => `ค้าง ${y} ปี`);

    // Progressive color palette from amber/orange to deep crimson
    const colorPalette = ['#f59e0b', '#f97316', '#ef4444', '#dc2626', '#b91c1c', '#991b1b', '#7f1d1d', '#581c87', '#3b0764'];
    const colors = sortedYears.map((y, idx) => colorPalette[Math.min(Math.max(0, y - 1), colorPalette.length - 1)] || colorPalette[idx % colorPalette.length]);

    return {
      series,
      labels,
      years: sortedYears,
      colors
    };
  }, [filteredDataset]);

  // 5. Stagnant Warehouse paginated Bar Chart data
  const warehouseChartData = useMemo(() => {
    const whMap = {};
    filteredDataset.forEach(row => {
      const wh = row.คลัง;
      if (!whMap[wh]) whMap[wh] = 0;
      whMap[wh] += (row.มูลค่ารวม || 0);
    });

    const warehousesList = Object.keys(whMap)
      .map(name => ({ name, value: Math.round(whMap[name]) }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value);

    const totalPages = Math.max(1, Math.ceil(warehousesList.length / chartPageSize));
    const activePage = warehouseChartPage > totalPages ? totalPages : warehouseChartPage;

    const startIdx = (activePage - 1) * chartPageSize;
    const pageData = warehousesList.slice(startIdx, startIdx + chartPageSize);

    return {
      categories: pageData.map(d => (d.name && d.name.length > 25 ? d.name.substring(0, 25) + '...' : d.name)),
      fullCategories: pageData.map(d => d.name),
      values: pageData.map(d => d.value),
      totalPages,
      activePage,
      totalCount: warehousesList.length,
      fullList: warehousesList
    };
  }, [filteredDataset, warehouseChartPage]);

  // 6. Top 10 Stagnant Items by Value (Bar Chart)
  const top10ChartData = useMemo(() => {
    const prodMap = {};
    filteredDataset.forEach(row => {
      const code = row.รหัสสินค้า || 'Unknown';
      const name = row.ชื่อสามัญ || 'Unknown';
      const key = `${code}::${name}`;
      const val = row.มูลค่ารวม || 0;
      const qty = row.จำนวน || 0;

      if (!prodMap[key]) {
        prodMap[key] = {
          code,
          name,
          value: 0,
          qty: 0,
          lotCount: 0
        };
      }

      prodMap[key].value += val;
      prodMap[key].qty += qty;
      prodMap[key].lotCount += 1;
    });

    const sortedList = Object.values(prodMap)
      .map(item => ({ ...item, value: Math.round(item.value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    return {
      categories: sortedList.map(d => (d.name && d.name.length > 28 ? d.name.substring(0, 28) + '...' : d.name)),
      fullCategories: sortedList.map(d => d.name),
      values: sortedList.map(d => d.value),
      fullList: sortedList
    };
  }, [filteredDataset]);

  // Trigger dynamic entrance animation for Top 10 chart
  useEffect(() => {
    setTop10AnimatedSeries([]);
    const timer = setTimeout(() => {
      if (top10ChartData.values && top10ChartData.values.length > 0) {
        setTop10AnimatedSeries([{
          name: 'มูลค่ารวม',
          data: top10ChartData.values
        }]);
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [top10ChartData]);

  // Trigger dynamic entrance animation for Warehouse chart
  useEffect(() => {
    setWarehouseAnimatedSeries([]);
    const timer = setTimeout(() => {
      if (warehouseChartData.values && warehouseChartData.values.length > 0) {
        setWarehouseAnimatedSeries([{
          name: 'มูลค่าสินค้า',
          data: warehouseChartData.values
        }]);
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [warehouseChartData]);

  // Headers สำหรับตารางหลัก (รายละเอียดทุกล็อต)
  const tableHeaders = useMemo(() => [
    { key: 'รหัสสินค้า', label: 'รหัสสินค้า', style: { width: '180px', minWidth: '110px' } },
    { key: 'ชื่อสามัญ', label: 'ชื่อสินค้า', style: { whiteSpace: 'normal', width: '380px', minWidth: '250px' } },
    { key: 'คลัง', label: 'คลังสินค้า', style: { width: '180px', minWidth: '140px' } },
    { key: 'lot_number_id', label: 'LOT NO.', style: { width: '220px', minWidth: '130px' } },
    { key: 'จำนวน', label: 'จำนวน', align: 'right', cellRender: (row, val) => val !== undefined && val !== null ? val.toLocaleString() : '0' },
    { key: 'มูลค่ารวม', label: 'มูลค่ารวม', style: { width: '170px', minWidth: '130px' }, cellRender: (row, val) => formatFullBahtCurrency(val) },
    { key: 'วันที่เคลื่อนไหวล่าสุ', label: 'วันเคลื่อนไหวล่าสุด', style: { width: '150px', minWidth: '110px' }, cellRender: (row, val) => formatDateToDDMMYY(val) },
    { key: 'ระยะเวลารวม', label: 'ระยะเวลาไม่เคลื่อนไหว', style: { width: '150px', minWidth: '150px' }, cellRender: (row, val) => <strong style={{ fontWeight: 600 }}>{val}</strong> }
  ], []);

  // Headers สำหรับตารางสรุปรายชื่อสินค้า (สำหรับเจาะลึกการ์ดมูลค่าสินค้า และ จำนวนสินค้า)
  const productSummaryHeaders = useMemo(() => [
    { key: 'รหัสสินค้า', label: 'รหัสสินค้า', style: { width: '180px', minWidth: '130px' } },
    { key: 'ชื่อสามัญ', label: 'ชื่อสินค้า', style: { whiteSpace: 'normal', width: '550px', minWidth: '250px' } },
    { key: 'จำนวน', label: 'จำนวนรวม (ชิ้น)', align: 'right', style: { width: '150px', minWidth: '110px' }, cellRender: (row, val) => val !== undefined && val !== null ? val.toLocaleString() : '0' },
    { key: 'มูลค่ารวม', label: 'มูลค่ารวม (บาท)', align: 'right', style: { width: '170px', minWidth: '130px' }, cellRender: (row, val) => formatFullBahtCurrency(val) }
  ], []);

  // Headers สำหรับตารางสรุปรายคลัง (สำหรับเจาะลึกการ์ดจำนวนคลังสินค้า)
  const warehouseSummaryHeaders = useMemo(() => [
    { key: 'คลัง', label: 'คลังสินค้า', style: { width: '260px', minWidth: '180px' } },
    { key: 'จำนวนรายการ', label: 'จำนวนรายการ (ล็อต)', align: 'right', style: { width: '160px', minWidth: '120px' }, cellRender: (row, val) => val !== undefined && val !== null ? val.toLocaleString() : '0' },
    { key: 'จำนวน', label: 'จำนวนสินค้ารวม (ชิ้น)', align: 'right', style: { width: '170px', minWidth: '120px' }, cellRender: (row, val) => val !== undefined && val !== null ? val.toLocaleString() : '0' },
    { key: 'มูลค่ารวม', label: 'มูลค่าค้างคลังรวม', align: 'right', style: { width: '180px', minWidth: '130px' }, cellRender: (row, val) => formatFullBahtCurrency(val) }
  ], []);

  // Drilldown Opening Handlers
  const handleOpenDrilldown = (type, key, titleStr) => {
    let rows = [];
    let summaryText = '';

    if (type === 'all_value' || type === 'all_qty') {
      // รวมกลุ่มยอดตามชื่อสินค้า (รหัสสินค้า, ชื่อสามัญ, จำนวนรวม, มูลค่ารวม)
      const prodMap = new Map();
      filteredDataset.forEach(r => {
        const id = r.รหัสสินค้า || '-';
        const name = r.ชื่อสามัญ || 'Unknown';
        const pKey = `${id}___${name}`;
        if (!prodMap.has(pKey)) {
          prodMap.set(pKey, {
            "รหัสสินค้า": id,
            "ชื่อสามัญ": name,
            "จำนวน": 0,
            "มูลค่ารวม": 0
          });
        }
        const entry = prodMap.get(pKey);
        entry.จำนวน += (r.จำนวน || 0);
        entry.มูลค่ารวม += (r.มูลค่ารวม || 0);
      });

      if (type === 'all_value') {
        rows = Array.from(prodMap.values()).sort((a, b) => b.มูลค่ารวม - a.มูลค่ารวม);
        summaryText = `มูลค่าสินค้าค้างคลังรวมทั้งหมด: ${formatFullBahtCurrency(stats.totalVal)} (${rows.length.toLocaleString()} รายการสินค้า)`;
      } else {
        rows = Array.from(prodMap.values()).sort((a, b) => b.จำนวน - a.จำนวน);
        summaryText = `จำนวนหน่วยสินค้าค้างคลังรวมทั้งหมด: ${stats.totalQty.toLocaleString()} ชิ้น (${rows.length.toLocaleString()} รายการสินค้า)`;
      }
      setModalCustomHeaders(productSummaryHeaders);

    } else if (type === 'all_lots') {
      rows = filteredDataset.slice().sort((a, b) => (b.มูลค่ารวม || 0) - (a.มูลค่ารวม || 0));
      summaryText = `จำนวนล็อตสินค้าค้างคลังทั้งหมด: ${stats.totalLots.toLocaleString()} รายการ | มูลค่ารวม: ${formatFullBahtCurrency(stats.totalVal)}`;
      setModalCustomHeaders(tableHeaders);

    } else if (type === 'all_warehouses') {
      // รวมกลุ่มเฉพาะคลังที่มีสินค้าค้างคลังเท่านั้น
      const whMap = new Map();
      filteredDataset.forEach(r => {
        const wh = r.คลัง || '-';
        if (!whMap.has(wh)) {
          whMap.set(wh, {
            "คลัง": wh,
            "จำนวนรายการ": 0,
            "จำนวน": 0,
            "มูลค่ารวม": 0
          });
        }
        const entry = whMap.get(wh);
        entry.จำนวนรายการ += 1;
        entry.จำนวน += (r.จำนวน || 0);
        entry.มูลค่ารวม += (r.มูลค่ารวม || 0);
      });

      rows = Array.from(whMap.values())
        .filter(w => w.มูลค่ารวม > 0 || w.จำนวน > 0)
        .sort((a, b) => b.มูลค่ารวม - a.มูลค่ารวม);

      summaryText = `คลังสินค้าที่มีสินค้าค้างคลังทั้งหมด: ${rows.length.toLocaleString()} คลัง | มูลค่าค้างคลังรวม: ${formatFullBahtCurrency(stats.totalVal)}`;
      setModalCustomHeaders(warehouseSummaryHeaders);

    } else if (type === 'warehouse') {
      rows = filteredDataset.filter(r => r.คลัง === key);
      const totalVal = rows.reduce((sum, r) => sum + (r.มูลค่ารวม || 0), 0);
      summaryText = `คลังสินค้า: ${key} | มูลค่ารวม: ${formatFullBahtCurrency(totalVal)} (${rows.length.toLocaleString()} รายการ)`;
      setModalCustomHeaders(tableHeaders);

    } else if (type === 'year') {
      rows = filteredDataset.filter(r => {
        const dateStr = r.วันโอน || r.วันที่เคลื่อนไหวล่าสุ;
        return dateStr && dateStr.startsWith(key.toString());
      });
      const totalVal = rows.reduce((sum, r) => sum + (r.มูลค่ารวม || 0), 0);
      summaryText = `ปีที่ทำรายการ: ${key} | มูลค่ารวม: ${formatFullBahtCurrency(totalVal)} (${rows.length.toLocaleString()} รายการ)`;
      setModalCustomHeaders(tableHeaders);

    } else if (type === 'risk') {
      const targetYear = parseInt(key, 10);
      rows = filteredDataset.filter(r => {
        const years = getStagnantYears(r.ระยะเวลารวม);
        return !isNaN(targetYear) ? years === targetYear : true;
      });
      const totalVal = rows.reduce((sum, r) => sum + (r.มูลค่ารวม || 0), 0);
      const label = !isNaN(targetYear) ? `ค้าง ${targetYear} ปี` : key;
      summaryText = `กลุ่มความเสี่ยง: ${label} | มูลค่ารวม: ${formatFullBahtCurrency(totalVal)} (${rows.length.toLocaleString()} รายการ)`;
      setModalCustomHeaders(tableHeaders);

    } else if (type === 'product_name') {
      rows = filteredDataset.filter(r => r.ชื่อสามัญ === key);
      const totalVal = rows.reduce((sum, r) => sum + (r.มูลค่ารวม || 0), 0);
      summaryText = `ชื่อสินค้า: ${key} | มูลค่ารวม: ${formatFullBahtCurrency(totalVal)} (${rows.length.toLocaleString()} รายการ)`;
      setModalCustomHeaders(tableHeaders);
    }

    setModalTitle(titleStr);
    setModalRows(rows);
    setModalSummaryItems([
      { label: 'รายละเอียดฟิลเตอร์', value: summaryText, color: 'var(--primary)' }
    ]);
    setIsModalOpen(true);
  };

  return (
    <div className="tab-container">
      {/* KPI Cards Row */}
      <section className="kpi-row" style={{ marginBottom: '24px' }}>
        <KpiCard 
          title="มูลค่าสินค้า"
          value={`฿${stats.totalVal.toLocaleString()} <span style="font-size: 0.9rem; font-weight: 500; margin-left: 4px; color: var(--text-muted);">บาท</span>`}
          icon={DollarSign}
          accentClass="info"
          subtext="มูลค่ารวมของสินค้าที่มีอายุเกิน 1 ปี"
          onClick={() => handleOpenDrilldown('all_value', null, 'เจาะลึกมูลค่าสินค้าค้างคลังตามรายการสินค้า')}
        />
        <KpiCard 
          title="จำนวนสินค้า"
          value={`${stats.totalQty.toLocaleString()} <span style="font-size: 0.9rem; font-weight: 500; margin-left: 4px; color: var(--text-muted);">ชิ้น</span>`}
          icon={Package}
          accentClass="success"
          subtext="จำนวนรวมหน่วยสินค้าไม่เคลื่อนไหวเกิน 1 ปี"
          onClick={() => handleOpenDrilldown('all_qty', null, 'เจาะลึกจำนวนสินค้าค้างคลังตามรายการสินค้า')}
        />
        <KpiCard 
          title="จำนวนล็อตสินค้า"
          value={`${stats.totalLots.toLocaleString()} <span style="font-size: 0.9rem; font-weight: 500; margin-left: 4px; color: var(--text-muted);">รายการ</span>`}
          icon={List}
          accentClass="warning"
          subtext="จำนวนรวมล็อตสินค้าไม่เคลื่อนไหวเกิน 1 ปี"
          onClick={() => handleOpenDrilldown('all_lots', null, 'เจาะลึกทุกล็อตสินค้าค้างคลัง')}
        />
        <KpiCard 
          title="จำนวนคลังสินค้า"
          value={`${stats.totalWh.toLocaleString()} <span style="font-size: 0.9rem; font-weight: 500; margin-left: 4px; color: var(--text-muted);">คลัง</span>`}
          icon={Home}
          accentClass="purple"
          subtext="คลังที่มีสินค้าค้างเกิน 1 ปี"
          onClick={() => handleOpenDrilldown('all_warehouses', null, 'เจาะลึกคลังสินค้าที่มีสินค้าค้างคลัง')}
        />
      </section>

      {/* Charts Layout Section matching original CSS rows */}
      <section className="charts-layout-container" style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '24px' }}>
        
        {/* Row 1: Top 10 Items by Value */}
        <div className="charts-row-full" id="stagnant-top10-chart-row">
          <div className="chart-card">
            <div className="chart-header">
              <div className="chart-title">
                <Package style={{ color: 'var(--primary)', width: '20px', height: '20px' }} />
                <span>
                  {top10ChartData.categories.length > 0 ? `${Math.min(10, top10ChartData.categories.length)} อันดับสินค้าที่มีมูลค่าค้างคลังสูงสุด` : 'อันดับสินค้าที่มีมูลค่าค้างคลังสูงสุด'}
                </span>
              </div>
            </div>
            <div className="chart-body" style={{ display: 'block', width: '100%', minWidth: 0 }}>
              {top10ChartData.categories.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '220px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  ไม่มีข้อมูลสินค้าค้างคลังตามเงื่อนไขที่เลือก
                </div>
              ) : (
                <Chart 
                  key={`top10-stagnant-chart-${top10ChartData.categories.length}-${warehouseChartPage}`}
                  width="100%" 
                  options={{
                    chart: {
                      type: 'bar',
                      toolbar: { show: false },
                      animations: {
                        enabled: true,
                        easing: 'easeinout',
                        speed: 1200,
                        animateGradually: { 
                          enabled: true, 
                          delay: 200 
                        },
                        dynamicAnimation: { 
                          enabled: true, 
                          speed: 1000 
                        }
                      },
                      events: {
                        dataPointSelection: (e, chartCtx, config) => {
                          const idx = config.dataPointIndex;
                          if (idx !== undefined && top10ChartData.fullList[idx]) {
                            const item = top10ChartData.fullList[idx];
                            handleOpenDrilldown('product_name', item.name, `เจาะลึกสินค้าค้างคลัง: ${item.name}`);
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
                    colors: ['#6366F1', '#8B5CF6', '#3B82F6', '#0EA5E9', '#14B8A6', '#22C55E', '#FACC15', '#FB923C', '#EF4444', '#EC4899'],
                    fill: {
                      opacity: 0.65
                    },
                    stroke: {
                      show: true,
                      width: 1,
                      colors: ['#6366F1', '#8B5CF6', '#3B82F6', '#0EA5E9', '#14B8A6', '#22C55E', '#FACC15', '#FB923C', '#EF4444', '#EC4899']
                    },
                    dataLabels: {
                      enabled: true,
                      textAnchor: 'start',
                      style: {
                        colors: ['#374151'],
                        fontWeight: 700,
                        fontSize: '11px'
                      },
                      formatter: (val) => formatBahtCurrency(val),
                      offsetX: 10
                    },
                    xaxis: {
                      categories: top10ChartData.categories,
                      labels: {
                        formatter: (val) => formatBahtCurrency(val),
                        style: { colors: 'var(--secondary)' }
                      }
                    },
                    yaxis: {
                      labels: {
                        maxWidth: 320,
                        style: { colors: '#0f172a', fontWeight: 600, fontSize: '12px' }
                      }
                    },
                    legend: { show: false },
                    grid: { borderColor: 'var(--border)', strokeDashArray: 4, padding: { right: 65, left: 10 } },
                    tooltip: {
                      custom: function({_series, _seriesIndex, dataPointIndex, _w}) {
                        const prod = top10ChartData.fullList[dataPointIndex];
                        if (!prod) return '';
                        return `
                          <div class="custom-chart-tooltip">
                            <div class="tooltip-header">${prod.name}</div>
                            <div class="tooltip-body">
                              <div><strong>รหัสสินค้า:</strong> ${prod.code}</div>
                              <div><strong>มูลค่ารวม:</strong> ฿${Math.round(prod.value).toLocaleString()} บาท</div>
                              <div><strong>จำนวนรวม:</strong> ${prod.qty.toLocaleString()} หน่วย</div>
                              <div><strong>จำนวนล็อต:</strong> ${prod.lotCount} ล็อต</div>
                            </div>
                          </div>
                        `;
                      }
                    }
                  }}
                  series={top10AnimatedSeries.length > 0 ? top10AnimatedSeries : [{ name: 'มูลค่ารวม', data: [] }]}
                  type="bar"
                  height={Math.max(260, Math.min(480, top10ChartData.categories.length * 28 + 60))}
                />
              )}
            </div>
          </div>
        </div>

        {/* Row 2: Warehouse Bar Chart & Stagnant Risk Donut (Split 50/50) */}
        <div className="charts-row-half">
          {/* Warehouse paginated bar chart */}
          <div className="chart-card">
            <div className="chart-header">
              <div className="chart-title">
                <Home style={{ color: 'var(--accent)', width: '20px', height: '20px' }} />
                <span>
                  {warehouseChartData.totalCount > 0 ? `มูลค่าสินค้าค้างคลังสะสม แยกตามคลังสินค้า (ทั้งหมด ${warehouseChartData.totalCount} คลัง)` : 'มูลค่าสินค้าค้างคลังสะสม แยกตามคลังสินค้า'}
                </span>
              </div>
              
              {/* Paginated bar chart controls */}
              {warehouseChartData.totalPages > 1 && (
                <div className="chart-pagination-controls" id="warehouse-chart-pagination">
                  <button 
                    className="btn-chart-page" 
                    disabled={warehouseChartData.activePage === 1}
                    onClick={() => setWarehouseChartPage(prev => Math.max(1, prev - 1))}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span id="chart-page-indicator">
                    {warehouseChartData.activePage} / {warehouseChartData.totalPages}
                  </span>
                  <button 
                    className="btn-chart-page" 
                    disabled={warehouseChartData.activePage === warehouseChartData.totalPages}
                    onClick={() => setWarehouseChartPage(prev => Math.min(warehouseChartData.totalPages, prev + 1))}
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>
            <div className="chart-body" style={{ display: 'block', width: '100%', minWidth: 0 }}>
              {warehouseChartData.categories.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '220px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  ไม่มีข้อมูลคลังสินค้าตามเงื่อนไขที่เลือก
                </div>
              ) : (
                <Chart 
                  key={`wh-chart-${warehouseChartPage}-${warehouseChartData.categories.length}`}
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
                          const idx = config ? config.dataPointIndex : undefined;
                          if (idx !== undefined && idx !== -1) {
                            const name = warehouseChartData.fullCategories ? warehouseChartData.fullCategories[idx] : warehouseChartData.categories[idx];
                            if (name) {
                              handleOpenDrilldown('warehouse', name, `เจาะลึกสินค้าคงเหลือในคลัง: ${name}`);
                            }
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
                    colors: ['#6366F1', '#8B5CF6', '#3B82F6', '#0EA5E9', '#14B8A6', '#22C55E', '#FACC15', '#FB923C', '#EF4444', '#EC4899'],
                    fill: {
                      opacity: 0.65
                    },
                    stroke: {
                      show: true,
                      width: 1,
                      colors: ['#6366F1', '#8B5CF6', '#3B82F6', '#0EA5E9', '#14B8A6', '#22C55E', '#FACC15', '#FB923C', '#EF4444', '#EC4899']
                    },
                    dataLabels: {
                      enabled: true,
                      textAnchor: 'start',
                      style: {
                        colors: ['#374151'],
                        fontWeight: 700,
                        fontSize: '12px'
                      },
                      formatter: (val) => formatBahtCurrency(val),
                      offsetX: 10
                    },
                    xaxis: {
                      categories: warehouseChartData.categories,
                      labels: {
                        formatter: (val) => formatBahtCurrency(val),
                        style: { colors: 'var(--secondary)', fontSize: '12px' }
                      }
                    },
                    yaxis: {
                      labels: {
                        maxWidth: 280,
                        style: { colors: '#0f172a', fontWeight: 600, fontSize: '12px' }
                      }
                    },
                    legend: { show: false },
                    grid: { borderColor: 'var(--border)', strokeDashArray: 4, padding: { right: 65, left: 10 } },
                    tooltip: {
                      custom: function({_series, _seriesIndex, dataPointIndex, w}) {
                        const whName = warehouseChartData.fullCategories ? warehouseChartData.fullCategories[dataPointIndex] : w.config.xaxis.categories[dataPointIndex];
                        if (!whName) return '';
                        const whItems = filteredDataset.filter(r => r.คลัง === whName);
                        const totalVal = whItems.reduce((sum, r) => sum + r.มูลค่ารวม, 0);
                        const totalQty = whItems.reduce((sum, r) => sum + r.จำนวน, 0);
                        const lotCount = whItems.length;
                        return `
                          <div class="custom-chart-tooltip">
                            <div class="tooltip-header">${whName}</div>
                            <div class="tooltip-body">
                              <div><strong>มูลค่า:</strong> ฿${Math.round(totalVal).toLocaleString()} บาท</div>
                              <div><strong>จำนวนสินค้า:</strong> ${Math.round(totalQty).toLocaleString()} ชิ้น</div>
                              <div><strong>จำนวนรายการ:</strong> ${lotCount.toLocaleString()} รายการ</div>
                            </div>
                          </div>
                        `;
                      }
                    }
                  }}
                  series={warehouseAnimatedSeries.length > 0 ? warehouseAnimatedSeries : [{ name: 'มูลค่าสินค้า', data: [] }]}
                  type="bar"
                  height={Math.max(260, Math.min(480, warehouseChartData.categories.length * 28 + 60))}
                />
              )}
            </div>
          </div>

          {/* Stagnant Risk Donut Chart */}
          <div className="chart-card" style={{ minHeight: '380px' }}>
            <div className="chart-header">
              <div className="chart-title">
                <Package style={{ color: 'var(--warning)', width: '20px', height: '20px' }} />
                <span>การแบ่งกลุ่มตามระดับความเสี่ยงของสินค้าค้างคลัง</span>
              </div>
            </div>
            <div className="chart-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
              {donutData.series.length === 0 || donutData.series.reduce((a, b) => a + b, 0) === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '220px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  ไม่มีข้อมูลระดับความเสี่ยง
                </div>
              ) : (
                <ApexDonut 
                  series={donutData.series}
                  labels={donutData.labels}
                  colors={donutData.colors}
                  totalLabel="มูลค่ารวม"
                  totalValueFormatter={() => formatFullBahtCurrency(stats.totalVal)}
                  onPointSelected={(idx) => {
                    if (donutData.years && donutData.years[idx] !== undefined) {
                      const yr = donutData.years[idx];
                      handleOpenDrilldown('risk', String(yr), `เจาะลึกสินค้าค้าง ${donutData.labels[idx]}`);
                    }
                  }}
                />
              )}
            </div>
          </div>
        </div>

      </section>

      {/* Data Table Card */}
      <section className="table-card">
        <div className="table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <h2 className="table-title">รายการสินค้าไม่เคลื่อนไหวทั้งหมด</h2>
          <div className="table-actions">
            <div className="search-container" style={{ display: 'flex', alignItems: 'center', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: '4px', padding: '4px 8px', gap: '6px' }}>
              <Search size={16} style={{ color: 'var(--text-muted)' }} />
              <input 
                type="text" 
                placeholder="ค้นหาชื่อ, รหัส, คลัง, LOT..." 
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
          tabViewClass="stagnant-view"
        />
      </section>

      {/* Drilldown Modal popup */}
      <DrilldownModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={modalTitle}
        summaryItems={modalSummaryItems}
        headers={modalCustomHeaders || tableHeaders}
        rows={modalRows}
        filename={`${modalTitle.replace(/\s+/g, '_')}.xlsx`}
      />
    </div>
  );
}
