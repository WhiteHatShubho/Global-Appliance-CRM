/**
 * Admin Salary & Payroll Management Service
 * Full control: Edit salary, apply bonuses, deductions, override Thursday logic
 * Includes comprehensive audit logging
 */

import { getDatabase, ref, set, get, update } from 'firebase/database';

class AdminPayrollService {
  /**
   * Get payroll record for a technician for a specific month
   * @param {string} technicianId - Technician ID
   * @param {string} yearMonth - 'YYYY-MM' format
   * @returns {object} - Payroll record with all details
   */
  async getPayrollRecord(technicianId, yearMonth) {
    try {
      const db = getDatabase();
      const payrollRef = ref(db, `salaryRecords/${technicianId}/${yearMonth}`);
      const snapshot = await get(payrollRef);

      if (snapshot.exists()) {
        return snapshot.val();
      }
      return null;
    } catch (error) {
      console.error('Error fetching payroll record:', error);
      throw error;
    }
  }

  /**
   * Edit monthly salary amount
   * @param {string} technicianId - Technician ID
   * @param {string} yearMonth - 'YYYY-MM' format
   * @param {number} newSalary - New monthly salary
   * @param {string} adminId - Admin ID
   * @param {string} reason - Reason for change
   * @returns {object} - Result with recalculated payroll
   */
  async editMonthlySalary(technicianId, yearMonth, newSalary, adminId, reason) {
    try {
      const db = getDatabase();
      const salaryRef = ref(db, `technicians/${technicianId}/salary`);
      
      // Get current salary
      const snapshot = await get(salaryRef);
      const currentSalary = snapshot.exists() ? snapshot.val().monthlySalary : 0;

      // Create audit log
      const auditLog = {
        editedBy: adminId,
        editedAt: new Date().toISOString(),
        oldValue: currentSalary,
        newValue: newSalary,
        reason: reason,
        changeType: 'SALARY_CHANGE',
        difference: newSalary - currentSalary
      };

      // Update salary
      const updatedSalary = {
        monthlySalary: newSalary,
        lastModified: new Date().toISOString(),
        lastModifiedBy: adminId,
        adminEditLog: auditLog
      };

      await update(salaryRef, updatedSalary);

      // Trigger payroll recalculation
      await this.triggerPayrollRecalculation(technicianId, yearMonth, adminId);

      return {
        success: true,
        message: `✅ Salary updated: ₹${currentSalary} → ₹${newSalary}`,
        difference: newSalary - currentSalary,
        auditLog
      };
    } catch (error) {
      console.error('Error editing salary:', error);
      return {
        success: false,
        message: '❌ Error: ' + error.message
      };
    }
  }

  /**
   * Apply manual bonus to payroll
   * @param {string} technicianId - Technician ID
   * @param {string} yearMonth - 'YYYY-MM' format
   * @param {number} bonusAmount - Bonus amount
   * @param {string} adminId - Admin ID
   * @param {string} reason - Reason for bonus
   * @returns {object} - Result
   */
  async applyBonus(technicianId, yearMonth, bonusAmount, adminId, reason) {
    try {
      const db = getDatabase();
      const payrollRef = ref(db, `salaryRecords/${technicianId}/${yearMonth}`);
      
      const snapshot = await get(payrollRef);
      let payroll = snapshot.exists() ? snapshot.val() : {};

      const oldBonus = payroll.bonus || 0;
      const newBonus = (payroll.bonus || 0) + bonusAmount;

      // Create audit log
      const auditLog = {
        editedBy: adminId,
        editedAt: new Date().toISOString(),
        oldValue: oldBonus,
        newValue: newBonus,
        reason: reason,
        changeType: 'BONUS_APPLIED',
        bonusAmount: bonusAmount
      };

      // Update payroll
      payroll.bonus = newBonus;
      payroll.bonusEntries = payroll.bonusEntries || [];
      payroll.bonusEntries.push({
        amount: bonusAmount,
        appliedBy: adminId,
        appliedAt: new Date().toISOString(),
        reason: reason
      });

      payroll.netSalary = (payroll.netSalary || 0) + bonusAmount;
      payroll.lastModified = new Date().toISOString();
      payroll.lastModifiedBy = adminId;
      payroll.adminEditLog = auditLog;

      await set(payrollRef, payroll);
      await this.savePayrollAuditLog(technicianId, yearMonth, auditLog);

      return {
        success: true,
        message: `✅ Bonus applied: +₹${bonusAmount}`,
        newNetSalary: payroll.netSalary,
        auditLog
      };
    } catch (error) {
      console.error('Error applying bonus:', error);
      return {
        success: false,
        message: '❌ Error: ' + error.message
      };
    }
  }

