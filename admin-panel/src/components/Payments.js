import React, { useState, useEffect } from 'react';
import dataService from '../services/dataService';
import { formatDateDDMMYYYY } from '../utils/timeFormatter';
import { showLoader, hideLoader } from '../utils/globalLoader';

const Payments = () => {
  const [payments, setPayments] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null); // ✅ State for payment details modal

  useEffect(() => {
    const loadPayments = async () => {
      const loadedPayments = await dataService.getPayments(true);
      setPayments(loadedPayments);
    };
    loadPayments();
  
    const handlePaymentUpdated = async () => {
      const updatedPayments = await dataService.getPayments(true);
      setPayments(updatedPayments);
    };
      
    window.addEventListener('paymentUpdated', handlePaymentUpdated);
      
    return () => window.removeEventListener('paymentUpdated', handlePaymentUpdated);
  }, []);

  // Reload payments when needed
  const reloadPayments = async () => {
    setLoading(true);
    try {
      showLoader();
      const loadedPayments = await dataService.getPayments(); // Use cache for faster reload
      setPayments(loadedPayments);
    } catch (error) {
      console.error('Error reloading payments:', error);
    } finally {
      hideLoader();
      setLoading(false);
    }
  };

  // ✅ Handle View button click
  const handleViewPayment = (payment) => {
    setSelectedPayment(payment);
  };

  // ✅ Close payment details modal
  const closePaymentModal = () => {
    setSelectedPayment(null);
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'completed': return 'status-completed';
      case 'pending': return 'status-assigned';
      case 'failed': return 'status-closed';
      default: return '';
    }
  };

  const filteredPayments = filter === 'all' 
    ? payments 
    : payments.filter(payment => payment.status === filter || payment.status === (filter === 'PAID' ? 'completed' : filter === 'PARTIAL' ? 'half-paid' : filter));

  // Sort by date descending (newest first)
  const sortedPayments = [...filteredPayments].sort((a, b) => {
    const dateA = new Date(a.timestamp || a.date);
    const dateB = new Date(b.timestamp || b.date);
    return dateB - dateA; // Newest first
  });

  return (
    <div className="content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>💰 Payments {payments.length > 0 && <span style={{ fontSize: '0.8rem', color: '#666' }}>({payments.length} total)</span>}</h1>
        <div>
          <button className="btn" style={{ width: 'auto', marginRight: '10px', padding: '8px' }} onClick={reloadPayments} disabled={loading}>
            {loading ? '⏳ Refreshing...' : '🔄 Refresh'}
          </button>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ padding: '8px', marginRight: '10px', borderRadius: '4px', border: '1px solid #ddd' }}>
            <option value="all">All Payments ({payments.length})</option>
            <option value="PAID">Completed ({payments.filter(p => p.status === 'PAID' || p.status === 'completed').length})</option>
            <option value="PARTIAL">Partial ({payments.filter(p => p.status === 'PARTIAL' || p.status === 'half-paid').length})</option>
            <option value="pending">Pending ({payments.filter(p => p.status === 'pending').length})</option>
          </select>
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Payment ID</th>
              <th>Ticket ID</th>
              <th>Technician</th>
              <th>Amount</th>
              <th>Method</th>
              <th>Reference ID</th>
              <th>Status</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedPayments.length > 0 ? sortedPayments.map(payment => (
              <tr key={payment.id}>
                <td>{payment.id}</td>
                <td>{payment.ticketId || 'N/A'}</td>
                <td>{payment.customerName || 'N/A'}</td>
                <td>₹{payment.amount.toLocaleString()}</td>
                <td>{payment.method ? payment.method.toUpperCase() : 'CASH'}</td>
                <td><span style={{ fontSize: '1rem', fontWeight: 'bold', color: '#0066ff' }}>{payment.ticketCode || payment.reference || payment.id.substring(0, 4)}</span></td>
                <td><span className={`status-badge ${getStatusClass(payment.status)}`}>{(payment.status || 'PAID').toUpperCase()}</span></td>
                <td>{payment.date || formatDateDDMMYYYY(payment.timestamp)}</td>
                <td>
                  <button 
                    className="btn" 
                    style={{ width: 'auto', padding: '5px 10px' }} 
                    title="View payment details"
                    onClick={() => handleViewPayment(payment)}
                  >
                    View
                  </button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '20px', color: '#999' }}>No payments found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ✅ Payment Details Modal */}
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
            maxWidth: '600px',
            padding: '25px',
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
          }}>
            <h2 style={{ marginTop: 0, marginBottom: '20px', borderBottom: '2px solid #e0e0e0', paddingBottom: '10px' }}>
              💳 Payment Details
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
              <div>
                <p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '0.9rem' }}>Payment ID</p>
                <p style={{ margin: '0', fontWeight: 'bold', fontSize: '1rem' }}>{selectedPayment.id}</p>
              </div>
              <div>
                <p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '0.9rem' }}>Ticket ID</p>
                <p style={{ margin: '0', fontWeight: 'bold', fontSize: '1rem' }}>{selectedPayment.ticketId || 'N/A'}</p>
              </div>
              <div>
                <p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '0.9rem' }}>Amount</p>
                <p style={{ margin: '0', fontWeight: 'bold', fontSize: '1.2rem', color: '#28a745' }}>₹{selectedPayment.amount.toLocaleString()}</p>
              </div>
              <div>
                <p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '0.9rem' }}>Payment Method</p>
                <p style={{ margin: '0', fontWeight: 'bold', fontSize: '1rem' }}>{selectedPayment.method ? selectedPayment.method.toUpperCase() : 'CASH'}</p>
              </div>
              <div>
                <p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '0.9rem' }}>Status</p>
                <p style={{ margin: '0' }}>
                  <span className={`status-badge ${getStatusClass(selectedPayment.status)}`}>
                    {(selectedPayment.status || 'PAID').toUpperCase()}
                  </span>
                </p>
              </div>
              <div>
                <p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '0.9rem' }}>Date</p>
                <p style={{ margin: '0', fontWeight: 'bold', fontSize: '1rem' }}>{selectedPayment.date || formatDateDDMMYYYY(selectedPayment.timestamp)}</p>
              </div>
            </div>

            <div style={{ backgroundColor: '#f5f5f5', padding: '15px', borderRadius: '6px', marginBottom: '20px' }}>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem' }}>Additional Information</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div>
                  <p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '0.9rem' }}>Reference ID</p>
                  <p style={{ margin: '0', fontWeight: 'bold', fontSize: '1rem' }}>
                    <span style={{ color: '#0066ff' }}>Reference Code: {selectedPayment.ticketCode || selectedPayment.reference || selectedPayment.id.substring(0, 4)}</span>
                  </p>
                </div>
                <div>
                  <p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '0.9rem' }}>Customer Name</p>
                  <p style={{ margin: '0', fontWeight: 'bold', fontSize: '1rem' }}>{selectedPayment.customerName || 'N/A'}</p>
                </div>
                <div>
                  <p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '0.9rem' }}>Customer Phone</p>
                  <p style={{ margin: '0', fontWeight: 'bold', fontSize: '1rem' }}>{selectedPayment.customerPhone || 'N/A'}</p>
                </div>
                <div>
                  <p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '0.9rem' }}>Technician</p>
                  <p style={{ margin: '0', fontWeight: 'bold', fontSize: '1rem' }}>{selectedPayment.technician || 'N/A'}</p>
                </div>
              </div>
            </div>

            {selectedPayment.notes && (
              <div style={{ backgroundColor: '#fff9e6', padding: '15px', borderRadius: '6px', marginBottom: '20px', borderLeft: '4px solid #ff9800' }}>
                <p style={{ margin: '0 0 8px 0', color: '#ff9800', fontWeight: 'bold' }}>Notes</p>
                <p style={{ margin: '0', color: '#333', whiteSpace: 'pre-wrap' }}>{selectedPayment.notes}</p>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                className="btn"
                style={{ backgroundColor: '#6c757d', padding: '12px 20px' }}
                onClick={closePaymentModal}
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

export default Payments;