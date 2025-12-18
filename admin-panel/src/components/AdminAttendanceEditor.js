import React, { useState, useEffect } from 'react';
import adminAttendanceService from '../services/adminAttendanceService';
import { getDatabase, ref, get } from 'firebase/database';
import { showLoader, hideLoader } from '../utils/globalLoader';

const AdminAttendanceEditor = () => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedTechnician, setSelectedTechnician] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [technicians, setTechnicians] = useState([]);
  const [attendanceRecord, setAttendanceRecord] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form fields
  const [checkInTime, setCheckInTime] = useState('09:00');
  const [checkOutTime, setCheckOutTime] = useState('18:00');
  const [status, setStatus] = useState('completed');
  const [reason, setReason] = useState('');

  // Load technicians list
  useEffect(() => {
    loadTechnicians();
  }, []);

  const loadTechnicians = async () => {
    try {
      const db = getDatabase();
      const techRef = ref(db, 'technicians');
      const snapshot = await get(techRef);

      if (snapshot.exists()) {
        const techs = Object.keys(snapshot.val()).map(id => ({
          id,
          ...snapshot.val()[id]
        }));
        setTechnicians(techs.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
      }
    } catch (err) {
      console.error('Error loading technicians:', err);
      setError('Failed to load technicians');
    }
  };

  const loadAttendanceRecord = async () => {
    if (!selectedTechnician || !selectedDate) {
      setError('Please select technician and date');
      return;
    }

    try {
      showLoader();
      setError('');
      setSuccess('');
      const db = getDatabase();
      const attendanceRef = ref(db, `attendance/${selectedTechnician}/${selectedDate}`);
      const snapshot = await get(attendanceRef);

      if (snapshot.exists()) {
        const record = snapshot.val();
        setAttendanceRecord(record);
        setCheckInTime(record.checkInTime || '09:00');
        setCheckOutTime(record.checkOutTime || '18:00');
        setStatus(record.status || 'completed');
        setEditMode(false);
      } else {
        setAttendanceRecord(null);
        setCheckInTime('09:00');
        setCheckOutTime('18:00');
        setStatus('completed');
        setEditMode(true);
      }
    } catch (err) {
      setError('Error loading attendance: ' + err.message);
    } finally {
      hideLoader();
    }
  };

  const calculateWorkingHours = (checkIn, checkOut) => {
    try {
      const [inHour, inMin] = checkIn.split(':').map(Number);
      const [outHour, outMin] = checkOut.split(':').map(Number);
      const inMinutes = inHour * 60 + inMin;
      const outMinutes = outHour * 60 + outMin;
      const diffMinutes = outMinutes - inMinutes;
      return (diffMinutes / 60).toFixed(2);
    } catch {
      return 0;
    }
  };

  const handleEditAttendance = async (e) => {
    e.preventDefault();

    if (!selectedTechnician || !selectedDate || !reason.trim()) {
      setError('Please fill all fields including reason');
      return;
    }

    try {
      showLoader();
      setError('');
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const adminId = currentUser.id || 'admin';

      const workingHours = calculateWorkingHours(checkInTime, checkOutTime);

      const attendanceData = {
        date: selectedDate,
        checkInTime,
        checkOutTime,
        workingHours: parseFloat(workingHours),
        status,
        technicianId: selectedTechnician
      };

      let result;
      if (attendanceRecord) {
        // Edit existing
        result = await adminAttendanceService.editAttendance(
          selectedTechnician,
          selectedDate,
          attendanceData,
          adminId,
          reason
        );
      } else {
        // Create backdated
        result = await adminAttendanceService.addBackdatedAttendance(
          selectedTechnician,
          selectedDate,
          attendanceData,
          adminId,
          reason
        );
      }

      if (result.success) {
        setSuccess(result.message);
        setAttendanceRecord(result.record);
        setEditMode(false);
        setReason('');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('Error saving attendance: ' + err.message);
    } finally {
      hideLoader();
    }
  };

  const handleMarkStatus = async (newStatus) => {
    if (!selectedTechnician || !selectedDate || !reason.trim()) {
      setError('Please enter reason for marking');
      return;
    }

    try {
      showLoader();
      setError('');
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const adminId = currentUser.id || 'admin';

      const result = await adminAttendanceService.markAttendanceStatus(
        selectedTechnician,
        selectedDate,
        newStatus,
        adminId,
        reason
      );

      if (result.success) {
        setSuccess(result.message);
        setStatus(newStatus);
        setReason('');
        await loadAttendanceRecord();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('Error marking status: ' + err.message);
    } finally {
      hideLoader();
    }
  };

  const getDaysInMonth = (yearMonth) => {
    const [year, month] = yearMonth.split('-');
    return new Date(year, month, 0).getDate();
  };

  const daysInMonth = getDaysInMonth(selectedMonth);
  const tech = technicians.find(t => t.id === selectedTechnician);

  return (
    <div className="content" style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '10px' }}>✏️ Edit Attendance</h1>
      <p style={{ color: '#666', marginBottom: '25px' }}>
        Edit technician attendance records, mark status, or add backdated records
      </p>

      {/* Error/Success Messages */}
      {error && (
        <div style={{
          padding: '12px 15px',
          backgroundColor: '#ffebee',
          border: '1px solid #f44336',
          borderRadius: '4px',
          color: '#c62828',
          marginBottom: '20px'
        }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{
          padding: '12px 15px',
          backgroundColor: '#e8f5e9',
          border: '1px solid #4caf50',
          borderRadius: '4px',
          color: '#2e7d32',
          marginBottom: '20px'
        }}>
          {success}
        </div>
      )}

      {/* Selection Panel */}
      <div className="card" style={{ marginBottom: '25px', backgroundColor: '#f9f9f9' }}>
        <h3 style={{ margin: '0 0 20px 0' }}>🔍 Select Record to Edit</h3>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '15px',
          marginBottom: '20px'
        }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: '#666', marginBottom: '5px', fontWeight: 'bold' }}>
              Month
            </label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', color: '#666', marginBottom: '5px', fontWeight: 'bold' }}>
              Technician
            </label>
            <select
              value={selectedTechnician}
              onChange={(e) => setSelectedTechnician(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
            >
              <option value="">Select technician...</option>
              {technicians.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', color: '#666', marginBottom: '5px', fontWeight: 'bold' }}>
              Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              min={`${selectedMonth}-01`}
              max={`${selectedMonth}-${String(daysInMonth).padStart(2, '0')}`}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              onClick={loadAttendanceRecord}
              className="btn"
              style={{
                width: '100%',
                backgroundColor: '#2196f3',
                padding: '8px 15px',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
              disabled={!selectedTechnician || !selectedDate}
            >
              📂 Load Record
            </button>
          </div>
        </div>

        {tech && (
          <div style={{
            padding: '12px',
            backgroundColor: '#e3f2fd',
            borderRadius: '4px',
            fontSize: '13px',
            color: '#1976d2'
          }}>
            👤 <strong>{tech.name}</strong> (ID: {selectedTechnician})
          </div>
        )}
      </div>

      {/* Current Record Status */}
      {attendanceRecord && (
        <div className="card" style={{ marginBottom: '25px', backgroundColor: '#f5f5f5', borderLeft: '4px solid #2196f3' }}>
          <h3 style={{ margin: '0 0 15px 0' }}>📋 Current Record</h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '15px'
          }}>
            <div>
              <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>Check-In</p>
              <p style={{ margin: '5px 0 0 0', fontSize: '18px', fontWeight: 'bold', color: '#2e7d32' }}>
                {attendanceRecord.checkInTime || '-'}
              </p>
            </div>
            <div>
              <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>Check-Out</p>
              <p style={{ margin: '5px 0 0 0', fontSize: '18px', fontWeight: 'bold', color: '#d32f2f' }}>
                {attendanceRecord.checkOutTime || '-'}
              </p>
            </div>
            <div>
              <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>Working Hours</p>
              <p style={{ margin: '5px 0 0 0', fontSize: '18px', fontWeight: 'bold', color: '#ff6f00' }}>
                {attendanceRecord.workingHours ? attendanceRecord.workingHours + 'h' : '-'}
              </p>
            </div>
            <div>
              <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>Status</p>
              <p style={{
                margin: '5px 0 0 0',
                fontSize: '16px',
                fontWeight: 'bold',
                color: attendanceRecord.status === 'completed' ? '#2e7d32' : '#ff6f00',
                textTransform: 'uppercase'
              }}>
                {attendanceRecord.status || '-'}
              </p>
            </div>
          </div>

          {attendanceRecord.adminEditLog && (
            <div style={{
              marginTop: '15px',
              padding: '10px',
              backgroundColor: '#fff',
              borderRadius: '4px',
              fontSize: '12px',
              color: '#666',
              borderLeft: '3px solid #ff9800'
            }}>
              <strong>📝 Last Modified:</strong><br />
              By: {attendanceRecord.lastModifiedBy || 'N/A'}<br />
              At: {new Date(attendanceRecord.lastModified).toLocaleString()}
            </div>
          )}
        </div>
      )}

      {/* Edit Form */}
      {selectedTechnician && selectedDate && (
        <div className="card" style={{ marginBottom: '25px', backgroundColor: '#fffbf0', borderLeft: '4px solid #ff9800' }}>
          <h3 style={{ margin: '0 0 20px 0' }}>✏️ {editMode ? 'Create New' : 'Edit'} Attendance</h3>

          <form onSubmit={handleEditAttendance} style={{ marginBottom: '20px' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '15px',
              marginBottom: '20px'
            }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#666', marginBottom: '5px', fontWeight: 'bold' }}>
                  Check-In Time
                </label>
                <input
                  type="time"
                  value={checkInTime}
                  onChange={(e) => setCheckInTime(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#666', marginBottom: '5px', fontWeight: 'bold' }}>
                  Check-Out Time
                </label>
                <input
                  type="time"
                  value={checkOutTime}
                  onChange={(e) => setCheckOutTime(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#666', marginBottom: '5px', fontWeight: 'bold' }}>
                  Working Hours
                </label>
                <input
                  type="text"
                  value={calculateWorkingHours(checkInTime, checkOutTime)}
                  disabled
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '4px',
                    border: '1px solid #ddd',
                    backgroundColor: '#f0f0f0'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#666', marginBottom: '5px', fontWeight: 'bold' }}>
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                >
                  <option value="completed">Completed</option>
                  <option value="pending">Pending</option>
                  <option value="incomplete">Incomplete</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: '#666', marginBottom: '5px', fontWeight: 'bold' }}>
                Reason for Edit *
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Device time was incorrect, Manual correction, Technical issue"
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '4px',
                  border: '1px solid #ddd',
                  fontFamily: 'inherit',
                  minHeight: '80px',
                  resize: 'vertical'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="submit"
                className="btn"
                style={{
                  backgroundColor: '#4caf50',
                  padding: '12px 25px',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  minWidth: '150px'
                }}
                disabled={loading || !reason.trim()}
              >
                {loading ? '⏳ Saving...' : '💾 ' + (editMode ? 'Create' : 'Update') + ' Attendance'}
              </button>

              {editMode && (
                <button
                  type="button"
                  onClick={() => setEditMode(false)}
                  className="btn"
                  style={{
                    backgroundColor: '#6c757d',
                    padding: '12px 25px',
                    fontSize: '14px',
                    fontWeight: 'bold'
                  }}
                  disabled={loading}
                >
                  ✕ Cancel
                </button>
              )}
            </div>
          </form>

          {/* Quick Status Buttons */}
          {attendanceRecord && (
            <div style={{
              paddingTop: '20px',
              borderTop: '1px solid #ddd'
            }}>
              <h4 style={{ margin: '0 0 15px 0', color: '#333' }}>⚡ Quick Mark Status</h4>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '10px'
              }}>
                {['present', 'absent', 'holiday', 'worked_on_holiday'].map(st => (
                  <button
                    key={st}
                    onClick={() => {
                      if (reason.trim()) {
                        handleMarkStatus(st);
                      } else {
                        setError('Please enter reason first');
                      }
                    }}
                    className="btn"
                    style={{
                      backgroundColor: status === st ? '#2196f3' : '#e0e0e0',
                      color: status === st ? '#fff' : '#333',
                      padding: '10px 15px',
                      fontSize: '13px',
                      fontWeight: 'bold',
                      borderRadius: '4px',
                      border: 'none',
                      cursor: 'pointer',
                      textTransform: 'capitalize'
                    }}
                    disabled={loading}
                  >
                    {st === 'present' && '✅'} {st === 'absent' && '❌'} {st === 'holiday' && '🎉'} {st === 'worked_on_holiday' && '💼'} {st.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminAttendanceEditor;
