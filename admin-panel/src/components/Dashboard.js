import React, { useState, useEffect } from 'react';
import dataService from '../services/dataService';
import amcStatusMonitor from '../services/amcStatusMonitor';
import { showLoader, hideLoader } from '../utils/globalLoader';

const Dashboard = () => {
  const [stats, setStats] = useState({
    todayJobs: 0,
    pendingTickets: 0,
    collections: 0
  });
  const [recentActivities, setRecentActivities] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Load data from data service
    const loadData = async () => {
      setError(null);
      setStats({
        todayJobs: 0,
        pendingTickets: 0,
        collections: 0
      });
      try {
        showLoader();
        console.log('Dashboard: Fetching tickets...');
        const tickets = await dataService.getTickets();
        console.log('Dashboard: Tickets fetched:', tickets?.length || 0);
        
        console.log('Dashboard: Fetching payments...');
        const payments = await dataService.getPayments();
        console.log('Dashboard: Payments fetched:', payments?.length || 0);
        
        // Run AMC status monitoring in background (non-blocking)
        console.log('Dashboard: Monitoring AMC status...');
        amcStatusMonitor.monitorAllCustomersAMC().then(result => {
          console.log('✅ AMC monitoring result:', result);
        }).catch(err => {
          console.warn('⚠️ AMC monitoring failed (non-critical):', err);
        });
        
        if (!tickets || !payments) {
          throw new Error('Failed to fetch data: tickets or payments is undefined');
        }
        
        // Calculate stats
        const today = new Date().toISOString().split('T')[0];
        const todayJobs = tickets.filter(ticket => ticket.createdAt === today).length;
        const pendingTickets = tickets.filter(ticket => ticket.status === 'open' || ticket.status === 'assigned').length;
        
        // Calculate collections (sum of completed payments)
        const collections = payments
          .filter(payment => payment.status === 'completed')
          .reduce((sum, payment) => sum + (payment.amount || 0), 0);
        
        console.log('Dashboard: Stats calculated -', { todayJobs, pendingTickets, collections });
        
        setStats({
          todayJobs,
          pendingTickets,
          collections
        });
        
        // Get recent activities (last 3 tickets)
        const recent = tickets.slice(-3);
        setRecentActivities(recent);
      } catch (err) {
        console.error('Error loading dashboard data:', err);
        setError(err.message || 'Failed to load dashboard data');
      } finally {
        hideLoader();
      }
    };
    
    loadData();
  }, []);

  return (
    <div className="content" style={{ padding: '0', display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <h1 style={{ padding: '15px 20px 0', margin: '0', flexShrink: 0 }}>Dashboard</h1>
      
      {error && (
        <div style={{
          backgroundColor: '#f8d7da',
          color: '#721c24',
          padding: '10px 20px',
          borderRadius: '0',
          marginBottom: '0',
          border: '1px solid #f5c6cb',
          margin: '8px 20px 0',
          flexShrink: 0
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}
      
      <div style={{
        flex: '1',
        padding: '15px',
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '15px',
        minHeight: '0',
        width: '100%'
      }}>
        {/* Stats cards */}
        <div style={{
          flex: '0 0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '15px',
          overflow: 'visible',
          width: '100%'
        }}>
          <div className="card" style={{ padding: '12px', minHeight: 'auto' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Today's Jobs</h3>
            <div className="card-value" style={{ fontSize: '24px', margin: '4px 0' }}>{stats.todayJobs}</div>
            <p style={{ margin: '0', fontSize: '12px' }}>Jobs scheduled for today</p>
          </div>
          
          <div className="card" style={{ padding: '12px', minHeight: 'auto' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Pending Tickets</h3>
            <div className="card-value" style={{ fontSize: '24px', margin: '4px 0' }}>{stats.pendingTickets}</div>
            <p style={{ margin: '0', fontSize: '12px' }}>Tickets awaiting action</p>
          </div>
          
          <div className="card" style={{ padding: '12px', minHeight: 'auto' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Today's Collections</h3>
            <div className="card-value" style={{ fontSize: '24px', margin: '4px 0' }}>₹{stats.collections.toLocaleString()}</div>
            <p style={{ margin: '0', fontSize: '12px' }}>Amount collected today</p>
          </div>
        </div>
      <div className="table-container" style={{ margin: '0 15px 15px', height: 'auto', maxHeight: '300px', overflow: 'auto', flexShrink: 0, borderRadius: '8px' }}>
        <h2 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>Recent Activities</h2>
        {recentActivities.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#999', fontSize: '12px' }}>No recent activities</p>
        ) : (
          <table style={{ fontSize: '12px' }}>
            <thead>
              <tr>
                <th>Ticket ID</th>
                <th>Customer</th>
                <th>Status</th>
                <th>Assigned To</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {recentActivities.map(ticket => (
                <tr key={ticket.id}>
                  <td><span style={{ fontWeight: 'bold', color: '#0066ff' }}>{ticket.ticketCode || ticket.id.substring(0, 4)}</span></td>
                  <td>{ticket.customerName}</td>
                  <td><span className={`status-badge status-${ticket.status}`}>{ticket.status}</span></td>
                  <td>{ticket.assignedTo}</td>
                  <td>{ticket.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      </div>
    </div>
  );
};

export default Dashboard;