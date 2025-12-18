import { getDatabase, ref, get, set } from 'firebase/database';

/**
 * Salary Calculation Service
 * Calculates monthly salary based on attendance, working hours, and payroll rules
 */
class SalaryCalculationService {
  /**
   * Get technician's salary structure
   * @param {string} technicianId - Technician ID
   * @returns {object} - Salary details
   */
  async getTechnicianSalary(technicianId) {
    try {
      const db = getDatabase();
      const salaryRef = ref(db, `technicians/${technicianId}/salary`);
      const snapshot = await get(salaryRef);

      if (snapshot.exists()) {
        return snapshot.val();
      }

      // Default salary structure if not set
      return {
        monthlySalary: 0,
        perDaySalary: 0,
        overtimeRate: 0, // Hourly rate for overtime
        expectedDailyHours: 8
      };
    } catch (error) {
      console.error('Error fetching salary details:', error);
      return null;
    }
  }

  /**
   * Set/update technician salary
   * @param {string} technicianId - Technician ID
   * @param {object} salaryData - {monthlySalary, overtimeRate, expectedDailyHours}
   */
  async setSalary(technicianId, salaryData) {
    try {
      const db = getDatabase();
      
      // Note: Per-day salary will be calculated dynamically based on actual month days
      // This is just stored for reference (using 30 as base)
      const baseDays = 30;
      const perDaySalary = parseFloat((salaryData.monthlySalary / baseDays).toFixed(2));

      const salaryRecord = {
        monthlySalary: parseFloat(salaryData.monthlySalary),
        perDaySalary: perDaySalary, // Reference only
        overtimeRate: parseFloat(salaryData.overtimeRate || 0),
        expectedDailyHours: parseInt(salaryData.expectedDailyHours || 8),
        updatedAt: new Date().toISOString()
      };

      const salaryRef = ref(db, `technicians/${technicianId}/salary`);
      await set(salaryRef, salaryRecord);

      console.log('✅ Salary updated for technician:', technicianId);
      return salaryRecord;
    } catch (error) {
      console.error('Error setting salary:', error);
      throw error;
    }
  }

  /**
   * Calculate monthly salary for a technician with Thursday holiday rules
   * @param {string} technicianId - Technician ID
   * @param {string} yearMonth - 'YYYY-MM' format
   * @param {array} monthlyAttendance - Monthly attendance records
   * @returns {object} - Detailed salary calculation
   */
  async calculateMonthlySalary(technicianId, yearMonth, monthlyAttendance) {
    try {
      const salaryStructure = await this.getTechnicianSalary(technicianId);
      if (!salaryStructure) {
        return { error: 'Salary structure not configured for this technician' };
      }

      // Get actual days in month for accurate per-day calculation
      const [year, month] = yearMonth.split('-');
      const daysInMonth = new Date(year, month, 0).getDate();
      const actualPerDaySalary = salaryStructure.monthlySalary / daysInMonth;

      // Calculate attendance stats with Thursday logic
      const stats = this.calculateAttendanceStatsWithThursday(monthlyAttendance, salaryStructure.expectedDailyHours, yearMonth);

      // Base salary = Worked Days × Daily Salary
      const baseSalary = stats.workedDays * actualPerDaySalary;

      // Thursday payments
      const thursdayPaidSalary = stats.thursdaysPaid * actualPerDaySalary;
      const thursdayDeductions = stats.thursdaysDeducted * actualPerDaySalary;
      const thursdayExtraPay = stats.thursdaysWorked * actualPerDaySalary;

      // Calculate overtime (if applicable)
      const overtimeHours = Math.max(0, stats.totalWorkingHours - (stats.workedDays * salaryStructure.expectedDailyHours));
      const overtimePay = overtimeHours * salaryStructure.overtimeRate;

      // Calculate deductions
      const halfDayDeduction = stats.halfDays * (actualPerDaySalary / 2);
      const absentDeduction = stats.absentDays * actualPerDaySalary;
      const lateDeduction = stats.lateDays * (actualPerDaySalary * 0.1);

      // Total deductions
      const totalDeductions = halfDayDeduction + absentDeduction + lateDeduction + thursdayDeductions;

      // Net salary with Thursday logic
      const netSalary = baseSalary + thursdayPaidSalary + thursdayExtraPay + overtimePay - totalDeductions;

      return {
        technicianId,
        month: yearMonth,
        salaryStructure: {
          ...salaryStructure,
          actualPerDaySalary: parseFloat(actualPerDaySalary.toFixed(2)),
          daysInMonth
        },
        attendance: stats,
        
        // Salary breakdown
        baseSalary: parseFloat(baseSalary.toFixed(2)),
        thursdayPaidSalary: parseFloat(thursdayPaidSalary.toFixed(2)),
        thursdayExtraPay: parseFloat(thursdayExtraPay.toFixed(2)),
        overtimePay: parseFloat(overtimePay.toFixed(2)),
        
        // Deductions
        halfDayDeduction: parseFloat(halfDayDeduction.toFixed(2)),
        absentDeduction: parseFloat(absentDeduction.toFixed(2)),
        lateDeduction: parseFloat(lateDeduction.toFixed(2)),
        thursdayDeductions: parseFloat(thursdayDeductions.toFixed(2)),
        totalDeductions: parseFloat(totalDeductions.toFixed(2)),
        
        // Final amount
        netSalary: parseFloat(netSalary.toFixed(2)),
        
        // Additional info
        calculatedAt: new Date().toISOString(),
        status: 'calculated'
      };
    } catch (error) {
      console.error('Error calculating monthly salary:', error);
      return { error: error.message };
    }
  }

