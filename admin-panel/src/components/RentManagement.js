import React, { useEffect, useState } from 'react';
import { getDatabase, ref, get, child } from 'firebase/database';
import rentPaymentService from '../services/rentPaymentService';
import dataService from '../services/dataService';

const RentManagement = () => {
  const [customers, setCustomers] = useState([]);
  const [activeTab, setActiveTab] = useState('active'); // 'active', 'due', 'history'
  const [paymentModal, setPaymentModal] = useState({
    show: false,
    customerId: null,
    customer: null,
    month: '',
    amount: '',
    method: 'Cash',
    note: ''
  });
  const [callLogModal, setCallLogModal] = useState({
    show: false,
    customerId: null,
    customer: null,
    callStatus: '',
    nextFollowUpDate: '',
    notes: ''
  });
  const [paymentSummary, setPaymentSummary] = useState(null);

  // Load customers from Firebase
  useEffect(() => {
    const loadCustomers = async () => {
      try {
        const db = getDatabase();
        const snapshot = await get(child(ref(db), 'customers'));
        if (snapshot.exists()) {
          const data = Object.entries(snapshot.val()).map(([id, customer]) => ({
            id,
            ...customer
          }));
          setCustomers(data);
          setPaymentSummary(rentPaymentService.getPaymentSummary(data));
        }
      } catch (error) {
        console.error('Error loading customers:', error);
      }
    };

    loadCustomers();
  }, []);

  // Open payment modal
  const handleOpenPaymentModal = (customer) => {
    const currentMonth = rentPaymentService.getCurrentMonth();
    setPaymentModal({
      show: true,
      customerId: customer.id,
      customer: customer,
      month: currentMonth,
      amount: customer.monthlyRent || '',
      method: 'Cash',
      note: ''
    });
  };

  // Close payment modal
  const handleClosePaymentModal = () => {
    setPaymentModal({
      show: false,
      customerId: null,
      customer: null,
      month: '',
      amount: '',
      method: 'Cash',
      note: ''
    });
  };

  // Save payment
  const handleSavePayment = async () => {
    if (!paymentModal.month || !paymentModal.amount) {
      alert('Please fill in Month and Amount');
      return;
    }

    try {
      const customer = paymentModal.customer;
      const paymentData = {
        month: paymentModal.month,
        amount: parseInt(paymentModal.amount),
        method: paymentModal.method,
        note: paymentModal.note
      };

      // Record payment and get updated data
      const updatedData = rentPaymentService.recordPayment(customer, paymentData);

      // Update customer in Firebase
      await dataService.updateCustomer(paymentModal.customerId, updatedData);

      // Refresh customers list
      const db = getDatabase();
      const snapshot = await get(child(ref(db), 'customers'));
      if (snapshot.exists()) {
        const data = Object.entries(snapshot.val()).map(([id, cust]) => ({
          id,
          ...cust
        }));
        setCustomers(data);
        setPaymentSummary(rentPaymentService.getPaymentSummary(data));
      }

      handleClosePaymentModal();
      alert('✓ Payment recorded successfully!');
    } catch (error) {
      console.error('Error saving payment:', error);
      alert('Failed to save payment. Please try again.');
    }
  };

  // Open call log modal
  const handleOpenCallLogModal = (customer) => {
    setCallLogModal({
      show: true,
      customerId: customer.id,
      customer: customer,
      callStatus: '',
      nextFollowUpDate: '',
      notes: ''
    });
  };

  // Close call log modal
  const handleCloseCallLogModal = () => {
    setCallLogModal({
      show: false,
      customerId: null,
      customer: null,
      callStatus: '',
      nextFollowUpDate: '',
      notes: ''
    });
  };

  // Save call log
  const handleSaveCallLog = async () => {
    if (!callLogModal.callStatus || !callLogModal.nextFollowUpDate) {
      alert('Please fill in Call Status and Follow-up Date');
      return;
    }

    try {
      const callLog = {
        customerId: callLogModal.customerId,
        callStatus: callLogModal.callStatus,
        callDate: new Date().toISOString().split('T')[0],
        nextFollowUpDate: callLogModal.nextFollowUpDate,
        notes: callLogModal.notes
      };

      // Save call log to database
      const db = getDatabase();
      const logsRef = ref(db, `callLogs/${callLogModal.customerId}`);
      await get(logsRef).then(snapshot => {
        const logs = snapshot.exists() ? snapshot.val() : {};
        logs[Date.now()] = callLog;
        // Update to database
        const updates = {};
        updates[`callLogs/${callLogModal.customerId}`] = logs;
      });

      handleCloseCallLogModal();
      alert('✓ Call log saved successfully!');
    } catch (error) {
      console.error('Error saving call log:', error);
      alert('Failed to save call log. Please try again.');
    }
  };

  // Get filtered customers
  const getFilteredCustomers = () => {
    if (activeTab === 'active') {
      return rentPaymentService.getActiveRentCustomers(customers);
    } else if (activeTab === 'due') {
      return rentPaymentService.getDueRentCustomers(customers);
    }
    return [];
  };

  // Get payment history report
  const getPaymentHistoryReport = () => {
    return rentPaymentService.getPaymentHistoryReport(customers);
  };

  const filteredCustomers = getFilteredCustomers();
  const paymentHistory = getPaymentHistoryReport();

  return (
    <div style={{ padding: '20px' }}>
      <h2>🏠 Rent Management</h2>

      {/* Payment Summary */}
      {paymentSummary && (
        <div style={{
          display: 'flex',
          gap: '15px',
          marginBottom: '20px',
          flexWrap: 'wrap'
        }}>
          <div style={{
            padding: '15px',
            backgroundColor: '#e3f2fd',
            borderRadius: '6px',
            flex: '1',
            minWidth: '150px'
          }}>
            <div style={{ fontSize: '12px', color: '#666' }}>Total Rent Customers</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1976d2' }}>
              {paymentSummary.totalCustomers}
            </div>
          </div>
          <div style={{
            padding: '15px',
            backgroundColor: '#f3e5f5',
            borderRadius: '6px',
            flex: '1',
            minWidth: '150px'
          }}>
            <div style={{ fontSize: '12px', color: '#666' }}>Monthly Rent Total</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#7b1fa2' }}>
              ₹{paymentSummary.totalMonthlyRent}
            </div>
          </div>
          <div style={{
            padding: '15px',
            backgroundColor: '#e8f5e9',
            borderRadius: '6px',
            flex: '1',
            minWidth: '150px'
          }}>
            <div style={{ fontSize: '12px', color: '#666' }}>Paid This Month</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#388e3c' }}>
              ₹{paymentSummary.paidThisMonth}
            </div>
          </div>
          <div style={{
            padding: '15px',
            backgroundColor: '#ffebee',
            borderRadius: '6px',
            flex: '1',
            minWidth: '150px'
          }}>
            <div style={{ fontSize: '12px', color: '#666' }}>Due This Month</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#d32f2f' }}>
              ₹{paymentSummary.dueThisMonth}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '6px',
        marginBottom: '15px',
        borderBottom: '1px solid #ddd',
        paddingBottom: '6px'
      }}>
        <button
          onClick={() => setActiveTab('active')}
          style={{
            padding: '8px 15px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeTab === 'active' ? '#1976d2' : '#f0f0f0',
            color: activeTab === 'active' ? 'white' : '#333',
            borderRadius: '4px',
            fontWeight: activeTab === 'active' ? 'bold' : 'normal',
            fontSize: '13px'
          }}
        >
          ✓ Active Rent Customers ({rentPaymentService.getActiveRentCustomers(customers).length})
        </button>
        <button
          onClick={() => setActiveTab('due')}
          style={{
            padding: '8px 15px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeTab === 'due' ? '#d32f2f' : '#f0f0f0',
            color: activeTab === 'due' ? 'white' : '#333',
            borderRadius: '4px',
            fontWeight: activeTab === 'due' ? 'bold' : 'normal',
            fontSize: '13px'
          }}
        >
          💰 Due Rent ({rentPaymentService.getDueRentCustomers(customers).length})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          style={{
            padding: '8px 15px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeTab === 'history' ? '#388e3c' : '#f0f0f0',
            color: activeTab === 'history' ? 'white' : '#333',
            borderRadius: '4px',
            fontWeight: activeTab === 'history' ? 'bold' : 'normal',
            fontSize: '13px'
          }}
        >
          📋 Payment History
        </button>
      </div>

      {/* Active Rent Customers Tab */}
      {activeTab === 'active' && (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Sr. No.</th>
                <th>Customer Name</th>
                <th>Card #</th>
                <th>Address</th>
                <th>Monthly Rent (₹)</th>
                <th>Rent Start Date</th>
                <th>Last Paid Month</th>
                <th>Next Due Month</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map((customer, index) => (
                <tr key={customer.id}>
                  <td><strong>{index + 1}</strong></td>
                  <td>{customer.fullName || customer.name}</td>
                  <td><strong>{customer.cardNumber || 'N/A'}</strong></td>
                  <td>{customer.address || '-'}</td>
                  <td>₹{customer.monthlyRent || '0'}</td>
                  <td>{customer.rentStartDate || '-'}</td>
                  <td>{customer.lastPaidMonth || '-'}</td>
                  <td>{customer.nextDueMonth || '-'}</td>
                  <td>
                    <span style={{
                      backgroundColor: rentPaymentService.isRentDue(customer) ? '#ffcdd2' : '#c8e6c9',
                      color: rentPaymentService.isRentDue(customer) ? '#c62828' : '#2e7d32',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 'bold'
                    }}>
                      {rentPaymentService.isRentDue(customer) ? '⚠️ Due' : '✓ Paid'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {rentPaymentService.isRentDue(customer) && (
                        <button
                          className="btn"
                          style={{
                            padding: '4px 8px',
                            fontSize: '10px',
                            backgroundColor: '#4caf50',
                            color: 'white'
                          }}
                          onClick={() => handleOpenPaymentModal(customer)}
                        >
                          Mark as Paid
                        </button>
                      )}
                      <button
                        className="btn"
                        style={{
                          padding: '4px 8px',
                          fontSize: '10px',
                          backgroundColor: '#2196f3',
                          color: 'white'
                        }}
                        onClick={() => handleOpenCallLogModal(customer)}
                      >
                        📞 Call Log
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Due Rent Tab */}
      {activeTab === 'due' && (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Sr. No.</th>
                <th>Customer Name</th>
                <th>Card #</th>
                <th>Address</th>
                <th>Monthly Rent (₹)</th>
                <th>Due Month</th>
                <th>Last Paid Month</th>
                <th>Days Overdue</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map((customer, index) => {
                const dueDate = new Date(customer.nextDueMonth + ' 1');
                const today = new Date();
                const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));

                return (
                  <tr key={customer.id} style={{ backgroundColor: '#ffebee' }}>
                    <td><strong>{index + 1}</strong></td>
                    <td>{customer.fullName || customer.name}</td>
                    <td><strong>{customer.cardNumber || 'N/A'}</strong></td>
                    <td>{customer.address || '-'}</td>
                    <td style={{ color: '#d32f2f', fontWeight: 'bold' }}>₹{customer.monthlyRent || '0'}</td>
                    <td style={{ fontWeight: 'bold' }}>{customer.nextDueMonth || rentPaymentService.getCurrentMonth()}</td>
                    <td>{customer.lastPaidMonth || 'None'}</td>
                    <td style={{ color: daysOverdue > 0 ? '#d32f2f' : '#333', fontWeight: 'bold' }}>
                      {daysOverdue > 0 ? `${daysOverdue} days` : 'Not Started'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <button
                          className="btn"
                          style={{
                            padding: '4px 8px',
                            fontSize: '10px',
                            backgroundColor: '#4caf50',
                            color: 'white'
                          }}
                          onClick={() => handleOpenPaymentModal(customer)}
                        >
                          ✓ Mark as Paid
                        </button>
                        <button
                          className="btn"
                          style={{
                            padding: '4px 8px',
                            fontSize: '10px',
                            backgroundColor: '#2196f3',
                            color: 'white'
                          }}
                          onClick={() => handleOpenCallLogModal(customer)}
                        >
                          📞 Call Log
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Payment History Tab */}
      {activeTab === 'history' && (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Sr. No.</th>
                <th>Customer Name</th>
                <th>Card #</th>
                <th>Month</th>
                <th>Amount (₹)</th>
                <th>Paid On</th>
                <th>Method</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {paymentHistory.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', color: '#999', padding: '20px' }}>
                    No payment history available
                  </td>
                </tr>
              ) : (
                paymentHistory.map((payment, index) => (
                  <tr key={index}>
                    <td><strong>{index + 1}</strong></td>
                    <td>{payment.customerName}</td>
                    <td><strong>{payment.cardNumber || 'N/A'}</strong></td>
                    <td>{payment.month}</td>
                    <td style={{ fontWeight: 'bold', color: '#4caf50' }}>₹{payment.amount}</td>
                    <td>{payment.paidOn}</td>
                    <td>
                      <span style={{
                        backgroundColor: payment.method === 'PhonePe' ? '#4caf50' :
                                       payment.method === 'Cash' ? '#ff9800' : '#2196f3',
                        color: 'white',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: 'bold'
                      }}>
                        {payment.method}
                      </span>
                    </td>
                    <td style={{ fontSize: '11px', color: '#666' }}>{payment.note || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Payment Modal */}
      {paymentModal.show && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
          }}>
            <h3>💰 Record Rent Payment</h3>
            <p style={{ color: '#666', marginBottom: '15px' }}>
              Customer: <strong>{paymentModal.customer?.fullName || paymentModal.customer?.name}</strong>
            </p>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '12px' }}>Month:</label>
              <input
                type="text"
                value={paymentModal.month}
                disabled
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  backgroundColor: '#f5f5f5',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '12px' }}>Amount (₹):</label>
              <input
                type="number"
                value={paymentModal.amount}
                onChange={(e) => setPaymentModal({ ...paymentModal, amount: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '12px' }}>Payment Method:</label>
              <select
                value={paymentModal.method}
                onChange={(e) => setPaymentModal({ ...paymentModal, method: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  boxSizing: 'border-box'
                }}
              >
                <option value="Cash">💵 Cash</option>
                <option value="PhonePe">📱 PhonePe</option>
                <option value="Other">💳 Other</option>
              </select>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '12px' }}>Notes (Optional):</label>
              <textarea
                value={paymentModal.note}
                onChange={(e) => setPaymentModal({ ...paymentModal, note: e.target.value })}
                placeholder="Add any notes..."
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  minHeight: '80px',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={handleClosePaymentModal}
                style={{
                  padding: '8px 15px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  backgroundColor: '#f5f5f5'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSavePayment}
                style={{
                  padding: '8px 15px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  backgroundColor: '#4caf50',
                  color: 'white',
                  fontWeight: 'bold'
                }}
              >
                ✓ Save Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Call Log Modal */}
      {callLogModal.show && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
          }}>
            <h3>📞 Call Log</h3>
            <p style={{ color: '#666', marginBottom: '15px' }}>
              Customer: <strong>{callLogModal.customer?.fullName || callLogModal.customer?.name}</strong>
            </p>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '12px' }}>Call Status:</label>
              <select
                value={callLogModal.callStatus}
                onChange={(e) => setCallLogModal({ ...callLogModal, callStatus: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  boxSizing: 'border-box'
                }}
              >
                <option value="">Select Status</option>
                <option value="Connected">✓ Connected</option>
                <option value="Not Reachable">✗ Not Reachable</option>
                <option value="Call Back Later">⏳ Call Back Later</option>
                <option value="Promised Payment">💬 Promised Payment</option>
              </select>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '12px' }}>Follow-up Date:</label>
              <input
                type="date"
                value={callLogModal.nextFollowUpDate}
                onChange={(e) => setCallLogModal({ ...callLogModal, nextFollowUpDate: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '12px' }}>Notes:</label>
              <textarea
                value={callLogModal.notes}
                onChange={(e) => setCallLogModal({ ...callLogModal, notes: e.target.value })}
                placeholder="Call notes..."
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  minHeight: '80px',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={handleCloseCallLogModal}
                style={{
                  padding: '8px 15px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  backgroundColor: '#f5f5f5'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCallLog}
                style={{
                  padding: '8px 15px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  backgroundColor: '#2196f3',
                  color: 'white',
                  fontWeight: 'bold'
                }}
              >
                ✓ Save Call Log
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RentManagement;
