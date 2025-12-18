/**
 * Real-time Sync Backup Service
 * Automatically syncs Firebase data to local storage and IndexedDB
 * Creates periodic backups without relying on Firebase
 */

import { getDatabase, ref, onValue } from 'firebase/database';

class RealtimeSyncBackup {
  constructor() {
    this.backupInterval = null;
    this.listeners = [];
    this.isInitialized = false;
    this.backupHistory = [];
    this.maxBackupSize = 50 * 1024 * 1024; // 50MB limit
  }

  /**
   * Initialize real-time sync backup
   */
  async initialize(firebaseApp) {
    try {
      const database = getDatabase(firebaseApp);
      
      console.log('🔄 Initializing real-time sync backup...');
      
      // DISABLED: Real-time listeners consume Firebase quota
      // Only use manual backups via createSnapshot() on-demand
      // const collections = ['customers', 'tickets', 'payments', 'technicians', 'callLogs'];
      // collections.forEach(collection => {
      //   const collectionRef = ref(database, collection);
      //   onValue(collectionRef, (snapshot) => {
      //     const data = snapshot.val();
      //     this.saveToLocalStorage(collection, data);
      //     this.saveToIndexedDB(collection, data);
      //     console.log(`✅ Synced ${collection} to local backup`);
      //   });
      // });

      // Start periodic backup interval (15 minutes) - uses cached data only
      this.startPeriodicBackup();
      this.isInitialized = true;
      
      return { success: true, message: 'Real-time sync backup initialized (quota-safe mode)' };
    } catch (error) {
      console.error('❌ Backup initialization error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Save data to browser's localStorage
   */
  saveToLocalStorage(collection, data) {
    try {
      const backupKey = `backup_${collection}_${Date.now()}`;
      const backupEntry = {
        collection,
        data,
        timestamp: new Date().toISOString(),
        size: new Blob([JSON.stringify(data)]).size
      };
      
      // Keep last 5 backups per collection
      const storageKey = `backup_${collection}`;
      let backups = JSON.parse(localStorage.getItem(storageKey) || '[]');
      
      backups.push(backupEntry);
      // DISABLED: Auto-deletion removed per user request - keep all backups
      // if (backups.length > 5) {
      //   backups = backups.slice(-5);
      // }
      
      localStorage.setItem(storageKey, JSON.stringify(backups));
      localStorage.setItem(backupKey, JSON.stringify(backupEntry));

      return { success: true };
    } catch (error) {
      console.warn(`⚠️ localStorage backup failed for ${collection}:`, error.message);
      // Continue even if localStorage fails (quota exceeded, etc)
      return { success: false, error: error.message };
    }
  }

  /**
   * Save data to IndexedDB (better for large data)
   */
  async saveToIndexedDB(collection, data) {
    return new Promise((resolve) => {
      try {
        const request = indexedDB.open('GlobalApplianceBackup', 1);

        request.onerror = () => {
          console.warn('⚠️ IndexedDB open failed');
          resolve({ success: false });
        };

        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains('backups')) {
            db.createObjectStore('backups', { keyPath: 'id', autoIncrement: true });
          }
        };

        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction(['backups'], 'readwrite');
          const store = transaction.objectStore('backups');

          const backupEntry = {
            collection,
            data,
            timestamp: new Date().toISOString(),
            size: new Blob([JSON.stringify(data)]).size
          };

          // Keep only recent backups to avoid quota issues
          const getAllRequest = store.getAll();
          getAllRequest.onsuccess = () => {
            const allBackups = getAllRequest.result;
            const collectionBackups = allBackups.filter(b => b.collection === collection);

            // DISABLED: Delete old backups - keep all per user request
            // if (collectionBackups.length > 10) {
            //   const toDelete = collectionBackups.slice(0, collectionBackups.length - 10);
            //   toDelete.forEach(backup => {
            //     store.delete(backup.id);
            //   });
            // }
          };

          const addRequest = store.add(backupEntry);
          addRequest.onsuccess = () => {
            console.log(`✅ IndexedDB backup saved for ${collection}`);
            resolve({ success: true });
          };

          addRequest.onerror = () => {
            console.warn(`⚠️ IndexedDB save failed for ${collection}`);
            resolve({ success: false });
          };
        };
      } catch (error) {
        console.warn('⚠️ IndexedDB error:', error.message);
        resolve({ success: false, error: error.message });
      }
    });
  }

  /**
   * Start periodic backup (every 15 minutes)
   */
  startPeriodicBackup() {
    // Clear existing interval
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
    }

    // Create backup every 15 minutes
    this.backupInterval = setInterval(() => {
      this.createSnapshot();
    }, 15 * 60 * 1000);

