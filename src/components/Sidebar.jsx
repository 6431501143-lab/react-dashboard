import React from 'react';
import { 
  Clock, 
  Hourglass, 
  RefreshCw, 
  Database, 
  Truck, 
  ChevronLeft,
  Package,
  UploadCloud,
  FileSpreadsheet
} from 'lucide-react';

export default function Sidebar({ 
  activeTab, 
  onChangeTab, 
  isCollapsed, 
  setIsCollapsed,
  isLiveDb,
  dataSourceMode, // 'database' | 'excel'
  onSelectDatabaseMode,
  onSelectExcelMode,
  isLoading,
  lastSyncedAt
}) {
  const menuItems = [
    { id: 'stagnant', label: 'สินค้าไม่เคลื่อนไหวเกิน 1 ปี', icon: Clock },
    { id: 'expiry', label: 'สินค้าหมดอายุ', icon: Hourglass },
    { id: 'turnover', label: 'อัตราหมุนเวียนสินค้า', icon: RefreshCw },
    { id: 'inventory', label: 'ยอดสินค้าคงคลัง', icon: Database },
    { id: 'dispatch', label: 'การจ่ายสินค้าไปคลัง', icon: Truck },
  ];

  const isDbActive = dataSourceMode === 'database';
  const isExcelActive = dataSourceMode === 'excel';

  const formatSyncTime = (timestamp) => {
    if (!timestamp) return '19 ส.ค. 2569 08:00 น.';
    let str = String(timestamp).trim();
    // Replace HH:mm:ss with HH:mm น.
    str = str.replace(/:(\d{2}):\d{2}/, ':$1 น.');
    if (!str.includes('น.') && !str.includes('น')) {
      str = `${str} น.`;
    }
    return str;
  };

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-brand">
        <div className="brand-logo">
          <Package className="brand-icon" />
          <span>Vanguard Stock</span>
        </div>
        <button 
          id="btn-sidebar-toggle" 
          className="btn-sidebar-toggle" 
          title="ย่อ/ขยายแถบ"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <ChevronLeft style={{ transform: isCollapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s ease' }} />
        </button>
      </div>
      
      <ul className="sidebar-menu">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <li 
              key={item.id} 
              className={`menu-item ${activeTab === item.id ? 'active' : ''}`}
            >
              <a 
                href="#" 
                onClick={(e) => { 
                  e.preventDefault(); 
                  onChangeTab(item.id); 
                }}
                title={item.label}
              >
                <Icon />
                <span>{item.label}</span>
              </a>
            </li>
          );
        })}
      </ul>
      
      {/* Last Update Info above divider */}
      {!isCollapsed && (
        <div style={{ padding: '0 16px 12px 16px', fontSize: '0.75rem', color: '#94a3b8', lineHeight: 1.4 }}>
          อัปเดตข้อมูลล่าสุด: {formatSyncTime(lastSyncedAt)}
        </div>
      )}

      {/* Bottom-left Data Source Mode Switcher */}
      <div className="sidebar-footer" style={{ padding: isCollapsed ? '12px 8px' : '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {!isCollapsed && (
          <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#cbd5e1', letterSpacing: '0.5px' }}>
            แหล่งข้อมูล (Data Source)
          </div>
        )}

        {/* 1. Connect / Database Mode Button */}
        <button
          type="button"
          onClick={() => onSelectDatabaseMode()}
          title={isLiveDb ? "Connected Database (โหมดฐานข้อมูลสด)" : "Connect Database (เชื่อมต่อฐานข้อมูล)"}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            padding: '10px 12px',
            borderRadius: '8px',
            border: isDbActive 
              ? '1.5px solid #10b981' 
              : '1px solid rgba(255, 255, 255, 0.1)',
            backgroundColor: isDbActive 
              ? 'rgba(16, 185, 129, 0.18)' 
              : 'rgba(255, 255, 255, 0.05)',
            color: isDbActive 
              ? '#34d399' 
              : '#94a3b8',
            fontSize: '0.84rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            width: '100%'
          }}
        >
          <Database size={16} style={{ color: isDbActive ? '#10b981' : '#94a3b8', flexShrink: 0 }} />
          {!isCollapsed && (
            <span style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {isDbActive ? `🟢 ${isLiveDb ? 'Connected Database' : 'Connect Database'}` : (isLiveDb ? 'Connected Database' : 'Connect Database')}
            </span>
          )}
        </button>

        {/* 2. Import Excel / CSV Mode Button */}
        <button
          type="button"
          onClick={() => onSelectExcelMode()}
          title="สลับเข้าสู่โหมดนำเข้าไฟล์ Excel / CSV"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            padding: '10px 12px',
            borderRadius: '8px',
            border: isExcelActive 
              ? '1.5px solid #10b981' 
              : '1px solid rgba(255, 255, 255, 0.1)',
            backgroundColor: isExcelActive 
              ? 'rgba(16, 185, 129, 0.18)' 
              : 'rgba(255, 255, 255, 0.05)',
            color: isExcelActive 
              ? '#34d399' 
              : '#94a3b8',
            fontSize: '0.84rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            width: '100%'
          }}
        >
          <FileSpreadsheet size={16} style={{ color: isExcelActive ? '#10b981' : '#94a3b8', flexShrink: 0 }} />
          {!isCollapsed && (
            <span style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {isExcelActive ? '🟢 Import Excel / CSV' : 'Import Excel / CSV'}
            </span>
          )}
        </button>
      </div>
    </aside>
  );
}
