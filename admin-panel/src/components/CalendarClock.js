import React, { useState, useEffect } from 'react';

const CalendarClock = ({ isCompact = false }) => {
  // Initialize time immediately
  const getInitialTime = () => {
    const nowLocal = new Date();
    const hours = nowLocal.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hh = ((hours + 11) % 12) + 1;
    const mm = (nowLocal.getMinutes() < 10 ? '0' : '') + nowLocal.getMinutes();
    const ss = (nowLocal.getSeconds() < 10 ? '0' : '') + nowLocal.getSeconds();
    return `${hh}:${mm}:${ss} ${ampm}`;
  };

  const getInitialDate = () => {
    const nowLocal = new Date();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const weekday = nowLocal.toLocaleString(undefined, { weekday: 'long' });
    return `${weekday}, ${monthNames[nowLocal.getMonth()]} ${nowLocal.getDate()}, ${nowLocal.getFullYear()}`;
  };

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [timeText, setTimeText] = useState(getInitialTime());
  const [dateText, setDateText] = useState(getInitialDate());

  const now = new Date();
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const pad = (n) => n < 10 ? '0' + n : n;

  // Demo events structure - populate with your jobs/events
  // Format: { 'YYYY-MM-DD': [{id, title, count}] }
  // Example:
  // const demoEvents = {
  //   '2024-12-03': [{id: 1, title: 'Job', count: 5}],
  //   '2024-12-04': [{id: 2, title: 'Job', count: 3}],
  // };
  const demoEvents = {
    // Add your events here in YYYY-MM-DD format
  };

  // Update clock every second
  useEffect(() => {
    const updateTime = () => {
      const nowLocal = new Date();
      const hours = nowLocal.getHours();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const hh = ((hours + 11) % 12) + 1;
      const mm = pad(nowLocal.getMinutes());
      const ss = pad(nowLocal.getSeconds());
      setTimeText(`${hh}:${mm}:${ss} ${ampm}`);

      const weekday = nowLocal.toLocaleString(undefined, { weekday: 'long' });
      const full = `${weekday}, ${monthNames[nowLocal.getMonth()]} ${nowLocal.getDate()}, ${nowLocal.getFullYear()}`;
      setDateText(full);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handlePrevMonth = () => {
    let newMonth = viewMonth - 1;
    let newYear = viewYear;
    if (newMonth < 0) {
      newMonth = 11;
      newYear--;
    }
    setViewMonth(newMonth);
    setViewYear(newYear);
  };

  const handleNextMonth = () => {
    let newMonth = viewMonth + 1;
    let newYear = viewYear;
    if (newMonth > 11) {
      newMonth = 0;
      newYear++;
    }
    setViewMonth(newMonth);
    setViewYear(newYear);
  };

  const handleDayClick = (day) => {
    const clickedDate = new Date(viewYear, viewMonth, day);
    setSelectedDate(clickedDate);
  };

  // Build calendar days
  const renderCalendarDays = () => {
    const days = [];
    const firstDay = new Date(viewYear, viewMonth, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();

    // Previous month's tail
    for (let i = 0; i < startWeekday; i++) {
      const dayNum = prevMonthDays - (startWeekday - 1) + i;
      days.push(
        <div key={`prev-${i}`} className="calendar-day muted">
          {dayNum}
        </div>
      );
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const thisDate = new Date(viewYear, viewMonth, d);
      const dateStr = thisDate.toISOString().split('T')[0];
      const isToday = thisDate.toDateString() === now.toDateString();
      const isSelected = selectedDate && thisDate.toDateString() === selectedDate.toDateString();
      const events = demoEvents[dateStr] || [];

      days.push(
        <div
          key={d}
          className={`calendar-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
          onClick={() => handleDayClick(d)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleDayClick(d);
            }
          }}
        >
          <div className="day-number">{d}</div>
          {events.length > 0 && (
            <div className="day-events">
              {events.map((event, idx) => (
                <div key={idx} className="event-badge">
                  {event.count} {event.title}s
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    // Trailing days
    const totalCells = startWeekday + daysInMonth;
    const trailing = (7 - (totalCells % 7)) % 7;
    for (let j = 1; j <= trailing; j++) {
      days.push(
        <div key={`next-${j}`} className="calendar-day muted">
          {j}
        </div>
      );
    }

    return days;
  };

  return (
    <div style={styles.container}>
      <style>{globalStyles}</style>

      {/* Real-time Clock - Fixed Top Right */}
      <div style={styles.clockWidget}>
        <div style={styles.timeDisplay}>{timeText}</div>
        <div style={styles.dateDisplay}>{dateText}</div>
      </div>

      {/* Calendar Container */}
      <div style={styles.calendarContainer}>
        {/* Header with Navigation */}
        <div style={styles.header}>
          <div style={styles.monthNav}>
            <button style={styles.navBtn} onClick={handlePrevMonth} aria-label="Previous month">
              ← Prev
            </button>
            <div style={styles.monthLabel}>
              {monthNames[viewMonth]} {viewYear}
            </div>
            <button style={styles.navBtn} onClick={handleNextMonth} aria-label="Next month">
              Next →
            </button>
          </div>
        </div>

        {/* Day-of-week Headers */}
        <div style={styles.dowContainer}>
          {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day) => (
            <div key={day} style={styles.dowHeader}>
              {day.substring(0, 3)}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div style={styles.gridContainer}>
          {renderCalendarDays()}
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    background: '#f9fafb',
    position: 'relative',
    padding: '20px',
    boxSizing: 'border-box',
    gap: '20px',
  },
  clockWidget: {
    position: 'fixed',
    top: '20px',
    right: '20px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: '#fff',
    padding: '6px 12px',
    borderRadius: '6px',
    boxShadow: '0 2px 8px rgba(102, 126, 234, 0.15)',
    zIndex: 9999,
    minWidth: '140px',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  timeDisplay: {
    fontSize: '16px',
    fontWeight: '800',
    letterSpacing: '0.3px',
    fontFamily: 'monospace',
    marginBottom: '2px',
    color: '#fff',
  },
  dateDisplay: {
    fontSize: '9px',
    fontWeight: '500',
    opacity: '0.95',
    letterSpacing: '0.2px',
    color: '#fff',
  },
  calendarContainer: {
    flex: '1',
    display: 'flex',
    flexDirection: 'column',
    background: '#fff',
    borderRadius: '8px',
    boxShadow: 'none',
    padding: '12px',
    overflow: 'hidden',
  },
  header: {
    marginBottom: '10px',
    textAlign: 'center',
  },
  monthNav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  navBtn: {
    padding: '4px 8px',
    border: '1px solid #e5e7eb',
    background: '#fff',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '11px',
    color: '#374151',
    transition: 'all 0.2s ease',
  },
  monthLabel: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#1f2937',
    minWidth: '100px',
  },
  dowContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '2px',
    marginBottom: '6px',
    paddingBottom: '4px',
    borderBottom: '1px solid #f3f4f6',
  },
  dowHeader: {
    textAlign: 'center',
    fontWeight: '600',
    fontSize: '10px',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.2px',
    padding: '2px 0',
  },
  gridContainer: {
    flex: '1',
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '3px',
    minHeight: '0',
  },
  compactContainer: {
    display: 'flex',
    alignItems: 'center',
    height: 'auto',
    background: 'transparent',
    position: 'relative',
    padding: '0',
    boxSizing: 'border-box',
    gap: '0',
    overflow: 'visible'
  },
  compactClockWidget: {
    position: 'relative',
    top: '0',
    right: '0',
    background: 'transparent',
    color: '#374151',
    padding: '4px 0',
    borderRadius: '0',
    boxShadow: 'none',
    zIndex: '1',
    minWidth: 'auto',
    backdropFilter: 'none',
    border: 'none',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  compactTimeDisplay: {
    fontSize: '14px',
    fontWeight: '700',
    letterSpacing: '0.2px',
    fontFamily: 'monospace',
    marginBottom: '0px',
    color: '#374151',
  },
  compactDateDisplay: {
    fontSize: '11px',
    fontWeight: '500',
    opacity: '0.7',
    letterSpacing: '0.1px',
    color: '#6b7280',
  },
};

const globalStyles = `
  .calendar-day {
    aspect-ratio: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding: 6px 4px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
    background: #f9fafb;
    border: 1px solid transparent;
    position: relative;
    min-height: 60px;
    font-size: 12px;
  }

  .calendar-day:hover:not(.muted) {
    background: #f3f4f6;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }

  .calendar-day.muted {
    color: #d1d5db;
    cursor: default;
    background: transparent;
  }

  .calendar-day.today {
    border-color: #3b82f6;
    border-width: 2px;
    background: rgba(59, 130, 246, 0.05);
  }

  .calendar-day.selected {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
    border-color: #667eea;
    box-shadow: 0 8px 24px rgba(102, 126, 234, 0.3);
  }

  .calendar-day.selected .event-badge {
    background: rgba(255, 255, 255, 0.25);
    color: #fff;
  }

  .day-number {
    font-weight: 700;
    font-size: 11px;
    margin-bottom: 1px;
  }

  .day-events {
    display: flex;
    flex-direction: column;
    gap: 1px;
    width: 100%;
    flex: 1;
    justify-content: center;
  }

  .event-badge {
    background: #fee2e2;
    color: #991b1b;
    padding: 1px 2px;
    border-radius: 2px;
    font-size: 7px;
    font-weight: 600;
    text-align: center;
    line-height: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  @media (max-width: 1200px) {
    .calendar-day {
      padding: 8px 6px;
      min-height: 80px;
      font-size: 14px;
    }
    .day-number {
      font-size: 14px;
    }
    .event-badge {
      font-size: 9px;
    }
  }

  @media (max-width: 768px) {
    .calendar-day {
      padding: 6px 4px;
      min-height: 60px;
      font-size: 12px;
    }
    .day-number {
      font-size: 12px;
    }
    .event-badge {
      font-size: 8px;
    }
  }
`;

export default CalendarClock;
