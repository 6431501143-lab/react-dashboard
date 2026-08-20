import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Calendar, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronDown } from 'lucide-react';

export default function DateSlicer({ 
  id, 
  label, 
  startDate, 
  endDate, 
  onChangeRange, 
  placeholder, 
  minDate = new Date('2021-01-01'), 
  maxDate = new Date('2030-12-31') 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentViewMonth, setCurrentViewMonth] = useState(() => {
    if (startDate) return new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [hoverDate, setHoverDate] = useState(null);
  const containerRef = useRef(null);

  const refDate = new Date();

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const leftMonth = currentViewMonth;
  const rightMonth = useMemo(() => {
    const d = new Date(leftMonth);
    d.setMonth(leftMonth.getMonth() + 1);
    return d;
  }, [leftMonth]);

  const handlePrevMonth = () => {
    const d = new Date(leftMonth);
    d.setMonth(leftMonth.getMonth() - 1);
    setCurrentViewMonth(d);
  };

  const handleNextMonth = () => {
    const d = new Date(leftMonth);
    d.setMonth(leftMonth.getMonth() + 1);
    setCurrentViewMonth(d);
  };

  const handlePrevYear = () => {
    const d = new Date(leftMonth);
    d.setFullYear(leftMonth.getFullYear() - 1);
    setCurrentViewMonth(d);
  };

  const handleNextYear = () => {
    const d = new Date(leftMonth);
    d.setFullYear(leftMonth.getFullYear() + 1);
    setCurrentViewMonth(d);
  };

  const handleDayClick = (dayDate) => {
    if (!startDate || (startDate && endDate)) {
      onChangeRange(dayDate, null);
    } else {
      if (dayDate < startDate) {
        onChangeRange(dayDate, null);
      } else {
        onChangeRange(startDate, dayDate);
        setIsOpen(false);
      }
    }
  };

  const handlePreset = (presetType) => {
    let start = null;
    let end = null;

    if (presetType === 'this-month') {
      start = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
      end = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0);
    } else if (presetType === 'last-6-months') {
      start = new Date(refDate);
      start.setMonth(refDate.getMonth() - 6);
      end = new Date(refDate);
    } else if (presetType === 'last-12-months') {
      start = new Date(refDate);
      start.setMonth(refDate.getMonth() - 12);
      end = new Date(refDate);
    } else if (presetType === 'this-year') {
      start = new Date(refDate.getFullYear(), 0, 1);
      end = new Date(refDate.getFullYear(), 11, 31);
    } else if (presetType === 'last-year') {
      start = new Date(refDate.getFullYear() - 1, 0, 1);
      end = new Date(refDate.getFullYear() - 1, 11, 31);
    } else if (presetType === 'last-2-years') {
      start = new Date(refDate);
      start.setFullYear(refDate.getFullYear() - 2);
      end = new Date(refDate);
    } else if (presetType === 'last-3-years') {
      start = new Date(refDate);
      start.setFullYear(refDate.getFullYear() - 3);
      end = new Date(refDate);
    } else if (presetType === 'all-time') {
      start = null;
      end = null;
    }

    onChangeRange(start, end);
    if (start) {
      setCurrentViewMonth(new Date(start.getFullYear(), start.getMonth(), 1));
    } else {
      const d = new Date();
      d.setMonth(d.getMonth() - 1);
      setCurrentViewMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    }
    setIsOpen(false);
  };

  const formatDateShort = (date) => {
    if (!date) return '';
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  const getRangeDisplayText = () => {
    if (startDate && endDate) {
      return `${formatDateShort(startDate)} - ${formatDateShort(endDate)}`;
    } else if (startDate) {
      return formatDateShort(startDate);
    } else {
      return placeholder || 'Expiry Date Range';
    }
  };

  const renderMonthGrid = (monthDate) => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    const days = [];
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-day empty" />);
    }

    for (let d = 1; d <= totalDays; d++) {
      const dayDate = new Date(year, month, d);
      
      let dayClass = 'calendar-day';
      const isStart = startDate && dayDate.toDateString() === startDate.toDateString();
      const isEnd = endDate && dayDate.toDateString() === endDate.toDateString();
      const inRange = startDate && endDate && dayDate > startDate && dayDate < endDate;
      const isHovered = startDate && !endDate && hoverDate && dayDate > startDate && dayDate <= hoverDate;

      if (isStart) dayClass += ' start-date';
      if (isEnd) dayClass += ' end-date';
      if (inRange) dayClass += ' in-range';
      if (isHovered) dayClass += ' hover-in-range';

      days.push(
        <div 
          key={`day-${d}`} 
          className={dayClass}
          onClick={() => handleDayClick(dayDate)}
          onMouseEnter={() => startDate && !endDate && setHoverDate(dayDate)}
        >
          {d}
        </div>
      );
    }
    return days;
  };

  const engMonths = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const isPrevMonthDisabled = useMemo(() => {
    const newD = new Date(leftMonth.getFullYear(), leftMonth.getMonth() - 1, 1);
    const minYear = minDate.getFullYear();
    const minMonth = minDate.getMonth();
    return (newD.getFullYear() < minYear) || (newD.getFullYear() === minYear && newD.getMonth() < minMonth);
  }, [leftMonth, minDate]);

  const isPrevYearDisabled = useMemo(() => {
    const newD = new Date(leftMonth.getFullYear() - 1, leftMonth.getMonth(), 1);
    const minYear = minDate.getFullYear();
    const minMonth = minDate.getMonth();
    return (newD.getFullYear() < minYear) || (newD.getFullYear() === minYear && newD.getMonth() < minMonth);
  }, [leftMonth, minDate]);

  const isNextMonthDisabled = useMemo(() => {
    const newD = new Date(rightMonth.getFullYear(), rightMonth.getMonth() + 1, 1);
    const maxYear = maxDate.getFullYear();
    const maxMonth = maxDate.getMonth();
    return (newD.getFullYear() > maxYear) || (newD.getFullYear() === maxYear && newD.getMonth() > maxMonth);
  }, [rightMonth, maxDate]);

  const isNextYearDisabled = useMemo(() => {
    const newD = new Date(rightMonth.getFullYear() + 1, rightMonth.getMonth(), 1);
    const maxYear = maxDate.getFullYear();
    const maxMonth = maxDate.getMonth();
    return (newD.getFullYear() > maxYear) || (newD.getFullYear() === maxYear && newD.getMonth() > maxMonth);
  }, [rightMonth, maxDate]);

  return (
    <div className="filter-group-container" id={id} ref={containerRef}>
      {label && <span className="filter-label">{label}</span>}
      <div className="custom-dropdown" style={{ position: 'relative', width: '260px' }}>
        <button 
          type="button" 
          className="dropdown-trigger" 
          onClick={() => setIsOpen(!isOpen)} 
          style={{ width: '100%', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={16} style={{ color: 'var(--secondary)' }} />
            <span>{getRangeDisplayText()}</span>
          </div>
          <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />
        </button>

        {isOpen && (
          <div className="dropdown-menu date-picker-menu show" style={{ position: 'absolute', top: '100%', left: 0, marginTop: '4px', display: 'block', zIndex: 1000 }}>
            <div className="calendars-container" style={{ display: 'flex', gap: '20px' }}>
              {/* Left Calendar */}
              <div className="calendar-month-view">
                <div className="calendar-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button type="button" onClick={handlePrevYear} disabled={isPrevYearDisabled} style={{ opacity: isPrevYearDisabled ? 0.3 : 1, cursor: isPrevYearDisabled ? 'not-allowed' : 'pointer' }}><ChevronsLeft size={16} /></button>
                    <button type="button" onClick={handlePrevMonth} disabled={isPrevMonthDisabled} style={{ opacity: isPrevMonthDisabled ? 0.3 : 1, cursor: isPrevMonthDisabled ? 'not-allowed' : 'pointer' }}><ChevronLeft size={16} /></button>
                  </div>
                  <span>{engMonths[leftMonth.getMonth()]} {leftMonth.getFullYear()}</span>
                  <div style={{ width: '40px' }} />
                </div>
                <div className="calendar-weekdays" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600 }}>
                  <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
                </div>
                <div className="calendar-days-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                  {renderMonthGrid(leftMonth)}
                </div>
              </div>

              {/* Right Calendar */}
              <div className="calendar-month-view">
                <div className="calendar-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ width: '40px' }} />
                  <span>{engMonths[rightMonth.getMonth()]} {rightMonth.getFullYear()}</span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button type="button" onClick={handleNextMonth} disabled={isNextMonthDisabled} style={{ opacity: isNextMonthDisabled ? 0.3 : 1, cursor: isNextMonthDisabled ? 'not-allowed' : 'pointer' }}><ChevronRight size={16} /></button>
                    <button type="button" onClick={handleNextYear} disabled={isNextYearDisabled} style={{ opacity: isNextYearDisabled ? 0.3 : 1, cursor: isNextYearDisabled ? 'not-allowed' : 'pointer' }}><ChevronsRight size={16} /></button>
                  </div>
                </div>
                <div className="calendar-weekdays" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600 }}>
                  <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
                </div>
                <div className="calendar-days-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                  {renderMonthGrid(rightMonth)}
                </div>
              </div>
            </div>

            <div className="quick-selectors-container" style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Row 1 */}
              <div className="quick-selectors-row" style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="btn-quick-sel" style={{ flex: 1 }} onClick={() => handlePreset('last-6-months')}>Last 6 months</button>
                <button type="button" className="btn-quick-sel" style={{ flex: 1 }} onClick={() => handlePreset('last-12-months')}>Last 12 months</button>
                <button type="button" className="btn-quick-sel" style={{ flex: 1 }} onClick={() => handlePreset('this-year')}>This year</button>
                <button type="button" className="btn-quick-sel" style={{ flex: 1 }} onClick={() => handlePreset('last-year')}>Last year</button>
              </div>
              {/* Row 2 */}
              <div className="quick-selectors-row" style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="btn-quick-sel" style={{ flex: 1 }} onClick={() => handlePreset('last-2-years')}>Last 2 years</button>
                <button type="button" className="btn-quick-sel" style={{ flex: 1 }} onClick={() => handlePreset('last-3-years')}>Last 3 years</button>
                <button type="button" className="btn-quick-sel" style={{ flex: 1 }} onClick={() => handlePreset('all-time')}>All time</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
