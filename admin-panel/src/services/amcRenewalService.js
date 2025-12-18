import { getDatabase, ref, push, set, update, get } from 'firebase/database';
import dataService from './dataService';

/**
 * AMC Renewal Service
 * Handles complete AMC renewal workflow:
 * 1. Update customer with new AMC details
 * 2. Auto-generate 4 new AMC services
 * 3. Remove/archive old pending services
 * 4. Update formatted text for Google Contacts
 */
class AMCRenewalService {
  /**
   * Calculate date by adding months to a given date
   * @param {string} dateStr - Date string in YYYY-MM-DD format
   * @param {number} months - Number of months to add
   * @returns {string} - New date in YYYY-MM-DD format
   */
  addMonthsToDate(dateStr, months) {
    const date = new Date(dateStr);
    date.setMonth(date.getMonth() + months);
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Process AMC renewal - main function
   * @param {string} customerId - Customer ID
   * @param {object} renewalData - { newAmcStartDate, newAmcAmount, newAmcPaidAmount, duration }
   * @param {object} customerData - Current customer data
   * @returns {object} - { success, message, newServices }
   */
  async processAMCRenewal(customerId, renewalData, customerData) {
    try {
      console.log('🔄 Processing AMC Renewal for customer:', customerId);
      
      const { newAmcStartDate, newAmcAmount, newAmcPaidAmount, duration = 12 } = renewalData;

      // Validate required fields
      if (!newAmcStartDate || !newAmcAmount) {
        throw new Error('AMC Start Date and Amount are required');
      }

      // Calculate new AMC end date (duration in months, default 12 for 1 year)
      const newAmcEndDate = this.addMonthsToDate(newAmcStartDate, duration);
      
      console.log(`📅 New AMC Period: ${newAmcStartDate} to ${newAmcEndDate}`);

      // Step 1: Update customer with new AMC details
      const updateData = {
        amcStartDate: newAmcStartDate,
        amcEndDate: newAmcEndDate,
        amcAmount: parseFloat(newAmcAmount),
        amcPaidAmount: parseFloat(newAmcPaidAmount || 0),
        amcStatus: 'Active',
        amcCycle: '0/4', // Reset to new cycle
        amcRenewalDate: new Date().toISOString().split('T')[0],
        formattedText: this.generateNewFormattedText(customerData, newAmcStartDate, newAmcEndDate, newAmcAmount)
      };

      await dataService.updateCustomer(customerId, updateData);
      console.log('✅ Customer AMC details updated');

      // Step 2: Generate 4 new AMC services
      const newServices = await this.generateNewAMCServices(customerData, customerId, newAmcStartDate);
      console.log(`✅ Generated ${newServices.length} new AMC services`);

      // Step 3: Remove/archive old pending AMC services
      await this.removeOldAMCServices(customerId);
      console.log('✅ Old AMC services archived');

      return {
        success: true,
        message: `✅ AMC renewed successfully! New cycle starts: ${newAmcStartDate}`,
        newServices: newServices,
        newAmcEndDate: newAmcEndDate
      };
    } catch (error) {
      console.error('❌ Error processing AMC renewal:', error);
      return {
        success: false,
        message: `❌ Error: ${error.message}`
      };
    }
  }

  /**
   * Generate 4 new AMC services after renewal
   * @param {object} customer - Customer data
   * @param {string} customerId - Customer ID
   * @param {string} newStartDate - New AMC start date (YYYY-MM-DD)
   * @returns {array} - Array of created service IDs
   */
  async generateNewAMCServices(customer, customerId, newStartDate) {
    try {
      const db = getDatabase();
      const servicesRef = ref(db, 'services');
      
      const serviceIntervals = [3, 6, 9, 12]; // months
      const serviceTypes = ['1st Service', '2nd Service', '3rd Service', '4th Service (Renewal)'];
      const createdServices = [];

      console.log('🛠️ Generating 4 new AMC services starting from:', newStartDate);

      for (let i = 0; i < serviceIntervals.length; i++) {
        const serviceDate = this.addMonthsToDate(newStartDate, serviceIntervals[i]);
        
        const newServiceRef = push(servicesRef);
        const serviceData = {
          customerName: customer.fullName || customer.name,
          customerId: customerId,
          customerPhone: customer.phone,
          customerAddress: customer.address || '',
          segment: customer.segment,
          serviceType: serviceTypes[i],
          status: 'pending',
          scheduledDate: serviceDate,
          createdAt: new Date().toISOString(),
          description: `Automatic ${serviceTypes[i]} - New AMC cycle scheduled service`,
          amcGenerated: true,
          renewalCycle: true, // Mark as generated after renewal
          isNewCycle: true, // Mark as new cycle
          type: 'SERVICE', // Mark as SERVICE type to appear in Services tab only
          amcServiceNumber: i + 1, // Track which service in sequence (1-4)
          amcCycleMonth: serviceIntervals[i], // Track original scheduled month offset
          amcOriginalDate: serviceDate // Store original scheduled date
        };

        await set(newServiceRef, serviceData);
        createdServices.push(newServiceRef.key);
        console.log(`✅ Service ${i + 1}/4: ${serviceTypes[i]} scheduled for ${serviceDate}`);
      }

      return createdServices;
    } catch (error) {
      console.error('❌ Error generating AMC services:', error);
      throw error;
    }
  }

  /**
   * Remove/archive old pending AMC services after renewal
   * @param {string} customerId - Customer ID
   */
  async removeOldAMCServices(customerId) {
    try {
      const db = getDatabase();
      const servicesRef = ref(db, 'services');
      
      // Query services for this customer that are AMC-generated and pending
      const snapshot = await get(servicesRef);
      if (!snapshot.exists()) return;

      const allServices = snapshot.val();
      const db_instance = getDatabase();

      for (const serviceId in allServices) {
        const service = allServices[serviceId];
        
        // Find services for this customer that are AMC-generated, pending, and NOT from renewal cycle
        if (service.customerId === customerId && 
            service.amcGenerated && 
            service.status === 'pending' && 
            !service.renewalCycle) {
          
          // Mark as archived instead of deleting
          await update(ref(db_instance, `services/${serviceId}`), {
            status: 'archived',
            archivedAt: new Date().toISOString(),
            archivedReason: 'Replaced by new AMC renewal cycle'
          });
          console.log(`📦 Archived old service: ${serviceId}`);
        }
      }
    } catch (error) {
      console.error('⚠️ Warning: Could not archive old services:', error);
      // Don't throw - continue with renewal even if archival fails
    }
  }

  /**
   * Generate new formatted text for Google Contacts with renewed AMC data
   * @param {object} customer - Customer data
   * @param {string} newStartDate - New AMC start date
   * @param {string} newEndDate - New AMC end date
   * @param {number} newAmount - New AMC amount
   * @returns {string} - Formatted text
   */
  generateNewFormattedText(customer, newStartDate, newEndDate, newAmount) {
    const { fullName = '', address = '', cardNumber = '', segment = 'waterpurifier' } = customer;
    
    if (!fullName || !cardNumber) return '';

    const nameParts = fullName.trim().split(' ');
    const lastName = nameParts[nameParts.length - 1];
    const firstName = nameParts.slice(0, -1).join(' ') || nameParts[0];
    const cleanAddress = (address || '').trim();

    let prefix = 'RO'; // Default for Water Purifier
    if (segment === 'chimney') prefix = 'CH';
    if (segment === 'rent') prefix = 'RentRo';

    // Extract month number from new start date
    const monthNumber = newStartDate.substring(5, 7);
    const endYear = newEndDate.substring(0, 4);

    // Format: PREFIX + MonthNumber + LastName + FirstName + Address + StartDate-EndYear AMC-Amount/- + LastName + CardNumber
    return `${prefix}${monthNumber}${lastName} ${firstName} ${cleanAddress}${newStartDate}-${endYear} AMC-${newAmount}/- ${lastName} ${cardNumber}`;
  }
}

export default new AMCRenewalService();
