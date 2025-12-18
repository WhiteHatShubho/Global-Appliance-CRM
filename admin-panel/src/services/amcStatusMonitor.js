import { getDatabase, ref, get, update } from 'firebase/database';
import dataService from './dataService';

/**
 * AMC Status Monitor Service
 * Handles automatic AMC status updates based on service completion
 * and renewal expiry dates
 */
class AMCStatusMonitor {
  /**
   * Check and update AMC status for a specific customer
   * Called after a service is completed or periodically
   * @param {string} customerId - Customer ID
   * @returns {object} - { statusChanged, oldStatus, newStatus, reason }
   */
  async checkAndUpdateAMCStatus(customerId) {
    try {
      const customer = await dataService.getCustomer(customerId);
      if (!customer) {
        console.warn('Customer not found:', customerId);
        return { statusChanged: false };
      }

      // Only process AMC customers
      if (customer.customerType !== 'AMC') {
        return { statusChanged: false, reason: 'Not an AMC customer' };
      }

      const today = new Date();
      const amcEndDate = customer.amcEndDate ? new Date(customer.amcEndDate) : null;

      // Check if AMC has expired
      if (amcEndDate && amcEndDate < today) {
        // AMC expired - check if all 4 services are completed
        const services = await this.getCustomerAMCServices(customerId);
        const completedServices = services.filter(s => s.status === 'completed');
        
        if (completedServices.length >= 4 || amcEndDate < today) {
          // All services complete or AMC expired - mark as INACTIVE
          if (customer.amcStatus !== 'Inactive') {
            await dataService.updateCustomer(customerId, {
              amcStatus: 'Inactive',
              amcStatusUpdatedAt: new Date().toISOString(),
              amcStatusReason: completedServices.length >= 4 
                ? '4 services completed, AMC expired - renewal required'
                : 'AMC end date reached without renewal'
            });
            
            console.log(`✅ AMC Status updated to INACTIVE for customer ${customer.fullName}`);
            return {
              statusChanged: true,
              oldStatus: customer.amcStatus,
              newStatus: 'Inactive',
              reason: 'AMC expired and services completed'
            };
          }
        }
      }

      return { statusChanged: false };
    } catch (error) {
      console.error('Error checking AMC status:', error);
      return { statusChanged: false, error: error.message };
    }
  }

  /**
   * Get all AMC services for a customer
   * @param {string} customerId - Customer ID
   * @returns {array} - Array of AMC services
   */
  async getCustomerAMCServices(customerId) {
    try {
      const db = getDatabase();
      const servicesRef = ref(db, 'services');
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

      return customerServices;
    } catch (error) {
      console.error('Error fetching customer AMC services:', error);
      return [];
    }
  }

  /**
   * Monitor all customers and update AMC status
   * Should be called periodically (daily) or triggered manually
   * @returns {object} - { processed, updated, errors }
   */
  async monitorAllCustomersAMC() {
    try {
      console.log('🔍 Starting AMC status monitoring for all customers...');
      const customers = await dataService.getCustomers();
      let processed = 0;
      let updated = 0;
      const errors = [];

      for (const customer of customers) {
        if (customer.customerType === 'AMC') {
          processed++;
          try {
            const result = await this.checkAndUpdateAMCStatus(customer.id);
            if (result.statusChanged) {
              updated++;
            }
          } catch (error) {
            errors.push({ customerId: customer.id, error: error.message });
          }
        }
      }

      console.log(`✅ AMC monitoring complete: ${processed} processed, ${updated} updated, ${errors.length} errors`);
      return { processed, updated, errors };
    } catch (error) {
      console.error('Error monitoring AMC status:', error);
      return { processed: 0, updated: 0, errors: [error.message] };
    }
  }

  /**
   * Check if customer should receive renewal reminder
   * @param {object} customer - Customer data
   * @returns {boolean} - True if renewal reminder should be sent
   */
  shouldSendRenewalReminder(customer) {
    if (!customer.amcEndDate || customer.customerType !== 'AMC') return false;

    const today = new Date();
    const amcEndDate = new Date(customer.amcEndDate);
    const daysUntilExpiry = Math.floor((amcEndDate - today) / (1000 * 60 * 60 * 24));

    // Send reminder at 30, 15, 7 days before expiry
    const reminderDays = [30, 15, 7];
    return reminderDays.includes(daysUntilExpiry);
  }

  /**
   * Get renewal reminder message for customer
   * @param {object} customer - Customer data
   * @returns {string} - Reminder message
   */
  getRenewalReminderMessage(customer) {
    const today = new Date();
    const amcEndDate = new Date(customer.amcEndDate);
    const daysLeft = Math.floor((amcEndDate - today) / (1000 * 60 * 60 * 24));

    return `🔔 AMC Renewal Reminder: ${customer.fullName}'s AMC expires in ${daysLeft} days (${customer.amcEndDate}). Renewal amount: ₹${customer.amcAmount}`;
  }

