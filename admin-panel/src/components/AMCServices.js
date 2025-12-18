import React, { useState, useEffect } from 'react';
import dataService from '../services/dataService';
import amcReminderService from '../services/amcReminderService';

const AMCServices = () => {
  const [amcServices, setAmcServices] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('upcoming'); // 'upcoming', 'overdue', 'completed'
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
  });
  const [selectedService, setSelectedService] = useState(null);
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [monthFilter, setMonthFilter] = useState(() => {
    // Auto-select current month
    const today = new Date();
    return String(today.getMonth() + 1).padStart(2, '0');
  }); // Filter by month (01-12)
  const [addressFilter, setAddressFilter] = useState(''); // Filter by address search

  useEffect(() => {
    loadAMCServices();
  }, []);

  const loadAMCServices = async () => {
    setLoading(true);
    try {
      // Get all tickets/services
      const allTickets = await dataService.getTickets();
      
      // Filter for AMC-generated services only
      const amcServicesList = allTickets.filter(ticket => 
        ticket.amcGenerated === true && ticket.type === 'SERVICE'
      );
      
      console.log('📋 Loaded AMC Services:', amcServicesList.length);
      setAmcServices(amcServicesList);

      // Load technicians
      const techs = await dataService.getTechnicians();
      setTechnicians(techs);
    } catch (err) {
      console.error('Error loading AMC services:', err);
      setError('Failed to load AMC services: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Apply filters to services
  const applyFilters = (services) => {
    return services.filter(service => {
      // Month filter
      if (monthFilter) {
        const schedDate = service.scheduledDate || service.serviceDate;
        const serviceMonth = schedDate ? schedDate.substring(5, 7) : '';
        if (serviceMonth !== monthFilter) return false;
      }
      
      // Address filter
      if (addressFilter) {
        const address = (service.customerAddress || '').toLowerCase();
        if (!address.includes(addressFilter.toLowerCase())) return false;
      }
      
      return true;
    });
  };

  // Get upcoming AMC services (scheduled for future or today, not overdue)
  const getUpcomingServices = () => {
    const today = new Date().toISOString().split('T')[0];
    const filtered = amcServices.filter(service => {
      if (service.status === 'completed' || service.status === 'archived') return false;
      const scheduledDate = service.scheduledDate || service.serviceDate;
      return scheduledDate >= today;
    }).sort((a, b) => {
      const dateA = a.scheduledDate || a.serviceDate;
      const dateB = b.scheduledDate || b.serviceDate;
      return new Date(dateA) - new Date(dateB);
    });
    return applyFilters(filtered);
  };

  // Get overdue AMC services
  const getOverdueServices = () => {
    const today = new Date().toISOString().split('T')[0];
    const filtered = amcServices.filter(service => {
      if (service.status === 'completed' || service.status === 'archived') return false;
      const scheduledDate = service.scheduledDate || service.serviceDate;
      return scheduledDate < today;
    }).sort((a, b) => {
      const dateA = a.scheduledDate || a.serviceDate;
      const dateB = b.scheduledDate || b.serviceDate;
      return new Date(dateA) - new Date(dateB);
    });
    return applyFilters(filtered);
  };

  // Get completed AMC services
  const getCompletedServices = () => {
    const filtered = amcServices.filter(service => 
      service.status === 'completed'
    ).sort((a, b) => {
      const dateA = a.completedAt || a.scheduledDate;
      const dateB = b.completedAt || b.scheduledDate;
      return new Date(dateB) - new Date(dateA); // Newest first
    });
    return applyFilters(filtered);
  };

  const handleViewService = (service) => {
    setSelectedService(service);
    setOpenDropdownId(null);
  };

  const handleAssignService = async (service) => {
    // TODO: Implement assign/reassign modal
    setOpenDropdownId(null);
    alert('Assign/Reassign functionality - to be implemented');
  };

  const handleRescheduleService = async (service) => {
    // TODO: Implement reschedule modal
    setOpenDropdownId(null);
    alert('Reschedule functionality - to be implemented');
  };

  const handleMarkComplete = async (serviceId) => {
    try {
      setLoading(true);
      
      // Get the service details
      const allTickets = await dataService.getTickets();
      const service = allTickets.find(t => t.id === serviceId);
      
      if (!service) {
        throw new Error('Service not found');
      }

      // Mark service as completed
      const completionDate = new Date().toISOString();
      await dataService.updateTicket(serviceId, {
        status: 'completed',
        completedAt: completionDate
      });

      // Update customer's AMC data with new lastServiceDate and nextServiceDate
      const customer = await dataService.getCustomer(service.customerId);
      if (customer && customer.amc) {
        const completionDateStr = completionDate.split('T')[0]; // YYYY-MM-DD
        
        // Process the service completion using AMC reminder service
        const updatedAMC = amcReminderService.processServiceCompletion(
          customer.amc,
          completionDateStr
        );

        // Check if AMC should be deactivated
        const finalAMC = amcReminderService.checkAndDeactivateAMC(updatedAMC, completionDateStr);

        // Update customer with new AMC data
        await dataService.updateCustomer(service.customerId, {
          amc: finalAMC
        });

        console.log('✅ Customer AMC updated:', finalAMC);
      }

      setSuccess('✅ Service marked as completed!');
      await loadAMCServices();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error marking service complete:', err);
      setError('Failed to mark service as complete: ' + err.message);
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
      setOpenDropdownId(null);
    }
  };

  const getDaysInfo = (service) => {
    const today = new Date();
    const scheduledDate = new Date(service.scheduledDate || service.serviceDate);
    const diffTime = scheduledDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return { text: `${Math.abs(diffDays)} days overdue`, color: '#dc3545' };
    } else if (diffDays === 0) {
      return { text: 'Due Today', color: '#ffc107' };
    } else if (diffDays <= 7) {
      return { text: `Due in ${diffDays} days`, color: '#17a2b8' };
    } else {
      return { text: `Due in ${diffDays} days`, color: '#28a745' };
    }
  };

  const renderServiceTable = (services, showDaysInfo = true) => {
    if (services.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          <p>No AMC services found in this category</p>
        </div>
      );
    }

    return (
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Phone</th>
              <th>Service Type</th>
              <th>Scheduled Date</th>
              {showDaysInfo && <th>Status</th>}
              <th>Assigned To</th>
              <th>Segment</th>
              {activeTab === 'completed' && <th>Completed At</th>}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {services.map(service => {
              const daysInfo = getDaysInfo(service);
              return (
                <tr key={service.id}>
                  <td><strong>{service.customerName}</strong></td>
                  <td>{service.customerPhone}</td>
                  <td>
                    <span style={{
                      backgroundColor: '#667eea',
                      color: 'white',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 'bold'
                    }}>
                      {service.serviceType || 'AMC Service'}
                    </span>
                  </td>
                  <td>{service.scheduledDate || service.serviceDate}</td>
                  {showDaysInfo && (
                    <td>
                      <span style={{
                        backgroundColor: daysInfo.color,
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 'bold'
                      }}>
                        {daysInfo.text}
                      </span>
                    </td>
                  )}
                  <td>
                    <span style={{
                      backgroundColor: service.assignedTo ? '#17a2b8' : '#999',
                      color: 'white',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '11px'
                    }}>
                      {service.assignedTo || 'Unassigned'}
                    </span>
                  </td>
                  <td>
                    <span style={{
                      backgroundColor: service.segment === 'waterpurifier' ? '#2196f3' : service.segment === 'chimney' ? '#ff9800' : '#9c27b0',
                      color: 'white',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      textTransform: 'capitalize'
                    }}>
                      {service.segment || 'N/A'}
                    </span>
                  </td>
                  {activeTab === 'completed' && (
                    <td>{service.completedAt ? new Date(service.completedAt).toLocaleDateString('en-GB') : 'N/A'}</td>
                  )}
                  <td style={{ position: 'relative' }}>
                    <button
                      className="btn"
                      style={{
                        width: 'auto',
                        padding: '5px 10px',
                        backgroundColor: '#667eea',
                        fontSize: '12px'
                      }}
                      onClick={() => setOpenDropdownId(openDropdownId === service.id ? null : service.id)}
                    >
                      ⋮ Actions
                    </button>
                    {openDropdownId === service.id && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        right: 0,
                        backgroundColor: 'white',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                        zIndex: 100,
                        minWidth: '180px',
                        marginTop: '5px'
                      }}>
                        <button
                          onClick={() => handleViewService(service)}
                          style={{
                            display: 'block',
                            width: '100%',
                            padding: '10px 15px',
                            textAlign: 'left',
                            border: 'none',
                            background: 'white',
                            cursor: 'pointer',
                            fontSize: '13px',
                            borderBottom: '1px solid #f0f0f0'
                          }}
                          onMouseEnter={(e) => e.target.style.backgroundColor = '#f5f5f5'}
                          onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
                        >
                          👁️ View Details
                        </button>
                        <button
                          onClick={() => handleAssignService(service)}
                          style={{
                            display: 'block',
                            width: '100%',
                            padding: '10px 15px',
                            textAlign: 'left',
                            border: 'none',
                            background: 'white',
                            cursor: 'pointer',
                            fontSize: '13px',
                            borderBottom: '1px solid #f0f0f0'
                          }}
                          onMouseEnter={(e) => e.target.style.backgroundColor = '#f5f5f5'}
                          onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
                        >
                          👤 {service.assignedTo ? 'Reassign' : 'Assign'}
                        </button>
                        <button
                          onClick={() => handleRescheduleService(service)}
                          style={{
                            display: 'block',
                            width: '100%',
                            padding: '10px 15px',
                            textAlign: 'left',
                            border: 'none',
                            background: 'white',
                            cursor: 'pointer',
                            fontSize: '13px',
                            borderBottom: '1px solid #f0f0f0'
                          }}
                          onMouseEnter={(e) => e.target.style.backgroundColor = '#f5f5f5'}
                          onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
                        >
                          🔄 Reschedule
                        </button>
                        {activeTab !== 'completed' && (
                          <button
                            onClick={() => handleMarkComplete(service.id)}
                            style={{
                              display: 'block',
                              width: '100%',
                              padding: '10px 15px',
                              textAlign: 'left',
                              border: 'none',
                              background: 'white',
                              cursor: 'pointer',
                              fontSize: '13px'
                            }}
                            onMouseEnter={(e) => e.target.style.backgroundColor = '#e8f5e9'}
                            onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
                          >
                            ✅ Mark Complete
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>🔵 AMC Services & Reminders</h1>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {success && <div style={{ color: 'green', marginRight: '10px' }}>✓ {success}</div>}
          {error && <div style={{ color: 'red', marginRight: '10px' }}>✗ {error}</div>}
          <button className="btn" style={{ width: 'auto' }} onClick={loadAMCServices} disabled={loading}>
            {loading ? 'Loading...' : '🔄 Refresh'}
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div style={{
        backgroundColor: '#e3f2fd',
        border: '1px solid #2196f3',
        borderRadius: '8px',
        padding: '15px',
        marginBottom: '20px'
      }}>
        <p style={{ margin: 0, fontSize: '14px', color: '#1976d2' }}>
          <strong>ℹ️ About AMC Services:</strong> This tab shows ONLY auto-generated AMC services (4 quarterly services per customer). 
          Manual service assignments appear in the "Services & Maintenance" tab.
        </p>
      </div>

      {/* Filters Section */}
      <div style={{
        backgroundColor: 'white',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        padding: '15px',
        marginBottom: '20px',
        display: 'flex',
        gap: '15px',
        alignItems: 'center',
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label htmlFor="monthFilter" style={{ fontWeight: 'bold', fontSize: '14px', color: '#333', minWidth: '50px' }}>
            📅 Month:
          </label>
          <select
            id="monthFilter"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              fontSize: '14px',
              borderRadius: '4px',
              border: '1px solid #ddd',
              minWidth: '150px',
              cursor: 'pointer'
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
          <label htmlFor="addressFilter" style={{ fontWeight: 'bold', fontSize: '14px', color: '#333', minWidth: '70px' }}>
            📍 Address:
          </label>
          <input
            type="text"
            id="addressFilter"
            value={addressFilter}
            onChange={(e) => setAddressFilter(e.target.value)}
            placeholder="Search by address..."
            style={{
              padding: '8px 12px',
              fontSize: '14px',
              borderRadius: '4px',
              border: '1px solid #ddd',
              flex: 1,
              minWidth: '200px'
            }}
          />
        </div>

        {(monthFilter || addressFilter) && (
          <button
            className="btn"
            style={{
              backgroundColor: '#6c757d',
              padding: '8px 16px',
              fontSize: '13px',
              width: 'auto'
            }}
            onClick={() => {
              setMonthFilter('');
              setAddressFilter('');
            }}
          >
            ✕ Clear Filters
          </button>
        )}
      </div>

      {/* Tabs for Upcoming, Overdue, Completed */}
      <div style={{ marginBottom: '20px', borderBottom: '2px solid #e0e0e0', display: 'flex', gap: '0' }}>
        <button
          onClick={() => setActiveTab('upcoming')}
          style={{
            padding: '12px 24px',
            fontSize: '14px',
            fontWeight: 'bold',
            backgroundColor: activeTab === 'upcoming' ? '#667eea' : 'transparent',
            color: activeTab === 'upcoming' ? 'white' : '#666',
            border: 'none',
            cursor: 'pointer',
            borderBottom: activeTab === 'upcoming' ? '3px solid #667eea' : 'none',
            transition: 'all 0.3s ease'
          }}
        >
          📅 Upcoming ({getUpcomingServices().length})
        </button>
        <button
          onClick={() => setActiveTab('overdue')}
          style={{
            padding: '12px 24px',
            fontSize: '14px',
            fontWeight: 'bold',
            backgroundColor: activeTab === 'overdue' ? '#dc3545' : 'transparent',
            color: activeTab === 'overdue' ? 'white' : '#666',
            border: 'none',
            cursor: 'pointer',
            borderBottom: activeTab === 'overdue' ? '3px solid #dc3545' : 'none',
            transition: 'all 0.3s ease'
          }}
        >
          ⚠️ Overdue ({getOverdueServices().length})
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          style={{
            padding: '12px 24px',
            fontSize: '14px',
            fontWeight: 'bold',
            backgroundColor: activeTab === 'completed' ? '#28a745' : 'transparent',
            color: activeTab === 'completed' ? 'white' : '#666',
            border: 'none',
            cursor: 'pointer',
            borderBottom: activeTab === 'completed' ? '3px solid #28a745' : 'none',
            transition: 'all 0.3s ease'
          }}
        >
          ✅ Completed ({getCompletedServices().length})
        </button>
      </div>

      {/* Content based on active tab */}
      {activeTab === 'upcoming' && renderServiceTable(getUpcomingServices())}
      {activeTab === 'overdue' && renderServiceTable(getOverdueServices())}
      {activeTab === 'completed' && renderServiceTable(getCompletedServices(), false)}

      {/* Service Detail Modal */}
      {selectedService && (
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
            padding: '20px',
            backgroundColor: 'white',
            borderRadius: '8px',
            maxHeight: '80vh',
            overflowY: 'auto'
          }}>
            <h2 style={{ marginBottom: '20px' }}>AMC Service Details</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
              <div>
                <p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '11px' }}>CUSTOMER NAME</p>
                <p style={{ margin: '0 0 15px 0', fontSize: '13px', fontWeight: 'bold' }}>{selectedService.customerName}</p>
              </div>
              <div>
                <p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '11px' }}>PHONE</p>
                <p style={{ margin: '0 0 15px 0', fontSize: '13px', fontWeight: 'bold' }}>{selectedService.customerPhone}</p>
              </div>
              <div>
                <p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '11px' }}>SERVICE TYPE</p>
                <p style={{ margin: '0 0 15px 0', fontSize: '13px', fontWeight: 'bold' }}>{selectedService.serviceType}</p>
              </div>
              <div>
                <p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '11px' }}>AMC SERVICE NUMBER</p>
                <p style={{ margin: '0 0 15px 0', fontSize: '13px', fontWeight: 'bold' }}>{selectedService.amcServiceNumber || 'N/A'} of 4</p>
              </div>
              <div>
                <p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '11px' }}>SCHEDULED DATE</p>
                <p style={{ margin: '0 0 15px 0', fontSize: '13px', fontWeight: 'bold', color: '#667eea' }}>
                  {selectedService.scheduledDate || selectedService.serviceDate}
                </p>
              </div>
              <div>
                <p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '11px' }}>ORIGINAL DUE DATE</p>
                <p style={{ margin: '0 0 15px 0', fontSize: '13px' }}>
                  {selectedService.amcOriginalDate || 'N/A'}
                </p>
              </div>
              <div>
                <p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '11px' }}>ASSIGNED TO</p>
                <p style={{ margin: '0 0 15px 0', fontSize: '13px', fontWeight: 'bold' }}>
                  {selectedService.assignedTo || 'Unassigned'}
                </p>
              </div>
              <div>
                <p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '11px' }}>STATUS</p>
                <p style={{ margin: '0 0 15px 0', fontSize: '13px', fontWeight: 'bold', textTransform: 'capitalize' }}>
                  {selectedService.status}
                </p>
              </div>
            </div>

            <div style={{ marginBottom: '20px', borderTop: '2px solid #e0e0e0', paddingTop: '15px' }}>
              <p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '12px' }}>ADDRESS</p>
              <p style={{ margin: '0 0 15px 0', fontSize: '14px' }}>{selectedService.customerAddress || 'N/A'}</p>
            </div>

            <div style={{ marginBottom: '20px', borderTop: '2px solid #e0e0e0', paddingTop: '15px' }}>
              <p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '12px' }}>DESCRIPTION</p>
              <p style={{ margin: '0 0 15px 0', fontSize: '14px', lineHeight: '1.6' }}>
                {selectedService.description || 'No description available'}
              </p>
            </div>

            {/* AMC Service History */}
            {selectedService.amcGenerated && (
              <div style={{ marginBottom: '20px', borderTop: '2px solid #e0e0e0', paddingTop: '15px' }}>
                <p style={{ margin: '0 0 10px 0', color: '#666', fontSize: '12px', fontWeight: 'bold' }}>AMC SERVICE HISTORY</p>
                {selectedService.amcServiceCompleted && (
                  <div style={{
                    backgroundColor: '#e8f5e9',
                    border: '1px solid #4caf50',
                    borderRadius: '6px',
                    padding: '10px',
                    marginBottom: '10px',
                    fontSize: '13px'
                  }}>
                    <p style={{ margin: '0 0 5px 0', color: '#2e7d32', fontWeight: 'bold' }}>✅ Completed via Ticket</p>
                    <p style={{ margin: '0 0 3px 0', color: '#558b2f', fontSize: '12px' }}>
                      <strong>Date:</strong> {selectedService.amcServiceCompletedAt ? new Date(selectedService.amcServiceCompletedAt).toLocaleDateString('en-GB') : 'N/A'}
                    </p>
                    <p style={{ margin: '0', color: '#558b2f', fontSize: '12px' }}>
                      <strong>Ticket ID:</strong> {selectedService.id}
                    </p>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '2px solid #e0e0e0', paddingTop: '15px' }}>
              <button
                className="btn"
                style={{ backgroundColor: '#6c757d', width: 'auto' }}
                onClick={() => setSelectedService(null)}
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

export default AMCServices;
