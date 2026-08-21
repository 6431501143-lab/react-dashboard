import React, { useState, useMemo } from 'react';
import { Search, Download, X, ArrowLeft } from 'lucide-react';
import ResponsiveTable from './ResponsiveTable';
import * as XLSX from 'xlsx';

export default function DrilldownModal({ isOpen, onClose, title, summaryItems = [], headers, rows, filename = 'drilldown_export.xlsx', filterBar, tableMaxWidth = 'none', onRowClick, onBack, disablePills = false }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [directionFilter, setDirectionFilter] = useState('All'); // 'All', 'In', 'Out'

  // Reset search term and filter when closed/reopened
  React.useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setDirectionFilter('All');
    }
  }, [isOpen]);

  // Filter rows based on direction filter and search term
  const filteredRows = useMemo(() => {
    let result = rows;

    // Filter by direction if keys exist
    if (rows[0] && rows[0].hasOwnProperty('qtyIn') && rows[0].hasOwnProperty('qtyOut')) {
      if (directionFilter === 'In') {
        result = result.filter(r => r.qtyIn > 0);
      } else if (directionFilter === 'Out') {
        result = result.filter(r => r.qtyOut > 0);
      }
    }

    if (!searchTerm.trim()) return result;
    const term = searchTerm.toLowerCase().trim();
    return result.filter((row) => {
      return Object.values(row).some((val) => {
        if (val === null || val === undefined) return false;
        return val.toString().toLowerCase().includes(term);
      });
    });
  }, [rows, searchTerm, directionFilter]);

  // Export to Excel helper
  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(rows.map(r => {
      const clean = {};
      headers.forEach(h => {
        clean[h.label] = r[h.key];
      });
      return clean;
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Detail");
    XLSX.writeFile(wb, filename);
  };

  if (!isOpen) return null;

  const showPills = !disablePills && !filterBar && rows[0] && rows[0].hasOwnProperty('qtyIn') && rows[0].hasOwnProperty('qtyOut');

  return (
    <div className="modal-overlay" style={{ display: 'flex' }} onClick={onClose}>
      <div className="modal-content drilldown-card" onClick={(e) => e.stopPropagation()}>
        <div className="drilldown-header" style={{ borderBottom: showPills || filterBar ? 'none' : '1px solid var(--border)', paddingBottom: showPills || filterBar ? '4px' : '12px' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            {onBack && (
              <button 
                onClick={onBack}
                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px', color: 'var(--accent, #3b82f6)' }}
                title="ย้อนกลับ"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            {title}
          </h3>
          <div className="modal-header-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div className="modal-inline-search" style={{ display: 'flex', alignItems: 'center', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: '4px', padding: '4px 8px', gap: '6px' }}>
              <Search size={16} style={{ color: 'var(--text-muted)' }} />
              <input 
                type="text" 
                placeholder="Search item..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ background: 'none', border: 'none', color: 'inherit', outline: 'none', fontSize: '0.85rem' }}
              />
            </div>
            <button 
              className="modal-action-btn" 
              onClick={handleExport}
              title="Export Excel"
              style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '4px', padding: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Download size={16} />
            </button>
            <button 
              className="modal-action-btn" 
              onClick={onClose}
              title="Close" 
              style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '4px', padding: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Pills Filter Bar */}
        {showPills && (
          <div className="modal-pills-bar" style={{ display: 'flex', gap: '10px', padding: '8px 0 12px 0', borderBottom: '1px solid var(--border)', marginBottom: '12px' }}>
            <button
              onClick={() => setDirectionFilter('All')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 16px',
                borderRadius: '50px',
                border: directionFilter === 'All' ? '1.5px solid #2563eb' : '1px solid var(--border)',
                backgroundColor: directionFilter === 'All' ? 'rgba(37, 99, 235, 0.1)' : 'var(--card-bg)',
                color: directionFilter === 'All' ? '#2563eb' : 'var(--text)',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 500,
                transition: 'all 0.2s'
              }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#2563eb' }}></span>
              ทั้งหมด (All)
            </button>
            <button
              onClick={() => setDirectionFilter('In')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 16px',
                borderRadius: '50px',
                border: directionFilter === 'In' ? '1.5px solid #16a34a' : '1px solid var(--border)',
                backgroundColor: directionFilter === 'In' ? 'rgba(22, 163, 74, 0.1)' : 'var(--card-bg)',
                color: directionFilter === 'In' ? '#16a34a' : 'var(--text)',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 500,
                transition: 'all 0.2s'
              }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e' }}></span>
              ขาเข้า (Inbound)
            </button>
            <button
              onClick={() => setDirectionFilter('Out')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 16px',
                borderRadius: '50px',
                border: directionFilter === 'Out' ? '1.5px solid #dc2626' : '1px solid var(--border)',
                backgroundColor: directionFilter === 'Out' ? 'rgba(220, 38, 38, 0.1)' : 'var(--card-bg)',
                color: directionFilter === 'Out' ? '#dc2626' : 'var(--text)',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 500,
                transition: 'all 0.2s'
              }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }}></span>
              ขาออก (Outbound)
            </button>
          </div>
        )}

        {/* Custom filters (e.g. YoY year tabs) */}
        {filterBar}

        {summaryItems.length > 0 && (
          <div className="drilldown-summary-info" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', padding: '8px 0', borderBottom: '1px solid var(--border)', marginBottom: '12px' }}>
            {summaryItems.map((item, idx) => (
              <div key={idx} style={{ fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>{item.label}: </span>
                <strong style={{ color: item.color }}>{item.value}</strong>
              </div>
            ))}
          </div>
        )}

        <div className="modal-table-wrapper" style={{ maxWidth: tableMaxWidth, margin: tableMaxWidth !== 'none' ? '0 auto' : '0', width: '100%', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
          <ResponsiveTable 
            headers={headers} 
            rows={filteredRows} 
            itemsPerPage={11} 
            minHeight="auto"
            tabViewClass="drilldown-table-view"
            onRowClick={onRowClick}
          />
        </div>
      </div>
    </div>
  );
}
