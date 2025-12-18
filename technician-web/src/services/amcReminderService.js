/**
 * AMC Service Reminder Service (Technician App)
 * 
 * CORE RULE:
 * AMC service reminders are calculated based on LAST SERVICE DATE
 * BUT the AMC END DATE / RENEWAL DATE remains FIXED
 * 
 * AMC DATA STRUCTURE:
 * {
 *   startDate,            // FIXED
 *   endDate,              // FIXED (startDate + duration)
 *   intervalMonths: 3,
 *   totalServices: 4,
 *   servicesCompleted: 0,
 *   lastServiceDate: null,
 *   nextServiceDate: null,
 *   isActive: true
 * }
 */

class AMCReminderService {
  /**
   * Add months to a date
   * @param {string} dateStr - Date in YYYY-MM-DD format
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
   * Calculate next service date based on last service date
   * @param {string} lastServiceDate - Last service completion date
   * @param {number} intervalMonths - Months interval between services (default: 3)
   * @returns {string} - Next service date in YYYY-MM-DD format
   */
  calculateNextServiceDate(lastServiceDate, intervalMonths = 3) {
    if (!lastServiceDate) return null;
    return this.addMonthsToDate(lastServiceDate, intervalMonths);
  }

  /**
   * Process service completion for AMC customer
   * Updates lastServiceDate and recalculates nextServiceDate
   * @param {object} amc - Current AMC object
   * @param {string} completionDate - Service completion date (YYYY-MM-DD)
   * @returns {object} - Updated AMC object
   */
  processServiceCompletion(amc, completionDate) {
    if (!amc) {
      console.warn('AMC object is null');
      return null;
    }

    const updated = { ...amc };

    // Increment completed services
    updated.servicesCompleted = (updated.servicesCompleted || 0) + 1;

    // Set last service date
    updated.lastServiceDate = completionDate;

    // Calculate next service date from lastServiceDate
    updated.nextServiceDate = this.calculateNextServiceDate(
      completionDate,
      updated.intervalMonths || 3
    );

    console.log(`✅ AMC Service Completed:
      - Completed: ${updated.servicesCompleted}/${updated.totalServices}
      - Last Service: ${updated.lastServiceDate}
      - Next Service: ${updated.nextServiceDate}
      - AMC End: ${updated.endDate} (UNCHANGED)`);

    return updated;
  }

  /**
   * Handle early service completion
   * If a service is completed before scheduled reminder date
   * @param {object} amc - Current AMC object
   * @param {string} completionDate - Actual completion date
   * @param {string} scheduledDate - Originally scheduled date
   * @returns {object} - Updated AMC object with cancelled upcoming reminder
   */
  handleEarlyServiceCompletion(amc, completionDate, scheduledDate) {
    if (!amc) return null;

    const updated = this.processServiceCompletion(amc, completionDate);

    if (completionDate < scheduledDate) {
      console.log(`⏱️ Service completed EARLY:
        - Scheduled: ${scheduledDate}
        - Completed: ${completionDate}
        - Upcoming reminder cancelled
        - nextServiceDate recalculated from actual completion`);
    }

    return updated;
  }

  /**
   * Check if AMC service reminder should be displayed
   * @param {object} amc - AMC object
   * @param {string} currentDate - Today's date (YYYY-MM-DD)
   * @returns {boolean} - True if reminder should be displayed
   */
  shouldShowServiceReminder(amc, currentDate = null) {
    if (!amc) return false;

    const today = currentDate || new Date().toISOString().split('T')[0];

    // Check if AMC is active
    if (amc.isActive !== true) {
      console.log('❌ AMC not active - no reminder');
      return false;
    }

    // Check if next service date is set
    if (!amc.nextServiceDate) {
      console.log('❌ No next service date set - no reminder');
      return false;
    }

    // Check if current date >= next service date
    if (today < amc.nextServiceDate) {
      console.log(`❌ Not due yet - reminder scheduled for ${amc.nextServiceDate}`);
      return false;
    }

    // Check if within AMC period (before end date)
    if (today > amc.endDate) {
      console.log(`❌ AMC ended (${amc.endDate}) - show renewal reminder instead`);
      return false;
    }

    console.log(`✅ Show service reminder - due since ${amc.nextServiceDate}`);
    return true;
  }