    console.log('⏰ Periodic backup scheduled every 15 minutes');
  }

  /**
   * Create a full backup snapshot
   */
  async createSnapshot() {
    try {
      const snapshot = {
        timestamp: new Date().toISOString(),
        collections: {}
      };

      const collections = ['customers', 'tickets', 'payments', 'technicians', 'callLogs'];

      for (const collection of collections) {
        const backups = JSON.parse(localStorage.getItem(`backup_${collection}`) || '[]');
        if (backups.length > 0) {
          snapshot.collections[collection] = backups[backups.length - 1].data;
        }
      }

      // Save snapshot
      const snapshotKey = `snapshot_${Date.now()}`;
      localStorage.setItem(snapshotKey, JSON.stringify(snapshot));
      localStorage.setItem('latest_snapshot', snapshotKey);

      // DISABLED: Keep only last 5 snapshots - now keeping all per user request
      // const snapshotPattern = /^snapshot_\d+$/;
      // const keys = Object.keys(localStorage).filter(k => snapshotPattern.test(k));
      // if (keys.length > 5) {
      //   keys.slice(0, -5).forEach(key => localStorage.removeItem(key));
      // }

      console.log(`✅ Full backup snapshot created: ${snapshotKey}`);
      this.backupHistory.push({ timestamp: snapshot.timestamp, key: snapshotKey });

      return { success: true, key: snapshotKey };
    } catch (error) {
      console.error('❌ Snapshot creation failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get latest backup for a collection
   */
  getLatestBackup(collection) {
    try {
      const backups = JSON.parse(localStorage.getItem(`backup_${collection}`) || '[]');
      if (backups.length > 0) {
        return backups[backups.length - 1];
      }
      return null;
    } catch (error) {
      console.error(`Error getting backup for ${collection}:`, error);
      return null;
    }
  }

  /**
   * Get all backups for a collection
   */
  getAllBackups(collection) {
    try {
      return JSON.parse(localStorage.getItem(`backup_${collection}`) || '[]');
    } catch (error) {
      console.error(`Error getting backups for ${collection}:`, error);
      return [];
    }
  }

  /**
   * Get backup statistics
   */
  getBackupStats() {
    try {
      const stats = {
        collections: {},
        totalSize: 0,
        lastBackup: localStorage.getItem('latest_snapshot'),
        storageUsage: this.getStorageUsage()
      };

      const collections = ['customers', 'tickets', 'payments', 'technicians', 'callLogs'];
      
      collections.forEach(collection => {
        const backup = this.getLatestBackup(collection);
        if (backup) {
          const itemCount = Object.keys(backup.data || {}).length;
          stats.collections[collection] = {
            itemCount,
            size: backup.size,
            timestamp: backup.timestamp
          };
          stats.totalSize += backup.size;
        }
      });

      return stats;
    } catch (error) {
      console.error('Error getting backup stats:', error);
      return { error: error.message };
    }
  }

  /**
   * Estimate storage usage
   */
  getStorageUsage() {
    try {
      let totalSize = 0;
      for (let key in localStorage) {
        if (key.startsWith('backup_') || key.startsWith('snapshot_')) {
          totalSize += localStorage.getItem(key).length;
        }
      }
      return {
        bytes: totalSize,
        mb: (totalSize / (1024 * 1024)).toFixed(2)
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Export backup as JSON file
   */
  exportBackup(collection = null) {
    try {
      let exportData = {
        timestamp: new Date().toISOString(),
        version: '1.0',
        exported: true
      };

      if (collection) {
        const backup = this.getLatestBackup(collection);
        exportData[collection] = backup;
      } else {
        const collections = ['customers', 'tickets', 'payments', 'technicians', 'callLogs'];
        collections.forEach(col => {
          const backup = this.getLatestBackup(col);
          if (backup) {
            exportData[col] = backup;
          }
        });
      }

      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `backup-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      return { success: true, filename: link.download };
    } catch (error) {
      console.error('Export error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Clear old backups to free space
   */
  clearOldBackups(daysToKeep = 7) {
    try {
      const now = Date.now();
      const cutoffTime = now - (daysToKeep * 24 * 60 * 60 * 1000);
      let deletedCount = 0;

      for (let key in localStorage) {
        if (key.startsWith('backup_') || key.startsWith('snapshot_')) {
          const timestamp = parseInt(key.split('_')[1]);
          if (timestamp < cutoffTime) {
            localStorage.removeItem(key);
            deletedCount++;
          }
        }
      }

      console.log(`✅ Cleared ${deletedCount} old backups`);
      return { success: true, deleted: deletedCount };
    } catch (error) {
      console.error('Cleanup error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Stop real-time sync
   */
  stop() {
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
      console.log('⏹️ Real-time sync backup stopped');
    }
  }
}

export const realtimeSyncBackup = new RealtimeSyncBackup();
