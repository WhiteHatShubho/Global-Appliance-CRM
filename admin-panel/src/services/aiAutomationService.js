/**
 * AI Automation Service
 * Automatically handles admin tasks without manual intervention
 */

import dataService from './dataService';

class AIAutomationService {
  constructor() {
    this.isRunning = false;
    this.automationInterval = null;
    this.logs = [];
    this.tasksCompleted = 0;
  }

  /**
   * Start AI automation
   */
  async startAutomation(checkInterval = 5) {
    if (this.isRunning) {
      console.log('⚠️ Automation already running');
      return;
    }

    this.isRunning = true;
    console.log('🤖 AI Automation started');

    // Run automation checks every N minutes
    this.automationInterval = setInterval(async () => {
      await this.runAutomationTasks();
    }, checkInterval * 60 * 1000);

    // Also trigger auto-backup every hour
    this.backupInterval = setInterval(async () => {
      await this.autoBackupData();
    }, 60 * 60 * 1000); // Every hour

    // Run immediately on start
    await this.runAutomationTasks();
    await this.autoBackupData(); // Backup immediately on start
  }

  /**
   * Stop AI automation
   */
  stopAutomation() {
    if (this.automationInterval) {
      clearInterval(this.automationInterval);
    }
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
    }
    this.isRunning = false;
    console.log('⏹️ AI Automation stopped');
  }

  /**
   * Run all automation tasks
   */
  async runAutomationTasks() {
    try {
      const tasks = [
        this.autoAssignJobs(),
        this.autoRescheduleExpiredServices(),
        this.autoSendAMCReminders(),
        this.autoMarkCompletedTickets(),
        this.autoGenerateReports(),
        this.autoBackupData()
      ];

      const results = await Promise.all(tasks);
      const successCount = results.filter(r => r?.success).length;

      this.log(`✅ Completed ${successCount}/${results.length} automation tasks`);
      this.tasksCompleted += successCount;
    } catch (error) {
      this.log(`❌ Automation error: ${error.message}`);
    }
  }

  /**
   * Auto-assign jobs to available technicians
   */
  async autoAssignJobs() {
    try {
      const tickets = await dataService.getTickets();
      const technicians = await dataService.getTechnicians();
      const activeTickets = tickets.filter(t => t.status === 'open' && !t.assignedTo);

      if (activeTickets.length === 0) {
        return { success: true, message: 'No unassigned jobs' };
      }

      let assignedCount = 0;

      for (const ticket of activeTickets) {
        // Find best available technician (least jobs assigned)
        const availableTechs = technicians.filter(t => t.status === 'active');
        if (availableTechs.length === 0) continue;

        // Count jobs per technician
        const techJobs = {};
        availableTechs.forEach(t => {
          techJobs[t.id] = tickets.filter(tk => tk.assignedToId === t.id && tk.status === 'assigned').length;
        });

        // Find technician with least jobs
        const bestTech = availableTechs.reduce((prev, curr) =>
          techJobs[prev.id] <= techJobs[curr.id] ? prev : curr
        );

        // Assign job
        await dataService.updateTicket(ticket.id, {
          assignedTo: bestTech.name,
          assignedToId: bestTech.id,
          status: 'assigned',
          assignedAt: new Date().toISOString().split('T')[0],
          aiAutoAssigned: true
        });

        assignedCount++;
        this.log(`✅ Auto-assigned job ${ticket.id} to ${bestTech.name}`);
      }

      return { success: true, assigned: assignedCount };
    } catch (error) {
      this.log(`❌ Auto-assign error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Auto-reschedule services that are overdue
   */
  async autoRescheduleExpiredServices() {
    try {
      const tickets = await dataService.getTickets();
      const overdueDays = 7; // Mark as overdue after 7 days
      const today = new Date();
      let rescheduledCount = 0;

      for (const ticket of tickets) {
        if (ticket.status !== 'assigned') continue;

        const createdDate = new Date(ticket.createdAt);
        const daysSince = Math.floor((today - createdDate) / (1000 * 60 * 60 * 24));

        if (daysSince > overdueDays && !ticket.aiAutoRescheduled) {
          // Auto-reschedule to next available date
          const newDate = new Date(today);
          newDate.setDate(newDate.getDate() + 3); // Schedule 3 days ahead

          await dataService.updateTicket(ticket.id, {
            scheduledDate: newDate.toISOString().split('T')[0],
            scheduledArrivalTime: '10:00 AM',
            rescheduleReason: 'Auto-rescheduled due to overdue',
            aiAutoRescheduled: true
          });

          rescheduledCount++;
          this.log(`✅ Auto-rescheduled job ${ticket.id}`);
        }
      }

      return { success: true, rescheduled: rescheduledCount };
    } catch (error) {
      this.log(`❌ Auto-reschedule error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Auto-send AMC renewal reminders
   */
  async autoSendAMCReminders() {
    try {
      const customers = await dataService.getCustomers();
      const today = new Date();
      let reminderCount = 0;

      for (const customer of customers) {
        if (!customer.amcEndDate) continue;

        const amcDate = new Date(customer.amcEndDate);
        const daysLeft = Math.floor((amcDate - today) / (1000 * 60 * 60 * 24));

        // Send reminder 30 days before, 15 days before, and 7 days before expiry
        const reminderDays = [30, 15, 7];

        if (reminderDays.includes(daysLeft) && !customer.aiReminderSent) {
          // In real scenario, send WhatsApp/SMS here
          await dataService.updateCustomer(customer.id, {
            aiReminderSent: true,
            lastReminderDate: today.toISOString().split('T')[0]
          });

          reminderCount++;
          this.log(`✅ Auto-sent AMC reminder to ${customer.fullName} (${daysLeft} days left)`);
        }
      }

      return { success: true, reminders: reminderCount };
    } catch (error) {
      this.log(`❌ Auto-reminder error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Auto-mark completed tickets when all conditions met
   */
  async autoMarkCompletedTickets() {
    try {
      const tickets = await dataService.getTickets();
      let markedCount = 0;

      for (const ticket of tickets) {
        if (ticket.status !== 'assigned') continue;

        // Auto-mark as completed if:
        // 1. Has scheduled date and it's past
        // 2. Has completion notes or payment collected
        if (ticket.scheduledDate) {
          const scheduleDate = new Date(ticket.scheduledDate);
          const today = new Date();

          if (scheduleDate < today && (ticket.completionNotes || ticket.paymentCollected)) {
            await dataService.updateTicket(ticket.id, {
              status: 'completed',
              completedAt: today.toISOString().split('T')[0],
              aiAutoCompleted: true
            });

            markedCount++;
            this.log(`✅ Auto-marked ticket ${ticket.id} as completed`);
          }
        }
      }

      return { success: true, marked: markedCount };
    } catch (error) {
      this.log(`❌ Auto-mark error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Auto-generate reports
   */
  async autoGenerateReports() {
    try {
      const tickets = await dataService.getTickets();
      const payments = await dataService.getPayments();
      const today = new Date().toISOString().split('T')[0];

      // Daily stats
      const dailyTickets = tickets.filter(t => t.createdAt === today).length;
      const dailyCompleted = tickets.filter(t => t.completedAt === today).length;
      const dailyRevenue = payments
        .filter(p => p.date === today && p.status === 'completed')
        .reduce((sum, p) => sum + (p.amount || 0), 0);

      const report = {
        date: today,
        totalJobs: dailyTickets,
        completed: dailyCompleted,
        revenue: dailyRevenue,
        generatedBy: 'AI_AUTOMATION'
      };

      this.log(`✅ Generated daily report: ${dailyTickets} jobs, ${dailyCompleted} completed, ₹${dailyRevenue} revenue`);
      return { success: true, report };
    } catch (error) {
      this.log(`❌ Report generation error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Auto-backup data - Comprehensive backup of all data
   */
  async autoBackupData() {
    try {
      const timestamp = new Date().toISOString();
      
      // Fetch all data
      const customers = await dataService.getCustomers();
      const tickets = await dataService.getTickets();
      const payments = await dataService.getPayments();
      const technicians = await dataService.getTechnicians();
      
      const backupData = {
        timestamp: timestamp,
        version: '1.0',
        totalItems: customers.length + tickets.length + payments.length + technicians.length,
        collections: {
          customers: {
            count: customers.length,
            data: customers,
            lastBackup: timestamp
          },
          tickets: {
            count: tickets.length,
            data: tickets,
            lastBackup: timestamp
          },
          payments: {
            count: payments.length,
            data: payments,
            lastBackup: timestamp
          },
          technicians: {
            count: technicians.length,
            data: technicians,
            lastBackup: timestamp
          }
        }
      };
      
      // Save to localStorage
      const backupKey = `auto_backup_${Date.now()}`;
      localStorage.setItem(backupKey, JSON.stringify(backupData));
      localStorage.setItem('latest_auto_backup', backupKey);
      
      // DISABLED: Auto-deletion removed per user request - keep all backups
      // const allBackups = Object.keys(localStorage)
      //   .filter(key => key.startsWith('auto_backup_'))
      //   .sort();
      // if (allBackups.length > 10) {
      //   allBackups.slice(0, -10).forEach(key => localStorage.removeItem(key));
      // }
      
      this.log(`✅ Auto-backup completed: ${customers.length} customers, ${tickets.length} jobs, ${payments.length} payments, ${technicians.length} technicians`);
      return { success: true, timestamp, itemsBackedUp: backupData.totalItems };
    } catch (error) {
      this.log(`❌ Backup error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Log automation actions
   */
  log(message) {
    const entry = {
      timestamp: new Date().toISOString(),
      message
    };
    this.logs.push(entry);
    console.log(`[AI] ${message}`);

    // Keep only last 100 logs
    if (this.logs.length > 100) {
      this.logs = this.logs.slice(-100);
    }
  }

  /**
   * Get automation logs
   */
  getLogs(limit = 50) {
    return this.logs.slice(-limit);
  }

  /**
   * Get automation stats
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      tasksCompleted: this.tasksCompleted,
      logsCount: this.logs.length,
      lastLog: this.logs[this.logs.length - 1]?.timestamp
    };
  }

  /**
   * Reset stats
   */
  resetStats() {
    this.tasksCompleted = 0;
    this.logs = [];
  }

  /**
   * Get all auto-backups
   */
  getAutoBackups() {
    try {
      const backups = Object.keys(localStorage)
        .filter(key => key.startsWith('auto_backup_'))
        .map(key => {
          const data = JSON.parse(localStorage.getItem(key) || '{}');
          return {
            key,
            timestamp: data.timestamp,
            totalItems: data.totalItems,
            size: new Blob([localStorage.getItem(key)]).size
          };
        })
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      return backups;
    } catch (error) {
      console.error('Error getting backups:', error);
      return [];
    }
  }

  /**
   * Download auto-backup as JSON
   */
  downloadAutoBackup(key) {
    try {
      const backupData = localStorage.getItem(key);
      if (!backupData) {
        throw new Error('Backup not found');
      }

      const dataBlob = new Blob([backupData], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `auto_backup_${new Date().getTime()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      return { success: true };
    } catch (error) {
      console.error('Download error:', error);
      return { success: false, error: error.message };
    }
  }
}

export const aiAutomationService = new AIAutomationService();
