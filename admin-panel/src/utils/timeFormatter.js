/**
 * Format date as DD/MM/YYYY
 * @param {Date|string} dateInput - Date object or ISO string
 * @returns {string} - Formatted string like "13/12/2025"
 */
export const formatDateDDMMYYYY = (dateInput) => {
  if (!dateInput) return '';
  
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (error) {
    return dateInput;
  }
};

/**
 * Format time as HH:MM AM/PM
 * @param {Date|string} timeInput - Date object or ISO string or time string
 * @returns {string} - Formatted string like "02:30 PM"
 */
export const formatTimeHHMMAMPM = (timeInput) => {
  if (!timeInput) return '';
  
  try {
    let hours, minutes;
    
    if (typeof timeInput === 'string') {
      // If it's a time string (HH:MM)
      if (timeInput.includes(':') && !timeInput.includes('-')) {
        const parts = timeInput.split(':');
        hours = parseInt(parts[0], 10);
        minutes = parts[1] || '00';
      } else {
        // If it's a date string
        const date = new Date(timeInput);
        hours = date.getHours();
        minutes = date.getMinutes();
      }
    } else {
      // Date object
      hours = timeInput.getHours();
      minutes = timeInput.getMinutes();
    }
    
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = String(hours % 12 || 12).padStart(2, '0');
    const formattedMinutes = String(minutes).padStart(2, '0');
    
    return `${formattedHours}:${formattedMinutes} ${ampm}`;
  } catch (error) {
    return timeInput;
  }
};

/**
 * Format date and time as DD/MM/YYYY HH:MM AM/PM
 * @param {Date|string} dateInput - Date object or ISO string
 * @returns {string} - Formatted string like "13/12/2025 02:30 PM"
 */
export const formatDateTimeComplete = (dateInput) => {
  if (!dateInput) return '';
  
  const dateFormatted = formatDateDDMMYYYY(dateInput);
  const timeFormatted = formatTimeHHMMAMPM(dateInput);
  
  return `${dateFormatted} ${timeFormatted}`;
};

/**
 * Convert 24-hour format time string to 12-hour AM/PM format
 * @param {string} time24 - Time string in 24-hour format (HH:MM or H:MM)
 * @returns {string} - Time string in 12-hour format with AM/PM (e.g., "2:30 PM")
 */
export const format24To12 = (time24) => {
  
  // Parse the time string
  const parts = time24.split(':');
  if (parts.length !== 2) return time24;
  
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  
  // Validate hours
  if (isNaN(hours) || hours < 0 || hours > 23) return time24;
  
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 becomes 12
  
  return `${hours}:${minutes} ${ampm}`;
};

/**
 * Format a Date object to 12-hour format with date
 * @param {Date|string} dateInput - Date object or ISO string
 * @returns {string} - Formatted string like "12/25/2025, 2:30 PM"
 */
export const formatDateTo12Hour = (dateInput) => {
  if (!dateInput) return '';
  
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    const options = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    };
    return date.toLocaleDateString('en-US', options);
  } catch (error) {
    return dateInput;
  }
};

/**
 * Format a Date object to 12-hour time only
 * @param {Date|string} dateInput - Date object or ISO string
 * @returns {string} - Formatted string like "2:30 PM"
 */
export const formatTimeOnly12Hour = (dateInput) => {
  if (!dateInput) return '';
  
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    const options = {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    };
    return date.toLocaleTimeString('en-US', options);
  } catch (error) {
    return dateInput;
  }
};

/**
 * Convert 12-hour AM/PM format time to 24-hour format
 * @param {string} time12 - Time string in 12-hour format with AM/PM (e.g., "2:30 PM")
 * @returns {string} - Time string in 24-hour format (HH:MM)
 */
export const format12To24 = (time12) => {
  if (!time12) return '';
  
  // Check if already in 12-hour format
  const hasAmPm = /\s(AM|PM)/i.test(time12);
  if (!hasAmPm) return time12;
  
  const regex = /^(\d{1,2}):(\d{2})\s(AM|PM)$/i;
  const match = time12.match(regex);
  
  if (!match) return time12;
  
  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const period = match[3].toUpperCase();
  
  if (period === 'PM' && hours !== 12) {
    hours += 12;
  } else if (period === 'AM' && hours === 12) {
    hours = 0;
  }
  
  return `${String(hours).padStart(2, '0')}:${minutes}`;
};

export default { formatDateDDMMYYYY, formatTimeHHMMAMPM, formatDateTimeComplete, format24To12, formatDateTo12Hour, formatTimeOnly12Hour, format12To24 };