  /**
   * Calculate attendance statistics with Thursday holiday logic
   * @param {array} monthlyAttendance - Monthly attendance records
   * @param {number} expectedDailyHours - Expected working hours per day (default 8)
   * @param {string} yearMonth - 'YYYY-MM' format
   * @returns {object} - Attendance statistics with Thursday breakdown
   */
  calculateAttendanceStatsWithThursday(monthlyAttendance, expectedDailyHours = 8, yearMonth) {
    const stats = {
      presentDays: 0,
      absentDays: 0,
      workedDays: 0, // Actual worked days (excluding Thursdays)
      halfDays: 0,
      totalWorkingHours: 0,
      averageHours: 0,
      lateDays: 0,
      incompleteCheckins: 0,
      daysInMonth: 0,
      workingDays: 0,
      
      // Thursday-specific
      totalThursdays: 0,
      thursdaysPaid: 0,
      thursdaysDeducted: 0,
      thursdaysWorked: 0, // Worked on Thursday holiday
      thursdayDetails: [] // Week-wise Thursday breakdown
    };

    // Get number of days in the month
    if (yearMonth) {
      const [year, month] = yearMonth.split('-');
      stats.daysInMonth = new Date(year, month, 0).getDate();
      stats.workingDays = stats.daysInMonth; // All days are working days in monthly salary
    } else if (monthlyAttendance.length > 0) {
      const monthStr = monthlyAttendance[0].date.substr(0, 7);
      const [year, month] = monthStr.split('-');
      stats.daysInMonth = new Date(year, month, 0).getDate();
      stats.workingDays = stats.daysInMonth;
    }

    // Create attendance map for easy lookup
    const attendanceMap = {};
    monthlyAttendance.forEach(record => {
      attendanceMap[record.date] = record;
    });

    // Get all Thursdays in the month
    const thursdays = this.getThursdaysInMonth(yearMonth);
    stats.totalThursdays = thursdays.length;

    // Evaluate each Thursday based on Tuesday/Friday presence
    thursdays.forEach(thursdayDate => {
      const { tuesday, friday } = this.getTuesdayFridayForThursday(thursdayDate);
      const thursdayRecord = attendanceMap[thursdayDate];
      const tuesdayRecord = attendanceMap[tuesday];
      const fridayRecord = attendanceMap[friday];

      const tuesdayPresent = tuesdayRecord && tuesdayRecord.status === 'completed' && tuesdayRecord.checkInTime && tuesdayRecord.checkOutTime;
      const fridayPresent = fridayRecord && fridayRecord.status === 'completed' && fridayRecord.checkInTime && fridayRecord.checkOutTime;
      const thursdayWorked = thursdayRecord && thursdayRecord.status === 'completed' && thursdayRecord.checkInTime && thursdayRecord.checkOutTime;

      let thursdayStatus = 'unpaid';
      
      if (thursdayWorked) {
        // Employee worked on Thursday (holiday)
        stats.thursdaysWorked++;
        thursdayStatus = 'worked_on_holiday';
      } else if (tuesdayPresent && fridayPresent) {
        // Thursday is paid if present on both Tuesday and Friday
        stats.thursdaysPaid++;
        thursdayStatus = 'paid';
      } else {
        // Thursday deducted if absent on Tuesday OR Friday
        stats.thursdaysDeducted++;
        thursdayStatus = 'deducted';
      }

      stats.thursdayDetails.push({
        date: thursdayDate,
        tuesday,
        friday,
        tuesdayPresent,
        fridayPresent,
        thursdayWorked,
        status: thursdayStatus
      });
    });

    const expectedStartTime = new Date('2000-01-01 09:00:00');

    // Calculate regular attendance stats
    monthlyAttendance.forEach(record => {
      const recordDate = new Date(record.date);
      const isThursday = recordDate.getDay() === 4;

      if (record.status === 'completed' && record.checkInTime && record.checkOutTime) {
        stats.presentDays++;
        
        // Only count as worked day if not Thursday (unless worked on Thursday)
        if (!isThursday || (isThursday && record.checkInTime && record.checkOutTime)) {
          if (!isThursday) {
            stats.workedDays++;
          }
        }

        const workingHours = record.workingHours || 0;
        stats.totalWorkingHours += workingHours;

        // Check for late arrival
        const checkInTime = new Date(`2000-01-01 ${record.checkInTime}`);
        if (checkInTime > expectedStartTime) {
          stats.lateDays++;
        }

        // Check for half-day (less than 4 hours)
        if (workingHours < expectedDailyHours / 2) {
          stats.halfDays++;
        }
      } else if (record.status === 'checked-in' || (record.checkInTime && !record.checkOutTime)) {
        stats.incompleteCheckins++;
        stats.halfDays++;
      } else if (!record.checkInTime && !record.checkOutTime) {
        // Only count as absent if not Thursday (Thursdays handled separately)
        if (!isThursday) {
          stats.absentDays++;
        }
      }
    });

    if (stats.presentDays > 0) {
      stats.averageHours = parseFloat((stats.totalWorkingHours / stats.presentDays).toFixed(2));
    }

    return stats;
  }

