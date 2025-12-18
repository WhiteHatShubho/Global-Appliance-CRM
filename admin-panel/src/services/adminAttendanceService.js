/**
 * Admin Attendance Management Service
 * Full control: Edit, add, correct attendance records
 * Includes audit logging for all changes
 */

import { getDatabase, ref, set, get, update } from 'firebase/database';

class AdminAttendanceService {
  /**
   * Get all attendance records for a technician
   * @param {string} technicianId - Technician ID
   * @param {string} yearMonth - 'YYYY-MM' format (optional, null for all)
   * @returns {array} - All attendance records
   */
  async getTechnicianAttendance(technicianId, yearMonth = null) {
    try {
      const db = getDatabase();
      const attendanceRef = ref(db, `attendance/${technicianId}`);
      const snapshot = await get(attendanceRef);

      if (!snapshot.exists()) {
        return [];
      }

      let records = snapshot.val();
      
      // Filter by month if specified
      if (yearMonth) {
        const filtered = {};
        for (const [date, record] of Object.entries(records)) {
          if (date.startsWith(yearMonth)) {
            filtered[date] = record;
          }
        }
        records = filtered;
      }

      return records;
    } catch (error) {
      console.error('Error fetching technician attendance:', error);
      throw error;
    }
  }

  /**
   * Edit attendance record for any date
   * Admin can edit past, present, or future dates
   * @param {string} technicianId - Technician ID
   * @param {string} date - Date in YYYY-MM-DD format
   * @param {object} attendanceData - New attendance data
   * @param {string} adminId - Admin ID making the change
   * @param {string} reason - Reason for the edit
   * @returns {object} - Result with audit log
   */
  async editAttendance(technicianId, date, attendanceData, adminId, reason) {
    try {
      const db = getDatabase();
      const attendanceRef = ref(db, `attendance/${technicianId}/${date}`);
      
      // Get old record for audit
      const oldSnapshot = await get(attendanceRef);
      const oldRecord = oldSnapshot.exists() ? oldSnapshot.val() : null;

      // Create audit log entry
      const auditLog = {
        editedBy: adminId,
        editedAt: new Date().toISOString(),
        oldValue: oldRecord,
        newValue: attendanceData,
        reason: reason,
        changeType: oldRecord ? 'UPDATE' : 'CREATE'
      };

      // Add audit log to new record
      const updatedRecord = {
        ...attendanceData,
        technicianId,
        date,
        adminEditLog: auditLog,
        lastModified: new Date().toISOString(),
        lastModifiedBy: adminId
      };

      // Save updated record
      await set(attendanceRef, updatedRecord);

      // Also save to audit trail
      await this.saveAuditLog(technicianId, date, auditLog);

      return {
        success: true,
        message: `✅ Attendance updated for ${date}`,
        record: updatedRecord,
        auditLog
      };
    } catch (error) {
      console.error('Error editing attendance:', error);
      return {
        success: false,
        message: '❌ Error: ' + error.message,
        error
      };
    }
  }

  /**
   * Create new attendance record for past date (backdated)
   * @param {string} technicianId - Technician ID
   * @param {string} date - Date in YYYY-MM-DD format
   * @param {object} attendanceData - Attendance details
   * @param {string} adminId - Admin ID
   * @param {string} reason - Reason for creating
   * @returns {object} - Result with audit log
   */
  async addBackdatedAttendance(technicianId, date, attendanceData, adminId, reason) {
    try {
      const db = getDatabase();
      
      // Check if record already exists
      const attendanceRef = ref(db, `attendance/${technicianId}/${date}`);
      const snapshot = await get(attendanceRef);
      
      if (snapshot.exists()) {
        return {
          success: false,
          message: `⚠️ Attendance already exists for ${date}. Use Edit instead.`
        };
      }

      // Create new record
      const newRecord = {
        technicianId,
        date,
        ...attendanceData,
        status: attendanceData.status || 'completed',
        isBackdated: true,
        backedatedAt: new Date().toISOString(),
        backedatedBy: adminId,
        adminEditLog: {
          editedBy: adminId,
          editedAt: new Date().toISOString(),
          oldValue: null,
          newValue: attendanceData,
          reason: reason,
          changeType: 'BACKDATED_CREATE'
        }
      };

      // Save record
      await set(attendanceRef, newRecord);

      // Save to audit trail
      await this.saveAuditLog(technicianId, date, newRecord.adminEditLog);

      return {
        success: true,
        message: `✅ Backdated attendance created for ${date}`,
        record: newRecord
      };
    } catch (error) {
      console.error('Error adding backdated attendance:', error);
      return {
        success: false,
        message: '❌ Error: ' + error.message
      };
    }
  }

