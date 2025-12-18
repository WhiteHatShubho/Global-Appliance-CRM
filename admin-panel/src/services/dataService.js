// Data service using Firebase Realtime Database with caching
// This allows the app to work with Firebase free tier
import { ref, push, set, get, child, remove, update } from 'firebase/database';
import auditService from './auditService';
import { showLoader, hideLoader } from '../utils/globalLoader';

class DataService {
  constructor() {
    this.firebase = null;
    this.database = null;
    this.cache = {
      customers: { data: [], timestamp: 0 },
      tickets: { data: [], timestamp: 0 },
      technicians: { data: [], timestamp: 0 },
      payments: { data: [], timestamp: 0 },
      callLogs: { data: [], timestamp: 0 }
    };
    this.CACHE_DURATION = 10 * 60 * 1000; // 10 minutes cache (extended from 5)
    this.fetchPromises = {}; // Prevent duplicate simultaneous requests
  }

  // Initialize with Firebase
  initializeFirebase(firebaseApp, database) {
    console.log('Initializing DataService with Firebase');
    this.firebase = firebaseApp;
    this.database = database;
    console.log('DataService initialized with app:', firebaseApp?.name);
  }

  // Check if cache is still valid
  isCacheValid(cacheType) {
    const cache = this.cache[cacheType];
    return cache && cache.data.length > 0 && (Date.now() - cache.timestamp) < this.CACHE_DURATION;
  }

  // Prevent duplicate simultaneous requests
  async withRequestDeduplication(key, fetchFn) {
    if (this.fetchPromises[key]) {
      console.log(`Request for ${key} already in progress, waiting...`);
      return this.fetchPromises[key];
    }
    
    this.fetchPromises[key] = fetchFn();
    try {
      return await this.fetchPromises[key];
    } finally {
      delete this.fetchPromises[key];
    }
  }

  // Update cache
  updateCache(cacheType, data) {
    this.cache[cacheType] = {
      data,
      timestamp: Date.now()
    };
  }

  // Customers methods
  async getCustomers(forceRefresh = false) {
    if (!this.database) return [];
    
    // Return cached data if valid and not force refreshing
    if (!forceRefresh && this.isCacheValid('customers')) {
      console.log('Using cached customers data');
      return this.cache.customers.data;
    }
    
    // Use request deduplication to prevent simultaneous requests
    return this.withRequestDeduplication('customers', async () => {
      try {
        console.log('Fetching customers from Firebase...');
        const snapshot = await get(child(ref(this.database), 'customers'));
        const customers = snapshot.val() || {};
        const customersList = Object.keys(customers).map(key => ({
          id: key,
          ...customers[key]
        }));
        
        // Update cache
        this.updateCache('customers', customersList);
        console.log('Customers loaded:', customersList.length);
        return customersList;
      } catch (error) {
        console.error('Error fetching customers:', error);
        // Return cached data even if fetch fails
        return this.cache.customers.data;
      }
    });
  }

  // Get limited customers with pagination (for faster loading)
  async getCustomersPaginated(page = 0, pageSize = 50, forceRefresh = false) {
    const allCustomers = await this.getCustomers(forceRefresh);
    const start = page * pageSize;
    const end = start + pageSize;
    return {
      data: allCustomers.slice(start, end),
      total: allCustomers.length,
      page,
      pageSize,
      hasMore: end < allCustomers.length
    };
  }

  async addCustomer(customer) {
    if (!this.database) return null;
    
    try {
      showLoader();
      const customersRef = ref(this.database, 'customers');
      const newCustomerRef = push(customersRef);
      await set(newCustomerRef, customer);
      const newCustomer = { id: newCustomerRef.key, ...customer };
      
      // Update local cache immediately
      this.cache.customers.data.push(newCustomer);
      this.cache.customers.timestamp = Date.now();
      
      return newCustomer;
    } catch (error) {
      console.error('Error adding customer:', error);
      return null;
    } finally {
      hideLoader();
    }
  }

  async updateCustomer(customerId, customerData) {
    if (!this.database) return null;
    
    try {
      showLoader();
      const customerRef = ref(this.database, `customers/${customerId}`);
      await update(customerRef, customerData);
      
      // Update local cache immediately
      const index = this.cache.customers.data.findIndex(c => c.id === customerId);
      if (index !== -1) {
        this.cache.customers.data[index] = { ...this.cache.customers.data[index], ...customerData };
        this.cache.customers.timestamp = Date.now();
      }
      
      return customerData;
    } catch (error) {
      console.error('Error updating customer:', error);
      return null;
    } finally {
      hideLoader();
    }
  }