  /**
   * Get all Thursdays in a given month
   * @param {string} yearMonth - 'YYYY-MM' format
   * @returns {array} - Array of Thursday dates in 'YYYY-MM-DD' format
   */
  getThursdaysInMonth(yearMonth) {
    const [year, month] = yearMonth.split('-');
    const thursdays = [];
    const daysInMonth = new Date(year, month, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      if (date.getDay() === 4) { // Thursday
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        thursdays.push(dateStr);
      }
    }

    return thursdays;
  }

  /**
   * Get Tuesday and Friday dates for a given Thursday
   * @param {string} thursdayDate - 'YYYY-MM-DD' format
   * @returns {object} - {tuesday: 'YYYY-MM-DD', friday: 'YYYY-MM-DD'}
   */
  getTuesdayFridayForThursday(thursdayDate) {
    const thursday = new Date(thursdayDate);
    
    // Tuesday is 2 days before Thursday
    const tuesday = new Date(thursday);
    tuesday.setDate(thursday.getDate() - 2);
    
    // Friday is 1 day after Thursday
    const friday = new Date(thursday);
    friday.setDate(thursday.getDate() + 1);

    const formatDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    return {
      tuesday: formatDate(tuesday),
      friday: formatDate(friday)
    };
  }

  /**
   * Calculate attendance statistics (legacy - kept for backward compatibility)
   * @param {array} monthlyAttendance - Monthly attendance records
   * @param {number} expectedDailyHours - Expected working hours per day (default 8)
   * @returns {object} - Attendance statistics
   */
  calculateAttendanceStats(monthlyAttendance, expectedDailyHours = 8) {
    const stats = {
      presentDays: 0,
      absentDays: 0,
      halfDays: 0,
      totalWorkingHours: 0,
      averageHours: 0,
      lateDays: 0,
      incompleteCheckins: 0,
      daysInMonth: 0,
      workingDays: 0 // Expected working days (excluding weekends)
    };

    // Get number of days in the month
    if (monthlyAttendance.length > 0) {
      const monthStr = monthlyAttendance[0].date.substr(0, 7);
      const [year, month] = monthStr.split('-');
      stats.daysInMonth = new Date(year, month, 0).getDate();
      
      // Calculate expected working days (rough estimate: 26 out of 30)
      stats.workingDays = Math.round(stats.daysInMonth * 0.87);
    }

    const expectedStartTime = new Date('2000-01-01 09:00:00');

    monthlyAttendance.forEach(record => {
      if (record.status === 'completed' && record.checkInTime && record.checkOutTime) {
        stats.presentDays++;

        const workingHours = record.workingHours || 0;
        stats.totalWorkingHours += workingHours;

        // Check for late arrival
        const checkInTime = new Date(`2000-01-01 ${record.checkInTime}`);
        if (checkInTime > expectedStartTime) {
          stats.lateDays++;
        }

        // Check for half-day (less than 4 hours)
        if (workingHours < expectedDailyHours / 2) {
          stats.halfDays++;
        }
      } else if (record.status === 'checked-in' || (record.checkInTime && !record.checkOutTime)) {
        // Incomplete attendance
        stats.incompleteCheckins++;
        stats.halfDays++;
      } else if (!record.checkInTime && !record.checkOutTime) {
        // No attendance
        stats.absentDays++;
      }
    });

    if (stats.presentDays > 0) {
      stats.averageHours = parseFloat((stats.totalWorkingHours / stats.presentDays).toFixed(2));
    }

    // Add Thursday stats for compatibility
    stats.workedDays = stats.presentDays;
    stats.totalThursdays = 0;
    stats.thursdaysPaid = 0;
    stats.thursdaysDeducted = 0;
    stats.thursdaysWorked = 0;
    stats.thursdayDetails = [];

    return stats;
  }

