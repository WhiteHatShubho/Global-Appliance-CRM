import React, { useState, useEffect } from 'react';
import { app as firebaseApp } from '../firebase';
import { realtimeSyncBackup } from '../services/realtimeSyncBackup';

const RealtimeBackup = () => {
  const [isActive, setIsActive] = useState(false);
  const [stats, setStats] = useState(null);
  const [selectedCollection, setSelectedCollection] = useState('all');
  const [message, setMessage] = useState('');
  const [backupHistory, setBackupHistory] = useState([]);

  // Define helper functions first
  const updateStats = () => {
    const stats = realtimeSyncBackup.getBackupStats();
    setStats(stats);
    
    // Load backup history
    const historyList = [];
    const collections = ['customers', 'tickets', 'payments', 'technicians', 'callLogs'];
    
    collections.forEach(collection => {
      const backups = realtimeSyncBackup.getAllBackups(collection);
      historyList.push(...backups.map(b => ({ ...b, collection })));
    });
    
    setBackupHistory(historyList.sort((a, b) => 
      new Date(b.timestamp) - new Date(a.timestamp)
    ).slice(0, 20));
  };

  useEffect(() => {
    // Auto-start backup on page load
    const initializeBackup = async () => {
      if (realtimeSyncBackup.isInitialized) {
        setIsActive(true);
        updateStats();
      } else {
        // Auto-start backup
        try {
          const result = await realtimeSyncBackup.initialize(firebaseApp);
          if (result.success) {
            setIsActive(true);
            setMessage('✅ Real-time backup started automatically!');
            updateStats();
          }
        } catch (error) {
          console.error('Auto-start backup error:', error);
        }
      }
    };
    
    initializeBackup();
  }, []);

  const handleStartBackup = async () => {
    try {
      setMessage('🔄 Initializing real-time backup...');
      const result = await realtimeSyncBackup.initialize(firebaseApp);
      
      if (result.success) {
        setIsActive(true);
        setMessage('✅ Real-time backup started! Data will sync automatically.');
        updateStats();
      } else {
        setMessage('❌ Error: ' + result.error);
      }
    } catch (error) {
      setMessage('❌ Error starting backup: ' + error.message);
    }
  };

  const handleStopBackup = () => {
    realtimeSyncBackup.stop();
    setIsActive(false);
    setMessage('⏹️ Real-time backup stopped');
  };

  const handleExport = () => {
    const result = realtimeSyncBackup.exportBackup(selectedCollection === 'all' ? null : selectedCollection);
    if (result.success) {
      setMessage(`✅ Backup exported: ${result.filename}`);
    } else {
      setMessage('❌ Export failed: ' + result.error);
    }
  };

  const handleClearOld = () => {
    if (window.confirm('⚠️ Delete backups older than 7 days?')) {
      const result = realtimeSyncBackup.clearOldBackups(7);
      if (result.success) {
        setMessage(`✅ Cleared ${result.deleted} old backups`);
        updateStats();
      } else {
        setMessage('❌ Cleanup failed: ' + result.error);
      }
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="content">
      <h1>🔄 Real-time Backup System</h1>

      {/* Status Card */}
      <div className="card" style={{
        marginBottom: '20px',
        backgroundColor: isActive ? '#d4edda' : '#f8d7da',
        borderLeft: `4px solid ${isActive ? '#28a745' : '#dc3545'}`
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: '0 0 10px 0' }}>
              {isActive ? '✅ Backup Active' : '⏹️ Backup Inactive'}
            </h2>
            <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
              {isActive 
                ? '🔄 Data syncing in real-time to local storage'
                : 'Backup system is not currently running'}
            </p>
          </div>
          <div>
            {!isActive ? (
              <button className="btn" onClick={handleStartBackup} style={{ backgroundColor: '#28a745' }}>
                🟢 Start Real-time Backup
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <h2>📊 Backup Statistics</h2>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '15px',
            marginBottom: '20px'
          }}>
            {Object.entries(stats.collections).map(([collection, data]) => (
              <div key={collection} style={{
                padding: '15px',
                backgroundColor: '#f8f9fa',
                borderRadius: '5px',
                border: '1px solid #ddd'
              }}>
                <h4 style={{ margin: '0 0 10px 0', textTransform: 'capitalize' }}>
                  {collection}
                </h4>
                <p style={{ margin: '5px 0', fontSize: '13px' }}>
                  <strong>Items:</strong> {data.itemCount}
                </p>
                <p style={{ margin: '5px 0', fontSize: '13px' }}>
                  <strong>Size:</strong> {formatFileSize(data.size)}
                </p>
                <p style={{ margin: '5px 0', fontSize: '11px', color: '#999' }}>
                  {new Date(data.timestamp).toLocaleString()}
                </p>
              </div>
            ))}
          </div>

          <div style={{ padding: '15px', backgroundColor: '#f0f4ff', borderRadius: '5px' }}>
            <p style={{ margin: '5px 0', fontSize: '14px' }}>
              <strong>Total Backup Size:</strong> {formatFileSize(stats.totalSize)}
            </p>
            <p style={{ margin: '5px 0', fontSize: '14px' }}>
              <strong>Storage Usage:</strong> {stats.storageUsage.mb} MB
            </p>
          </div>
        </div>
      )}

      {/* Export Controls */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <h2>💾 Export Backup</h2>
        
        <div style={{ display: 'flex', gap: '10px', alignItems: 'end' }}>
          <div className="form-group" style={{ flex: 1, margin: 0 }}>
            <label htmlFor="collectionSelect">Select Collection:</label>
            <select
              id="collectionSelect"
              value={selectedCollection}
              onChange={(e) => setSelectedCollection(e.target.value)}
              style={{ width: '100%', padding: '8px', fontSize: '14px' }}
            >
              <option value="all">All Collections</option>
              <option value="customers">Customers</option>
              <option value="tickets">Tickets/Jobs</option>
              <option value="payments">Payments</option>
              <option value="technicians">Technicians</option>
              <option value="callLogs">Call Logs</option>
            </select>
          </div>
          <button className="btn" onClick={handleExport} style={{ backgroundColor: '#0066ff', whiteSpace: 'nowrap' }}>
            📥 Export as JSON
          </button>
        </div>
      </div>

      {/* Backup History */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <h2>📋 Recent Backups</h2>
        
        {backupHistory.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '13px'
            }}>
              <thead>
                <tr style={{ backgroundColor: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Collection</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Items</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Size</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {backupHistory.map((backup, index) => (
                  <tr key={index} style={{
                    borderBottom: '1px solid #eee',
                    backgroundColor: index % 2 === 0 ? '#fafafa' : 'white'
                  }}>
                    <td style={{ padding: '10px', textTransform: 'capitalize', fontWeight: 'bold', color: '#0066ff' }}>
                      {backup.collection}
                    </td>
                    <td style={{ padding: '10px' }}>
                      {Object.keys(backup.data || {}).length}
                    </td>
                    <td style={{ padding: '10px' }}>
                      {formatFileSize(backup.size)}
                    </td>
                    <td style={{ padding: '10px', fontSize: '11px', color: '#999' }}>
                      {new Date(backup.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ color: '#999', textAlign: 'center', padding: '20px' }}>
            No backups yet. Start the backup system to begin.
          </p>
        )}
      </div>

      {/* Maintenance */}
      <div className="card">
        <h2>🔧 Maintenance</h2>
        
        <button
          className="btn"
          onClick={handleClearOld}
          style={{ backgroundColor: '#ff9800' }}
        >
          🗑️ Clear Old Backups (Manual Cleanup)
        </button>
        
        <p style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
          ⚠️ AUTO-DELETE DISABLED: All backups are now kept permanently. Use button above to manually delete old backups if needed.
        </p>
      </div>

      {/* Messages */}
      {message && (
        <div style={{
          marginTop: '20px',
          padding: '15px',
          backgroundColor: message.includes('✅') ? '#d4edda' : message.includes('🔄') ? '#e7f3ff' : '#f8d7da',
          color: message.includes('✅') ? '#155724' : message.includes('🔄') ? '#004085' : '#721c24',
          borderRadius: '5px',
          border: `1px solid ${message.includes('✅') ? '#c3e6cb' : message.includes('🔄') ? '#b8daff' : '#f5c6cb'}`
        }}>
          {message}
        </div>
      )}
    </div>
  );
};

export default RealtimeBackup;
