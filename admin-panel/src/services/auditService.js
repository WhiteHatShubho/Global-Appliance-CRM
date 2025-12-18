/**
 * Audit Service - Logs all critical operations for data protection
 * Every delete, update, and sensitive action is recorded with:
 * - User ID who performed the action
 * - Action type
 * - Details of what changed
 * - Timestamp
 * - IP address (if available)
 */

import { ref, push, set } from 'firebase/database';

class AuditService {
  constructor() {
    this.database = null;
    this.currentUserId = null;
    this.currentUserEmail = null;
  }

  initialize(database, userId, userEmail) {
    this.database = database;
    this.currentUserId = userId;
    this.currentUserEmail = userEmail;
    console.log('Audit Service initialized for user:', userEmail);
  }

  /**
   * Log any critical action
   */
  async logAction(action, details = {}) {
    if (!this.database) {
      console.warn('Audit Service not initialized');
      return false;
    }

    try {
      const auditEntry = {
        userId: this.currentUserId,
        userEmail: this.currentUserEmail,
        action,
        details: JSON.stringify(details),
        timestamp: new Date().toISOString(),
        clientIP: await this.getClientIP(),
        userAgent: navigator.userAgent
      };

      const auditRef = ref(this.database, 'auditLogs');
      const newAuditRef = push(auditRef);
      await set(newAuditRef, auditEntry);

      console.log(`📋 Audit logged: ${action}`);
      return true;
    } catch (error) {
      console.error('Error logging audit:', error);
      // Log to console as fallback
      console.error('AUDIT FALLBACK:', action, details);
      return false;
    }
  }

  /**
   * Log customer deletion
   */
  async logDeleteCustomer(customerId, customerData) {
    return this.logAction('DELETE_CUSTOMER', {
      customerId,
      customerName: customerData.name || customerData.fullName,
      customerPhone: customerData.phone,
      deletedAt: new Date().toISOString()
    });
  }

  /**
   * Log customer update
   */
  async logUpdateCustomer(customerId, oldData, newData) {
    return this.logAction('UPDATE_CUSTOMER', {
      customerId,
      changes: this.getChangedFields(oldData, newData),
      updatedAt: new Date().toISOString()
    });
  }

  /**
   * Log customer restore
   */
  async logRestoreCustomer(customerId, customerData) {
    return this.logAction('RESTORE_CUSTOMER', {
      customerId,
      customerName: customerData.name || customerData.fullName,
      restoredAt: new Date().toISOString()
    });
  }

  /**
   * Log ticket deletion
   */
  async logDeleteTicket(ticketId, ticketData) {
    return this.logAction('DELETE_TICKET', {
      ticketId,
      customerId: ticketData.customerId,
      jobType: ticketData.jobType,
      deletedAt: new Date().toISOString()
    });
  }

  /**
   * Log payment deletion
   */
  async logDeletePayment(paymentId, paymentData) {
    return this.logAction('DELETE_PAYMENT', {
      paymentId,
      customerId: paymentData.customerId,
      amount: paymentData.amount,
      deletedAt: new Date().toISOString()
    });
  }

  /**
   * Log bulk data cleanup
   */
  async logBulkCleanup(dataTypes) {
    return this.logAction('BULK_CLEANUP', {
      dataTypes,
      warning: 'CRITICAL - Multiple data types deleted',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log admin login
   */
  async logAdminLogin() {
    return this.logAction('ADMIN_LOGIN', {
      email: this.currentUserEmail,
      loginTime: new Date().toISOString()
    });
  }

  /**
   * Log admin logout
   */
  async logAdminLogout() {
    return this.logAction('ADMIN_LOGOUT', {
      email: this.currentUserEmail,
      logoutTime: new Date().toISOString()
    });
  }

  /**
   * Get changed fields between old and new data
   */
  getChangedFields(oldData, newData) {
    const changes = {};
    const allKeys = new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})]);

    allKeys.forEach(key => {
      if (JSON.stringify(oldData?.[key]) !== JSON.stringify(newData?.[key])) {
        changes[key] = {
          old: oldData?.[key],
          new: newData?.[key]
        };
      }
    });

    return changes;
  }

  /**
   * Get client IP address
   */
  async getClientIP() {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch (error) {
      console.warn('Could not get client IP:', error);
      return 'unknown';
    }
  }
}

const auditService = new AuditService();
export default auditService;
