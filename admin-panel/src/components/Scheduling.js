import React, { useState, useEffect } from 'react';
import dataService from '../services/dataService';
import './Scheduling.css';

const Scheduling = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tickets, setTickets] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [selectedTech, setSelectedTech] = useState('');
  const [currentTime, setCurrentTime] = useState(getFormattedTime());

  // Get formatted 12-hour time with HH:MM AM/PM format
  function getFormattedTime() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = String(hours % 12 || 12).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    return `${displayHours}:${mm} ${ampm}`;
  }

  useEffect(() => {
    loadData();
  }, []);

  // Update clock every second
  useEffect(() => {
    const updateClock = () => {
      setCurrentTime(getFormattedTime());
    };
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    const loadedTickets = await dataService.getTickets();
    const loadedTechnicians = await dataService.getTechnicians();
    setTickets(loadedTickets);
    setTechnicians(loadedTechnicians.filter(t => t.status === 'active' || !t.status));
  };

  // Get days in month
  const getDaysInMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  // Get first day of month
  const getFirstDayOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  // Get jobs for specific date
  const getJobsForDate = (day) => {
    const dateStr = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
      .toISOString().split('T')[0];
    return tickets.filter(t => t.createdAt === dateStr || t.scheduledDate === dateStr);
  };

  // Navigate months
  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  // Handle job assignment
  const handleAssignJob = async (ticket) => {
    setSelectedTicket(ticket);
    setShowAssignModal(true);
  };

  const confirmAssign = async () => {
    if (!selectedTech) {
      alert('Please select a technician');
      return;
    }

    const selectedTechnician = technicians.find(t => t.id === selectedTech);
    await dataService.updateTicket(selectedTicket.id, {
      assignedTo: selectedTechnician.name,
      assignedToId: selectedTech,
      status: 'assigned'
    });

    setTickets(tickets.map(t => 
      t.id === selectedTicket.id 
        ? { ...t, assignedTo: selectedTechnician.name, assignedToId: selectedTech, status: 'assigned' }
        : t
    ));

    setShowAssignModal(false);
    setSelectedTicket(null);
    setSelectedTech('');
  };

  // Render calendar
  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const days = [];

    // Empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
    }

    // Days of month
    for (let day = 1; day <= daysInMonth; day++) {
      const jobsForDay = getJobsForDate(day);
      const isToday = new Date().toDateString() === new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toDateString();

      days.push(
        <div 
          key={day} 
          className={`calendar-day ${isToday ? 'today' : ''}`}
          onClick={() => setSelectedDate(day)}
        >
          <div className="day-number">{day}</div>
          <div className="jobs-count">
            {jobsForDay.length > 0 && (
              <span className="badge">{jobsForDay.length} jobs</span>
            )}
          </div>
          <div className="mini-jobs">
            {jobsForDay.slice(0, 2).map(job => (
              <div key={job.id} className="mini-job" title={job.title}>
                {job.title.substring(0, 15)}...
              </div>
            ))}
          </div>
        </div>
      );
    }

    return days;
  };

  // Get selected date jobs
  const selectedDateJobs = selectedDate ? getJobsForDate(selectedDate) : [];

  return (
    <div className="content scheduling-container">
      <div className="scheduling-header">
        <h1>Job Scheduling & Calendar</h1>
        <div className="month-nav">
          <button className="btn-small" onClick={previousMonth}>← Previous</button>
          <h2>{currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h2>
          <button className="btn-small" onClick={nextMonth}>Next →</button>
        </div>
      </div>

      <div className="scheduling-content">
        {/* Full Screen Calendar View */}
        <div className="calendar-section-fullscreen">
          <div className="calendar-grid">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="calendar-header">{day}</div>
            ))}
            {renderCalendar()}
          </div>
          
          {/* Real-time Clock at Bottom */}
          <div className="calendar-clock">
            <div className="clock-display">{currentTime}</div>
          </div>
        </div>

        {/* Selected Date Jobs Modal */}
        {selectedDate && (
          <div className="modal-overlay" onClick={() => setSelectedDate(null)}>
            <div className="selected-date-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Jobs for {new Date(currentDate.getFullYear(), currentDate.getMonth(), selectedDate).toLocaleDateString()}</h3>
                <button className="close-btn" onClick={() => setSelectedDate(null)}>×</button>
              </div>
              
              {selectedDateJobs.length === 0 ? (
                <p className="no-jobs">No jobs scheduled for this date</p>
              ) : (
                <div className="jobs-list">
                  {selectedDateJobs.map(job => (
                    <div key={job.id} className="job-item">
                      <div className="job-info">
                        <h4>{job.title}</h4>
                        <p><strong>Customer:</strong> {job.customerName}</p>
                        <p><strong>Status:</strong> <span className={`status-badge status-${job.status}`}>{job.status}</span></p>
                        <p><strong>Priority:</strong> {job.priority}</p>
                        <p><strong>Assigned To:</strong> {job.assignedTo || 'Unassigned'}</p>
                      </div>
                      {(!job.assignedTo || job.assignedTo === 'Unassigned') && (
                        <button className="btn" onClick={() => handleAssignJob(job)}>
                          Assign Technician
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Assignment Modal */}
      {showAssignModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Assign Technician</h3>
            <p><strong>Job:</strong> {selectedTicket?.title}</p>
            <div className="form-group">
              <label>Select Technician:</label>
              <select 
                value={selectedTech} 
                onChange={(e) => setSelectedTech(e.target.value)}
              >
                <option value="">-- Choose a technician --</option>
                {technicians.map(tech => (
                  <option key={tech.id} value={tech.id}>
                    {tech.name} ({tech.phone})
                  </option>
                ))}
              </select>
            </div>
            <div className="modal-buttons">
              <button className="btn-cancel" onClick={() => setShowAssignModal(false)}>Cancel</button>
              <button className="btn" onClick={confirmAssign}>Assign</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Scheduling;