  /**
   * Check if AMC renewal reminder should be displayed
   * @param {object} amc - AMC object
   * @param {string} currentDate - Today's date (YYYY-MM-DD)
   * @returns {object} - { shouldShow, daysLeft, reason }
   */
  shouldShowRenewalReminder(amc, currentDate = null) {
    if (!amc) {
      return { shouldShow: false, reason: 'No AMC data' };
    }

    const today = currentDate || new Date().toISOString().split('T')[0];

    // Check if AMC is expired
    if (today > amc.endDate) {
      const daysLeft = Math.floor(
        (new Date(today) - new Date(amc.endDate)) / (1000 * 60 * 60 * 24)
      );
      return {
        shouldShow: true,
        daysLeft: -Math.abs(daysLeft),
        reason: 'AMC EXPIRED - Renewal Required'
      };
    }

    // Check if services completed
    if (amc.servicesCompleted >= amc.totalServices) {
      return {
        shouldShow: true,
        daysLeft: Math.floor(
          (new Date(amc.endDate) - new Date(today)) / (1000 * 60 * 60 * 24)
        ),
        reason: 'All services completed - Renewal Required'
      };
    }

    // Check if within 30 days of expiry
    const daysUntilExpiry = Math.floor(
      (new Date(amc.endDate) - new Date(today)) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilExpiry <= 30 && daysUntilExpiry >= 0) {
      return {
        shouldShow: true,
        daysLeft: daysUntilExpiry,
        reason: 'AMC expiring soon'
      };
    }

    return { shouldShow: false, reason: 'AMC active, no renewal needed yet' };
  }

  /**
   * Deactivate AMC when either condition is met:
   * 1. All services completed (servicesCompleted == totalServices)
   * 2. AMC end date passed (currentDate > endDate)
   * @param {object} amc - AMC object
   * @param {string} currentDate - Today's date (YYYY-MM-DD)
   * @returns {object} - Updated AMC object
   */
  checkAndDeactivateAMC(amc, currentDate = null) {
    if (!amc) return null;

    const today = currentDate || new Date().toISOString().split('T')[0];
    const updated = { ...amc };

    const allServicesCompleted = updated.servicesCompleted >= updated.totalServices;
    const amcExpired = today > updated.endDate;

    if (allServicesCompleted || amcExpired) {
      updated.isActive = false;

      const reason = allServicesCompleted
        ? `All ${updated.totalServices} services completed`
        : `AMC end date (${updated.endDate}) reached`;

      console.log(`🔴 AMC DEACTIVATED:
        - Reason: ${reason}
        - Services: ${updated.servicesCompleted}/${updated.totalServices}
        - Today: ${today}
        - AMC End: ${updated.endDate}
        - Renewal required`);

      return updated;
    }

    return updated;
  }

  /**
   * Validate AMC structure and ensure required fields
   * @param {object} amc - AMC object
   * @returns {object} - { valid, errors, warnings }
   */
  validateAMC(amc) {
    const errors = [];
    const warnings = [];

    if (!amc) {
      errors.push('AMC object is null');
      return { valid: false, errors, warnings };
    }

    // Required fields
    const required = ['startDate', 'endDate', 'intervalMonths', 'totalServices'];
    required.forEach(field => {
      if (!amc[field]) {
        errors.push(`Missing required field: ${field}`);
      }
    });

    // Validate dates
    if (amc.startDate && amc.endDate) {
      if (amc.startDate > amc.endDate) {
        errors.push('Start date cannot be after end date');
      }
    }

    // Warnings
    if (amc.servicesCompleted > amc.totalServices) {
      warnings.push(
        `More services completed (${amc.servicesCompleted}) than total (${amc.totalServices})`
      );
    }

    if (amc.lastServiceDate && amc.nextServiceDate) {
      if (amc.nextServiceDate <= amc.lastServiceDate) {
        warnings.push('Next service date should be after last service date');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get AMC status summary
   * @param {object} amc - AMC object
   * @param {string} currentDate - Today's date
   * @returns {object} - Detailed AMC status
   */
  getAMCStatus(amc, currentDate = null) {
    if (!amc) return null;

    const today = currentDate || new Date().toISOString().split('T')[0];

    const daysUntilExpiry = Math.floor(
      (new Date(amc.endDate) - new Date(today)) / (1000 * 60 * 60 * 24)
    );

    const servicesRemaining = amc.totalServices - amc.servicesCompleted;
    const reminderDue = this.shouldShowServiceReminder(amc, today);
    const renewalReminder = this.shouldShowRenewalReminder(amc, today);
    const isExpired = today > amc.endDate;

    return {
      isActive: amc.isActive,
      startDate: amc.startDate,
      endDate: amc.endDate,
      daysUntilExpiry,
      isExpired,
      servicesCompleted: amc.servicesCompleted,
      totalServices: amc.totalServices,
      servicesRemaining,
      lastServiceDate: amc.lastServiceDate,
      nextServiceDate: amc.nextServiceDate,
      reminderDue,
      renewalNeeded: renewalReminder.shouldShow,
      renewalReason: renewalReminder.reason
    };
  }
}

export default new AMCReminderService();
