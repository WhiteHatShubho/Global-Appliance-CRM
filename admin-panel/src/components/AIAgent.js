import React, { useState, useEffect } from 'react';
import dataService from '../services/dataService';
import { aiAutomationService } from '../services/aiAutomationService';
import amcReminderService from '../services/amcReminderService';

const AIAgent = () => {
  const [reminders, setReminders] = useState([]);
  const [adminNotifications, setAdminNotifications] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedReview, setSelectedReview] = useState(null);
  const [reviewMessage, setReviewMessage] = useState('');
  const [activeTab, setActiveTab] = useState('admin');
  const [automationRunning, setAutomationRunning] = useState(false);
  const [automationStats, setAutomationStats] = useState(null);
  const [automationLogs, setAutomationLogs] = useState([]);
  const [autoBackups, setAutoBackups] = useState([]);
  const [monthFilter, setMonthFilter] = useState(() => {
    // Auto-select current month
    const today = new Date();
    return String(today.getMonth() + 1).padStart(2, '0');
  }); // Filter reminders by month (01-12)

  useEffect(() => {
    loadReminders();
  }, []);

  const loadReminders = async () => {
    setLoading(true);
    try {
      const customers = await dataService.getCustomers(true);
      const tickets = await dataService.getTickets();
      const technicians = await dataService.getTechnicians();
      
      const today = new Date();
      const newReminders = [];
      const newAdminNotifications = [];

      // Check for AMC SERVICE reminders (based on lastServiceDate & nextServiceDate)
      customers.forEach(customer => {
        if (!customer.amc || customer.customerType !== 'AMC') return;

        const amc = customer.amc;
        const todayStr = today.toISOString().split('T')[0];

        // Check if service reminder should be shown
        if (amcReminderService.shouldShowServiceReminder(amc, todayStr)) {
          newReminders.push({
            id: `amc-service-${customer.id}`,
            type: 'AMC_SERVICE_REMINDER',
            customerName: customer.fullName || customer.name,
            customerPhone: customer.phone,
            customerId: customer.id,
            reminderDate: amc.nextServiceDate,
            message: `⏰ AMC Service Due for ${customer.fullName}. Last service: ${amc.lastServiceDate}. Due: ${amc.nextServiceDate}`,
            status: 'pending'
          });
        }
      });

      // Check for AMC RENEWAL reminders (expiry or all services completed)
      customers.forEach(customer => {
        if (!customer.amc || customer.customerType !== 'AMC') return;

        const amc = customer.amc;
        const todayStr = today.toISOString().split('T')[0];
        const renewalInfo = amcReminderService.shouldShowRenewalReminder(amc, todayStr);

        if (renewalInfo.shouldShow) {
          newReminders.push({
            id: `amc-renewal-${customer.id}`,
            type: 'AMC_RENEWAL',
            customerName: customer.fullName || customer.name,
            customerPhone: customer.phone,
            customerId: customer.id,
            daysLeft: renewalInfo.daysLeft,
            amcAmount: customer.amcAmount,
            reminderDate: amc.endDate,
            message: `🔔 ${renewalInfo.reason}: ${customer.fullName}. AMC Expires: ${amc.endDate}. Renewal: ₹${customer.amcAmount}`,
            status: 'pending'
          });

          newAdminNotifications.push({
            id: `admin-amc-renewal-${customer.id}`,
            type: 'ADMIN_AMC_ALERT',
            priority: renewalInfo.daysLeft <= 7 ? 'high' : 'medium',
            title: '🔔 AMC Action Required',
            message: `${customer.fullName}: ${renewalInfo.reason}. Days left: ${renewalInfo.daysLeft}. Renewal: ₹${customer.amcAmount}`,
            timestamp: new Date().toISOString(),
            status: 'unread'
          });
        }
      });

      // Check for non-AMC SERVICE reminders (ad-hoc services)
      customers.forEach(customer => {
        const serviceTickets = tickets.filter(
          t => t.customerId === customer.id && t.serviceType === 'scheduled' && !t.amcGenerated
        );
        
        serviceTickets.forEach(ticket => {
          const serviceDate = new Date(ticket.createdAt);
          const daysSinceScheduled = Math.floor((today - serviceDate) / (1000 * 60 * 60 * 24));
          
          if (daysSinceScheduled <= 7 && ticket.status === 'assigned') {
            newReminders.push({
              id: `service-${ticket.id}`,
              type: 'SERVICE_REMINDER',
              customerName: customer.fullName || customer.name,
              customerPhone: customer.phone,
              ticketId: ticket.id,
              reminderDate: (ticket.scheduledDate || ticket.serviceDate || ticket.createdAt).split('T')[0],
              message: `Service pending: ${customer.fullName}`,
              status: 'pending'
            });
            
            if (!ticket.assignedTo) {
              newAdminNotifications.push({
                id: `admin-service-${ticket.id}`,
                type: 'ADMIN_SERVICE_UNASSIGNED',
                priority: 'high',
                title: '⚠️ Unassigned Service',
                message: `Service for ${customer.fullName} needs assignment`,
                timestamp: new Date().toISOString(),
                status: 'unread'
              });
            }
          }
        });
      });

      // Check technicians
      const inactiveTechnicians = technicians.filter(t => t.status !== 'active');
      if (inactiveTechnicians.length > 0) {
        newAdminNotifications.push({
          id: 'admin-technicians',
          type: 'ADMIN_TECHNICIAN_STATUS',
          priority: 'medium',
          title: '👥 Technician Status',
          message: `${inactiveTechnicians.length} technician(s) inactive`,
          timestamp: new Date().toISOString(),
          status: 'unread'
        });
      }

      // Check for overdue tickets
      const overdueTickets = tickets.filter(t => {
        const createdDate = new Date(t.createdAt);
        const daysSinceCreated = Math.floor((today - createdDate) / (1000 * 60 * 60 * 24));
        return (t.status === 'open' || t.status === 'assigned') && daysSinceCreated > 3;
      });
      
      if (overdueTickets.length > 0) {
        newAdminNotifications.push({
          id: 'admin-overdue-tickets',
          type: 'ADMIN_OVERDUE_TICKETS',
          priority: 'high',
          title: '⏰ Overdue Tickets',
          message: `${overdueTickets.length} tickets pending > 3 days`,
          timestamp: new Date().toISOString(),
          status: 'unread'
        });
      }

      // Check for review requests
      const completedTickets = tickets.filter(t => t.status === 'completed' && !t.customerReview);
      const reviewReminders = completedTickets.map(ticket => {
        const customer = customers.find(c => c.id === ticket.customerId);
        const completionDate = new Date(ticket.completedAt || ticket.createdAt);
        return {
          id: `review-${ticket.id}`,
          type: 'REVIEW_REQUEST',
          customerName: customer?.fullName || customer?.name || 'Unknown',
          customerPhone: customer?.phone,
          ticketId: ticket.id,
          reminderDate: completionDate.toISOString().split('T')[0],
          message: `Request review from ${customer?.fullName}`,
          status: 'pending'
        };
      });

      setReminders([...newReminders, ...reviewReminders]);
      setAdminNotifications(newAdminNotifications);
      setReviews(reviewReminders);
    } catch (error) {
      console.error('Error loading reminders:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendReminder = async (reminder) => {
    try {
      alert(`Reminder sent to ${reminder.customerName} (${reminder.customerPhone})`);
      setReminders(reminders.map(r => 
        r.id === reminder.id ? { ...r, status: 'sent' } : r
      ));
    } catch (error) {
      console.error('Error sending reminder:', error);
      alert('Failed to send reminder');
    }
  };

  const markAsSkipped = (reminderId) => {
    setReminders(reminders.map(r => 
      r.id === reminderId ? { ...r, status: 'skipped' } : r
    ));
  };

  // Filter reminders by month
  const getFilteredReminders = (remindersToFilter) => {
    if (!monthFilter) return remindersToFilter;
    return remindersToFilter.filter(reminder => {
      if (!reminder.reminderDate) return true;
      const reminderMonth = reminder.reminderDate.substring(5, 7);
      return reminderMonth === monthFilter;
    });
  };

  const markAdminNotificationAsRead = (notificationId) => {
    setAdminNotifications(adminNotifications.map(n => 
      n.id === notificationId ? { ...n, status: 'read' } : n
    ));
  };

  const deleteAdminNotification = (notificationId) => {
    setAdminNotifications(adminNotifications.filter(n => n.id !== notificationId));
  };

  const submitReview = async (review) => {
    try {
      if (!reviewMessage.trim()) {
        alert('Please enter a message');
        return;
      }
      alert(`Review from ${review.customerName} recorded!`);
      setReviews(reviews.map(r => 
        r.id === review.id ? { ...r, status: 'completed' } : r
      ));
      setSelectedReview(null);
      setReviewMessage('');
    } catch (error) {
      console.error('Error submitting review:', error);
      alert('Failed to submit review');
    }
  };

  const handleStartAutomation = async () => {
    try {
      aiAutomationService.startAutomation(5); // Check every 5 minutes
      setAutomationRunning(true);
      alert('✅ AI Automation started! Tasks will run every 5 minutes.');
    } catch (error) {
      alert('❌ Error starting automation: ' + error.message);
    }
  };

  const handleStopAutomation = () => {
    aiAutomationService.stopAutomation();
    setAutomationRunning(false);
    alert('⏹️ AI Automation stopped');
  };

  const updateAutomationStats = () => {
    const stats = aiAutomationService.getStats();
    const logs = aiAutomationService.getLogs(20);
    const backups = aiAutomationService.getAutoBackups();
    setAutomationStats(stats);
    setAutomationLogs(logs);
    setAutoBackups(backups);
  };

  useEffect(() => {
    if (automationRunning) {
      const interval = setInterval(updateAutomationStats, 10000); // Update stats every 10 seconds
      return () => clearInterval(interval);
    }
  }, [automationRunning]);

  return (
    <div className="content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>🤖 AI Agent - Smart Assistant</h1>
        <button className="btn" style={{ width: 'auto' }} onClick={loadReminders} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid #ddd', paddingBottom: '10px' }}>
        <button 
          style={{
            padding: '10px 20px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeTab === 'admin' ? '#0066ff' : '#f0f0f0',
            color: activeTab === 'admin' ? 'white' : '#333',
            borderRadius: '4px',
            fontWeight: 'bold'
          }}
          onClick={() => setActiveTab('admin')}
        >
          📢 Admin Alerts ({adminNotifications.filter(n => n.status === 'unread').length})
        </button>
        <button 
          style={{
            padding: '10px 20px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeTab === 'reminders' ? '#0066ff' : '#f0f0f0',
            color: activeTab === 'reminders' ? 'white' : '#333',
            borderRadius: '4px',
            fontWeight: 'bold'
          }}
          onClick={() => setActiveTab('reminders')}
        >
          📬 Customer Reminders ({reminders.filter(r => r.status === 'pending').length})
        </button>
        <button 
          style={{
            padding: '10px 20px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeTab === 'reviews' ? '#0066ff' : '#f0f0f0',
            color: activeTab === 'reviews' ? 'white' : '#333',
            borderRadius: '4px',
            fontWeight: 'bold'
          }}
          onClick={() => setActiveTab('reviews')}
        >
          ⭐ Reviews ({reviews.filter(r => r.status === 'pending').length})
        </button>
        <button 
          style={{
            padding: '10px 20px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeTab === 'automation' ? '#0066ff' : '#f0f0f0',
            color: activeTab === 'automation' ? 'white' : '#333',
            borderRadius: '4px',
            fontWeight: 'bold'
          }}
          onClick={() => { setActiveTab('automation'); updateAutomationStats(); }}
        >
          🤖 Automation
        </button>
      </div>

      {/* Admin Alerts */}
      {activeTab === 'admin' && (
        <div className="card">
          <h2>📢 Admin Alerts & Notifications</h2>
          {adminNotifications.length === 0 ? (
            <p style={{ color: '#666' }}>No alerts - Everything running smoothly!</p>
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              {adminNotifications.map(notification => (
                <div 
                  key={notification.id}
                  style={{
                    padding: '15px',
                    border: `2px solid ${notification.priority === 'high' ? '#dc3545' : '#ffc107'}`,
                    borderRadius: '6px',
                    backgroundColor: notification.status === 'unread' ? (notification.priority === 'high' ? '#fff5f5' : '#fffbf0') : '#f8f9fa'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          backgroundColor: notification.priority === 'high' ? '#dc3545' : '#ffc107',
                          color: 'white',
                          fontSize: '11px',
                          fontWeight: 'bold'
                        }}>
                          {notification.priority.toUpperCase()}
                        </span>
                        <p style={{ margin: '0', fontWeight: 'bold' }}>{notification.title}</p>
                      </div>
                      <p style={{ margin: '0 0 8px 0' }}>{notification.message}</p>
                      <p style={{ margin: '0', fontSize: '11px', color: '#999' }}>
                        {new Date(notification.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginLeft: '10px', flexDirection: 'column' }}>
                      {notification.status === 'unread' && (
                        <button 
                          className="btn" 
                          style={{ width: 'auto', padding: '6px 12px', fontSize: '12px', backgroundColor: '#6c757d' }}
                          onClick={() => markAdminNotificationAsRead(notification.id)}
                        >
                          Mark Read
                        </button>
                      )}
                      <button 
                        className="btn" 
                        style={{ width: 'auto', padding: '6px 12px', fontSize: '12px', backgroundColor: '#dc3545' }}
                        onClick={() => deleteAdminNotification(notification.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Customer Reminders */}
      {activeTab === 'reminders' && (
        <div className="card">
          <h2>📬 Customer Reminders ({reminders.filter(r => r.status === 'pending').length})</h2>
          
          {/* Month Filter */}
          <div style={{ marginBottom: '15px' }}>
            <label style={{ marginRight: '10px', fontWeight: 'bold' }}>Filter by Month:</label>
            <select 
              value={monthFilter} 
              onChange={(e) => setMonthFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '4px',
                border: '1px solid #ddd',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              <option value="">All Months</option>
              <option value="01">January</option>
              <option value="02">February</option>
              <option value="03">March</option>
              <option value="04">April</option>
              <option value="05">May</option>
              <option value="06">June</option>
              <option value="07">July</option>
              <option value="08">August</option>
              <option value="09">September</option>
              <option value="10">October</option>
              <option value="11">November</option>
              <option value="12">December</option>
            </select>
          </div>
          
          {reminders.length === 0 ? (
            <p style={{ color: '#666' }}>No pending reminders</p>
          ) : getFilteredReminders(reminders).length === 0 ? (
            <p style={{ color: '#666' }}>No reminders in selected month</p>
          ) : (
            <div style={{ display: 'grid', gap: '10px' }}>
              {getFilteredReminders(reminders).map(reminder => (
                <div 
                  key={reminder.id}
                  style={{
                    padding: '15px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    backgroundColor: reminder.status === 'pending' ? '#fff' : '#f8f9fa'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: '0 0 5px 0', fontWeight: 'bold' }}>
                        {reminder.type === 'AMC_RENEWAL' ? '🔄' : '🔧'} {reminder.customerName}
                      </p>
                      <p style={{ margin: '0 0 8px 0' }}>{reminder.message}</p>
                      <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>
                        📱 {reminder.customerPhone || 'No phone'}
                      </p>
                    </div>
                    {reminder.status === 'pending' && (
                      <div style={{ display: 'flex', gap: '8px', marginLeft: '10px' }}>
                        <button 
                          className="btn" 
                          style={{ width: 'auto', padding: '8px 12px', fontSize: '12px' }}
                          onClick={() => sendReminder(reminder)}
                        >
                          Send
                        </button>
                        <button 
                          className="btn" 
                          style={{ width: 'auto', padding: '8px 12px', fontSize: '12px', backgroundColor: '#6c757d' }}
                          onClick={() => markAsSkipped(reminder.id)}
                        >
                          Skip
                        </button>
                      </div>
                    )}
                    {reminder.status !== 'pending' && (
                      <span style={{ padding: '8px 12px', borderRadius: '4px', backgroundColor: '#d4edda', fontSize: '12px', fontWeight: 'bold' }}>
                        {reminder.status === 'sent' ? '✓ Sent' : 'Skipped'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reviews */}
      {activeTab === 'reviews' && (
        <div className="card">
          <h2>⭐ Review Requests ({reviews.filter(r => r.status === 'pending').length})</h2>
          {reviews.length === 0 ? (
            <p style={{ color: '#666' }}>No pending reviews</p>
          ) : (
            <div style={{ display: 'grid', gap: '10px' }}>
              {reviews.map(review => (
                <div 
                  key={review.id}
                  style={{
                    padding: '15px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    backgroundColor: review.status === 'pending' ? '#fff' : '#f8f9fa'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: '0 0 5px 0', fontWeight: 'bold' }}>{review.customerName}</p>
                      <p style={{ margin: '0 0 8px 0' }}>{review.message}</p>
                      <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>
                        Ticket: {review.ticketId}
                      </p>
                    </div>
                    {review.status === 'pending' && (
                      <button 
                        className="btn" 
                        style={{ width: 'auto', padding: '8px 12px', fontSize: '12px', backgroundColor: '#28a745' }}
                        onClick={() => setSelectedReview(review)}
                      >
                        Request
                      </button>
                    )}
                    {review.status === 'completed' && (
                      <span style={{ padding: '8px 12px', borderRadius: '4px', backgroundColor: '#d4edda', fontSize: '12px', fontWeight: 'bold' }}>
                        ✓ Completed
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Review Modal */}
      {selectedReview && (
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
            padding: '30px',
            borderRadius: '8px',
            maxWidth: '500px',
            width: '90%'
          }}>
            <h2>Request Review from {selectedReview.customerName}</h2>
            <textarea 
              style={{
                width: '100%',
                minHeight: '120px',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontFamily: 'inherit',
                marginBottom: '15px',
                marginTop: '10px'
              }}
              value={reviewMessage}
              onChange={(e) => setReviewMessage(e.target.value)}
              placeholder="Hi, we'd love your feedback! Please rate your experience."
            />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button 
                className="btn" 
                style={{ backgroundColor: '#6c757d' }}
                onClick={() => {
                  setSelectedReview(null);
                  setReviewMessage('');
                }}
              >
                Cancel
              </button>
              <button 
                className="btn" 
                onClick={() => submitReview(selectedReview)}
              >
                Send Review Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Automation */}
      {activeTab === 'automation' && (
        <div className="card">
          <h2>🤖 AI Automation Control</h2>
          
          <div style={{
            padding: '20px',
            backgroundColor: automationRunning ? '#d4edda' : '#f8d7da',
            borderRadius: '8px',
            marginBottom: '20px',
            border: `2px solid ${automationRunning ? '#28a745' : '#dc3545'}`
          }}>
            <p style={{ margin: '0 0 10px 0', fontWeight: 'bold' }}>
              Status: {automationRunning ? '✅ RUNNING' : '❌ STOPPED'}
            </p>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
              {!automationRunning ? (
                <button className="btn" onClick={handleStartAutomation} style={{ backgroundColor: '#28a745' }}>
                  🚀 Start Automation
                </button>
              ) : (
                <button className="btn" onClick={handleStopAutomation} style={{ backgroundColor: '#dc3545' }}>
                  ⏹️ Stop Automation
                </button>
              )}
            </div>
            {automationRunning && automationStats && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '15px' }}>
                <div style={{ padding: '10px', backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: '4px' }}>
                  <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>Tasks Completed</p>
                  <p style={{ margin: '0', fontSize: '20px', fontWeight: 'bold' }}>{automationStats.tasksCompleted}</p>
                </div>
                <div style={{ padding: '10px', backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: '4px' }}>
                  <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>Logs</p>
                  <p style={{ margin: '0', fontSize: '20px', fontWeight: 'bold' }}>{automationStats.logsCount}</p>
                </div>
                <div style={{ padding: '10px', backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: '4px' }}>
                  <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>Last Activity</p>
                  <p style={{ margin: '0', fontSize: '11px', fontWeight: 'bold' }}>
                    {automationStats.lastLog ? new Date(automationStats.lastLog).toLocaleTimeString() : 'N/A'}
                  </p>
                </div>
              </div>
            )}
          </div>

          <h3>Automation Tasks:</h3>
          <ul style={{ fontSize: '14px', color: '#666', lineHeight: '1.8' }}>
            <li>✅ Auto-assign unassigned jobs to available technicians</li>
            <li>✅ Auto-reschedule overdue services</li>
            <li>✅ Auto-send AMC renewal reminders</li>
            <li>✅ Auto-mark completed tickets</li>
            <li>✅ Auto-generate daily reports</li>
            <li>✅ Auto-backup data</li>
          </ul>

          {automationRunning && automationLogs.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <h3>Recent Activity Log:</h3>
              <div style={{
                maxHeight: '300px',
                overflowY: 'auto',
                backgroundColor: '#f8f9fa',
                padding: '15px',
                borderRadius: '6px',
                border: '1px solid #ddd',
                fontSize: '12px',
                fontFamily: 'monospace'
              }}>
                {automationLogs.map((log, index) => (
                  <div key={index} style={{ marginBottom: '8px', color: log.message.includes('✅') ? '#28a745' : log.message.includes('❌') ? '#dc3545' : '#666' }}>
                    [{new Date(log.timestamp).toLocaleTimeString()}] {log.message}
                  </div>
                ))}
              </div>
            </div>
          )}

          {autoBackups.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <h3>💾 Auto-Backup History:</h3>
              <div style={{
                maxHeight: '400px',
                overflowY: 'auto',
                backgroundColor: '#f8f9fa',
                padding: '15px',
                borderRadius: '6px',
                border: '1px solid #ddd'
              }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '12px'
                }}>
                  <thead>
                    <tr style={{ backgroundColor: '#e7f3ff', borderBottom: '2px solid #0066ff' }}>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Date & Time</th>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Items</th>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Size</th>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {autoBackups.map((backup, index) => {
                      const formatSize = (bytes) => {
                        if (bytes === 0) return '0 B';
                        const k = 1024;
                        const sizes = ['B', 'KB', 'MB'];
                        const i = Math.floor(Math.log(bytes) / Math.log(k));
                        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
                      };
                      return (
                        <tr key={index} style={{
                          borderBottom: '1px solid #ddd',
                          backgroundColor: index % 2 === 0 ? '#fafafa' : 'white'
                        }}>
                          <td style={{ padding: '8px' }}>{new Date(backup.timestamp).toLocaleString()}</td>
                          <td style={{ padding: '8px', fontWeight: 'bold', color: '#0066ff' }}>{backup.totalItems}</td>
                          <td style={{ padding: '8px' }}>{formatSize(backup.size)}</td>
                          <td style={{ padding: '8px' }}>
                            <button
                              style={{
                                padding: '4px 8px',
                                fontSize: '11px',
                                backgroundColor: '#0066ff',
                                color: 'white',
                                border: 'none',
                                borderRadius: '3px',
                                cursor: 'pointer'
                              }}
                              onClick={() => {
                                aiAutomationService.downloadAutoBackup(backup.key);
                                alert('✅ Backup downloaded!');
                              }}
                            >
                              Download
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AIAgent;
