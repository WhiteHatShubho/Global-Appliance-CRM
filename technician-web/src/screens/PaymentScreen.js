import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getDatabase, ref, get, update } from 'firebase/database';
import { showLoader, hideLoader } from '../utils/globalLoader';

const PaymentScreen = () => {
  // Generate QR Code dynamically using API
  const generateQRCodeUrl = (amount) => {
    // IMPORTANT: Replace with your actual UPI ID
    // Format examples: yourname@paytm, yourname@googlepay, yourname@phonepe, 1234567890@ybl
    const upiId = '9876543210@paytm'; // Replace with YOUR ACTUAL UPI ID
    const merchantName = 'Global Appliance';
    const upiString = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(merchantName)}&am=${amount}&tn=Service%20Payment`;
    
    // Using QR Server API to generate QR code
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiString)}`;
  };

  const navigate = useNavigate();
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [paymentType, setPaymentType] = useState(null);
  const [halfAmount, setHalfAmount] = useState('');
  const [customAmount, setCustomAmount] = useState('');
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState(null);
  const [completionMessage, setCompletionMessage] = useState('');
  const [qrImageError, setQrImageError] = useState(false);

  useEffect(() => {
    const loadJobDetails = async () => {
      try {
        showLoader();
        const database = getDatabase();
        const jobRef = ref(database, `tickets/${id}`);
        const jobSnapshot = await get(jobRef);
        const jobData = jobSnapshot.val();
        
        if (jobData) {
          setJob(jobData);
          setHalfAmount(jobData.paymentAmount ? Math.floor(jobData.paymentAmount / 2) : 0);
        } else {
          setError('Job not found');
        }
      } catch (error) {
        console.error('Error loading job details:', error);
        setError('Error loading job details');
      } finally {
        hideLoader();
        setLoading(false);
      }
    };

    loadJobDetails();
  }, [id]);

  const handleFullPayment = async (method) => {
    try {
      showLoader();
      const database = getDatabase();
      await update(ref(database, `tickets/${id}`), {
        paymentCollected: true,
        paymentMethod: method,
        paymentStatus: 'paid',
        amountPaid: job.paymentAmount,
        dueAmount: 0,
        paymentCollectedAt: new Date().toISOString(),
        status: 'completed'
      });
      
      setCompletionMessage('✅ Full Payment Recorded!');
      setCompleted(true);
      setTimeout(() => {
        navigate('/today-jobs', { replace: true });
      }, 2000);
    } catch (error) {
      console.error('Error updating payment:', error);
      setError('Failed to record payment');
    } finally {
      hideLoader();
    }
  };

  const handleHalfPayment = async (method) => {
    try {
      showLoader();
      const database = getDatabase();
      const dueAmount = job.paymentAmount - halfAmount;
      await update(ref(database, `tickets/${id}`), {
        paymentCollected: true,
        paymentMethod: method,
        paymentStatus: 'half-paid',
        amountPaid: halfAmount,
        dueAmount: dueAmount,
        paymentCollectedAt: new Date().toISOString(),
        status: 'completed'
      });
      
      setCompletionMessage(`✅ Half Payment (₹${halfAmount}) Recorded! Due: ₹${dueAmount}`);
      setCompleted(true);
      setTimeout(() => {
        navigate('/today-jobs', { replace: true });
      }, 2000);
    } catch (error) {
      console.error('Error updating payment:', error);
      setError('Failed to record payment');
    } finally {
      hideLoader();
    }
  };

  const handleCustomPayment = async (method) => {
    try {
      showLoader();
      const amount = parseInt(customAmount) || 0;
      if (amount <= 0) {
        setError('Please enter a valid amount');
        hideLoader();
        return;
      }

      const database = getDatabase();
      const dueAmount = job.paymentAmount - amount;
      await update(ref(database, `tickets/${id}`), {
        paymentCollected: true,
        paymentMethod: method,
        paymentStatus: amount >= job.paymentAmount ? 'paid' : 'half-paid',
        amountPaid: amount,
        dueAmount: dueAmount > 0 ? dueAmount : 0,
        paymentCollectedAt: new Date().toISOString(),
        status: 'completed'
      });
      
      setCompletionMessage(`✅ Payment (₹${amount}) Recorded!${dueAmount > 0 ? ` Due: ₹${dueAmount}` : ''}`);
      setCompleted(true);
      setTimeout(() => {
        navigate('/today-jobs', { replace: true });
      }, 2000);
    } catch (error) {
      console.error('Error updating payment:', error);
      setError('Failed to record payment');
    } finally {
      hideLoader();
    }
  };

  const handlePayLater = async () => {
    try {
      showLoader();
      const database = getDatabase();
      await update(ref(database, `tickets/${id}`), {
        paymentCollected: false,
        paymentStatus: 'pending',
        amountPaid: 0,
        dueAmount: job.paymentAmount,
        completedAt: new Date().toISOString(),
        status: 'completed'
      });
      
      setCompletionMessage('⏰ Job Marked as Complete! Payment Pending...');
      setCompleted(true);
      setTimeout(() => {
        navigate('/today-jobs', { replace: true });
      }, 2000);
    } catch (error) {
      console.error('Error updating payment:', error);
      setError('Failed to record status');
    } finally {
      hideLoader();
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ textAlign: 'center', padding: '40px' }}>
        <div style={{ fontSize: '1.2rem', color: '#666' }}>Loading payment details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container" style={{ textAlign: 'center', padding: '40px' }}>
        <div style={{ color: 'red', fontSize: '1.1rem', marginBottom: '20px' }}>⚠️ {error}</div>
        <button className="btn" onClick={() => navigate('/today-jobs')}>
          Back to Jobs
        </button>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="container" style={{ textAlign: 'center', padding: '40px' }}>
        <div style={{ fontSize: '3rem', marginBottom: '20px' }}>✅</div>
        <div style={{ fontSize: '1.3rem', color: '#28a745', fontWeight: 'bold', marginBottom: '20px' }}>
          {completionMessage}
        </div>
        <div style={{ fontSize: '1rem', color: '#666', marginBottom: '10px' }}>
          Job marked as completed.
        </div>
        <div style={{ fontSize: '0.9rem', color: '#999' }}>
          Redirecting to jobs list...
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="header">
        <div className="header-title">💳 Payment Collection</div>
        <button className="btn" style={{ width: 'auto' }} onClick={() => navigate(`/job-details/${id}`)}>
          Back
        </button>
      </div>
      <div className="container">
        <div className="card" style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h2>Payment Options</h2>
          
          {job && (
            <div style={{ backgroundColor: '#f0f4ff', padding: '15px', borderRadius: '8px', marginBottom: '25px', border: '1px solid #0066ff' }}>
              <p><strong>Job ID:</strong> {id}</p>
              <p><strong>Total Amount:</strong> <span style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#28a745' }}>₹{job.paymentAmount || 0}</span></p>
            </div>
          )}

          {paymentType === null && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h3 style={{ textAlign: 'center', marginBottom: '10px', fontSize: '1.2rem' }}>📊 Select Payment Type</h3>
              
              <button
                className="btn"
                style={{
                  backgroundColor: '#28a745',
                  padding: '18px',
                  fontSize: '1rem',
                  fontWeight: 'bold'
                }}
                onClick={() => setPaymentType('full')}
              >
                ✅ Full Payment (₹{job?.paymentAmount || 0})
              </button>

              <button
                className="btn"
                style={{
                  backgroundColor: '#ff9800',
                  padding: '18px',
                  fontSize: '1rem',
                  fontWeight: 'bold'
                }}
                onClick={() => setPaymentType('half')}
              >
                🏡 Half Payment (₹{Math.floor((job?.paymentAmount || 0) / 2)})
              </button>

              <button
                className="btn"
                style={{
                  backgroundColor: '#dc3545',
                  padding: '18px',
                  fontSize: '1rem',
                  fontWeight: 'bold'
                }}
                onClick={handlePayLater}
              >
                ⏰ Pay Later (No Payment Now)
              </button>

              <button
                className="btn"
                style={{
                  backgroundColor: '#6f42c1',
                  padding: '18px',
                  fontSize: '1rem',
                  fontWeight: 'bold'
                }}
                onClick={() => setPaymentType('custom')}
              >
                💳 Custom Amount (Tech Decides)
              </button>
            </div>
          )}

          {paymentType === 'custom' && paymentMethod === null && (
            <div>
              <h3 style={{ textAlign: 'center', marginBottom: '20px', fontSize: '1.2rem' }}>💳 Custom Amount</h3>
              <div style={{ backgroundColor: '#f0f4ff', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #6f42c1' }}>
                <p style={{ margin: '0 0 10px 0', color: '#666' }}>Total Job Amount: <strong style={{ fontSize: '1.2rem', color: '#6f42c1' }}>₹{job?.paymentAmount || 0}</strong></p>
                <p style={{ margin: '0', fontSize: '0.9rem', color: '#666' }}>You can collect any amount you decide</p>
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>Amount to Collect (₹):</label>
                <input
                  type="number"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder="Enter amount"
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '6px',
                    border: '2px solid #6f42c1',
                    fontSize: '1rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <h4 style={{ textAlign: 'center', marginBottom: '20px', color: '#666' }}>Select Payment Method</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                {/* Cash Payment Option */}
                <div style={{ border: '3px solid #28a745', borderRadius: '12px', padding: '20px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.3s', backgroundColor: '#f8f9fa' }} onClick={() => setPaymentMethod('cash')}>
                  <div style={{ fontSize: '3rem', marginBottom: '10px' }}>💵</div>
                  <h4 style={{ margin: '0 0 8px 0', color: '#28a745', fontSize: '1.1rem' }}>Cash</h4>
                  <p style={{ margin: '5px 0', fontSize: '1.2rem', fontWeight: 'bold', color: '#28a745' }}>₹{customAmount || 0}</p>
                  <button className="btn" style={{ marginTop: '12px', backgroundColor: '#28a745', width: '100%', fontWeight: 'bold' }}>
                    Collect Cash
                  </button>
                </div>
                
                {/* QR Code Payment Option */}
                <div style={{ border: '3px solid #0066ff', borderRadius: '12px', padding: '20px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.3s', backgroundColor: '#f8f9fa' }} onClick={() => { setPaymentMethod('qr'); setQrImageError(false); }}>
                  <div style={{ fontSize: '3rem', marginBottom: '10px' }}>📲</div>
                  <h4 style={{ margin: '0 0 8px 0', color: '#0066ff', fontSize: '1.1rem' }}>PhonePay</h4>
                  <p style={{ margin: '5px 0', fontSize: '1.2rem', fontWeight: 'bold', color: '#0066ff' }}>₹{customAmount || 0}</p>
                  <button className="btn" style={{ marginTop: '12px', backgroundColor: '#0066ff', width: '100%', fontWeight: 'bold' }}>
                    Show QR Code
                  </button>
                </div>
              </div>
              <button
                className="btn"
                style={{
                  backgroundColor: '#6c757d',
                  padding: '12px',
                  fontSize: '1rem',
                  width: '100%'
                }}
                onClick={() => { setPaymentType(null); setPaymentMethod(null); setCustomAmount(''); }}
              >
                ← Back
              </button>
            </div>
          )}

          {paymentType === 'full' && paymentMethod === null && (
            <div>
              <h3 style={{ textAlign: 'center', marginBottom: '20px', fontSize: '1.2rem' }}>💰 Full Payment (₹{job?.paymentAmount || 0})</h3>
              <h4 style={{ textAlign: 'center', marginBottom: '20px', color: '#666' }}>Select Payment Method</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                {/* Cash Payment Option */}
                <div style={{ border: '3px solid #28a745', borderRadius: '12px', padding: '20px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.3s', backgroundColor: '#f8f9fa' }} onClick={() => setPaymentMethod('cash')}>
                  <div style={{ fontSize: '3rem', marginBottom: '10px' }}>💵</div>
                  <h4 style={{ margin: '0 0 8px 0', color: '#28a745', fontSize: '1.1rem' }}>Cash</h4>
                  <p style={{ margin: '5px 0', fontSize: '1.2rem', fontWeight: 'bold', color: '#28a745' }}>₹{job?.paymentAmount || 0}</p>
                  <button className="btn" style={{ marginTop: '12px', backgroundColor: '#28a745', width: '100%', fontWeight: 'bold' }}>
                    Collect Cash
                  </button>
                </div>
                
                {/* QR Code Payment Option */}
                <div style={{ border: '3px solid #0066ff', borderRadius: '12px', padding: '20px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.3s', backgroundColor: '#f8f9fa' }} onClick={() => { setPaymentMethod('qr'); setQrImageError(false); }}>
                  <div style={{ fontSize: '3rem', marginBottom: '10px' }}>📲</div>
                  <h4 style={{ margin: '0 0 8px 0', color: '#0066ff', fontSize: '1.1rem' }}>PhonePay</h4>
                  <p style={{ margin: '5px 0', fontSize: '1.2rem', fontWeight: 'bold', color: '#0066ff' }}>₹{job?.paymentAmount || 0}</p>
                  <button className="btn" style={{ marginTop: '12px', backgroundColor: '#0066ff', width: '100%', fontWeight: 'bold' }}>
                    Show QR Code
                  </button>
                </div>
              </div>
              <button
                className="btn"
                style={{
                  backgroundColor: '#6c757d',
                  padding: '12px',
                  fontSize: '1rem',
                  width: '100%'
                }}
                onClick={() => { setPaymentType(null); setPaymentMethod(null); }}
              >
                ← Back
              </button>
            </div>
          )}

          {paymentType === 'half' && paymentMethod === null && (
            <div>
              <h3 style={{ textAlign: 'center', marginBottom: '15px', fontSize: '1.2rem' }}>🏡 Half Payment</h3>
              <div style={{ backgroundColor: '#fff3cd', padding: '15px', borderRadius: '8px', marginBottom: '20px', textAlign: 'center', border: '2px solid #ff9800' }}>
                <p style={{ margin: '0 0 5px 0', fontWeight: 'bold', fontSize: '1.1rem', color: '#ff9800' }}>Customer Pays: ₹{halfAmount}</p>
                <p style={{ margin: '5px 0 0 0', color: '#666', fontSize: '1rem' }}>Due Balance: ₹{job.paymentAmount - halfAmount}</p>
              </div>
              <h4 style={{ textAlign: 'center', marginBottom: '20px', color: '#666' }}>Select Payment Method</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                {/* Cash Payment Option */}
                <div style={{ border: '3px solid #28a745', borderRadius: '12px', padding: '20px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.3s', backgroundColor: '#f8f9fa' }} onClick={() => setPaymentMethod('cash')}>
                  <div style={{ fontSize: '3rem', marginBottom: '10px' }}>💵</div>
                  <h4 style={{ margin: '0 0 8px 0', color: '#28a745', fontSize: '1.1rem' }}>Cash</h4>
                  <p style={{ margin: '5px 0', fontSize: '1.2rem', fontWeight: 'bold', color: '#28a745' }}>₹{halfAmount}</p>
                  <button className="btn" style={{ marginTop: '12px', backgroundColor: '#28a745', width: '100%', fontWeight: 'bold' }}>
                    Collect Cash
                  </button>
                </div>
                
                {/* QR Code Payment Option */}
                <div style={{ border: '3px solid #0066ff', borderRadius: '12px', padding: '20px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.3s', backgroundColor: '#f8f9fa' }} onClick={() => { setPaymentMethod('qr'); setQrImageError(false); }}>
                  <div style={{ fontSize: '3rem', marginBottom: '10px' }}>📲</div>
                  <h4 style={{ margin: '0 0 8px 0', color: '#0066ff', fontSize: '1.1rem' }}>PhonePay</h4>
                  <p style={{ margin: '5px 0', fontSize: '1.2rem', fontWeight: 'bold', color: '#0066ff' }}>₹{halfAmount}</p>
                  <button className="btn" style={{ marginTop: '12px', backgroundColor: '#0066ff', width: '100%', fontWeight: 'bold' }}>
                    Show QR Code
                  </button>
                </div>
              </div>
              <button
                className="btn"
                style={{
                  backgroundColor: '#6c757d',
                  padding: '12px',
                  fontSize: '1rem',
                  width: '100%'
                }}
                onClick={() => { setPaymentType(null); setPaymentMethod(null); }}
              >
                ← Back
              </button>
            </div>
          )}

          {paymentType === 'full' && paymentMethod === 'cash' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '20px' }}>💵</div>
              <h3>Cash Payment</h3>
              <p style={{ color: '#666', marginBottom: '20px', fontSize: '1.1rem', fontWeight: 'bold' }}>
                Collect: ₹{job?.paymentAmount || 0}
              </p>
              <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
                <button
                  className="btn"
                  style={{ backgroundColor: '#28a745', padding: '15px', fontSize: '1rem' }}
                  onClick={() => handleFullPayment('cash')}
                >
                  ✅ Payment Received
                </button>
                <button
                  className="btn"
                  style={{ backgroundColor: '#6c757d', padding: '15px' }}
                  onClick={() => { setPaymentType(null); setPaymentMethod(null); }}
                >
                  ← Back
                </button>
              </div>
            </div>
          )}

          {paymentType === 'full' && paymentMethod === 'qr' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ marginBottom: '20px' }}>
                {!qrImageError ? (
                  <img
                    src={generateQRCodeUrl(job?.paymentAmount || 0)}
                    alt="PhonePay UPI QR Code"
                    style={{
                      maxWidth: '300px',
                      width: '100%',
                      height: 'auto',
                      border: '2px solid #0066ff',
                      borderRadius: '8px',
                      padding: '5px',
                      backgroundColor: 'white'
                    }}
                    onError={() => {
                      console.error('QR Code image failed to load');
                      setQrImageError(true);
                    }}
                    onLoad={() => {
                      console.log('QR Code loaded successfully');
                      setQrImageError(false);
                    }}
                  />
                ) : (
                  <div style={{
                    maxWidth: '300px',
                    width: '100%',
                    margin: '0 auto',
                    padding: '40px 20px',
                    border: '2px solid #dc3545',
                    borderRadius: '8px',
                    backgroundColor: '#fff3cd'
                  }}>
                    <p style={{ color: '#dc3545', fontWeight: 'bold', marginBottom: '10px' }}>⚠️ QR Code Failed to Load</p>
                    <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '15px' }}>Please use manual UPI payment</p>
                    <p style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#0066ff' }}>UPI ID: globalappliance@upi</p>
                    <button 
                      className="btn" 
                      style={{ marginTop: '15px', backgroundColor: '#0066ff', padding: '10px 20px', fontSize: '0.9rem' }}
                      onClick={() => setQrImageError(false)}
                    >
                      🔄 Retry Loading QR
                    </button>
                  </div>
                )}
              </div>
              <h3>💳 PhonePay QR Code</h3>
              <p style={{ color: '#666', marginBottom: '10px', fontSize: '1.1rem', fontWeight: 'bold' }}>
                Amount: ₹{job?.paymentAmount || 0}
              </p>
              <p style={{ fontSize: '0.9rem', color: '#999', marginBottom: '20px' }}>
                Customer can scan and pay via PhonePay, Google Pay, or any UPI app
              </p>
              <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
                <button
                  className="btn"
                  style={{ backgroundColor: '#0066ff', padding: '15px', fontSize: '1rem' }}
                  onClick={() => handleFullPayment('qr')}
                >
                  ✅ Payment Received
                </button>
                <button
                  className="btn"
                  style={{ backgroundColor: '#6c757d', padding: '15px' }}
                  onClick={() => { setPaymentType(null); setPaymentMethod(null); }}
                >
                  ← Back
                </button>
              </div>
            </div>
          )}

          {paymentType === 'half' && paymentMethod === 'cash' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '20px' }}>💵</div>
              <h3>Half Payment - Cash</h3>
              <p style={{ color: '#666', marginBottom: '20px', fontSize: '1.1rem', fontWeight: 'bold' }}>
                Collect: ₹{halfAmount} (Half of ₹{job?.paymentAmount || 0})
              </p>
              <p style={{ backgroundColor: '#fff3cd', padding: '10px', borderRadius: '5px', marginBottom: '20px' }}>
                <strong>Due Amount:</strong> ₹{job.paymentAmount - halfAmount}
              </p>
              <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
                <button
                  className="btn"
                  style={{ backgroundColor: '#28a745', padding: '15px', fontSize: '1rem' }}
                  onClick={() => handleHalfPayment('cash')}
                >
                  ✅ Payment Received
                </button>
                <button
                  className="btn"
                  style={{ backgroundColor: '#6c757d', padding: '15px' }}
                  onClick={() => { setPaymentType(null); setPaymentMethod(null); }}
                >
                  ← Back
                </button>
              </div>
            </div>
          )}

          {paymentType === 'half' && paymentMethod === 'qr' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ marginBottom: '20px' }}>
                {!qrImageError ? (
                  <img
                    src={generateQRCodeUrl(halfAmount)}
                    alt="PhonePay UPI QR Code"
                    style={{
                      maxWidth: '300px',
                      width: '100%',
                      height: 'auto',
                      border: '2px solid #0066ff',
                      borderRadius: '8px',
                      padding: '5px',
                      backgroundColor: 'white'
                    }}
                    onError={() => {
                      console.error('QR Code image failed to load');
                      setQrImageError(true);
                    }}
                    onLoad={() => {
                      console.log('QR Code loaded successfully');
                      setQrImageError(false);
                    }}
                  />
                ) : (
                  <div style={{
                    maxWidth: '300px',
                    width: '100%',
                    margin: '0 auto',
                    padding: '40px 20px',
                    border: '2px solid #dc3545',
                    borderRadius: '8px',
                    backgroundColor: '#fff3cd'
                  }}>
                    <p style={{ color: '#dc3545', fontWeight: 'bold', marginBottom: '10px' }}>⚠️ QR Code Failed to Load</p>
                    <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '15px' }}>Please use manual UPI payment</p>
                    <p style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#0066ff' }}>UPI ID: globalappliance@upi</p>
                    <button 
                      className="btn" 
                      style={{ marginTop: '15px', backgroundColor: '#0066ff', padding: '10px 20px', fontSize: '0.9rem' }}
                      onClick={() => setQrImageError(false)}
                    >
                      🔄 Retry Loading QR
                    </button>
                  </div>
                )}
              </div>
              <h3>💳 PhonePay QR Code - Half Payment</h3>
              <p style={{ color: '#666', marginBottom: '10px', fontSize: '1.1rem', fontWeight: 'bold' }}>
                Amount: ₹{halfAmount}
              </p>
              <p style={{ backgroundColor: '#fff3cd', padding: '10px', borderRadius: '5px', marginBottom: '20px' }}>
                <strong>Due Amount:</strong> ₹{job.paymentAmount - halfAmount}
              </p>
              <p style={{ fontSize: '0.9rem', color: '#999', marginBottom: '20px' }}>
                Customer can scan and pay via PhonePay, Google Pay, or any UPI app
              </p>
              <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
                <button
                  className="btn"
                  style={{ backgroundColor: '#0066ff', padding: '15px', fontSize: '1rem' }}
                  onClick={() => handleHalfPayment('qr')}
                >
                  ✅ Payment Received
                </button>
                <button
                  className="btn"
                  style={{ backgroundColor: '#6c757d', padding: '15px' }}
                  onClick={() => { setPaymentType(null); setPaymentMethod(null); }}
                >
                  ← Back
                </button>
              </div>
            </div>
          )}

          {paymentType === 'custom' && paymentMethod === 'cash' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '20px' }}>💵</div>
              <h3>Custom Payment - Cash</h3>
              <p style={{ color: '#666', marginBottom: '20px', fontSize: '1.1rem', fontWeight: 'bold' }}>
                Collect: ₹{customAmount || 0}
              </p>
              {job && customAmount > 0 && customAmount < job.paymentAmount && (
                <p style={{ backgroundColor: '#fff3cd', padding: '10px', borderRadius: '5px', marginBottom: '20px' }}>
                  <strong>Due Amount:</strong> ₹{job.paymentAmount - customAmount}
                </p>
              )}
              <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
                <button
                  className="btn"
                  style={{ backgroundColor: '#28a745', padding: '15px', fontSize: '1rem' }}
                  onClick={() => handleCustomPayment('cash')}
                >
                  ✅ Payment Received
                </button>
                <button
                  className="btn"
                  style={{ backgroundColor: '#6c757d', padding: '15px' }}
                  onClick={() => { setPaymentType(null); setPaymentMethod(null); setCustomAmount(''); }}
                >
                  ← Back
                </button>
              </div>
            </div>
          )}

          {paymentType === 'custom' && paymentMethod === 'qr' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ marginBottom: '20px' }}>
                {!qrImageError ? (
                  <img
                    src={generateQRCodeUrl(customAmount || 0)}
                    alt="PhonePay UPI QR Code"
                    style={{
                      maxWidth: '300px',
                      width: '100%',
                      height: 'auto',
                      border: '2px solid #0066ff',
                      borderRadius: '8px',
                      padding: '5px',
                      backgroundColor: 'white'
                    }}
                    onError={() => {
                      console.error('QR Code image failed to load');
                      setQrImageError(true);
                    }}
                    onLoad={() => {
                      console.log('QR Code loaded successfully');
                      setQrImageError(false);
                    }}
                  />
                ) : (
                  <div style={{
                    maxWidth: '300px',
                    width: '100%',
                    margin: '0 auto',
                    padding: '40px 20px',
                    border: '2px solid #dc3545',
                    borderRadius: '8px',
                    backgroundColor: '#fff3cd'
                  }}>
                    <p style={{ color: '#dc3545', fontWeight: 'bold', marginBottom: '10px' }}>⚠️ QR Code Failed to Load</p>
                    <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '15px' }}>Please use manual UPI payment</p>
                    <p style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#0066ff' }}>UPI ID: globalappliance@upi</p>
                    <button 
                      className="btn" 
                      style={{ marginTop: '15px', backgroundColor: '#0066ff', padding: '10px 20px', fontSize: '0.9rem' }}
                      onClick={() => setQrImageError(false)}
                    >
                      🔄 Retry Loading QR
                    </button>
                  </div>
                )}
              </div>
              <h3>💳 PhonePay QR Code - Custom Amount</h3>
              <p style={{ color: '#666', marginBottom: '10px', fontSize: '1.1rem', fontWeight: 'bold' }}>
                Amount: ₹{customAmount || 0}
              </p>
              {job && customAmount > 0 && customAmount < job.paymentAmount && (
                <p style={{ backgroundColor: '#fff3cd', padding: '10px', borderRadius: '5px', marginBottom: '20px' }}>
                  <strong>Due Amount:</strong> ₹{job.paymentAmount - customAmount}
                </p>
              )}
              <p style={{ fontSize: '0.9rem', color: '#999', marginBottom: '20px' }}>
                Customer can scan and pay via PhonePay, Google Pay, or any UPI app
              </p>
              <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
                <button
                  className="btn"
                  style={{ backgroundColor: '#0066ff', padding: '15px', fontSize: '1rem' }}
                  onClick={() => handleCustomPayment('qr')}
                >
                  ✅ Payment Received
                </button>
                <button
                  className="btn"
                  style={{ backgroundColor: '#6c757d', padding: '15px' }}
                  onClick={() => { setPaymentType(null); setPaymentMethod(null); setCustomAmount(''); }}
                >
                  ← Back
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentScreen;