  async deleteCustomer(id) {
    if (!this.database) return;
    
    try {
      showLoader();
      // Get customer data for audit log before marking as deleted
      const customerToDelete = this.cache.customers.data.find(c => c.id === id);
      
      const customerRef = ref(this.database, `customers/${id}`);
      // Mark as deleted instead of hard delete (soft delete)
      await update(customerRef, {
        deleted: true,
        deletedAt: new Date().toISOString(),
        deletedBy: auditService.currentUserId
      });
      
      // Log the deletion
      if (customerToDelete) {
        await auditService.logDeleteCustomer(id, customerToDelete);
      }
      
      // Update local cache immediately
      this.cache.customers.data = this.cache.customers.data.filter(c => c.id !== id);
      this.cache.customers.timestamp = Date.now();
    } catch (error) {
      console.error('Error deleting customer:', error);
    } finally {
      hideLoader();
    }
  }

  // Tickets methods
  async getTickets(forceRefresh = false) {
    if (!this.database) return [];
    
    if (!forceRefresh && this.isCacheValid('tickets')) {
      console.log('Using cached tickets data');
      return this.cache.tickets.data;
    }
    
    return this.withRequestDeduplication('tickets', async () => {
      try {
        console.log('Fetching tickets from Firebase...');
        const snapshot = await get(child(ref(this.database), 'tickets'));
        const tickets = snapshot.val() || {};
        const ticketsList = Object.keys(tickets).map(key => ({
          id: key,
          ...tickets[key]
        }));
        
        this.updateCache('tickets', ticketsList);
        console.log('Tickets loaded:', ticketsList.length);
        return ticketsList;
      } catch (error) {
        console.error('Error fetching tickets:', error);
        return this.cache.tickets.data;
      }
    });
  }

  // Get limited tickets with pagination
  async getTicketsPaginated(page = 0, pageSize = 50, forceRefresh = false) {
    const allTickets = await this.getTickets(forceRefresh);
    const start = page * pageSize;
    const end = start + pageSize;
    return {
      data: allTickets.slice(start, end),
      total: allTickets.length,
      page,
      pageSize,
      hasMore: end < allTickets.length
    };
  }

  // ✅ MIGRATION: Fix existing tickets with invalid ticketCode
  // Convert tickets that have random/invalid codes to proper WW00 format
  async fixExistingTicketCodes() {
    try {
      console.log('🔧 Starting ticket code migration...');
      const allTickets = await this.getTickets(true); // Force refresh
      const ticketsToFix = allTickets.filter(t => 
        !t.ticketCode || !this.validateTicketCodeFormat(t.ticketCode)
      );
      
      if (ticketsToFix.length === 0) {
        console.log('✅ All tickets have valid codes. No migration needed.');
        return;
      }
      
      console.log(`⚠️ Found ${ticketsToFix.length} tickets with invalid codes. Fixing...`);
      
      // For each invalid ticket, generate a proper code based on its type
      for (const ticket of ticketsToFix) {
        const newCode = await this.generateTicketCode(ticket.type || 'TICKET');
        console.log(`🔄 Fixing ticket ${ticket.id}: ${ticket.ticketCode || 'null'} → ${newCode}`);
        
        // Update the ticket with new code
        await this.updateTicket(ticket.id, { ticketCode: newCode });
      }
      
      console.log(`✅ Migration complete! Fixed ${ticketsToFix.length} tickets.`);
    } catch (error) {
      console.error('❌ Error during migration:', error);
    }
  }

