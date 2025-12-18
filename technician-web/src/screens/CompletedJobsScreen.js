import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDatabase, ref, query, orderByChild, equalTo, get } from 'firebase/database';
import sessionManager from '../services/sessionManager';
import { showLoader, hideLoader } from '../utils/globalLoader';

const CompletedJobsScreen = () => {
  const navigate = useNavigate();
  const [completedJobs, setCompletedJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCompletedJobs = async () => {
      try {
        setLoading(true);
        showLoader();

        const technicianId = sessionManager.getTechnicianId();
        if (!technicianId) {
          navigate('/login');
          return;
        }

        const database = getDatabase();
        const ticketsRef = ref(database, 'tickets');

        const ticketsQuery = query(
          ticketsRef,
          orderByChild('assignedToId'),
          equalTo(technicianId)
        );

        const snapshot = await get(ticketsQuery);
        const ticketsData = snapshot.val() || {};

        const jobsList = Object.keys(ticketsData)
          .filter(key => {
            const status = ticketsData[key].status || 'assigned';
            // ✅ RULE 5: Only show SERVICE type jobs (exclude TICKET/COMPLAINT)
            const jobType = ticketsData[key].type || 'SERVICE'; // Default to SERVICE for backward compatibility
            return jobType === 'SERVICE' && status === 'completed';
          })
          .map(key => ({
            id: key,
            ticketCode: ticketsData[key].ticketCode || key.substring(0, 4), // ✅ Include ticketCode
            customerId: ticketsData[key].customerId,
            customer: ticketsData[key].customerName || 'Unknown',
            service: ticketsData[key].title || 'Service',
            address: ticketsData[key].address || 'Address not provided',
            status: ticketsData[key].status || 'completed',
            description: ticketsData[key].description,
            completedAt: ticketsData[key].completedAt || 'Not specified',
            partsUsed: ticketsData[key].partsUsed || [],
            completionNotes: ticketsData[key].completionNotes || 'No notes'
          }))
          // Sort by completion date (most recent first)
          .sort((a, b) => {
            const dateA = new Date(a.completedAt);
            const dateB = new Date(b.completedAt);
            return dateB - dateA;
          });

        setCompletedJobs(jobsList);
      } catch (error) {
        console.error('Error loading completed jobs:', error);
        setCompletedJobs([]);
      } finally {
        hideLoader();
        setLoading(false);
      }
    };

    loadCompletedJobs();
  }, [navigate]);

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const getPartsUsedSummary = (partsUsed) => {
    if (!partsUsed || partsUsed.length === 0) {
      return 'No parts recorded';
    }
    return partsUsed
      .map(part => part.qty > 1 ? `${part.name} (${part.qty})` : part.name)
      .join(', ');
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f4f6fb', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* HEADER */}
      <div
        className="header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          backgroundColor: '#001a4d',
          color: '#ffffff',
          boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
          position: 'sticky',
          top: 0,
          zIndex: 10
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
          <img
            src="/logo.svg"
            alt="Global Appliance Tech Logo"
            style={{ height: '32px', width: '32px', borderRadius: '6px', flexShrink: 0 }}
          />
          <div style={{ overflow: 'hidden' }}>
            <div
              className="header-title"
              style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, whiteSpace: 'nowrap' }}
            >
              Global Appliance Tech
            </div>
            <div
              style={{
                margin: 0,
                fontSize: '0.7rem',
                opacity: 0.9,
                whiteSpace: 'nowrap'
              }}
            >
              Completed Jobs
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div
        className="container"
        style={{
          maxWidth: '900px',
          margin: '0 auto',
          padding: '12px 10px 80px 10px',
          flex: 1,
          overflowY: 'auto',
          width: '100%'
        }}
      >
        <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '12px 0', color: '#001a4d' }}>
          ✅ Completed Jobs
        </h2>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>Loading completed jobs...</div>
        ) : completedJobs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
            No completed jobs yet
          </div>
        ) : (
          completedJobs.map((job) => (
            <div
              key={job.id}
              className="job-card"
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '10px',
                padding: '12px',
                marginBottom: '10px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                borderLeft: '4px solid #28a745'
              }}
            >
              <div style={{ backgroundColor: '#e8f5e9', padding: '8px 10px', borderRadius: '6px', marginBottom: '8px', border: '1px solid #4caf50' }}>
                <p style={{ margin: '0', fontSize: '12px', color: '#2e7d32' }}>
                  <strong>📋 Job Code:</strong> <span style={{ fontSize: '1rem', fontWeight: 'bold', color: '#0066ff' }}>{job.ticketCode}</span>
                </p>
              </div>
              <h3
                style={{
                  margin: '0 0 6px 0',
                  fontSize: '15px',
                  color: '#001a4d'
                }}
              >
                {job.service}
              </h3>
              <p style={{ margin: '0 0 4px 0', fontSize: '13px' }}>
                <strong>Customer:</strong> {job.customer}
              </p>
              <p style={{ margin: '0 0 4px 0', fontSize: '13px' }}>
                <strong>Address:</strong> {job.address}
              </p>
              <p style={{ margin: '0 0 4px 0', fontSize: '13px' }}>
                <strong>Completed:</strong> {formatDate(job.completedAt)}
              </p>
              <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#666' }}>
                <strong>Parts Used:</strong> {getPartsUsedSummary(job.partsUsed)}
              </p>
              <p style={{ margin: '0 0 6px 0', fontSize: '12px', color: '#666' }}>
                <strong>Notes:</strong> {job.completionNotes.substring(0, 80)}
                {job.completionNotes.length > 80 ? '...' : ''}
              </p>
              <span className={`status-badge status-completed`} style={{ backgroundColor: '#28a745', color: 'white' }}>
                COMPLETED
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default CompletedJobsScreen;
