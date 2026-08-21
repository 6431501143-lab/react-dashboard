import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import DateSlicer from './components/DateSlicer';
import MultiselectDropdown from './components/MultiselectDropdown';
import { 
  fetchStagnantData, 
  fetchExpiryData, 
  fetchDispatchData, 
  fetchInventoryData, 
  fetchTurnoverData,
  getSnapshotStatus,
  triggerSnapshotSync
} from './services/api';
import StagnantTab from './tabs/StagnantTab';
import ExpiryTab from './tabs/ExpiryTab';
import TurnoverTab from './tabs/TurnoverTab';
import InventoryTab from './tabs/InventoryTab';
import DispatchTab from './tabs/DispatchTab';
import EmptyState from './components/EmptyState';
import { 
  RefreshCw, 
  FileSpreadsheet, 
  CheckCircle2, 
  X, 
  RotateCcw, 
  AlertCircle, 
  UploadCloud,
  Activity
} from 'lucide-react';
import { parseUploadedFile } from './utils/fileImporter';
import { isValidISODate } from './utils/helpers';

const VALID_TABS = ['stagnant', 'expiry', 'inventory', 'dispatch', 'turnover'];

export default function App() {
  // Remember active tab across refreshes via URL hash and localStorage
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const hash = window.location.hash.replace('#', '');
      if (VALID_TABS.includes(hash)) return hash;
      const saved = localStorage.getItem('vanguard_active_tab');
      if (VALID_TABS.includes(saved)) return saved;
    } catch {
      // ignore
    }
    return 'stagnant';
  });

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Remember data source mode across refreshes: 'database' | 'excel'
  const [dataSourceMode, setDataSourceMode] = useState(() => {
    try {
      const saved = localStorage.getItem('vanguard_data_source_mode');
      if (saved === 'excel' || saved === 'database') return saved;
    } catch {
      // ignore
    }
    return 'database';
  });

  // Save activeTab & dataSourceMode changes to localStorage and hash
  useEffect(() => {
    try {
      localStorage.setItem('vanguard_active_tab', activeTab);
      window.location.hash = activeTab;
    } catch {}
  }, [activeTab]);

  useEffect(() => {
    try {
      localStorage.setItem('vanguard_data_source_mode', dataSourceMode);
    } catch {}
  }, [dataSourceMode]);

  // Support browser Back/Forward navigation
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (VALID_TABS.includes(hash)) {
        setActiveTab(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Global filters
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [selectedWarehouses, setSelectedWarehouses] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [selectedYear, setSelectedYear] = useState('All'); // For stagnant tab

  // Database Live Datasets
  const [dbDatasets, setDbDatasets] = useState({
    stagnant: [],
    expiry: [],
    dispatch: { products: [], destinations: [], departments: [], transactions: [] },
    inventory: [],
    turnover: { products: [], warehouses: [], months: [], aggregated: [], details: [], dowAggregated: [] }
  });

  // Excel / CSV Uploaded Datasets per tab
  const [uploadedDatasets, setUploadedDatasets] = useState({
    stagnant: null,
    expiry: null,
    dispatch: null,
    inventory: null,
    turnover: null
  });

  const [uploadedFiles, setUploadedFiles] = useState({}); // { [tab]: { fileName, rowCount } }
  const [isLiveDb, setIsLiveDb] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Local Snapshot Engine States
  const [snapshotMeta, setSnapshotMeta] = useState({ lastSyncedAt: null, hasData: false });
  const [isSyncingSnapshot, setIsSyncingSnapshot] = useState(false);

  // Per-tab loading states
  const [tabLoading, setTabLoading] = useState({
    stagnant: false,
    expiry: false,
    dispatch: false,
    inventory: false,
    turnover: false
  });

  const [isFileImporting, setIsFileImporting] = useState(false);
  const isCurrentTabLoading = tabLoading[activeTab] || isFileImporting;

  // Load a specific tab on demand (fast, non-blocking)
  const loadTabData = useCallback(async (tabName) => {
    setTabLoading(prev => ({ ...prev, [tabName]: true }));

    try {
      if (tabName === 'stagnant') {
        const res = await fetchStagnantData();
        if (res.isLive) setIsLiveDb(true);
        setDbDatasets(prev => ({ ...prev, stagnant: res.data || [] }));
      } else if (tabName === 'expiry') {
        const res = await fetchExpiryData();
        if (res.isLive) setIsLiveDb(true);
        setDbDatasets(prev => ({ ...prev, expiry: res.data || [] }));
      } else if (tabName === 'dispatch') {
        const res = await fetchDispatchData();
        if (res.isLive) setIsLiveDb(true);
        setDbDatasets(prev => ({ ...prev, dispatch: res.data || { products: [], destinations: [], departments: [], transactions: [] } }));
      } else if (tabName === 'inventory') {
        const res = await fetchInventoryData();
        if (res.isLive) setIsLiveDb(true);
        setDbDatasets(prev => ({ ...prev, inventory: res.data || [] }));
      } else if (tabName === 'turnover') {
        const res = await fetchTurnoverData();
        if (res.isLive) setIsLiveDb(true);
        setDbDatasets(prev => ({ ...prev, turnover: res.data || { products: [], warehouses: [], months: [], aggregated: [], details: [], dowAggregated: [] } }));
      }
    } catch (err) {
      console.error(`Error fetching ${tabName}:`, err);
    } finally {
      setTabLoading(prev => ({ ...prev, [tabName]: false }));
    }
  }, []);

  // Fetch snapshot metadata and auto-sync state
  const lastSyncedRef = useRef(null);

  const refreshSnapshotStatus = useCallback(async () => {
    const meta = await getSnapshotStatus();
    if (meta && meta.lastSyncedAt) {
      setSnapshotMeta(prev => {
        if (
          prev.lastSyncedAt === meta.lastSyncedAt &&
          prev.hasData === meta.hasData &&
          prev.autoSyncTime === meta.autoSyncTime &&
          prev.nextScheduledSync === meta.nextScheduledSync
        ) {
          return prev;
        }
        return meta;
      });
      if (meta.hasData) setIsLiveDb(true);

      // If timestamp updated in background, auto-reload active tab
      if (lastSyncedRef.current && lastSyncedRef.current !== meta.lastSyncedAt) {
        if (dataSourceMode === 'database') {
          loadTabData(activeTab);
        }
      }
      lastSyncedRef.current = meta.lastSyncedAt;
    }
  }, [activeTab, dataSourceMode, loadTabData]);

  useEffect(() => {
    refreshSnapshotStatus();
    // Check for new sync data every 10 seconds automatically
    const interval = setInterval(refreshSnapshotStatus, 10000);
    return () => clearInterval(interval);
  }, [refreshSnapshotStatus]);

  // Trigger manual snapshot sync from PostgreSQL to SQLite
  const handleSyncSnapshot = async () => {
    if (isSyncingSnapshot) return;
    setIsSyncingSnapshot(true);
    setToastMessage({ type: 'info', text: '🔄 กำลังดึงข้อมูลสรุปสดจาก PostgreSQL โรงพยาบาล...' });

    try {
      const res = await triggerSnapshotSync();
      setToastMessage({ type: 'success', text: `✅ ซิงค์ข้อมูลสำเร็จ (${res.durationSec} วินาที) อัปเดตข้อมูลล่าสุดเรียบร้อยแล้ว!` });
      await refreshSnapshotStatus();
      // Reload current tab from SQLite immediately
      loadTabData(activeTab);
    } catch (err) {
      setToastMessage({ type: 'error', text: `❌ การซิงค์ล้มเหลว: ${err.message}` });
    } finally {
      setIsSyncingSnapshot(false);
    }
  };

  // Load active tab whenever it changes in Database mode
  useEffect(() => {
    if (dataSourceMode === 'database') {
      loadTabData(activeTab);
    }
  }, [activeTab, dataSourceMode, loadTabData]);

  const handleSelectDatabaseMode = () => {
    setDataSourceMode('database');
    loadTabData(activeTab);
  };

  // Compute active datasets depending on dataSourceMode
  const currentStagnantData = useMemo(() => {
    return dataSourceMode === 'excel' ? (uploadedDatasets.stagnant || []) : dbDatasets.stagnant;
  }, [dataSourceMode, uploadedDatasets.stagnant, dbDatasets.stagnant]);

  const currentExpiryData = useMemo(() => {
    return dataSourceMode === 'excel' ? (uploadedDatasets.expiry || []) : dbDatasets.expiry;
  }, [dataSourceMode, uploadedDatasets.expiry, dbDatasets.expiry]);

  const currentDispatchData = useMemo(() => {
    return dataSourceMode === 'excel' 
      ? (uploadedDatasets.dispatch || { products: [], destinations: [], departments: [], transactions: [] }) 
      : dbDatasets.dispatch;
  }, [dataSourceMode, uploadedDatasets.dispatch, dbDatasets.dispatch]);

  const currentInventoryData = useMemo(() => {
    return dataSourceMode === 'excel' ? (uploadedDatasets.inventory || []) : dbDatasets.inventory;
  }, [dataSourceMode, uploadedDatasets.inventory, dbDatasets.inventory]);

  const currentTurnoverData = useMemo(() => {
    return dataSourceMode === 'excel' 
      ? (uploadedDatasets.turnover || { products: [], warehouses: [], months: [], aggregated: [], details: [], dowAggregated: [] }) 
      : dbDatasets.turnover;
  }, [dataSourceMode, uploadedDatasets.turnover, dbDatasets.turnover]);

  // Check if current active tab has data to display
  const hasActiveTabData = useMemo(() => {
    if (activeTab === 'stagnant') return currentStagnantData && currentStagnantData.length > 0;
    if (activeTab === 'expiry') return currentExpiryData && currentExpiryData.length > 0;
    if (activeTab === 'dispatch') return currentDispatchData && currentDispatchData.transactions && currentDispatchData.transactions.length > 0;
    if (activeTab === 'inventory') return currentInventoryData && currentInventoryData.length > 0;
    if (activeTab === 'turnover') return currentTurnoverData && currentTurnoverData.aggregated && currentTurnoverData.aggregated.length > 0;
    return false;
  }, [activeTab, currentStagnantData, currentExpiryData, currentDispatchData, currentInventoryData, currentTurnoverData]);

  // Handle file upload for active tab
  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsFileImporting(true);
      // Give React & DOM a moment to paint the medical loading spinner
      await new Promise(resolve => setTimeout(resolve, 60));

      const result = await parseUploadedFile(file, activeTab);

      setUploadedDatasets(prev => ({
        ...prev,
        [result.tabType]: result.data
      }));

      setUploadedFiles(prev => ({
        ...prev,
        [result.tabType]: { fileName: result.fileName, rowCount: result.rowCount }
      }));

      setDataSourceMode('excel');

      // Clear filters so new file's records are not filtered out
      setSelectedWarehouses([]);
      setSelectedProducts([]);
      setSelectedYear('All');
      setStartDate(null);
      setEndDate(null);

      // Switch tab if auto-detected different
      if (result.tabType !== activeTab) {
        setActiveTab(result.tabType);
      }

      setToastMessage({
        type: 'success',
        text: `นำเข้าไฟล์ "${result.fileName}" สำเร็จ (${result.rowCount.toLocaleString()} รายการ) และสร้างกราฟเรียบร้อยแล้ว`
      });

      setTimeout(() => setToastMessage(null), 6000);
    } catch (err) {
      console.error("File upload error:", err);
      setToastMessage({
        type: 'error',
        text: `เกิดข้อผิดพลาดในการอ่านไฟล์: ${err.message}`
      });
      setTimeout(() => setToastMessage(null), 7000);
    } finally {
      setIsFileImporting(false);
      if (event.target) event.target.value = '';
    }
  };

  // Reset uploaded file for a tab
  const handleResetUploadedFile = (tabToReset) => {
    const targetTab = tabToReset || activeTab;
    setUploadedDatasets(prev => ({
      ...prev,
      [targetTab]: null
    }));

    setUploadedFiles(prev => {
      const next = { ...prev };
      delete next[targetTab];
      return next;
    });

    setToastMessage({
      type: 'info',
      text: `ลบไฟล์ของหน้านี้เรียบร้อยแล้ว`
    });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Available warehouses calculation
  const availableWarehouses = useMemo(() => {
    let list = [];
    if (activeTab === 'stagnant') {
      list = [...new Set(currentStagnantData.map(r => r.คลัง))];
    } else if (activeTab === 'expiry') {
      list = [...new Set(currentExpiryData.map(r => r.คลัง))];
    } else if (activeTab === 'turnover') {
      list = currentTurnoverData.warehouses || [];
    } else if (activeTab === 'inventory') {
      list = [...new Set(currentInventoryData.map(r => r.warehouse))];
    } else if (activeTab === 'dispatch') {
      list = currentDispatchData.destinations || [];
    }
    return list.filter(Boolean).sort();
  }, [activeTab, currentStagnantData, currentExpiryData, currentTurnoverData, currentInventoryData, currentDispatchData]);

  // Available products calculation
  const availableProducts = useMemo(() => {
    let list = [];
    if (activeTab === 'stagnant') {
      list = currentStagnantData.map(r => ({ value: r.รหัสสินค้า, label: `${r.รหัสสินค้า} - ${r.ชื่อสามัญ}` }));
    } else if (activeTab === 'expiry') {
      list = currentExpiryData.map(r => ({ value: r.รหัสสินค้า, label: `${r.รหัสสินค้า} - ${r.ชื่อสินค้า}` }));
    } else if (activeTab === 'turnover') {
      list = (currentTurnoverData.products || []).map(p => ({ value: p[0], label: `${p[0]} - ${p[1]}` }));
    } else if (activeTab === 'inventory') {
      list = currentInventoryData.map(r => ({ value: r.item_id, label: `${r.item_id} - ${r.name}` }));
    } else if (activeTab === 'dispatch') {
      list = (currentDispatchData.products || []).map(p => ({ value: p[0], label: `${p[0]} - ${p[1]}` }));
    }

    const seen = new Set();
    return list.filter(item => {
      if (!item.value || seen.has(item.value)) return false;
      seen.add(item.value);
      return true;
    }).sort((a, b) => a.value.localeCompare(b.value));
  }, [activeTab, currentStagnantData, currentExpiryData, currentTurnoverData, currentInventoryData, currentDispatchData]);

  // Available years calculation
  const availableYears = useMemo(() => {
    const years = new Set();
    currentStagnantData.forEach(row => {
      const dateStr = row.วันโอน || row.วันที่เคลื่อนไหวล่าสุด || row.วันที่เคลื่อนไหวล่าสุ;
      if (isValidISODate(dateStr)) {
        years.add(dateStr.split('-')[0]);
      }
    });
    return Array.from(years).sort().reverse();
  }, [currentStagnantData]);

  // Date boundaries calculation
  const datasetDateRange = useMemo(() => {
    let minD = new Date(2021, 0, 1);
    let maxD = new Date(2026, 11, 31);

    let dates = [];
    if (activeTab === 'expiry' && currentExpiryData && currentExpiryData.length > 0) {
      dates = currentExpiryData.map(row => row['วันหมดอายุ']).filter(Boolean);
    } else if (activeTab === 'dispatch' && currentDispatchData && currentDispatchData.transactions && currentDispatchData.transactions.length > 0) {
      dates = currentDispatchData.transactions.map(row => row[0]).filter(Boolean);
    } else if (activeTab === 'turnover' && currentTurnoverData && currentTurnoverData.months && currentTurnoverData.months.length > 0) {
      dates = currentTurnoverData.months.map(m => `${m}-01`);
    }

    if (dates.length > 0) {
      let minTime = Infinity;
      let maxTime = -Infinity;
      for (let i = 0; i < dates.length; i++) {
        const t = new Date(dates[i]).getTime();
        if (!isNaN(t)) {
          if (t < minTime) minTime = t;
          if (t > maxTime) maxTime = t;
        }
      }
      if (minTime !== Infinity) minD = new Date(minTime);
      if (maxTime !== -Infinity) maxD = new Date(maxTime);
    }

    return { minDate: minD, maxDate: maxD };
  }, [activeTab, currentExpiryData, currentDispatchData, currentTurnoverData]);

  const handleClearFilters = () => {
    setStartDate(null);
    setEndDate(null);
    setSelectedWarehouses([]);
    setSelectedProducts([]);
    setSelectedYear('All');
  };

  const getTabTitle = () => {
    const titles = {
      stagnant: 'วิเคราะห์ข้อมูลสินค้าไม่เคลื่อนไหวเกิน 1 ปี',
      expiry: 'วิเคราะห์ข้อมูลสินค้าหมดอายุและใกล้หมดอายุ',
      turnover: 'วิเคราะห์อัตราการหมุนเวียนของเวชภัณฑ์',
      inventory: 'วิเคราะห์ข้อมูลระดับสินค้าคงคลังและสถานะสต็อก',
      dispatch: 'วิเคราะห์ข้อมูลรายการจ่ายสินค้าไปยังคลังย่อยหรือหน่วยงาน'
    };
    return titles[activeTab] || 'Executive Dashboard';
  };

  const getTabSubtitle = () => {
    const subtitles = {
      stagnant: 'แผงควบคุมวิเคราะห์ข้อมูลสินค้าคงคลังที่ไม่มีการเคลื่อนไหวเกิน 1 ปี',
      expiry: 'แผงควบคุมติดตามสถานะสินค้าหมดอายุและเฝ้าระวังสินค้าใกล้หมดอายุ',
      turnover: 'แผงควบคุมวิเคราะห์อัตราการหมุนเวียนและทิศทางธุรกรรมการโอนย้ายของเวชภัณฑ์',
      inventory: 'แผงควบคุมติดตามระดับสินค้าคงคลังและการแบ่งเกณฑ์วิกฤต (Min/Max)',
      dispatch: 'แผงควบคุมประวัติการจ่ายเวชภัณฑ์ไปยังคลังย่อยหรือหน่วยงานปลายทาง'
    };
    return subtitles[activeTab] || 'Executive Suite';
  };

  const currentTabUploadedFile = uploadedFiles[activeTab];

  return (
    <div className="app-container">
      {/* Sidebar navigation */}
      <Sidebar 
        activeTab={activeTab} 
        onChangeTab={(tab) => {
          setActiveTab(tab);
          if (tab !== 'stagnant') setSelectedYear('All');
        }}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        isLiveDb={isLiveDb}
        dataSourceMode={dataSourceMode}
        onSelectDatabaseMode={handleSelectDatabaseMode}
        onSelectExcelMode={() => setDataSourceMode('excel')}
        isLoading={isCurrentTabLoading}
        lastSyncedAt={snapshotMeta?.lastSyncedAt}
      />

      {/* Main panel container */}
      <div className="main-wrapper">
        {/* Header row */}
        <header className="header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="header-title-area">
            <h1 id="page-title">{getTabTitle()}</h1>
            <p id="page-subtitle">{getTabSubtitle()}</p>
          </div>

          {dataSourceMode === 'database' && (
            <button
              type="button"
              onClick={handleSyncSnapshot}
              disabled={isSyncingSnapshot}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid #10b981',
                backgroundColor: isSyncingSnapshot ? 'rgba(16, 185, 129, 0.1)' : '#10b981',
                color: isSyncingSnapshot ? '#10b981' : '#ffffff',
                fontSize: '0.84rem',
                fontWeight: 600,
                cursor: isSyncingSnapshot ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)',
                transition: 'all 0.2s ease'
              }}
              title="ดึงข้อมูลสรุปล่าสุดจาก PostgreSQL โรงพยาบาลมาเก็บในเครื่องทันที"
            >
              <RefreshCw size={15} className={isSyncingSnapshot ? 'animate-spin' : ''} />
              <span>{isSyncingSnapshot ? 'กำลังซิงค์ข้อมูล...' : 'ซิงค์ข้อมูลสด (Sync Now)'}</span>
            </button>
          )}
        </header>

        {/* Toast Notification */}
        {toastMessage && (
          <div 
            style={{
              margin: '0 24px 12px 24px',
              padding: '10px 16px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: toastMessage.type === 'success' ? '#ecfdf5' : (toastMessage.type === 'error' ? '#fef2f2' : '#eff6ff'),
              border: `1px solid ${toastMessage.type === 'success' ? '#10b981' : (toastMessage.type === 'error' ? '#ef4444' : '#3b82f6')}`,
              color: toastMessage.type === 'success' ? '#065f46' : (toastMessage.type === 'error' ? '#991b1b' : '#1e40af'),
              fontSize: '0.875rem',
              fontWeight: 500,
              boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {toastMessage.type === 'success' && <CheckCircle2 size={18} style={{ color: '#10b981' }} />}
              {toastMessage.type === 'error' && <AlertCircle size={18} style={{ color: '#ef4444' }} />}
              {toastMessage.type === 'info' && <RotateCcw size={18} style={{ color: '#3b82f6' }} />}
              <span>{toastMessage.text}</span>
            </div>
            <button 
              type="button" 
              onClick={() => setToastMessage(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* If in Excel Mode and file is uploaded for this tab, show file info bar */}
        {dataSourceMode === 'excel' && currentTabUploadedFile && (
          <div 
            style={{
              margin: '0 24px 16px 24px',
              padding: '10px 16px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              color: '#1e40af',
              fontSize: '0.875rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileSpreadsheet size={18} style={{ color: '#2563eb' }} />
              <span>
                <strong>โหมดไฟล์ Excel:</strong> แสดงข้อมูลจาก <u>{currentTabUploadedFile.fileName}</u> ({currentTabUploadedFile.rowCount.toLocaleString()} แถว)
              </span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* Change file for this tab */}
              <div>
                <input 
                  type="file" 
                  id={`tab-change-file-${activeTab}`}
                  onChange={handleFileUpload} 
                  accept=".xlsx,.xls,.csv" 
                  style={{ display: 'none' }} 
                />
                <label 
                  htmlFor={`tab-change-file-${activeTab}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    backgroundColor: '#3b82f6',
                    color: '#ffffff',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <UploadCloud size={14} />
                  <span>เปลี่ยนไฟล์</span>
                </label>
              </div>

              {/* Reset to empty */}
              <button 
                type="button" 
                onClick={() => handleResetUploadedFile(activeTab)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#dc2626',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                ลบไฟล์นี้
              </button>
            </div>
          </div>
        )}

        {/* Dashboard Scrollable Content */}
        <div className="dashboard-content">
          {/* Global Control Panel */}
          {hasActiveTabData && (
            <section className="control-panel">
              <div className="filters-left">
                {/* 1. Warehouse selection */}
                <MultiselectDropdown 
                  label="เปรียบเทียบจากคลัง"
                  options={availableWarehouses.map(w => ({ value: w, label: w }))}
                  selectedValues={selectedWarehouses}
                  onChange={setSelectedWarehouses}
                  placeholder="เลือกคลังสินค้า..."
                  width="220px"
                />

                {/* 2. Product selection */}
                <MultiselectDropdown 
                  label="ค้นหาชื่อสินค้า"
                  options={availableProducts}
                  selectedValues={selectedProducts}
                  onChange={setSelectedProducts}
                  placeholder="ค้นหาหรือเลือกยา..."
                  width="380px"
                />

                {/* 3. Date range selection */}
                {activeTab !== 'stagnant' && activeTab !== 'inventory' && activeTab !== 'turnover' && (
                  <DateSlicer 
                    id="filter-expiry-container"
                    label="ช่วงเวลาที่หมดอายุ"
                    startDate={startDate}
                    endDate={endDate}
                    minDate={datasetDateRange.minDate}
                    maxDate={datasetDateRange.maxDate}
                    placeholder={
                      activeTab === 'turnover' ? "Movement Date Range" : 
                      (activeTab === 'dispatch' ? "ช่วงการจ่าย" : "Expiry Date Range")
                    }
                    onChangeRange={(start, end) => {
                      setStartDate(start);
                      setEndDate(end);
                    }}
                  />
                )}

                {/* 4. Year selection (only visible on Stagnant) */}
                {activeTab === 'stagnant' && (
                  <div className="filter-group-container" id="filter-year-container">
                    <span className="filter-label" id="filter-year-label">ปีที่ทำรายการล่าสุด</span>
                    <select 
                      id="filter-year"
                      className="filter-select"
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(e.target.value)}
                      style={{ height: '42px', width: '200px' }}
                    >
                      <option value="All">ทุกปีที่ทำรายการ</option>
                      {availableYears.map(yr => (
                        <option key={yr} value={yr}>ปี {yr}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Quick Reset Filter */}
              <button 
                id="btn-reset-filters" 
                className="btn-primary" 
                style={{ backgroundColor: 'var(--primary-light)' }}
                onClick={handleClearFilters}
              >
                <RefreshCw size={14} style={{ marginRight: '6px' }} />
                <span>รีเซ็ตตัวกรอง</span>
              </button>
            </section>
          )}

          {/* Active tab content view */}
          {isCurrentTabLoading ? (
            <div className="medical-loading-container">
              <div className="medical-loading-card">
                <div className="medical-spinner-wrapper">
                  <div className="medical-spinner-ring"></div>
                  <div className="medical-spinner-inner"></div>
                  <Activity className="medical-spinner-icon" size={24} />
                </div>
                <div className="medical-loading-title">กำลังดึงข้อมูลเวชภัณฑ์...</div>
                <div className="medical-loading-subtext">กำลังประมวลผลข้อมูลและคำนวณกราฟิกสถิติ</div>
              </div>
            </div>
          ) : !hasActiveTabData ? (
            <EmptyState 
              tabName={getTabTitle()}
              onFileUpload={handleFileUpload}
            />
          ) : (
            <>
              {activeTab === 'stagnant' && (
                <StagnantTab 
                  rawDataset={currentStagnantData}
                  selectedWarehouses={selectedWarehouses}
                  selectedProducts={selectedProducts}
                  selectedYear={selectedYear}
                />
              )}
              {activeTab === 'expiry' && (
                <ExpiryTab 
                  rawExpiryDataset={currentExpiryData}
                  selectedWarehouses={selectedWarehouses}
                  selectedProducts={selectedProducts}
                  startDate={startDate}
                  endDate={endDate}
                />
              )}
              {activeTab === 'turnover' && (
                <TurnoverTab 
                  turnoverData={currentTurnoverData}
                  selectedWarehouses={selectedWarehouses}
                  selectedProducts={selectedProducts}
                  startDate={startDate}
                  endDate={endDate}
                />
              )}
              {activeTab === 'inventory' && (
                <InventoryTab 
                  rawInventoryDataset={currentInventoryData}
                  selectedWarehouses={selectedWarehouses}
                  selectedProducts={selectedProducts}
                  startDate={startDate}
                  endDate={endDate}
                />
              )}
              {activeTab === 'dispatch' && (
                <DispatchTab 
                  dispatchData={currentDispatchData}
                  selectedWarehouses={selectedWarehouses}
                  selectedProducts={selectedProducts}
                  startDate={startDate}
                  endDate={endDate}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