  // ✅ Generate unique 4-character ticket code (WW00 format)
  // Format: EXACTLY 2 alphabetic letters + 2 numeric digits (e.g., TC01, SV99, AM15)
  // Prefixes: TC (Ticket), SV (Service), AM (AMC), CM (Complaint)
  async generateTicketCode(type = 'TICKET') {
    try {
      // Get all existing tickets
      const allTickets = await this.getTickets(true); // Force refresh to get latest
      console.log(`🔍 Found ${allTickets.length} existing tickets`);
      
      // Determine prefix based on type (exactly 2 uppercase letters)
      let prefix = 'TC'; // Default for TICKET
      if (type === 'SERVICE') prefix = 'SV';
      else if (type === 'AMC') prefix = 'AM';
      else if (type === 'COMPLAINT') prefix = 'CM';
      
      // Validate prefix format (must be exactly 2 alphabetic letters)
      if (!/^[A-Z]{2}$/.test(prefix)) {
        console.warn(`⚠️ Invalid prefix format: ${prefix}, defaulting to TC`);
        prefix = 'TC';
      }
      
      console.log(`🔍 Using prefix: ${prefix} for type: ${type}`);
      
      // Find the highest number for this prefix (ONLY from valid WW00 format codes)
      const codesWithPrefix = allTickets
        .filter(t => {
          const hasValidCode = t.ticketCode && typeof t.ticketCode === 'string';
          if (!hasValidCode) return false;
          // Only count codes that match WW00 format
          const isValidFormat = /^[A-Z]{2}\d{2}$/.test(t.ticketCode);
          if (!isValidFormat) {
            console.warn(`⚠️ Skipping invalid code format: ${t.ticketCode}`);
            return false;
          }
          const codePrefix = t.ticketCode.substring(0, 2);
          return codePrefix === prefix;
        })
        .map(t => {
          try {
            // Extract last 2 characters as number
            const numStr = t.ticketCode.substring(2, 4);
            const num = parseInt(numStr, 10);
            console.log(`🔍 Found valid code: ${t.ticketCode}, extracted number: ${num}`);
            return isNaN(num) ? 0 : num;
          } catch (e) {
            console.warn(`⚠️ Could not parse number from code: ${t.ticketCode}`);
            return 0;
          }
        });
      
      console.log(`🔍 Valid numbers found for prefix ${prefix}:`, codesWithPrefix);
      
      const nextNumber = Math.max(...codesWithPrefix, 0) + 1;
      console.log(`🔍 Next number: ${nextNumber}`);
      
      // Generate code: prefix (2 letters) + 2-digit number (01-99)
      // If nextNumber > 99, reset to 01 (wrap around)
      const finalNumber = nextNumber > 99 ? 1 : nextNumber;
      const ticketCode = prefix + String(finalNumber).padStart(2, '0');
      
      console.log(`✅ Generated code: ${ticketCode} (final number: ${finalNumber})`);
      
      // Validate generated code format (WW00: exactly 4 chars, 2 letters + 2 digits)
      if (!/^[A-Z]{2}\d{2}$/.test(ticketCode)) {
        throw new Error(`Generated ticket code does not match WW00 format: ${ticketCode}`);
      }
      
      console.log(`✅ Generated ticketCode (WW00 format): ${ticketCode}`);
      return ticketCode;
    } catch (error) {
      console.error('❌ Error generating ticket code:', error);
      // Fallback: generate a code in TC01 format
      const prefix = 'TC';
      const randomNum = String(Math.floor(Math.random() * 99) + 1).padStart(2, '0');
      const fallbackCode = prefix + randomNum;
      console.warn(`⚠️ Using fallback ticket code: ${fallbackCode}`);
      return fallbackCode;
    }
  }

  // ✅ Validate ticket code format (WW00: 2 letters + 2 digits)
  validateTicketCodeFormat(code) {
    const ww00Format = /^[A-Z]{2}\d{2}$/;
    if (!ww00Format.test(code)) {
      console.error(`❌ Invalid ticket code format: "${code}". Must be WW00 format (2 letters + 2 digits, e.g., TC01)`);
      return false;
    }
    return true;
  }

  async addTicket(ticket) {
    if (!this.database) return null;
    
    try {
      showLoader();
      // ✅ Generate ticketCode if not provided
      let ticketCode = ticket.ticketCode;
      
      if (!ticketCode) {
        // Generate new ticket code based on ticket type
        ticketCode = await this.generateTicketCode(ticket.type || 'TICKET');
      }
      
      // ✅ Validate ticket code format before saving
      if (!this.validateTicketCodeFormat(ticketCode)) {
        console.error(`❌ Cannot save ticket with invalid code: ${ticketCode}`);
        throw new Error(`Invalid ticket code format: ${ticketCode}. Must be WW00 format (e.g., TC01)`);
      }
      
      const ticketsRef = ref(this.database, 'tickets');
      const newTicketRef = push(ticketsRef);
      const ticketData = {
        ...ticket,
        ticketCode // ✅ Add ticketCode to the record
      };
      await set(newTicketRef, ticketData);
      const newTicket = { id: newTicketRef.key, ...ticketData };
      
      // Update local cache
      this.cache.tickets.data.push(newTicket);
      this.cache.tickets.timestamp = Date.now();
      
      console.log(`✅ Ticket created successfully with code: ${ticketCode}`);
      return newTicket;
    } catch (error) {
      console.error('Error adding ticket:', error);
      return null;
    } finally {
      hideLoader();
    }
  }

