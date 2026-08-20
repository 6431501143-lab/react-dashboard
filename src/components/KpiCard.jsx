import React from 'react';

export default function KpiCard({ 
  title, 
  value, 
  icon: Icon, 
  accentClass = 'accent', // 'accent', 'danger', 'success', 'warning', 'info'
  subtext, 
  badgeText, 
  badgeClass,
  onClick,
  className = ''
}) {
  return (
    <div className={`kpi-card ${accentClass} ${className}`} onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
      <div className="kpi-card-header">
        <span className="kpi-title">{title}</span>
        {Icon && (
          <div className="card-icon-wrapper">
            <Icon className="brand-icon" />
          </div>
        )}
      </div>
      
      <div className="kpi-value-container">
        <div className="kpi-value" dangerouslySetInnerHTML={{ __html: value }}></div>
        {badgeText && (
          <span className={`kpi-badge ${badgeClass || ''}`}>
            {badgeText}
          </span>
        )}
      </div>
      
      <p className="kpi-subtext" dangerouslySetInnerHTML={{ __html: subtext }}></p>
    </div>
  );
}
