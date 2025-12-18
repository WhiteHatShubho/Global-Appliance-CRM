/**
 * Customer formatting utilities for consistent text display across the app
 */

/**
 * Extract month number from date string
 * @param {string} dateStr - Date in format DD/MM/YY or YYYY-MM-DD
 * @returns {string} - Month number in 01-12 format
 */
export const getMonthNoFromDate = (dateStr) => {
  if (!dateStr) return '01';
  
  try {
    // Handle DD/MM/YY format
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        const month = parseInt(parts[1], 10);
        return String(month).padStart(2, '0');
      }
    }
    
    // Handle YYYY-MM-DD format
    if (dateStr.includes('-')) {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const month = parseInt(parts[1], 10);
        return String(month).padStart(2, '0');
      }
    }
  } catch (err) {
    console.error('Error parsing date:', dateStr, err);
  }
  
  return '01';
};

/**
 * Generate formatted customer text line with two formats based on Customer Type
 * 
 * Format 1 (Under AMC - Active):
 * Ro<MONTH><LAST_NAME> <FIRST_NAME> <ADDRESS><START_DATE>-<END_YEAR> AMC-<AMOUNT>/- <LAST_NAME> <CARD_NO>
 * Example: Ro11Sarkar Subhash Joramandir11/11/2024-2025 AMC-4500/- Sarkar 001
 * 
 * Format 2 (Non-AMC or Expired):
 * Ro<MONTH> <LAST_NAME> <FIRST_NAME> <ADDRESS> <START_DATE> - <AMOUNT>/- <LAST_NAME> <CARD_NO>
 * Example: Ro01 Sarkar Subhash Joramandir 11/11/2024 - 4500/- Sarkar 001
 * 
 * @param {object} customer - Customer object with fields: fullName, amcStartDate, amcEndDate, amcAmount, address, cardNumber, customerType
 * @returns {string} - Formatted text line
 */
export const generateCustomerFormattedText = (customer) => {
  if (!customer) return '';
  
  // Extract month number from AMC start date
  const monthNo = getMonthNoFromDate(customer.amcStartDate);
  
  // Extract first and last name from fullName
  const customerName = customer.fullName || customer.name || '';
  const nameParts = customerName.split(/\s+/).filter(part => part.length > 0);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
  
  // Extract address
  const address = customer.address || '';
  
  // Extract start date
  const startDate = customer.amcStartDate || '';
  
  // Extract amount
  const amount = customer.amcAmount || '';
  
  // Extract card number
  const cardNo = customer.cardNumber || '';
  
  // Check customer type: 'AMC' means use Format 1, otherwise use Format 2
  const isUnderAMC = customer.customerType === 'AMC';
  
  if (isUnderAMC) {
    // Format 1 (Under AMC): Ro<MONTH><LAST_NAME> <FIRST_NAME> <ADDRESS><START_DATE>-<END_YEAR> AMC-<AMOUNT>/- <LAST_NAME> <CARD_NO>
    let endYear = '';
    if (customer.amcEndDate) {
      // Handle both DD/MM/YYYY and YYYY-MM-DD formats
      if (customer.amcEndDate.includes('/')) {
        const parts = customer.amcEndDate.split('/');
        endYear = parts[2] || ''; // Get year from DD/MM/YYYY
      } else if (customer.amcEndDate.includes('-')) {
        const parts = customer.amcEndDate.split('-');
        endYear = parts[0] || ''; // Get year from YYYY-MM-DD
      }
    }
    
    const formattedText = `Ro${monthNo}${lastName} ${firstName} ${address}${startDate}-${endYear} AMC-${amount}/- ${lastName} ${cardNo}`.trim();
    return formattedText;
  } else {
    // Format 2 (Non-AMC): Ro<MONTH> <LAST_NAME> <FIRST_NAME> <ADDRESS> <START_DATE> - <AMOUNT>/- <LAST_NAME> <CARD_NO>
    const formattedText = `Ro${monthNo} ${lastName} ${firstName} ${address} ${startDate} - ${amount}/- ${lastName} ${cardNo}`.trim();
    return formattedText;
  }
};

/**
 * Check if formatted text is AMC active
 * Format 1 (Active): ...AMC-<AMOUNT>/- ... (contains "AMC-")
 * Format 2 (Expired): ...instead has " - " separator
 * @param {string} formattedText - The formatted customer text
 * @returns {boolean}
 */
export const isAMCActiveFromText = (formattedText) => {
  // Check if the formatted text contains the active AMC format (AMC-)
  return formattedText && formattedText.includes('AMC-');
};

/**
 * Extract month number from formatted text
 * Format: Ro<MONTH><LAST_NAME>...
 * @param {string} formattedText - The formatted customer text
 * @returns {string} - Month number (01-12) or empty string if not found
 */
export const getMonthNoFromFormattedText = (formattedText) => {
  if (!formattedText) return '';
  
  // The format is: Ro<MONTH><LAST_NAME>...
  // Extract 2 digits after "Ro"
  const match = formattedText.match(/^Ro(\d{2})/);
  if (match && match[1]) {
    const monthNo = match[1];
    // Validate it's a valid month (01-12)
    const monthNum = parseInt(monthNo, 10);
    if (monthNum >= 1 && monthNum <= 12) {
      return monthNo;
    }
  }
  
  return '';
};

/**
 * Get AMC status badge color and text
 * @param {string|object} formattedTextOrCustomer - The formatted customer text or customer object
 * @param {object} customer - (Optional) Customer object for date checking
 * @returns {object} - { badgeColor, badgeText }
 */
export const getAMCStatusBadge = (formattedTextOrCustomer, customer = null) => {
  // If first param is a customer object (has properties like amcEndDate)
  if (typeof formattedTextOrCustomer === 'object' && formattedTextOrCustomer !== null && formattedTextOrCustomer.amcEndDate) {
    const customerObj = formattedTextOrCustomer;
    const endDate = customerObj.amcEndDate || customerObj.amc?.endDate;
    
    if (!endDate) {
      return {
        badgeColor: '#999',
        badgeText: 'NO AMC'
      };
    }
    
    const today = new Date();
    const expiryDate = new Date(endDate);
    const daysLeft = Math.floor((expiryDate - today) / (1000 * 60 * 60 * 24));
    
    if (daysLeft < 0) {
      return {
        badgeColor: '#dc3545',
        badgeText: '✗ Expired'
      };
    } else if (daysLeft <= 7) {
      return {
        badgeColor: '#ffc107',
        badgeText: '⚠ Expiring'
      };
    } else {
      return {
        badgeColor: '#28a745',
        badgeText: '✓ Active'
      };
    }
  }
  
  // Fallback to formatted text checking (for backward compatibility)
  const formattedText = typeof formattedTextOrCustomer === 'string' ? formattedTextOrCustomer : '';
  const isActive = isAMCActiveFromText(formattedText);
  
  return {
    badgeColor: isActive ? '#28a745' : '#999',
    badgeText: isActive ? 'AMC ACTIVE' : 'NO AMC'
  };
};
