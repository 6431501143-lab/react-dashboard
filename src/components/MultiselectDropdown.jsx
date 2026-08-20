import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, ChevronDown } from 'lucide-react';

export default function MultiselectDropdown({ 
  label, 
  options = [], // [{ value, label }] or [string]
  selectedValues = [], // [string]
  onChange, 
  placeholder = 'เลือกรายการ...',
  allLabel = 'ทั้งหมด',
  searchPlaceholder = 'ค้นหา...',
  width = '280px'
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);

  // Normalize options to [{ value, label }]
  const normalizedOptions = useMemo(() => {
    return options.map(opt => {
      if (typeof opt === 'object' && opt !== null) {
        return { value: opt.value, label: opt.label || opt.value };
      }
      return { value: opt, label: opt };
    });
  }, [options]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter options based on search term
  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return normalizedOptions;
    const term = searchTerm.toLowerCase().trim();
    return normalizedOptions.filter(opt => 
      opt.label.toLowerCase().includes(term) || 
      opt.value.toLowerCase().includes(term)
    );
  }, [normalizedOptions, searchTerm]);

  const handleSelectAll = () => {
    onChange(normalizedOptions.map(opt => opt.value));
  };

  const handleClearAll = () => {
    onChange([]);
  };

  const handleToggleOption = (value) => {
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter(val => val !== value));
    } else {
      onChange([...selectedValues, value]);
    }
  };

  const getTriggerText = () => {
    console.log(`[MultiselectDropdown] label: ${label}, options count: ${normalizedOptions.length}, selected: ${selectedValues.length}`);
    if (selectedValues.length === 0) {
      if (label === 'เปรียบเทียบจากคลัง') return `คลังทั้งหมด (${normalizedOptions.length} คลัง)`;
      if (label === 'ค้นหาชื่อสินค้า') return `สินค้าทั้งหมด (${normalizedOptions.length} รายการ)`;
      return placeholder;
    }
    if (selectedValues.length === normalizedOptions.length) {
      return `${allLabel} (${normalizedOptions.length})`;
    }
    return `เลือกแล้ว ${selectedValues.length} รายการ`;
  };

  return (
    <div className="filter-group-container" ref={containerRef} style={{ width: width }}>
      {label && <span className="filter-label">{label}</span>}
      <div className="custom-dropdown" style={{ position: 'relative', width: '100%' }}>
        <button 
          type="button"
          className="dropdown-trigger" 
          onClick={() => setIsOpen(!isOpen)}
          style={{ width: '100%', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <span>{getTriggerText()}</span>
          <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />
        </button>

        {isOpen && (
          <div className="dropdown-menu show" style={{ display: 'block', position: 'absolute', top: '100%', left: 0, width: '100%', zIndex: 1000 }}>
            <div className="dropdown-search">
              <input 
                type="text" 
                placeholder={searchPlaceholder} 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="dropdown-actions">
              <button type="button" onClick={handleSelectAll}>เลือกทั้งหมด</button>
              <button type="button" onClick={handleClearAll}>ล้างทั้งหมด</button>
            </div>
            <div className="dropdown-options-list" style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {filteredOptions.length === 0 ? (
                <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  ไม่พบรายการ
                </div>
              ) : (
                filteredOptions.map((opt) => {
                  const isChecked = selectedValues.includes(opt.value);
                  return (
                    <div 
                      key={opt.value} 
                      className="dropdown-option-item"
                      onClick={() => handleToggleOption(opt.value)}
                      style={{ display: 'flex', alignItems: 'flex-start', padding: '8px 12px', cursor: 'pointer', gap: '8px' }}
                    >
                      <input 
                        type="checkbox" 
                        checked={isChecked}
                        readOnly 
                        style={{ cursor: 'pointer', marginTop: '3px' }}
                      />
                      <span 
                        style={{ fontSize: '0.85rem', whiteSpace: 'normal', wordBreak: 'break-word', display: 'block' }}
                        title={opt.label}
                      >
                        {opt.label}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