  async updateTicket(ticketId, updateData) {
    if (!this.database) return null;
    
    try {
      showLoader();
      const ticketRef = ref(this.database, `tickets/${ticketId}`);
      await update(ticketRef, updateData);
      
      // Update local cache
      const index = this.cache.tickets.data.findIndex(t => t.id === ticketId);
      if (index !== -1) {
        this.cache.tickets.data[index] = { ...this.cache.tickets.data[index], ...updateData };
        this.cache.tickets.timestamp = Date.now();
      }
      
      return updateData;
    } catch (error) {
      console.error('Error updating ticket:', error);
      return null;
    } finally {
      hideLoader();
    }
  }

  async deleteTicket(ticketId) {
    if (!this.database) return;
    
    try {
      showLoader();
      // Get ticket data for audit log before marking as deleted
      const ticketToDelete = this.cache.tickets.data.find(t => t.id === ticketId);
      
      const ticketRef = ref(this.database, `tickets/${ticketId}`);
      // Mark as deleted instead of hard delete (soft delete)
      await update(ticketRef, {
        deleted: true,
        deletedAt: new Date().toISOString(),
        deletedBy: auditService.currentUserId
      });
      
      // Log the deletion
      if (ticketToDelete) {
        await auditService.logDeleteTicket(ticketId, ticketToDelete);
      }
      
      // Update local cache
      this.cache.tickets.data = this.cache.tickets.data.filter(t => t.id !== ticketId);
      this.cache.tickets.timestamp = Date.now();
    } catch (error) {
      console.error('Error deleting ticket:', error);
      throw error;
    } finally {
      hideLoader();
    }
  }

  // Technicians methods
  async getTechnicians(forceRefresh = false) {
    if (!this.database) return [];
    
    if (!forceRefresh && this.isCacheValid('technicians')) {
      console.log('Using cached technicians data');
      return this.cache.technicians.data;
    }
    
    return this.withRequestDeduplication('technicians', async () => {
      try {
        console.log('Fetching technicians from Firebase...');
        const snapshot = await get(child(ref(this.database), 'technicians'));
        const technicians = snapshot.val() || {};
        const techniciansList = Object.keys(technicians).map(key => ({
          id: key,
          ...technicians[key]
        }));
        
        this.updateCache('technicians', techniciansList);
        console.log('Technicians loaded:', techniciansList.length);
        return techniciansList;
      } catch (error) {
        console.error('Error fetching technicians:', error);
        return this.cache.technicians.data;
      }
    });
  }

  async addTechnician(technician) {
    if (!this.database) return null;
    
    try {
      showLoader();
      // Get all technicians to find the next ID
      const snapshot = await get(child(ref(this.database), 'technicians'));
      const technicians = snapshot.val() || {};
      
      // Get all numeric IDs and find the highest number
      const existingIds = Object.keys(technicians).map(id => {
        const num = parseInt(id);
        return isNaN(num) ? 0 : num;
      });
      
      const nextNumber = Math.max(...existingIds, 0) + 1;
      const newId = String(nextNumber).padStart(3, '0'); // Generate ID like 001, 002, 003...
      
      // Save with the new sequential ID
      const technicianRef = ref(this.database, `technicians/${newId}`);
      await set(technicianRef, { ...technician, status: 'active' });
      const newTechnician = { id: newId, ...technician, status: 'active' };
      
      // Update local cache
      this.cache.technicians.data.push(newTechnician);
      this.cache.technicians.timestamp = Date.now();
      
      return newTechnician;
    } catch (error) {
      console.error('Error adding technician:', error);
      return null;
    } finally {
      hideLoader();
    }
  }

  async updateTechnician(updatedTechnician) {
    if (!this.database) return null;
    
    try {
      showLoader();
      const technicianRef = ref(this.database, `technicians/${updatedTechnician.id}`);
      await update(technicianRef, updatedTechnician);
      
      // Update local cache
      const index = this.cache.technicians.data.findIndex(t => t.id === updatedTechnician.id);
      if (index !== -1) {
        this.cache.technicians.data[index] = updatedTechnician;
        this.cache.technicians.timestamp = Date.now();
      }
      
      return updatedTechnician;
    } catch (error) {
      console.error('Error updating technician:', error);
      return null;
    } finally {
      hideLoader();
    }
  }

