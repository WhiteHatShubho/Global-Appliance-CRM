/**
 * Role-Based Access Control Service
 * Enforces permissions for Admin vs Technician
 * Prevents unauthorized access to admin features
 */

class RoleBasedAccessControl {
  /**
   * Define role permissions
   * @returns {object} - Role permissions map
   */
  static getRolePermissions() {
    return {
      admin: {
        // Attendance permissions
        viewAttendance: true,
        editAttendance: true,
        addBackdatedAttendance: true,
        markAttendanceStatus: true,
        overrideTimeRestriction: true,
        viewAuditLogs: true,

        // Payroll permissions
        viewPayroll: true,
        editMonthlySalary: true,
        applyBonus: true,
        applyDeduction: true,
        overrideThursdayDeduction: true,
        addSalaryRemark: true,
        triggerPayrollRecalculation: true,
        viewPayrollAuditLogs: true,

        // Management permissions
        manageTechnicians: true,
        viewReports: true,
        accessAdminPanel: true
      },
      technician: {
        // Attendance permissions
        viewAttendance: true,
        editAttendance: false,
        addBackdatedAttendance: false,
        markAttendanceStatus: false,
        overrideTimeRestriction: false,
        viewAuditLogs: false,

        // Payroll permissions
        viewPayroll: true,
        editMonthlySalary: false,
        applyBonus: false,
        applyDeduction: false,
        overrideThursdayDeduction: false,
        addSalaryRemark: false,
        triggerPayrollRecalculation: false,
        viewPayrollAuditLogs: false,

        // Management permissions
        manageTechnicians: false,
        viewReports: false,
        accessAdminPanel: false
      }
    };
  }

  /**
   * Check if user has permission for action
   * @param {string} userRole - User role ('admin' or 'technician')
   * @param {string} action - Action name
   * @returns {boolean} - Has permission
   */
  static hasPermission(userRole, action) {
    const permissions = this.getRolePermissions();
    const rolePerms = permissions[userRole];

    if (!rolePerms) {
      console.warn(`Unknown role: ${userRole}`);
      return false;
    }

    return rolePerms[action] === true;
  }

  /**
   * Check if user can edit attendance
   * @param {string} userRole - User role
   * @returns {object} - {allowed, message}
   */
  static canEditAttendance(userRole) {
    const allowed = this.hasPermission(userRole, 'editAttendance');
    return {
      allowed,
      message: allowed ? '' : '❌ Only admins can edit attendance'
    };
  }

  /**
   * Check if user can edit payroll
   * @param {string} userRole - User role
   * @returns {object} - {allowed, message}
   */
  static canEditPayroll(userRole) {
    const allowed = this.hasPermission(userRole, 'editMonthlySalary');
    return {
      allowed,
      message: allowed ? '' : '❌ Only admins can edit payroll'
    };
  }

  /**
   * Check if user can access admin panel
   * @param {string} userRole - User role
   * @returns {object} - {allowed, message}
   */
  static canAccessAdminPanel(userRole) {
    const allowed = this.hasPermission(userRole, 'accessAdminPanel');
    return {
      allowed,
      message: allowed ? '' : '❌ Admin access required'
    };
  }

  /**
   * Check if user can override time restriction
   * @param {string} userRole - User role
   * @returns {object} - {allowed, message}
   */
  static canOverrideTimeRestriction(userRole) {
    const allowed = this.hasPermission(userRole, 'overrideTimeRestriction');
    return {
      allowed,
      message: allowed ? '' : '❌ Only admins can override time restrictions'
    };
  }

  /**
   * Check if user can view audit logs
   * @param {string} userRole - User role
   * @returns {object} - {allowed, message}
   */
  static canViewAuditLogs(userRole) {
    const allowed = this.hasPermission(userRole, 'viewAuditLogs');
    return {
      allowed,
      message: allowed ? '' : '❌ Only admins can view audit logs'
    };
  }

  /**
   * Get all permissions for a role
   * @param {string} userRole - User role
   * @returns {object} - Permission object
   */
  static getAllPermissions(userRole) {
    const permissions = this.getRolePermissions();
    return permissions[userRole] || {};
  }

