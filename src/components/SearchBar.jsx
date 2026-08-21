import React from 'react';
import { Search } from 'lucide-react';

export default function SearchBar({ 
  value, 
  onChange, 
  placeholder = 'ค้นหา...', 
  width = 'auto', 
  maxWidth = '320px',
  className = '' 
}) {
  return (
    <div 
      className={`search-container ${className}`} 
      style={{ 
        display: 'flex', 
        alignItems: 'center', 
        background: 'var(--input-bg)', 
        border: '1px solid var(--border)', 
        borderRadius: '6px', 
        padding: '6px 10px', 
        gap: '8px',
        width: width,
        maxWidth: maxWidth
      }}
    >
      <Search size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      <input 
        type="text" 
        placeholder={placeholder} 
        value={value}
        onChange={onChange}
        style={{ 
          background: 'none', 
          border: 'none', 
          color: 'inherit', 
          outline: 'none', 
          fontSize: '0.85rem',
          width: '100%'
        }}
      />
    </div>
  );
}
