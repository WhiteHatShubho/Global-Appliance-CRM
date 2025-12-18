import React, { useState, useEffect } from 'react';
import dataService from '../services/dataService';
import googleContactsService from '../services/googleContactsService';
import rentPaymentService from '../services/rentPaymentService';
import amcRenewalService from '../services/amcRenewalService';
import technicianScheduleService from '../services/technicianScheduleService';
import * as XLSX from 'xlsx';
import { getDatabase, ref, push, set } from 'firebase/database';
import { showLoader, hideLoader } from '../utils/globalLoader';

// Helper function to get local date in DD/MM/YYYY format
const getLocalDate = () => {
  const d = new Date();
  return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
};

const Customers = () => {
  const [editingId, setEditingId] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [amcFilter, setAmcFilter] = useState('all'); // all, active, inactive, expiring
  const [searchQuery, setSearchQuery] = useState('');
  const [monthFilter, setMonthFilter] = useState(''); // Filter by AMC start month (01-12)
  const [segmentFilter, setSegmentFilter] = useState(''); // Filter by segment (waterpurifier, chimney, rent)
  const [expandedRows, setExpandedRows] = useState({}); // Track which customer rows are expanded
  const [customerAmcServices, setCustomerAmcServices] = useState({}); // Store AMC services by customer ID
  const [amcRenewalModal, setAmcRenewalModal] = useState({
    show: false,
    customer: null,
    selectedTech: '',
    scheduledDate: '',
    scheduledTime: ''
  });
  const [callLogModal, setCallLogModal] = useState({
    show: false,
    customer: null,
    callLogs: [],
    newLog: {
      callStatus: '',
      notes: '',
      nextFollowUpDate: '',
      nextFollowUpTime: ''
    }
  });
  const [followUpReminders, setFollowUpReminders] = useState([]);
  const [complaintModal, setComplaintModal] = useState({
    show: false,
    customer: null,
    title: '',
    description: '',
    priority: 'medium',
    selectedTech: '',
    scheduledDate: '', // Auto-fill with today's date
    scheduledTime: '', // Auto-fill with +30 min
    takePayment: false,
    paymentAmount: ''
  });
  const [serviceAssignModal, setServiceAssignModal] = useState({
    show: false,
    customer: null,
    selectedTech: '',
    serviceType: '',
    scheduledDate: '',
    scheduledTime: '',
    endTime: '', // Auto-calculated
    description: '',
    conflictWarning: null, // Conflict detection
    showConflictConfirm: false // Override confirmation
  });
  const [amcRenewalDataModal, setAmcRenewalDataModal] = useState({
    show: false,
    customer: null,
    newAmcStartDate: '',
    newAmcAmount: '',
    newAmcPaidAmount: '',
    duration: '12'
  });
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    segment: 'waterpurifier', // 'waterpurifier', 'chimney', 'rent'
    machineName: '',
    purchaseDate: '',
    customerType: 'AMC', // 'AMC' or 'NON_AMC'
    // Water Purifier & Chimney - AMC fields
    amcStartDate: '',
    amcEndDate: '',
    amcAmount: '',
    amcPaidAmount: '',
    // Water Purifier & Chimney - Non-AMC fields
    filterChangeDate: '',
    filterChangeAmount: '',
    // Rent Water Purifier fields
    rentStartDate: '',
    monthlyRent: '',
    dailyUsageLimit: '50',
    paymentStatus: 'pending', // 'pending', 'partial', 'paid'
    lastPaidMonth: null,
    nextDueMonth: null,
    paidHistory: [],
    // Common fields
    cardNumber: '',
    address: '',
    mapCode: '',
  });

  useEffect(() => {
    // Load customers from cache first (instant)
    const loadCustomers = async () => {
      setLoading(true);
      try {
        showLoader();
        const loadedCustomers = await dataService.getCustomers(false); // Use cache
        const loadedTechnicians = await dataService.getTechnicians(false); // Load technicians
        const todayFollowUps = await dataService.getTodayFollowUps(); // Load today's follow-ups
        
        // Debug: Log customer segments
        console.log('📊 Total customers loaded:', loadedCustomers.length);
        const segmentCounts = loadedCustomers.reduce((acc, c) => {
          const seg = c.segment || 'undefined';
          acc[seg] = (acc[seg] || 0) + 1;
          return acc;
        }, {});
        console.log('📊 Customers by segment:', segmentCounts);
        
        setCustomers(loadedCustomers);
        setTechnicians(loadedTechnicians.filter(t => t.status === 'active' || !t.status));
        setFollowUpReminders(todayFollowUps);
      } catch (err) {
        console.error('Error loading customers:', err);
        setError('Failed to load customers');
      } finally {
        hideLoader();
        setLoading(false);
      }
    };
    loadCustomers();
  }, []);

  // Fetch AMC services for a specific customer
  const fetchCustomerAmcServices = async (customerId) => {
    try {
      const db = getDatabase();
      const servicesRef = ref(db, 'services');
      const { get } = await import('firebase/database');
      const snapshot = await get(servicesRef);
      
      if (!snapshot.exists()) return [];

      const allServices = snapshot.val();
      const customerServices = [];

      for (const serviceId in allServices) {
        const service = allServices[serviceId];
        if (service.customerId === customerId && service.amcGenerated === true) {
          customerServices.push({ ...service, id: serviceId });
        }
      }

      // Sort by service number
      customerServices.sort((a, b) => (a.amcServiceNumber || 0) - (b.amcServiceNumber || 0));
      
      return customerServices;
    } catch (error) {
      console.error('Error fetching customer AMC services:', error);
      return [];
    }
  };

  // Load AMC services when row is expanded
  const handleRowExpand = async (customerId, isCurrentlyExpanded) => {
    const newState = { ...expandedRows };
    newState[customerId] = !isCurrentlyExpanded;
    setExpandedRows(newState);

    // If expanding and customer has AMC, load their services
    if (!isCurrentlyExpanded) {
      const services = await fetchCustomerAmcServices(customerId);
      setCustomerAmcServices(prev => ({ ...prev, [customerId]: services }));
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let finalValue = value;
    
    // Auto-add +91 for Indian phone numbers
    if (name === 'phone') {
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
    
    setFormData(prev => {
      const updated = {
        ...prev,
        [name]: finalValue
      };
      
      // Auto-calculate AMC End Date based on duration for AMC customers
      if (name === 'amcStartDate' && updated.customerType === 'AMC' && finalValue) {
        const startDate = new Date(finalValue);
        const endDate = new Date(startDate);
        endDate.setFullYear(endDate.getFullYear() + 1);
        
        // Format to YYYY-MM-DD
        const year = endDate.getFullYear();
        const month = String(endDate.getMonth() + 1).padStart(2, '0');
        const day = String(endDate.getDate()).padStart(2, '0');
        updated.amcEndDate = `${year}-${month}-${day}`;
        
        console.log(`📅 Auto-calculated AMC End Date: ${updated.amcEndDate} (1 year from ${finalValue})`);
      }
      
      return updated;
    });
  };

  // Generate formatted text based on segment and customer type
  const generateFormattedText = (fullName, address, segment, customerType, amcStartDate, amcEndDate, amcAmount, filterChangeDate, filterChangeAmount, rentStartDate, monthlyRent, cardNumber) => {
    if (!fullName || !cardNumber) return '';

    const nameParts = fullName.trim().split(' ');
    const lastName = nameParts[nameParts.length - 1];
    const firstName = nameParts.slice(0, -1).join(' ') || nameParts[0];
    const cleanAddress = (address || '').trim();

    let prefix = 'RO'; // Default for Water Purifier
    if (segment === 'chimney') prefix = 'CH';
    if (segment === 'rent') prefix = 'RentRo';

    // Rent Water Purifier (no AMC option)
    if (segment === 'rent') {
      if (!rentStartDate || !monthlyRent) return '';
      const monthNumber = rentStartDate.substring(5, 7);
      return `${prefix}${monthNumber} ${lastName} ${firstName} ${cleanAddress} Rent-${monthlyRent}/- ${lastName} ${cardNumber}`;
    }

    // Water Purifier & Chimney - AMC
    if (customerType === 'AMC') {
      if (!amcStartDate || !amcAmount) return '';
      const monthNumber = amcStartDate.substring(5, 7);
      const year = amcStartDate.substring(0, 4);
      const endYear = amcEndDate ? amcEndDate.substring(0, 4) : year;
      return `${prefix}${monthNumber}${lastName} ${firstName} ${cleanAddress}${amcStartDate}-${endYear} AMC-${amcAmount}/- ${lastName} ${cardNumber}`;
    }

    // Water Purifier & Chimney - Non-AMC
    if (customerType === 'NON_AMC' && (filterChangeDate || rentStartDate)) {
      const dateToUse = filterChangeDate || rentStartDate;
      const monthNumber = dateToUse.substring(5, 7);
      const amountToUse = filterChangeAmount || monthlyRent;
      return `${prefix}${monthNumber} ${lastName} ${firstName} ${cleanAddress} ${dateToUse} - ${amountToUse}/- ${lastName} ${cardNumber}`;
    }

    return '';
  };

  // Auto-generate 4 quarterly AMC services (3, 6, 9, 12 months from start date)
  const generateAMCServices = async (customer, customerId) => {
    // Only generate for AMC customers in Water Purifier or Chimney segments
    if (customer.customerType !== 'AMC' || customer.segment === 'rent') {
      console.log('❌ Skipping service generation - not AMC or is Rent segment');
      return;
    }

    if (!customer.amcStartDate) {
      console.log('❌ Skipping service generation - no AMC start date');
      return;
    }

    try {
      const db = getDatabase();
      const servicesRef = ref(db, 'services');
      const startDate = new Date(customer.amcStartDate);
      const serviceIntervals = [3, 6, 9, 12]; // months
      const serviceTypes = ['1st Service', '2nd Service', '3rd Service', '4th Service (Renewal)'];

      console.log('🛠️ Generating 4 AMC services for customer:', customer.fullName);

      for (let i = 0; i < serviceIntervals.length; i++) {
        const serviceDate = new Date(startDate);
        serviceDate.setMonth(serviceDate.getMonth() + serviceIntervals[i]);
        
        const serviceDateString = serviceDate.getFullYear() + '-' + 
          String(serviceDate.getMonth() + 1).padStart(2, '0') + '-' + 
          String(serviceDate.getDate()).padStart(2, '0');

        const newServiceRef = push(servicesRef);
        const serviceData = {
          customerName: customer.fullName,
          customerId: customerId,
          customerPhone: customer.phone,
          customerAddress: customer.address || '',
          segment: customer.segment,
          serviceType: serviceTypes[i],
          status: 'pending',
          scheduledDate: serviceDateString,
          createdAt: new Date().toISOString(),
          description: `Automatic ${serviceTypes[i]} - AMC scheduled service`,
          amcGenerated: true, // Mark as auto-generated
          type: 'SERVICE', // Mark as SERVICE type to appear in Services tab only
          amcServiceNumber: i + 1, // Track which service in sequence (1-4)
          amcCycleMonth: serviceIntervals[i], // Track original scheduled month offset
          amcOriginalDate: serviceDateString // Store original scheduled date
        };

        await set(newServiceRef, serviceData);
        console.log(`✅ Created service ${i + 1}/4: ${serviceTypes[i]} on ${serviceDateString}`);
      }

      console.log('✅ All 4 AMC services generated successfully');
    } catch (error) {
      console.error('❌ Error generating AMC services:', error);
      // Don't throw - log and continue
    }
  };

  const handleEditCustomer = (customer) => {
    setFormData({
      fullName: customer.fullName || customer.name || '',
      phone: customer.phone || '',
      segment: customer.segment || 'waterpurifier',
      machineName: customer.machineName || '',
      purchaseDate: customer.purchaseDate || '',
      customerType: customer.customerType || 'AMC',
      amcStartDate: customer.amcStartDate || '',
      amcEndDate: customer.amcEndDate || '',
      amcAmount: customer.amcAmount || '',
      amcPaidAmount: customer.amcPaidAmount || '',
      filterChangeDate: customer.filterChangeDate || '',
      filterChangeAmount: customer.filterChangeAmount || '',
      rentStartDate: customer.rentStartDate || '',
      monthlyRent: customer.monthlyRent || '',
      dailyUsageLimit: customer.dailyUsageLimit || '50',
      paymentStatus: customer.paymentStatus || 'pending',
      lastPaidMonth: customer.lastPaidMonth || null,
      nextDueMonth: customer.nextDueMonth || null,
      paidHistory: customer.paidHistory || [],
      cardNumber: customer.cardNumber || '',
      address: customer.address || '',
      mapCode: customer.mapCode || ''
    });
    setEditingId(customer.id);
    setShowForm(true);
  };

  const handleAddCustomer = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    
    // Validate phone number is exactly 10 digits (after +91)
    const phoneDigits = formData.phone.replace(/[^0-9]/g, '');
    if (phoneDigits.length !== 12 || !formData.phone.startsWith('+91')) {
      setError('⚠️ Phone number must be exactly 10 digits');
      setLoading(false);
      return;
    }
    
    // Check if customer with same phone already exists (prevent duplicates)
    const existingCustomer = customers.find(c => c.phone === formData.phone);
    if (existingCustomer) {
      setError('⚠️ Customer with this phone number already exists! Phone: ' + formData.phone);
      setLoading(false);
      return;
    }
    
    try {
      const formattedTextValue = generateFormattedText(formData.fullName, formData.address, formData.segment, formData.customerType, formData.amcStartDate, formData.amcEndDate, formData.amcAmount, formData.filterChangeDate, formData.filterChangeAmount, formData.rentStartDate, formData.monthlyRent, formData.cardNumber);
      
      const customerData = {
        fullName: formData.fullName,
        name: formData.fullName,
        phone: formData.phone,
        segment: formData.segment,
        machineName: formData.machineName,
        purchaseDate: formData.purchaseDate,
        customerType: formData.customerType,
        amcStartDate: formData.amcStartDate,
        amcEndDate: formData.amcEndDate,
        amcAmount: formData.amcAmount,
        amcPaidAmount: formData.amcPaidAmount || 0,
        filterChangeDate: formData.filterChangeDate || '',
        filterChangeAmount: formData.filterChangeAmount || '',
        rentStartDate: formData.rentStartDate || '',
        monthlyRent: formData.monthlyRent || '',
        dailyUsageLimit: formData.dailyUsageLimit || '50',
        paymentStatus: formData.paymentStatus || 'pending',
        paidHistory: formData.segment === 'rent' ? [] : undefined,
        lastPaidMonth: formData.segment === 'rent' ? null : undefined,
        nextDueMonth: formData.segment === 'rent' && formData.rentStartDate ? rentPaymentService.getMonthForDate(formData.rentStartDate) : undefined,
        cardNumber: formData.cardNumber,
        address: formData.address,
        mapCode: formData.mapCode,
        formattedText: formattedTextValue,
        email: '',
        // Initialize AMC structure for AMC customers
        amc: formData.customerType === 'AMC' && formData.amcStartDate && formData.amcEndDate ? {
          startDate: formData.amcStartDate,
          endDate: formData.amcEndDate,
          intervalMonths: 3,
          totalServices: 4,
          servicesCompleted: 0,
          lastServiceDate: null,
          nextServiceDate: null,
          isActive: true
        } : undefined
      };
      
      const newCustomer = await dataService.addCustomer(customerData);
      if (newCustomer) {
        // Auto-generate AMC services if applicable
        if (customerData.customerType === 'AMC' && customerData.segment !== 'rent' && customerData.amcStartDate) {
          console.log('🔄 Triggering AMC service auto-generation...');
          await generateAMCServices(customerData, newCustomer.id);
        }

        // Sync to Google Contacts
        try {
          const customerToSync = { ...customerData, id: newCustomer.id };
          const syncResult = await googleContactsService.syncCustomerToGoogle(customerToSync);
          console.log('✅ Customer synced to Google Contacts');
          
          // If we got a resourceName, store it in the database
          if (syncResult && syncResult.resourceName) {
            console.log('💾 Storing Google Contact ID:', syncResult.resourceName);
            await dataService.updateCustomer(newCustomer.id, {
              googleContactId: syncResult.resourceName
            });
          }
        } catch (googleError) {
          console.error('Warning: Could not sync to Google Contacts:', googleError);
          // Don't fail the operation if Google Contacts sync fails
        }
        
        // Reload from dataService cache with force refresh to ensure consistency
        const allCustomers = await dataService.getCustomers(true);
        setCustomers(allCustomers);
        setSuccess('✅ Customer added successfully!');
        setFormData({
          fullName: '',
          phone: '',
          segment: 'waterpurifier',
          machineName: '',
          purchaseDate: '',
          customerType: 'AMC',
          amcStartDate: '',
          amcEndDate: '',
          amcAmount: '',
          amcPaidAmount: '',
          filterChangeDate: '',
          filterChangeAmount: '',
          rentStartDate: '',
          monthlyRent: '',
          dailyUsageLimit: '50',
          paymentStatus: 'pending',
          lastPaidMonth: null,
          nextDueMonth: null,
          paidHistory: [],
          cardNumber: '',
          address: '',
          mapCode: ''
        });
        setShowForm(false);
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError('Failed to add customer. Please try again.');
      }
    } catch (err) {
      console.error('Error adding customer:', err);
      setError('Error adding customer: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCustomer = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    
    // Validate phone number is exactly 10 digits (after +91)
    const phoneDigits = formData.phone.replace(/[^0-9]/g, '');
    if (phoneDigits.length !== 12 || !formData.phone.startsWith('+91')) {
      setError('⚠️ Phone number must be exactly 10 digits');
      setLoading(false);
      return;
    }
    
    try {
      const formattedTextValue = generateFormattedText(formData.fullName, formData.address, formData.segment, formData.customerType, formData.amcStartDate, formData.amcEndDate, formData.amcAmount, formData.filterChangeDate, formData.filterChangeAmount, formData.rentStartDate, formData.monthlyRent, formData.cardNumber);
      
      const customerData = {
        fullName: formData.fullName,
        name: formData.fullName,
        phone: formData.phone,
        segment: formData.segment,
        machineName: formData.machineName,
        purchaseDate: formData.purchaseDate,
        customerType: formData.customerType,
        amcStartDate: formData.amcStartDate,
        amcEndDate: formData.amcEndDate,
        amcAmount: formData.amcAmount,
        amcPaidAmount: formData.amcPaidAmount || 0,
        filterChangeDate: formData.filterChangeDate || '',
        filterChangeAmount: formData.filterChangeAmount || '',
        rentStartDate: formData.rentStartDate || '',
        monthlyRent: formData.monthlyRent || '',
        dailyUsageLimit: formData.dailyUsageLimit || '50',
        paymentStatus: formData.paymentStatus || 'pending',
        paidHistory: formData.paidHistory || [],
        lastPaidMonth: formData.lastPaidMonth || null,
        nextDueMonth: formData.nextDueMonth || null,
        cardNumber: formData.cardNumber,
        address: formData.address,
        mapCode: formData.mapCode,
        formattedText: formattedTextValue,
        email: ''
      };
      
      const updatedCustomer = await dataService.updateCustomer(editingId, customerData);
      if (updatedCustomer) {
        // Sync to Google Contacts
        try {
          // Get the existing googleContactId if available
          const existingCustomer = customers.find(c => c.id === editingId);
          const customerToSync = { 
            ...customerData, 
            id: editingId,
            googleContactId: existingCustomer?.googleContactId
          };
          const syncResult = await googleContactsService.syncCustomerToGoogle(customerToSync);
          console.log('✅ Customer synced to Google Contacts');
          
          // If we got a resourceName and it's different, update it
          if (syncResult && syncResult.resourceName && syncResult.resourceName !== existingCustomer?.googleContactId) {
            console.log('💾 Updating Google Contact ID:', syncResult.resourceName);
            await dataService.updateCustomer(editingId, {
              googleContactId: syncResult.resourceName
            });
          }
        } catch (googleError) {
          console.error('Warning: Could not sync to Google Contacts:', googleError);
          // Don't fail the operation if Google Contacts sync fails
        }
        
        setCustomers(customers.map(c => c.id === editingId ? { ...c, ...customerData, id: editingId } : c));
        setSuccess('✅ Customer updated successfully!');
        setFormData({
          fullName: '',
          phone: '',
          segment: 'waterpurifier',
          machineName: '',
          purchaseDate: '',
          customerType: 'AMC',
          amcStartDate: '',
          amcEndDate: '',
          amcAmount: '',
          amcPaidAmount: '',
          filterChangeDate: '',
          filterChangeAmount: '',
          rentStartDate: '',
          monthlyRent: '',
          dailyUsageLimit: '50',
          paymentStatus: 'pending',
          lastPaidMonth: null,
          nextDueMonth: null,
          paidHistory: [],
          cardNumber: '',
          address: '',
          mapCode: ''
        });
        setShowForm(false);
        setEditingId(null);
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError('Failed to update customer. Please try again.');
      }
    } catch (err) {
      console.error('Error updating customer:', err);
      setError('Error updating customer: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    if (editingId) {
      await handleUpdateCustomer(e);
    } else {
      await handleAddCustomer(e);
    }
  };

  const reloadCustomers = async () => {
    setLoading(true);
    const loadedCustomers = await dataService.getCustomers(); // Use cache for faster loading
    setCustomers(loadedCustomers);
    setLoading(false);
  };

  const handleDeleteCustomer = async (id) => {
    if (window.confirm('Are you sure you want to delete this customer? This action cannot be undone.')) {
      try {
        setLoading(true);
        
        // Find customer to get phone number for Google Contacts deletion
        const customerToDelete = customers.find(c => c.id === id);
        
        // Delete from Google Contacts first
        if (customerToDelete && (customerToDelete.googleContactId || customerToDelete.phone)) {
          try {
            console.log('🔍 Deleting from Google Contacts...');
            await googleContactsService.deleteCustomerFromGoogle(
              customerToDelete.phone, 
              customerToDelete.googleContactId
            );
            console.log('✅ Deleted from Google Contacts');
          } catch (googleError) {
            console.error('Warning: Could not delete from Google Contacts:', googleError);
            // Don't fail - continue with local deletion
          }
        }
        
        // Delete from Firebase
        await dataService.deleteCustomer(id);
        setCustomers(customers.filter(customer => customer.id !== id));
        setSuccess('✅ Customer deleted successfully!');
        setTimeout(() => setSuccess(''), 3000);
      } catch (err) {
        console.error('Error deleting customer:', err);
        setError('Failed to delete customer. Please try again.');
        setTimeout(() => setError(''), 3000);
      } finally {
        setLoading(false);
      }
    }
  };

  // Export to vCard (.vcf)
  const exportToVCard = () => {
    const filteredCustomers = getFilteredCustomers();
    
    if (filteredCustomers.length === 0) {
      alert('No customers to export');
      return;
    }

    let vcardData = '';
    
    filteredCustomers.forEach(customer => {
      vcardData += 'BEGIN:VCARD\n';
      vcardData += 'VERSION:3.0\n';
      vcardData += `FN:${customer.fullName || customer.name || 'Unknown'}\n`;
      vcardData += `TEL;TYPE=CELL:${customer.phone || ''}\n`;
      vcardData += `NOTE:Model: ${customer.machineName || 'N/A'} | `;
      vcardData += `AMC Start: ${customer.amcStartDate || 'N/A'} | `;
      vcardData += `AMC End: ${customer.amcEndDate || 'N/A'} | `;
      vcardData += `Amount: ₹${customer.amcAmount || 0} | `;
      vcardData += `Card Number: ${customer.cardNumber || 'N/A'}\n`;
      if (customer.mapCode) {
        vcardData += `ADR:;;${customer.mapCode};;;;\n`;
      }
      vcardData += 'END:VCARD\n';
    });

    const blob = new Blob([vcardData], { type: 'text/vcard' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Customers_${new Date().toISOString().split('T')[0]}.vcf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Export to CSV
  const exportToCSV = () => {
    const filteredCustomers = getFilteredCustomers();
    
    if (filteredCustomers.length === 0) {
      alert('No customers to export');
      return;
    }

    const headers = [
      'Full Name',
      'Phone',
      'Model Name',
      'AMC Start Month',
      'AMC Start Date',
      'AMC End Date',
      'AMC Amount (₹)',
      'Paid Amount (₹)',
      'Card Number',
      'Location (Plus Code)',
      'Days Until Expiry'
    ];

    const today = new Date();
    const csvRows = [headers.join(',')];

    filteredCustomers.forEach(customer => {
      const endDate = customer.amcEndDate ? new Date(customer.amcEndDate) : null;
      const daysLeft = endDate ? Math.floor((endDate - today) / (1000 * 60 * 60 * 24)) : 'N/A';
      
      const startDate = customer.amcStartDate || '';
      const startMonth = startDate ? new Date(startDate).toLocaleString('default', { month: 'long', year: 'numeric' }) : 'N/A';

      const row = [
        `"${(customer.fullName || customer.name || '').replace(/"/g, '""')}"`,
        `"${(customer.phone || '').replace(/"/g, '""')}"`,
        `"${(customer.machineName || '').replace(/"/g, '""')}"`,
        `"${startMonth}"`,
        `"${customer.amcStartDate || 'N/A'}"`,
        `"${customer.amcEndDate || 'N/A'}"`,
        customer.amcAmount || 0,
        customer.amcPaidAmount || 0,
        `"${customer.cardNumber || 'N/A'}"`,
        `"${customer.mapCode || 'N/A'}"`,
        daysLeft
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Customers_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Export to Excel
  const exportToExcel = () => {
    const filteredCustomers = getFilteredCustomers();
    
    if (filteredCustomers.length === 0) {
      alert('No customers to export');
      return;
    }

    const today = new Date();
    
    const excelData = filteredCustomers.map(customer => {
      const endDate = customer.amcEndDate ? new Date(customer.amcEndDate) : null;
      const daysLeft = endDate ? Math.floor((endDate - today) / (1000 * 60 * 60 * 24)) : 'N/A';
      
      const startDate = customer.amcStartDate || '';
      const startMonth = startDate ? new Date(startDate).toLocaleString('default', { month: 'long', year: 'numeric' }) : 'N/A';

      return {
        'Full Name': customer.fullName || customer.name || '',
        'Phone': customer.phone || '',
        'Model Name': customer.machineName || '',
        'Buying/AMC Month': startMonth,
        'AMC/Purchase Date': customer.amcStartDate || 'N/A',
        'Expiry Date': customer.amcEndDate || 'N/A',
        'Price (₹)': customer.amcAmount || 0,
        'Paid Amount (₹)': customer.amcPaidAmount || 0,
        'Card Number': customer.cardNumber || 'N/A',
        'Location (Plus Code)': customer.mapCode || 'N/A',
        'Days Until Expiry': daysLeft,
        'Status': daysLeft === 'N/A' ? 'No AMC' : daysLeft < 0 ? 'Expired' : daysLeft <= 7 ? 'Expiring Soon' : 'Active'
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Customers');
    
    const fileName = `Customers_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const getFilteredCustomers = () => {
    const today = new Date();
    const query = searchQuery.toLowerCase().trim();
    
    const filtered = customers.filter(customer => {
      const endDate = customer.amcEndDate || customer.amc?.endDate;
      
      // Check AMC filter - Rent customers skip AMC filter since they have no AMC dates
      let amcMatch = false;
      if (customer.segment === 'rent') {
        // Rent customers always pass AMC filter (they don't have AMC)
        amcMatch = true;
      } else if (!endDate) {
        amcMatch = amcFilter === 'all';
      } else {
        const renewalDate = new Date(endDate);
        const daysLeft = Math.floor((renewalDate - today) / (1000 * 60 * 60 * 24));
        
        if (amcFilter === 'active') {
          amcMatch = daysLeft > 7;
        } else if (amcFilter === 'expiring') {
          amcMatch = daysLeft >= 0 && daysLeft <= 7;
        } else if (amcFilter === 'inactive') {
          amcMatch = daysLeft < 0;
        } else {
          amcMatch = true;
        }
      }
      
      // Check month filter - Only applies to customers with AMC start dates
      let monthMatch = true;
      if (monthFilter) {
        const startDate = customer.amcStartDate || customer.amc?.startDate;
        if (startDate) {
          const startMonth = startDate.substring(5, 7); // Extract MM from YYYY-MM-DD
          monthMatch = startMonth === monthFilter;
        } else {
          // Customers without AMC start date are excluded from month filter results
          monthMatch = false;
        }
      }
      
      // Check segment filter
      let segmentMatch = true;
      if (segmentFilter) {
        // Handle old customers without segment field (default to 'waterpurifier')
        const customerSegment = customer.segment || 'waterpurifier';
        segmentMatch = customerSegment === segmentFilter;
      }
      
      // Check search query
      let searchMatch = true;
      if (query) {
        const fullName = (customer.fullName || customer.name || '').toLowerCase();
        const phone = (customer.phone || '').toLowerCase();
        const cardNumber = (customer.cardNumber || '').toLowerCase();
        const mapCode = (customer.mapCode || '').toLowerCase();
        const address = (customer.address || '').toLowerCase();
        
        searchMatch = fullName.includes(query) || 
                      phone.includes(query) || 
                      cardNumber.includes(query) || 
                      mapCode.includes(query) || 
                      address.includes(query);
      }
      
      return amcMatch && monthMatch && segmentMatch && searchMatch;
    });
    
    // Debug: Log filter results
    if (segmentFilter) {
      console.log(`🔍 Segment filter '${segmentFilter}' resulted in ${filtered.length} customers`);
    }
    
    return filtered;
  };

  const getFilterStats = () => {
    const today = new Date();
    let active = 0, inactive = 0, expiring = 0;
    
    customers.forEach(customer => {
      const endDate = customer.amcEndDate || customer.amc?.endDate;
      if (!endDate) return;
      
      const renewalDate = new Date(endDate);
      const daysLeft = Math.floor((renewalDate - today) / (1000 * 60 * 60 * 24));
      
      if (daysLeft > 7) {
        active++;
      } else if (daysLeft >= 0 && daysLeft <= 7) {
        expiring++;
      } else {
        inactive++;
      }
    });
    
    return { active, inactive, expiring };
  };

  const openGoogleMaps = (mapCode, customerName) => {
    if (!mapCode) {
      alert('No location code available for this customer');
      return;
    }
    const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(mapCode)}`;
    window.open(mapsUrl, '_blank');
  };

  const [rescheduleModalData, setRescheduleModalData] = useState({ 
    show: false, 
    customerId: null, 
    rescheduleType: '', // 'service' or 'amc'
    newDate: '', 
    newTime: '', 
    reason: '',
    customNotes: '' // additional notes from technician
  });

  const handleQuickReschedule = (customerId, rescheduleType) => {
    setRescheduleModalData({
      show: true,
      customerId,
      rescheduleType,
      newDate: '',
      newTime: '',
      reason: '', // Removed reference to callModalData
      customNotes: ''
    });
  };

  const confirmQuickReschedule = async () => {
    const { customerId, rescheduleType, newDate, newTime, reason, customNotes } = rescheduleModalData;

    if (!newDate || !newTime) {
      alert('Please select both date and time');
      return;
    }

    try {
      if (rescheduleType === 'service') {
        // Create/update a ticket for rescheduled service
        const tickets = await dataService.getTickets();
        const customerTickets = tickets.filter(t => t.customerId === customerId && (t.status === 'open' || t.status === 'assigned'));
        
        if (customerTickets.length === 0) {
          // Create new ticket for rescheduled service
          const customer = customers.find(c => c.id === customerId);
          const newTicket = {
            customerId: customerId,
            customerName: customer.fullName || customer.name,
            customerPhone: customer.phone,
            title: 'Service Rescheduled - ' + reason.substring(0, 30),
            description: 'Customer said: ' + reason + (customNotes ? '\n\nAdditional notes: ' + customNotes : ''),
            status: 'open',
            priority: 'medium',
            assignedTo: 'Unassigned',
            assignedToId: null,
            createdAt: getLocalDate(),
            scheduledDate: newDate,
            scheduledArrivalTime: newTime,
            rescheduleReason: reason,
            rescheduleCount: 1,
            lastRescheduleDate: getLocalDate(),
            techniciangNotes: customNotes
          };
          await dataService.addTicket(newTicket);
          alert('✓ Service rescheduled successfully! New ticket created.');
        } else {
          // Update existing ticket
          const ticket = customerTickets[0];
          const previousSchedules = ticket.rescheduleHistory || [];
          if (ticket.scheduledDate && ticket.scheduledArrivalTime) {
            previousSchedules.push({
              date: ticket.scheduledDate,
              time: ticket.scheduledArrivalTime,
              reason: ticket.rescheduleReason || 'Initial assignment'
            });
          }

          await dataService.updateTicket(ticket.id, {
            scheduledDate: newDate,
            scheduledArrivalTime: newTime,
            rescheduleReason: reason,
            rescheduleHistory: previousSchedules,
            rescheduleCount: (ticket.rescheduleCount || 0) + 1,
            lastRescheduleDate: getLocalDate(),
            techniciangNotes: customNotes,
            description: (ticket.description || '') + (customNotes ? '\n\nAdditional notes: ' + customNotes : '')
          });
          alert('✓ Service rescheduled successfully!');
        }
      } else if (rescheduleType === 'amc') {
        // Update customer AMC renewal date
        const customer = customers.find(c => c.id === customerId);
        await dataService.updateCustomer(customerId, {
          amcRenewalScheduledDate: newDate,
          amcRenewalScheduledTime: newTime,
          amcRenewalReason: reason,
          lastAmcRescheduleDate: getLocalDate(),
          amcRenewalNotes: customNotes
        });
        alert('✓ AMC renewal rescheduled successfully!');
      }

      setRescheduleModalData({ show: false, customerId: null, rescheduleType: '', newDate: '', newTime: '', reason: '', customNotes: '' });
    } catch (error) {
      console.error('Error rescheduling:', error);
      alert('Failed to reschedule. Please try again.');
    }
  };

  const [jobHistoryModal, setJobHistoryModal] = useState({
    show: false,
    customerId: null,
    customerName: '',
    jobs: []
  });

  const handleOpenJobHistory = async (customerId, customerName) => {
    try {
      const allTickets = await dataService.getTickets(true);
      const allPayments = await dataService.getPayments(true);
      const customerJobs = allTickets.filter(ticket => ticket.customerId === customerId);
      
      // Add payment details to each job
      const jobsWithPayments = customerJobs.map(job => {
        const jobPayments = allPayments.filter(p => p.ticketId === job.id || p.customerName === customerName);
        return {
          ...job,
          payments: jobPayments
        };
      });
      setJobHistoryModal({
        show: true,
        customerId,
        customerName,
        jobs: jobsWithPayments
      });
    } catch (error) {
      console.error('Error loading job history:', error);
    }
  };

  const handleOpenAmcRenewal = (customer) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    setAmcRenewalModal({
      show: true,
      customer: customer,
      selectedTech: '',
      scheduledDate: tomorrowStr,
      scheduledTime: '10:00'
    });
  };

  // AMC RENEWAL DATA MODAL - For technician to enter renewal details
  const handleOpenAmcRenewalDataModal = (customer) => {
    // Pre-fill with current details as template
    setAmcRenewalDataModal({
      show: true,
      customer: customer,
      newAmcStartDate: getLocalDate(), // Today by default
      newAmcAmount: customer.amcAmount ? customer.amcAmount.toString() : '',
      newAmcPaidAmount: customer.amcPaidAmount ? customer.amcPaidAmount.toString() : '0',
      duration: '12'
    });
  };

  const handleSubmitAMCRenewal = async () => {
    if (!amcRenewalDataModal.customer) return;

    if (!amcRenewalDataModal.newAmcStartDate || !amcRenewalDataModal.newAmcAmount) {
      alert('⚠️ Please fill in AMC Start Date and Amount');
      return;
    }

    setLoading(true);
    try {
      const renewalData = {
        newAmcStartDate: amcRenewalDataModal.newAmcStartDate,
        newAmcAmount: parseFloat(amcRenewalDataModal.newAmcAmount),
        newAmcPaidAmount: parseFloat(amcRenewalDataModal.newAmcPaidAmount || 0),
        duration: parseInt(amcRenewalDataModal.duration || 12)
      };

      // Process renewal
      const result = await amcRenewalService.processAMCRenewal(
        amcRenewalDataModal.customer.id,
        renewalData,
        amcRenewalDataModal.customer
      );

      if (result.success) {
        // Update Google Contacts with new AMC data
        try {
          const customerToSync = {
            ...amcRenewalDataModal.customer,
            amcStartDate: amcRenewalDataModal.newAmcStartDate,
            amcEndDate: result.newAmcEndDate,
            amcAmount: renewalData.newAmcAmount,
            amcPaidAmount: renewalData.newAmcPaidAmount,
            googleContactId: amcRenewalDataModal.customer.googleContactId
          };
          await googleContactsService.syncCustomerToGoogle(customerToSync);
          console.log('✅ Google Contact updated with new AMC data');
        } catch (googleError) {
          console.warn('⚠️ Google Contacts sync failed (non-critical):', googleError);
        }

        // Reload customers
        const allCustomers = await dataService.getCustomers(true);
        setCustomers(allCustomers);

        setSuccess(result.message);
        setAmcRenewalDataModal({ show: false, customer: null, newAmcStartDate: '', newAmcAmount: '', newAmcPaidAmount: '', duration: '12' });
        setTimeout(() => setSuccess(''), 4000);
      } else {
        setError(result.message);
        setTimeout(() => setError(''), 4000);
      }
    } catch (error) {
      console.error('Error in AMC renewal:', error);
      setError('Failed to process AMC renewal. Please try again.');
      setTimeout(() => setError(''), 4000);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignAmcRenewal = async () => {
    if (!amcRenewalModal.selectedTech) {
      alert('⚠️ Please select a technician');
      return;
    }
    if (!amcRenewalModal.scheduledDate || !amcRenewalModal.scheduledTime) {
      alert('⚠️ Please select date and time');
      return;
    }

    try {
      setLoading(true);
      const selectedTech = technicians.find(t => t.id === amcRenewalModal.selectedTech);
      const customer = amcRenewalModal.customer;
      
      const ticketData = {
        customerId: customer.id,
        customerName: customer.fullName || customer.name,
        customerPhone: customer.phone,
        title: `AMC Renewal - ${customer.machineName || 'Machine'}`,
        description: `AMC renewal for card ${customer.cardNumber}. Previous AMC ended on ${customer.amcEndDate}. Amount: ₹${customer.amcAmount}`,
        status: 'assigned',
        priority: 'high',
        assignedTo: selectedTech.name,
        assignedToId: selectedTech.id,
        createdAt: new Date().toISOString().split('T')[0],
        scheduledDate: amcRenewalModal.scheduledDate,
        scheduledArrivalTime: amcRenewalModal.scheduledTime,
        takePayment: true,
        paymentAmount: customer.amcAmount || 0,
        isNewCustomer: false,
        serviceType: 'AMC Renewal'
      };

      const newTicket = await dataService.addTicket(ticketData);
      if (newTicket) {
        setSuccess(`✅ AMC Renewal assigned to ${selectedTech.name}!`);
        setAmcRenewalModal({ show: false, customer: null, selectedTech: '', scheduledDate: '', scheduledTime: '' });
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (error) {
      console.error('Error assigning AMC renewal:', error);
      setError('Failed to assign AMC renewal');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  // Call Log Handlers
  const handleOpenCallLog = async (customer) => {
    try {
      setLoading(true);
      const customerLogs = await dataService.getCallLogs(customer.id, true);
      
      // Sort by timestamp descending (newest first)
      customerLogs.sort((a, b) => new Date(b.callDateTime) - new Date(a.callDateTime));
      
      setCallLogModal({
        show: true,
        customer: customer,
        callLogs: customerLogs,
        newLog: {
          callStatus: '',
          notes: '',
          nextFollowUpDate: '',
          nextFollowUpTime: ''
        }
      });
    } catch (error) {
      console.error('Error loading call logs:', error);
      setError('Failed to load call logs');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCallLog = async () => {
    if (!callLogModal.newLog.callStatus) {
      alert('⚠️ Please select a call status');
      return;
    }
    
    // Only require notes for certain statuses
    const statusesRequiringNotes = ['Confirmed', 'Payment Pending', 'Rescheduled', 'Complaint', 'Other'];
    if (statusesRequiringNotes.includes(callLogModal.newLog.callStatus) && !callLogModal.newLog.notes.trim()) {
      alert('⚠️ Please add conversation notes for this status');
      return;
    }

    try {
      setLoading(true);
      const now = new Date();
      const callLogData = {
        customerId: callLogModal.customer.id,
        customerName: callLogModal.customer.fullName || callLogModal.customer.name,
        customerPhone: callLogModal.customer.phone,
        callDateTime: now.toISOString(),
        callDate: now.toISOString().split('T')[0],
        callTime: now.toTimeString().split(' ')[0].substring(0, 5),
        callStatus: callLogModal.newLog.callStatus,
        notes: callLogModal.newLog.notes || `Call status: ${callLogModal.newLog.callStatus}`,
        nextFollowUpDate: callLogModal.newLog.nextFollowUpDate || null,
        nextFollowUpTime: callLogModal.newLog.nextFollowUpTime || null,
        createdBy: 'admin',
        createdAt: now.toISOString()
      };

      const newLog = await dataService.addCallLog(callLogData);
      if (newLog) {
        // Refresh call logs
        const updatedLogs = await dataService.getCallLogs(callLogModal.customer.id, true);
        updatedLogs.sort((a, b) => new Date(b.callDateTime) - new Date(a.callDateTime));
        
        // Refresh follow-ups
        const todayFollowUps = await dataService.getTodayFollowUps();
        setFollowUpReminders(todayFollowUps);
        
        setCallLogModal({
          ...callLogModal,
          callLogs: updatedLogs,
          newLog: {
            callStatus: '',
            notes: '',
            nextFollowUpDate: '',
            nextFollowUpTime: ''
          }
        });
        setSuccess('✅ Call log saved successfully!');
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (error) {
      console.error('Error saving call log:', error);
      setError('Failed to save call log');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCallLog = async (logId) => {
    if (!window.confirm('Are you sure you want to delete this call log?')) {
      return;
    }

    try {
      setLoading(true);
      await dataService.deleteCallLog(logId);
      
      // Refresh call logs
      const updatedLogs = await dataService.getCallLogs(callLogModal.customer.id, true);
      updatedLogs.sort((a, b) => new Date(b.callDateTime) - new Date(a.callDateTime));
      
      // Refresh follow-ups
      const todayFollowUps = await dataService.getTodayFollowUps();
      setFollowUpReminders(todayFollowUps);
      
      setCallLogModal({
        ...callLogModal,
        callLogs: updatedLogs
      });
      setSuccess('✅ Call log deleted successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error deleting call log:', error);
      setError('Failed to delete call log');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAllCallLogs = async () => {
    if (!window.confirm(`Are you sure you want to delete ALL ${callLogModal.callLogs.length} call logs for ${callLogModal.customer.fullName || callLogModal.customer.name}? This action cannot be undone!`)) {
      return;
    }

    try {
      setLoading(true);
      
      // Delete all logs for this customer
      for (const log of callLogModal.callLogs) {
        await dataService.deleteCallLog(log.id);
      }
      
      // Refresh follow-ups
      const todayFollowUps = await dataService.getTodayFollowUps();
      setFollowUpReminders(todayFollowUps);
      
      setCallLogModal({
        ...callLogModal,
        callLogs: []
      });
      setSuccess('✅ All call logs deleted successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error deleting all call logs:', error);
      setError('Failed to delete all call logs');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenComplaint = (customer) => {
    // Auto-fill: Today's date (YYYY-MM-DD for HTML input) and current time + 30 minutes
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayDate = `${year}-${month}-${day}`; // YYYY-MM-DD format for HTML input
    const defaultTime = technicianScheduleService.getDefaultStartTime();
    
    setComplaintModal({
      show: true,
      customer: customer,
      title: '',
      description: '',
      priority: 'medium',
      selectedTech: '',
      scheduledDate: todayDate, // Auto-fill with today's date (YYYY-MM-DD for HTML input)
      scheduledTime: defaultTime, // Auto-fill with +30 min
      takePayment: false,
      paymentAmount: ''
    });
  };

  const handleOpenServiceAssign = (customer) => {
    // Auto-fill: Today's date (YYYY-MM-DD for HTML input) and current time + 30 minutes
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayDate = `${year}-${month}-${day}`; // YYYY-MM-DD format for HTML input
    const defaultTime = technicianScheduleService.getDefaultStartTime();
    
    setServiceAssignModal({
      show: true,
      customer: customer,
      selectedTech: '', // Not mandatory
      serviceType: '',
      scheduledDate: todayDate, // Auto-fill with today's date (YYYY-MM-DD for HTML input)
      scheduledTime: defaultTime, // Auto-fill current time + 30 min
      endTime: '',
      description: '',
      conflictWarning: null,
      showConflictConfirm: false
    });
  };

  // 🕒 Universal Time Conflict Checker
  const checkServiceTimeConflict = async (technicianId, scheduledDate, scheduledTime, segment) => {
    if (!technicianId || !scheduledDate || !scheduledTime || !segment) {
      setServiceAssignModal(prev => ({
        ...prev,
        conflictWarning: null,
        endTime: ''
      }));
      return;
    }

    // scheduledDate is already in YYYY-MM-DD format (from HTML input)
    const dateISO = scheduledDate;

    const result = await technicianScheduleService.checkTimeConflict(
      technicianId,
      dateISO,
      scheduledTime,
      segment
    );

    if (result.hasConflict) {
      const message = technicianScheduleService.formatConflictMessage(result.conflicts);
      setServiceAssignModal(prev => ({
        ...prev,
        conflictWarning: message,
        endTime: result.endTime
      }));
    } else {
      setServiceAssignModal(prev => ({
        ...prev,
        conflictWarning: null,
        endTime: result.endTime
      }));
    }
  };

  const handleSaveServiceAssignment = async () => {
    // ❌ NO MANDATORY FIELDS - Allow submission even if empty
    
    setLoading(true);
    try {
      // Determine status based on technician assignment
      const status = serviceAssignModal.selectedTech ? 'assigned' : 'open';
      
      // Get segment from customer
      const segment = serviceAssignModal.customer.segment || 'waterpurifier';
      
      // scheduledDate is already in YYYY-MM-DD format
      const dateISO = serviceAssignModal.scheduledDate || (() => {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      })();
      
      // Create a service/ticket record with technicianId for one-time assignment
      const serviceData = {
        customerId: serviceAssignModal.customer.id,
        customerName: serviceAssignModal.customer.fullName || serviceAssignModal.customer.name,
        customerPhone: serviceAssignModal.customer.phone,
        customerAddress: serviceAssignModal.customer.address || '',
        segment: segment, // ✅ Store segment for duration calculation
        title: serviceAssignModal.serviceType || 'Service Request',
        description: serviceAssignModal.description || '',
        priority: 'medium',
        // ✅ ONE-TIME TECHNICIAN ASSIGNMENT
        technicianId: serviceAssignModal.selectedTech || null, // Store technicianId
        assignedTo: serviceAssignModal.selectedTech || 'Unassigned',
        assignedToId: serviceAssignModal.selectedTech || null,
        // ✅ EDITABLE DATE & TIME (auto-filled but can be changed)
        scheduledDate: dateISO,
        scheduledTime: serviceAssignModal.scheduledTime || '',
        endTime: serviceAssignModal.endTime || '', // ✅ Auto-calculated end time
        preferredTime: serviceAssignModal.scheduledTime || '',
        status: status,
        source: 'CustomerPanel', // Track where assignment came from
        createdAt: new Date().toISOString(),
        createdFrom: 'customer-panel',
        type: 'SERVICE', // ✅ RULE 1: Mark as SERVICE type (assigned from Customers panel)
        takePayment: false,
        paymentAmount: ''
      };

      // Save via dataService
      const result = await dataService.addTicket(serviceData);
      
      setSuccess('✅ Service assigned successfully!');
      setServiceAssignModal({
        show: false,
        customer: null,
        selectedTech: '',
        serviceType: '',
        scheduledDate: '',
        scheduledTime: '',
        endTime: '',
        description: '',
        conflictWarning: null,
        showConflictConfirm: false
      });
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error assigning service:', error);
      setError('Failed to assign service: ' + error.message);
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveComplaint = async () => {
    if (!complaintModal.title.trim()) {
      alert('⚠️ Please enter complaint title');
      return;
    }

    if (complaintModal.takePayment && (!complaintModal.paymentAmount || parseFloat(complaintModal.paymentAmount) <= 0)) {
      alert('⚠️ Please enter a valid payment amount');
      return;
    }

    // Prevent duplicate submissions
    if (loading) {
      console.log('Already creating complaint, please wait...');
      return;
    }

    try {
      setLoading(true);
      
      // Determine assigned technician
      let assignedTo = 'Unassigned';
      let assignedToId = null;
      
      if (complaintModal.selectedTech) {
        const selectedTechnician = technicians.find(t => t.id === complaintModal.selectedTech);
        if (selectedTechnician) {
          assignedTo = selectedTechnician.name;
          assignedToId = complaintModal.selectedTech;
        }
      }
      
      const newTicket = {
        customerId: complaintModal.customer.id,
        customerName: complaintModal.customer.fullName || complaintModal.customer.name,
        customerPhone: complaintModal.customer.phone,
        title: complaintModal.title,
        description: complaintModal.description,
        status: complaintModal.selectedTech ? 'assigned' : 'open',
        priority: complaintModal.priority,
        assignedTo: assignedTo,
        assignedToId: assignedToId,
        // ✅ AUTO-FILLED DATE & TIME (convert YYYY-MM-DD to ISO format for storage)
        scheduledDate: complaintModal.scheduledDate || (() => {
          const today = new Date();
          const year = today.getFullYear();
          const month = String(today.getMonth() + 1).padStart(2, '0');
          const day = String(today.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        })(),
        scheduledTime: complaintModal.scheduledTime || '',
        createdAt: getLocalDate(),
        type: 'COMPLAINT', // ✅ RULE 2: Mark as COMPLAINT type
        takePayment: complaintModal.takePayment,
        paymentAmount: complaintModal.takePayment ? Math.round(parseFloat(complaintModal.paymentAmount) * 100) / 100 : null,
        createdFrom: 'customer-panel'
      };

      const savedTicket = await dataService.addTicket(newTicket);
      if (!savedTicket) {
        throw new Error('Failed to create complaint');
      }

      // ✅ SAVE PAYMENT IF CHECKBOX WAS CHECKED
      if (complaintModal.takePayment && complaintModal.paymentAmount) {
        const paymentAmount = Math.round(parseFloat(complaintModal.paymentAmount) * 100) / 100;
        
        // Create payment record
        const newPayment = {
          customerId: complaintModal.customer.id,
          customerName: complaintModal.customer.fullName || complaintModal.customer.name,
          ticketId: savedTicket.id,
          amount: paymentAmount,
          method: 'cash', // Default to cash for now
          date: getLocalDate(),
          timestamp: new Date().toISOString(),
          status: 'completed',
          reference: `CMPL-${savedTicket.id}`,
          notes: `Payment for complaint: ${complaintModal.title}`
        };

        // Save payment to payments collection
        const savedPayment = await dataService.addPayment(newPayment);
        if (!savedPayment) {
          throw new Error('Failed to save payment');
        }
        console.log('✅ Payment saved:', savedPayment);

        // ✅ UPDATE CUSTOMER PAID AMOUNT
        const updatedCustomer = { ...complaintModal.customer };
        const currentPaidAmount = parseFloat(updatedCustomer.amcPaidAmount || 0);
        const newPaidAmount = currentPaidAmount + paymentAmount;
        
        // Calculate due amount for AMC customers
        let dueAmount = 0;
        if (updatedCustomer.segment === 'waterpurifier' || updatedCustomer.segment === 'chimney') {
          const totalAmount = parseFloat(updatedCustomer.amcAmount || 0);
          dueAmount = Math.max(0, totalAmount - newPaidAmount);
        }

        // Determine payment status
        let paymentStatus = 'pending';
        if (dueAmount <= 0) {
          paymentStatus = 'completed';
        } else if (newPaidAmount > 0) {
          paymentStatus = 'partial';
        }

        const customerUpdateData = {
          amcPaidAmount: newPaidAmount,
          paymentStatus: paymentStatus,
          lastPaymentDate: getLocalDate(),
          lastPaymentAmount: paymentAmount
        };

        const customerUpdateResult = await dataService.updateCustomer(complaintModal.customer.id, customerUpdateData);
        if (!customerUpdateResult) {
          console.warn('⚠️ Payment saved but failed to update customer. Refreshing...');
        }

        console.log('✅ Customer payment updated:', customerUpdateData);
      }

      // ✅ RELOAD CUSTOMER & PAYMENTS DATA
      await reloadCustomers();
      
      setSuccess('✅ Complaint created successfully!');
      if (complaintModal.takePayment) {
        setSuccess('✅ Complaint created & Payment recorded!');
      }
      setTimeout(() => setSuccess(''), 3000);
      
      setComplaintModal({
        show: false,
        customer: null,
        title: '',
        description: '',
        priority: 'medium',
        selectedTech: '',
        takePayment: false,
        paymentAmount: ''
      });
    } catch (error) {
      console.error('Error creating complaint/payment:', error);
      setError(`❌ ${error.message || 'Failed to create complaint'}`);
      setTimeout(() => setError(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '1.1rem', marginBottom: '6px' }}>Customers & AMC Management</h1>
        <div>
          {success && <div style={{ color: 'green', marginRight: '10px', fontSize: '10px' }}>✓ {success}</div>}
          {error && <div style={{ color: 'red', marginRight: '10px', fontSize: '10px' }}>✗ {error}</div>}
          <button className="btn" style={{ width: 'auto', marginRight: '10px' }} onClick={reloadCustomers} disabled={loading}>
            Refresh
          </button>
          <button className="btn" style={{ width: 'auto' }} onClick={() => {
            if (editingId) {
              setEditingId(null);
              setFormData({ fullName: '', phone: '', machineName: '', amcStartDate: '', amcEndDate: '', amcAmount: '', cardNumber: '', mapCode: '' });
            }
            setShowForm(!showForm);
          }} disabled={loading}>
            {showForm ? 'Cancel' : 'Add Customer'}
          </button>
        </div>
      </div>

      {/* ADD NEW CUSTOMER FORM AT TOP (only when adding) */}
      {!editingId && showForm && (
        <div className="card" style={{ marginBottom: '10px', backgroundColor: '#f0f9ff', borderLeft: '4px solid #0066ff' }}>
          <h2 style={{ fontSize: '0.95rem', marginBottom: '6px' }}>➕ Add New Customer</h2>
          <form onSubmit={handleSubmit}>
            {/* SEGMENT SELECTION - MANDATORY */}
            <div className="form-group" style={{ marginBottom: '6px', padding: '6px', backgroundColor: '#fff3cd', borderRadius: '6px', border: '2px solid #ff9800' }}>
              <label htmlFor="segment" style={{ fontWeight: 'bold', fontSize: '10px', color: '#856404', marginBottom: '2px', display: 'block' }}>🏷️ Select Segment: * REQUIRED</label>
              <select
                id="segment"
                name="segment"
                value={formData.segment}
                onChange={handleInputChange}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  fontSize: '11px',
                  border: '2px solid #ff9800',
                  borderRadius: '6px',
                  backgroundColor: '#fff',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
                required
              >
                <option value="">-- Choose a Segment --</option>
                <option value="waterpurifier">💧 Water Purifier</option>
                <option value="chimney">🌫️ Chimney</option>
                <option value="rent">🔑 Rent Water Purifier</option>
              </select>
              <p style={{ fontSize: '9px', color: '#666', marginTop: '3px', fontStyle: 'italic' }}>
                ℹ️ This determines what fields appear below and how the customer is billed
              </p>
            </div>

            {/* CUSTOMER TYPE SELECTION - HIDDEN FOR RENT SEGMENT */}
            {formData.segment !== 'rent' && (
              <div className="form-group" style={{ marginBottom: '6px', padding: '6px', backgroundColor: '#e3f2fd', borderRadius: '6px', border: '2px solid #2196f3' }}>
                <label htmlFor="customerType" style={{ fontWeight: 'bold', fontSize: '10px', color: '#1565c0', marginBottom: '2px', display: 'block' }}>👤 Customer Type: *</label>
                <select
                  id="customerType"
                  name="customerType"
                  value={formData.customerType}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    padding: '3px 6px',
                    fontSize: '10px',
                    border: '2px solid #2196f3',
                    borderRadius: '6px',
                    backgroundColor: '#fff',
                    cursor: 'pointer',
                    fontWeight: '500'
                  }}
                  required
                >
                  <option value="">-- Select Customer Type --</option>
                  <option value="AMC">Under AMC</option>
                  <option value="NON_AMC">Non-AMC</option>
                </select>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '6px' }}>
            <div className="form-group">
              <label htmlFor="cardNumber">Card Number:</label>
              <input
                type="text"
                id="cardNumber"
                name="cardNumber"
                value={formData.cardNumber}
                onChange={handleInputChange}
                placeholder="e.g., 001, 002, 003"
                required
              />
              <p style={{ fontSize: '10px', color: '#666', marginTop: '3px' }}>
                Enter the unique card number from your offline card
              </p>
            </div>
            
            <div className="form-group">
              <label htmlFor="fullName">Customer Full Name:</label>
              <input
                type="text"
                id="fullName"
                name="fullName"
                value={formData.fullName}
                onChange={handleInputChange}
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="phone">Phone Number:</label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                placeholder="Enter exactly 10 digits (auto adds +91)"
                required
              />
              <p style={{ fontSize: '10px', color: '#666', marginTop: '3px' }}>
                📍 Must be exactly 10 digits - +91 will be added automatically
              </p>
            </div>
            
            <div className="form-group">
              <label htmlFor="machineName">Machine Model Name:</label>
              <input
                type="text"
                id="machineName"
                name="machineName"
                value={formData.machineName}
                onChange={handleInputChange}
                placeholder="e.g., AC-2024, Refrigerator-XYZ"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="purchaseDate">Date of Purchase (Machine Purchase Date):</label>
              <input
                type="date"
                id="purchaseDate"
                name="purchaseDate"
                value={formData.purchaseDate}
                onChange={handleInputChange}
              />
              <p style={{ fontSize: '10px', color: '#666', marginTop: '3px' }}>
                When the customer bought the machine (may be different from AMC start date)
              </p>
            </div>
            </div>

            {/* AMC & NON-AMC CUSTOMER DETAILS - SHOW ONLY IF NOT RENT SEGMENT */}
            {formData.segment !== 'rent' && formData.customerType === 'AMC' && (
              <div className="card" style={{ marginTop: '6px', marginBottom: '6px', padding: '8px', backgroundColor: '#e8f5e9', borderLeft: '4px solid #4caf50' }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '0.85rem', color: '#2e7d32' }}>🔵 AMC Customer Details</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '6px' }}>
                  <div className="form-group">
                    <label htmlFor="amcStartDate">AMC Start Date (When AMC coverage begins):</label>
                    <input
                      type="date"
                      id="amcStartDate"
                      name="amcStartDate"
                      value={formData.amcStartDate}
                      onChange={handleInputChange}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="amcEndDate">AMC End Date (Renewal Date):</label>
                    <input
                      type="date"
                      id="amcEndDate"
                      name="amcEndDate"
                      value={formData.amcEndDate}
                      onChange={handleInputChange}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="amcAmount">Annual Amount (₹):</label>
                    <input
                      type="number"
                      id="amcAmount"
                      name="amcAmount"
                      value={formData.amcAmount}
                      onChange={handleInputChange}
                      placeholder="e.g., 5000"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="amcPaidAmount">Amount Already Paid (₹):</label>
                    <input
                      type="number"
                      id="amcPaidAmount"
                      name="amcPaidAmount"
                      value={formData.amcPaidAmount}
                      onChange={handleInputChange}
                      placeholder="e.g., 2000 (if partial payment)"
                    />
                    <p style={{ fontSize: '10px', color: '#666', marginTop: '3px' }}>
                      Enter how much customer has already paid. Pending = Annual Amount - Paid Amount
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* NON-AMC CUSTOMER DETAILS - SHOW ONLY IF "Non-AMC" AND NOT RENT */}
            {formData.segment !== 'rent' && formData.customerType === 'NON_AMC' && (
              <div className="card" style={{ marginTop: '6px', marginBottom: '6px', padding: '8px', backgroundColor: '#fff3e0', borderLeft: '4px solid #ff9800' }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '0.85rem', color: '#e65100' }}>🟡 Non-AMC Customer Details</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '6px' }}>
                  <div className="form-group">
                    <label htmlFor="filterChangeDate">Service/Filter Date:</label>
                    <input
                      type="date"
                      id="filterChangeDate"
                      name="filterChangeDate"
                      value={formData.filterChangeDate || ''}
                      onChange={handleInputChange}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="filterChangeAmount">Service Amount (₹):</label>
                    <input
                      type="number"
                      id="filterChangeAmount"
                      name="filterChangeAmount"
                      value={formData.filterChangeAmount || ''}
                      onChange={handleInputChange}
                      placeholder="e.g., 500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* RENT WATER PURIFIER FIELDS - SHOW ONLY IF RENT SEGMENT */}
            {formData.segment === 'rent' && (
              <div className="card" style={{ marginTop: '6px', marginBottom: '6px', padding: '8px', backgroundColor: '#f3e5f5', borderLeft: '4px solid #9c27b0' }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '0.85rem', color: '#6a1b9a' }}>🔑 Rent Water Purifier Details</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '6px' }}>
                  <div className="form-group">
                    <label htmlFor="rentStartDate">Rent Start Date:</label>
                    <input
                      type="date"
                      id="rentStartDate"
                      name="rentStartDate"
                      value={formData.rentStartDate || ''}
                      onChange={handleInputChange}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="monthlyRent">Monthly Rent (₹):</label>
                    <input
                      type="number"
                      id="monthlyRent"
                      name="monthlyRent"
                      value={formData.monthlyRent || ''}
                      onChange={handleInputChange}
                      placeholder="e.g., 500"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="dailyUsageLimit">Daily Usage Limit (Liters):</label>
                    <input
                      type="number"
                      id="dailyUsageLimit"
                      name="dailyUsageLimit"
                      value={formData.dailyUsageLimit || '50'}
                      onChange={handleInputChange}
                      placeholder="e.g., 50"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="paymentStatus">Payment Status:</label>
                    <select
                      id="paymentStatus"
                      name="paymentStatus"
                      value={formData.paymentStatus || 'pending'}
                      onChange={handleInputChange}
                      style={{ width: '100%', padding: '6px', fontSize: '11px', borderRadius: '4px', border: '1px solid #ddd' }}
                    >
                      <option value="pending">⏳ Pending</option>
                      <option value="partial">⚠️ Partial</option>
                      <option value="paid">✅ Paid</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* ADDITIONAL FIELDS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '6px' }}>
            <div className="form-group">
              <label htmlFor="mapCode">Location - Google Maps Plus Code (Optional):</label>
              <input
                type="text"
                id="mapCode"
                name="mapCode"
                value={formData.mapCode}
                onChange={handleInputChange}
                placeholder="e.g., JC5Q+RQV"
              />
              <p style={{ fontSize: '10px', color: '#666', marginTop: '3px' }}>
                Get Plus Code from Google Maps: Right-click on location → Plus Code shown at top
              </p>
            </div>
            
            <div className="form-group">
              <label htmlFor="address">Customer Address:</label>
              <textarea
                id="address"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                placeholder="e.g., 123 Main Street, City, State, Postal Code"
                style={{
                  width: '100%',
                  minHeight: '30px',
                  padding: '3px',
                  fontSize: '10px',
                  border: '2px solid #ddd',
                  borderRadius: '4px',
                  fontFamily: 'Arial',
                  boxSizing: 'border-box',
                  resize: 'vertical'
                }}
              />
              <p style={{ fontSize: '10px', color: '#666', marginTop: '3px' }}>
                Full address of the customer for service visits
              </p>
            </div>
            </div>
            
            <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
            <button type="submit" className="btn" style={{ flex: 1 }} disabled={loading}>
              {loading ? (editingId ? 'Updating...' : 'Saving...') : (editingId ? 'Update Customer' : 'Save Customer')}
            </button>
            <button 
              type="button"
              className="btn" 
              style={{ flex: 1, backgroundColor: '#6c757d' }}
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
                setFormData({ fullName: '', phone: '', segment: 'waterpurifier', machineName: '', purchaseDate: '', customerType: 'AMC', amcStartDate: '', amcEndDate: '', amcAmount: '', amcPaidAmount: '', filterChangeDate: '', filterChangeAmount: '', rentStartDate: '', monthlyRent: '', dailyUsageLimit: '50', paymentStatus: 'pending', lastPaidMonth: null, nextDueMonth: null, paidHistory: [], cardNumber: '', address: '', mapCode: '' });
              }}
            >
              Cancel
            </button>
            </div>
          </form>
        </div>
      )}

      {/* Search Box */}
      <div style={{ marginBottom: '6px' }}>
        <input
          type="text"
          placeholder="🔍 Search by name, phone, card number, map code, or address..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '4px 6px',
            fontSize: '11px',
            border: '2px solid #ddd',
            borderRadius: '6px',
            boxSizing: 'border-box',
            transition: 'border-color 0.3s'
          }}
          onFocus={(e) => e.target.style.borderColor = '#0066ff'}
          onBlur={(e) => e.target.style.borderColor = '#ddd'}
        />
        {searchQuery && (
          <p style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>
            Found {getFilteredCustomers().length} customer(s) matching your search
          </p>
        )}
      </div>

      {/* FILTER BY MONTH DROPDOWN */}
      <div style={{ marginBottom: '6px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <label htmlFor="monthFilter" style={{ marginRight: '4px', fontWeight: 'bold', fontSize: '10px' }}>Filter by AMC Month:</label>
          <select
            id="monthFilter"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            style={{
              padding: '3px 6px',
              borderRadius: '6px',
              border: '2px solid #ddd',
              fontSize: '10px',
              cursor: 'pointer',
              backgroundColor: '#fff'
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

        <div>
          <label htmlFor="segmentFilter" style={{ marginRight: '4px', fontWeight: 'bold', fontSize: '10px' }}>Filter by Segment:</label>
          <select
            id="segmentFilter"
            value={segmentFilter}
            onChange={(e) => setSegmentFilter(e.target.value)}
            style={{
              padding: '3px 6px',
              borderRadius: '6px',
              border: '2px solid #ddd',
              fontSize: '10px',
              cursor: 'pointer',
              backgroundColor: '#fff'
            }}
          >
            <option value="">All Segments</option>
            <option value="waterpurifier">💧 RO (Water Purifier)</option>
            <option value="chimney">🌫️ CH (Chimney)</option>
            <option value="rent">🔑 RentRo (Rent)</option>
          </select>
        </div>
      </div>

      {/* Today's Follow-up Reminders */}
      {followUpReminders.length > 0 && (
        <div className="card" style={{ marginBottom: '20px', backgroundColor: '#fff3cd', borderLeft: '4px solid #ffc107' }}>
          <h3>⏰ Today's Follow-up Reminders ({followUpReminders.length})</h3>
          <p style={{ color: '#856404', marginBottom: '15px', fontSize: '13px' }}>
            Customers you need to call back today or overdue follow-ups
          </p>
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {followUpReminders.map((log, idx) => {
              const customer = customers.find(c => c.id === log.customerId);
              const isOverdue = log.nextFollowUpDate < new Date().toISOString().split('T')[0];
              
              return (
                <div 
                  key={log.id || idx}
                  style={{
                    padding: '12px',
                    marginBottom: '10px',
                    backgroundColor: isOverdue ? '#ffebee' : '#fff',
                    border: isOverdue ? '2px solid #f44336' : '1px solid #ddd',
                    borderRadius: '6px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', color: '#333', marginBottom: '5px' }}>
                      {isOverdue && '⚠️ '}{customer?.fullName || customer?.name || 'Unknown'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '3px' }}>
                      📞 {customer?.phone} | 🎫 Card: {customer?.cardNumber}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '3px' }}>
                      Last Status: <strong>{log.callStatus}</strong>
                    </div>
                    <div style={{ fontSize: '11px', color: '#999', fontStyle: 'italic' }}>
                      {log.notes.substring(0, 60)}{log.notes.length > 60 ? '...' : ''}
                    </div>
                    <div style={{ fontSize: '12px', color: isOverdue ? '#d32f2f' : '#f57c00', fontWeight: 'bold', marginTop: '5px' }}>
                      {isOverdue ? '❌ OVERDUE' : '🔔 DUE TODAY'}: {log.nextFollowUpDate} {log.nextFollowUpTime || ''}
                    </div>
                  </div>
                  <div>
                    <button
                      className="btn"
                      style={{ padding: '8px 15px', backgroundColor: '#6f42c1', fontSize: '13px', whiteSpace: 'nowrap' }}
                      onClick={() => customer && handleOpenCallLog(customer)}
                    >
                      📞 Call Now
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* AMC FILTER TABS */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', borderBottom: '1px solid #ddd', paddingBottom: '6px', flexWrap: 'wrap' }}>
        {(() => {
          const stats = getFilterStats();
          return (
            <>
              <button
                onClick={() => setAmcFilter('all')}
                style={{
                  padding: '5px 10px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: amcFilter === 'all' ? '#0066ff' : '#f0f0f0',
                  color: amcFilter === 'all' ? 'white' : '#333',
                  borderRadius: '4px',
                  fontWeight: amcFilter === 'all' ? 'bold' : 'normal',
                  fontSize: '10px'
                }}
              >
                All Customers ({customers.length})
              </button>
              <button
                onClick={() => setAmcFilter('active')}
                style={{
                  padding: '5px 10px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: amcFilter === 'active' ? '#28a745' : '#f0f0f0',
                  color: amcFilter === 'active' ? 'white' : '#333',
                  borderRadius: '4px',
                  fontWeight: amcFilter === 'active' ? 'bold' : 'normal',
                  fontSize: '10px'
                }}
              >
                ✓ Active AMC ({stats.active})
              </button>
              <button
                onClick={() => setAmcFilter('inactive')}
                style={{
                  padding: '5px 10px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: amcFilter === 'inactive' ? '#dc3545' : '#f0f0f0',
                  color: amcFilter === 'inactive' ? 'white' : '#333',
                  borderRadius: '4px',
                  fontWeight: amcFilter === 'inactive' ? 'bold' : 'normal',
                  fontSize: '10px'
                }}
              >
                ✗ Inactive AMC ({stats.inactive})
              </button>
              <button
                onClick={() => setAmcFilter('expiring')}
                style={{
                  padding: '5px 10px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: amcFilter === 'expiring' ? '#ffc107' : '#f0f0f0',
                  color: amcFilter === 'expiring' ? 'white' : '#333',
                  borderRadius: '4px',
                  fontWeight: amcFilter === 'expiring' ? 'bold' : 'normal',
                  fontSize: '10px'
                }}
              >
                ⚠️ Expiring in 7 Days ({stats.expiring})
              </button>
            </>
          );
        })()}
      </div>

      {/* CUSTOMER LIST / TABLE */}

      {/* CUSTOMER TABLE SECTION */}
      <div className="table-responsive customer-table-wrapper">
        <table className="customer-table">
          <thead>
            <tr>
              <th>Card #</th>
              <th>Segment</th>
              <th>Name</th>
              <th>Phone</th>
              <th>Machine</th>
              <th>Purchase</th>
              <th>AMC Start</th>
              <th>AMC End</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Days</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {getFilteredCustomers().map((customer, index) => {
              const endDate = customer.amcEndDate || customer.amc?.endDate;
              const today = new Date();
              const renewalDate = new Date(endDate);
              const daysLeft = Math.floor((renewalDate - today) / (1000 * 60 * 60 * 24));
              let statusColor = '#28a745';
              let statusText = '✓ Active';
              
              if (daysLeft < 0) {
                statusColor = '#dc3545';
                statusText = '✗ Expired';
              } else if (daysLeft <= 30) {
                statusColor = '#ffc107';
                statusText = '⚠ Soon';
              }
              
              const isExpanded = expandedRows[customer.id];
              
              return (
                <React.Fragment key={customer.id}>
                  {/* Main compact row */}
                  <tr className="main-row">
                    <td><strong>{customer.cardNumber || 'N/A'}</strong></td>
                    <td>
                      <span style={{
                        backgroundColor: customer.segment === 'waterpurifier' ? '#2196f3' : customer.segment === 'chimney' ? '#ff9800' : '#9c27b0',
                        color: 'white',
                        padding: '3px 6px',
                        borderRadius: '3px',
                        fontSize: '9px',
                        fontWeight: 'bold',
                        whiteSpace: 'nowrap'
                      }}>
                        {customer.segment === 'waterpurifier' ? '💧 RO' : customer.segment === 'chimney' ? '🌫️ Chimney' : customer.segment === 'rent' ? '🔑 Rent' : '💧 RO'}
                      </span>
                    </td>
                    <td title={customer.fullName || customer.name}>{customer.fullName || customer.name}</td>
                    <td>{customer.phone || '-'}</td>
                    <td title={customer.machineName || 'N/A'}>{customer.machineName || 'N/A'}</td>
                    <td>{customer.purchaseDate || 'N/A'}</td>
                    <td>{customer.amcStartDate || 'N/A'}</td>
                    <td>{customer.amcEndDate || 'N/A'}</td>
                    <td>₹{customer.amcAmount || '0'}</td>
                    <td>
                      <span style={{
                        backgroundColor: statusColor,
                        color: 'white',
                        padding: '3px 6px',
                        borderRadius: '3px',
                        fontSize: '10px',
                        fontWeight: 'bold'
                      }}>
                        {statusText}
                      </span>
                    </td>
                    <td>{daysLeft > 0 ? daysLeft : 'Exp'}</td>
                    <td>
                      <button
                        className="toggle-expand-btn"
                        onClick={() => handleRowExpand(customer.id, isExpanded)}
                      >
                        {isExpanded ? '▲ Hide' : '▼ View'}
                      </button>
                    </td>
                  </tr>
                  
                  {/* Expandable row with formatted text + actions */}
                  {isExpanded && (
                    <tr className="expand-row">
                      <td colSpan="12">
                        <div className="expand-content">
                          {/* Formatted Text Section */}
                          {customer.formattedText && (
                            <div className="formatted-text-section">
                              <strong>📋 Formatted Text:</strong>
                              <div className="formatted-text">{customer.formattedText}</div>
                            </div>
                          )}
                          
                          {/* AMC SERVICE HISTORY SECTION */}
                          {customer.customerType === 'AMC' && customer.segment !== 'rent' && (
                            <div style={{
                              backgroundColor: '#f0f8ff',
                              border: '2px solid #667eea',
                              borderRadius: '8px',
                              padding: '15px',
                              marginBottom: '15px'
                            }}>
                              <div style={{ marginBottom: '12px', borderBottom: '2px solid #667eea', paddingBottom: '8px' }}>
                                <strong style={{ fontSize: '14px', color: '#667eea' }}>📋 AMC SERVICE HISTORY</strong>
                                {customerAmcServices[customer.id] && (
                                  <span style={{ 
                                    marginLeft: '10px', 
                                    fontSize: '12px', 
                                    color: '#666',
                                    backgroundColor: '#e3f2fd',
                                    padding: '4px 8px',
                                    borderRadius: '4px'
                                  }}>
                                    {customerAmcServices[customer.id].filter(s => s.status === 'completed').length}/{customerAmcServices[customer.id].length} Completed
                                  </span>
                                )}
                              </div>
                              
                              {!customerAmcServices[customer.id] ? (
                                <p style={{ margin: 0, fontSize: '12px', color: '#666', textAlign: 'center', padding: '20px' }}>
                                  Loading services...
                                </p>
                              ) : customerAmcServices[customer.id].length === 0 ? (
                                <p style={{ margin: 0, fontSize: '12px', color: '#666', textAlign: 'center', padding: '20px' }}>
                                  ⚠️ No AMC services generated yet. Services will be auto-generated when customer AMC is created.
                                </p>
                              ) : (
                                <div style={{ display: 'grid', gap: '10px' }}>
                                  {customerAmcServices[customer.id].map((service, index) => {
                                    const isCompleted = service.status === 'completed';
                                    const isPending = service.status === 'pending' || service.status === 'assigned';
                                    const isOverdue = isPending && new Date(service.scheduledDate) < new Date();
                                    const isDelayed = service.scheduledDate !== service.amcOriginalDate;
                                    
                                    let statusColor = '#ffc107'; // Default yellow for pending
                                    let statusIcon = '⏳';
                                    let statusText = 'Pending';
                                    
                                    if (isCompleted) {
                                      statusColor = '#28a745';
                                      statusIcon = '✅';
                                      statusText = 'Completed';
                                    } else if (isOverdue) {
                                      statusColor = '#dc3545';
                                      statusIcon = '⚠️';
                                      statusText = 'Overdue';
                                    } else if (service.status === 'assigned') {
                                      statusColor = '#17a2b8';
                                      statusIcon = '👤';
                                      statusText = 'Assigned';
                                    } else if (new Date(service.scheduledDate) > new Date()) {
                                      statusColor = '#667eea';
                                      statusIcon = '📅';
                                      statusText = 'Upcoming';
                                    }
                                    
                                    return (
                                      <div key={service.id} style={{
                                        backgroundColor: 'white',
                                        border: `2px solid ${statusColor}`,
                                        borderRadius: '6px',
                                        padding: '12px',
                                        position: 'relative'
                                      }}>
                                        {/* Service Header */}
                                        <div style={{ 
                                          display: 'flex', 
                                          justifyContent: 'space-between', 
                                          alignItems: 'center',
                                          marginBottom: '8px'
                                        }}>
                                          <div>
                                            <strong style={{ fontSize: '13px', color: '#333' }}>
                                              {statusIcon} {service.serviceType || `Service ${service.amcServiceNumber}`}
                                            </strong>
                                            <span style={{
                                              marginLeft: '8px',
                                              backgroundColor: statusColor,
                                              color: 'white',
                                              padding: '2px 8px',
                                              borderRadius: '4px',
                                              fontSize: '10px',
                                              fontWeight: 'bold'
                                            }}>
                                              {statusText}
                                            </span>
                                          </div>
                                          <div style={{ fontSize: '11px', color: '#666' }}>
                                            #{service.amcServiceNumber || index + 1} of 4
                                          </div>
                                        </div>
                                        
                                        {/* Service Details Grid */}
                                        <div style={{ 
                                          display: 'grid', 
                                          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
                                          gap: '8px',
                                          fontSize: '11px'
                                        }}>
                                          <div>
                                            <span style={{ color: '#666' }}>📅 Scheduled:</span>
                                            <br />
                                            <strong>{service.scheduledDate || 'N/A'}</strong>
                                            {isDelayed && (
                                              <span style={{ 
                                                display: 'block',
                                                fontSize: '10px',
                                                color: '#ff9800',
                                                marginTop: '2px'
                                              }}>
                                                ⚠️ Rescheduled from {service.amcOriginalDate}
                                              </span>
                                            )}
                                          </div>
                                          
                                          {isCompleted && service.completedAt && (
                                            <div>
                                              <span style={{ color: '#666' }}>✅ Completed:</span>
                                              <br />
                                              <strong style={{ color: '#28a745' }}>
                                                {new Date(service.completedAt).toLocaleDateString('en-GB')}
                                              </strong>
                                            </div>
                                          )}
                                          
                                          <div>
                                            <span style={{ color: '#666' }}>👤 Technician:</span>
                                            <br />
                                            <strong>{service.assignedTo || 'Unassigned'}</strong>
                                          </div>
                                          
                                          {service.description && (
                                            <div style={{ gridColumn: '1 / -1' }}>
                                              <span style={{ color: '#666' }}>📝 Notes:</span>
                                              <br />
                                              <span style={{ fontSize: '10px' }}>{service.description}</span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* Action Buttons Section */}
                          <div className="action-buttons-section">
                            <strong>⚡ Actions:</strong>
                            <div className="action-buttons">
                    <button 
                      className="expand-details-btn"
                      onClick={() => handleEditCustomer(customer)}
                      title="View & manage all details"
                    >
                      📋 Details
                    </button>
                    <button 
                      className="btn" 
                      style={{ width: '100%', padding: '4px 6px', fontSize: '10px', textAlign: 'center' }}
                      onClick={() => handleEditCustomer(customer)}
                    >
                      Edit
                    </button>
                    {customer.phone && customer.phone.trim() !== '' ? (
                      <a 
                        href={`tel:${customer.phone.replace(/[^0-9+]/g, '')}`}
                        className="btn"
                        style={{ 
                          width: '100%', 
                          padding: '4px 6px', 
                          backgroundColor: '#28a745', 
                          fontSize: '10px',
                          textDecoration: 'none',
                          display: 'block',
                          textAlign: 'center',
                          color: 'white'
                        }}
                        onClick={(e) => {
                          // Ensure phone number exists
                          if (!customer.phone || customer.phone.trim() === '') {
                            e.preventDefault();
                            alert('⚠️ No phone number available for this customer');
                          }
                        }}
                      >
                        ☎️ Call
                      </a>
                    ) : (
                      <button
                        className="btn"
                        style={{ 
                          width: '100%', 
                          padding: '4px 6px', 
                          backgroundColor: '#6c757d', 
                          fontSize: '10px',
                          cursor: 'not-allowed',
                          opacity: 0.6
                        }}
                        disabled
                        title="No phone number"
                      >
                        ☎️ Call
                      </button>
                    )}
                    {customer.mapCode ? (
                      <button
                        className="btn"
                        style={{ width: '100%', padding: '4px 6px', marginRight: '0px', backgroundColor: '#17a2b8', fontSize: '10px' }}
                        onClick={() => openGoogleMaps(customer.mapCode, customer.fullName || customer.name)}
                      >
                        📍 Map
                      </button>
                    ) : null}
                    <button
                      className="btn"
                      style={{ width: '100%', padding: '4px 6px', marginRight: '0px', backgroundColor: '#17a2b8', fontSize: '10px' }}
                      onClick={() => handleOpenJobHistory(customer.id, customer.fullName || customer.name)}
                    >
                      📋 Job History
                    </button>
                    <button
                      className="btn"
                      style={{ width: '100%', padding: '4px 6px', marginRight: '0px', backgroundColor: '#6f42c1', fontSize: '10px', fontWeight: 'bold' }}
                      onClick={() => handleOpenCallLog(customer)}
                    >
                      📞 Call Log
                    </button>
                    <button
                      className="btn"
                      style={{ width: '100%', padding: '4px 6px', marginRight: '0px', backgroundColor: '#ff9800', fontSize: '10px', fontWeight: 'bold' }}
                      onClick={() => handleOpenServiceAssign(customer)}
                    >
                      🔧 Assign Service
                    </button>
                    <button
                      className="btn"
                      style={{ width: '100%', padding: '4px 6px', marginRight: '0px', backgroundColor: '#ff6b6b', fontSize: '10px', fontWeight: 'bold' }}
                      onClick={() => handleOpenComplaint(customer)}
                      title="Create a new complaint for this customer"
                    >
                      ⚠️ Create Complaint
                    </button>
                    {daysLeft < 0 && (
                      <>
                        <button
                          className="btn"
                          style={{ width: '100%', padding: '4px 6px', marginRight: '0px', backgroundColor: '#28a745', fontSize: '10px', fontWeight: 'bold' }}
                          onClick={() => handleOpenAmcRenewalDataModal(customer)}
                          title="Technician confirmed AMC renewal - process it now"
                        >
                          ✅ Process AMC Renewal
                        </button>
                        <button
                          className="btn"
                          style={{ width: '100%', padding: '4px 6px', marginRight: '0px', backgroundColor: '#007bff', fontSize: '10px', fontWeight: 'bold' }}
                          onClick={() => handleOpenAmcRenewal(customer)}
                        >
                          🔄 Assign AMC Renewal
                        </button>
                        <button
                          className="btn"
                          style={{ width: '100%', padding: '4px 6px', marginRight: '0px', backgroundColor: '#ff6b6b', fontSize: '10px', fontWeight: 'bold' }}
                          onClick={() => handleOpenComplaint(customer)}
                        >
                          ⚠️ Create Complaint
                        </button>
                      </>
                    )}
                    <button
                      className="btn"
                      style={{ width: '100%', padding: '4px 6px', backgroundColor: '#dc3545', fontSize: '10px' }}
                      onClick={() => handleDeleteCustomer(customer.id)}
                    >
                      Delete
                    </button>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {/* EDIT CUSTOMER FORM ROW - shows under the customer when editing */}
            {editingId && showForm && (
              <tr>
                <td colSpan="7" style={{ padding: '0' }}>
                  <div className="card" style={{ margin: '10px', backgroundColor: '#fff8f0', borderLeft: '4px solid #ff9800' }}>
                    <h3 style={{ fontSize: '0.95rem', marginBottom: '6px' }}>✏️ Edit Customer</h3>
                    <form onSubmit={handleSubmit}>
                      {/* SEGMENT SELECTION - MANDATORY */}
                      <div className="form-group" style={{ marginBottom: '6px', padding: '6px', backgroundColor: '#fff3cd', borderRadius: '6px', border: '2px solid #ff9800' }}>
                        <label htmlFor="segment" style={{ fontWeight: 'bold', fontSize: '10px', color: '#856404', marginBottom: '2px', display: 'block' }}>🏷️ Select Segment: * REQUIRED</label>
                        <select
                          id="segment"
                          name="segment"
                          value={formData.segment}
                          onChange={handleInputChange}
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            fontSize: '11px',
                            border: '2px solid #ff9800',
                            borderRadius: '6px',
                            backgroundColor: '#fff',
                            cursor: 'pointer',
                            fontWeight: '600'
                          }}
                          required
                        >
                          <option value="">-- Choose a Segment --</option>
                          <option value="waterpurifier">💧 Water Purifier</option>
                          <option value="chimney">🌫️ Chimney</option>
                          <option value="rent">🔑 Rent Water Purifier</option>
                        </select>
                        <p style={{ fontSize: '9px', color: '#666', marginTop: '3px', fontStyle: 'italic' }}>
                          ℹ️ This determines what fields appear below and how the customer is billed
                        </p>
                      </div>

                      {/* CUSTOMER TYPE SELECTION - HIDDEN FOR RENT SEGMENT */}
                      {formData.segment !== 'rent' && (
                        <div className="form-group" style={{ marginBottom: '6px', padding: '6px', backgroundColor: '#fff3e0', borderRadius: '6px', border: '2px solid #ff9800' }}>
                          <label htmlFor="customerType" style={{ fontWeight: 'bold', fontSize: '10px', color: '#e65100', marginBottom: '2px', display: 'block' }}>👤 Customer Type: *</label>
                          <select
                            id="customerType"
                            name="customerType"
                            value={formData.customerType}
                            onChange={handleInputChange}
                            style={{
                              width: '100%',
                              padding: '3px 6px',
                              fontSize: '10px',
                              border: '2px solid #ff9800',
                              borderRadius: '6px',
                              backgroundColor: '#fff',
                              cursor: 'pointer',
                              fontWeight: '500'
                            }}
                            required
                          >
                            <option value="">-- Select Customer Type --</option>
                            <option value="AMC">Under AMC</option>
                            <option value="NON_AMC">Non-AMC</option>
                          </select>
                        </div>
                      )}

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '6px' }}>
                      <div className="form-group">
                        <label htmlFor="cardNumber">Card Number:</label>
                        <input
                          type="text"
                          id="cardNumber"
                          name="cardNumber"
                          value={formData.cardNumber}
                          onChange={handleInputChange}
                          placeholder="e.g., 001, 002, 003"
                          required
                        />
                      </div>
                      
                      <div className="form-group">
                        <label htmlFor="fullName">Customer Full Name:</label>
                        <input
                          type="text"
                          id="fullName"
                          name="fullName"
                          value={formData.fullName}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                      
                      <div className="form-group">
                        <label htmlFor="phone">Phone Number:</label>
                        <input
                          type="tel"
                          id="phone"
                          name="phone"
                          value={formData.phone}
                          onChange={handleInputChange}
                          placeholder="Enter exactly 10 digits (auto adds +91)"
                          required
                        />
                      </div>
                      
                      <div className="form-group">
                        <label htmlFor="machineName">Machine Model Name:</label>
                        <input
                          type="text"
                          id="machineName"
                          name="machineName"
                          value={formData.machineName}
                          onChange={handleInputChange}
                          placeholder="e.g., AC-2024, Refrigerator-XYZ"
                        />
                      </div>
                      
                      <div className="form-group">
                        <label htmlFor="purchaseDate">Date of Purchase:</label>
                        <input
                          type="date"
                          id="purchaseDate"
                          name="purchaseDate"
                          value={formData.purchaseDate}
                          onChange={handleInputChange}
                        />
                      </div>
                      </div>

                      {/* AMC & NON-AMC CUSTOMER DETAILS - SHOW ONLY IF NOT RENT SEGMENT */}
                      {formData.segment !== 'rent' && formData.customerType === 'AMC' && (
                        <div className="card" style={{ marginTop: '6px', marginBottom: '6px', padding: '8px', backgroundColor: '#e8f5e9', borderLeft: '4px solid #4caf50' }}>
                          <h4 style={{ margin: '0 0 6px 0', fontSize: '0.85rem', color: '#2e7d32' }}>🔵 AMC Customer Details</h4>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '6px' }}>
                            <div className="form-group">
                              <label htmlFor="amcStartDate">AMC Start Date:</label>
                              <input
                                type="date"
                                id="amcStartDate"
                                name="amcStartDate"
                                value={formData.amcStartDate}
                                onChange={handleInputChange}
                              />
                            </div>
                            
                            <div className="form-group">
                              <label htmlFor="amcEndDate">AMC End Date:</label>
                              <input
                                type="date"
                                id="amcEndDate"
                                name="amcEndDate"
                                value={formData.amcEndDate}
                                onChange={handleInputChange}
                              />
                            </div>
                            
                            <div className="form-group">
                              <label htmlFor="amcAmount">Annual Amount (₹):</label>
                              <input
                                type="number"
                                id="amcAmount"
                                name="amcAmount"
                                value={formData.amcAmount}
                                onChange={handleInputChange}
                                placeholder="e.g., 5000"
                              />
                            </div>
                            
                            <div className="form-group">
                              <label htmlFor="amcPaidAmount">Amount Already Paid (₹):</label>
                              <input
                                type="number"
                                id="amcPaidAmount"
                                name="amcPaidAmount"
                                value={formData.amcPaidAmount}
                                onChange={handleInputChange}
                                placeholder="e.g., 2000 (if partial payment)"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* NON-AMC CUSTOMER DETAILS - SHOW ONLY IF "Non-AMC" AND NOT RENT */}
                      {formData.segment !== 'rent' && formData.customerType === 'NON_AMC' && (
                        <div className="card" style={{ marginTop: '6px', marginBottom: '6px', padding: '8px', backgroundColor: '#fff3e0', borderLeft: '4px solid #ff9800' }}>
                          <h4 style={{ margin: '0 0 6px 0', fontSize: '0.85rem', color: '#e65100' }}>🟡 Non-AMC Customer Details</h4>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '6px' }}>
                            <div className="form-group">
                              <label htmlFor="filterChangeDate">Service/Filter Date:</label>
                              <input
                                type="date"
                                id="filterChangeDate"
                                name="filterChangeDate"
                                value={formData.filterChangeDate || ''}
                                onChange={handleInputChange}
                              />
                            </div>
                            
                            <div className="form-group">
                              <label htmlFor="filterChangeAmount">Service Amount (₹):</label>
                              <input
                                type="number"
                                id="filterChangeAmount"
                                name="filterChangeAmount"
                                value={formData.filterChangeAmount || ''}
                                onChange={handleInputChange}
                                placeholder="e.g., 500"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* RENT WATER PURIFIER FIELDS - SHOW ONLY IF RENT SEGMENT */}
                      {formData.segment === 'rent' && (
                        <div className="card" style={{ marginTop: '6px', marginBottom: '6px', padding: '8px', backgroundColor: '#f3e5f5', borderLeft: '4px solid #9c27b0' }}>
                          <h4 style={{ margin: '0 0 6px 0', fontSize: '0.85rem', color: '#6a1b9a' }}>🔑 Rent Water Purifier Details</h4>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '6px' }}>
                            <div className="form-group">
                              <label htmlFor="rentStartDate">Rent Start Date:</label>
                              <input
                                type="date"
                                id="rentStartDate"
                                name="rentStartDate"
                                value={formData.rentStartDate || ''}
                                onChange={handleInputChange}
                              />
                            </div>
                            
                            <div className="form-group">
                              <label htmlFor="monthlyRent">Monthly Rent (₹):</label>
                              <input
                                type="number"
                                id="monthlyRent"
                                name="monthlyRent"
                                value={formData.monthlyRent || ''}
                                onChange={handleInputChange}
                                placeholder="e.g., 500"
                              />
                            </div>
                            
                            <div className="form-group">
                              <label htmlFor="dailyUsageLimit">Daily Usage Limit (Liters):</label>
                              <input
                                type="number"
                                id="dailyUsageLimit"
                                name="dailyUsageLimit"
                                value={formData.dailyUsageLimit || '50'}
                                onChange={handleInputChange}
                                placeholder="e.g., 50"
                              />
                            </div>
                            
                            <div className="form-group">
                              <label htmlFor="paymentStatus">Payment Status:</label>
                              <select
                                id="paymentStatus"
                                name="paymentStatus"
                                value={formData.paymentStatus || 'pending'}
                                onChange={handleInputChange}
                                style={{ width: '100%', padding: '6px', fontSize: '11px', borderRadius: '4px', border: '1px solid #ddd' }}
                              >
                                <option value="pending">⏳ Pending</option>
                                <option value="partial">⚠️ Partial</option>
                                <option value="paid">✅ Paid</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* ADDITIONAL FIELDS */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '6px' }}>
                      <div className="form-group">
                        <label htmlFor="mapCode">Location - Google Maps Plus Code:</label>
                        <input
                          type="text"
                          id="mapCode"
                          name="mapCode"
                          value={formData.mapCode}
                          onChange={handleInputChange}
                          placeholder="e.g., JC5Q+RQV"
                        />
                      </div>
                      
                      <div className="form-group">
                        <label htmlFor="address">Customer Address:</label>
                        <textarea
                          id="address"
                          name="address"
                          value={formData.address}
                          onChange={handleInputChange}
                          placeholder="e.g., 123 Main Street, City, State, Postal Code"
                          style={{
                            width: '100%',
                            minHeight: '30px',
                            padding: '3px',
                            fontSize: '10px',
                            border: '2px solid #ddd',
                            borderRadius: '4px',
                            fontFamily: 'Arial',
                            boxSizing: 'border-box',
                            resize: 'vertical'
                          }}
                        />
                      </div>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                      <button type="submit" className="btn" style={{ flex: 1, backgroundColor: '#ff9800' }} disabled={loading}>
                        {loading ? 'Updating...' : 'Save Changes'}
                      </button>
                      <button 
                        type="button"
                        className="btn" 
                        style={{ flex: 1, backgroundColor: '#6c757d' }}
                        onClick={() => {
                          setShowForm(false);
                          setEditingId(null);
                          setFormData({ fullName: '', phone: '', segment: 'waterpurifier', machineName: '', purchaseDate: '', customerType: 'AMC', amcStartDate: '', amcEndDate: '', amcAmount: '', amcPaidAmount: '', filterChangeDate: '', filterChangeAmount: '', rentStartDate: '', monthlyRent: '', dailyUsageLimit: '50', paymentStatus: 'pending', lastPaidMonth: null, nextDueMonth: null, paidHistory: [], cardNumber: '', address: '', mapCode: '' });
                        }}
                      >
                        Cancel
                      </button>
                      </div>
                    </form>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {jobHistoryModal.show && (
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
          zIndex: 1000,
          overflow: 'auto'
        }}>
          <div className="card" style={{
            width: '95%',
            maxWidth: '1000px',
            padding: '20px',
            backgroundColor: 'white',
            borderRadius: '8px',
            margin: '20px auto'
          }}>
            <h2>📋 Job History - {jobHistoryModal.customerName}</h2>
            <p style={{ color: '#666', fontSize: '14px', marginBottom: '15px' }}>
              Total Jobs: <strong>{jobHistoryModal.jobs.length}</strong>
            </p>
            
            {jobHistoryModal.jobs.length === 0 ? (
              <p style={{ color: '#999', textAlign: 'center', padding: '20px' }}>No job history found for this customer</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '13px'
                }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                      <th style={{ padding: '10px', textAlign: 'left', borderRight: '1px solid #ddd' }}>ID</th>
                      <th style={{ padding: '10px', textAlign: 'left', borderRight: '1px solid #ddd' }}>Date Created</th>
                      <th style={{ padding: '10px', textAlign: 'left', borderRight: '1px solid #ddd' }}>Title/Issue</th>
                      <th style={{ padding: '10px', textAlign: 'left', borderRight: '1px solid #ddd' }}>Work Done</th>
                      <th style={{ padding: '10px', textAlign: 'left', borderRight: '1px solid #ddd' }}>Parts Used</th>
                      <th style={{ padding: '10px', textAlign: 'left', borderRight: '1px solid #ddd' }}>Completed Date</th>
                      <th style={{ padding: '10px', textAlign: 'left', borderRight: '1px solid #ddd' }}>Technician</th>
                      <th style={{ padding: '10px', textAlign: 'left', borderRight: '1px solid #ddd' }}>Status</th>
                      <th style={{ padding: '10px', textAlign: 'left', borderRight: '1px solid #ddd' }}>Photo</th>
                      <th style={{ padding: '10px', textAlign: 'left' }}>Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobHistoryModal.jobs.map((job, index) => (
                      <tr key={job.id} style={{ borderBottom: '1px solid #eee', backgroundColor: index % 2 === 0 ? '#fafafa' : 'white' }}>
                        <td style={{ padding: '10px', borderRight: '1px solid #ddd', color: '#0066ff', fontWeight: 'bold', fontSize: '11px' }}>
                          {job.id?.substring(0, 8)}...
                        </td>
                        <td style={{ padding: '10px', borderRight: '1px solid #ddd' }}>
                          {job.createdAt || 'N/A'}
                        </td>
                        <td style={{ padding: '10px', borderRight: '1px solid #ddd', maxWidth: '200px' }}>
                          <div style={{ fontWeight: 'bold', marginBottom: '3px' }}>{job.title || 'N/A'}</div>
                          {job.description && (
                            <div style={{ fontSize: '11px', color: '#666' }}>
                              {job.description.length > 50 ? job.description.substring(0, 50) + '...' : job.description}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '10px', borderRight: '1px solid #ddd', maxWidth: '180px', fontSize: '12px' }}>
                          {job.workDone ? (
                            <span style={{ color: '#28a745' }}>✓ {job.workDone}</span>
                          ) : (
                            <span style={{ color: '#999' }}>-</span>
                          )}
                        </td>
                        <td style={{ padding: '10px', borderRight: '1px solid #ddd', maxWidth: '150px', fontSize: '12px' }}>
                          {job.partsUsed ? (
                            <span style={{ color: '#0066ff' }}>🔧 {job.partsUsed}</span>
                          ) : (
                            <span style={{ color: '#999' }}>-</span>
                          )}
                        </td>
                        <td style={{ padding: '10px', borderRight: '1px solid #ddd' }}>
                          {job.completedAt ? (
                            <span style={{ color: '#28a745', fontWeight: 'bold' }}>{job.completedAt}</span>
                          ) : (
                            <span style={{ color: '#999' }}>Pending</span>
                          )}
                        </td>
                        <td style={{ padding: '10px', borderRight: '1px solid #ddd' }}>
                          {job.assignedTo || 'Unassigned'}
                        </td>
                        <td style={{
                          padding: '10px',
                          borderRight: '1px solid #ddd',
                          fontWeight: 'bold',
                          color: job.status === 'completed' ? '#4caf50' : job.status === 'assigned' ? '#2196F3' : '#ff9800'
                        }}>
                          {job.status ? job.status.charAt(0).toUpperCase() + job.status.slice(1) : 'N/A'}
                        </td>
                        <td style={{ padding: '10px', borderRight: '1px solid #ddd', textAlign: 'center' }}>
                          {job.photoData ? (
                            <img 
                              src={job.photoData} 
                              alt="Completed work" 
                              style={{
                                width: '60px',
                                height: '60px',
                                objectFit: 'cover',
                                borderRadius: '4px',
                                border: '1px solid #ddd',
                                cursor: 'pointer'
                              }}
                              onClick={() => window.open(job.photoData, '_blank')}
                              title="Click to view full size"
                            />
                          ) : (
                            <span style={{ color: '#999', fontSize: '16px' }}>📷</span>
                          )}
                        </td>
                        <td style={{ padding: '10px' }}>
                          {job.takePayment ? (
                            <div>
                              <div style={{ fontWeight: 'bold', color: '#d32f2f' }}>₹{job.paymentAmount || 0}</div>
                              {job.payments && job.payments.length > 0 && (
                                <div style={{ fontSize: '11px', color: '#28a745', marginTop: '3px' }}>
                                  ✓ Paid: ₹{job.payments.reduce((sum, p) => sum + (p.amount || 0), 0)}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: '#999' }}>No payment</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {/* Summary Section */}
                <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f0f7ff', borderRadius: '6px', borderLeft: '4px solid #0066ff' }}>
                  <h3 style={{ marginTop: 0, marginBottom: '15px' }}>📊 Summary</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px' }}>
                    <div>
                      <div style={{ fontSize: '12px', color: '#666' }}>Total Jobs</div>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#0066ff' }}>{jobHistoryModal.jobs.length}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#666' }}>Completed</div>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#28a745' }}>
                        {jobHistoryModal.jobs.filter(j => j.status === 'completed').length}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#666' }}>Pending</div>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ff9800' }}>
                        {jobHistoryModal.jobs.filter(j => j.status !== 'completed').length}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#666' }}>Total Payments</div>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#9c27b0' }}>
                        ₹{jobHistoryModal.jobs.reduce((sum, j) => sum + (j.takePayment ? (j.paymentAmount || 0) : 0), 0)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button 
                className="btn" 
                style={{ backgroundColor: '#6c757d' }}
                onClick={() => setJobHistoryModal({ show: false, customerId: null, customerName: '', jobs: [] })}
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
            maxWidth: '450px',
            padding: '20px',
            backgroundColor: 'white',
            borderRadius: '8px'
          }}>
            <h2>{rescheduleModalData.rescheduleType === 'service' ? '🔧 Reschedule Service' : '🔄 Reschedule AMC'}</h2>
            <p style={{ color: '#666', fontSize: '13px', marginBottom: '15px' }}>
              Customer said: <strong>{rescheduleModalData.reason}</strong>
            </p>

            <div className="form-group" style={{ marginBottom: '15px' }}>
              <label htmlFor="rescheduleDate">New Date:</label>
              <input
                type="date"
                id="rescheduleDate"
                value={rescheduleModalData.newDate}
                onChange={(e) => setRescheduleModalData({ ...rescheduleModalData, newDate: e.target.value })}
                style={{ width: '100%', padding: '8px', fontSize: '14px' }}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: '15px' }}>
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

            <div className="form-group" style={{ marginBottom: '15px' }}>
              <label htmlFor="customNotes">Additional Notes (Optional):</label>
              <textarea
                id="customNotes"
                value={rescheduleModalData.customNotes}
                onChange={(e) => setRescheduleModalData({ ...rescheduleModalData, customNotes: e.target.value })}
                placeholder="Write any additional details, special instructions, or notes..."
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
              <p style={{ fontSize: '11px', color: '#666', marginTop: '5px' }}>
                Add any special instructions, repair notes, or important details for the technician
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button 
                className="btn" 
                style={{ backgroundColor: '#6c757d' }}
                onClick={() => setRescheduleModalData({ show: false, customerId: null, rescheduleType: '', newDate: '', newTime: '', reason: '', customNotes: '' })}
              >
                Cancel
              </button>
              <button 
                className="btn" 
                style={{ backgroundColor: rescheduleModalData.rescheduleType === 'service' ? '#ff9800' : '#4caf50' }}
                onClick={confirmQuickReschedule}
              >
                Confirm Reschedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AMC Renewal Assignment Modal */}
      {amcRenewalModal.show && (
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
            borderRadius: '8px'
          }}>
            <h2>🔄 Assign AMC Renewal</h2>
            {amcRenewalModal.customer && (
              <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#fff3cd', borderRadius: '5px', border: '1px solid #ffc107' }}>
                <p style={{ margin: '0 0 5px 0', fontWeight: 'bold', color: '#333' }}>
                  {amcRenewalModal.customer.fullName || amcRenewalModal.customer.name}
                </p>
                <p style={{ margin: '5px 0', fontSize: '13px', color: '#666' }}>
                  📞 {amcRenewalModal.customer.phone} | 🎫 Card: {amcRenewalModal.customer.cardNumber}
                </p>
                <p style={{ margin: '5px 0', fontSize: '13px', color: '#666' }}>
                  🛠️ {amcRenewalModal.customer.machineName} | ₹{amcRenewalModal.customer.amcAmount}
                </p>
                <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#d32f2f', fontWeight: 'bold' }}>
                  ⚠️ AMC Expired: {amcRenewalModal.customer.amcEndDate}
                </p>
              </div>
            )}

            <div className="form-group" style={{ marginBottom: '15px' }}>
              <label htmlFor="techSelect">Select Technician:</label>
              {technicians.length === 0 ? (
                <div style={{ color: 'red', padding: '10px', backgroundColor: '#ffebee', borderRadius: '4px' }}>
                  ❌ No active technicians available. Please add technicians first.
                </div>
              ) : (
                <select
                  id="techSelect"
                  value={amcRenewalModal.selectedTech}
                  onChange={(e) => setAmcRenewalModal({ ...amcRenewalModal, selectedTech: e.target.value })}
                  style={{ width: '100%', padding: '10px', fontSize: '14px', borderRadius: '4px', border: '1px solid #ddd' }}
                  required
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

            <div className="form-group" style={{ marginBottom: '15px' }}>
              <label htmlFor="renewalDate">Scheduled Date:</label>
              <input
                type="date"
                id="renewalDate"
                value={amcRenewalModal.scheduledDate}
                onChange={(e) => setAmcRenewalModal({ ...amcRenewalModal, scheduledDate: e.target.value })}
                style={{ width: '100%', padding: '10px', fontSize: '14px', borderRadius: '4px', border: '1px solid #ddd' }}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: '15px' }}>
              <label htmlFor="renewalTime">Arrival Time:</label>
              <input
                type="time"
                id="renewalTime"
                value={amcRenewalModal.scheduledTime}
                onChange={(e) => setAmcRenewalModal({ ...amcRenewalModal, scheduledTime: e.target.value })}
                style={{ width: '100%', padding: '10px', fontSize: '14px', borderRadius: '4px', border: '1px solid #ddd' }}
                required
              />
            </div>

            <div style={{ padding: '12px', backgroundColor: '#e7f3ff', borderRadius: '5px', marginBottom: '15px' }}>
              <p style={{ margin: 0, fontSize: '13px', color: '#0066ff' }}>
                💡 <strong>Note:</strong> A ticket will be created and assigned to the selected technician for AMC renewal collection.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button 
                className="btn" 
                style={{ backgroundColor: '#6c757d' }}
                onClick={() => setAmcRenewalModal({ show: false, customer: null, selectedTech: '', scheduledDate: '', scheduledTime: '' })}
              >
                Cancel
              </button>
              <button 
                className="btn" 
                style={{ backgroundColor: '#28a745', fontWeight: 'bold' }}
                onClick={handleAssignAmcRenewal}
                disabled={loading || !amcRenewalModal.selectedTech}
              >
                {loading ? 'Assigning...' : '✅ Assign Renewal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AMC RENEWAL DATA MODAL - Technician submits renewal details */}
      {amcRenewalDataModal.show && (
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
            borderRadius: '8px'
          }}>
            <h2 style={{ marginBottom: '15px', color: '#2e7d32' }}>♻️ Process AMC Renewal</h2>
            {amcRenewalDataModal.customer && (
              <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#e8f5e9', borderRadius: '5px', border: '1px solid #4caf50' }}>
                <p style={{ margin: '0 0 5px 0', fontWeight: 'bold', color: '#333' }}>
                  {amcRenewalDataModal.customer.fullName || amcRenewalDataModal.customer.name}
                </p>
                <p style={{ margin: '5px 0', fontSize: '13px', color: '#666' }}>
                  📞 {amcRenewalDataModal.customer.phone} | 🎫 Card: {amcRenewalDataModal.customer.cardNumber}
                </p>
                <p style={{ margin: '5px 0', fontSize: '13px', color: '#d32f2f', fontWeight: 'bold' }}>
                  ⚠️ Previous AMC Expired: {amcRenewalDataModal.customer.amcEndDate}
                </p>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
              <div className="form-group">
                <label htmlFor="newAmcStartDate">New AMC Start Date: *</label>
                <input
                  type="date"
                  id="newAmcStartDate"
                  value={amcRenewalDataModal.newAmcStartDate}
                  onChange={(e) => setAmcRenewalDataModal({ ...amcRenewalDataModal, newAmcStartDate: e.target.value })}
                  style={{ width: '100%', padding: '10px', fontSize: '14px', borderRadius: '4px', border: '1px solid #ddd' }}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="duration">Duration (months): *</label>
                <select
                  id="duration"
                  value={amcRenewalDataModal.duration}
                  onChange={(e) => setAmcRenewalDataModal({ ...amcRenewalDataModal, duration: e.target.value })}
                  style={{ width: '100%', padding: '10px', fontSize: '14px', borderRadius: '4px', border: '1px solid #ddd' }}
                >
                  <option value="6">6 Months</option>
                  <option value="12">1 Year (12 Months)</option>
                  <option value="24">2 Years (24 Months)</option>
                  <option value="36">3 Years (36 Months)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
              <div className="form-group">
                <label htmlFor="newAmcAmount">New Annual Amount (₹): *</label>
                <input
                  type="number"
                  id="newAmcAmount"
                  value={amcRenewalDataModal.newAmcAmount}
                  onChange={(e) => setAmcRenewalDataModal({ ...amcRenewalDataModal, newAmcAmount: e.target.value })}
                  placeholder="e.g., 5000"
                  style={{ width: '100%', padding: '10px', fontSize: '14px', borderRadius: '4px', border: '1px solid #ddd' }}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="newAmcPaidAmount">Amount Already Paid (₹):</label>
                <input
                  type="number"
                  id="newAmcPaidAmount"
                  value={amcRenewalDataModal.newAmcPaidAmount}
                  onChange={(e) => setAmcRenewalDataModal({ ...amcRenewalDataModal, newAmcPaidAmount: e.target.value })}
                  placeholder="0 if full payment pending"
                  style={{ width: '100%', padding: '10px', fontSize: '14px', borderRadius: '4px', border: '1px solid #ddd' }}
                />
              </div>
            </div>

            <div style={{ padding: '12px', backgroundColor: '#fff3cd', borderRadius: '5px', marginBottom: '15px' }}>
              <p style={{ margin: 0, fontSize: '13px', color: '#856404' }}>
                ℹ️ <strong>This will:</strong><br/>
                ✓ Update customer's AMC details<br/>
                ✓ Reset AMC cycle to 0/4<br/>
                ✓ Generate 4 new quarterly services<br/>
                ✓ Archive old pending services<br/>
                ✓ Update Google Contact profile
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                className="btn"
                style={{ backgroundColor: '#6c757d' }}
                onClick={() => setAmcRenewalDataModal({ show: false, customer: null, newAmcStartDate: '', newAmcAmount: '', newAmcPaidAmount: '', duration: '12' })}
              >
                Cancel
              </button>
              <button
                className="btn"
                style={{ backgroundColor: '#28a745', fontWeight: 'bold' }}
                onClick={handleSubmitAMCRenewal}
                disabled={loading || !amcRenewalDataModal.newAmcStartDate || !amcRenewalDataModal.newAmcAmount}
              >
                {loading ? '⏳ Processing...' : '✅ Confirm Renewal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Call Log & History Modal */}
      {callLogModal.show && (
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
          zIndex: 1000,
          padding: '20px',
          overflowY: 'auto'
        }}>
          <div className="card" style={{
            width: '95%',
            maxWidth: '900px',
            padding: '25px',
            backgroundColor: 'white',
            borderRadius: '10px',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <h2 style={{ marginBottom: '10px' }}>📞 Call Tracking & Notes</h2>
            {callLogModal.customer && (
              <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#e3f2fd', borderRadius: '5px', border: '1px solid #2196f3' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ margin: '0 0 5px 0', fontWeight: 'bold', fontSize: '16px', color: '#333' }}>
                      {callLogModal.customer.fullName || callLogModal.customer.name}
                    </p>
                    <p style={{ margin: '5px 0', fontSize: '13px', color: '#666' }}>
                      📞 {callLogModal.customer.phone} | 🎫 Card: {callLogModal.customer.cardNumber} | 🛠️ {callLogModal.customer.machineName}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '12px', color: '#666' }}>Total Calls:</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2196f3' }}>{callLogModal.callLogs.length}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Add New Call Log Form */}
            <div style={{ marginBottom: '25px', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '2px solid #6f42c1' }}>
              <h3 style={{ marginTop: 0, color: '#6f42c1' }}>➕ Log New Call</h3>
              
              <div className="form-group" style={{ marginBottom: '15px' }}>
                <label htmlFor="callStatus">Call Status: *</label>
                <select
                  id="callStatus"
                  value={callLogModal.newLog.callStatus}
                  onChange={(e) => {
                    const status = e.target.value;
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    const tomorrowStr = tomorrow.toISOString().split('T')[0];
                    
                    // Auto-set follow-up date for specific statuses
                    const statusesNeedingFollowUp = ['Not Picked', 'Call Back', 'Follow-up Needed', 'Busy'];
                    const newFollowUpDate = statusesNeedingFollowUp.includes(status) ? tomorrowStr : callLogModal.newLog.nextFollowUpDate;
                    
                    setCallLogModal({
                      ...callLogModal,
                      newLog: { 
                        ...callLogModal.newLog, 
                        callStatus: status,
                        nextFollowUpDate: newFollowUpDate
                      }
                    });
                  }}
                  style={{ width: '100%', padding: '10px', fontSize: '14px', borderRadius: '4px', border: '1px solid #ddd' }}
                  required
                >
                  <option value="">-- Select status --</option>
                  <option value="Not Picked">🚫 Not Picked / No Answer</option>
                  <option value="Call Back">🔄 Asked to Call Back Later</option>
                  <option value="Confirmed">✅ Service/AMC Confirmed</option>
                  <option value="Follow-up Needed">📅 Follow-up Needed</option>
                  <option value="Not Interested">❌ Not Interested</option>
                  <option value="Wrong Number">☎️ Wrong Number</option>
                  <option value="Busy">⏱️ Customer Busy</option>
                  <option value="Payment Pending">💸 Payment Discussion</option>
                  <option value="Rescheduled">📆 Rescheduled</option>
                  <option value="Complaint">⚠️ Complaint/Issue</option>
                  <option value="Other">📋 Other</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '15px' }}>
                <label htmlFor="callNotes">
                  Conversation Notes:
                  {['Confirmed', 'Payment Pending', 'Rescheduled', 'Complaint', 'Other'].includes(callLogModal.newLog.callStatus) && <span style={{ color: 'red' }}> *</span>}
                  {!['Confirmed', 'Payment Pending', 'Rescheduled', 'Complaint', 'Other'].includes(callLogModal.newLog.callStatus) && <span style={{ color: '#999', fontSize: '12px' }}> (Optional)</span>}
                </label>
                <textarea
                  id="callNotes"
                  value={callLogModal.newLog.notes}
                  onChange={(e) => setCallLogModal({
                    ...callLogModal,
                    newLog: { ...callLogModal.newLog, notes: e.target.value }
                  })}
                  placeholder="Write exactly what customer said... \n\nExamples:\n- 'Call me back tomorrow at 3 PM'\n- 'AMC will renew next month'\n- 'Machine working fine, don't need service'\n- 'Payment will be done on 15th'\n- 'Not available this week, call next week'"
                  style={{
                    width: '100%',
                    height: '100px',
                    padding: '10px',
                    fontSize: '14px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    boxSizing: 'border-box',
                    fontFamily: 'Arial',
                    resize: 'vertical'
                  }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <div className="form-group">
                  <label htmlFor="followUpDate">Next Follow-up Date:</label>
                  <input
                    type="date"
                    id="followUpDate"
                    value={callLogModal.newLog.nextFollowUpDate}
                    onChange={(e) => setCallLogModal({
                      ...callLogModal,
                      newLog: { ...callLogModal.newLog, nextFollowUpDate: e.target.value }
                    })}
                    style={{ width: '100%', padding: '10px', fontSize: '14px', borderRadius: '4px', border: '1px solid #ddd' }}
                  />
                  <p style={{ fontSize: '11px', color: '#666', marginTop: '3px' }}>When to call customer again</p>
                </div>
                <div className="form-group">
                  <label htmlFor="followUpTime">Preferred Time:</label>
                  <input
                    type="time"
                    id="followUpTime"
                    value={callLogModal.newLog.nextFollowUpTime}
                    onChange={(e) => setCallLogModal({
                      ...callLogModal,
                      newLog: { ...callLogModal.newLog, nextFollowUpTime: e.target.value }
                    })}
                    style={{ width: '100%', padding: '10px', fontSize: '14px', borderRadius: '4px', border: '1px solid #ddd' }}
                  />
                  <p style={{ fontSize: '11px', color: '#666', marginTop: '3px' }}>Optional time reminder</p>
                </div>
              </div>

              <button
                className="btn"
                style={{ backgroundColor: '#6f42c1', fontWeight: 'bold', width: '100%', padding: '12px' }}
                onClick={handleSaveCallLog}
                disabled={loading}
              >
                {loading ? '⏳ Saving...' : '✅ Save Call Log'}
              </button>
            </div>

            {/* Call History Timeline */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '2px solid #ddd', paddingBottom: '10px' }}>
                <h3 style={{ margin: 0 }}>
                  📅 Call History ({callLogModal.callLogs.length})
                </h3>
                {callLogModal.callLogs.length > 0 && (
                  <button
                    className="btn"
                    style={{ backgroundColor: '#dc3545', padding: '8px 15px', fontSize: '13px', fontWeight: 'bold' }}
                    onClick={handleDeleteAllCallLogs}
                    disabled={loading}
                  >
                    🗑️ Delete All Logs
                  </button>
                )}
              </div>
              
              {callLogModal.callLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#999', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
                  <div style={{ fontSize: '48px', marginBottom: '10px' }}>📞</div>
                  <p>No call history yet. Log your first call above!</p>
                </div>
              ) : (
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8f9fa', zIndex: 1 }}>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '10px', borderBottom: '2px solid #ddd', fontSize: '13px' }}>Date & Time</th>
                        <th style={{ textAlign: 'left', padding: '10px', borderBottom: '2px solid #ddd', fontSize: '13px' }}>Status</th>
                        <th style={{ textAlign: 'left', padding: '10px', borderBottom: '2px solid #ddd', fontSize: '13px' }}>Notes</th>
                        <th style={{ textAlign: 'left', padding: '10px', borderBottom: '2px solid #ddd', fontSize: '13px' }}>Next Follow-up</th>
                        <th style={{ textAlign: 'center', padding: '10px', borderBottom: '2px solid #ddd', fontSize: '13px' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {callLogModal.callLogs.map((log, idx) => {
                        const statusColors = {
                          'Confirmed': '#28a745',
                          'Not Picked': '#dc3545',
                          'Call Back': '#ffc107',
                          'Follow-up Needed': '#17a2b8',
                          'Not Interested': '#6c757d',
                          'Wrong Number': '#e74c3c',
                          'Busy': '#f39c12',
                          'Payment Pending': '#9b59b6',
                          'Rescheduled': '#3498db',
                          'Complaint': '#e67e22'
                        };
                        const statusColor = statusColors[log.callStatus] || '#6c757d';
                        
                        return (
                          <tr key={log.id || idx} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '12px', fontSize: '13px', verticalAlign: 'top' }}>
                              <div style={{ fontWeight: 'bold', color: '#333' }}>{log.callDate}</div>
                              <div style={{ fontSize: '12px', color: '#999' }}>{log.callTime}</div>
                            </td>
                            <td style={{ padding: '12px', verticalAlign: 'top' }}>
                              <span style={{
                                backgroundColor: statusColor,
                                color: 'white',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                whiteSpace: 'nowrap'
                              }}>
                                {log.callStatus}
                              </span>
                            </td>
                            <td style={{ padding: '12px', fontSize: '13px', color: '#555', maxWidth: '300px', verticalAlign: 'top' }}>
                              {log.notes}
                            </td>
                            <td style={{ padding: '12px', fontSize: '12px', verticalAlign: 'top' }}>
                              {log.nextFollowUpDate ? (
                                <div>
                                  <div style={{ color: '#2196f3', fontWeight: 'bold' }}>
                                    📅 {log.nextFollowUpDate}
                                  </div>
                                  {log.nextFollowUpTime && (
                                    <div style={{ color: '#666', fontSize: '11px' }}>
                                      ⏰ {log.nextFollowUpTime}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span style={{ color: '#999' }}>-</span>
                              )}
                            </td>
                            <td style={{ padding: '12px', textAlign: 'center', verticalAlign: 'top' }}>
                              <button
                                className="btn"
                                style={{ 
                                  backgroundColor: '#dc3545', 
                                  padding: '5px 10px', 
                                  fontSize: '11px',
                                  minWidth: 'auto'
                                }}
                                onClick={() => handleDeleteCallLog(log.id)}
                                disabled={loading}
                              >
                                🗑️ Delete
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px', paddingTop: '15px', borderTop: '2px solid #ddd' }}>
              <button
                className="btn"
                style={{ backgroundColor: '#6c757d' }}
                onClick={() => setCallLogModal({
                  show: false,
                  customer: null,
                  callLogs: [],
                  newLog: { callStatus: '', notes: '', nextFollowUpDate: '', nextFollowUpTime: '' }
                })}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Complaint Modal */}
      {complaintModal.show && (
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
            padding: '25px',
            backgroundColor: 'white',
            borderRadius: '8px',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <h2>⚠️ Create Complaint</h2>
            
            <div style={{ backgroundColor: '#fff3cd', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #ffc107' }}>
              <p style={{ margin: '0 0 5px 0' }}><strong>Customer:</strong> {complaintModal.customer?.fullName || complaintModal.customer?.name}</p>
              <p style={{ margin: '5px 0 5px 0' }}><strong>Phone:</strong> {complaintModal.customer?.phone}</p>
              <p style={{ margin: '5px 0 0 0' }}><strong>Card #:</strong> {complaintModal.customer?.cardNumber}</p>
            </div>

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label htmlFor="complaintTitle">Complaint Title: *</label>
              <input
                type="text"
                id="complaintTitle"
                value={complaintModal.title}
                onChange={(e) => setComplaintModal({ ...complaintModal, title: e.target.value })}
                placeholder="e.g., AC not cooling, Refrigerator making noise"
                style={{ width: '100%', padding: '10px', fontSize: '14px', borderRadius: '4px', border: '1px solid #ddd' }}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label htmlFor="complaintDescription">Description:</label>
              <textarea
                id="complaintDescription"
                value={complaintModal.description}
                onChange={(e) => setComplaintModal({ ...complaintModal, description: e.target.value })}
                placeholder="Provide detailed description of the issue..."
                rows="4"
                style={{ width: '100%', padding: '10px', fontSize: '14px', borderRadius: '4px', border: '1px solid #ddd' }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label htmlFor="complaintPriority">Priority:</label>
              <select
                id="complaintPriority"
                value={complaintModal.priority}
                onChange={(e) => setComplaintModal({ ...complaintModal, priority: e.target.value })}
                style={{ width: '100%', padding: '10px', fontSize: '14px', borderRadius: '4px', border: '1px solid #ddd' }}
              >
                <option value="low">🟢 Low</option>
                <option value="medium">🟡 Medium</option>
                <option value="high">🔴 High</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label htmlFor="complaintTech">Assign Technician (Optional):</label>
              <select
                id="complaintTech"
                value={complaintModal.selectedTech}
                onChange={(e) => setComplaintModal({ ...complaintModal, selectedTech: e.target.value })}
                style={{ width: '100%', padding: '10px', fontSize: '14px', borderRadius: '4px', border: '1px solid #ddd' }}
              >
                <option value="">-- Don't Assign (Open) --</option>
                {technicians.map(tech => (
                  <option key={tech.id} value={tech.id}>
                    👤 {tech.name} {tech.phone ? `(${tech.phone})` : ''}
                  </option>
                ))}
              </select>
              <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>Leave blank to create as unassigned, or select a technician to assign immediately</p>
            </div>

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label htmlFor="complaintDate" style={{ fontWeight: 'bold', marginBottom: '5px', display: 'block' }}>
                Scheduled Date: <span style={{ fontSize: '12px', color: '#28a745', fontWeight: 'normal' }}>(auto-filled, editable)</span>
              </label>
              <input
                type="date"
                id="complaintDate"
                value={complaintModal.scheduledDate}
                onChange={(e) => setComplaintModal({ ...complaintModal, scheduledDate: e.target.value })}
                style={{ width: '100%', padding: '10px', fontSize: '14px', borderRadius: '4px', border: '1px solid #ddd' }}
              />
              <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>Date when you want to resolve this complaint (auto-filled with today's date)</p>
            </div>

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label htmlFor="complaintTime" style={{ fontWeight: 'bold', marginBottom: '5px', display: 'block' }}>
                Start Time: <span style={{ fontSize: '12px', color: '#28a745', fontWeight: 'normal' }}>(auto-filled +30 min, editable)</span>
              </label>
              <input
                type="time"
                id="complaintTime"
                value={complaintModal.scheduledTime}
                onChange={(e) => setComplaintModal({ ...complaintModal, scheduledTime: e.target.value })}
                style={{ width: '100%', padding: '10px', fontSize: '14px', borderRadius: '4px', border: '1px solid #ddd' }}
              />
              <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>Preferred time to address this complaint (auto-filled with current time + 30 minutes)</p>
            </div>

            <div className="form-group" style={{ padding: '15px', backgroundColor: '#f0f4ff', borderRadius: '5px', border: '1px solid #0066ff', marginBottom: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: '10px' }}>
                <input
                  type="checkbox"
                  checked={complaintModal.takePayment || false}
                  onChange={(e) => setComplaintModal({ ...complaintModal, takePayment: e.target.checked, paymentAmount: e.target.checked ? complaintModal.paymentAmount : '' })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <span style={{ fontWeight: 'bold', color: '#001a4d' }}>💰 Collect Payment from Customer</span>
              </label>
              {complaintModal.takePayment && (
                <div>
                  <label htmlFor="complaintPaymentAmount" style={{ display: 'block', marginBottom: '8px' }}>Payment Amount (₹):</label>
                  <input
                    type="number"
                    id="complaintPaymentAmount"
                    value={complaintModal.paymentAmount}
                    onChange={(e) => setComplaintModal({ ...complaintModal, paymentAmount: e.target.value })}
                    placeholder="Enter amount to collect"
                    step="0.01"
                    min="0"
                    style={{ width: '100%', padding: '8px', fontSize: '14px', borderColor: '#0066ff', borderRadius: '4px' }}
                  />
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                className="btn"
                style={{ backgroundColor: '#6c757d', padding: '12px 20px' }}
                onClick={() => setComplaintModal({
                  show: false,
                  customer: null,
                  title: '',
                  description: '',
                  priority: 'medium',
                  selectedTech: '',
                  scheduledDate: '',
                  scheduledTime: '',
                  takePayment: false,
                  paymentAmount: ''
                })}
              >
                Cancel
              </button>
              <button
                className="btn"
                style={{ backgroundColor: '#dc3545', padding: '12px 20px', fontWeight: 'bold' }}
                onClick={handleSaveComplaint}
                disabled={loading}
              >
                {loading ? '⏳ Creating...' : '✅ Create Complaint'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Service Assignment Modal */}
      {serviceAssignModal.show && (
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
            padding: '25px',
            backgroundColor: 'white',
            borderRadius: '8px',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <h2>🔧 Assign Service (Unified Assignment)</h2>
            
            <div style={{ backgroundColor: '#e3f2fd', padding: '12px', borderRadius: '6px', marginBottom: '15px', border: '1px solid #2196f3' }}>
              <p style={{ margin: 0, fontSize: '13px', color: '#01579b' }}>
                <strong>ℹ️ Info:</strong> Technician assigned here syncs everywhere. No re-assignment needed in Tickets/Complaints.
              </p>
            </div>
            
            <div style={{ backgroundColor: '#fff3cd', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #ffc107' }}>
              <p style={{ margin: '0 0 5px 0' }}><strong>Customer:</strong> {serviceAssignModal.customer?.fullName || serviceAssignModal.customer?.name}</p>
              <p style={{ margin: '5px 0 5px 0' }}><strong>Phone:</strong> {serviceAssignModal.customer?.phone}</p>
              <p style={{ margin: '5px 0 0 0' }}><strong>Card #:</strong> {serviceAssignModal.customer?.cardNumber}</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div className="form-group">
                <label htmlFor="serviceType" style={{ fontWeight: 'bold', marginBottom: '5px', display: 'block' }}>Service Type:</label>
                <select
                  id="serviceType"
                  value={serviceAssignModal.serviceType}
                  onChange={(e) => setServiceAssignModal({ ...serviceAssignModal, serviceType: e.target.value })}
                  style={{ width: '100%', padding: '10px', fontSize: '14px', borderColor: '#0066ff', borderRadius: '4px' }}
                >
                  <option value="">-- Select Service Type --</option>
                  <option value="Maintenance">Maintenance</option>
                  <option value="Repair">Repair</option>
                  <option value="Installation">Installation</option>
                  <option value="Inspection">Inspection</option>
                  <option value="Cleaning">Cleaning</option>
                  <option value="Filter Change">Filter Change</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="assignTech" style={{ fontWeight: 'bold', marginBottom: '5px', display: 'block' }}>
                  Assign Technician: <span style={{ fontSize: '12px', color: '#666', fontWeight: 'normal' }}>(one-time assignment)</span>
                </label>
                <select
                  id="assignTech"
                  value={serviceAssignModal.selectedTech}
                  onChange={async (e) => {
                    const newTechId = e.target.value;
                    setServiceAssignModal({ ...serviceAssignModal, selectedTech: newTechId });
                    // Check for conflicts when technician changes
                    if (newTechId && serviceAssignModal.scheduledTime) {
                      const dateForConflictCheck = serviceAssignModal.scheduledDate || (() => {
                        const today = new Date();
                        const year = today.getFullYear();
                        const month = String(today.getMonth() + 1).padStart(2, '0');
                        const day = String(today.getDate()).padStart(2, '0');
                        return `${year}-${month}-${day}`;
                      })();
                      await checkServiceTimeConflict(
                        newTechId,
                        dateForConflictCheck,
                        serviceAssignModal.scheduledTime,
                        serviceAssignModal.customer?.segment || 'waterpurifier'
                      );
                    }
                  }}
                  style={{ width: '100%', padding: '10px', fontSize: '14px', borderColor: '#0066ff', borderRadius: '4px' }}
                >
                  <option value="">-- Select Technician (Optional) --</option>
                  {technicians.map(tech => (
                    <option key={tech.id} value={tech.id}>
                      {tech.name} {tech.phone ? `(${tech.phone})` : ''}
                    </option>
                  ))}
                </select>
                <small style={{ fontSize: '11px', color: '#666', marginTop: '4px', display: 'block' }}>
                  ⚡ Technician syncs to Tickets/Complaints automatically. Leave blank for unassigned.
                </small>
              </div>

              <div className="form-group">
                <label htmlFor="serviceDate" style={{ fontWeight: 'bold', marginBottom: '5px', display: 'block' }}>
                  Scheduled Date: <span style={{ fontSize: '12px', color: '#28a745', fontWeight: 'normal' }}>(auto-filled, editable)</span>
                </label>
                <input
                  type="date"
                  id="serviceDate"
                  value={serviceAssignModal.scheduledDate}
                  onChange={(e) => setServiceAssignModal({ ...serviceAssignModal, scheduledDate: e.target.value })}
                  style={{ width: '100%', padding: '10px', fontSize: '14px', borderColor: '#0066ff', borderRadius: '4px' }}
                />
              </div>

              <div className="form-group">
                <label htmlFor="serviceTime" style={{ fontWeight: 'bold', marginBottom: '5px', display: 'block' }}>
                  Start Time: <span style={{ fontSize: '12px', color: '#28a745', fontWeight: 'normal' }}>(auto-filled +30 min, editable)</span>
                </label>
                <input
                  type="time"
                  id="serviceTime"
                  value={serviceAssignModal.scheduledTime}
                  onChange={async (e) => {
                    const newTime = e.target.value;
                    setServiceAssignModal({ ...serviceAssignModal, scheduledTime: newTime });
                    // Check for conflicts when time changes
                    if (serviceAssignModal.selectedTech && newTime) {
                      const dateForConflictCheck = serviceAssignModal.scheduledDate || (() => {
                        const today = new Date();
                        const year = today.getFullYear();
                        const month = String(today.getMonth() + 1).padStart(2, '0');
                        const day = String(today.getDate()).padStart(2, '0');
                        return `${year}-${month}-${day}`;
                      })();
                      await checkServiceTimeConflict(
                        serviceAssignModal.selectedTech,
                        dateForConflictCheck,
                        newTime,
                        serviceAssignModal.customer?.segment || 'waterpurifier'
                      );
                    }
                  }}
                  style={{ width: '100%', padding: '10px', fontSize: '14px', borderColor: '#0066ff', borderRadius: '4px' }}
                />
                {serviceAssignModal.endTime && (
                  <small style={{ fontSize: '11px', color: '#28a745', marginTop: '4px', display: 'block' }}>
                    🕗 Est. End Time: {technicianScheduleService.format12Hour(serviceAssignModal.endTime)}
                  </small>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="serviceDesc" style={{ fontWeight: 'bold', marginBottom: '5px', display: 'block' }}>Service Description / Notes:</label>
                <textarea
                  id="serviceDesc"
                  value={serviceAssignModal.description}
                  onChange={(e) => setServiceAssignModal({ ...serviceAssignModal, description: e.target.value })}
                  placeholder="Enter service details or notes (optional)"
                  style={{ width: '100%', padding: '10px', fontSize: '14px', borderColor: '#0066ff', borderRadius: '4px', minHeight: '80px', fontFamily: 'Arial' }}
                />
              </div>
            </div>

            {/* ⚠️ CONFLICT WARNING */}
            {serviceAssignModal.conflictWarning && (
              <div style={{
                backgroundColor: '#fff3cd',
                border: '2px solid #ffc107',
                borderRadius: '8px',
                padding: '15px',
                marginTop: '20px'
              }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#856404', fontSize: '14px' }}>
                  ⚠️ Time Conflict Detected
                </h4>
                <pre style={{
                  whiteSpace: 'pre-wrap',
                  fontSize: '12px',
                  color: '#856404',
                  margin: 0,
                  fontFamily: 'Arial'
                }}>
                  {serviceAssignModal.conflictWarning}
                </pre>
                <p style={{ margin: '10px 0 0 0', fontSize: '12px', color: '#856404' }}>
                  💡 <strong>Admin Override:</strong> You can continue anyway if needed.
                </p>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px', paddingTop: '15px', borderTop: '2px solid #ddd' }}>
              <button
                className="btn"
                style={{ backgroundColor: '#6c757d', padding: '12px 20px' }}
                onClick={() => setServiceAssignModal({
                  show: false,
                  customer: null,
                  selectedTech: '',
                  serviceType: '',
                  scheduledDate: '',
                  scheduledTime: '',
                  description: ''
                })}
              >
                Cancel
              </button>
              <button
                className="btn"
                style={{ backgroundColor: '#ff9800', padding: '12px 20px', fontWeight: 'bold' }}
                onClick={handleSaveServiceAssignment}
                disabled={loading}
              >
                {loading ? '⏳ Assigning...' : '🔧 Assign Service'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Section at BOTTOM with smaller size */}
      <div className="card" style={{ marginTop: '30px', marginBottom: '20px', backgroundColor: '#f0f7ff', borderLeft: '4px solid #0066ff', padding: '15px' }}>
        <h4 style={{ marginTop: 0, marginBottom: '10px', fontSize: '14px' }}>📤 Export Data</h4>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button 
            className="btn" 
            onClick={exportToVCard}
            style={{ backgroundColor: '#28a745', padding: '8px 12px', fontSize: '12px', minWidth: 'auto' }}
          >
            📇 vCard
          </button>
          <button 
            className="btn" 
            onClick={exportToCSV}
            style={{ backgroundColor: '#ff9800', padding: '8px 12px', fontSize: '12px', minWidth: 'auto' }}
          >
            📊 CSV
          </button>
          <button 
            className="btn" 
            onClick={exportToExcel}
            style={{ backgroundColor: '#9c27b0', padding: '8px 12px', fontSize: '12px', minWidth: 'auto' }}
          >
            📋 Excel
          </button>
        </div>
      </div>
    </div>
  );
};

export default Customers;
