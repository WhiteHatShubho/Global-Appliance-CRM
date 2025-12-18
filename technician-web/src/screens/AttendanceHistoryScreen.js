import React, { useState, useEffect } from 'react';
import { getDatabase, ref, get } from 'firebase/database';
import attendanceAccessControl from '../services/attendanceAccessControl';
import { showLoader, hideLoader } from '../utils/globalLoader';

const AttendanceHistoryScreen = () => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [technicianId, setTechnicianId] = useState(null);
  const [technicianName, setTechnicianName] = useState('');

  useEffect(() => {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    if (currentUser.id) {
      setTechnicianId(currentUser.id);
      setTechnicianName(currentUser.name || 'Technician');
    }
  }, []);

  useEffect(() => {
    if (technicianId && selectedMonth) {
      loadAttendanceHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [technicianId, selectedMonth]);

  const loadAttendanceHistory = async () => {
    if (!technicianId) return;

    try {
      setLoading(true);
      showLoader();
      setError('');

      const db = getDatabase();
      const attendanceRef = ref(db, `attendance/${technicianId}`);
      const snapshot = await get(attendanceRef);

      if (snapshot.exists()) {
        const allRecords = snapshot.val();
        const filtered = Object.entries(allRecords)
          .filter(([date]) => date.startsWith(selectedMonth))
          .map(([date, record]) => ({
            date,
            ...record
          }))
          .sort((a, b) => b.date.localeCompare(a.date));

        setAttendanceRecords(filtered);
      } else {
        setAttendanceRecords([]);
      }
    } catch (err) {
      console.error('Error loading attendance:', err);
      setError('Failed to load attendance history');
    } finally {
      hideLoader();
      setLoading(false);
    }
  };

  const calculateStats = () => {
    const totalDays = attendanceRecords.length;
    const presentDays = attendanceRecords.filter(r => r.status === 'completed').length;
    const incompleteDays = attendanceRecords.filter(r => r.status !== 'completed').length;
    const totalHours = attendanceRecords.reduce((sum, r) => sum + (r.workingHours || 0), 0);

    return { totalDays, presentDays, incompleteDays, totalHours };
  };

  const stats = calculateStats();
  const editPermissions = attendanceAccessControl.getEditPermissions('technician');

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f4f6fb', paddingBottom: '100px' }}>
      <div className="header">
        <div className="header-title">📅 Attendance History</div>
      </div>

      <div className="container" style={{ padding: '20px' }}>
        {/* Read-Only Notice */}
        <div style={{
          padding: '12px 15px',
          backgroundColor: '#fff3cd',
          border: '1px solid #ffc107',
          borderRadius: '6px',
          marginBottom: '20px',
          fontSize: '13px',
          color: '#856404'
        }}>
          <strong>📋 View Only:</strong> {editPermissions.message}
        </div>

        {/* Month Selector */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#333',
            marginBottom: '8px'
          }}>
            Select Month
          </label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid #ddd',
              fontSize: '16px',
              backgroundColor: 'white'
            }}
          />
        </div>

        {/* Statistics Card */}
        {attendanceRecords.length > 0 && (
          <div className="card" style={{
            marginBottom: '20px',
            backgroundColor: '#f9f9f9',
            borderLeft: '4px solid #2196f3'
          }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#333', fontSize: '16px' }}>
              📊 {technicianName}'s Attendance Summary
            </h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '15px'
            }}>
              <div style={{
                backgroundColor: 'white',
                padding: '15px',
                borderRadius: '8px',
                textAlign: 'center'
              }}>
                <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>Total Days</p>
                <p style={{ margin: '5px 0 0 0', fontSize: '24px', fontWeight: 'bold', color: '#2196f3' }}>
                  {stats.totalDays}
                </p>
              </div>
              <div style={{
                backgroundColor: 'white',
                padding: '15px',
                borderRadius: '8px',
                textAlign: 'center'
              }}>
                <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>Present Days</p>
                <p style={{ margin: '5px 0 0 0', fontSize: '24px', fontWeight: 'bold', color: '#4caf50' }}>
                  {stats.presentDays}
                </p>
              </div>
              <div style={{
                backgroundColor: 'white',
                padding: '15px',
                borderRadius: '8px',
                textAlign: 'center'
              }}>
                <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>Incomplete</p>
                <p style={{ margin: '5px 0 0 0', fontSize: '24px', fontWeight: 'bold', color: '#ff9800' }}>
                  {stats.incompleteDays}
                </p>
              </div>
              <div style={{
                backgroundColor: 'white',
                padding: '15px',
                borderRadius: '8px',
                textAlign: 'center'
              }}>
                <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>Total Hours</p>
                <p style={{ margin: '5px 0 0 0', fontSize: '24px', fontWeight: 'bold', color: '#9c27b0' }}>
                  {stats.totalHours.toFixed(1)}h
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div style={{
            padding: '12px 15px',
            backgroundColor: '#ffebee',
            border: '1px solid #f44336',
            borderRadius: '6px',
            color: '#c62828',
            marginBottom: '20px',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            ⏳ Loading attendance records...
          </div>
        )}

        {/* Attendance Records List */}
        {!loading && attendanceRecords.length > 0 && (
          <div>
            <h3 style={{ margin: '0 0 15px 0', color: '#333', fontSize: '16px' }}>
              Daily Records ({attendanceRecords.length})
            </h3>
            {attendanceRecords.map((record) => (
              <div
                key={record.date}
                className="card"
                style={{
                  marginBottom: '12px',
                  backgroundColor: 'white',
                  borderLeft: `4px solid ${record.status === 'completed' ? '#4caf50' : '#ff9800'}`
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '10px'
                }}>
                  <div>
                    <p style={{
                      margin: '0',
                      fontSize: '16px',
                      fontWeight: 'bold',
                      color: '#333'
                    }}>
                      {new Date(record.date).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </p>
                    <p style={{
                      margin: '5px 0 0 0',
                      fontSize: '12px',
                      color: '#999'
                    }}>
                      {new Date(record.date).toLocaleDateString('en-US', { weekday: 'long' })}
                    </p>
                  </div>
                  <span style={{
                    padding: '4px 12px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    backgroundColor: record.status === 'completed' ? '#e8f5e9' : '#fff3e0',
                    color: record.status === 'completed' ? '#2e7d32' : '#f57c00',
                    textTransform: 'uppercase'
                  }}>
                    {record.status === 'completed' ? '✅ Complete' : '⏳ Incomplete'}
                  </span>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '10px',
                  fontSize: '13px'
                }}>
                  <div>
                    <p style={{ margin: '0', color: '#666', fontSize: '11px' }}>Check-In</p>
                    <p style={{ margin: '3px 0 0 0', fontWeight: 'bold', color: '#2e7d32' }}>
                      {record.checkInTime || '-'}
                    </p>
                  </div>
                  <div>
                    <p style={{ margin: '0', color: '#666', fontSize: '11px' }}>Check-Out</p>
                    <p style={{ margin: '3px 0 0 0', fontWeight: 'bold', color: '#d32f2f' }}>
                      {record.checkOutTime || '-'}
                    </p>
                  </div>
                  <div>
                    <p style={{ margin: '0', color: '#666', fontSize: '11px' }}>Hours</p>
                    <p style={{ margin: '3px 0 0 0', fontWeight: 'bold', color: '#1976d2' }}>
                      {record.workingHours ? record.workingHours.toFixed(1) + 'h' : '-'}
                    </p>
                  </div>
                </div>

                {record.faceMatchScore && (
                  <div style={{
                    marginTop: '10px',
                    paddingTop: '10px',
                    borderTop: '1px solid #f0f0f0',
                    fontSize: '12px',
                    color: '#666'
                  }}>
                    🔐 Face Match: {(record.faceMatchScore * 100).toFixed(0)}%
                  </div>
                )}

                {record.adminEditLog && (
                  <div style={{
                    marginTop: '10px',
                    paddingTop: '10px',
                    borderTop: '1px solid #f0f0f0',
                    fontSize: '11px',
                    color: '#ff6f00',
                    backgroundColor: '#fff3e0',
                    padding: '8px',
                    borderRadius: '4px'
                  }}>
                    ✏️ <strong>Admin Modified:</strong> {new Date(record.lastModified).toLocaleString()}
                    {record.adminEditLog.reason && (
                      <div style={{ marginTop: '5px' }}>
                        <strong>Reason:</strong> {record.adminEditLog.reason}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* No Records Found */}
        {!loading && attendanceRecords.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '40px 20px',
            backgroundColor: 'white',
            borderRadius: '8px',
            border: '1px solid #eee'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '15px' }}>📭</div>
            <p style={{ color: '#999', margin: '0', fontSize: '16px' }}>
              No attendance records found for {selectedMonth}
            </p>
          </div>
        )}

        {/* Security Notice */}
        <div style={{
          marginTop: '20px',
          padding: '15px',
          backgroundColor: '#e3f2fd',
          borderRadius: '8px',
          border: '1px solid #2196f3',
          fontSize: '12px',
          color: '#1565c0'
        }}>
          <strong>🔒 Security Note:</strong> This is your personal attendance history. Only you and administrators can view this data. Records cannot be edited by technicians.
        </div>
      </div>
    </div>
  );
};

export default AttendanceHistoryScreen;
