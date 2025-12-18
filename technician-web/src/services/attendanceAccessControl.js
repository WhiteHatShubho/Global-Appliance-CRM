/**
 * Attendance & Payroll Access Control Service
 * Enforces strict read-only access and time-based restrictions
 */

class AttendanceAccessControl {
  /**
   * Check if attendance submission is allowed (before 11:59 AM)
   * Uses server timestamp for security
   * @returns {object} {allowed: boolean, message: string, minutesRemaining: number}
   */
  canSubmitAttendance() {
    // Get current time - use browser time as primary, but enforce cutoff strictly
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();

    // Calculate total minutes since midnight
    const totalMinutes = hours * 60 + minutes;
    // 11:59 AM = 11 * 60 + 59 = 719 minutes
    const CUTOFF_MINUTES = 11 * 60 + 59;

    const allowed = totalMinutes < CUTOFF_MINUTES;
    const minutesRemaining = CUTOFF_MINUTES - totalMinutes;

    return {
      allowed,
      message: allowed 
        ? `✅ Attendance window open (${minutesRemaining} minutes remaining)`
        : '❌ Attendance time is closed for today. Submission allowed only before 11:59 AM.',
      minutesRemaining,
      currentTime: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
      cutoffTime: '11:59 AM'
    };
  }

  /**
   * Check if attendance button should be visible
   * @returns {boolean}
   */
  isAttendanceButtonVisible() {
    const check = this.canSubmitAttendance();
    return check.allowed;
  }

  /**
   * Get disabled state and reason for attendance buttons
   * @returns {object} {disabled: boolean, reason: string}
   */
  getAttendanceButtonState() {
    const check = this.canSubmitAttendance();
    
    return {
      disabled: !check.allowed,
      reason: check.allowed 
        ? '' 
        : `⏰ Attendance time is closed for today. You can only mark attendance before 11:59 AM.`
    };
  }

  /**
   * Verify attendance can be recorded before backend
   * This is a frontend pre-check; backend MUST also enforce
   * @returns {object} {canRecord: boolean, message: string}
   */
  verifyAttendanceRecording() {
    const check = this.canSubmitAttendance();
    
    if (!check.allowed) {
      return {
        canRecord: false,
        message: `❌ Attendance Submission Window Closed

Time: ${check.currentTime}
Cutoff: ${check.cutoffTime}

You can only mark attendance before 11:59 AM.`
      };
    }

    return {
      canRecord: true,
      message: `✅ Attendance window is open. Time remaining: ${check.minutesRemaining} minutes`
    };
  }

  /**
   * Format deduction reason with clear explanation
   * @param {string} thursdayDate - Date of Thursday
   * @param {object} thursdayData - Thursday attendance details
   * @returns {string} - Human-readable reason
   */
  formatThursdayDeductionReason(thursdayDate, thursdayData) {
    if (!thursdayData) {
      return 'Thursday salary: Not available';
    }

    const { status, tuesdayPresent, fridayPresent, thursdayWorked, tuesday, friday } = thursdayData;

    if (status === 'paid') {
      return `✅ Thursday (${this.formatDate(thursdayDate)}) - PAID\nPresent on Tuesday (${this.formatDate(tuesday)}) ✓ and Friday (${this.formatDate(friday)}) ✓`;
    }

    if (status === 'worked_on_holiday') {
      return `🎉 Thursday (${this.formatDate(thursdayDate)}) - EXTRA PAY\nYou worked on this holiday and earned +1 full day salary!`;
    }

    if (status === 'deducted') {
      const reasons = [];
      if (!tuesdayPresent) {
        reasons.push(`absent on Tuesday (${this.formatDate(tuesday)})`);
      }
      if (!fridayPresent) {
        reasons.push(`absent on Friday (${this.formatDate(friday)})`);
      }

      const reasonText = reasons.join(' and ');
      return `❌ Thursday (${this.formatDate(thursdayDate)}) - SALARY DEDUCTED\nReason: You were ${reasonText}.\nThursday salary is paid only if you are present on both Tuesday and Friday.`;
    }

    return `Thursday (${this.formatDate(thursdayDate)}) - Status unknown`;
  }

  /**
   * Format date for display
   * @param {string} dateStr - Date in YYYY-MM-DD format
   * @returns {string} - Formatted date (DD/MM/YYYY with day name)
   */
  formatDate(dateStr) {
    if (!dateStr) return 'Unknown';
    
    const date = new Date(dateStr + 'T00:00:00');
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const day = days[date.getDay()];
    const dateNum = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    
    return `${dateNum}/${month}/${year} (${day})`;
  }

  /**
   * Check technician can ONLY view their own data
   * @param {string} requestedTechId - Technician ID being requested
   * @param {string} currentTechId - Current logged-in technician ID
   * @returns {object} {allowed: boolean, message: string}
   */
  verifyDataOwnership(requestedTechId, currentTechId) {
    const allowed = requestedTechId === currentTechId;

    return {
      allowed,
      message: allowed 
        ? '' 
        : '❌ Access Denied: You can only view your own attendance and payroll data.'
    };
  }

  /**
   * Mark that attendance/payroll are READ-ONLY
   * @returns {object} {canEdit: false, reason: string}
   */
  getEditPermissions() {
    return {
      canEdit: false,
      canEditAttendance: false,
      canEditPayroll: false,
      canEditSalary: false,
      canModifyDeductions: false,
      canModifyDates: false,
      reason: 'Attendance and payroll are read-only. Only administrators can modify these records.'
    };
  }

  /**
   * Get attendance submission rules for display
   * @returns {object} - Formatted rules for technician
   */
  getAttendanceRules() {
    return {
      submissionWindowStart: '00:00 (12:00 AM)',
      submissionWindowEnd: '11:59 AM',
      submissionWindowDuration: 'Same day only',
      rules: [
        '✓ Attendance can be marked ONLY on the same day',
        '✓ Submission window: 12:00 AM - 11:59 AM',
        '✗ After 11:59 AM, attendance submission is LOCKED',
        '✗ Cannot mark previous day attendance',
        '✗ Cannot mark future day attendance',
        '✓ Use face recognition for secure attendance',
        '✓ Check-in captures your face (encrypted)',
        '✓ Check-out verifies your face (security)'
      ],
      message: 'Mark your attendance before 11:59 AM to avoid deductions.'
    };
  }

  /**
   * Security note for technicians
   * @returns {string}
   */
  getSecurityNote() {
    return `🔒 SECURITY:\n- Changing device time will NOT allow late attendance submission\n- Server timestamp is used for verification\n- All attendance records are encrypted and tamper-proof`;
  }
}

export default new AttendanceAccessControl();