  /**
   * Check if 4th service is completed and trigger renewal prompt
   * @param {string} customerId - Customer ID
   * @param {string} serviceId - Completed service ID
   * @returns {object} - { isLastService, shouldPromptRenewal }
   */
  async checkLastServiceCompleted(customerId, serviceId) {
    try {
      const services = await this.getCustomerAMCServices(customerId);
      const completedService = services.find(s => s.id === serviceId);
      
      if (!completedService || completedService.amcServiceNumber !== 4) {
        return { isLastService: false, shouldPromptRenewal: false };
      }

      // This is the 4th service
      const allCompleted = services.filter(s => s.status === 'completed').length >= 4;
      
      if (allCompleted) {
        console.log(`✅ All 4 AMC services completed for customer ${customerId}. Renewal required.`);
        return {
          isLastService: true,
          shouldPromptRenewal: true,
          message: 'All 4 quarterly services completed. Customer should renew AMC to continue coverage.'
        };
      }

      return { isLastService: true, shouldPromptRenewal: false };
    } catch (error) {
      console.error('Error checking last service:', error);
      return { isLastService: false, shouldPromptRenewal: false };
    }
  }

  /**
   * Validate service reschedule - ensures AMC integrity
   * IMPORTANT: When rescheduling AMC services:
   * - scheduledDate can be changed (actual service date)
   * - amcOriginalDate must NEVER be changed (tracks original month)
   * - AMC end date remains UNCHANGED regardless of service delays
   * - Service still counts as the same service number (1st, 2nd, 3rd, or 4th)
   * 
   * @param {string} serviceId - Service ID being rescheduled
   * @param {string} newDate - New scheduled date
   * @returns {object} - { valid, warnings, originalDate }
   */
  async validateServiceReschedule(serviceId, newDate) {
    try {
      const db = getDatabase();
      const serviceRef = ref(db, `services/${serviceId}`);
      const snapshot = await get(serviceRef);
      
      if (!snapshot.exists()) {
        return { valid: false, error: 'Service not found' };
      }

      const service = snapshot.val();
      
      if (!service.amcGenerated) {
        // Not an AMC service, no special validation needed
        return { valid: true, warnings: [] };
      }

      const warnings = [];
      const originalDate = service.amcOriginalDate;
      const originalMonth = originalDate ? new Date(originalDate).getMonth() : null;
      const newMonth = new Date(newDate).getMonth();

      // Warning if moving to a different month
      if (originalMonth !== null && originalMonth !== newMonth) {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                           'July', 'August', 'September', 'October', 'November', 'December'];
        warnings.push(
          `⚠️ Service originally scheduled for ${monthNames[originalMonth]} is being moved to ${monthNames[newMonth]}. ` +
          `AMC end date and service sequence remain unchanged.`
        );
      }

      return {
        valid: true,
        warnings,
        originalDate,
        amcServiceNumber: service.amcServiceNumber,
        reminder: 'AMC end date will NOT be extended due to this reschedule'
      };
    } catch (error) {
      console.error('Error validating service reschedule:', error);
      return { valid: false, error: error.message };
    }
  }

  /**
   * Get customer AMC info with service completion status
   * @param {string} customerId - Customer ID
   * @returns {object} - AMC summary with service status
   */
  async getCustomerAMCSummary(customerId) {
    try {
      const customer = await dataService.getCustomer(customerId);
      if (!customer) return null;

      const services = await this.getCustomerAMCServices(customerId);
      const completedServices = services.filter(s => s.status === 'completed');
      const pendingServices = services.filter(s => s.status === 'pending' || s.status === 'assigned');
      const overdueServices = services.filter(s => {
        const schedDate = new Date(s.scheduledDate);
        return schedDate < new Date() && s.status !== 'completed';
      });

      const today = new Date();
      const amcEndDate = customer.amcEndDate ? new Date(customer.amcEndDate) : null;
      const daysUntilExpiry = amcEndDate ? Math.floor((amcEndDate - today) / (1000 * 60 * 60 * 24)) : null;

      return {
        customerId,
        customerName: customer.fullName,
        amcStatus: customer.amcStatus || 'Active',
        amcStartDate: customer.amcStartDate,
        amcEndDate: customer.amcEndDate,
        daysUntilExpiry,
        totalServices: services.length,
        completedServices: completedServices.length,
        pendingServices: pendingServices.length,
        overdueServices: overdueServices.length,
        services: services.map(s => ({
          id: s.id,
          serviceNumber: s.amcServiceNumber,
          serviceType: s.serviceType,
          originalDate: s.amcOriginalDate,
          scheduledDate: s.scheduledDate,
          status: s.status,
          isDelayed: s.scheduledDate !== s.amcOriginalDate
        }))
      };
    } catch (error) {
      console.error('Error getting AMC summary:', error);
      return null;
    }
  }
}

export default new AMCStatusMonitor();
