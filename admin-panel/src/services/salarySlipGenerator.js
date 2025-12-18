/**
 * Salary Slip Generator Service
 * Generates PDF salary slips for technicians
 * Requires jsPDF and html2canvas libraries
 */

class SalarySlipGenerator {
  /**
   * Generate PDF salary slip
   * @param {object} salaryData - Calculated salary data from salaryCalculationService
   * @param {object} technicianData - Technician details
   */
  async generatePDF(salaryData, technicianData) {
    try {
      // Dynamically load jsPDF and html2canvas
      const { jsPDF } = window.jspdf;
      const html2canvas = window.html2canvas;

      if (!jsPDF || !html2canvas) {
        throw new Error('PDF libraries not loaded. Add CDN scripts to index.html');
      }

      // Create HTML content for the salary slip
      const htmlContent = this.generateHTMLContent(salaryData, technicianData);

      // Convert HTML to canvas
      const canvas = await html2canvas(htmlContent, {
        scale: 2,
        backgroundColor: '#ffffff',
        allowTaint: true,
        useCORS: true
      });

      // Create PDF from canvas
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210; // A4 width in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`Salary_Slip_${technicianData.name}_${salaryData.month}.pdf`);

      return { success: true, message: 'Salary slip generated successfully' };
    } catch (error) {
      console.error('Error generating PDF:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Generate HTML content for salary slip
   */
  generateHTMLContent(salaryData, technicianData) {
    const companyName = 'Global Appliance Services';
    const companyAddress = 'Your Company Address';
    const companyPhone = '+91-XXXX-XXXX-XXXX';
    const companyEmail = 'info@globalapplianceservices.com';

    const monthDate = new Date(salaryData.month + '-01');
    const monthName = monthDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

    const html = document.createElement('div');
    html.style.cssText = 'width: 210mm; padding: 20px; font-family: Arial, sans-serif; background: white;';
    html.innerHTML = `
      <div style="max-width: 210mm; margin: 0 auto; padding: 20px; border: 1px solid #333;">
        <!-- Header -->
        <div style="text-align: center; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px;">
          <h1 style="margin: 0; color: #1976d2; font-size: 28px;">${companyName}</h1>
          <p style="margin: 5px 0; color: #666; font-size: 12px;">${companyAddress}</p>
          <p style="margin: 5px 0; color: #666; font-size: 12px;">Phone: ${companyPhone} | Email: ${companyEmail}</p>
        </div>

        <!-- Title -->
        <div style="text-align: center; margin-bottom: 25px;">
          <h2 style="margin: 0; color: #333; font-size: 20px;">SALARY SLIP</h2>
          <p style="margin: 5px 0; color: #666;">For the month of ${monthName}</p>
        </div>

        <!-- Employee Information -->
        <div style="margin-bottom: 25px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; width: 25%; background: #f5f5f5; font-weight: bold;">Employee Name:</td>
              <td style="padding: 8px; border: 1px solid #ddd; width: 25%;">${technicianData.name || 'N/A'}</td>
              <td style="padding: 8px; border: 1px solid #ddd; width: 25%; background: #f5f5f5; font-weight: bold;">Employee ID:</td>
              <td style="padding: 8px; border: 1px solid #ddd; width: 25%;">${technicianData.id || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5; font-weight: bold;">Designation:</td>
              <td style="padding: 8px; border: 1px solid #ddd;">Technician</td>
              <td style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5; font-weight: bold;">Month:</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${salaryData.month}</td>
            </tr>
          </table>
        </div>

        <!-- Attendance Summary -->
        <div style="margin-bottom: 25px;">
          <h3 style="margin: 0 0 10px 0; color: #1976d2; font-size: 14px; border-bottom: 2px solid #1976d2; padding-bottom: 5px;">
            ATTENDANCE SUMMARY
          </h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="background: #f5f5f5;">
              <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Total Days in Month:</td>
              <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${salaryData.attendance.daysInMonth || 30}</td>
              <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Working Days:</td>
              <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${salaryData.attendance.workingDays || 26}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Days Present:</td>
              <td style="padding: 10px; border: 1px solid #ddd; text-align: center; color: #2e7d32; font-weight: bold;">${salaryData.attendance.presentDays}</td>
              <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Days Absent:</td>
              <td style="padding: 10px; border: 1px solid #ddd; text-align: center; color: #d32f2f; font-weight: bold;">${salaryData.attendance.absentDays}</td>
            </tr>
            <tr style="background: #f5f5f5;">
              <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Half Days:</td>
              <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${salaryData.attendance.halfDays}</td>
              <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Total Working Hours:</td>
              <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${salaryData.attendance.totalWorkingHours}h</td>
            </tr>
          </table>
        </div>

        <!-- Salary Breakdown -->
        <div style="margin-bottom: 25px;">
          <h3 style="margin: 0 0 10px 0; color: #1976d2; font-size: 14px; border-bottom: 2px solid #1976d2; padding-bottom: 5px;">
            SALARY BREAKDOWN
          </h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="background: #f5f5f5;">
              <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; width: 50%;">Earnings</td>
              <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; text-align: right; width: 50%;">Amount (₹)</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;">Base Salary (${salaryData.attendance.presentDays} days × ₹${salaryData.salaryStructure.perDaySalary})</td>
              <td style="padding: 10px; border: 1px solid #ddd; text-align: right; font-weight: bold;">₹${salaryData.baseSalary.toLocaleString('en-IN')}</td>
            </tr>
            <tr style="background: #f0f0f0;">
              <td style="padding: 10px; border: 1px solid #ddd;">Overtime Pay (${salaryData.attendance.totalWorkingHours - (salaryData.attendance.presentDays * salaryData.salaryStructure.expectedDailyHours)} hours @ ₹${salaryData.salaryStructure.overtimeRate}/hour)</td>
              <td style="padding: 10px; border: 1px solid #ddd; text-align: right; font-weight: bold; color: #4caf50;">+ ₹${salaryData.overtimePay.toLocaleString('en-IN')}</td>
            </tr>
            <tr style="background: #fff3cd;">
              <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">TOTAL EARNINGS</td>
              <td style="padding: 10px; border: 1px solid #ddd; text-align: right; font-weight: bold; color: #1976d2;">₹${(salaryData.baseSalary + salaryData.overtimePay).toLocaleString('en-IN')}</td>
            </tr>

            <tr style="background: #f5f5f5; height: 20px;">
              <td colspan="2"></td>
            </tr>

            <tr style="background: #f5f5f5;">
              <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Deductions</td>
              <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; text-align: right;">Amount (₹)</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;">Half-Day Deduction (${salaryData.attendance.halfDays} × ₹${salaryData.salaryStructure.perDaySalary / 2})</td>
              <td style="padding: 10px; border: 1px solid #ddd; text-align: right; font-weight: bold; color: #f44336;">- ₹${salaryData.halfDayDeduction.toLocaleString('en-IN')}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;">Absent Deduction (${salaryData.attendance.absentDays} × ₹${salaryData.salaryStructure.perDaySalary})</td>
              <td style="padding: 10px; border: 1px solid #ddd; text-align: right; font-weight: bold; color: #f44336;">- ₹${salaryData.absentDeduction.toLocaleString('en-IN')}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;">Late Deduction (${salaryData.attendance.lateDays} days @ 10%)</td>
              <td style="padding: 10px; border: 1px solid #ddd; text-align: right; font-weight: bold; color: #f44336;">- ₹${salaryData.lateDeduction.toLocaleString('en-IN')}</td>
            </tr>
            <tr style="background: #ffebee;">
              <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">TOTAL DEDUCTIONS</td>
              <td style="padding: 10px; border: 1px solid #ddd; text-align: right; font-weight: bold; color: #d32f2f;">₹${salaryData.totalDeductions.toLocaleString('en-IN')}</td>
            </tr>
          </table>
        </div>

        <!-- Net Salary -->
        <div style="margin-bottom: 25px; background: #e8f5e9; border: 2px solid #4caf50; padding: 20px; text-align: center; border-radius: 5px;">
          <h3 style="margin: 0 0 10px 0; color: #2e7d32; font-size: 14px;">NET SALARY PAYABLE</h3>
          <h1 style="margin: 0; color: #2e7d32; font-size: 36px; font-weight: bold;">₹${salaryData.netSalary.toLocaleString('en-IN')}</h1>
          <p style="margin: 5px 0 0 0; color: #666; font-size: 12px;">
            (Rupees: ${this.numberToWords(salaryData.netSalary)} only)
          </p>
        </div>

        <!-- Notes -->
        <div style="margin-bottom: 20px; padding: 10px; background: #f9f9f9; border-left: 3px solid #2196f3; border-radius: 3px;">
          <p style="margin: 0; color: #666; font-size: 11px;">
            <strong>Note:</strong> This is a system-generated salary slip. For any queries or discrepancies, please contact the HR/Admin department.
          </p>
        </div>

        <!-- Footer -->
        <div style="border-top: 2px solid #333; padding-top: 15px; margin-top: 30px; text-align: center; font-size: 11px; color: #666;">
          <p style="margin: 5px 0;">This is a computer-generated document and does not require a signature.</p>
          <p style="margin: 5px 0;">Generated on: ${new Date().toLocaleDateString('en-IN')} at ${new Date().toLocaleTimeString('en-IN')}</p>
        </div>
      </div>
    `;

    return html;
  }

  /**
   * Convert number to words (for cheque amount writing)
   */
  numberToWords(num) {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const scales = ['', 'Thousand', 'Lakh', 'Crore'];

    if (num === 0) return 'Zero';

    let words = '';
    let scaleIndex = 0;

    while (num > 0) {
      let part = num % 1000;
      if (part !== 0) {
        words = this.convertHundreds(part, ones, tens) + (scales[scaleIndex] ? ' ' + scales[scaleIndex] : '') + (words ? ' ' + words : '');
      }
      num = Math.floor(num / 1000);
      scaleIndex++;
    }

    return words.trim();
  }

  /**
   * Convert number 0-999 to words
   */
  convertHundreds(num, ones, tens) {
    let words = '';

    const hundreds = Math.floor(num / 100);
    if (hundreds > 0) {
      words += ones[hundreds] + ' Hundred';
    }

    const remainder = num % 100;
    if (remainder > 0) {
      if (words) words += ' ';
      if (remainder < 10) {
        words += ones[remainder];
      } else if (remainder < 20) {
        const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen',
                       'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
        words += teens[remainder - 10];
      } else {
        const ten = Math.floor(remainder / 10);
        const one = remainder % 10;
        words += tens[ten];
        if (one > 0) {
          words += ' ' + ones[one];
        }
      }
    }

    return words;
  }

  /**
   * Generate CSV export for attendance records
   */
  generateAttendanceCSV(monthlyRecords, technicianData) {
    let csv = 'Date,Technician Name,Check-In Time,Check-Out Time,Working Hours,Face Match Score,Status\n';

    monthlyRecords.forEach(record => {
      csv += `"${record.date}","${technicianData.name}","${record.checkInTime || ''}","${record.checkOutTime || ''}","${record.workingHours || 0}","${record.faceMatchScore || 0}","${record.status}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Attendance_${technicianData.name}_${monthlyRecords[0]?.date?.slice(0, 7) || 'export'}.csv`;
    link.click();

    return { success: true, message: 'Attendance exported to CSV' };
  }
}

export default new SalarySlipGenerator();
