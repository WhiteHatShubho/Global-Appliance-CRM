// Rent Payment Tracking Service
// Handles monthly rent calculations, payment tracking, and due date management

class RentPaymentService {
  // Get current month in format "MMMM YYYY"
  getCurrentMonth() {
    const now = new Date();
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];
    return months[now.getMonth()] + ' ' + now.getFullYear();
  }

  // Get month in format "MMMM YYYY" for a given date
  getMonthForDate(dateString) {
    const date = new Date(dateString + 'T00:00:00');
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];
    return months[date.getMonth()] + ' ' + date.getFullYear();
  }

  // Get next month in format "MMMM YYYY"
  getNextMonth(monthString) {
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];
    const [monthName, year] = monthString.split(' ');
    const monthIndex = months.indexOf(monthName);
    
    if (monthIndex === 11) { // December
      return 'January ' + (parseInt(year) + 1);
    } else {
      return months[monthIndex + 1] + ' ' + year;
    }
  }

  // Check if a customer has unpaid rent for current month
  isRentDue(customer) {
    if (!customer || customer.segment !== 'rent') {
      return false;
    }

    const currentMonth = this.getCurrentMonth();
    const paidHistory = customer.paidHistory || [];
    
    // Check if current month is paid
    const isCurrentMonthPaid = paidHistory.some(payment => 
      payment.month === currentMonth
    );

    return !isCurrentMonthPaid;
  }

  // Get all rent customers with due rent
  getDueRentCustomers(customers) {
    return customers.filter(customer => this.isRentDue(customer));
  }

  // Get all active rent customers
  getActiveRentCustomers(customers) {
    return customers.filter(customer => customer.segment === 'rent');
  }

  // Record a rent payment
  recordPayment(customer, paymentData) {
    const payment = {
      month: paymentData.month,
      amount: paymentData.amount,
      paidOn: new Date().toLocaleDateString('en-IN'), // DD/MM/YYYY format
      method: paymentData.method, // PhonePe, Cash, Other
      note: paymentData.note || ''
    };

    const paidHistory = customer.paidHistory || [];
    paidHistory.push(payment);

    return {
      paidHistory: paidHistory,
      lastPaidMonth: paymentData.month,
      nextDueMonth: this.getNextMonth(paymentData.month),
      paymentStatus: 'paid'
    };
  }

  // Get payment history for a customer
  getPaymentHistory(customer) {
    return customer.paidHistory || [];
  }

  // Calculate total rent paid in a year
  getTotalPaidThisYear(customer) {
    const currentYear = new Date().getFullYear();
    const paidHistory = customer.paidHistory || [];
    
    return paidHistory
      .filter(payment => payment.month.includes(currentYear.toString()))
      .reduce((total, payment) => total + payment.amount, 0);
  }

  // Get payment summary for all rent customers
  getPaymentSummary(customers) {
    const rentCustomers = this.getActiveRentCustomers(customers);
    const currentMonth = this.getCurrentMonth();
    
    let totalMonthlyRent = 0;
    let paidThisMonth = 0;
    let dueThisMonth = 0;

    rentCustomers.forEach(customer => {
      const monthlyRent = parseInt(customer.monthlyRent) || 0;
      totalMonthlyRent += monthlyRent;

      const paidHistory = customer.paidHistory || [];
      const isPaid = paidHistory.some(p => p.month === currentMonth);
      
      if (isPaid) {
        paidThisMonth += monthlyRent;
      } else {
        dueThisMonth += monthlyRent;
      }
    });

    return {
      totalCustomers: rentCustomers.length,
      totalMonthlyRent,
      paidThisMonth,
      dueThisMonth,
      currentMonth
    };
  }

  // Get rent payment history report
  getPaymentHistoryReport(customers) {
    const rentCustomers = this.getActiveRentCustomers(customers);
    const report = [];

    rentCustomers.forEach(customer => {
      const paidHistory = customer.paidHistory || [];
      
      paidHistory.forEach(payment => {
        report.push({
          customerName: customer.fullName || customer.name,
          cardNumber: customer.cardNumber,
          address: customer.address,
          month: payment.month,
          amount: payment.amount,
          paidOn: payment.paidOn,
          method: payment.method,
          note: payment.note,
          phoneNumber: customer.phone
        });
      });
    });

    return report.sort((a, b) => {
      // Sort by month descending
      const monthYear1 = new Date(a.month + ' 1');
      const monthYear2 = new Date(b.month + ' 1');
      return monthYear2 - monthYear1;
    });
  }

  // Initialize rent customer with default values
  initializeRentCustomer(customer) {
    if (customer.segment !== 'rent') {
      return customer;
    }

    const rentStartDate = customer.rentStartDate;
    if (!rentStartDate) {
      return customer;
    }

    // If no paid history, initialize with empty array
    if (!customer.paidHistory) {
      customer.paidHistory = [];
      customer.lastPaidMonth = null;
      customer.nextDueMonth = this.getMonthForDate(rentStartDate);
      customer.paymentStatus = 'pending';
    }

    return customer;
  }
}

export default new RentPaymentService();
