import React, { useState, useEffect } from 'react';
import { ref, get, child, getDatabase } from 'firebase/database';
import { app as firebaseApp } from '../firebase';

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchEmail, setSearchEmail] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const loadAuditLogs = async () => {
    setLoading(true);
    try {
      const database = getDatabase(firebaseApp);
      const snapshot = await get(child(ref(database), 'auditLogs'));
      const auditData = snapshot.val() || {};

      const auditList = Object.keys(auditData).map(key => ({
        id: key,
        ...auditData[key]
      }));

      // Sort by timestamp (newest first)
      auditList.sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
      );

      setLogs(auditList);
    } catch (error) {
      console.error('Error loading audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditLogs();
  }, []);

  const getFilteredLogs = () => {
    let filtered = logs;

    // Filter by action type
    if (filter !== 'all') {
      filtered = filtered.filter(log => log.action === filter);
    }

    // Filter by email
    if (searchEmail.trim()) {
      filtered = filtered.filter(log =>
        log.userEmail?.toLowerCase().includes(searchEmail.toLowerCase())
      );
    }

    // Filter by date range
    if (dateRange.start) {
      const startDate = new Date(dateRange.start);
      filtered = filtered.filter(log =>
        new Date(log.timestamp) >= startDate
      );
    }

    if (dateRange.end) {
      const endDate = new Date(dateRange.end);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(log =>
        new Date(log.timestamp) <= endDate
      );
    }

    return filtered;
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'DELETE_CUSTOMER':
      case 'DELETE_TICKET':
      case 'DELETE_PAYMENT':
        return '#dc3545'; // Red
      case 'UPDATE_CUSTOMER':
      case 'UPDATE_TICKET':
        return '#ff9800'; // Orange
      case 'RESTORE_CUSTOMER':
      case 'RESTORE_TICKET':
        return '#28a745'; // Green
      case 'ADMIN_LOGIN':
        return '#0066ff'; // Blue
      case 'ADMIN_LOGOUT':
        return '#6c757d'; // Gray
      case 'BULK_CLEANUP':
        return '#722c2c'; // Dark Red
      default:
        return '#333';
    }
  };

  const getActionIcon = (action) => {
    switch (action) {
      case 'DELETE_CUSTOMER':
      case 'DELETE_TICKET':
      case 'DELETE_PAYMENT':
        return '🗑️';
      case 'UPDATE_CUSTOMER':
      case 'UPDATE_TICKET':
        return '✏️';
      case 'RESTORE_CUSTOMER':
      case 'RESTORE_TICKET':
        return '🔄';
      case 'ADMIN_LOGIN':
        return '🔐';
      case 'ADMIN_LOGOUT':
        return '🚪';
      case 'BULK_CLEANUP':
        return '⚠️';
      default:
        return '📋';
    }
  };

  const filteredLogs = getFilteredLogs();
  const actionTypes = [...new Set(logs.map(log => log.action))];

  return (
    <div className="content">
      <h1>📋 Audit Logs</h1>

      <div className="card" style={{ marginBottom: '20px' }}>
        <p style={{ color: '#666', marginBottom: '15px' }}>
          View all system activities and changes. Every delete, update, and login is tracked here.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px', marginBottom: '20px' }}>
          <input
            type="text"
            placeholder="Search email..."
            value={searchEmail}
            onChange={(e) => setSearchEmail(e.target.value)}
            style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
          />

          <select 
            value={filter} 
            onChange={(e) => setFilter(e.target.value)}
            style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
          >
            <option value="all">All Actions ({logs.length})</option>
            {actionTypes.map(action => (
              <option key={action} value={action}>
                {action} ({logs.filter(l => l.action === action).length})
              </option>
            ))}
          </select>

          <input
            type="date"
            placeholder="Start date"
            value={dateRange.start}
            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
          />

          <input
            type="date"
            placeholder="End date"
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
          />
        </div>

        <button 
          className="btn" 
          onClick={loadAuditLogs} 
          disabled={loading}
          style={{ background: '#0066ff', marginBottom: '20px' }}
        >
          {loading ? '🔄 Loading...' : '🔄 Refresh Logs'}
        </button>

        {filteredLogs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            <p>No logs found matching the filters</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                  <th style={{ padding: '12px', textAlign: 'left' }}>Action</th>
                  <th style={{ padding: '12px', textAlign: 'left' }}>User Email</th>
                  <th style={{ padding: '12px', textAlign: 'left' }}>Details</th>
                  <th style={{ padding: '12px', textAlign: 'left' }}>IP Address</th>
                  <th style={{ padding: '12px', textAlign: 'left' }}>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map(log => (
                  <tr key={log.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '12px' }}>
                      <span style={{
                        display: 'inline-block',
                        background: getActionColor(log.action),
                        color: 'white',
                        padding: '6px 10px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}>
                        {getActionIcon(log.action)} {log.action}
                      </span>
                    </td>
                    <td style={{ padding: '12px', fontSize: '14px' }}>
                      {log.userEmail}
                    </td>
                    <td style={{ padding: '12px', fontSize: '12px', color: '#666', maxWidth: '200px', overflow: 'auto' }}>
                      <details>
                        <summary style={{ cursor: 'pointer', color: '#0066ff' }}>View Details</summary>
                        <pre style={{ background: '#f5f5f5', padding: '8px', borderRadius: '4px', overflow: 'auto' }}>
                          {log.details}
                        </pre>
                      </details>
                    </td>
                    <td style={{ padding: '12px', fontSize: '12px', color: '#999' }}>
                      {log.clientIP || 'Unknown'}
                    </td>
                    <td style={{ padding: '12px', fontSize: '12px', color: '#999' }}>
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: '20px', padding: '12px', background: '#e3f2fd', borderRadius: '4px' }}>
          <p style={{ margin: 0, fontSize: '12px', color: '#1976d2' }}>
            💡 <strong>Tip:</strong> Audit logs are permanently stored and cannot be deleted. They provide a complete history of all system activities.
          </p>
        </div>
      </div>

      <style>{`
        .content {
          padding: 20px;
          max-width: 1400px;
          margin: 0 auto;
        }

        .card {
          background: white;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .btn {
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.3s;
        }

        .btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.15);
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        h1 {
          margin-top: 0;
          color: #333;
          margin-bottom: 20px;
        }

        pre {
          font-size: 11px;
          max-width: 400px;
        }
      `}</style>
    </div>
  );
};

export default AuditLogs;
