/**
 * Universal Technician Time Blocking & Conflict Prevention Service
 * 
 * SHARED ACROSS ALL MODULES:
 * - Service assignments
 * - AMC services
 * - Tickets / Complaints
 * - Any future job module
 */

import { getDatabase, ref, get } from 'firebase/database';

/**
 * Service Duration Rules (Global)
 * Duration in minutes based on segment type
 */
const SERVICE_DURATION = {
  waterpurifier: 30,  // Water Purifier - 30 minutes
  chimney: 90,        // Chimney - 90 minutes (1.5 hours)
  rent: 30            // Rent Water Purifier - 30 minutes
};

/**
 * Get service duration based on segment type
 * @param {string} segment - waterpurifier | chimney | rent
 * @returns {number} Duration in minutes
 */
export const getServiceDuration = (segment) => {
  return SERVICE_DURATION[segment] || 30; // Default 30 minutes
};

/**
 * Calculate end time based on start time and duration
 * @param {string} startTime - Format: "HH:MM" (24-hour)
 * @param {number} durationMinutes - Duration in minutes
 * @returns {string} End time in "HH:MM" format
 */
export const calculateEndTime = (startTime, durationMinutes) => {
  if (!startTime) return '';
  
  const [hours, minutes] = startTime.split(':').map(Number);
  const startDate = new Date();
  startDate.setHours(hours, minutes, 0, 0);
  
  const endDate = new Date(startDate.getTime() + durationMinutes * 60000);
  
  const endHours = String(endDate.getHours()).padStart(2, '0');
  const endMinutes = String(endDate.getMinutes()).padStart(2, '0');
  
  return `${endHours}:${endMinutes}`;
};

/**
 * Convert 24-hour time to 12-hour format with AM/PM
 * @param {string} time24 - Format: "HH:MM" (24-hour)
 * @returns {string} Format: "HH:MM AM/PM"
 */
export const format12Hour = (time24) => {
  if (!time24) return '';
  
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  
  return `${String(hours12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${period}`;
};

/**
 * Check if two time ranges overlap
 * @param {string} start1 - Start time of first range (HH:MM)
 * @param {string} end1 - End time of first range (HH:MM)
 * @param {string} start2 - Start time of second range (HH:MM)
 * @param {string} end2 - End time of second range (HH:MM)
 * @returns {boolean} True if ranges overlap
 */
export const timeRangesOverlap = (start1, end1, start2, end2) => {
  const toMinutes = (time) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };
  
  const s1 = toMinutes(start1);
  const e1 = toMinutes(end1);
  const s2 = toMinutes(start2);
  const e2 = toMinutes(end2);
  
  // Check overlap: start1 < end2 AND start2 < end1
  return s1 < e2 && s2 < e1;
};

/**
 * Fetch all jobs for a technician on a specific date
 * FROM ALL SOURCES: Services, AMC, Tickets/Complaints
 * 
 * @param {string} technicianId - Technician ID
 * @param {string} scheduledDate - Date in YYYY-MM-DD format
 * @returns {Promise<Array>} Array of jobs with time blocking info
 */
export const getTechnicianJobsForDate = async (technicianId, scheduledDate) => {
  if (!technicianId || !scheduledDate) return [];
  
  try {
    const db = getDatabase();
    const jobs = [];
    
    // 1. Fetch from Tickets/Complaints
    const ticketsRef = ref(db, 'tickets');
    const ticketsSnapshot = await get(ticketsRef);
    
    if (ticketsSnapshot.exists()) {
      const tickets = ticketsSnapshot.val();
      Object.entries(tickets).forEach(([id, ticket]) => {
        if (
          ticket.deleted !== true &&
          (ticket.technicianId === technicianId || ticket.assignedToId === technicianId) &&
          ticket.scheduledDate === scheduledDate &&
          ticket.scheduledTime
        ) {
          const segment = ticket.segment || 'waterpurifier';
          const duration = getServiceDuration(segment);
          const endTime = calculateEndTime(ticket.scheduledTime, duration);
          
          jobs.push({
            jobId: id,
            jobType: 'ticket',
            title: ticket.title,
            segment: segment,
            technicianId: technicianId,
            scheduledDate: ticket.scheduledDate,
            startTime: ticket.scheduledTime,
            endTime: endTime,
            durationMinutes: duration,
            status: ticket.status
          });
        }
      });
    }
    
    // 2. Fetch from Services (future: if separate services collection exists)
    const servicesRef = ref(db, 'services');
    const servicesSnapshot = await get(servicesRef);
    
    if (servicesSnapshot.exists()) {
      const services = servicesSnapshot.val();
      Object.entries(services).forEach(([id, service]) => {
        if (
          service.deleted !== true &&
          service.technicianId === technicianId &&
          service.scheduledDate === scheduledDate &&
          service.scheduledTime
        ) {
          const segment = service.segment || 'waterpurifier';
          const duration = getServiceDuration(segment);
          const endTime = calculateEndTime(service.scheduledTime, duration);
          
          jobs.push({
            jobId: id,
            jobType: 'service',
            title: service.title || service.serviceType,
            segment: segment,
            technicianId: technicianId,
            scheduledDate: service.scheduledDate,
            startTime: service.scheduledTime,
            endTime: endTime,
            durationMinutes: duration,
            status: service.status
          });
        }
      });
    }
    
    // Sort by start time
    jobs.sort((a, b) => {
      const timeA = a.startTime.split(':').map(Number);
      const timeB = b.startTime.split(':').map(Number);
      return (timeA[0] * 60 + timeA[1]) - (timeB[0] * 60 + timeB[1]);
    });
    
    return jobs;
  } catch (error) {
    console.error('Error fetching technician jobs:', error);
    return [];
  }
};

