import React, { useState, useEffect } from 'react';
import dataService from '../services/dataService';
import * as XLSX from 'xlsx';
import { showLoader, hideLoader } from '../utils/globalLoader';

const Reports = () => {
  const [reportType, setReportType] = useState('daily');
  const [dateRange, setDateRange] = useState({
    start: '2023-05-01',
    end: '2023-05-31'
  });

  const [reportData, setReportData] = useState({
    daily: [],
    technician: [],
    complaints: []
  });
  const [allData, setAllData] = useState({
    customers: [],
    tickets: [],
    payments: [],
    technicians: []
  });

  useEffect(() => {
    // Load data from data service
    const loadData = async () => {
      try {
        showLoader();
      const tickets = await dataService.getTickets();
      const payments = await dataService.getPayments();
      const technicians = await dataService.getTechnicians();
      const customers = await dataService.getCustomers();
      
      // Store all data for comprehensive export
      setAllData({
        customers,
        tickets,
        payments,
        technicians
      });
      
      // Generate daily report data
      const dailyReport = {};
      tickets.forEach(ticket => {
        const date = ticket.createdAt;
        if (!dailyReport[date]) {
          dailyReport[date] = { date, tickets: 0, completed: 0 };
        }
        dailyReport[date].tickets++;
        if (ticket.status === 'completed') {
          dailyReport[date].completed++;
        }
      });
      
      // Add revenue data
      payments.forEach(payment => {
        const date = payment.date;
        if (dailyReport[date]) {
          if (!dailyReport[date].revenue) {
            dailyReport[date].revenue = 0;
          }
          dailyReport[date].revenue += payment.amount;
        }
      });
      
      const dailyData = Object.values(dailyReport);
      
      // Generate technician report data
      const technicianReport = {};
      tickets.forEach(ticket => {
        const techName = ticket.assignedTo;
        if (techName && techName !== 'Unassigned') {
          if (!technicianReport[techName]) {
            technicianReport[techName] = { technician: techName, tickets: 0, completed: 0 };
          }
          technicianReport[techName].tickets++;
          if (ticket.status === 'completed') {
            technicianReport[techName].completed++;
          }
        }
      });
      
      // Add revenue data
      payments.forEach(payment => {
        const techName = payment.technician;
        if (technicianReport[techName]) {
          if (!technicianReport[techName].revenue) {
            technicianReport[techName].revenue = 0;
          }
          technicianReport[techName].revenue += payment.amount;
        }
      });
      
      const technicianData = Object.values(technicianReport);
      
      // Generate complaints/work details report
      const complaintsData = tickets.map(ticket => ({
        id: ticket.id,
        customerName: ticket.customerName,
        customerPhone: ticket.customerPhone,
        title: ticket.title,
        description: ticket.description,
        status: ticket.status,
        priority: ticket.priority,
        assignedTo: ticket.assignedTo,
        createdAt: ticket.createdAt,
        scheduledDate: ticket.scheduledDate,
        scheduledArrivalTime: ticket.scheduledArrivalTime,
        takePayment: ticket.takePayment,
        paymentAmount: ticket.paymentAmount,
        isNewCustomer: ticket.isNewCustomer,
        completedAt: ticket.completedAt
      }));
      
      setReportData({
        daily: dailyData,
        technician: technicianData,
        complaints: complaintsData
      });
    } finally {
      hideLoader();
    }
    };
    
    loadData();
  }, []);

  const handleDateChange = (e) => {
    const { name, value } = e.target;
    setDateRange(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const exportToExcel = (type = 'all') => {
    const workbook = XLSX.utils.book_new();
    
    if (type === 'all' || type === 'customers') {
      // Export Customers with all details
      const customersData = allData.customers.map(customer => ({
        'Customer ID': customer.id,
        'Full Name': customer.fullName || customer.name,
        'Phone': customer.phone,
        'Email': customer.email || '',
        'Address': customer.address || '',
        'Location (Plus Code)': customer.location || '',
        'Model Name': customer.modelName || '',
        'Card Number': customer.cardNumber || '',
        'AMC Start Date': customer.amcStartDate || customer.dateOfPurchase || '',
        'AMC End Date': customer.amcEndDate || '',
        'AMC Amount (₹)': customer.amcAmount || 0,
        'Status': customer.status || 'active',
        'Created At': customer.createdAt || ''
      }));
      const customersSheet = XLSX.utils.json_to_sheet(customersData);
      XLSX.utils.book_append_sheet(workbook, customersSheet, 'Customers');
    }
    
    if (type === 'all' || type === 'tickets') {
      // Export Tickets/Jobs with all details
      const ticketsData = allData.tickets.map(ticket => ({
        'Ticket Code': ticket.ticketCode || ticket.id.substring(0, 4),
        'Customer Name': ticket.customerName,
        'Customer Phone': ticket.customerPhone,
        'Title': ticket.title,
        'Description': ticket.description,
        'Service Type': ticket.serviceType || '',
        'Priority': ticket.priority,
        'Status': ticket.status,
        'Assigned To': ticket.assignedTo || 'Unassigned',
        'Created At': ticket.createdAt,
        'Scheduled Date': ticket.scheduledDate || '',
        'Scheduled Time': ticket.scheduledArrivalTime || '',
        'Completed At': ticket.completedAt || '',
        'Work Done': ticket.workDone || '',
        'Parts Used': ticket.partsUsed || '',
        'Take Payment': ticket.takePayment ? 'Yes' : 'No',
        'Payment Amount (₹)': ticket.paymentAmount || 0,
        'New Customer': ticket.isNewCustomer ? 'Yes' : 'No',
        'Notes': ticket.notes || ''
      }));
      const ticketsSheet = XLSX.utils.json_to_sheet(ticketsData);
      XLSX.utils.book_append_sheet(workbook, ticketsSheet, 'Tickets');
    }
    
    if (type === 'all' || type === 'payments') {
      // Export Payments with all details
      const paymentsData = allData.payments.map(payment => ({
        'Payment Code': payment.ticketCode || payment.id.substring(0, 4),
        'Customer Name': payment.customerName,
        'Customer Phone': payment.customerPhone,
        'Amount (₹)': payment.amount,
        'Payment Method': payment.paymentMethod || 'Cash',
        'Payment Type': payment.paymentType || '',
        'Date': payment.date,
        'Time': payment.time || '',
        'Technician': payment.technician || '',
        'Reference ID': payment.reference || payment.ticketCode || '',
        'Status': payment.status || 'completed',
        'Notes': payment.notes || ''
      }));
      const paymentsSheet = XLSX.utils.json_to_sheet(paymentsData);
      XLSX.utils.book_append_sheet(workbook, paymentsSheet, 'Payments');
    }
    
    if (type === 'all' || type === 'technicians') {
      // Export Technicians with all details
      const techniciansData = allData.technicians.map(tech => ({
        'Technician ID': tech.id,
        'Name': tech.name,
        'Phone': tech.phone,
        'Email': tech.email || '',
        'Specialization': tech.specialization || '',
        'Status': tech.status || 'active',
        'Total Jobs': tech.totalJobs || 0,
        'Completed Jobs': tech.completedJobs || 0,
        'Rating': tech.rating || 0,
        'Joined Date': tech.joinedDate || ''
      }));
      const techniciansSheet = XLSX.utils.json_to_sheet(techniciansData);
      XLSX.utils.book_append_sheet(workbook, techniciansSheet, 'Technicians');
    }
    
    // Add summary sheet for 'all' export
    if (type === 'all') {
      const summaryData = [
        { 'Category': 'Total Customers', 'Count': allData.customers.length },
        { 'Category': 'Total Tickets', 'Count': allData.tickets.length },
        { 'Category': 'Total Payments', 'Count': allData.payments.length },
        { 'Category': 'Total Technicians', 'Count': allData.technicians.length },
        { 'Category': 'Total Revenue (₹)', 'Count': allData.payments.reduce((sum, p) => sum + (p.amount || 0), 0) },
        { 'Category': 'Completed Tickets', 'Count': allData.tickets.filter(t => t.status === 'completed').length },
        { 'Category': 'Pending Tickets', 'Count': allData.tickets.filter(t => t.status === 'open' || t.status === 'assigned').length }
      ];
      const summarySheet = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
    }
    
    // Generate filename with current date
    const fileName = `${type === 'all' ? 'Complete_Report' : type.charAt(0).toUpperCase() + type.slice(1)}_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    // Write and download file
    XLSX.writeFile(workbook, fileName);
  };

  return (
    <div className="content">
      <h1>Reports</h1>
      
      <div className="card" style={{ marginBottom: '20px' }}>
        <h2>Report Filters</h2>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'end' }}>
          <div className="form-group">
            <label htmlFor="reportType">Report Type:</label>
            <select 
              id="reportType" 
              value={reportType} 
              onChange={(e) => setReportType(e.target.value)}
              style={{ padding: '8px', minWidth: '150px' }}
            >
              <option value="daily">Daily Summary</option>
              <option value="technician">Technician Performance</option>
              <option value="complaints">Work Details & Complaints</option>
            </select>
          </div>
          
          <div className="form-group">
            <label htmlFor="startDate">Start Date:</label>
            <input
              type="date"
              id="startDate"
              name="start"
              value={dateRange.start}
              onChange={handleDateChange}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="endDate">End Date:</label>
            <input
              type="date"
              id="endDate"
              name="end"
              value={dateRange.end}
              onChange={handleDateChange}
            />
          </div>
          
          <button className="btn" style={{ width: 'auto', height: '40px' }}>Generate Report</button>
        </div>
      </div>

      {/* Excel Export Section */}
      <div className="card" style={{ marginBottom: '20px', backgroundColor: '#e7f3ff', borderLeft: '4px solid #0066ff' }}>
        <h2>📄 Export to Excel</h2>
        <p style={{ color: '#666', marginBottom: '15px' }}>Download comprehensive reports with all details in Excel format</p>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
          <button 
            className="btn" 
            onClick={() => exportToExcel('all')}
            style={{ backgroundColor: '#28a745', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            📋 Complete Report (All Data)
          </button>
          
          <button 
            className="btn" 
            onClick={() => exportToExcel('customers')}
            style={{ backgroundColor: '#0066ff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            👥 Customers Only
          </button>
          
          <button 
            className="btn" 
            onClick={() => exportToExcel('tickets')}
            style={{ backgroundColor: '#ff9800', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            🎫 Tickets/Jobs Only
          </button>
          
          <button 
            className="btn" 
            onClick={() => exportToExcel('payments')}
            style={{ backgroundColor: '#9c27b0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            💰 Payments Only
          </button>
          
          <button 
            className="btn" 
            onClick={() => exportToExcel('technicians')}
            style={{ backgroundColor: '#00bcd4', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            🔧 Technicians Only
          </button>
        </div>
        
        <div style={{ marginTop: '15px', padding: '10px', backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: '5px' }}>
          <p style={{ margin: '0', fontSize: '13px', color: '#666' }}>
            <strong>ℹ️ Note:</strong> Complete Report includes Summary, Customers, Tickets, Payments, and Technicians sheets with all available details.
          </p>
        </div>
      </div>

      <div className="table-container">
        <h2>{reportType === 'daily' ? 'Daily Summary Report' : reportType === 'technician' ? 'Technician Performance Report' : 'Work Details & Complaints Report'}</h2>
        <table>
          <thead>
            <tr>
              {reportType === 'daily' ? (
                <>
                  <th>Date</th>
                  <th>Total Tickets</th>
                  <th>Completed</th>
                  <th>Revenue (₹)</th>
                </>
              ) : reportType === 'technician' ? (
                <>
                  <th>Technician</th>
                  <th>Total Tickets</th>
                  <th>Completed</th>
                  <th>Revenue (₹)</th>
                </>
              ) : (
                <>
                  <th>ID</th>
                  <th>Customer</th>
                  <th>Phone</th>
                  <th>Title</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Assigned To</th>
                  <th>Created</th>
                  <th>Payment</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {reportData[reportType].map((item, index) => (
              <tr key={index}>
                {reportType === 'daily' ? (
                  <>
                    <td>{item.date}</td>
                    <td>{item.tickets}</td>
                    <td>{item.completed}</td>
                    <td>₹{(item.revenue || 0).toLocaleString()}</td>
                  </>
                ) : reportType === 'technician' ? (
                  <>
                    <td>{item.technician}</td>
                    <td>{item.tickets}</td>
                    <td>{item.completed}</td>
                    <td>₹{(item.revenue || 0).toLocaleString()}</td>
                  </>
                ) : (
                  <>
                    <td><strong style={{ color: '#0066ff' }}>{item.ticketCode || item.id.substring(0, 4)}</strong></td>
                    <td>{item.customerName} {item.isNewCustomer ? '(🆕)' : ''}</td>
                    <td>{item.customerPhone}</td>
                    <td>{item.title}</td>
                    <td><span style={{ fontWeight: 'bold', color: item.priority === 'high' ? '#dc3545' : item.priority === 'medium' ? '#ff9800' : '#28a745' }}>{item.priority.toUpperCase()}</span></td>
                    <td><span className={`status-badge status-${item.status}`}>{item.status}</span></td>
                    <td>{item.assignedTo}</td>
                    <td>{item.createdAt}</td>
                    <td>{item.takePayment ? `₹${item.paymentAmount}` : '-'}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Reports;