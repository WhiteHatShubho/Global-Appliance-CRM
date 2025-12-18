import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDatabase, ref, query, orderByChild, equalTo, get } from 'firebase/database';
import sessionManager from '../services/sessionManager';
import attendanceReminderService from '../services/attendanceReminderService';
import { showLoader, hideLoader } from '../utils/globalLoader';

const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes cache for better performance

const TodayJobsScreen = () => {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [customerLocations, setCustomerLocations] = useState({});
  const [lastFetch, setLastFetch] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update greeting time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Initialize attendance reminder (11 AM daily)
  useEffect(() => {
    attendanceReminderService.initializeDailyReminder();
  }, []);

  // Function to get greeting based on time
  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) {
      return { en: 'Morning', bn: 'সুপ্রভাত' };
    } else if (hour < 18) {
      return { en: 'Afternoon', bn: 'শুভ অপরাহ্ণ' };
    } else {
      return { en: 'Evening', bn: 'শুভ সন্ধ্যা' };
    }
  };

  const greeting = getGreeting();

  useEffect(() => {
    const now = Date.now();
    if (now - lastFetch < CACHE_DURATION && jobs.length > 0) {
      console.log('Using cached jobs data');
      setLoading(false);
      return;
    }

    const loadJobs = async () => {
      try {
        showLoader();
        setLoading(true);

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
            
            // Only show active/assigned/pending jobs (exclude completed and closed)
            return jobType === 'SERVICE' &&
                   (status === 'assigned' || status === 'pending' || status === 'active') && 
                   status !== 'completed' && status !== 'closed';
          })
          .map(key => ({
            id: key,
            ticketCode: ticketsData[key].ticketCode || key.substring(0, 4), // ✅ Include ticketCode
            customerId: ticketsData[key].customerId,
            customer: ticketsData[key].customerName || 'Unknown',
            service: ticketsData[key].title || 'Service',
            address: ticketsData[key].address || 'Address not provided',
            status: ticketsData[key].status || 'assigned',
            description: ticketsData[key].description,
            priority: ticketsData[key].priority,
            scheduledArrivalTime: ticketsData[key].scheduledArrivalTime || 'Not specified'
          }))
          // Sort by scheduled arrival time (earliest first)
          .sort((a, b) => {
            // Parse times for comparison
            const timeA = new Date("1970/01/01 " + a.scheduledArrivalTime);
            const timeB = new Date("1970/01/01 " + b.scheduledArrivalTime);
            return timeA - timeB;
          });

        setJobs(jobsList);
        setLastFetch(Date.now());

        const customersRef = ref(database, 'customers');
        const customersSnapshot = await get(customersRef);
        const customersData = customersSnapshot.val() || {};

        const locations = {};
        Object.keys(customersData).forEach(customerId => {
          const customer = customersData[customerId];
          if (customer.mapCode) {
            locations[customerId] = { mapCode: customer.mapCode };
          }
        });

        setCustomerLocations(locations);
      } catch (error) {
        console.error('Error loading jobs:', error);
        setJobs([]);
      } finally {
        hideLoader();
        setLoading(false);
      }
    };

    loadJobs();
  }, [navigate, lastFetch, jobs.length]);

  const handleLogout = () => {
    sessionManager.clearSession();
    localStorage.removeItem('isAdmin');
    setTimeout(() => {
      navigate('/login', { replace: true });
    }, 100);
  };

  const openGoogleMaps = (job) => {
    const location = customerLocations[job.customerId];
    if (!location || !location.mapCode) {
      alert('Location not available for this customer');
      return;
    }
    const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(location.mapCode)}`;
    window.open(mapsUrl, '_blank');
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f4f6fb', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* COMPACT HORIZONTAL HEADER - Simplified without navigation buttons */}
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
          {/* IMPORTANT: technician logo file path (update to your actual file) */}
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
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                overflow: 'hidden'
              }}
            >
              Today&apos;s Jobs
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
        {/* BILINGUAL GREETING */}
        <div style={{ marginBottom: '12px' }}>
          <h2
            style={{
              fontSize: '18px',
              fontWeight: 700,
              margin: '0 0 2px 0',
              color: '#001a4d'
            }}
          >
            Good {greeting.en}, {sessionManager.getTechnicianName()}! 👋
          </h2>
          <p
            style={{
              fontSize: '13px',
              fontWeight: 500,
              opacity: 0.8,
              margin: 0,
              color: '#001a4d'
            }}
          >
            {greeting.bn}, {sessionManager.getTechnicianName()}!
          </p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>Loading jobs...</div>
        ) : jobs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
            ✅ No pending jobs today! Check <strong>Completed Jobs</strong> for finished work.
          </div>
        ) : (
          jobs.map((job, index) => {
            // Generate ordinal labels (1st, 2nd, 3rd, etc.)
            const getOrdinal = (n) => {
              const s = ["th", "st", "nd", "rd"];
              const v = n % 100;
              return n + (s[(v - 20) % 10] || s[v] || s[0]);
            };
            
            const jobLabel = `${getOrdinal(index + 1)} Job`;
            const jobLabelWithTime = `${jobLabel} – ${job.scheduledArrivalTime}`;
            
            const hasLocation = customerLocations[job.customerId]?.mapCode;
            return (
              <div
                key={job.id}
                className="job-card"
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '10px',
                  padding: '12px',
                  marginBottom: '10px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
                }}
              >
                <div style={{ backgroundColor: '#e3f2fd', padding: '8px 10px', borderRadius: '6px', marginBottom: '8px', border: '1px solid #2196f3' }}>
                  <p style={{ margin: '0', fontSize: '12px', color: '#1565c0' }}>
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
                  <strong>{jobLabelWithTime}</strong>
                </p>
                <p style={{ margin: '0 0 4px 0', fontSize: '13px' }}>
                  <strong>Customer:</strong> {job.customer}
                </p>
                <p style={{ margin: '0 0 4px 0', fontSize: '13px' }}>
                  <strong>Address:</strong> {job.address}
                </p>
                <p style={{ margin: '4px 0' }}>
                  <span className={`status-badge status-${job.status}`}>
                    {job.status.toUpperCase()}
                  </span>
                </p>
                <div
                  style={{
                    display: 'flex',
                    gap: '10px',
                    marginTop: '10px',
                    flexWrap: 'wrap'
                  }}
                >
                  <button
                    className="btn"
                    onClick={() => navigate(`/job-details/${job.id}`)}
                  >
                    View Details
                  </button>
                  {hasLocation && (
                    <button
                      className="btn"
                      style={{ backgroundColor: '#17a2b8' }}
                      onClick={() => openGoogleMaps(job)}
                    >
                      📍 View Map
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default TodayJobsScreen;