  /**
   * Apply manual deduction to payroll
   * @param {string} technicianId - Technician ID
   * @param {string} yearMonth - 'YYYY-MM' format
   * @param {number} deductionAmount - Deduction amount
   * @param {string} adminId - Admin ID
   * @param {string} reason - Reason for deduction
   * @returns {object} - Result
   */
  async applyDeduction(technicianId, yearMonth, deductionAmount, adminId, reason) {
    try {
      const db = getDatabase();
      const payrollRef = ref(db, `salaryRecords/${technicianId}/${yearMonth}`);
      
      const snapshot = await get(payrollRef);
      let payroll = snapshot.exists() ? snapshot.val() : {};

      const oldDeduction = payroll.manualDeduction || 0;
      const newDeduction = (payroll.manualDeduction || 0) + deductionAmount;

      // Create audit log
      const auditLog = {
        editedBy: adminId,
        editedAt: new Date().toISOString(),
        oldValue: oldDeduction,
        newValue: newDeduction,
        reason: reason,
        changeType: 'DEDUCTION_APPLIED',
        deductionAmount: deductionAmount
      };

      // Update payroll
      payroll.manualDeduction = newDeduction;
      payroll.deductionEntries = payroll.deductionEntries || [];
      payroll.deductionEntries.push({
        amount: deductionAmount,
        appliedBy: adminId,
        appliedAt: new Date().toISOString(),
        reason: reason
      });

      payroll.netSalary = (payroll.netSalary || 0) - deductionAmount;
      payroll.lastModified = new Date().toISOString();
      payroll.lastModifiedBy = adminId;
      payroll.adminEditLog = auditLog;

      await set(payrollRef, payroll);
      await this.savePayrollAuditLog(technicianId, yearMonth, auditLog);

      return {
        success: true,
        message: `✅ Deduction applied: -₹${deductionAmount}`,
        newNetSalary: payroll.netSalary,
        auditLog
      };
    } catch (error) {
      console.error('Error applying deduction:', error);
      return {
        success: false,
        message: '❌ Error: ' + error.message
      };
    }
  }

  /**
   * Override Thursday deduction
   * Admin can approve or reject Thursday deductions
   * @param {string} technicianId - Technician ID
   * @param {string} yearMonth - 'YYYY-MM' format
   * @param {string} thursdayDate - Thursday date
   * @param {string} decision - 'approve' or 'reject'
   * @param {string} adminId - Admin ID
   * @param {string} reason - Reason for override
   * @returns {object} - Result with recalculated amount
   */
  async overrideThursdayDeduction(technicianId, yearMonth, thursdayDate, decision, adminId, reason) {
    try {
      const db = getDatabase();
      const payrollRef = ref(db, `salaryRecords/${technicianId}/${yearMonth}`);
      
      const snapshot = await get(payrollRef);
      let payroll = snapshot.exists() ? snapshot.val() : {};

      if (!payroll.attendance || !payroll.attendance.thursdayDetails) {
        return {
          success: false,
          message: '❌ Thursday details not found in payroll'
        };
      }

      // Find and update Thursday entry
      const thursday = payroll.attendance.thursdayDetails.find(t => t.date === thursdayDate);
      if (!thursday) {
        return {
          success: false,
          message: `❌ Thursday not found: ${thursdayDate}`
        };
      }

      const oldStatus = thursday.status;
      const dailyRate = payroll.salaryStructure?.actualPerDaySalary || 0;

      // Apply override
      if (decision === 'approve') {
        thursday.status = 'paid';
        thursday.adminOverride = true;
        thursday.overriddenBy = adminId;
        
        // Recalculate: If was deducted, add back the amount
        if (oldStatus === 'deducted') {
          payroll.thursdayDeductions = (payroll.thursdayDeductions || 0) - dailyRate;
          payroll.netSalary = (payroll.netSalary || 0) + dailyRate;
        }
      } else if (decision === 'reject') {
        thursday.status = 'deducted';
        thursday.adminOverride = true;
        thursday.overriddenBy = adminId;
        
        // Recalculate: If was paid, deduct the amount
        if (oldStatus === 'paid') {
          payroll.thursdayDeductions = (payroll.thursdayDeductions || 0) + dailyRate;
          payroll.netSalary = (payroll.netSalary || 0) - dailyRate;
        }
      } else {
        return {
          success: false,
          message: '❌ Invalid decision. Must be: approve or reject'
        };
      }

      // Create audit log
      const auditLog = {
        editedBy: adminId,
        editedAt: new Date().toISOString(),
        oldValue: oldStatus,
        newValue: thursday.status,
        reason: reason,
        changeType: 'THURSDAY_OVERRIDE',
        thursdayDate: thursdayDate,
        decision: decision,
        amount: dailyRate
      };

      payroll.lastModified = new Date().toISOString();
      payroll.lastModifiedBy = adminId;
      payroll.adminEditLog = auditLog;

      await set(payrollRef, payroll);
      await this.savePayrollAuditLog(technicianId, yearMonth, auditLog);

      return {
        success: true,
        message: `✅ Thursday deduction ${decision}ed for ${thursdayDate}`,
        newNetSalary: payroll.netSalary,
        auditLog
      };
    } catch (error) {
      console.error('Error overriding Thursday deduction:', error);
      return {
        success: false,
        message: '❌ Error: ' + error.message
      };
    }
  }