  async deleteTechnician(id) {
    if (!this.database) return;
    
    try {
      showLoader();
      const technicianRef = ref(this.database, `technicians/${id}`);
      await remove(technicianRef);
      
      // Update local cache
      this.cache.technicians.data = this.cache.technicians.data.filter(t => t.id !== id);
      this.cache.technicians.timestamp = Date.now();
    } catch (error) {
      console.error('Error deleting technician:', error);
      throw error;
    } finally {
      hideLoader();
    }
  }

  // Payments methods
  async getPayments(forceRefresh = false) {
    if (!this.database) return [];
    
    if (!forceRefresh && this.isCacheValid('payments')) {
      console.log('Using cached payments data');
      return this.cache.payments.data;
    }
    
    return this.withRequestDeduplication('payments', async () => {
      try {
        console.log('Fetching payments from Firebase...');
        const snapshot = await get(child(ref(this.database), 'payments'));
        const payments = snapshot.val() || {};
        const paymentsList = Object.keys(payments).map(key => ({
          id: key,
          ...payments[key]
        }));
        
        this.updateCache('payments', paymentsList);
        console.log('Payments loaded:', paymentsList.length);
        return paymentsList;
      } catch (error) {
        console.error('Error fetching payments:', error);
        return this.cache.payments.data;
      }
    });
  }

  // Get limited payments with pagination
  async getPaymentsPaginated(page = 0, pageSize = 50, forceRefresh = false) {
    const allPayments = await this.getPayments(forceRefresh);
    const start = page * pageSize;
    const end = start + pageSize;
    return {
      data: allPayments.slice(start, end),
      total: allPayments.length,
      page,
      pageSize,
      hasMore: end < allPayments.length
    };
  }

  async addPayment(payment) {
    if (!this.database) return null;
    
    try {
      showLoader();
      const paymentsRef = ref(this.database, 'payments');
      const newPaymentRef = push(paymentsRef);
      await set(newPaymentRef, payment);
      const newPayment = { id: newPaymentRef.key, ...payment };
      
      // Update local cache
      this.cache.payments.data.push(newPayment);
      this.cache.payments.timestamp = Date.now();
      
      return newPayment;
    } catch (error) {
      console.error('Error adding payment:', error);
      return null;
    } finally {
      hideLoader();
    }
  }

  // Call Logs methods
  async getCallLogs(customerId = null, forceRefresh = false) {
    if (!this.database) return [];
    
    if (!forceRefresh && this.isCacheValid('callLogs')) {
      console.log('Using cached call logs data');
      const logs = this.cache.callLogs.data;
      return customerId ? logs.filter(log => log.customerId === customerId) : logs;
    }
    
    return this.withRequestDeduplication('callLogs', async () => {
      try {
        console.log('Fetching call logs from Firebase...');
        const snapshot = await get(child(ref(this.database), 'callLogs'));
        const callLogs = snapshot.val() || {};
        const callLogsList = Object.keys(callLogs).map(key => ({
          id: key,
          ...callLogs[key]
        }));
        
        this.updateCache('callLogs', callLogsList);
        console.log('Call logs loaded:', callLogsList.length);
        return customerId ? callLogsList.filter(log => log.customerId === customerId) : callLogsList;
      } catch (error) {
        console.error('Error fetching call logs:', error);
        const logs = this.cache.callLogs.data;
        return customerId ? logs.filter(log => log.customerId === customerId) : logs;
      }
    });
  }

  async addCallLog(callLog) {
    if (!this.database) return null;
    
    try {
      const callLogsRef = ref(this.database, 'callLogs');
      const newCallLogRef = push(callLogsRef);
      await set(newCallLogRef, callLog);
      const newCallLog = { id: newCallLogRef.key, ...callLog };
      
      // Update local cache
      this.cache.callLogs.data.push(newCallLog);
      this.cache.callLogs.timestamp = Date.now();
      
      return newCallLog;
    } catch (error) {
      console.error('Error adding call log:', error);
      return null;
    }
  }

