import React from 'react';
import { UploadCloud, FileSpreadsheet } from 'lucide-react';

export default function EmptyState({ onFileUpload, tabName }) {
  const fileInputId = `empty-state-file-input-${Math.random().toString(36).substring(7)}`;

  return (
    <div 
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px',
        padding: '48px 24px',
        background: 'var(--card-bg, #ffffff)',
        borderRadius: '16px',
        border: '1px dashed var(--border, #cbd5e1)',
        textAlign: 'center',
        margin: '20px 0',
        boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
      }}
    >
      <div 
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '20px',
          color: 'var(--primary, #0ea5e9)'
        }}
      >
        <FileSpreadsheet size={32} />
      </div>

      <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text, #1e293b)', marginBottom: '8px' }}>
        ยังไม่มีข้อมูลสำหรับ {tabName || 'หน้านี้'}
      </h2>
      
      <p style={{ maxWidth: '540px', color: 'var(--text-muted, #64748b)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '24px' }}>
        นำเข้าไฟล์ Excel / CSV (.xlsx, .csv) จากในเครื่องของคุณ
      </p>

      {/* Import File Button via hidden file input + styled label */}
      <div>
        <input 
          type="file" 
          id={fileInputId} 
          onChange={onFileUpload} 
          accept=".xlsx,.xls,.csv" 
          style={{ display: 'none' }} 
        />
        <label
          htmlFor={fileInputId}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 28px',
            backgroundColor: 'var(--primary, #0ea5e9)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '10px',
            fontSize: '0.98rem',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(14, 165, 233, 0.3)',
            transition: 'all 0.2s ease'
          }}
        >
          <UploadCloud size={20} />
          <span>นำเข้าไฟล์ Excel / CSV</span>
        </label>
      </div>
    </div>
  );
}