  /**
   * Add custom remark to salary
   * @param {string} technicianId - Technician ID
   * @param {string} yearMonth - 'YYYY-MM' format
   * @param {string} remark - Remark text
   * @param {string} adminId - Admin ID
   * @returns {object} - Result
   */
  async addSalaryRemark(technicianId, yearMonth, remark, adminId) {
    try {
      const db = getDatabase();
      const payrollRef = ref(db, `salaryRecords/${technicianId}/${yearMonth}`);
      
      const snapshot = await get(payrollRef);
      let payroll = snapshot.exists() ? snapshot.val() : {};

      payroll.remarks = payroll.remarks || [];
      payroll.remarks.push({
        text: remark,
        addedBy: adminId,
        addedAt: new Date().toISOString(),
        visible: true
      });

      payroll.lastModified = new Date().toISOString();
      payroll.lastModifiedBy = adminId;

      await set(payrollRef, payroll);

      return {
        success: true,
        message: '✅ Remark added to salary record'
      };
    } catch (error) {
      console.error('Error adding remark:', error);
      return {
        success: false,
        message: '❌ Error: ' + error.message
      };
    }
  }

  /**
   * Trigger payroll recalculation
   * Auto-calculates based on current attendance and adjustments
   * @param {string} technicianId - Technician ID
   * @param {string} yearMonth - 'YYYY-MM' format
   * @param {string} adminId - Admin ID (for logging)
   */
  async triggerPayrollRecalculation(technicianId, yearMonth, adminId) {
    try {
      const db = getDatabase();
      
      // Mark for recalculation
      const triggerRef = ref(db, `payrollRecalculation/${technicianId}/${yearMonth}`);
      await set(triggerRef, {
        triggeredAt: new Date().toISOString(),
        triggeredBy: adminId,
        status: 'pending'
      });

      console.log(`✅ Payroll recalculation triggered for ${technicianId}/${yearMonth}`);
    } catch (error) {
      console.error('Error triggering recalculation:', error);
    }
  }

  /**
   * Save payroll audit log
   * @param {string} technicianId - Technician ID
   * @param {string} yearMonth - 'YYYY-MM' format
   * @param {object} auditLog - Audit log entry
   */
  async savePayrollAuditLog(technicianId, yearMonth, auditLog) {
    try {
      const db = getDatabase();
      const auditRef = ref(db, `auditLogs/payroll/${technicianId}/${yearMonth}`);
      
      let logs = [];
      const snapshot = await get(auditRef);
      if (snapshot.exists()) {
        logs = snapshot.val() instanceof Array ? snapshot.val() : [snapshot.val()];
      }

      logs.push({
        ...auditLog,
        timestamp: new Date().toISOString()
      });

      await set(auditRef, logs);
    } catch (error) {
      console.error('Error saving payroll audit log:', error);
    }
  }

  /**
   * Get payroll audit logs for a technician
   * @param {string} technicianId - Technician ID
   * @param {string} yearMonth - 'YYYY-MM' format
   * @returns {array} - Audit logs
   */
  async getPayrollAuditLogs(technicianId, yearMonth) {
    try {
      const db = getDatabase();
      const auditRef = ref(db, `auditLogs/payroll/${technicianId}/${yearMonth}`);
      const snapshot = await get(auditRef);

      if (snapshot.exists()) {
        const logs = snapshot.val();
        return logs instanceof Array ? logs : [logs];
      }
      return [];
    } catch (error) {
      console.error('Error fetching payroll audit logs:', error);
      return [];
    }
  }

  /**
   * Format audit log message
   * @param {object} log - Audit log entry
   * @returns {string} - Formatted message
   */
  formatAuditMessage(log) {
    switch (log.changeType) {
      case 'SALARY_CHANGE':
        return `Salary changed: ₹${log.oldValue} → ₹${log.newValue} (Difference: ${log.difference > 0 ? '+' : ''}₹${log.difference})`;
      case 'BONUS_APPLIED':
        return `Bonus applied: +₹${log.bonusAmount}`;
      case 'DEDUCTION_APPLIED':
        return `Deduction applied: -₹${log.deductionAmount}`;
      case 'THURSDAY_OVERRIDE':
        return `Thursday deduction ${log.decision}ed for ${log.thursdayDate} (₹${log.amount})`;
      default:
        return 'Payroll modified';
    }
  }
}

export default new AdminPayrollService();