  async updateCallLog(callLogId, callLogData) {
    if (!this.database) return null;
    
    try {
      const callLogRef = ref(this.database, `callLogs/${callLogId}`);
      await update(callLogRef, callLogData);
      
      // Update local cache
      const index = this.cache.callLogs.data.findIndex(log => log.id === callLogId);
      if (index !== -1) {
        this.cache.callLogs.data[index] = { ...this.cache.callLogs.data[index], ...callLogData };
        this.cache.callLogs.timestamp = Date.now();
      }
      
      return callLogData;
    } catch (error) {
      console.error('Error updating call log:', error);
      return null;
    }
  }

  async deleteCallLog(id) {
    if (!this.database) return;
    
    try {
      const callLogRef = ref(this.database, `callLogs/${id}`);
      // Mark as deleted instead of hard delete
      await update(callLogRef, {
        deleted: true,
        deletedAt: new Date().toISOString(),
        deletedBy: auditService.currentUserId
      });
      
      // Update local cache
      this.cache.callLogs.data = this.cache.callLogs.data.filter(log => log.id !== id);
      this.cache.callLogs.timestamp = Date.now();
    } catch (error) {
      console.error('Error deleting call log:', error);
    }
  }

  // Get deleted customers for recovery
  async getDeletedCustomers() {
    if (!this.database) return [];
    
    try {
      const snapshot = await get(child(ref(this.database), 'customers'));
      const customers = snapshot.val() || {};
      const deletedCustomers = Object.keys(customers)
        .filter(key => customers[key].deleted === true)
        .map(key => ({
          id: key,
          ...customers[key]
        }));
      
      return deletedCustomers;
    } catch (error) {
      console.error('Error fetching deleted customers:', error);
      return [];
    }
  }

  // Get deleted tickets for recovery
  async getDeletedTickets() {
    if (!this.database) return [];
    
    try {
      const snapshot = await get(child(ref(this.database), 'tickets'));
      const tickets = snapshot.val() || {};
      const deletedTickets = Object.keys(tickets)
        .filter(key => tickets[key].deleted === true)
        .map(key => ({
          id: key,
          ...tickets[key]
        }));
      
      return deletedTickets;
    } catch (error) {
      console.error('Error fetching deleted tickets:', error);
      return [];
    }
  }

  // Restore a deleted customer
  async restoreCustomer(id) {
    if (!this.database) return null;
    
    try {
      const customerRef = ref(this.database, `customers/${id}`);
      await update(customerRef, {
        deleted: false,
        restoredAt: new Date().toISOString(),
        restoredBy: auditService.currentUserId
      });
      
      // Get the restored customer data
      const snapshot = await get(child(ref(this.database), `customers/${id}`));
      const restoredCustomer = { id, ...snapshot.val() };
      
      // Update cache
      this.cache.customers.data.push(restoredCustomer);
      this.cache.customers.timestamp = Date.now();
      
      // Log the restoration
      await auditService.logRestoreCustomer(id, restoredCustomer);
      
      return restoredCustomer;
    } catch (error) {
      console.error('Error restoring customer:', error);
      return null;
    }
  }

  // Restore a deleted ticket
  async restoreTicket(id) {
    if (!this.database) return null;
    
    try {
      const ticketRef = ref(this.database, `tickets/${id}`);
      await update(ticketRef, {
        deleted: false,
        restoredAt: new Date().toISOString(),
        restoredBy: auditService.currentUserId
      });
      
      // Get the restored ticket data
      const snapshot = await get(child(ref(this.database), `tickets/${id}`));
      const restoredTicket = { id, ...snapshot.val() };
      
      // Update cache
      this.cache.tickets.data.push(restoredTicket);
      this.cache.tickets.timestamp = Date.now();
      
      return restoredTicket;
    } catch (error) {
      console.error('Error restoring ticket:', error);
      return null;
    }
  }

  // Get today's follow-ups
  async getTodayFollowUps() {
    const allLogs = await this.getCallLogs();
    const today = new Date().toISOString().split('T')[0];
    
    return allLogs.filter(log => {
      if (!log.nextFollowUpDate) return false;
      return log.nextFollowUpDate <= today;
    }).sort((a, b) => {
      // Sort by date, overdue first
      if (a.nextFollowUpDate < today && b.nextFollowUpDate >= today) return -1;
      if (a.nextFollowUpDate >= today && b.nextFollowUpDate < today) return 1;
      return a.nextFollowUpDate.localeCompare(b.nextFollowUpDate);
    });
  }
}

const dataService = new DataService();
export default dataService;