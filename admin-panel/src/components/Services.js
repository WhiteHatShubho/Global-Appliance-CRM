import React, { useState, useEffect } from 'react';
import dataService from '../services/dataService';
import { showLoader, hideLoader } from '../utils/globalLoader';

const Services = () => {
  const [todayServices, setTodayServices] = useState([]);
  const [completedServices, setCompletedServices] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [assignModalData, setAssignModalData] = useState({ show: false, serviceId: null, customerName: '' });
  const [selectedTech, setSelectedTech] = useState('');
  const [activeTab, setActiveTab] = useState('todays'); // 'todays', 'pending'
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
  });
  const [selectedServiceDetail, setSelectedServiceDetail] = useState(null);

  // Filter services by selected date using unified logic
  const getFilteredServices = () => {
    return todayServices.filter(service => {
      // Priority order: reassignedDate > scheduledDate
      const reassignedDate = service.reassignedDate || null;
      const scheduledDate = service.serviceDate || null;
      
      if (reassignedDate === selectedDate) return true; // Priority 1: reassignedDate
      if (scheduledDate === selectedDate) return true;   // Priority 2: scheduledDate (serviceDate)
      return false; // Ignore createdDate
    });
  };

  // Get pending services (unfinished services from any date)
  const getPendingServices = () => {
    return todayServices.filter(service => {
      const status = service.status ? service.status.toLowerCase() : '';
      return status !== 'completed';
    });
  };

  useEffect(() => {
    loadServices();
  }, [selectedDate]);

  const loadServices = async () => {
    setLoading(true);
    try {
      showLoader();
      // ✅ RULE 3: Fetch only records with type == 'SERVICE'
      // Get all tickets and filter for SERVICE type (assigned from Customers panel)
      const allTickets = await dataService.getTickets();
      const serviceTickets = allTickets.filter(ticket => ticket.type === 'SERVICE');
      
      // Get all customers for AMC-based services
      const customers = await dataService.getCustomers();
      
      // Combine both sources: SERVICE type tickets + AMC-based services
      // Filter customers with AMC and today is service date
      const today = new Date().toISOString().split('T')[0];
      const servicesForToday = [];
      const allCompleted = [];
      const todayCompleted = [];

      // 1. Add SERVICE type tickets to the list
      serviceTickets.forEach(ticket => {
        const reassignedDate = ticket.reassignedDate || null;
        const scheduledDate = ticket.scheduledDate || null;
        const dateToUse = reassignedDate || scheduledDate;
        const daysOverdue = dateToUse ? Math.floor((new Date(today) - new Date(dateToUse)) / (1000 * 60 * 60 * 24)) : -1;
        
        const serviceObj = {
          id: ticket.id,
          ticketCode: ticket.ticketCode || ticket.id.substring(0, 4),
          customerId: ticket.customerId,
          customerName: ticket.customerName,
          phone: ticket.customerPhone,
          address: ticket.customerAddress || '',
          email: '',
          serviceDate: scheduledDate || today,
          reassignedDate: reassignedDate,
          daysOverdue: daysOverdue,
          amcAmount: 0,
          description: ticket.description || ticket.title,
          status: ticket.status || 'pending',
          assignedTo: ticket.assignedTo || 'Unassigned',
          completed: ticket.status === 'completed',
          completedDate: ticket.completedAt || null,
          notes: ticket.notes || '',
          type: 'SERVICE'
        };
        
        if (ticket.status !== 'completed') {
          servicesForToday.push(serviceObj);
        } else if (serviceObj.completed) {
          allCompleted.push(serviceObj);
          if (serviceObj.completedDate && serviceObj.completedDate.split('T')[0] === today) {
            todayCompleted.push(serviceObj);
          }
        }
      });

      // 2. Add AMC-based services
      customers.forEach(customer => {
        if (customer.amc && customer.amc.nextServiceDate) {
          // Check if next service date is today or overdue
          const serviceDate = customer.amc.nextServiceDate;
          const daysOverdue = Math.floor((new Date(today) - new Date(serviceDate)) / (1000 * 60 * 60 * 24));
          
          const serviceObj = {
            id: customer.id,
            customerId: customer.id,
            customerName: customer.name,
            phone: customer.phone,
            address: customer.address,
            email: customer.email || '',
            serviceDate: serviceDate,
            reassignedDate: customer.reassignedDate || null,
            daysOverdue: daysOverdue,
            amcAmount: customer.amc.amount,
            description: customer.amc.description,
            status: daysOverdue === 0 ? 'Assigned' : 'overdue',
            assignedTo: customer.assignedTech || 'Unassigned',
            completed: customer.completed || false,
            completedDate: customer.completedDate || null,
            notes: customer.notes || '',
            type: 'SERVICE'
          };
          
          if (daysOverdue >= 0 && !serviceObj.completed) {
            // Service is due today or overdue and NOT completed
            servicesForToday.push(serviceObj);
          }
          
          // Track completed services (separate from due services)
          if (serviceObj.completed) {
            allCompleted.push(serviceObj);
            if (serviceObj.completedDate && serviceObj.completedDate === today) {
              todayCompleted.push(serviceObj);
            }
          }
        }
      });

      setTodayServices(servicesForToday);
      setCompletedServices(allCompleted);

      // Load technicians
      const techs = await dataService.getTechnicians();
      setTechnicians(techs);
    } catch (err) {
      setError('Failed to load services: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignService = (serviceId, customerName) => {
    setAssignModalData({ show: true, serviceId, customerName });
    setSelectedTech('');
  };

  const handleConfirmAssign = async () => {
    if (!selectedTech) {
      alert('Please select a technician');
      return;
    }

    try {
      showLoader();
      const selectedTechnician = technicians.find(t => t.id === selectedTech);
      if (!selectedTechnician) return;

      // Update service assignment
      setTodayServices(todayServices.map(service => 
        service.id === assignModalData.serviceId
          ? { ...service, assignedTo: selectedTechnician.name, assignedToId: selectedTech }
          : service
      ));

      // Save to data service (update customer)
      const customer = todayServices.find(s => s.id === assignModalData.serviceId);
      if (customer) {
        const updatedCustomer = {
          id: customer.id,
          name: customer.customerName,
          phone: customer.phone,
          address: customer.address,
          email: '',
          amc: {
            nextServiceDate: customer.serviceDate,
            startDate: customer.serviceDate,
            endDate: customer.serviceDate,
            amount: customer.amcAmount,
            description: customer.description
          },
          assignedTech: selectedTechnician.name,
          assignedToId: selectedTech
        };
        await dataService.updateCustomer(updatedCustomer);
      }

      setSuccess('Service assigned successfully!');
      setAssignModalData({ show: false, serviceId: null, customerName: '' });
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to assign service: ' + err.message);
    } finally {
      hideLoader();
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'today':
        return '#28a745';
      case 'overdue':
        return '#dc3545';
      default:
        return '#007bff';
    }
  };

  const renderTodaysServices = () => {
    const displayedServices = getFilteredServices();
    return (
      <>
        {displayedServices.length === 0 && !loading && (
          <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
            <p style={{ fontSize: '16px', color: '#666' }}>✓ No services scheduled for {new Date(selectedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
          </div>
        )}

        <div className="table-container">
          {displayedServices.length > 0 && (
            <table>
              <thead>
                <tr>
                  <th>Service Code</th>
                  <th>Customer</th>
                  <th>Phone</th>
                  <th>Address</th>
                  <th>Service Date</th>
                  <th>Status</th>
                  <th>AMC Amount</th>
                  <th>Service Description</th>
                  <th>Assigned To</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedServices.map(service => (
                  <tr key={service.id}>
                    <td><span style={{ fontWeight: 'bold', color: '#0066ff' }}>{service.ticketCode}</span></td>
                    <td><strong>{service.customerName}</strong></td>
                    <td>{service.phone}</td>
                    <td>{service.address}</td>
                    <td>{service.serviceDate}</td>
                    <td>
                      <span style={{
                        backgroundColor: getStatusColor(service.status),
                        color: 'white',
                        padding: '5px 10px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}>
                        {service.status === 'today' ? '✓ Today' : `⚠ ${service.daysOverdue} days overdue`}
                      </span>
                    </td>
                    <td style={{ fontWeight: 'bold', color: '#007bff' }}>₹{service.amcAmount}</td>
                    <td style={{ fontSize: '12px', maxWidth: '200px' }}>{service.description}</td>
                    <td>
                      <span style={{
                        backgroundColor: service.assignedTo === 'Unassigned' ? '#999' : '#17a2b8',
                        color: 'white',
                        padding: '5px 10px',
                        borderRadius: '4px',
                        fontSize: '11px'
                      }}>
                        {service.assignedTo}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn"
                        style={{
                          width: 'auto',
                          padding: '5px 10px',
                          backgroundColor: '#007bff',
                          fontSize: '12px'
                        }}
                        onClick={() => handleAssignService(service.id, service.customerName)}
                      >
                        {service.assignedTo === 'Unassigned' ? 'Assign' : 'Reassign'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </>
    );
  };

  const renderPendingServices = () => {
    const displayedServices = getPendingServices();
    return (
      <>
        {displayedServices.length === 0 && !loading && (
          <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
            <p style={{ fontSize: '16px', color: '#666' }}>✓ No pending services. All services are completed!</p>
          </div>
        )}

        <div className="table-container">
          {displayedServices.length > 0 && (
            <table>
              <thead>
                <tr>
                  <th>Service Code</th>
                  <th>Customer</th>
                  <th>Phone</th>
                  <th>Address</th>
                  <th>Service Date</th>
                  <th>Status</th>
                  <th>AMC Amount</th>
                  <th>Service Description</th>
                  <th>Assigned To</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedServices.map(service => (
                  <tr key={service.id}>
                    <td><span style={{ fontWeight: 'bold', color: '#0066ff' }}>{service.ticketCode}</span></td>
                    <td><strong>{service.customerName}</strong></td>
                    <td>{service.phone}</td>
                    <td>{service.address}</td>
                    <td>{service.serviceDate}</td>
                    <td>
                      <span style={{
                        backgroundColor: getStatusColor(service.status),
                        color: 'white',
                        padding: '5px 10px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}>
                        {service.status === 'today' ? '✓ Today' : `⚠ ${service.daysOverdue} days overdue`}
                      </span>
                    </td>
                    <td style={{ fontWeight: 'bold', color: '#007bff' }}>₹{service.amcAmount}</td>
                    <td style={{ fontSize: '12px', maxWidth: '200px' }}>{service.description}</td>
                    <td>
                      <span style={{
                        backgroundColor: service.assignedTo === 'Unassigned' ? '#999' : '#17a2b8',
                        color: 'white',
                        padding: '5px 10px',
                        borderRadius: '4px',
                        fontSize: '11px'
                      }}>
                        {service.assignedTo}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn"
                        style={{
                          width: 'auto',
                          padding: '5px 10px',
                          backgroundColor: '#007bff',
                          fontSize: '12px'
                        }}
                        onClick={() => handleAssignService(service.id, service.customerName)}
                      >
                        {service.assignedTo === 'Unassigned' ? 'Assign' : 'Reassign'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </>
    );
  };

  return (
    <div className="content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>Services Management</h1>
        <div>
          {success && <div style={{ color: 'green', marginRight: '10px' }}>✓ {success}</div>}
          {error && <div style={{ color: 'red', marginRight: '10px' }}>✗ {error}</div>}
          <button className="btn" style={{ width: 'auto' }} onClick={loadServices} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Date Filter Section */}
      <div className="card" style={{ marginBottom: '20px', padding: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <label htmlFor="serviceDateFilter" style={{ fontWeight: 'bold', color: '#001a4d', marginBottom: 0 }}>
            📅 Filter by Date:
          </label>
          <input
            type="date"
            id="serviceDateFilter"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{ padding: '8px 12px', fontSize: '14px', borderRadius: '4px', border: '1px solid #ddd', minWidth: '150px' }}
          />
          <span style={{ fontSize: '12px', color: '#666' }}>
            Showing services from {new Date(selectedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
        </div>
      </div>

      {/* Tabs for Today's Services and Pending Services */}
      <div style={{ marginBottom: '20px', borderBottom: '2px solid #e0e0e0', display: 'flex', gap: '0' }}>
        <button
          onClick={() => setActiveTab('todays')}
          style={{
            padding: '12px 24px',
            fontSize: '14px',
            fontWeight: 'bold',
            backgroundColor: activeTab === 'todays' ? '#0066ff' : 'transparent',
            color: activeTab === 'todays' ? 'white' : '#666',
            border: 'none',
            cursor: 'pointer',
            borderBottom: activeTab === 'todays' ? '3px solid #0066ff' : 'none',
            transition: 'all 0.3s ease'
          }}
        >
          📋 Today's Services ({getFilteredServices().length})
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          style={{
            padding: '12px 24px',
            fontSize: '14px',
            fontWeight: 'bold',
            backgroundColor: activeTab === 'pending' ? '#0066ff' : 'transparent',
            color: activeTab === 'pending' ? 'white' : '#666',
            border: 'none',
            cursor: 'pointer',
            borderBottom: activeTab === 'pending' ? '3px solid #0066ff' : 'none',
            transition: 'all 0.3s ease'
          }}
        >
          ⏳ Pending Services ({getPendingServices().length})
        </button>
      </div>

      {/* Content based on active tab */}
      {activeTab === 'todays' && renderTodaysServices()}
      {activeTab === 'pending' && renderPendingServices()}

      {assignModalData.show && (
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
            maxWidth: '400px',
            padding: '20px',
            backgroundColor: 'white',
            borderRadius: '8px'
          }}>
            <h2>Assign Service</h2>
            <p style={{ marginBottom: '15px' }}><strong>Customer:</strong> {assignModalData.customerName}</p>
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label htmlFor="technicianSelect">Select Technician:</label>
              {technicians.length === 0 ? (
                <p style={{ color: 'red' }}>No technicians available</p>
              ) : (
                <select
                  id="technicianSelect"
                  value={selectedTech}
                  onChange={(e) => setSelectedTech(e.target.value)}
                  style={{ width: '100%', padding: '8px', fontSize: '14px' }}
                >
                  <option value="">-- Choose a technician --</option>
                  {technicians.map(tech => (
                    <option key={tech.id} value={tech.id}>
                      {tech.name} ({tech.phone})
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                className="btn"
                style={{ backgroundColor: '#6c757d' }}
                onClick={() => setAssignModalData({ show: false, serviceId: null, customerName: '' })}
              >
                Cancel
              </button>
              <button
                className="btn"
                onClick={handleConfirmAssign}
              >
                Assign Service
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Service Details Modal */}
      {selectedServiceDetail && (
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
            padding: '30px',
            backgroundColor: 'white',
            borderRadius: '8px',
            maxHeight: '80vh',
            overflowY: 'auto'
          }}>
            <h2 style={{ marginBottom: '20px', borderBottom: '2px solid #e0e0e0', paddingBottom: '10px' }}>Service Details</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <div>
                <p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '11px' }}>CUSTOMER NAME</p>
                <p style={{ margin: '0 0 15px 0', fontSize: '13px', fontWeight: 'bold' }}>{selectedServiceDetail.customerName}</p>
              </div>
              <div>
                <p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '11px' }}>PHONE</p>
                <p style={{ margin: '0 0 15px 0', fontSize: '13px', fontWeight: 'bold' }}>{selectedServiceDetail.phone}</p>
              </div>
              <div>
                <p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '11px' }}>EMAIL</p>
                <p style={{ margin: '0 0 15px 0', fontSize: '13px' }}>{selectedServiceDetail.email || 'N/A'}</p>
              </div>
              <div>
                <p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '11px' }}>ADDRESS</p>
                <p style={{ margin: '0 0 15px 0', fontSize: '13px' }}>{selectedServiceDetail.address}</p>
              </div>
              <div>
                <p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '11px' }}>SERVICE DATE</p>
                <p style={{ margin: '0 0 15px 0', fontSize: '13px', fontWeight: 'bold' }}>{selectedServiceDetail.serviceDate}</p>
              </div>
              <div>
                <p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '11px' }}>COMPLETED DATE</p>
                <p style={{ margin: '0 0 15px 0', fontSize: '13px', fontWeight: 'bold', color: '#28a745' }}>{selectedServiceDetail.completedDate}</p>
              </div>
              <div>
                <p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '11px' }}>AMC AMOUNT</p>
                <p style={{ margin: '0 0 15px 0', fontSize: '13px', fontWeight: 'bold', color: '#007bff' }}>₹{selectedServiceDetail.amcAmount}</p>
              </div>
              <div>
                <p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '11px' }}>ASSIGNED TO</p>
                <p style={{ margin: '0 0 15px 0', fontSize: '13px', fontWeight: 'bold' }}>{selectedServiceDetail.assignedTo}</p>
              </div>
            </div>

            <div style={{ marginBottom: '20px', borderTop: '2px solid #e0e0e0', paddingTop: '15px' }}>
              <p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '12px' }}>SERVICE DESCRIPTION</p>
              <p style={{ margin: '0 0 15px 0', fontSize: '14px', lineHeight: '1.6' }}>{selectedServiceDetail.description}</p>
            </div>

            {selectedServiceDetail.notes && (
              <div style={{ marginBottom: '20px', borderTop: '2px solid #e0e0e0', paddingTop: '15px' }}>
                <p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '12px' }}>NOTES</p>
                <p style={{ margin: '0 0 15px 0', fontSize: '14px', lineHeight: '1.6' }}>{selectedServiceDetail.notes}</p>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '2px solid #e0e0e0', paddingTop: '15px' }}>
              <button
                className="btn"
                style={{ backgroundColor: '#6c757d', width: 'auto' }}
                onClick={() => setSelectedServiceDetail(null)}
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

export default Services;
