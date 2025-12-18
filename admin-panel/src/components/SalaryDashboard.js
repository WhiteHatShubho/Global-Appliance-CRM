import React, { useState, useEffect } from 'react';
import salaryCalculationService from '../services/salaryCalculationService';
import salarySlipGenerator from '../services/salarySlipGenerator';
import attendanceService from '../services/attendanceService';
import { getDatabase, ref, get } from 'firebase/database';

const SalaryDashboard = () => {
  const [technicians, setTechnicians] = useState([]);
  const [selectedTechnician, setSelectedTechnician] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [salaryData, setSalaryData] = useState(null);
  const [salaryHistory, setSalaryHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [viewMode, setViewMode] = useState('current'); // current or history

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
        const sortedTechs = techs.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setTechnicians(sortedTechs);
        if (sortedTechs.length > 0) {
          setSelectedTechnician(sortedTechs[0].id);
        }
      }
    } catch (err) {
      console.error('Error loading technicians:', err);
    }
  };

  const loadSalaryData = async () => {
    try {
      setLoading(true);
      setError('');

      if (!selectedTechnician) {
        setError('Please select a technician');
        return;
      }

      // Get attendance for the month
      const attendance = await attendanceService.getMonthlyAttendance(
        selectedTechnician,
        selectedMonth
      );

      // Calculate salary
      const salary = await salaryCalculationService.calculateMonthlySalary(
        selectedTechnician,
        selectedMonth,
        attendance
      );

      if (salary.error) {
        setError(salary.error);
        setSalaryData(null);
      } else {
        setSalaryData(salary);
      }

      // Load salary history
      const history = await salaryCalculationService.getSalaryHistory(selectedTechnician, 12);
      setSalaryHistory(history);
    } catch (err) {
      setError('Error loading salary data: ' + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedTechnician && selectedMonth) {
      loadSalaryData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTechnician, selectedMonth, technicians.length]);

  const handleGeneratePDF = async () => {
    try {
      if (!salaryData) {
        setError('No salary data to export');
        return;
      }

      const tech = technicians.find(t => t.id === selectedTechnician);
      const result = await salarySlipGenerator.generatePDF(salaryData, tech);

      if (result.success) {
        setSuccess('✅ Salary slip generated successfully');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError('❌ Error generating PDF: ' + result.message);
      }
    } catch (err) {
      setError('Error: ' + err.message);
    }
  };

  const handleExportCSV = async () => {
    try {
      if (!salaryData) {
        setError('No attendance data to export');
        return;
      }

      const attendance = await attendanceService.getMonthlyAttendance(
        selectedTechnician,
        selectedMonth
      );
      const tech = technicians.find(t => t.id === selectedTechnician);

      salarySlipGenerator.generateAttendanceCSV(attendance, tech);
      setSuccess('✅ Attendance exported to CSV');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Error: ' + err.message);
    }
  };

  const tech = technicians.find(t => t.id === selectedTechnician);
  const salaryStats = salaryCalculationService.calculateSalaryStats(salaryHistory);

  return (
    <div className="content" style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '10px' }}>💰 Salary Dashboard</h1>
      <p style={{ color: '#666', marginBottom: '25px' }}>
        View and manage individual technician salary slips and payroll history
      </p>

      {/* Controls */}
      <div style={{
        display: 'flex',
        gap: '15px',
        marginBottom: '25px',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        <div>
          <label style={{ fontSize: '14px', color: '#666', marginRight: '8px' }}>Technician:</label>
          <select
            value={selectedTechnician}
            onChange={(e) => setSelectedTechnician(e.target.value)}
            style={{
              padding: '10px',
              borderRadius: '4px',
              border: '1px solid #ddd',
              minWidth: '200px',
              fontSize: '14px'
            }}
          >
            <option value="">Select Technician</option>
            {technicians.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontSize: '14px', color: '#666', marginRight: '8px' }}>Month:</label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '14px' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setViewMode('current')}
            className="btn"
            style={{
              backgroundColor: viewMode === 'current' ? '#2196f3' : '#666',
              padding: '10px 15px',
              fontSize: '14px'
            }}
          >
            📋 Current Slip
          </button>
          <button
            onClick={() => setViewMode('history')}
            className="btn"
            style={{
              backgroundColor: viewMode === 'history' ? '#2196f3' : '#666',
              padding: '10px 15px',
              fontSize: '14px'
            }}
          >
            📊 History
          </button>
        </div>
      </div>

      {/* Messages */}
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

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
          ⏳ Loading salary data...
        </div>
      ) : (
        <>
          {/* Current Salary Slip View */}
          {viewMode === 'current' && salaryData && (
            <>
              {/* Export Buttons */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <button
                  onClick={handleGeneratePDF}
                  className="btn"
                  style={{ backgroundColor: '#d32f2f', padding: '10px 20px', fontSize: '14px' }}
                >
                  📄 Download PDF Slip
                </button>
                <button
                  onClick={handleExportCSV}
                  className="btn"
                  style={{ backgroundColor: '#4caf50', padding: '10px 20px', fontSize: '14px' }}
                >
                  📊 Export Attendance CSV
                </button>
              </div>

              {/* Salary Slip Content */}
              <div style={{
                backgroundColor: '#fff',
                border: '1px solid #ddd',
                borderRadius: '8px',
                padding: '30px',
                marginBottom: '20px'
              }}>
                {/* Header */}
                <div style={{
                  textAlign: 'center',
                  borderBottom: '2px solid #333',
                  paddingBottom: '20px',
                  marginBottom: '20px'
                }}>
                  <h2 style={{ margin: '0 0 10px 0', color: '#1976d2' }}>Global Appliance Services</h2>
                  <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>SALARY SLIP</p>
                  <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#666' }}>
                    For the month of {new Date(salaryData.month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                  </p>
                </div>

                {/* Employee Info */}
                <div style={{ marginBottom: '25px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      <tr>
                        <td style={{ padding: '10px', borderBottom: '1px solid #ddd', fontWeight: 'bold', width: '25%' }}>Employee Name:</td>
                        <td style={{ padding: '10px', borderBottom: '1px solid #ddd' }}>{tech?.name}</td>
                        <td style={{ padding: '10px', borderBottom: '1px solid #ddd', fontWeight: 'bold', width: '25%' }}>Employee ID:</td>
                        <td style={{ padding: '10px', borderBottom: '1px solid #ddd' }}>{tech?.id}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '10px', borderBottom: '1px solid #ddd', fontWeight: 'bold' }}>Designation:</td>
                        <td style={{ padding: '10px', borderBottom: '1px solid #ddd' }}>Technician</td>
                        <td style={{ padding: '10px', borderBottom: '1px solid #ddd', fontWeight: 'bold' }}>Month:</td>
                        <td style={{ padding: '10px', borderBottom: '1px solid #ddd' }}>{salaryData.month}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Attendance Summary */}
                <div style={{ marginBottom: '25px' }}>
                  <h4 style={{ margin: '0 0 15px 0', color: '#1976d2', borderBottom: '2px solid #1976d2', paddingBottom: '5px' }}>
                    ATTENDANCE SUMMARY
                  </h4>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: '15px'
                  }}>
                    <div style={{ padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '4px', textAlign: 'center' }}>
                      <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#666' }}>Present Days</p>
                      <p style={{ margin: '0', fontSize: '20px', fontWeight: 'bold', color: '#2e7d32' }}>
                        {salaryData.attendance.presentDays}
                      </p>
                    </div>
                    <div style={{ padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '4px', textAlign: 'center' }}>
                      <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#666' }}>Absent Days</p>
                      <p style={{ margin: '0', fontSize: '20px', fontWeight: 'bold', color: '#d32f2f' }}>
                        {salaryData.attendance.absentDays}
                      </p>
                    </div>
                    <div style={{ padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '4px', textAlign: 'center' }}>
                      <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#666' }}>Half Days</p>
                      <p style={{ margin: '0', fontSize: '20px', fontWeight: 'bold', color: '#ff6f00' }}>
                        {salaryData.attendance.halfDays}
                      </p>
                    </div>
                    <div style={{ padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '4px', textAlign: 'center' }}>
                      <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#666' }}>Total Hours</p>
                      <p style={{ margin: '0', fontSize: '20px', fontWeight: 'bold', color: '#1976d2' }}>
                        {salaryData.attendance.totalWorkingHours}h
                      </p>
                    </div>
                  </div>
                </div>

                {/* Salary Breakdown */}
                <div style={{ marginBottom: '25px' }}>
                  <h4 style={{ margin: '0 0 15px 0', color: '#1976d2', borderBottom: '2px solid #1976d2', paddingBottom: '5px' }}>
                    SALARY BREAKDOWN
                  </h4>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '15px'
                  }}>
                    <div style={{ padding: '15px', backgroundColor: '#e8f5e9', borderRadius: '4px', border: '1px solid #4caf50' }}>
                      <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#666' }}>Base Salary</p>
                      <p style={{ margin: '0', fontSize: '22px', fontWeight: 'bold', color: '#2e7d32' }}>
                        ₹ {salaryData.baseSalary.toLocaleString('en-IN')}
                      </p>
                    </div>
                    <div style={{ padding: '15px', backgroundColor: '#e3f2fd', borderRadius: '4px', border: '1px solid #2196f3' }}>
                      <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#666' }}>Overtime Pay</p>
                      <p style={{ margin: '0', fontSize: '22px', fontWeight: 'bold', color: '#1976d2' }}>
                        ₹ {salaryData.overtimePay.toLocaleString('en-IN')}
                      </p>
                    </div>
                    <div style={{ padding: '15px', backgroundColor: '#ffebee', borderRadius: '4px', border: '1px solid #f44336' }}>
                      <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#666' }}>Total Deductions</p>
                      <p style={{ margin: '0', fontSize: '22px', fontWeight: 'bold', color: '#d32f2f' }}>
                        ₹ {salaryData.totalDeductions.toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Net Salary */}
                <div style={{
                  backgroundColor: '#e8f5e9',
                  border: '2px solid #2e7d32',
                  borderRadius: '8px',
                  padding: '25px',
                  textAlign: 'center',
                  marginBottom: '20px'
                }}>
                  <p style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#666', fontWeight: 'bold' }}>
                    NET SALARY PAYABLE
                  </p>
                  <p style={{ margin: '0', fontSize: '32px', fontWeight: 'bold', color: '#2e7d32' }}>
                    ₹ {salaryData.netSalary.toLocaleString('en-IN')}
                  </p>
                </div>

                {/* Deduction Details */}
                <div style={{ padding: '15px', backgroundColor: '#fff3e0', borderRadius: '4px', border: '1px solid #ffb74d', marginBottom: '20px' }}>
                  <p style={{ margin: '0 0 10px 0', fontSize: '12px', fontWeight: 'bold', color: '#666' }}>
                    Deduction Details:
                  </p>
                  <ul style={{ margin: '0', paddingLeft: '20px', fontSize: '13px', color: '#555' }}>
                    <li>Half-day deduction: ₹ {salaryData.halfDayDeduction.toLocaleString('en-IN')}</li>
                    <li>Absent deduction: ₹ {salaryData.absentDeduction.toLocaleString('en-IN')}</li>
                    <li>Late deduction (10% per day): ₹ {salaryData.lateDeduction.toLocaleString('en-IN')}</li>
                  </ul>
                </div>

                {/* Footer */}
                <div style={{
                  borderTop: '1px solid #ddd',
                  paddingTop: '15px',
                  textAlign: 'center',
                  fontSize: '11px',
                  color: '#666'
                }}>
                  <p style={{ margin: '5px 0' }}>This is a computer-generated document and does not require a signature.</p>
                  <p style={{ margin: '5px 0' }}>Generated on: {new Date().toLocaleDateString('en-IN')} at {new Date().toLocaleTimeString('en-IN')}</p>
                </div>
              </div>
            </>
          )}

          {/* Salary History View */}
          {viewMode === 'history' && (
            <div className="card">
              <h3 style={{ marginBottom: '20px' }}>📊 Salary History (Last 12 Months)</h3>

              {salaryHistory.length === 0 ? (
                <p style={{ color: '#999', textAlign: 'center', padding: '40px' }}>
                  No salary history available for this technician
                </p>
              ) : (
                <>
                  {/* Summary Stats */}
                  {salaryStats && (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '15px',
                      marginBottom: '25px'
                    }}>
                      <div style={{ padding: '15px', backgroundColor: '#e3f2fd', borderRadius: '4px', border: '1px solid #2196f3' }}>
                        <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#666' }}>Average Salary</p>
                        <p style={{ margin: '0', fontSize: '20px', fontWeight: 'bold', color: '#1976d2' }}>
                          ₹ {salaryStats.average.toLocaleString('en-IN')}
                        </p>
                      </div>
                      <div style={{ padding: '15px', backgroundColor: '#e8f5e9', borderRadius: '4px', border: '1px solid #4caf50' }}>
                        <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#666' }}>Highest Salary</p>
                        <p style={{ margin: '0', fontSize: '20px', fontWeight: 'bold', color: '#2e7d32' }}>
                          ₹ {salaryStats.maximum.toLocaleString('en-IN')}
                        </p>
                      </div>
                      <div style={{ padding: '15px', backgroundColor: '#ffebee', borderRadius: '4px', border: '1px solid #f44336' }}>
                        <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#666' }}>Lowest Salary</p>
                        <p style={{ margin: '0', fontSize: '20px', fontWeight: 'bold', color: '#d32f2f' }}>
                          ₹ {salaryStats.minimum.toLocaleString('en-IN')}
                        </p>
                      </div>
                      <div style={{ padding: '15px', backgroundColor: '#f3e5f5', borderRadius: '4px', border: '1px solid #9c27b0' }}>
                        <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#666' }}>Total Earned</p>
                        <p style={{ margin: '0', fontSize: '20px', fontWeight: 'bold', color: '#6a1b9a' }}>
                          ₹ {salaryStats.total.toLocaleString('en-IN')}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* History Table */}
                  <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '13px'
                  }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                        <th style={{ padding: '12px', textAlign: 'left' }}>Month</th>
                        <th style={{ padding: '12px', textAlign: 'center' }}>Present</th>
                        <th style={{ padding: '12px', textAlign: 'center' }}>Absent</th>
                        <th style={{ padding: '12px', textAlign: 'center' }}>Hours</th>
                        <th style={{ padding: '12px', textAlign: 'right' }}>Base Salary</th>
                        <th style={{ padding: '12px', textAlign: 'right' }}>Overtime</th>
                        <th style={{ padding: '12px', textAlign: 'right' }}>Deductions</th>
                        <th style={{ padding: '12px', textAlign: 'right', backgroundColor: '#e8f5e9' }}>Net Salary</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salaryHistory.map((record, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '12px' }}>{record.month}</td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>{record.attendance.presentDays}</td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>{record.attendance.absentDays}</td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>{record.attendance.totalWorkingHours}h</td>
                          <td style={{ padding: '12px', textAlign: 'right' }}>₹ {record.baseSalary.toLocaleString('en-IN')}</td>
                          <td style={{ padding: '12px', textAlign: 'right' }}>₹ {record.overtimePay.toLocaleString('en-IN')}</td>
                          <td style={{ padding: '12px', textAlign: 'right' }}>₹ {record.totalDeductions.toLocaleString('en-IN')}</td>
                          <td style={{
                            padding: '12px',
                            textAlign: 'right',
                            fontWeight: 'bold',
                            color: '#2e7d32',
                            backgroundColor: '#f0f0f0'
                          }}>
                            ₹ {record.netSalary.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SalaryDashboard;
