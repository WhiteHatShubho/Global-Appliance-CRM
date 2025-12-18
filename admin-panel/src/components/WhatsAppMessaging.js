import React, { useState, useEffect } from 'react';
import dataService from '../services/dataService';
import rentPaymentService from '../services/rentPaymentService';

const WhatsAppMessaging = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('service');
  const [selectedCustomers, setSelectedCustomers] = useState(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [messageTemplate, setMessageTemplate] = useState('service');
  const [customMessage, setCustomMessage] = useState('');
  const [reviewLink, setReviewLink] = useState('https://g.page/r/CZ2-UgUOW_0AEBM/review');
  const [paymentLink, setPaymentLink] = useState('https://payment.yourdomain.com/rent');
  const [sendingIndex, setSendingIndex] = useState(null);
  const [isSending, setIsSending] = useState(false);

  const MESSAGE_TEMPLATES = {
    service: 'Hi {CustomerName},\n\nYour service for {ProductName} is due. Please schedule a service appointment.\n\nDue Date: {ServiceDueDate}\n\nThank you!',
    amc: 'Hi {CustomerName},\n\nYour AMC for {ProductName} is expiring on {AMCEndDate}.\n\nPlease renew your AMC today.\n\nAMC Amount: ₹{AMCAmount}\n\nThank you!',
    payment: 'Hi {CustomerName},\n\nYou have a pending payment of ₹{AmountDue} for {ProductName}.\n\nPlease pay at your earliest convenience.\n\nThank you!',
    rent: 'Hi {CustomerName},\n\nYour monthly rent of ₹{MonthlyRent} for {ProductName} is due for {DueMonth}.\n\nPlease make the payment at your earliest convenience.\n\n💳 Payment Link: {PaymentLink}\n\nThank you!',
    review: 'Hi {CustomerName},\n\nWe recently completed your service for {ProductName}.\n\nPlease share your feedback and rate your experience here:\n\n{ReviewLink}\n\nThank you for choosing us!'
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const allCustomers = await dataService.getCustomers(true);
      const allTickets = await dataService.getTickets();
      
      // Enrich customers with service and payment data
      const enrichedCustomers = allCustomers.map(customer => {
        const customerTickets = allTickets.filter(t => t.customerId === customer.id);
        const pendingTicket = customerTickets.find(t => t.status === 'assigned' || t.status === 'open');
        const completedTicket = customerTickets.find(t => t.status === 'completed');
        
        const today = new Date();
        const amcEndDate = customer.amcEndDate ? new Date(customer.amcEndDate) : null;
        const daysUntilAMCExpiry = amcEndDate ? Math.floor((amcEndDate - today) / (1000 * 60 * 60 * 24)) : null;
        
        // Check if rent is due
        const rentDue = customer.segment === 'rent' && rentPaymentService.isRentDue(customer);
        const dueMonth = customer.nextDueMonth || rentPaymentService.getCurrentMonth();
        
        return {
          ...customer,
          service_status: pendingTicket ? 'pending' : 'completed',
          amc_status: daysUntilAMCExpiry !== null && daysUntilAMCExpiry <= 30 ? (daysUntilAMCExpiry < 0 ? 'expired' : 'expiring') : 'active',
          payment_status: pendingTicket && pendingTicket.takePayment ? 'due' : 'completed',
          rent_status: rentDue ? 'due' : 'paid',
          job_status: completedTicket ? 'completed' : 'pending',
          review_sent: completedTicket && completedTicket.reviewSent ? true : false,
          lastServiceDate: completedTicket?.createdAt || '-',
          amountDue: pendingTicket?.paymentAmount || 0,
          dueMonth: dueMonth
        };
      });
      
      setCustomers(enrichedCustomers);
    } catch (error) {
      console.error('Error loading customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredCustomers = () => {
    switch (activeTab) {
      case 'service':
        return customers.filter(c => c.service_status === 'pending');
      case 'amc':
        return customers.filter(c => (c.amc_status === 'expiring' || c.amc_status === 'expired') && !c.renewedAMC);
      case 'payment':
        return customers.filter(c => c.payment_status === 'due');
      case 'rent':
        return customers.filter(c => c.segment === 'rent' && c.rent_status === 'due');
      case 'review':
        return customers.filter(c => c.job_status === 'completed' && !c.review_sent);
      default:
        return [];
    }
  };

  const handleSelectCustomer = (customerId) => {
    const newSelected = new Set(selectedCustomers);
    if (newSelected.has(customerId)) {
      newSelected.delete(customerId);
    } else {
      newSelected.add(customerId);
    }
    setSelectedCustomers(newSelected);
    setSelectAll(newSelected.size === getFilteredCustomers().length);
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedCustomers(new Set());
      setSelectAll(false);
    } else {
      const filteredIds = new Set(getFilteredCustomers().map(c => c.id));
      setSelectedCustomers(filteredIds);
      setSelectAll(true);
    }
  };

  const prepareMessage = (customer) => {
    let template = customMessage || MESSAGE_TEMPLATES[messageTemplate];
    
    template = template.replace('{CustomerName}', customer.fullName || customer.name || 'Customer');
    template = template.replace('{ProductName}', customer.machineName || 'Product');
    template = template.replace('{ServiceDueDate}', customer.amcEndDate || 'Soon');
    template = template.replace('{AMCEndDate}', customer.amcEndDate || 'Soon');
    template = template.replace('{AMCAmount}', customer.amcAmount || '0');
    template = template.replace('{AmountDue}', customer.amountDue || '0');
    template = template.replace('{MonthlyRent}', customer.monthlyRent || '0');
    template = template.replace('{DueMonth}', customer.dueMonth || rentPaymentService.getCurrentMonth());
    template = template.replace('{PaymentLink}', paymentLink);
    template = template.replace('{ReviewLink}', reviewLink);
    
    return template;
  };

  const sendWhatsAppMessages = async () => {
    if (selectedCustomers.size === 0) {
      alert('Please select at least one customer');
      return;
    }

    setIsSending(true);
    const selectedList = getFilteredCustomers().filter(c => selectedCustomers.has(c.id));
    
    for (let i = 0; i < selectedList.length; i++) {
      const customer = selectedList[i];
      const phone = customer.phone?.replace(/[^0-9]/g, '');
      
      if (!phone) {
        alert(`Customer ${customer.fullName || customer.name} has no phone number. Skipping...`);
        continue;
      }

      setSendingIndex(i);
      const message = prepareMessage(customer);
      const encodedMessage = encodeURIComponent(message);
      const whatsappLink = `https://wa.me/${phone}?text=${encodedMessage}`;

      // Open WhatsApp chat
      window.open(whatsappLink, '_blank');

      // Wait before opening next chat (give user time to send or close)
      if (i < selectedList.length - 1) {
        await new Promise(resolve => {
          setTimeout(() => {
            resolve();
          }, 2000);
        });
      }
    }

    setSendingIndex(null);
    setIsSending(false);
    alert('All selected customers have been opened in WhatsApp!\n\nPlease send each message manually.');
    setSelectedCustomers(new Set());
    setSelectAll(false);
  };

  const filteredData = getFilteredCustomers();
  const tabCounts = {
    service: customers.filter(c => c.service_status === 'pending').length,
    amc: customers.filter(c => (c.amc_status === 'expiring' || c.amc_status === 'expired') && !c.renewedAMC).length,
    payment: customers.filter(c => c.payment_status === 'due').length,
    rent: customers.filter(c => c.segment === 'rent' && c.rent_status === 'due').length,
    review: customers.filter(c => c.job_status === 'completed' && !c.review_sent).length
  };

  return (
    <div className="content">
      <div style={{ marginBottom: '20px' }}>
        <h1>📱 Bulk WhatsApp Messaging</h1>
        <p style={{ color: '#666', fontSize: '14px', marginTop: '5px' }}>
          Send personalized WhatsApp messages to customers based on their status. Messages open one by one for manual sending.
        </p>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid #ddd', paddingBottom: '10px', flexWrap: 'wrap' }}>
        {[
          { id: 'service', label: '🔧 Due Service', icon: '🔧' },
          { id: 'amc', label: '🔄 AMC Renewal', icon: '🔄' },
          { id: 'payment', label: '💰 Due Payment', icon: '💰' },
          { id: 'rent', label: '🏠 Rent Collection', icon: '🏠' },
          { id: 'review', label: '⭐ Review Request', icon: '⭐' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setSelectedCustomers(new Set());
              setSelectAll(false);
              setCustomMessage('');
              setMessageTemplate(tab.id);
            }}
            style={{
              padding: '10px 20px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: activeTab === tab.id ? '#0066ff' : '#f0f0f0',
              color: activeTab === tab.id ? 'white' : '#333',
              borderRadius: '4px',
              fontWeight: activeTab === tab.id ? 'bold' : 'normal',
              fontSize: '14px'
            }}
          >
            {tab.label} ({tabCounts[tab.id]})
          </button>
        ))}
      </div>

      {/* Review Link Configuration (for Review Request tab) */}
      {activeTab === 'review' && (
        <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f0f7ff', borderRadius: '6px', borderLeft: '4px solid #0066ff' }}>
          <h3 style={{ marginTop: 0, marginBottom: '10px' }}>📍 Google Review Link</h3>
          <input
            type="text"
            value={reviewLink}
            onChange={(e) => setReviewLink(e.target.value)}
            placeholder="https://g.page/r/YOUR_REVIEW_LINK"
            style={{
              width: '100%',
              padding: '10px',
              fontSize: '13px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              boxSizing: 'border-box',
              marginBottom: '10px',
              fontFamily: 'monospace'
            }}
          />
          <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>
            Your Google Business Profile review link. Customers will click this to leave reviews directly.
          </p>
        </div>
      )}

      {/* Payment Link Configuration (for Rent Collection tab) */}
      {activeTab === 'rent' && (
        <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f0f7ff', borderRadius: '6px', borderLeft: '4px solid #0066ff' }}>
          <h3 style={{ marginTop: 0, marginBottom: '10px' }}>💳 Payment Link</h3>
          <input
            type="text"
            value={paymentLink}
            onChange={(e) => setPaymentLink(e.target.value)}
            placeholder="https://payment.yourdomain.com/rent"
            style={{
              width: '100%',
              padding: '10px',
              fontSize: '13px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              boxSizing: 'border-box',
              marginBottom: '10px',
              fontFamily: 'monospace'
            }}
          />
          <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>
            Payment link for rent collection. You can use UPI (upi://), PhonePe, or any payment gateway URL. Include customer ID in URL if possible for auto-fill.
          </p>
          <p style={{ fontSize: '11px', color: '#999', marginTop: '8px', marginBottom: 0 }}>
            Examples: upi://pay?pa=yourname@upi&am={'{MonthlyRent}'} OR https://payments.phonepe.com/... OR https://rzp.io/...
          </p>
        </div>
      )}

      {/* Message Template Selection */}
      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '6px' }}>
        <h3 style={{ marginTop: 0 }}>Message Template</h3>
        <textarea
          value={customMessage || MESSAGE_TEMPLATES[messageTemplate]}
          onChange={(e) => setCustomMessage(e.target.value)}
          placeholder="Customize your message here..."
          style={{
            width: '100%',
            height: '120px',
            padding: '10px',
            fontSize: '13px',
            fontFamily: 'monospace',
            border: '1px solid #ddd',
            borderRadius: '4px',
            boxSizing: 'border-box',
            marginBottom: '10px'
          }}
        />
        <p style={{ fontSize: '11px', color: '#666', marginTop: '5px' }}>
          Available placeholders: {'{CustomerName}'}, {'{ProductName}'}, {'{ServiceDueDate}'}, {'{AMCEndDate}'}, {'{AMCAmount}'}, {'{AmountDue}'}, {'{MonthlyRent}'}, {'{DueMonth}'}, {'{PaymentLink}'}{activeTab === 'review' && ', {ReviewLink}'}
        </p>
      </div>

      {/* Customer Selection Table */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h3 style={{ marginTop: 0 }}>
            Select Customers ({selectedCustomers.size} selected)
          </h3>
          <button
            onClick={sendWhatsAppMessages}
            disabled={selectedCustomers.size === 0 || isSending}
            style={{
              padding: '10px 20px',
              backgroundColor: selectedCustomers.size > 0 && !isSending ? '#25d366' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontWeight: 'bold',
              fontSize: '14px',
              cursor: selectedCustomers.size > 0 && !isSending ? 'pointer' : 'not-allowed'
            }}
          >
            {isSending ? `📱 Sending (${sendingIndex + 1}/${getFilteredCustomers().filter(c => selectedCustomers.has(c.id)).length})...` : `📱 SEND WHATSAPP TO SELECTED (${selectedCustomers.size})`}
          </button>
        </div>

        <div className="table-container">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f0f0f0', borderBottom: '2px solid #ddd' }}>
                <th style={{ padding: '10px', textAlign: 'left', width: '50px' }}>
                  <input
                    type="checkbox"
                    checked={selectAll && filteredData.length > 0}
                    onChange={handleSelectAll}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                </th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Customer Name</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Mobile</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Product</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Area/Location</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Due Date</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Last Service</th>
                {activeTab === 'payment' && <th style={{ padding: '10px', textAlign: 'left' }}>Amount Due</th>}
                {activeTab === 'rent' && <th style={{ padding: '10px', textAlign: 'left' }}>Monthly Rent</th>}
                {activeTab === 'rent' && <th style={{ padding: '10px', textAlign: 'left' }}>Due Month</th>}
              </tr>
            </thead>
            <tbody>
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                    No customers found for this category
                  </td>
                </tr>
              ) : (
                filteredData.map(customer => (
                  <tr key={customer.id} style={{ borderBottom: '1px solid #ddd' }}>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selectedCustomers.has(customer.id)}
                        onChange={() => handleSelectCustomer(customer.id)}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                    </td>
                    <td style={{ padding: '10px' }}>
                      <strong>{customer.fullName || customer.name}</strong>
                    </td>
                    <td style={{ padding: '10px' }}>
                      {customer.phone || '-'}
                    </td>
                    <td style={{ padding: '10px' }}>
                      {customer.machineName || '-'}
                    </td>
                    <td style={{ padding: '10px' }}>
                      {customer.mapCode || customer.address || '-'}
                    </td>
                    <td style={{ padding: '10px' }}>
                      {activeTab === 'amc' ? customer.amcEndDate : customer.amcEndDate || '-'}
                    </td>
                    <td style={{ padding: '10px' }}>
                      {customer.lastServiceDate}
                    </td>
                    {activeTab === 'payment' && (
                      <td style={{ padding: '10px', fontWeight: 'bold', color: '#dc3545' }}>
                        ₹{customer.amountDue || 0}
                      </td>
                    )}
                    {activeTab === 'rent' && (
                      <td style={{ padding: '10px', fontWeight: 'bold', color: '#d32f2f' }}>
                        ₹{customer.monthlyRent || 0}
                      </td>
                    )}
                    {activeTab === 'rent' && (
                      <td style={{ padding: '10px', fontSize: '12px', color: '#333' }}>
                        {customer.dueMonth || rentPaymentService.getCurrentMonth()}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Instructions */}
      <div style={{ padding: '15px', backgroundColor: '#e3f2fd', borderRadius: '6px', borderLeft: '4px solid #0066ff' }}>
        <h4 style={{ marginTop: 0 }}>How to Use:</h4>
        <ol style={{ marginBottom: 0, fontSize: '14px', lineHeight: '1.8' }}>
          <li>Select the customer category tab (Service, AMC, Payment, Rent, or Review)</li>
          <li>Configure the link if needed (Google Review or Payment Link)</li>
          <li>Customize the message template if needed</li>
          <li>Check the customers you want to message</li>
          <li>Click <strong>"SEND WHATSAPP TO SELECTED"</strong></li>
          <li>WhatsApp chats will open one by one with pre-filled messages</li>
          <li>Manually press SEND in WhatsApp for each customer</li>
          <li>After closing or sending, the next customer chat automatically opens</li>
        </ol>
      </div>
    </div>
  );
};

export default WhatsAppMessaging;