/**
 * Check for time conflicts when assigning a technician
 * 
 * @param {string} technicianId - Technician ID
 * @param {string} scheduledDate - Date in YYYY-MM-DD format
 * @param {string} startTime - Start time in HH:MM format
 * @param {string} segment - Segment type for duration calculation
 * @param {string} excludeJobId - Optional: Job ID to exclude (for editing existing job)
 * @returns {Promise<Object>} { hasConflict: boolean, conflicts: Array, endTime: string }
 */
export const checkTimeConflict = async (technicianId, scheduledDate, startTime, segment, excludeJobId = null) => {
  if (!technicianId || !scheduledDate || !startTime) {
    return { hasConflict: false, conflicts: [], endTime: '' };
  }
  
  const duration = getServiceDuration(segment);
  const endTime = calculateEndTime(startTime, duration);
  
  // Fetch all jobs for this technician on this date
  const existingJobs = await getTechnicianJobsForDate(technicianId, scheduledDate);
  
  // Filter out the job being edited (if any)
  const relevantJobs = excludeJobId 
    ? existingJobs.filter(job => job.jobId !== excludeJobId)
    : existingJobs;
  
  // Check for overlaps
  const conflicts = relevantJobs.filter(job => 
    timeRangesOverlap(startTime, endTime, job.startTime, job.endTime)
  );
  
  return {
    hasConflict: conflicts.length > 0,
    conflicts: conflicts,
    endTime: endTime,
    durationMinutes: duration
  };
};

/**
 * Format conflict message for UI display
 * @param {Array} conflicts - Array of conflicting jobs
 * @returns {string} Formatted message
 */
export const formatConflictMessage = (conflicts) => {
  if (!conflicts || conflicts.length === 0) return '';
  
  const messages = conflicts.map(job => {
    const start12 = format12Hour(job.startTime);
    const end12 = format12Hour(job.endTime);
    return `• ${job.title} (${start12} - ${end12})`;
  });
  
  return `⚠️ Technician already has ${conflicts.length} job(s) scheduled:\n\n${messages.join('\n')}`;
};

/**
 * Get default start time (current time + 30 minutes)
 * @returns {string} Time in HH:MM format
 */
export const getDefaultStartTime = () => {
  const now = new Date();
  const future = new Date(now.getTime() + 30 * 60000); // +30 minutes
  
  const hours = String(future.getHours()).padStart(2, '0');
  const minutes = String(future.getMinutes()).padStart(2, '0');
  
  return `${hours}:${minutes}`;
};

/**
 * Get available time slots for a technician on a specific date
 * @param {string} technicianId - Technician ID
 * @param {string} scheduledDate - Date in YYYY-MM-DD format
 * @param {number} durationMinutes - Required duration in minutes
 * @returns {Promise<Array>} Array of available time slots
 */
export const getAvailableTimeSlots = async (technicianId, scheduledDate, durationMinutes = 30) => {
  const existingJobs = await getTechnicianJobsForDate(technicianId, scheduledDate);
  
  // Generate time slots from 8 AM to 8 PM (every 30 minutes)
  const slots = [];
  for (let hour = 8; hour < 20; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const startTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      const endTime = calculateEndTime(startTime, durationMinutes);
      
      // Check if this slot conflicts with any existing job
      const hasConflict = existingJobs.some(job => 
        timeRangesOverlap(startTime, endTime, job.startTime, job.endTime)
      );
      
      slots.push({
        startTime,
        endTime,
        display: format12Hour(startTime),
        available: !hasConflict
      });
    }
  }
  
  return slots;
};

export default {
  getServiceDuration,
  calculateEndTime,
  format12Hour,
  timeRangesOverlap,
  getTechnicianJobsForDate,
  checkTimeConflict,
  formatConflictMessage,
  getDefaultStartTime,
  getAvailableTimeSlots
};
