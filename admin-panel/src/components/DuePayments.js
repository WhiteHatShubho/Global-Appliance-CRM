import React, { useState, useEffect } from 'react';
import dataService from '../services/dataService';

const DuePayments = () => {
  const [duePayments, setDuePayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [paymentAmountInput, setPaymentAmountInput] = useState('');
  const [callLogModal, setCallLogModal] = useState({
    show: false,
    customer: null,
    callLogs: [],
    newLog: {
      callStatus: '',
      notes: '',
      nextFollowUpDate: '',
      nextFollowUpTime: ''
    }
  });

  useEffect(() => {
    loadDuePayments();
  }, []);

  const loadDuePayments = async () => {
    try {
      setLoading(true);
      // Use cache first, only force refresh if needed
      const tickets = await dataService.getTickets();
      const customers = await dataService.getCustomers();
      
      // AI Logic: Calculate due amounts from total_amount - total_paid (SOURCE OF TRUTH)
      const dueList = [];
      
      // 1. Tickets: Calculate due as (paymentAmount - amountPaid) > 0
      const ticketDueList = tickets.filter(ticket => {
        const totalAmount = ticket.paymentAmount || 0;
        const paidAmount = ticket.amountPaid || 0;
        const due = totalAmount - paidAmount;
        return due > 0; // Source of truth: calculate due from totals
      }).map(ticket => {
        const totalAmount = ticket.paymentAmount || 0;
        const paidAmount = ticket.amountPaid || 0;
        return {
          ...ticket,
          totalDue: totalAmount - paidAmount, // Recalculate from source of truth
          amountPaid: paidAmount,
          paymentStatus: paidAmount >= totalAmount ? 'completed' : (paidAmount > 0 ? 'half-paid' : 'pending'),
          source: 'ticket'
        };
      });
      
      dueList.push(...ticketDueList);
      
      // 2. Customers AMC: Calculate due as (amcAmount - amcPaidAmount) > 0
      const customerDueList = customers
        .filter(customer => {
          const amcAmount = parseFloat(customer.amcAmount) || 0;
          const amcPaidAmount = parseFloat(customer.amcPaidAmount) || 0;
          const dueAmount = amcAmount - amcPaidAmount;
          return dueAmount > 0; // Source of truth: calculate from totals
        })
        .map(customer => {
          const amcAmount = parseFloat(customer.amcAmount) || 0;
          const amcPaidAmount = parseFloat(customer.amcPaidAmount) || 0;
          return {
            id: `AMC-${customer.id}`,
            customerId: customer.id,
            customerName: customer.fullName || customer.name,
            title: `AMC Renewal - ${customer.machineName || 'Machine'}`,
            paymentAmount: amcAmount,
            amountPaid: amcPaidAmount,
            totalDue: amcAmount - amcPaidAmount, // Recalculate from source of truth
            paymentStatus: amcPaidAmount >= amcAmount ? 'completed' : (amcPaidAmount > 0 ? 'half-paid' : 'pending'),
            source: 'amc',
            dueReason: 'Partial/Unpaid AMC',
            phone: customer.phone
          };
        });
      
      dueList.push(...customerDueList);
      
      // Sort by due amount (highest first)
      dueList.sort((a, b) => (b.totalDue || 0) - (a.totalDue || 0));
      
      setDuePayments(dueList);
    } catch (error) {
      console.error('Error loading due payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentReceived = async (payment) => {
    const amountToCollect = parseFloat(paymentAmountInput);
    
    if (!amountToCollect || amountToCollect <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    if (amountToCollect > payment.totalDue) {
      alert(`Amount cannot exceed due amount (₹${payment.totalDue})`);
      return;
    }

    try {
      setLoading(true);
      const now = new Date();
      const newDueAmount = payment.totalDue - amountToCollect;
      const newAmountPaid = payment.amountPaid + amountToCollect;
      const newPaymentStatus = newDueAmount === 0 ? 'PAID' : 'PARTIAL';

      // ✅ STEP 1: Save payment to payments collection with all required fields
      const paymentType = payment.source === 'ticket' ? 'Service' : (payment.source === 'amc' ? 'AMC' : 'Rent');
      const paymentRecord = {
        jobId: payment.source === 'ticket' ? payment.id : null,
        amcId: payment.source === 'amc' ? payment.customerId : null,
        customerId: payment.customerId,
        customerName: payment.customerName,
        ticketId: payment.source === 'ticket' ? payment.id : null,
        amount: amountToCollect,
        method: 'cash',
        date: now.toISOString().split('T')[0],
        timestamp: now.toISOString(),
        status: 'PAID',
        type: paymentType,
        reference: payment.source === 'ticket' ? `TKT-${payment.id}` : `AMC-${payment.customerId}`,
        notes: `Payment for ${paymentType}: ${payment.title}`,
        source: payment.source
      };
      await dataService.addPayment(paymentRecord);

      // ✅ STEP 2: Update based on source
      if (payment.source === 'ticket') {
        // Update ticket
        await dataService.updateTicket(payment.id, {
          paymentStatus: newPaymentStatus,
          amountPaid: newAmountPaid,
          dueAmount: newDueAmount,
          lastPaymentReceivedAt: now.toISOString()
        });
      } else if (payment.source === 'amc') {
        // Update customer AMC payment
        const customers = await dataService.getCustomers();
        const customer = customers.find(c => c.id === payment.customerId);
        if (customer) {
          await dataService.updateCustomer(payment.customerId, {
            amcPaidAmount: newAmountPaid,
            paymentStatus: newPaymentStatus,
            lastPaymentDate: now.toISOString().split('T')[0],
            lastPaymentAmount: amountToCollect
          });
        }
      }

      alert(`Payment of ₹${amountToCollect} recorded successfully!`);
      setPaymentAmountInput('');
      setSelectedPayment(null);
      // ✅ STEP 3: Reload both Due Payments and refresh Payments section
      await loadDuePayments();
      // Force UI state update by setting a tiny delay
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('paymentUpdated', { detail: { timestamp: Date.now() } }));
      }, 300);
    } catch (error) {
      console.error('Error recording payment:', error);
      alert('Failed to record payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCallLog = async (payment) => {
    try {
      setLoading(true);
      const customerLogs = await dataService.getCallLogs(payment.customerId, true);
      
      // Sort by timestamp descending (newest first)
      customerLogs.sort((a, b) => new Date(b.callDateTime) - new Date(a.callDateTime));
      
      setCallLogModal({
        show: true,
        customer: {
          id: payment.customerId,
          fullName: payment.customerName,
          name: payment.customerName,
          phone: payment.phone || payment.customerPhone,
          cardNumber: payment.cardNumber || 'N/A',
          machineName: payment.title
        },
        callLogs: customerLogs,
        newLog: {
          callStatus: '',
          notes: '',
          nextFollowUpDate: '',
          nextFollowUpTime: ''
        }
      });
    } catch (error) {
      console.error('Error loading call logs:', error);
      alert('Failed to load call logs');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCallLog = async () => {
    if (!callLogModal.newLog.callStatus) {
      alert('⚠️ Please select a call status');
      return;
    }
    
    // Only require notes for certain statuses
    const statusesRequiringNotes = ['Confirmed', 'Payment Pending', 'Promised Payment', 'Partial Payment', 'Other'];
    if (statusesRequiringNotes.includes(callLogModal.newLog.callStatus) && !callLogModal.newLog.notes.trim()) {
      alert('⚠️ Please add conversation notes for this status');
      return;
    }

    try {
      setLoading(true);
      const now = new Date();
      const callLogData = {
        customerId: callLogModal.customer.id,
        customerName: callLogModal.customer.fullName || callLogModal.customer.name,
        customerPhone: callLogModal.customer.phone,
        callDateTime: now.toISOString(),
        callDate: now.toISOString().split('T')[0],
        callTime: now.toTimeString().split(' ')[0].substring(0, 5),
        callStatus: callLogModal.newLog.callStatus,
        notes: callLogModal.newLog.notes || `Call status: ${callLogModal.newLog.callStatus}`,
        nextFollowUpDate: callLogModal.newLog.nextFollowUpDate || null,
        nextFollowUpTime: callLogModal.newLog.nextFollowUpTime || null,
        createdBy: 'admin',
        createdAt: now.toISOString()
      };

      const newLog = await dataService.addCallLog(callLogData);
      if (newLog) {
        // Refresh call logs
        const updatedLogs = await dataService.getCallLogs(callLogModal.customer.id, true);
        updatedLogs.sort((a, b) => new Date(b.callDateTime) - new Date(a.callDateTime));
        
        setCallLogModal({
          ...callLogModal,
          callLogs: updatedLogs,
          newLog: {
            callStatus: '',
            notes: '',
            nextFollowUpDate: '',
            nextFollowUpTime: ''
          }
        });
        alert('✅ Call log saved successfully!');
      }
    } catch (error) {
      console.error('Error saving call log:', error);
      alert('Failed to save call log');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCallLog = async (logId) => {
    if (!window.confirm('Are you sure you want to delete this call log?')) {
      return;
    }

    try {
      setLoading(true);
      await dataService.deleteCallLog(logId);
      
      // Refresh call logs
      const updatedLogs = await dataService.getCallLogs(callLogModal.customer.id, true);
      updatedLogs.sort((a, b) => new Date(b.callDateTime) - new Date(a.callDateTime));
      
      setCallLogModal({
        ...callLogModal,
        callLogs: updatedLogs
      });
      alert('✅ Call log deleted successfully!');
    } catch (error) {
      console.error('Error deleting call log:', error);
      alert('Failed to delete call log');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAllCallLogs = async () => {
    if (!window.confirm(`Are you sure you want to delete ALL ${callLogModal.callLogs.length} call logs for ${callLogModal.customer.fullName || callLogModal.customer.name}? This action cannot be undone!`)) {
      return;
    }

    try {
      setLoading(true);
      
      // Delete all logs for this customer
      for (const log of callLogModal.callLogs) {
        await dataService.deleteCallLog(log.id);
      }
      
      setCallLogModal({
        ...callLogModal,
        callLogs: []
      });
      alert('✅ All call logs deleted successfully!');
    } catch (error) {
      console.error('Error deleting all call logs:', error);
      alert('Failed to delete all call logs');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'pending':
        return '#dc3545'; // Red - no payment made
      case 'half-paid':
        return '#ff9800'; // Orange - partial payment
      default:
        return '#6c757d';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pending':
        return 'No Payment';
      case 'half-paid':
        return 'Partial Payment';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="content">
        <h1>Due Payments</h1>
        <div style={{ textAlign: 'center', padding: '20px' }}>Loading due payments...</div>
      </div>
    );
  }

  return (
    <div className="content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>💰 Due Payments</h1>
        <button className="btn" style={{ width: 'auto' }} onClick={loadDuePayments}>
          Refresh
        </button>
      </div>

      {duePayments.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '10px' }}>✅</div>
          <p style={{ fontSize: '1.1rem', color: '#666' }}>No pending payments! All invoices are settled.</p>
        </div>
      ) : (
        <div>
          <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#fff3cd', borderRadius: '5px' }}>
            <p style={{ margin: '0', fontWeight: 'bold' }}>
              📊 Total Due Payments: <span style={{ color: '#dc3545', fontSize: '1.2rem' }}>₹{duePayments.reduce((sum, p) => sum + p.totalDue, 0)}</span>
            </p>
            <p style={{ margin: '5px 0 0 0', color: '#666', fontSize: '0.9rem' }}>
              {duePayments.length} job(s) with pending payments
            </p>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Job Code</th>
                  <th>Customer</th>
                  <th>Service</th>
                  <th>Total Amount</th>
                  <th>Paid</th>
                  <th>Due</th>
                  <th>Status</th>
                  <th>Type</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {duePayments.map((payment) => (
                  <tr key={payment.id}>
                    <td><span style={{ fontSize: '1rem', fontWeight: 'bold', color: '#0066ff' }}>{payment.ticketCode || payment.id.substring(0, 4)}</span></td>
                    <td>{payment.customerName}</td>
                    <td>{payment.title}</td>
                    <td>₹{payment.paymentAmount || 0}</td>
                    <td><span style={{ color: '#28a745', fontWeight: 'bold' }}>₹{payment.amountPaid}</span></td>
                    <td><span style={{ color: '#dc3545', fontWeight: 'bold' }}>₹{payment.totalDue}</span></td>
                    <td>
                      <span
                        className="status-badge"
                        style={{
                          backgroundColor: getStatusBadgeColor(payment.paymentStatus),
                          color: 'white',
                          padding: '5px 10px',
                          borderRadius: '3px',
                          fontSize: '0.9rem'
                        }}
                      >
                        {getStatusText(payment.paymentStatus)}
                      </span>
                    </td>
                    <td>
                      <span style={{
                        backgroundColor: payment.source === 'amc' ? '#e3f2fd' : '#f3e5f5',
                        color: payment.source === 'amc' ? '#1976d2' : '#7b1fa2',
                        padding: '4px 8px',
                        borderRadius: '3px',
                        fontSize: '0.85rem',
                        fontWeight: 'bold'
                      }}>
                        {payment.source === 'amc' ? '🔄 AMC' : '🔧 Ticket'}
                      </span>
                    </td>
                    <td>
                      {(payment.phone || payment.customerPhone) && (payment.phone || payment.customerPhone).trim() !== '' ? (
                        <a 
                          href={`tel:${(payment.phone || payment.customerPhone).replace(/[^0-9+]/g, '')}`}
                          className="btn"
                          style={{ 
                            width: 'auto', 
                            padding: '5px 10px', 
                            marginRight: '5px',
                            backgroundColor: '#28a745', 
                            fontSize: '0.9rem',
                            textDecoration: 'none',
                            display: 'inline-block',
                            color: 'white'
                          }}
                          onClick={(e) => {
                            const phone = payment.phone || payment.customerPhone;
                            if (!phone || phone.trim() === '') {
                              e.preventDefault();
                              alert('⚠️ No phone number available');
                            }
                          }}
                        >
                          ☎️ Call
                        </a>
                      ) : (
                        <button
                          className="btn"
                          style={{ 
                            width: 'auto', 
                            padding: '5px 10px', 
                            marginRight: '5px',
                            backgroundColor: '#6c757d', 
                            fontSize: '0.9rem',
                            cursor: 'not-allowed',
                            opacity: 0.6
                          }}
                          disabled
                          title="No phone number"
                        >
                          ☎️ Call
                        </button>
                      )}
                      <button
                        className="btn"
                        style={{
                          width: 'auto',
                          padding: '5px 10px',
                          marginRight: '5px',
                          backgroundColor: '#6f42c1',
                          fontSize: '0.9rem'
                        }}
                        onClick={() => handleOpenCallLog(payment)}
                      >
                        📞 Call Log
                      </button>
                      <button
                        className="btn"
                        style={{
                          width: 'auto',
                          padding: '5px 10px',
                          fontSize: '0.9rem'
                        }}
                        onClick={() => setSelectedPayment(payment)}
                      >
                        Collect Payment
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedPayment && (
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
          <div className="card" style={{
            width: '90%',
            maxWidth: '500px',
            padding: '20px',
            backgroundColor: 'white',
            borderRadius: '8px'
          }}>
            <h2>Collect Payment</h2>
            
            <div style={{ backgroundColor: '#f0f4ff', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #0066ff' }}>
              <p><strong>📋 Job Code:</strong> <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#0066ff' }}>{selectedPayment.ticketCode || selectedPayment.id.substring(0, 4)}</span></p>
              <p><strong>Customer:</strong> {selectedPayment.customerName}</p>
              <p><strong>Service:</strong> {selectedPayment.title}</p>
              <p><strong>Total Amount:</strong> ₹{selectedPayment.paymentAmount || 0}</p>
              <p><strong>Already Paid:</strong> <span style={{ color: '#28a745', fontWeight: 'bold' }}>₹{selectedPayment.amountPaid}</span></p>
              <p><strong>Outstanding Due:</strong> <span style={{ color: '#dc3545', fontWeight: 'bold' }}>₹{selectedPayment.totalDue}</span></p>
            </div>

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label htmlFor="paymentAmount">Amount to Collect (₹):</label>
              <input
                type="number"
                id="paymentAmount"
                value={paymentAmountInput}
                onChange={(e) => setPaymentAmountInput(e.target.value)}
                placeholder={`Max: ₹${selectedPayment.totalDue}`}
                step="0.01"
                min="0"
                max={selectedPayment.totalDue}
                style={{ width: '100%', padding: '10px', fontSize: '14px' }}
              />
              <small style={{ color: '#666', marginTop: '5px', display: 'block' }}>
                Enter amount between 0 and ₹{selectedPayment.totalDue}
              </small>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                className="btn"
                style={{ backgroundColor: '#6c757d' }}
                onClick={() => {
                  setSelectedPayment(null);
                  setPaymentAmountInput('');
                }}
              >
                Cancel
              </button>
              <button
                className="btn"
                style={{ backgroundColor: '#28a745' }}
                onClick={() => handlePaymentReceived(selectedPayment)}
              >
                ✅ Payment Received
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
          zIndex: 1001,
          padding: '20px',
          overflowY: 'auto'
        }}>
          <div className="card" style={{
            width: '95%',
            maxWidth: '900px',
            padding: '25px',
            backgroundColor: 'white',
            borderRadius: '10px',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <h2 style={{ marginBottom: '10px' }}>📞 Call Tracking & Notes</h2>
            {callLogModal.customer && (
              <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#e3f2fd', borderRadius: '5px', border: '1px solid #2196f3' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ margin: '0 0 5px 0', fontWeight: 'bold', fontSize: '16px', color: '#333' }}>
                      {callLogModal.customer.fullName || callLogModal.customer.name}
                    </p>
                    <p style={{ margin: '5px 0', fontSize: '13px', color: '#666' }}>
                      📞 {callLogModal.customer.phone} | 🛠️ {callLogModal.customer.machineName}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '12px', color: '#666' }}>Total Calls:</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2196f3' }}>{callLogModal.callLogs.length}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Add New Call Log Form */}
            <div style={{ marginBottom: '25px', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '2px solid #6f42c1' }}>
              <h3 style={{ marginTop: 0, color: '#6f42c1' }}>➕ Log New Call</h3>
              
              <div className="form-group" style={{ marginBottom: '15px' }}>
                <label htmlFor="callStatus">Call Status: *</label>
                <select
                  id="callStatus"
                  value={callLogModal.newLog.callStatus}
                  onChange={(e) => {
                    const status = e.target.value;
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    const tomorrowStr = tomorrow.toISOString().split('T')[0];
                    
                    // Auto-set follow-up date for specific statuses
                    const statusesNeedingFollowUp = ['Not Picked', 'Call Back', 'Follow-up Needed', 'Busy'];
                    const newFollowUpDate = statusesNeedingFollowUp.includes(status) ? tomorrowStr : callLogModal.newLog.nextFollowUpDate;
                    
                    setCallLogModal({
                      ...callLogModal,
                      newLog: { 
                        ...callLogModal.newLog, 
                        callStatus: status,
                        nextFollowUpDate: newFollowUpDate
                      }
                    });
                  }}
                  style={{ width: '100%', padding: '10px', fontSize: '14px', borderRadius: '4px', border: '1px solid #ddd' }}
                  required
                >
                  <option value="">-- Select status --</option>
                  <option value="Not Picked">🚫 Not Picked / No Answer</option>
                  <option value="Call Back">🔄 Asked to Call Back Later</option>
                  <option value="Confirmed">✅ Payment Confirmed</option>
                  <option value="Follow-up Needed">📅 Follow-up Needed</option>
                  <option value="Not Interested">❌ Not Interested</option>
                  <option value="Wrong Number">☎️ Wrong Number</option>
                  <option value="Busy">⏱️ Customer Busy</option>
                  <option value="Payment Pending">💸 Payment Discussion</option>
                  <option value="Promised Payment">🤝 Promised to Pay</option>
                  <option value="Partial Payment">💵 Partial Payment Received</option>
                  <option value="Other">📋 Other</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '15px' }}>
                <label htmlFor="callNotes">
                  Conversation Notes:
                  {['Confirmed', 'Payment Pending', 'Promised Payment', 'Partial Payment', 'Other'].includes(callLogModal.newLog.callStatus) && <span style={{ color: 'red' }}> *</span>}
                  {!['Confirmed', 'Payment Pending', 'Promised Payment', 'Partial Payment', 'Other'].includes(callLogModal.newLog.callStatus) && <span style={{ color: '#999', fontSize: '12px' }}> (Optional)</span>}
                </label>
                <textarea
                  id="callNotes"
                  value={callLogModal.newLog.notes}
                  onChange={(e) => setCallLogModal({
                    ...callLogModal,
                    newLog: { ...callLogModal.newLog, notes: e.target.value }
                  })}
                  placeholder="Write exactly what customer said... \n\nExamples:\n- 'Will pay tomorrow'\n- 'Already paid, check again'\n- 'Can pay half now, half next week'\n- 'No money right now, call after 15 days'"
                  style={{
                    width: '100%',
                    height: '100px',
                    padding: '10px',
                    fontSize: '14px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    boxSizing: 'border-box',
                    fontFamily: 'Arial',
                    resize: 'vertical'
                  }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <div className="form-group">
                  <label htmlFor="followUpDate">Next Follow-up Date:</label>
                  <input
                    type="date"
                    id="followUpDate"
                    value={callLogModal.newLog.nextFollowUpDate}
                    onChange={(e) => setCallLogModal({
                      ...callLogModal,
                      newLog: { ...callLogModal.newLog, nextFollowUpDate: e.target.value }
                    })}
                    style={{ width: '100%', padding: '10px', fontSize: '14px', borderRadius: '4px', border: '1px solid #ddd' }}
                  />
                  <p style={{ fontSize: '11px', color: '#666', marginTop: '3px' }}>When to call customer again</p>
                </div>
                <div className="form-group">
                  <label htmlFor="followUpTime">Preferred Time:</label>
                  <input
                    type="time"
                    id="followUpTime"
                    value={callLogModal.newLog.nextFollowUpTime}
                    onChange={(e) => setCallLogModal({
                      ...callLogModal,
                      newLog: { ...callLogModal.newLog, nextFollowUpTime: e.target.value }
                    })}
                    style={{ width: '100%', padding: '10px', fontSize: '14px', borderRadius: '4px', border: '1px solid #ddd' }}
                  />
                  <p style={{ fontSize: '11px', color: '#666', marginTop: '3px' }}>Optional time reminder</p>
                </div>
              </div>

              <button
                className="btn"
                style={{ backgroundColor: '#6f42c1', fontWeight: 'bold', width: '100%', padding: '12px' }}
                onClick={handleSaveCallLog}
                disabled={loading}
              >
                {loading ? '⏳ Saving...' : '✅ Save Call Log'}
              </button>
            </div>

            {/* Call History Timeline */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '2px solid #ddd', paddingBottom: '10px' }}>
                <h3 style={{ margin: 0 }}>
                  📅 Call History ({callLogModal.callLogs.length})
                </h3>
                {callLogModal.callLogs.length > 0 && (
                  <button
                    className="btn"
                    style={{ backgroundColor: '#dc3545', padding: '8px 15px', fontSize: '13px', fontWeight: 'bold' }}
                    onClick={handleDeleteAllCallLogs}
                    disabled={loading}
                  >
                    🗑️ Delete All Logs
                  </button>
                )}
              </div>
              
              {callLogModal.callLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#999', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
                  <div style={{ fontSize: '48px', marginBottom: '10px' }}>📞</div>
                  <p>No call history yet. Log your first call above!</p>
                </div>
              ) : (
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8f9fa', zIndex: 1 }}>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '10px', borderBottom: '2px solid #ddd', fontSize: '13px' }}>Date & Time</th>
                        <th style={{ textAlign: 'left', padding: '10px', borderBottom: '2px solid #ddd', fontSize: '13px' }}>Status</th>
                        <th style={{ textAlign: 'left', padding: '10px', borderBottom: '2px solid #ddd', fontSize: '13px' }}>Notes</th>
                        <th style={{ textAlign: 'left', padding: '10px', borderBottom: '2px solid #ddd', fontSize: '13px' }}>Next Follow-up</th>
                        <th style={{ textAlign: 'center', padding: '10px', borderBottom: '2px solid #ddd', fontSize: '13px' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {callLogModal.callLogs.map((log, idx) => {
                        const statusColors = {
                          'Confirmed': '#28a745',
                          'Not Picked': '#dc3545',
                          'Call Back': '#ffc107',
                          'Follow-up Needed': '#17a2b8',
                          'Not Interested': '#6c757d',
                          'Wrong Number': '#e74c3c',
                          'Busy': '#f39c12',
                          'Payment Pending': '#9b59b6',
                          'Promised Payment': '#3498db',
                          'Partial Payment': '#27ae60'
                        };
                        const statusColor = statusColors[log.callStatus] || '#6c757d';
                        
                        return (
                          <tr key={log.id || idx} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '12px', fontSize: '13px', verticalAlign: 'top' }}>
                              <div style={{ fontWeight: 'bold', color: '#333' }}>{log.callDate}</div>
                              <div style={{ fontSize: '12px', color: '#999' }}>{log.callTime}</div>
                            </td>
                            <td style={{ padding: '12px', verticalAlign: 'top' }}>
                              <span style={{
                                backgroundColor: statusColor,
                                color: 'white',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                whiteSpace: 'nowrap'
                              }}>
                                {log.callStatus}
                              </span>
                            </td>
                            <td style={{ padding: '12px', fontSize: '13px', color: '#555', maxWidth: '300px', verticalAlign: 'top' }}>
                              {log.notes}
                            </td>
                            <td style={{ padding: '12px', fontSize: '12px', verticalAlign: 'top' }}>
                              {log.nextFollowUpDate ? (
                                <div>
                                  <div style={{ color: '#2196f3', fontWeight: 'bold' }}>
                                    📅 {log.nextFollowUpDate}
                                  </div>
                                  {log.nextFollowUpTime && (
                                    <div style={{ color: '#666', fontSize: '11px' }}>
                                      ⏰ {log.nextFollowUpTime}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span style={{ color: '#999' }}>-</span>
                              )}
                            </td>
                            <td style={{ padding: '12px', textAlign: 'center', verticalAlign: 'top' }}>
                              <button
                                className="btn"
                                style={{ 
                                  backgroundColor: '#dc3545', 
                                  padding: '5px 10px', 
                                  fontSize: '11px',
                                  minWidth: 'auto'
                                }}
                                onClick={() => handleDeleteCallLog(log.id)}
                                disabled={loading}
                              >
                                🗑️ Delete
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px', paddingTop: '15px', borderTop: '2px solid #ddd' }}>
              <button
                className="btn"
                style={{ backgroundColor: '#6c757d' }}
                onClick={() => setCallLogModal({
                  show: false,
                  customer: null,
                  callLogs: [],
                  newLog: { callStatus: '', notes: '', nextFollowUpDate: '', nextFollowUpTime: '' }
                })}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DuePayments;
