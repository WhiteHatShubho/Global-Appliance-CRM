import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import sessionManager from '../services/sessionManager';
import attendanceAccessControl from '../services/attendanceAccessControl';
import { showLoader, hideLoader } from '../utils/globalLoader';
import '../App.css';

const PayrollViewScreen = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().split('T')[0].substring(0, 7));
  const [payrollData, setPayrollData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const techId = sessionManager.getTechnicianId();
    if (techId) {
      setCurrentUser({ id: techId, name: sessionManager.getTechnicianName() });
    } else {
      setError('Technician session not found. Please login first.');
      setTimeout(() => navigate('/login'), 2000);
    }
  }, [navigate]);

  // Fetch payroll data
  useEffect(() => {
    if (currentUser && selectedMonth) {
      loadPayrollData();
    }
  }, [selectedMonth, currentUser]);

  const loadPayrollData = async () => {
    setLoading(true);
    setError('');
    try {
      showLoader();
      // This will be fetched from admin panel in real implementation
      // For now, show placeholder with instructions
      const dummyData = {
        month: selectedMonth,
        technicianId: currentUser.id,
        salaryStructure: {
          monthlySalary: 0,
          actualPerDaySalary: 0,
          daysInMonth: 0
        },
        attendance: {
          workedDays: 0,
          totalThursdays: 0,
          thursdaysPaid: 0,
          thursdaysDeducted: 0,
          thursdaysWorked: 0,
          thursdayDetails: []
        },
        baseSalary: 0,
        thursdayPaidSalary: 0,
        thursdayExtraPay: 0,
        netSalary: 0
      };
      setPayrollData(dummyData);
    } catch (err) {
      setError('Error loading payroll data: ' + err.message);
    } finally {
      hideLoader();
      setLoading(false);
    }
  };

  const editPermissions = attendanceAccessControl.getEditPermissions();
  const [currentTime] = useState(new Date());
  const monthYear = new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <>
      <style>{`
        .payroll-container {
          max-width: 900px;
          margin: 0 auto;
          padding: 20px;
          padding-bottom: 100px;
        }

        .payroll-header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 24px;
          border-radius: 12px;
          margin-bottom: 24px;
          text-align: center;
        }

        .payroll-header h2 {
          margin: 0 0 8px 0;
          font-size: 24px;
        }

        .payroll-header p {
          margin: 0;
          opacity: 0.9;
          font-size: 14px;
        }

        .payroll-card {
          background: white;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 20px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .payroll-card h3 {
          margin: 0 0 16px 0;
          color: #333;
          font-size: 18px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .read-only-badge {
          display: inline-block;
          background: #ffe082;
          color: #f57f17;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
          margin-left: 8px;
        }

        .month-selector {
          display: flex;
          gap: 10px;
          margin-bottom: 20px;
          justify-content: center;
          flex-wrap: wrap;
        }

        .month-selector input {
          padding: 10px 16px;
          border: 2px solid #e0e0e0;
          border-radius: 8px;
          font-size: 16px;
          cursor: pointer;
        }

        .month-selector input:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .salary-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 20px;
        }

        .salary-item {
          background: #f5f5f5;
          padding: 16px;
          border-radius: 8px;
          border-left: 4px solid #667eea;
        }

        .salary-item.attention {
          border-left-color: #ff5252;
          background: #ffebee;
        }

        .salary-item-label {
          font-size: 12px;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
        }

        .salary-item-value {
          font-size: 24px;
          font-weight: 700;
          color: #333;
        }

        .salary-item.attention .salary-item-value {
          color: #ff5252;
        }

        .thursday-section {
          background: #f9f9f9;
          padding: 16px;
          border-radius: 8px;
          margin-top: 16px;
        }

        .thursday-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 12px;
        }

        .thursday-table th {
          background: #f0f0f0;
          padding: 12px;
          text-align: left;
          font-weight: 600;
          font-size: 13px;
          color: #333;
          border-bottom: 2px solid #e0e0e0;
        }

        .thursday-table td {
          padding: 12px;
          border-bottom: 1px solid #e0e0e0;
          font-size: 14px;
        }

        .thursday-table tr:last-child td {
          border-bottom: none;
        }

        .thursday-status-paid {
          color: #2e7d32;
          font-weight: 600;
        }

        .thursday-status-deducted {
          color: #d32f2f;
          font-weight: 600;
        }

        .thursday-status-worked {
          color: #f57c00;
          font-weight: 600;
        }

        .deduction-detail {
          background: white;
          padding: 12px;
          border-radius: 6px;
          margin-top: 8px;
          border-left: 3px solid #ff5252;
          font-size: 13px;
          color: #666;
          line-height: 1.5;
        }

        .security-note {
          background: #e3f2fd;
          border: 1px solid #90caf9;
          border-radius: 8px;
          padding: 12px;
          margin-top: 16px;
          font-size: 13px;
          color: #1565c0;
          line-height: 1.5;
        }

        .empty-state {
          text-align: center;
          padding: 40px 20px;
          color: #999;
        }

        .empty-state-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }

        .summary-section {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 24px;
          border-radius: 12px;
          margin-top: 24px;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 16px;
          margin-top: 16px;
        }

        .summary-item {
          text-align: center;
        }

        .summary-label {
          font-size: 12px;
          opacity: 0.9;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .summary-value {
          font-size: 28px;
          font-weight: 700;
          margin-top: 8px;
        }
      `}</style>

      <div className="header">
        <div className="header-title">💰 My Payroll</div>
      </div>

      <div className="payroll-container">
        {/* Read-Only Notice */}
        <div style={{
          background: '#fff3cd',
          border: '1px solid #ffc107',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <span style={{ fontSize: '20px' }}>🔒</span>
          <div style={{ fontSize: '14px', color: '#856404' }}>
            <strong>Read-Only Access:</strong> Payroll data is for your reference only. You cannot edit or modify any salary information.
          </div>
        </div>

        {/* Month Selector */}
        <div className="month-selector">
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '600' }}>
            📅 Select Month:
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{ marginLeft: '8px' }}
            />
          </label>
        </div>

        {/* Payroll Header */}
        <div className="payroll-header">
          <h2>💵 Salary Slip - {monthYear}</h2>
          <p>Technician ID: {currentUser?.id} | {currentUser?.name}</p>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            padding: '15px',
            backgroundColor: '#ffebee',
            border: '1px solid #f44336',
            borderRadius: '8px',
            color: '#c62828',
            marginBottom: '20px',
            fontSize: '14px'
          }}>
            ⚠️ {error}
          </div>
        )}

        {loading ? (
          <div className="empty-state">
            <div className="empty-state-icon">⏳</div>
            <p>Loading payroll data...</p>
          </div>
        ) : !payrollData ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <p>No payroll data available for this month</p>
            <p style={{ fontSize: '13px', marginTop: '8px', opacity: 0.7 }}>
              Payroll information will appear here once processed by admin
            </p>
          </div>
        ) : (
          <>
            {/* Attendance Summary */}
            <div className="payroll-card">
              <h3>📊 Attendance Summary</h3>
              <div className="salary-grid">
                <div className="salary-item">
                  <div className="salary-item-label">Total Days</div>
                  <div className="salary-item-value">{payrollData.salaryStructure.daysInMonth}</div>
                </div>
                <div className="salary-item">
                  <div className="salary-item-label">Worked Days</div>
                  <div className="salary-item-value">{payrollData.attendance.workedDays}</div>
                </div>
                <div className="salary-item">
                  <div className="salary-item-label">Daily Rate</div>
                  <div className="salary-item-value">₹{payrollData.salaryStructure.actualPerDaySalary.toFixed(2)}</div>
                </div>
              </div>
            </div>

            {/* Thursday Salary Details */}
            <div className="payroll-card">
              <h3>
                📅 Thursday Holiday Salary
                <span className="read-only-badge">READ-ONLY</span>
              </h3>
              <p style={{ color: '#666', fontSize: '14px', marginBottom: '16px' }}>
                Thursday is your weekly paid holiday. Your Thursday salary is paid only if you are present on both Tuesday and Friday of the same week (Monday-Sunday).
              </p>

              <div className="salary-grid">
                <div className="salary-item">
                  <div className="salary-item-label">Total Thursdays</div>
                  <div className="salary-item-value">{payrollData.attendance.totalThursdays}</div>
                </div>
                <div className="salary-item">
                  <div className="salary-item-label">Paid Thursdays ✓</div>
                  <div className="salary-item-value" style={{ color: '#2e7d32' }}>
                    {payrollData.attendance.thursdaysPaid}
                  </div>
                </div>
                <div className="salary-item attention">
                  <div className="salary-item-label">Deducted Thursdays ✗</div>
                  <div className="salary-item-value">{payrollData.attendance.thursdaysDeducted}</div>
                </div>
                <div className="salary-item">
                  <div className="salary-item-label">Worked Thursdays 🎉</div>
                  <div className="salary-item-value" style={{ color: '#f57c00' }}>
                    {payrollData.attendance.thursdaysWorked}
                  </div>
                </div>
              </div>

              {/* Thursday Breakdown Table */}
              {payrollData.attendance.thursdayDetails && payrollData.attendance.thursdayDetails.length > 0 && (
                <div className="thursday-section">
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600' }}>
                    Week-wise Thursday Breakdown
                  </h4>
                  <table className="thursday-table">
                    <thead>
                      <tr>
                        <th>Thursday</th>
                        <th>Tuesday</th>
                        <th>Friday</th>
                        <th>Status</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payrollData.attendance.thursdayDetails.map((thursday, idx) => (
                        <tr key={idx}>
                          <td>{attendanceAccessControl.formatDate(thursday.date)}</td>
                          <td>{thursday.tuesdayPresent ? '✓ Present' : '✗ Absent'}</td>
                          <td>{thursday.fridayPresent ? '✓ Present' : '✗ Absent'}</td>
                          <td>
                            {thursday.status === 'paid' && <span className="thursday-status-paid">✓ PAID</span>}
                            {thursday.status === 'deducted' && <span className="thursday-status-deducted">✗ DEDUCTED</span>}
                            {thursday.status === 'worked_on_holiday' && <span className="thursday-status-worked">🎉 EXTRA</span>}
                          </td>
                          <td>
                            {thursday.status === 'paid' && <span style={{ color: '#2e7d32' }}>+₹{payrollData.salaryStructure.actualPerDaySalary.toFixed(2)}</span>}
                            {thursday.status === 'deducted' && <span style={{ color: '#d32f2f' }}>-₹{payrollData.salaryStructure.actualPerDaySalary.toFixed(2)}</span>}
                            {thursday.status === 'worked_on_holiday' && <span style={{ color: '#f57c00' }}>+₹{payrollData.salaryStructure.actualPerDaySalary.toFixed(2)}</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Deduction Explanations */}
                  {payrollData.attendance.thursdayDetails.some(t => t.status === 'deducted') && (
                    <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#ffebee', borderRadius: '6px', borderLeft: '3px solid #f44336' }}>
                      <strong style={{ color: '#d32f2f' }}>⚠️ Thursday Salary Deductions Explanation:</strong>
                      {payrollData.attendance.thursdayDetails
                        .filter(t => t.status === 'deducted')
                        .map((thursday, idx) => (
                          <div key={idx} className="deduction-detail">
                            <strong>{attendanceAccessControl.formatDate(thursday.date)}:</strong>{' '}
                            {attendanceAccessControl.formatThursdayDeductionReason(thursday.date, thursday)}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Salary Breakdown */}
            <div className="payroll-card">
              <h3>💸 Salary Breakdown</h3>
              <div className="salary-grid">
                <div className="salary-item">
                  <div className="salary-item-label">Base Salary</div>
                  <div className="salary-item-value">₹{payrollData.baseSalary.toFixed(2)}</div>
                </div>
                <div className="salary-item">
                  <div className="salary-item-label">Thursday Paid</div>
                  <div className="salary-item-value" style={{ color: '#2e7d32' }}>
                    +₹{payrollData.thursdayPaidSalary.toFixed(2)}
                  </div>
                </div>
                <div className="salary-item">
                  <div className="salary-item-label">Thursday Extra</div>
                  <div className="salary-item-value" style={{ color: '#f57c00' }}>
                    +₹{payrollData.thursdayExtraPay.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            {/* Final Salary */}
            <div className="summary-section">
              <h3 style={{ margin: '0 0 16px 0', fontSize: '20px' }}>💰 Net Monthly Salary</h3>
              <div style={{ fontSize: '48px', fontWeight: '700', textAlign: 'center' }}>
                ₹{payrollData.netSalary.toFixed(2)}
              </div>
              <div style={{ textAlign: 'center', opacity: 0.9, marginTop: '8px', fontSize: '14px' }}>
                (Calculated for {monthYear})
              </div>
            </div>

            {/* Edit Permissions Notice */}
            <div style={{
              background: '#e8f5e9',
              border: '1px solid #4caf50',
              borderRadius: '8px',
              padding: '12px 16px',
              marginTop: '20px'
            }}>
              <strong style={{ color: '#2e7d32', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>ℹ️</span> Data Access Rules
              </strong>
              <ul style={{ margin: '8px 0 0 24px', color: '#558b2f', fontSize: '13px' }}>
                <li>✓ You can ONLY view your own payroll data</li>
                <li>✗ You cannot edit any salary information</li>
                <li>✗ You cannot modify deductions or dates</li>
                <li>✓ Deduction reasons are shown above</li>
                <li>✓ Contact admin if you have questions</li>
              </ul>
            </div>

            {/* Security Note */}
            <div className="security-note">
              🔒 <strong>Security Note:</strong> All payroll data is encrypted and tamper-proof. Any modifications to salary records are logged and can only be made by authorized administrators.
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default PayrollViewScreen;