  /**
   * Mark attendance with different statuses
   * @param {string} technicianId - Technician ID
   * @param {string} date - Date in YYYY-MM-DD format
   * @param {string} status - 'present', 'absent', 'holiday', 'worked_on_holiday'
   * @param {string} adminId - Admin ID
   * @param {string} reason - Reason for marking
   * @returns {object} - Result
   */
  async markAttendanceStatus(technicianId, date, status, adminId, reason) {
    try {
      const validStatuses = ['present', 'absent', 'holiday', 'worked_on_holiday'];
      
      if (!validStatuses.includes(status)) {
        return {
          success: false,
          message: `❌ Invalid status. Must be: ${validStatuses.join(', ')}`
        };
      }

      const db = getDatabase();
      const attendanceRef = ref(db, `attendance/${technicianId}/${date}`);
      const snapshot = await get(attendanceRef);
      
      let attendanceRecord = snapshot.exists() ? snapshot.val() : {};

      // Get old record for audit
      const oldValue = { ...attendanceRecord };

      // Update status based on type
      if (status === 'absent') {
        attendanceRecord.status = 'incomplete';
        attendanceRecord.checkInTime = null;
        attendanceRecord.checkOutTime = null;
        attendanceRecord.workingHours = 0;
        attendanceRecord.isAbsent = true;
      } else if (status === 'present') {
        attendanceRecord.status = 'completed';
        attendanceRecord.checkInTime = attendanceRecord.checkInTime || '09:00:00 AM';
        attendanceRecord.checkOutTime = attendanceRecord.checkOutTime || '06:00:00 PM';
        attendanceRecord.workingHours = attendanceRecord.workingHours || 8;
        attendanceRecord.isAbsent = false;
      } else if (status === 'holiday') {
        attendanceRecord.status = 'holiday';
        attendanceRecord.isHoliday = true;
        attendanceRecord.checkInTime = null;
        attendanceRecord.checkOutTime = null;
      } else if (status === 'worked_on_holiday') {
        attendanceRecord.status = 'completed';
        attendanceRecord.isWorkedOnHoliday = true;
        attendanceRecord.checkInTime = attendanceRecord.checkInTime || '09:00:00 AM';
        attendanceRecord.checkOutTime = attendanceRecord.checkOutTime || '06:00:00 PM';
        attendanceRecord.workingHours = attendanceRecord.workingHours || 8;
      }

      // Create audit log
      const auditLog = {
        editedBy: adminId,
        editedAt: new Date().toISOString(),
        oldValue,
        newValue: { ...attendanceRecord },
        reason: reason,
        changeType: 'STATUS_CHANGE',
        status: status
      };

      attendanceRecord.adminEditLog = auditLog;
      attendanceRecord.lastModified = new Date().toISOString();
      attendanceRecord.lastModifiedBy = adminId;

      // Save
      await set(attendanceRef, attendanceRecord);
      await this.saveAuditLog(technicianId, date, auditLog);

      return {
        success: true,
        message: `✅ Attendance marked as ${status}`,
        record: attendanceRecord,
        auditLog
      };
    } catch (error) {
      console.error('Error marking attendance:', error);
      return {
        success: false,
        message: '❌ Error: ' + error.message
      };
    }
  }

  /**
   * Save audit log to database
   * @param {string} technicianId - Technician ID
   * @param {string} date - Date of change
   * @param {object} auditLog - Audit log entry
   */
  async saveAuditLog(technicianId, date, auditLog) {
    try {
      const db = getDatabase();
      const auditRef = ref(db, `auditLogs/attendance/${technicianId}/${date}`);
      await set(auditRef, {
        ...auditLog,
        timestamp: new Date().toISOString()
      });
      console.log('✅ Audit log saved for', technicianId, date);
    } catch (error) {
      console.error('Error saving audit log:', error);
    }
  }

