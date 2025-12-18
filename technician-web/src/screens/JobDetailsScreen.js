import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getDatabase, ref, get } from 'firebase/database';
import { showLoader, hideLoader } from '../utils/globalLoader';

const JobDetailsScreen = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadJobDetails = async () => {
      try {
        showLoader();
        const database = getDatabase();
        
        // Get job details
        const jobRef = ref(database, `tickets/${id}`);
        const jobSnapshot = await get(jobRef);
        const jobData = jobSnapshot.val();
        
        if (jobData) {
          setJob(jobData);
          
          // Get customer details including phone number
          const customersRef = ref(database, `customers/${jobData.customerId}`);
          const customerSnapshot = await get(customersRef);
          const customerData = customerSnapshot.val();
          
          if (customerData) {
            setCustomer(customerData);
          }
        }
      } catch (error) {
        console.error('Error loading job details:', error);
      } finally {
        hideLoader();
        setLoading(false);
      }
    };

    loadJobDetails();
  }, [id]);

  const handleCall = () => {
    if (customer && customer.phone) {
      // Clean phone number (remove spaces, dashes, etc.)
      const cleanPhone = customer.phone.replace(/[^0-9+]/g, '');
      
      // Create tel link and open it
      const telLink = `tel:${cleanPhone}`;
      
      // Try multiple methods for better compatibility
      try {
        // Method 1: Create a temporary link and click it
        const link = document.createElement('a');
        link.href = telLink;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (error) {
        // Method 2: Direct window.location (fallback)
        window.location.href = telLink;
      }
    } else {
      alert('Customer phone number not available');
    }
  };

  const handleOpenMap = () => {
    if (customer && customer.map) {
      // Open Google Maps with the map code (Plus Code or coordinates)
      const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(customer.map)}`;
      window.open(mapUrl, '_blank');
    } else {
      alert('Customer map location not available');
    }
  };

  if (loading) {
    return (
      <div>
        <div className="header">
          <div className="header-title">Job Details</div>
          {/* Removed back button as we now have bottom navigation */}
        </div>
        <div className="container">
          <div style={{ textAlign: 'center', padding: '20px' }}>Loading job details...</div>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div>
        <div className="header">
          <div className="header-title">Job Details</div>
          {/* Removed back button as we now have bottom navigation */}
        </div>
        <div className="container">
          <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>Job not found</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="header">
        <div className="header-title">Job Details</div>
        {/* Removed back button as we now have bottom navigation */}
      </div>
      <div className="container">
        <div className="card">
          <h2>Job #{id}</h2>
          <p><strong>Customer:</strong> {job.customerName || 'Unknown'}</p>
          <p><strong>Service:</strong> {job.title || 'N/A'}</p>
          <p><strong>Address:</strong> {job.address || 'Address not provided'}</p>
          <p><strong>📞 Phone:</strong> {customer?.phone || 'Not available'}</p>
          {customer?.map && (
            <p><strong>📍 Map:</strong> {customer.map}</p>
          )}
          <p><strong>Description:</strong> {job.description || 'No description'}</p>
          <p><strong>🕐 Scheduled Arrival:</strong> {job.scheduledArrivalTime || 'Not specified'}</p>
          <p><strong>Priority:</strong> {job.priority || 'Normal'}</p>
          <p><strong>Status:</strong> <span className={`status-badge status-${job.status}`}>{job.status?.toUpperCase()}</span></p>
          
          {/* Display Parts Used */}
          {job.partsUsed && job.partsUsed.length > 0 && (
            <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#e8f5e9', borderRadius: '8px', border: '1px solid #4caf50' }}>
              <h3 style={{ marginTop: '0', color: '#2e7d32' }}>🔧 Parts Used</h3>
              <ul style={{ margin: '10px 0', paddingLeft: '20px' }}>
                {job.partsUsed.map((part, index) => (
                  <li key={index} style={{ marginBottom: '5px' }}>
                    {part.name}{part.qty > 1 ? ` (${part.qty})` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Display Completion Details */}
          {job.status === 'completed' && (
            <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#e8f5e9', borderRadius: '8px', border: '1px solid #4caf50' }}>
              <h3 style={{ marginTop: '0', color: '#2e7d32' }}>✅ Work Completed</h3>
              {job.completionNotes && (
                <div style={{ marginBottom: '15px' }}>
                  <p style={{ margin: '0 0 5px 0', fontSize: '0.9rem', color: '#666' }}><strong>Work Notes:</strong></p>
                  <p style={{ margin: '0', padding: '10px', backgroundColor: '#fff', borderRadius: '4px', border: '1px solid #ddd' }}>
                    {job.completionNotes}
                  </p>
                </div>
              )}
              {job.photoData && (
                <div>
                  <p style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#666' }}><strong>Completion Photo:</strong></p>
                  <img 
                    src={job.photoData} 
                    alt="Completed work" 
                    style={{ 
                      maxWidth: '100%', 
                      height: 'auto', 
                      borderRadius: '8px', 
                      border: '1px solid #ddd',
                      cursor: 'pointer'
                    }}
                    onClick={() => window.open(job.photoData, '_blank')}
                    title="Click to view full size"
                  />
                </div>
              )}
              {job.completedAt && (
                <p style={{ margin: '10px 0 0 0', fontSize: '0.85rem', color: '#666' }}>
                  <strong>Completed at:</strong> {new Date(job.completedAt).toLocaleString()}
                </p>
              )}
            </div>
          )}
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px', flexWrap: 'wrap' }}>
            <button 
              className="btn"
              style={{ backgroundColor: '#28a745' }}
              onClick={handleCall}
            >
              ☏️ Call Customer
            </button>
            {customer?.map && (
              <button 
                className="btn"
                style={{ backgroundColor: '#007bff' }}
                onClick={handleOpenMap}
              >
                🗺️ Open Map
              </button>
            )}
            {job.status !== 'completed' && (
              <button 
                className="btn" 
                onClick={() => navigate(`/job-complete/${id}`)}
              >
                ✅ Mark as Complete
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default JobDetailsScreen;