  /**
   * Save salary calculation to database
   * @param {object} salaryCalculation - Calculated salary object
   */
  async saveSalaryCalculation(salaryCalculation) {
    try {
      const db = getDatabase();
      const salaryRef = ref(db, `salaryRecords/${salaryCalculation.technicianId}/${salaryCalculation.month}`);
      await set(salaryRef, salaryCalculation);

      console.log('✅ Salary calculation saved:', salaryCalculation.month);
      return true;
    } catch (error) {
      console.error('Error saving salary calculation:', error);
      throw error;
    }
  }

  /**
   * Get historical salary records
   * @param {string} technicianId - Technician ID
   * @param {number} months - Number of months to fetch (default 12)
   * @returns {array} - Historical salary records
   */
  async getSalaryHistory(technicianId, months = 12) {
    try {
      const db = getDatabase();
      const salaryRef = ref(db, `salaryRecords/${technicianId}`);
      const snapshot = await get(salaryRef);

      if (!snapshot.exists()) {
        return [];
      }

      const records = [];
      const data = snapshot.val();

      for (const month in data) {
        records.push(data[month]);
      }

      // Sort by month descending and limit to requested months
      return records
        .sort((a, b) => b.month.localeCompare(a.month))
        .slice(0, months);
    } catch (error) {
      console.error('Error fetching salary history:', error);
      return [];
    }
  }

  /**
   * Get salary statistics (average, min, max)
   * @param {array} salaryHistory - Salary history records
   * @returns {object} - Statistics
   */
  calculateSalaryStats(salaryHistory) {
    if (salaryHistory.length === 0) {
      return { average: 0, minimum: 0, maximum: 0 };
    }

    const salaries = salaryHistory.map(r => r.netSalary);
    const average = salaries.reduce((a, b) => a + b, 0) / salaries.length;
    const minimum = Math.min(...salaries);
    const maximum = Math.max(...salaries);

    return {
      average: parseFloat(average.toFixed(2)),
      minimum: parseFloat(minimum.toFixed(2)),
      maximum: parseFloat(maximum.toFixed(2)),
      total: parseFloat(salaries.reduce((a, b) => a + b, 0).toFixed(2))
    };
  }
}

export default new SalaryCalculationService();