  /**
   * Get audit logs for a technician
   * @param {string} technicianId - Technician ID
   * @param {string} yearMonth - Optional month filter
   * @returns {array} - Audit logs
   */
  async getAuditLogs(technicianId, yearMonth = null) {
    try {
      const db = getDatabase();
      const auditRef = ref(db, `auditLogs/attendance/${technicianId}`);
      const snapshot = await get(auditRef);

      if (!snapshot.exists()) {
        return [];
      }

      let logs = snapshot.val();

      if (yearMonth) {
        const filtered = {};
        for (const [date, log] of Object.entries(logs)) {
          if (date.startsWith(yearMonth)) {
            filtered[date] = log;
          }
        }
        logs = filtered;
      }

      return logs;
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      return [];
    }
  }

  /**
   * Override time restriction - allow marking attendance after 11:59 AM
   * This is specifically for admin override when correcting records
   * @param {string} technicianId - Technician ID
   * @param {string} date - Date in YYYY-MM-DD format
   * @param {object} attendanceData - Attendance data
   * @param {string} adminId - Admin ID
   * @param {string} reason - Reason for override
   * @returns {object} - Result
   */
  async overrideTimeRestriction(technicianId, date, attendanceData, adminId, reason) {
    try {
      const db = getDatabase();
      const attendanceRef = ref(db, `attendance/${technicianId}/${date}`);

      const updatedRecord = {
        ...attendanceData,
        technicianId,
        date,
        adminOverride: true,
        overriddenBy: adminId,
        overriddenAt: new Date().toISOString(),
        adminEditLog: {
          editedBy: adminId,
          editedAt: new Date().toISOString(),
          reason: reason,
          changeType: 'TIME_RESTRICTION_OVERRIDE',
          message: 'Admin override: Time restriction bypassed'
        }
      };

      await set(attendanceRef, updatedRecord);
      await this.saveAuditLog(technicianId, date, updatedRecord.adminEditLog);

      return {
        success: true,
        message: `✅ Attendance saved with admin override (after 11:59 AM allowed)`,
        record: updatedRecord
      };
    } catch (error) {
      console.error('Error overriding time restriction:', error);
      return {
        success: false,
        message: '❌ Error: ' + error.message
      };
    }
  }

  /**
   * Get audit trail for display
   * Shows all changes made to a technician's attendance
   * @param {string} technicianId - Technician ID
   * @returns {array} - Formatted audit trail
   */
  async getAuditTrail(technicianId, yearMonth = null) {
    try {
      const logs = await this.getAuditLogs(technicianId, yearMonth);
      
      if (!logs || Object.keys(logs).length === 0) {
        return [];
      }

      const trail = [];
      for (const [date, log] of Object.entries(logs)) {
        trail.push({
          date,
          editedAt: log.editedAt || log.timestamp,
          editedBy: log.editedBy,
          changeType: log.changeType,
          reason: log.reason,
          oldValue: log.oldValue,
          newValue: log.newValue,
          message: this.formatAuditMessage(log)
        });
      }

      // Sort by date descending
      return trail.sort((a, b) => new Date(b.editedAt) - new Date(a.editedAt));
    } catch (error) {
      console.error('Error getting audit trail:', error);
      return [];
    }
  }

  /**
   * Format audit log message for display
   * @param {object} log - Audit log entry
   * @returns {string} - Formatted message
   */
  formatAuditMessage(log) {
    switch (log.changeType) {
      case 'CREATE':
        return `Created attendance record`;
      case 'UPDATE':
        return `Updated attendance`;
      case 'BACKDATED_CREATE':
        return `Created backdated attendance`;
      case 'STATUS_CHANGE':
        return `Marked as ${log.status}`;
      case 'TIME_RESTRICTION_OVERRIDE':
        return `Saved with admin override (time restriction bypassed)`;
      default:
        return `Modified attendance`;
    }
  }
}

export default new AdminAttendanceService();
