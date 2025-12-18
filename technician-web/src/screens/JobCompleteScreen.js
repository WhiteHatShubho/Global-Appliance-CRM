import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../firebase';
import { ref, update, get } from 'firebase/database';
import appPermissionManager from '../services/appPermissionManager';
import { showLoader, hideLoader } from '../utils/globalLoader';
import amcReminderService from '../services/amcReminderService';

const JobCompleteScreen = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [jobData, setJobData] = useState(null);
  const [customerData, setCustomerData] = useState(null);
  const [cameraError, setCameraError] = useState('');
  const [amcServiceCompleted, setAmcServiceCompleted] = useState(false);
  const [hasActiveAmc, setHasActiveAmc] = useState(false);
  
  // Parts checklist state
  const [partsUsed, setPartsUsed] = useState({
    'Spun': false,
    '10 inch candle': false,
    'Sediment': false,
    'Carbon': false,
    'Membren': false,
    'FRT': false,
    'Pipe': false,
    'Connector': false,
    'UF': false,
    'Copper': false,
    'Boul': false,
    'DIY valve': false,
    'UV chamber': false,
    'Body': false
  });
  
  // Connector quantity
  const [connectorQuantity, setConnectorQuantity] = useState(1);
  
  // AMC service toggle
  const [isAmcService, setIsAmcService] = useState(false);

  // Verify camera permission on mount
  useEffect(() => {
    const checkCameraPermission = async () => {
      const hasPermission = await appPermissionManager.verifyCameraPermission();
      if (!hasPermission) {
        setCameraError('Camera permission required for photo capture. Please enable in Settings.');
      }
    };
    checkCameraPermission();
  }, []);

  // Load job data to check if payment is required and customer AMC status
  useEffect(() => {
    const loadJobData = async () => {
      try {
        showLoader();
        const jobRef = ref(db, `tickets/${id}`);
        const snapshot = await get(jobRef);
        if (snapshot.exists()) {
          const ticket = snapshot.val();
          setJobData(ticket);
          
          // Load customer data to check for active AMC
          if (ticket.customerId) {
            const customerRef = ref(db, `customers/${ticket.customerId}`);
            const customerSnapshot = await get(customerRef);
            if (customerSnapshot.exists()) {
              const customer = customerSnapshot.val();
              setCustomerData(customer);
              
              // Check if customer has active AMC
              if (customer.amc && customer.amc.isActive) {
                setHasActiveAmc(true);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error loading job data:', error);
      } finally {
        hideLoader();
      }
    };

    loadJobData();
  }, [id]);

  // Handle AMC service toggle
  useEffect(() => {
    if (isAmcService) {
      // Auto-select AMC parts
      setPartsUsed(prev => ({
        ...prev,
        'Spun': true,
        'Sediment': true,
        'Carbon': true,
        'Membren': true,
        'FRT': true,
        'Pipe': true
      }));
    }
  }, [isAmcService]);

  // Handle part checkbox change
  const handlePartChange = (partName) => {
    setPartsUsed(prev => ({
      ...prev,
      [partName]: !prev[partName]
    }));
  };

  const handleComplete = async () => {
    // Photo is MANDATORY
    if (!photo) {
      setError('❌ Photo is required. Please upload a photo of the completed work.');
      return;
    }

    // Work Notes are now OPTIONAL (removed validation for notes)

    setLoading(true);
    setError('');
    showLoader();

    try {
      // Convert photo to Base64
      const reader = new FileReader();
      reader.onload = async (event) => {
        const photoBase64 = event.target.result; // This is the Base64 data URL
        
        try {
          // Prepare parts used data
          const partsUsedData = Object.entries(partsUsed)
            .filter(([name, isChecked]) => isChecked)
            .map(([name]) => {
              if (name === 'Connector') {
                return { name, qty: connectorQuantity };
              }
              return { name, qty: 1 };
            });

          const completionDate = new Date().toISOString();
          const completionDateStr = completionDate.split('T')[0];

          // Update ticket status in Firebase
          const ticketRef = ref(db, `tickets/${id}`);
          const ticketUpdate = {
            status: 'completed',
            completionNotes: notes,
            completedAt: completionDate,
            photoName: photo.name,
            photoData: photoBase64, // Store Base64 photo
            partsUsed: partsUsedData // Add parts used data
          };

          // If AMC service was also completed and customer has active AMC
          if (amcServiceCompleted && customerData && customerData.amc && customerData.amc.isActive) {
            // Update AMC data
            const updatedAMC = amcReminderService.processServiceCompletion(customerData.amc, completionDateStr);
            const finalAMC = amcReminderService.checkAndDeactivateAMC(updatedAMC, completionDateStr);
            
            // Record AMC service history
            const amcServiceHistory = customerData.amc.serviceHistory || [];
            amcServiceHistory.push({
              date: completionDateStr,
              source: 'Ticket',
              ticketId: id,
              technicianName: sessionStorage.getItem('technicianName') || 'Unknown'
            });
            
            // Update customer with new AMC data
            const customerRef = ref(db, `customers/${jobData.customerId}`);
            await update(customerRef, {
              amc: {
                ...finalAMC,
                serviceHistory: amcServiceHistory
              }
            });
            
            // Mark that AMC service was completed via this ticket
            ticketUpdate.amcServiceCompleted = true;
            ticketUpdate.amcServiceCompletedAt = completionDate;
          }

          await update(ticketRef, ticketUpdate);

          // Check if payment is required
          if (jobData && jobData.takePayment) {
            alert('Job marked as complete! Proceeding to payment...');
            navigate(`/payment/${id}`);
          } else {
            alert('Job marked as complete!');
            navigate('/today-jobs');
          }
        } catch (err) {
          console.error('Error completing job:', err);
          setError('Failed to complete job. Please try again.');
          setLoading(false);
        } finally {
          hideLoader();
        }
      };
      reader.readAsDataURL(photo);
    } catch (err) {
      console.error('Error processing photo:', err);
      setError('Failed to process photo. Please try again.');
      setLoading(false);
      hideLoader();
    }
  };

  return (
    <div>
      <div className="header">
        <div className="header-title">Complete Job</div>
      </div>
      <div className="container">
        <div className="card">
          <h2>Mark Job as Complete</h2>
          
          {error && (
            <div style={{ background: '#f8d7da', color: '#721c24', padding: '10px', borderRadius: '4px', marginBottom: '15px' }}>
              {error}
            </div>
          )}
          
          {/* AMC Service Completion Option - Only if customer has active AMC */}
          {hasActiveAmc && (
            <div className="form-group" style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#e8f5e9', borderRadius: '8px', border: '2px solid #4caf50' }}>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={amcServiceCompleted}
                  onChange={(e) => setAmcServiceCompleted(e.target.checked)}
                  style={{ marginRight: '10px', transform: 'scale(1.3)' }}
                />
                <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#2e7d32' }}>AMC Service Also Completed</span>
              </label>
              <p style={{ margin: '5px 0 0 0', fontSize: '0.9rem', color: '#558b2f' }}>
                Check this box if an AMC service was also completed during this visit
              </p>
            </div>
          )}
          
          {/* AMC Service Toggle for Parts Selection */}
          <div className="form-group" style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #dee2e6' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isAmcService}
                onChange={(e) => setIsAmcService(e.target.checked)}
                style={{ marginRight: '10px', transform: 'scale(1.3)' }}
              />
              <span style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>Use AMC Parts</span>
            </label>
            <p style={{ margin: '5px 0 0 0', fontSize: '0.9rem', color: '#666' }}>
              When checked, automatically selects standard AMC parts (Spun, Sediment, Carbon, Membren, FRT, Pipe)
            </p>
          </div>
          
          {/* Parts Checklist */}
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label style={{ fontWeight: 'bold', marginBottom: '10px', display: 'block' }}>Parts Used / Needed:</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px' }}>
              {Object.entries(partsUsed).map(([partName, isChecked]) => (
                <label 
                  key={partName} 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    padding: '8px', 
                    border: '1px solid #ddd', 
                    borderRadius: '4px',
                    backgroundColor: isChecked ? '#e3f2fd' : 'white'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handlePartChange(partName)}
                    style={{ marginRight: '8px' }}
                  />
                  <span>{partName}</span>
                </label>
              ))}
            </div>
            
            {/* Connector Quantity Input */}
            {partsUsed['Connector'] && (
              <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#f1f8e9', borderRadius: '4px' }}>
                <label style={{ fontWeight: 'bold' }}>Connector Quantity:</label>
                <input
                  type="number"
                  min="1"
                  value={connectorQuantity}
                  onChange={(e) => setConnectorQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  style={{ 
                    marginLeft: '10px', 
                    padding: '5px', 
                    width: '80px', 
                    borderRadius: '4px', 
                    border: '1px solid #ddd' 
                  }}
                />
              </div>
            )}
          </div>
          
          <div className="form-group">
            <label>Work Notes: <span style={{ fontSize: '0.85rem', color: '#666', fontWeight: 'normal' }}>(Optional)</span></label>
            <textarea 
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ width: '100%', minHeight: '150px', padding: '10px', borderRadius: '4px', border: '1px solid #ddd' }}
              placeholder="Describe the work completed (optional)..."
            />
          </div>

          <div className="form-group">
            <label>Photo: <span style={{ color: 'red', fontWeight: 'bold' }}>*</span> <span style={{ fontSize: '0.85rem', color: '#d32f2f', fontWeight: 'normal' }}>(Required)</span></label>
            
            {cameraError && (
              <div style={{ background: '#fff3cd', color: '#856404', padding: '10px', borderRadius: '4px', marginBottom: '10px', fontSize: '0.9rem' }}>
                ⚠️ {cameraError}
                <button 
                  type="button"
                  onClick={async () => {
                    await appPermissionManager.openAppSettings();
                  }}
                  style={{ marginLeft: '10px', padding: '5px 10px', fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  Open Settings
                </button>
              </div>
            )}
            
            <input 
              type="file" 
              accept="image/*"
              capture="environment"
              onChange={async (e) => {
                // Verify permission before accepting file
                const hasPermission = await appPermissionManager.verifyCameraPermission();
                if (!hasPermission) {
                  setCameraError('Camera permission denied. Please enable in Settings.');
                  e.target.value = '';
                  return;
                }
                setCameraError('');
                setPhoto(e.target.files[0]);
              }}
            />
            {photo ? (
              <p style={{ color: 'green', marginTop: '10px', fontWeight: '500' }}>✅ Photo selected: {photo.name}</p>
            ) : (
              <p style={{ color: '#d32f2f', marginTop: '10px', fontSize: '0.9rem', fontWeight: '500' }}>⚠️ Photo is mandatory</p>
            )}
          </div>

          <button 
            className="btn" 
            onClick={handleComplete}
            disabled={loading}
            style={{ marginTop: '20px' }}
          >
            {loading ? 'Completing...' : (jobData?.takePayment ? 'Complete Job & Collect Payment' : 'Mark as Done')}
          </button>
          <button 
            className="btn" 
            onClick={() => navigate('/today-jobs')}
            disabled={loading}
            style={{ marginTop: '10px', background: '#6c757d' }}
          >
            Cancel
          </button>
          
          {jobData && (
            <>
              <div style={{ marginTop: '20px', padding: '15px', backgroundColor: jobData.takePayment ? '#fff3cd' : '#d4edda', borderRadius: '8px', border: `1px solid ${jobData.takePayment ? '#ffc107' : '#28a745'}` }}>
                <p style={{ margin: '0', fontWeight: 'bold', color: jobData.takePayment ? '#856404' : '#155724' }}>
                  {jobData.takePayment ? '💳 Payment Collection Required' : '✅ No Payment Required'}
                </p>
                {jobData.takePayment && (
                  <p style={{ margin: '5px 0 0 0', fontSize: '0.9rem', color: '#856404' }}>
                    Amount to collect: ₹{jobData.paymentAmount || 0}
                  </p>
                )}
              </div>
              
              {hasActiveAmc && amcServiceCompleted && (
                <div style={{ marginTop: '15px', padding: '15px', backgroundColor: '#e3f2fd', borderRadius: '8px', border: '1px solid #2196f3' }}>
                  <p style={{ margin: '0', fontWeight: 'bold', color: '#1565c0' }}>
                    ✅ AMC Service Completion Enabled
                  </p>
                  <p style={{ margin: '5px 0 0 0', fontSize: '0.9rem', color: '#1976d2' }}>
                    This will update the customer's AMC record and service count when job is completed
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default JobCompleteScreen;
