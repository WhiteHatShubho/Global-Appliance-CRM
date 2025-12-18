import React, { useState, useEffect } from 'react';
import dataService from '../services/dataService';
import { showLoader, hideLoader } from '../utils/globalLoader';

// Helper function to get local date in YYYY-MM-DD format
const getLocalDate = () => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

const Tickets = () => {
  const [tickets, setTickets] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [assignModalData, setAssignModalData] = useState({ show: false, ticketId: null, selectedTech: '', scheduledDate: '', arrivalTime: '', takePayment: false, paymentAmount: '' });
  const [viewModalData, setViewModalData] = useState({ show: false, ticket: null });
  const [rescheduleModalData, setRescheduleModalData] = useState({ show: false, ticketId: null, newDate: '', newTime: '', reason: '', customReason: '' });
  const [selectedDate, setSelectedDate] = useState(getLocalDate()); // Auto-fill with today's date
  const [activeTab, setActiveTab] = useState('today'); // 'today' or 'pending'
  const [formData, setFormData] = useState({
    customerInput: '',
    customerPhone: '',
    title: '',
    description: '',
    priority: 'medium',
    takePayment: false,
    paymentAmount: '',
    selectedCustomerId: null
  });
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [filteredCustomerList, setFilteredCustomerList] = useState([]);

  // Filter tickets by selected date using unified logic
  const getFilteredTickets = () => {
    return tickets.filter(ticket => {
      // ✅ RULE 4: Only show TICKET or COMPLAINT types (exclude SERVICE)
      const isTicketType = ticket.type === 'TICKET' || ticket.type === 'COMPLAINT' || !ticket.type;
      if (!isTicketType) return false;
      
      // Priority order: reassignedDate > scheduledDate
      const reassignedDate = ticket.reassignedDate ? ticket.reassignedDate : null;
      const scheduledDate = ticket.scheduledDate ? ticket.scheduledDate : null;
      
      if (reassignedDate === selectedDate) return true; // Priority 1: reassignedDate
      if (scheduledDate === selectedDate) return true;   // Priority 2: scheduledDate
      return false; // Ignore createdDate
    });
  };

  // Get pending jobs (unfinished tickets from any date)
  const getPendingJobs = () => {
    return tickets.filter(ticket => {
      // ✅ RULE 4: Only show TICKET or COMPLAINT types (exclude SERVICE)
      const isTicketType = ticket.type === 'TICKET' || ticket.type === 'COMPLAINT' || !ticket.type;
      if (!isTicketType) return false;
      
      const status = ticket.status ? ticket.status.toLowerCase() : '';
      // Include: open, pending, assigned, reassigned
      // Exclude: completed, cancelled
      return status !== 'completed' && status !== 'cancelled';
    });
  };

  // Get tickets to display based on active tab
  const getDisplayedTickets = () => {
    if (activeTab === 'today') {
      return getFilteredTickets();
    } else {
      return getPendingJobs();
    }
  };

  useEffect(() => {
    // Clear cache and load fresh data
    const loadData = async () => {
      setLoading(true);
      try {
        console.log('🔄 Clearing cache and loading fresh data...');
        // Clear the cache explicitly
        if (typeof dataService.cache !== 'undefined') {
          dataService.cache.tickets.data = [];
          dataService.cache.tickets.timestamp = 0;
        }
        
        const loadedTickets = await dataService.getTickets(true); // Force fresh
        const loadedTechnicians = await dataService.getTechnicians(true); // Force fresh
        const loadedCustomers = await dataService.getCustomers(true); // Force fresh
        const activeTechnicians = loadedTechnicians.filter(t => t.status === 'active' || !t.status);
        
        // Verify all tickets have valid IDs
        console.log('Validating ticket data structure...');
        loadedTickets.forEach((t, idx) => {
          if (!t.id) {
            console.error(`❌ Ticket at index ${idx} has no ID:`, t);
          }
        });
        
        setTickets(loadedTickets);
        setTechnicians(activeTechnicians);
        setCustomers(loadedCustomers);
        console.log('✅ Loaded tickets:', loadedTickets.length, 'Loaded active technicians:', activeTechnicians.length);
      } catch (err) {
        console.error('Error loading tickets:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let finalValue = value;
    
    // Auto-add +91 for Indian phone numbers
    if (name === 'customerPhone') {
      // Remove all non-digit characters except +
      const cleanValue = value.replace(/[^0-9+]/g, '');
      
      // If user is typing a number and it doesn't start with +
      if (cleanValue && !cleanValue.startsWith('+')) {
        // Limit to 10 digits only
        const digitsOnly = cleanValue.substring(0, 10);
        
        // If it's a valid Indian number (starts with 6-9), add +91
        if (digitsOnly.length > 0 && /^[6-9]/.test(digitsOnly)) {
          finalValue = '+91' + digitsOnly;
        } else {
          finalValue = digitsOnly;
        }
      } else if (cleanValue.startsWith('+91')) {
        // If already has +91, ensure only 10 digits after +91
        const digitsAfterCode = cleanValue.substring(3).replace(/[^0-9]/g, '').substring(0, 10);
        finalValue = '+91' + digitsAfterCode;
      } else {
        finalValue = cleanValue;
      }
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: finalValue
    }));
    
    // Show autocomplete dropdown for customer input
    if (name === 'customerInput' && value.trim().length > 0) {
      const searchTerm = value.toLowerCase().trim();
      // Also create a search term with +91 prefix if it's a phone number
      const phoneDigits = searchTerm.replace(/[^0-9]/g, '');
      const searchTermWithPrefix = phoneDigits.length <= 10 ? '+91' + phoneDigits : searchTerm;
      
      const matches = customers.filter(customer => {
        const name = (customer.name || customer.fullName || '').toLowerCase();
        const phone = (customer.phone || '').toLowerCase();
        const cardNumber = (customer.cardNumber || '').toLowerCase();
        
        // Match by name, card number, or phone (with or without +91)
        return name.includes(searchTerm) || 
               cardNumber.includes(searchTerm) ||
               phone.includes(searchTerm) ||
               phone.includes(searchTermWithPrefix);
      });
      setFilteredCustomerList(matches);
      setShowCustomerDropdown(matches.length > 0);
    } else if (name === 'customerInput') {
      setShowCustomerDropdown(false);
      setFilteredCustomerList([]);
    }
  };

  const handleCustomerSelect = (customer) => {
    setFormData(prev => ({
      ...prev,
      customerInput: customer.name || customer.fullName || customer.phone,
      customerPhone: customer.phone || '',
      selectedCustomerId: customer.id
    }));
    setShowCustomerDropdown(false);
    setFilteredCustomerList([]);
  };



  // Reload tickets when needed
  const reloadTickets = async () => {
    setLoading(true);
    try {
      showLoader();
      const loadedTickets = await dataService.getTickets(true); // Force refresh
      const loadedTechnicians = await dataService.getTechnicians(true); // Force refresh
      const loadedCustomers = await dataService.getCustomers(true); // Force refresh
      const activeTechnicians = loadedTechnicians.filter(t => t.status === 'active' || !t.status);
      setTickets(loadedTickets);
      setTechnicians(activeTechnicians);
      setCustomers(loadedCustomers);
    } catch (err) {
      console.error('Error reloading tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Prevent duplicate submissions
    if (loading) {
      console.log('Already creating ticket, please wait...');
      return;
    }
    
    setLoading(true);
    showLoader();
    
    let customerId = '';
    let customerName = '';
    let customerPhone = '';
    let isNewCustomer = false;

    // Check if customer was selected from dropdown
    if (formData.selectedCustomerId) {
      const selectedCustomer = customers.find(c => c.id === formData.selectedCustomerId);
      if (selectedCustomer) {
        customerId = selectedCustomer.id;
        customerName = selectedCustomer.name || selectedCustomer.fullName;
        customerPhone = selectedCustomer.phone;
        isNewCustomer = false;
      }
    } else {
      // Check if customer input matches existing customer
      const searchTerm = formData.customerInput.toLowerCase().trim();
      const existingCustomer = customers.find(c => 
        (c.phone && c.phone.toLowerCase() === searchTerm) ||
        (c.name && c.name.toLowerCase().includes(searchTerm)) ||
        (c.fullName && c.fullName.toLowerCase().includes(searchTerm)) ||
        (c.cardNumber && c.cardNumber.toLowerCase() === searchTerm)
      );

      if (existingCustomer) {
        // Customer found in database
        customerId = existingCustomer.id;
        customerName = existingCustomer.name || existingCustomer.fullName;
        customerPhone = existingCustomer.phone;
        isNewCustomer = false;
      } else {
        // New customer - AI auto-detection
        if (!formData.customerInput.trim() || !formData.customerPhone.trim()) {
          alert('⚠️ Please enter customer name and phone number.');
          setLoading(false);
          return;
        }
        
        // Validate phone number is exactly 10 digits (after +91)
        const phoneDigits = formData.customerPhone.replace(/[^0-9]/g, '');
        if (phoneDigits.length !== 12 || !formData.customerPhone.startsWith('+91')) {
          alert('⚠️ Phone number must be exactly 10 digits');
          setLoading(false);
          return;
        }
        
        customerId = `temp-${Date.now()}`; // Temporary ID
        customerName = formData.customerInput.trim();
        customerPhone = formData.customerPhone.trim();
        isNewCustomer = true;
      }
    }
    
    // Validate payment amount if payment is required
    if (formData.takePayment && (!formData.paymentAmount || parseFloat(formData.paymentAmount) <= 0)) {
      alert('⚠️ Please enter a valid payment amount.');
      setLoading(false);
      return;
    }
    
    try {
      // Get local date
      const newTicket = {
        customerId: customerId,
        customerName: customerName,
        customerPhone: customerPhone,
        title: formData.title,
        description: formData.description,
        status: 'open',
        priority: formData.priority,
        assignedTo: 'Unassigned',
        assignedToId: null,
        createdAt: getLocalDate(),
        type: 'TICKET', // ✅ RULE 2: Mark as TICKET type
        takePayment: formData.takePayment,
        paymentAmount: formData.takePayment ? Math.round(parseFloat(formData.paymentAmount) * 100) / 100 : null,
        isNewCustomer: isNewCustomer
      };
      const savedTicket = await dataService.addTicket(newTicket);
      if (savedTicket) {
        setTickets([...tickets, savedTicket]);
        if (isNewCustomer) {
          alert('✅ Complaint created successfully! New customer auto-detected and record added.');
        } else {
          alert('✅ Complaint created successfully!');
        }
      }
      setFormData({ 
        customerInput: '', 
        customerPhone: '',
        title: '', 
        description: '', 
        priority: 'medium', 
        takePayment: false, 
        paymentAmount: '',
        selectedCustomerId: null
      });
      setShowCustomerDropdown(false);
      setFilteredCustomerList([]);
      setShowForm(false);
    } catch (error) {
      console.error('Error creating ticket:', error);
      alert('❌ Failed to create ticket. Please try again.');
    } finally {
      hideLoader();
      setLoading(false);
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'open': return 'status-open';
      case 'assigned': return 'status-assigned';
      case 'completed': return 'status-completed';
      case 'closed': return 'status-closed';
      default: return '';
    }
  };

  const handleAssign = (ticketId) => {
    console.log('\n===== ASSIGN HANDLER CALLED ====');
    console.log('handleAssign clicked with ticketId:', ticketId);
    console.log('Total tickets in state:', tickets.length);
    console.log('All ticket IDs:', tickets.map(t => t.id));
    const ticket = tickets.find(t => t.id === ticketId);
    console.log('Found ticket:', ticket);
    if (!ticket) {
      console.error('❌ Ticket not found for id:', ticketId);
      alert('Ticket not found!');
      return;
    }
    console.log('✅ Opening assign modal for ticket:', ticketId, 'with payment:', ticket?.takePayment);
    // Auto-fill today's date (YYYY-MM-DD format for HTML input)
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayDate = `${year}-${month}-${day}`;
    
    setAssignModalData({ 
      show: true, 
      ticketId, 
      selectedTech: '', 
      scheduledDate: todayDate, // Auto-fill with today's date
      arrivalTime: '', 
      takePayment: ticket?.takePayment || false, 
      paymentAmount: ticket?.paymentAmount || '' 
    });
  };


  const handleView = (ticket) => {
    if (!ticket) {
      console.error('❌ handleView: ticket is null or undefined');
      alert('Error: Ticket data is invalid');
      return;
    }
    console.log('✅ handleView clicked with ticket:', ticket?.id);
    console.log('Opening view modal for ticket:', ticket);
    setViewModalData({ show: true, ticket });
  };

  const handleReschedule = (ticket) => {
    console.log('✅ handleReschedule clicked with ticket:', ticket?.id);
    setRescheduleModalData({
      show: true,
      ticketId: ticket.id,
      newDate: ticket.scheduledDate || '',
      newTime: ticket.scheduledArrivalTime || '',
      reason: '',
      customReason: ''
    });
  };

  const handleDelete = async (ticketId) => {
    console.log('✅ handleDelete clicked with ticketId:', ticketId);
    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket) {
      console.error('❌ Ticket not found for deletion');
      return;
    }

    try {
      showLoader();
      await dataService.deleteTicket(ticketId);
      setTickets(tickets.filter(t => t.id !== ticketId));
      console.log('✅ Ticket deleted successfully:', ticketId);
    } catch (error) {
      console.error('Error deleting ticket:', error);
      alert('❌ Failed to delete complaint. Please try again.');
    } finally {
      hideLoader();
    }
  };

  const confirmReschedule = async () => {
    const { ticketId, newDate, newTime, reason, customReason } = rescheduleModalData;
    
    // Use customReason if "Other" is selected, otherwise use the dropdown value
    const finalReason = reason === 'Other' ? customReason : reason;
    
    if (!newDate || !newTime) {
      alert('Please select both date and time');
      return;
    }

    if (!finalReason.trim()) {
      alert('Please provide a reason for rescheduling');
      return;
    }

    try {
      showLoader();
      const ticket = tickets.find(t => t.id === ticketId);
      
      // Store previous schedule info
      const previousSchedules = ticket.rescheduleHistory || [];
      if (ticket.scheduledDate && ticket.scheduledArrivalTime) {
        previousSchedules.push({
          date: ticket.scheduledDate,
          time: ticket.scheduledArrivalTime,
          reason: ticket.rescheduleReason || 'Initial assignment'
        });
      }

      await dataService.updateTicket(ticketId, {
        scheduledDate: newDate,
        scheduledArrivalTime: newTime,
        rescheduleReason: finalReason,
        rescheduleHistory: previousSchedules,
        rescheduleCount: (ticket.rescheduleCount || 0) + 1,
        lastRescheduleDate: getLocalDate()
      });

      setTickets(tickets.map(t => 
        t.id === ticketId 
          ? { 
              ...t, 
              scheduledDate: newDate, 
              scheduledArrivalTime: newTime, 
              rescheduleReason: finalReason,
              rescheduleHistory: previousSchedules,
              rescheduleCount: (t.rescheduleCount || 0) + 1
            }
          : t
      ));

      alert('✓ Service rescheduled successfully!');
      setRescheduleModalData({ show: false, ticketId: null, newDate: '', newTime: '', reason: '', customReason: '' });
    } catch (error) {
      console.error('Error rescheduling:', error);
      alert('Failed to reschedule service');
    } finally {
      hideLoader();
    }
  };

  const handleConfirmAssign = async () => {
    const { ticketId, selectedTech, scheduledDate, arrivalTime, takePayment, paymentAmount } = assignModalData;
    if (!selectedTech) {
      alert('Please select a technician');
      return;
    }
    if (!scheduledDate) {
      alert('Please select a scheduled date');
      return;
    }
    if (!arrivalTime) {
      alert('Please set the arrival time');
      return;
    }
    if (takePayment && !paymentAmount) {
      alert('Please enter payment amount');
      return;
    }

    // Find technician name
    const selectedTechnician = technicians.find(t => t.id === selectedTech);
    if (!selectedTechnician) {
      alert('Technician not found');
      return;
    }

    // Find the current ticket
    const currentTicket = tickets.find(t => t.id === ticketId);
    if (!currentTicket) {
      alert('Ticket not found');
      return;
    }

    // Update ticket assignment
    const updatedTicket = {
      ...currentTicket,
      assignedTo: selectedTechnician.name,
      assignedToId: selectedTech,
      status: 'assigned',
      assignedAt: getLocalDate(),
      scheduledDate: scheduledDate, // Store the scheduled date
      scheduledArrivalTime: arrivalTime,
      takePayment: takePayment,
      paymentAmount: takePayment ? Math.round(parseFloat(paymentAmount) * 100) / 100 : null
    };

    setTickets(tickets.map(ticket => 
      ticket.id === ticketId ? updatedTicket : ticket
    ));

    // Save to data service
    try {
      showLoader();
      await dataService.updateTicket(ticketId, { 
        assignedTo: selectedTechnician.name, 
        assignedToId: selectedTech,
        status: 'assigned',
        assignedAt: getLocalDate(),
        scheduledDate: scheduledDate, // Save the scheduled date
        scheduledArrivalTime: arrivalTime,
        takePayment: takePayment,
        paymentAmount: takePayment ? Math.round(parseFloat(paymentAmount) * 100) / 100 : null
      });
      console.log('Ticket assigned successfully:', ticketId, selectedTechnician.name);
    } catch (error) {
      console.error('Error assigning ticket:', error);
      alert('Failed to assign ticket. Please try again.');
    } finally {
      hideLoader();
    }

    setAssignModalData({ show: false, ticketId: null, selectedTech: '', scheduledDate: '', arrivalTime: '', takePayment: false, paymentAmount: '' });
  };

  return (
    <div className="content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>Tickets / Complaints</h1>
        <div>
          <button className="btn" style={{ width: 'auto', marginRight: '10px' }} onClick={reloadTickets}>
            Refresh
          </button>
          <button className="btn" style={{ width: 'auto' }} onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : 'Create Ticket'}
          </button>
        </div>
      </div>

      {/* Date Filter Section */}
      <div className="card" style={{ marginBottom: '20px', padding: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <label htmlFor="ticketDateFilter" style={{ fontWeight: 'bold', color: '#001a4d', marginBottom: 0 }}>
            📅 Filter by Date:
          </label>
          <input
            type="date"
            id="ticketDateFilter"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{ padding: '8px 12px', fontSize: '14px', borderRadius: '4px', border: '1px solid #ddd', minWidth: '150px' }}
          />
          <span style={{ fontSize: '12px', color: '#666' }}>
            Showing tickets from {new Date(selectedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
        </div>
      </div>

      {/* Tabs for Today's Tickets and Pending Jobs */}
      <div style={{ marginBottom: '20px', borderBottom: '2px solid #e0e0e0', display: 'flex', gap: '0' }}>
        <button
          onClick={() => setActiveTab('today')}
          style={{
            padding: '12px 24px',
            fontSize: '14px',
            fontWeight: 'bold',
            backgroundColor: activeTab === 'today' ? '#0066ff' : 'transparent',
            color: activeTab === 'today' ? 'white' : '#666',
            border: 'none',
            cursor: 'pointer',
            borderBottom: activeTab === 'today' ? '3px solid #0066ff' : 'none',
            transition: 'all 0.3s ease'
          }}
        >
          📋 Today's Tickets ({getFilteredTickets().length})
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
          ⏳ Pending Jobs ({getPendingJobs().length})
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <h2>Create New Complaint/Ticket</h2>
          <form onSubmit={handleSubmit}>
            {/* Simplified Customer Input with Autocomplete */}
            <div className="form-group" style={{ position: 'relative' }}>
              <label htmlFor="customerInput"><span style={{ color: 'red', fontWeight: 'bold' }}>*</span> Customer Name or Phone:</label>
              <input
                type="text"
                id="customerInput"
                name="customerInput"
                value={formData.customerInput}
                onChange={handleInputChange}
                onFocus={() => {
                  if (formData.customerInput.trim().length > 0 && filteredCustomerList.length > 0) {
                    setShowCustomerDropdown(true);
                  }
                }}
                onBlur={() => {
                  // Delay hiding dropdown to allow click on items
                  setTimeout(() => setShowCustomerDropdown(false), 200);
                }}
                placeholder="Enter customer name, phone, or card number"
                required
                autoComplete="off"
              />
              <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                💡 Start typing to search existing customers or enter new customer details
              </p>
              
              {/* Autocomplete Dropdown */}
              {showCustomerDropdown && filteredCustomerList.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  maxHeight: '200px',
                  overflowY: 'auto',
                  backgroundColor: 'white',
                  border: '2px solid #0066ff',
                  borderRadius: '4px',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                  zIndex: 1000,
                  marginTop: '2px'
                }}>
                  {filteredCustomerList.map(customer => (
                    <div
                      key={customer.id}
                      onClick={() => handleCustomerSelect(customer)}
                      style={{
                        padding: '12px 15px',
                        cursor: 'pointer',
                        borderBottom: '1px solid #e0e0e0',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = '#f0f4ff'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
                    >
                      <div style={{ fontWeight: 'bold', color: '#001a4d', marginBottom: '4px' }}>
                        {customer.name || customer.fullName}
                      </div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        📞 {customer.phone} {customer.cardNumber && `| 🎫 ${customer.cardNumber}`}
                      </div>
                      {customer.address && (
                        <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>
                          📍 {customer.address}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Phone Number Field - Only show if no existing customer found */}
            {!customers.find(c => 
              (c.phone && c.phone.toLowerCase().trim() === formData.customerInput.toLowerCase().trim()) ||
              (c.name && c.name.toLowerCase().includes(formData.customerInput.toLowerCase().trim()))
            ) && formData.customerInput && (
              <div className="form-group" style={{ backgroundColor: '#e3f2fd', padding: '12px', borderRadius: '5px', border: '1px solid #0066ff' }}>
                <label htmlFor="customerPhone"><span style={{ color: 'red', fontWeight: 'bold' }}>*</span> Phone Number (New Customer):</label>
                <input
                  type="tel"
                  id="customerPhone"
                  name="customerPhone"
                  value={formData.customerPhone}
                  onChange={handleInputChange}
                  placeholder="Enter exactly 10 digits (auto adds +91)"
                  required={!customers.find(c => c.phone === formData.customerInput)}
                />
                <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                  📍 New customer - Must be exactly 10 digits. +91 will be added automatically.
                </p>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="title">Title:</label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="description">Description:</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                required
                rows="3"
                style={{ width: '100%' }}
              />
            </div>
            <div className="form-group">
              <label htmlFor="priority">Priority:</label>
              <select
                id="priority"
                name="priority"
                value={formData.priority}
                onChange={handleInputChange}
                required
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div className="form-group" style={{ padding: '15px', backgroundColor: '#f0f4ff', borderRadius: '5px', border: '1px solid #0066ff' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: '10px' }}>
                <input
                  type="checkbox"
                  checked={formData.takePayment || false}
                  onChange={(e) => setFormData({ ...formData, takePayment: e.target.checked, paymentAmount: e.target.checked ? formData.paymentAmount : '' })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <span style={{ fontWeight: 'bold', color: '#001a4d' }}>💰 Collect Payment from Customer</span>
              </label>
              {formData.takePayment && (
                <div>
                  <label htmlFor="paymentAmount" style={{ display: 'block', marginBottom: '8px' }}>Payment Amount (₹):</label>
                  <input
                    type="number"
                    id="paymentAmount"
                    name="paymentAmount"
                    value={formData.paymentAmount}
                    onChange={handleInputChange}
                    placeholder="Enter amount to collect"
                    step="0.01"
                    min="0"
                    style={{ width: '100%', padding: '8px', fontSize: '14px', borderColor: '#0066ff' }}
                  />
                </div>
              )}
            </div>
            <button type="submit" className="btn">Create Complaint/Ticket</button>
          </form>
        </div>
      )}

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
            <h2>Assign Ticket to Technician</h2>
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label htmlFor="technicianSelect">Select Technician:</label>
              {technicians.length === 0 ? (
                <div style={{ color: 'red', padding: '10px', backgroundColor: '#ffebee', borderRadius: '4px' }}>
                  ❌ No active technicians available. Please add technicians first in the Technicians section.
                </div>
              ) : (
                <select
                  id="technicianSelect"
                  value={assignModalData.selectedTech}
                  onChange={(e) => setAssignModalData({ ...assignModalData, selectedTech: e.target.value })}
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
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label htmlFor="scheduledDate">Scheduled Date: <span style={{ fontSize: '12px', color: '#28a745', fontWeight: 'normal' }}>(auto-filled, editable)</span></label>
              <input
                type="date"
                id="scheduledDate"
                value={assignModalData.scheduledDate}
                onChange={(e) => setAssignModalData({ ...assignModalData, scheduledDate: e.target.value })}
                style={{ width: '100%', padding: '8px', fontSize: '14px' }}
              />
              <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>Date when the technician will visit (auto-filled with today's date)</p>
            </div>
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label htmlFor="arrivalTime">Scheduled Arrival Time:</label>
              <input
                type="time"
                id="arrivalTime"
                value={assignModalData.arrivalTime}
                onChange={(e) => setAssignModalData({ ...assignModalData, arrivalTime: e.target.value })}
                style={{ width: '100%', padding: '8px', fontSize: '14px' }}
                required
              />
            </div>
            <div className="form-group" style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f0f4ff', borderRadius: '5px', border: '1px solid #0066ff' }}>
              {assignModalData.takePayment ? (
                <>
                  <div style={{ marginBottom: '10px' }}>
                    <span style={{ fontWeight: 'bold', color: '#001a4d', fontSize: '1rem' }}>💰 Payment Already Set from Complaint</span>
                  </div>
                  <div style={{ padding: '12px', backgroundColor: '#fff3cd', borderRadius: '4px', border: '1px solid #ffc107' }}>
                    <p style={{ margin: '0 0 8px 0', color: '#333' }}><strong>Amount to Collect:</strong> ₹{assignModalData.paymentAmount}</p>
                    <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>✓ This amount was set when creating the complaint. Technician will collect this amount.</p>
                  </div>
                </>
              ) : (
                <>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: '10px' }}>
                    <input
                      type="checkbox"
                      checked={assignModalData.takePayment || false}
                      onChange={(e) => setAssignModalData({ ...assignModalData, takePayment: e.target.checked, paymentAmount: e.target.checked ? assignModalData.paymentAmount : '' })}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <span style={{ fontWeight: 'bold', color: '#001a4d' }}>💰 Take Payment from Customer</span>
                  </label>
                  <p style={{ margin: '5px 0 10px 0', fontSize: '12px', color: '#666' }}>Payment was not set during complaint creation</p>
                  {assignModalData.takePayment && (
                    <div>
                      <label htmlFor="paymentAmount" style={{ display: 'block', marginBottom: '8px' }}>Payment Amount (₹):</label>
                      <input
                        type="number"
                        id="paymentAmount"
                        value={assignModalData.paymentAmount}
                        onChange={(e) => setAssignModalData({ ...assignModalData, paymentAmount: e.target.value })}
                        placeholder="Enter amount"
                        step="0.01"
                        min="0"
                        style={{ width: '100%', padding: '8px', fontSize: '14px', borderColor: '#0066ff' }}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button 
                className="btn" 
                style={{ backgroundColor: '#6c757d' }}
                onClick={() => setAssignModalData({ show: false, ticketId: null, selectedTech: '', scheduledDate: '', arrivalTime: '', takePayment: false, paymentAmount: '' })}
              >
                Cancel
              </button>
              <button 
                className="btn" 
                onClick={handleConfirmAssign}
              >
                Assign
              </button>
            </div>
          </div>
        </div>
      )}

      {viewModalData.show && viewModalData.ticket && (
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
            maxWidth: '500px',
            padding: '20px',
            backgroundColor: 'white',
            borderRadius: '8px',
            maxHeight: '80vh',
            overflowY: 'auto'
          }}>
            <h2>Ticket Details</h2>
            <div style={{ marginBottom: '15px' }}>
              <strong>📋 Ticket Code:</strong> <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#0066ff' }}>{viewModalData.ticket.ticketCode || viewModalData.ticket.id.substring(0, 4)}</span>
            </div>
            <div style={{ marginBottom: '15px' }}>
              <strong>Customer:</strong> {viewModalData.ticket.customerName}
            </div>
            <div style={{ marginBottom: '15px' }}>
              <strong>Title:</strong> {viewModalData.ticket.title}
            </div>
            <div style={{ marginBottom: '15px' }}>
              <strong>Description:</strong> {viewModalData.ticket.description}
            </div>
            <div style={{ marginBottom: '15px' }}>
              <strong>Status:</strong> <span className={`status-badge ${getStatusClass(viewModalData.ticket.status)}`}>{viewModalData.ticket.status}</span>
            </div>
            <div style={{ marginBottom: '15px' }}>
              <strong>Priority:</strong> {viewModalData.ticket.priority}
            </div>
            <div style={{ marginBottom: '15px' }}>
              <strong>Assigned To:</strong> {viewModalData.ticket.assignedTo}
            </div>
            <div style={{ marginBottom: '15px' }}>
              <strong>Scheduled Arrival Time:</strong> {viewModalData.ticket.scheduledArrivalTime || 'Not scheduled'}
            </div>
            <div style={{ marginBottom: '15px' }}>
              <strong>Created:</strong> {viewModalData.ticket.createdAt}
            </div>
            {viewModalData.ticket.takePayment && (
              <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#fff3cd', borderRadius: '4px', border: '1px solid #ffc107' }}>
                <strong>💰 Payment Required:</strong> ₹{viewModalData.ticket.paymentAmount}
              </div>
            )}
            {viewModalData.ticket.rescheduleCount > 0 && (
              <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f0f4ff', borderRadius: '4px', border: '1px solid #0066ff' }}>
                <strong>🔄 Rescheduled {viewModalData.ticket.rescheduleCount} time(s)</strong>
                <p style={{ fontSize: '12px', color: '#666', margin: '5px 0 0 0' }}>Last rescheduled: {viewModalData.ticket.lastRescheduleDate}</p>
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button 
                className="btn" 
                style={{ backgroundColor: '#ff9800' }}
                onClick={() => {
                  setViewModalData({ show: false, ticket: null });
                  handleReschedule(viewModalData.ticket);
                }}
              >
                Reschedule
              </button>
              <button 
                className="btn" 
                style={{ backgroundColor: '#6c757d' }}
                onClick={() => setViewModalData({ show: false, ticket: null })}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {rescheduleModalData.show && (
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
            <h2>🔄 Reschedule Service</h2>
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label htmlFor="rescheduleDate">New Service Date:</label>
              <input
                type="date"
                id="rescheduleDate"
                value={rescheduleModalData.newDate}
                onChange={(e) => setRescheduleModalData({ ...rescheduleModalData, newDate: e.target.value })}
                style={{ width: '100%', padding: '8px', fontSize: '14px' }}
                required
              />
              <p style={{ fontSize: '11px', color: '#666', marginTop: '5px' }}>
                When does the customer want the service? (tomorrow, 3 days, next week, next month, etc.)
              </p>
            </div>
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label htmlFor="rescheduleTime">Arrival Time:</label>
              <input
                type="time"
                id="rescheduleTime"
                value={rescheduleModalData.newTime}
                onChange={(e) => setRescheduleModalData({ ...rescheduleModalData, newTime: e.target.value })}
                style={{ width: '100%', padding: '8px', fontSize: '14px' }}
                required
              />
            </div>
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label htmlFor="rescheduleReason">Reason for Rescheduling:</label>
              <select
                id="rescheduleReason"
                value={rescheduleModalData.reason}
                onChange={(e) => setRescheduleModalData({ ...rescheduleModalData, reason: e.target.value })}
                style={{ width: '100%', padding: '8px', fontSize: '14px' }}
              >
                <option value="">-- Select reason --</option>
                <option value="Customer not available at home">Customer not available at home</option>
                <option value="Customer requested delay">Customer requested delay</option>
                <option value="Waiting for parts">Waiting for parts</option>
                <option value="Customer said come tomorrow">Customer said come tomorrow</option>
                <option value="Customer said come in 3 days">Customer said come in 3 days</option>
                <option value="Customer said come next week">Customer said come next week</option>
                <option value="Customer said come next month">Customer said come next month</option>
                <option value="Technician unavailable">Technician unavailable</option>
                <option value="Other">Other</option>
              </select>
            </div>
            {rescheduleModalData.reason === 'Other' && (
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label htmlFor="customReason">What did customer say? (Please write the exact reason):</label>
                <textarea
                  id="customReason"
                  value={rescheduleModalData.customReason}
                  onChange={(e) => setRescheduleModalData({ ...rescheduleModalData, customReason: e.target.value })}
                  placeholder="Write exactly what the customer told you (e.g., 'Customer said water is leaking from AC, needs urgent repair')..."
                  style={{
                    width: '100%',
                    height: '80px',
                    padding: '8px',
                    fontSize: '13px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    boxSizing: 'border-box',
                    fontFamily: 'Arial'
                  }}
                />
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button 
                className="btn" 
                style={{ backgroundColor: '#6c757d' }}
                onClick={() => setRescheduleModalData({ show: false, ticketId: null, newDate: '', newTime: '', reason: '' })}
              >
                Cancel
              </button>
              <button 
                className="btn" 
                style={{ backgroundColor: '#ff9800' }}
                onClick={confirmReschedule}
              >
                Confirm Reschedule
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Ticket Code</th>
              <th>Customer</th>
              <th>Title</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Assigned To</th>
              <th>{activeTab === 'today' ? 'Created' : 'Created/Scheduled'}</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {getDisplayedTickets().length > 0 ? (
              getDisplayedTickets().map(ticket => (
                <tr key={ticket.id}>
                  <td><span style={{ fontSize: '1rem', fontWeight: 'bold', color: '#0066ff' }}>{ticket.ticketCode || ticket.id.substring(0, 4)}</span></td>
                  <td>{ticket.customerName}</td>
                  <td>{ticket.title}</td>
                  <td><span className={`status-badge ${getStatusClass(ticket.status)}`}>{ticket.status}</span></td>
                  <td>{ticket.priority}</td>
                  <td>{ticket.assignedTo}</td>
                  <td>{activeTab === 'today' ? ticket.createdAt : (ticket.scheduledDate || ticket.createdAt)}</td>
                  <td style={{ position: 'relative' }}>
                    <button
                      className="btn"
                      style={{
                        width: 'auto',
                        padding: '5px 10px',
                        backgroundColor: '#667eea',
                        fontSize: '12px'
                      }}
                      onClick={(e) => {
                        console.log('🖱️ Actions button clicked for ticket:', ticket.id);
                        const buttonRect = e.currentTarget.getBoundingClientRect();
                        console.log('Button position:', { top: buttonRect.bottom, left: buttonRect.left, right: buttonRect.right });
                        
                        if (openDropdownId === ticket.id) {
                          setOpenDropdownId(null);
                        } else {
                          setOpenDropdownId(ticket.id);
                          setDropdownPosition({
                            top: buttonRect.bottom + window.scrollY + 5,
                            left: buttonRect.left + window.scrollX - 100 // Adjust for dropdown width
                          });
                        }
                      }}
                    >
                      ⋮ Actions
                    </button>
                    {openDropdownId === ticket.id && (
                      <div style={{
                        position: 'fixed',
                        top: dropdownPosition.top,
                        left: dropdownPosition.left,
                        backgroundColor: 'white',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                        zIndex: 1000,
                        minWidth: '180px',
                        pointerEvents: 'auto'
                      }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            console.log('👁️ View button clicked');
                            handleView(ticket);
                            setOpenDropdownId(null);
                          }}
                          style={{
                            display: 'block',
                            width: '100%',
                            padding: '10px 15px',
                            textAlign: 'left',
                            border: 'none',
                            backgroundColor: 'transparent',
                            cursor: 'pointer',
                            fontSize: '12px',
                            borderBottom: '1px solid #eee'
                          }}
                          onMouseEnter={(e) => e.target.style.backgroundColor = '#f5f5f5'}
                          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                        >
                          👁️ View Ticket
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            console.log('👤 Assign button clicked');
                            handleAssign(ticket.id);
                            setOpenDropdownId(null);
                          }}
                          style={{
                            display: 'block',
                            width: '100%',
                            padding: '10px 15px',
                            textAlign: 'left',
                            border: 'none',
                            backgroundColor: 'transparent',
                            cursor: 'pointer',
                            fontSize: '12px',
                            borderBottom: '1px solid #eee'
                          }}
                          onMouseEnter={(e) => e.target.style.backgroundColor = '#f5f5f5'}
                          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                        >
                          👤 Assign / Reassign
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            console.log('🔄 Reschedule button clicked');
                            handleReschedule(ticket);
                            setOpenDropdownId(null);
                          }}
                          style={{
                            display: 'block',
                            width: '100%',
                            padding: '10px 15px',
                            textAlign: 'left',
                            border: 'none',
                            backgroundColor: 'transparent',
                            cursor: 'pointer',
                            fontSize: '12px',
                            borderBottom: '1px solid #eee'
                          }}
                          onMouseEnter={(e) => e.target.style.backgroundColor = '#f5f5f5'}
                          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                        >
                          🔄 Reschedule
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            console.log('🗑️ Delete button clicked');
                            handleDelete(ticket.id);
                            setOpenDropdownId(null);
                          }}
                          style={{
                            display: 'block',
                            width: '100%',
                            padding: '10px 15px',
                            textAlign: 'left',
                            border: 'none',
                            backgroundColor: 'transparent',
                            cursor: 'pointer',
                            fontSize: '12px',
                            color: '#dc3545'
                          }}
                          onMouseEnter={(e) => e.target.style.backgroundColor = '#ffe0e0'}
                          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                        >
                          🗑️ Delete Ticket
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                  {activeTab === 'today' ? (
                    `No tickets found for ${new Date(selectedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`
                  ) : (
                    'No pending jobs. All tickets are completed or cancelled!'
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Tickets;