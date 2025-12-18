import React, { useState, useEffect } from 'react';
import attendanceService from '../services/attendanceService';
import salaryCalculationService from '../services/salaryCalculationService';
import { getDatabase, ref, get } from 'firebase/database';

const AttendanceDashboard = () => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedTechnician, setSelectedTechnician] = useState('all');
  const [technicians, setTechnicians] = useState([]);
  const [attendanceData, setAttendanceData] = useState({});
  const [salaryData, setSalaryData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('calendar'); // calendar, table, salary

  // Load technicians list
  useEffect(() => {
    loadTechnicians();
  }, []);

  // Load attendance data when month/technician changes
  useEffect(() => {
    if (selectedMonth && selectedTechnician) {
      loadAttendanceData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, selectedTechnician, technicians.length]);

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
    }
  };

  const loadAttendanceData = async () => {
    try {
      setLoading(true);
      setError('');

      const techIds = selectedTechnician === 'all'
        ? technicians.map(t => t.id)
        : [selectedTechnician];

      const data = {};
      const salaries = {};

      for (const techId of techIds) {
        const attendance = await attendanceService.getMonthlyAttendance(techId, selectedMonth);
        data[techId] = attendance;

        // Calculate salary
        const salary = await salaryCalculationService.calculateMonthlySalary(
          techId,
          selectedMonth,
          attendance
        );
        salaries[techId] = salary;
      }

      setAttendanceData(data);
      setSalaryData(salaries);
    } catch (err) {
      setError('Error loading attendance data: ' + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getDaysInMonth = (yearMonth) => {
    const [year, month] = yearMonth.split('-');
    return new Date(year, month, 0).getDate();
  };

  const getAttendanceStatus = (techId, day) => {
    const dateStr = `${selectedMonth}-${String(day).padStart(2, '0')}`;
    const record = attendanceData[techId]?.find(r => r.date === dateStr);

    if (!record) return 'absent';
    if (record.status === 'completed') {
      const hours = record.workingHours || 0;
      if (hours < 4) return 'half-day';
      return 'present';
    }
    return 'incomplete';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'present': return '#4caf50';
      case 'half-day': return '#ff9800';
      case 'absent': return '#f44336';
      case 'incomplete': return '#ffc107';
      default: return '#e0e0e0';
    }
  };

  const exportToCSV = () => {
    let csv = 'Date,Technician,Photo URL,Check-In,Check-Out,Working Hours,Location,Status\n';

    Object.entries(attendanceData).forEach(([techId, records]) => {
      const tech = technicians.find(t => t.id === techId);
      records.forEach(record => {
        const locationStr = record.location ? `${record.location.latitude},${record.location.longitude}` : '';
        const photoUrl = tech?.photo || '';
        csv += `${record.date},${tech?.name || techId},${photoUrl},${record.checkInTime || ''},${record.checkOutTime || ''},${record.workingHours || 0},${locationStr},${record.status}\n`;
      });
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_${selectedMonth}.csv`;
    a.click();
  };

  const daysInMonth = getDaysInMonth(selectedMonth);
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div className="content" style={{ padding: '20px' }}>
      <h1 style={{ marginBottom: '10px' }}>📊 Attendance & Payroll Dashboard</h1>

      {/* Controls */}
      <div style={{
        display: 'flex',
        gap: '15px',
        marginBottom: '25px',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        <div>
          <label style={{ fontSize: '14px', color: '#666', marginRight: '8px' }}>Month:</label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
          />
        </div>

        <div>
          <label style={{ fontSize: '14px', color: '#666', marginRight: '8px' }}>Technician:</label>
          <select
            value={selectedTechnician}
            onChange={(e) => setSelectedTechnician(e.target.value)}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd', minWidth: '200px' }}
          >
            <option value="all">All Technicians</option>
            {technicians.map(tech => (
              <option key={tech.id} value={tech.id}>{tech.name}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setViewMode('calendar')}
            className="btn"
            style={{
              backgroundColor: viewMode === 'calendar' ? '#2196f3' : '#666',
              padding: '8px 15px',
              fontSize: '14px'
            }}
          >
            📅 Calendar
          </button>
          <button
            onClick={() => setViewMode('table')}
            className="btn"
            style={{
              backgroundColor: viewMode === 'table' ? '#2196f3' : '#666',
              padding: '8px 15px',
              fontSize: '14px'
            }}
          >
            📋 Details
          </button>
          <button
            onClick={() => setViewMode('salary')}
            className="btn"
            style={{
              backgroundColor: viewMode === 'salary' ? '#2196f3' : '#666',
              padding: '8px 15px',
              fontSize: '14px'
            }}
          >
            💰 Salary
          </button>
          <button
            onClick={exportToCSV}
            className="btn"
            style={{ backgroundColor: '#4caf50', padding: '8px 15px', fontSize: '14px' }}
          >
            📥 Export CSV
          </button>
        </div>
      </div>

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

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
          ⏳ Loading attendance data...
        </div>
      ) : (
        <>
          {/* Calendar View */}
          {viewMode === 'calendar' && (
            <div className="card">
              <h3 style={{ marginBottom: '20px' }}>📅 Monthly Attendance Calendar</h3>
              {selectedTechnician === 'all' ? (
                technicians.map(tech => (
                  <div key={tech.id} style={{ marginBottom: '30px' }}>
                    <h4 style={{ margin: '0 0 15px 0', color: '#333' }}>{tech.name}</h4>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(35px, 1fr))',
                      gap: '5px'
                    }}>
                      {daysArray.map(day => {
                        const status = getAttendanceStatus(tech.id, day);
                        return (
                          <div
                            key={day}
                            style={{
                              padding: '8px',
                              backgroundColor: getStatusColor(status),
                              color: '#fff',
                              borderRadius: '4px',
                              textAlign: 'center',
                              fontSize: '12px',
                              fontWeight: 'bold',
                              cursor: 'pointer',
                              minHeight: '35px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              title: status
                            }}
                            title={`${day} - ${status}`}
                          >
                            {day}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              ) : (
                <div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    gap: '5px',
                    marginBottom: '20px'
                  }}>
                    {daysArray.map(day => {
                      const status = getAttendanceStatus(selectedTechnician, day);
                      return (
                        <div
                          key={day}
                          style={{
                            padding: '15px',
                            backgroundColor: getStatusColor(status),
                            color: '#fff',
                            borderRadius: '4px',
                            textAlign: 'center',
                            fontWeight: 'bold',
                            minHeight: '50px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title={status}
                        >
                          {day}
                        </div>
                      );
                    })}
                  </div>

                  {/* Legend */}
                  <div style={{
                    display: 'flex',
                    gap: '20px',
                    flexWrap: 'wrap',
                    paddingTop: '15px',
                    borderTop: '1px solid #eee'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '20px', height: '20px', backgroundColor: '#4caf50', borderRadius: '3px' }}></div>
                      <span style={{ fontSize: '12px' }}>Present (Full)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '20px', height: '20px', backgroundColor: '#ff9800', borderRadius: '3px' }}></div>
                      <span style={{ fontSize: '12px' }}>Half Day</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '20px', height: '20px', backgroundColor: '#ffc107', borderRadius: '3px' }}></div>
                      <span style={{ fontSize: '12px' }}>Incomplete</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '20px', height: '20px', backgroundColor: '#f44336', borderRadius: '3px' }}></div>
                      <span style={{ fontSize: '12px' }}>Absent</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Details Table View */}
          {viewMode === 'table' && (
            <div className="card" style={{ overflowX: 'auto' }}>
              <h3 style={{ marginBottom: '15px' }}>📋 Detailed Attendance Records</h3>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '13px'
              }}>
                <thead>
                  <tr style={{ backgroundColor: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                    <th style={{ padding: '12px', textAlign: 'left' }}>Photo</th>
                    <th style={{ padding: '12px', textAlign: 'left' }}>Technician</th>
                    <th style={{ padding: '12px', textAlign: 'center' }}>Date</th>
                    <th style={{ padding: '12px', textAlign: 'center' }}>Check-In</th>
                    <th style={{ padding: '12px', textAlign: 'center' }}>Check-In Photo</th>
                    <th style={{ padding: '12px', textAlign: 'center' }}>Check-Out</th>
                    <th style={{ padding: '12px', textAlign: 'center' }}>Hours</th>
                    <th style={{ padding: '12px', textAlign: 'center' }}>Location</th>
                    <th style={{ padding: '12px', textAlign: 'center' }}>Match Score</th>
                    <th style={{ padding: '12px', textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(attendanceData).map(([techId, records]) => {
                    const tech = technicians.find(t => t.id === techId);
                    return records.map((record, idx) => (
                      <tr key={`${techId}-${idx}`} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          {tech?.photo ? (
                            <img 
                              src={tech.photo} 
                              alt={tech?.name} 
                              style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
                              title={tech?.name}
                            />
                          ) : (
                            <div style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '50%',
                              backgroundColor: '#ddd',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '20px'
                            }}>👤</div>
                          )}
                        </td>
                        <td style={{ padding: '12px' }}>{tech?.name || techId}</td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>{record.date}</td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          {record.checkInTime || '-'}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          {record.checkInPhoto ? (
                            <img 
                              src={record.checkInPhoto} 
                              alt="Check-In" 
                              style={{ width: '50px', height: '50px', borderRadius: '4px', objectFit: 'cover', cursor: 'pointer' }}
                              title="Click to view full image"
                              onClick={() => window.open(record.checkInPhoto, '_blank')}
                            />
                          ) : tech?.photo ? (
                            <img 
                              src={tech.photo} 
                              alt={tech?.name} 
                              style={{ width: '50px', height: '50px', borderRadius: '4px', objectFit: 'cover' }}
                              title={`Technician photo - Check-in at ${record.checkInTime}`}
                            />
                          ) : (
                            <div style={{
                              width: '50px',
                              height: '50px',
                              borderRadius: '4px',
                              backgroundColor: '#f0f0f0',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '20px'
                            }}
                            title="No photo available"
                            >📷</div>
                          )}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          {record.checkOutTime || '-'}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          {record.workingHours ? `${record.workingHours}h` : '-'}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          {record.location ? (
                            <a 
                              href={`https://maps.google.com/?q=${record.location.latitude},${record.location.longitude}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              style={{ color: '#2196f3', textDecoration: 'none' }}
                              title={`${record.location.latitude}, ${record.location.longitude}`}
                            >
                              📍 View
                            </a>
                          ) : '-'}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          {record.faceMatchScore ? `${(record.faceMatchScore * 100).toFixed(0)}%` : '-'}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <span style={{
                            backgroundColor: getStatusColor(record.status),
                            color: '#fff',
                            padding: '4px 8px',
                            borderRadius: '3px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            textTransform: 'capitalize'
                          }}>
                            {record.status}
                          </span>
                        </td>
                      </tr>
                    ));
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Salary View */}
          {viewMode === 'salary' && (
            <div className="card">
              <h3 style={{ marginBottom: '20px' }}>💰 Monthly Salary Summary</h3>
              {Object.entries(salaryData).map(([techId, salary]) => {
                const tech = technicians.find(t => t.id === techId);
                if (salary.error) return null;

                return (
                  <div key={techId} style={{
                    marginBottom: '30px',
                    padding: '20px',
                    backgroundColor: '#f9f9f9',
                    borderRadius: '8px',
                    border: '1px solid #eee'
                  }}>
                    <h4 style={{ margin: '0 0 15px 0', color: '#333' }}>
                      {tech?.name} - {salary.month}
                    </h4>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '15px',
                      marginBottom: '20px'
                    }}>
                      {/* Attendance Stats */}
                      <div style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '6px', border: '1px solid #e0e0e0' }}>
                        <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#666' }}>Present Days</p>
                        <p style={{ margin: '0', fontSize: '20px', fontWeight: 'bold', color: '#2e7d32' }}>
                          {salary.attendance.presentDays}
                        </p>
                      </div>
                      <div style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '6px', border: '1px solid #e0e0e0' }}>
                        <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#666' }}>Absent Days</p>
                        <p style={{ margin: '0', fontSize: '20px', fontWeight: 'bold', color: '#d32f2f' }}>
                          {salary.attendance.absentDays}
                        </p>
                      </div>
                      <div style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '6px', border: '1px solid #e0e0e0' }}>
                        <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#666' }}>Half Days</p>
                        <p style={{ margin: '0', fontSize: '20px', fontWeight: 'bold', color: '#ff6f00' }}>
                          {salary.attendance.halfDays}
                        </p>
                      </div>
                      <div style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '6px', border: '1px solid #e0e0e0' }}>
                        <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#666' }}>Total Hours</p>
                        <p style={{ margin: '0', fontSize: '20px', fontWeight: 'bold', color: '#1976d2' }}>
                          {salary.attendance.totalWorkingHours}h
                        </p>
                      </div>

                      {/* Salary Breakdown */}
                      <div style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '6px', border: '1px solid #e0e0e0' }}>
                        <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#666' }}>Base Salary</p>
                        <p style={{ margin: '0', fontSize: '20px', fontWeight: 'bold', color: '#2196f3' }}>
                          ₹ {salary.baseSalary.toLocaleString('en-IN')}
                        </p>
                      </div>
                      <div style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '6px', border: '1px solid #e0e0e0' }}>
                        <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#666' }}>Overtime Pay</p>
                        <p style={{ margin: '0', fontSize: '20px', fontWeight: 'bold', color: '#4caf50' }}>
                          ₹ {salary.overtimePay.toLocaleString('en-IN')}
                        </p>
                      </div>
                      <div style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '6px', border: '1px solid #e0e0e0' }}>
                        <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#666' }}>Total Deductions</p>
                        <p style={{ margin: '0', fontSize: '20px', fontWeight: 'bold', color: '#f44336' }}>
                          ₹ {salary.totalDeductions.toLocaleString('en-IN')}
                        </p>
                      </div>

                      {/* Net Salary - Highlighted */}
                      <div style={{
                        gridColumn: 'span auto',
                        backgroundColor: '#e8f5e9',
                        padding: '20px',
                        borderRadius: '6px',
                        border: '2px solid #4caf50'
                      }}>
                        <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#666', fontWeight: 'bold' }}>
                          NET SALARY PAYABLE
                        </p>
                        <p style={{ margin: '0', fontSize: '28px', fontWeight: 'bold', color: '#2e7d32' }}>
                          ₹ {salary.netSalary.toLocaleString('en-IN')}
                        </p>
                      </div>
                    </div>

                    {/* Deduction Breakdown */}
                    <div style={{
                      padding: '15px',
                      backgroundColor: '#fff3e0',
                      borderRadius: '6px',
                      border: '1px solid #ffb74d'
                    }}>
                      <p style={{ margin: '0 0 10px 0', fontSize: '12px', fontWeight: 'bold', color: '#666' }}>
                        Deduction Details:
                      </p>
                      <ul style={{ margin: '0', paddingLeft: '20px', fontSize: '12px', color: '#555' }}>
                        <li>Half-day deduction: ₹ {salary.halfDayDeduction.toLocaleString('en-IN')}</li>
                        <li>Absent deduction: ₹ {salary.absentDeduction.toLocaleString('en-IN')}</li>
                        <li>Late deduction (10% per day): ₹ {salary.lateDeduction.toLocaleString('en-IN')}</li>
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AttendanceDashboard;