  /**
   * Verify user role matches data ownership
   * Technicians can only view/edit their own data
   * @param {string} userRole - User role
   * @param {string} userId - Current user ID
   * @param {string} dataOwnerId - Owner of data being accessed
   * @returns {object} - {allowed, message}
   */
  static verifyDataOwnership(userRole, userId, dataOwnerId) {
    // Admins can access anyone's data
    if (userRole === 'admin') {
      return { allowed: true, message: '' };
    }

    // Technicians can only access their own data
    if (userRole === 'technician' && userId === dataOwnerId) {
      return { allowed: true, message: '' };
    }

    return {
      allowed: false,
      message: '❌ You can only access your own data'
    };
  }

  /**
   * Check if action is allowed for user
   * Combines role check + data ownership verification
   * @param {object} params - {userRole, userId, action, dataOwnerId}
   * @returns {object} - {allowed, message}
   */
  static checkAccess(params) {
    const { userRole, userId, action, dataOwnerId } = params;

    // First check role permission
    if (!this.hasPermission(userRole, action)) {
      return {
        allowed: false,
        message: `❌ Your role (${userRole}) does not have permission for: ${action}`,
        reason: 'INSUFFICIENT_PERMISSION'
      };
    }

    // Then check data ownership (if applicable)
    if (dataOwnerId && userRole === 'technician') {
      const ownership = this.verifyDataOwnership(userRole, userId, dataOwnerId);
      if (!ownership.allowed) {
        return {
          allowed: false,
          message: ownership.message,
          reason: 'DATA_OWNERSHIP_VIOLATION'
        };
      }
    }

    return {
      allowed: true,
      message: '',
      reason: 'ACCESS_GRANTED'
    };
  }

  /**
   * Get permission summary for display
   * @param {string} userRole - User role
   * @returns {object} - Formatted permission summary
   */
  static getPermissionSummary(userRole) {
    const permissions = this.getAllPermissions(userRole);
    
    const summary = {
      role: userRole,
      attendance: {
        canView: permissions.viewAttendance,
        canEdit: permissions.editAttendance,
        canAddBackdated: permissions.addBackdatedAttendance,
        canMarkStatus: permissions.markAttendanceStatus,
        canOverrideTime: permissions.overrideTimeRestriction,
        canViewLogs: permissions.viewAuditLogs
      },
      payroll: {
        canView: permissions.viewPayroll,
        canEditSalary: permissions.editMonthlySalary,
        canApplyBonus: permissions.applyBonus,
        canApplyDeduction: permissions.applyDeduction,
        canOverrideThursday: permissions.overrideThursdayDeduction,
        canAddRemark: permissions.addSalaryRemark,
        canViewLogs: permissions.viewPayrollAuditLogs
      },
      admin: {
        canAccessPanel: permissions.accessAdminPanel,
        canManageTechnicians: permissions.manageTechnicians,
        canViewReports: permissions.viewReports
      }
    };

    return summary;
  }

  /**
   * Format permissions for display
   * @param {string} userRole - User role
   * @returns {string} - Formatted text
   */
  static formatPermissionsText(userRole) {
    const summary = this.getPermissionSummary(userRole);
    let text = `\n📋 PERMISSIONS FOR ${userRole.toUpperCase()}:\n\n`;

    if (userRole === 'admin') {
      text += `✅ Attendance: Full control (view, edit, add, mark, override)\n`;
      text += `✅ Payroll: Full control (edit salary, bonus, deduction, override)\n`;
      text += `✅ Audit: Can view all changes and logs\n`;
      text += `✅ Management: Full system access\n`;
    } else {
      text += `✅ Attendance: View-only (own records)\n`;
      text += `✅ Payroll: View-only (own salary)\n`;
      text += `✅ Edit: Not allowed\n`;
      text += `✅ Deductions: Can see reasons\n`;
    }

    return text;
  }
}

export default RoleBasedAccessControl;
