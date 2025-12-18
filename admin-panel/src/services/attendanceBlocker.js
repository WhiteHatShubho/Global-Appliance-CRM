import attendanceService from './attendanceService';

/**
 * Attendance Blocker Service
 * Prevents technicians from starting work without marking attendance
 */
class AttendanceBlocker {
  /**
   * Check if technician has marked attendance today
   * @param {string} technicianId - Technician ID
   * @returns {object} - {hasAttendance, checkInTime, checkOutTime}
   */
  async checkTodayAttendance(technicianId) {
    try {
      const attendance = await attendanceService.getTodayAttendance(technicianId);

      if (!attendance) {
        return {
          hasAttendance: false,
          checkInTime: null,
          checkOutTime: null,
          status: 'not-marked'
        };
      }

      return {
        hasAttendance: !!attendance.checkInTime,
        checkInTime: attendance.checkInTime || null,
        checkOutTime: attendance.checkOutTime || null,
        status: attendance.status,
        workingHours: attendance.workingHours || 0
      };
    } catch (error) {
      console.error('Error checking attendance:', error);
      return {
        hasAttendance: false,
        error: error.message
      };
    }
  }

  /**
   * Block job assignment if no attendance
   * @param {string} technicianId - Technician ID
   * @returns {object} - {isBlocked, reason, message}
   */
  async canAssignJobs(technicianId) {
    const attendance = await this.checkTodayAttendance(technicianId);

    if (!attendance.hasAttendance) {
      return {
        isBlocked: true,
        reason: 'no-attendance',
        message: '❌ ATTENDANCE REQUIRED: Technician must mark attendance before receiving jobs today.',
        actionRequired: 'Mark Attendance'
      };
    }

    return {
      isBlocked: false,
      reason: 'attendance-ok',
      message: `✅ Attendance marked at ${attendance.checkInTime}. Jobs can be assigned.`,
      checkInTime: attendance.checkInTime
    };
  }

  /**
   * Get warning message for admin if technician has no attendance
   */
  getAttendanceWarning(hasAttendance, checkInTime) {
    if (!hasAttendance) {
      return {
        type: 'error',
        icon: '⚠️',
        title: 'Attendance Not Marked',
        message: 'This technician has not marked attendance today. They cannot receive jobs until attendance is marked.',
        color: '#f44336'
      };
    }

    return {
      type: 'success',
      icon: '✅',
      title: 'Attendance Marked',
      message: `Check-in recorded at ${checkInTime}. Technician can receive jobs.`,
      color: '#4caf50'
    };
  }

  /**
   * Get HTML warning block for UI
   */
  getAttendanceWarningHTML(hasAttendance, checkInTime) {
    const warning = this.getAttendanceWarning(hasAttendance, checkInTime);

    return `
      <div style="
        padding: 15px;
        backgroundColor: ${warning.color === '#f44336' ? '#ffebee' : '#e8f5e9'};
        border-left: 4px solid ${warning.color};
        borderRadius: 4px;
        margin-bottom: 15px;
      ">
        <strong>${warning.icon} ${warning.title}</strong>
        <p style="margin: 5px 0 0 0; fontSize: 13px;">${warning.message}</p>
      </div>
    `;
  }
}

export default new AttendanceBlocker();
