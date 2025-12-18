import React, { useState, useEffect } from 'react';
import dataService from '../services/dataService';

const DataRecovery = () => {
  const [deletedItems, setDeletedItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const loadDeletedItems = async () => {
    setLoading(true);
    setError('');
    try {
      const deletedCustomers = await dataService.getDeletedCustomers();
      const deletedTickets = await dataService.getDeletedTickets();

      const allDeleted = [
        ...deletedCustomers.map(c => ({ ...c, type: 'Customer' })),
        ...deletedTickets.map(t => ({ ...t, type: 'Ticket' }))
      ];

      // Sort by deletion date (newest first)
      allDeleted.sort((a, b) => 
        new Date(b.deletedAt) - new Date(a.deletedAt)
      );

      setDeletedItems(allDeleted);
    } catch (err) {
      console.error('Error loading deleted items:', err);
      setError('Failed to load deleted items');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeletedItems();
  }, []);

  const handleRestore = async (item) => {
    if (!window.confirm(`Are you sure you want to restore ${item.name || item.fullName}? This action cannot be undone.`)) {
      return;
    }

    setLoading(true);
    setError('');
    try {
      if (item.type === 'Customer') {
        await dataService.restoreCustomer(item.id);
      } else if (item.type === 'Ticket') {
        await dataService.restoreTicket(item.id);
      }

      setSuccess(`✅ ${item.type} restored successfully!`);
      setTimeout(() => setSuccess(''), 3000);
      loadDeletedItems();
    } catch (err) {
      console.error('Error restoring item:', err);
      setError(`Failed to restore ${item.type}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePermanentDelete = async (item) => {
    if (!window.confirm(`⚠️ This will PERMANENTLY delete ${item.name || item.fullName} - this cannot be undone! Are you absolutely sure?`)) {
      return;
    }

    if (!window.confirm('This is your final warning. This action cannot be reversed. Are you 100% sure?')) {
      return;
    }

    setLoading(true);
    setError('');
    try {
      // Permanent deletion would be implemented here
      // For now, we'll just show a message
      setError('Permanent deletion requires additional authorization');
      setLoading(false);
    } catch (err) {
      console.error('Error deleting item:', err);
      setError('Failed to delete item');
      setLoading(false);
    }
  };

  const getFilteredItems = () => {
    if (filter === 'all') return deletedItems;
    return deletedItems.filter(item => item.type === filter);
  };

  const filteredItems = getFilteredItems();

  return (
    <div className="content">
      <h1>🗂️ Data Recovery Center</h1>
      
      <div className="card" style={{ marginBottom: '20px' }}>
        <p style={{ color: '#666', marginBottom: '15px' }}>
          This page shows all deleted records that can be recovered. Items marked as deleted are not permanently removed and can be restored anytime.
        </p>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <button 
            className="btn" 
            onClick={loadDeletedItems} 
            disabled={loading}
            style={{ background: '#0066ff' }}
          >
            {loading ? '🔄 Loading...' : '🔍 Refresh List'}
          </button>

          <select 
            value={filter} 
            onChange={(e) => setFilter(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid #ddd' }}
          >
            <option value="all">All Items ({deletedItems.length})</option>
            <option value="Customer">Customers ({deletedItems.filter(i => i.type === 'Customer').length})</option>
            <option value="Ticket">Tickets ({deletedItems.filter(i => i.type === 'Ticket').length})</option>
          </select>
        </div>

        {success && (
          <div style={{ background: '#d4edda', color: '#155724', padding: '12px', borderRadius: '4px', marginBottom: '15px' }}>
            {success}
          </div>
        )}

        {error && (
          <div style={{ background: '#f8d7da', color: '#721c24', padding: '12px', borderRadius: '4px', marginBottom: '15px' }}>
            ❌ {error}
          </div>
        )}

        {filteredItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            <p style={{ fontSize: '18px', marginBottom: '10px' }}>✅ No deleted items</p>
            <p>All your data is safe and not deleted!</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                  <th style={{ padding: '12px', textAlign: 'left' }}>Type</th>
                  <th style={{ padding: '12px', textAlign: 'left' }}>Name/ID</th>
                  <th style={{ padding: '12px', textAlign: 'left' }}>Deleted By</th>
                  <th style={{ padding: '12px', textAlign: 'left' }}>Deleted At</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '12px' }}>
                      <span style={{ 
                        background: item.type === 'Customer' ? '#e3f2fd' : '#fff3e0',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}>
                        {item.type}
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}>
                      {item.type === 'Customer' 
                        ? (item.fullName || item.name)
                        : `Ticket ${item.id}`
                      }
                      {item.phone && <div style={{ fontSize: '12px', color: '#999' }}>{item.phone}</div>}
                    </td>
                    <td style={{ padding: '12px', fontSize: '12px' }}>
                      {item.deletedBy || 'Unknown'}
                    </td>
                    <td style={{ padding: '12px', fontSize: '12px' }}>
                      {new Date(item.deletedAt).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <button
                        className="btn"
                        onClick={() => handleRestore(item)}
                        disabled={loading}
                        style={{ 
                          background: '#28a745', 
                          marginRight: '5px',
                          padding: '6px 12px',
                          fontSize: '12px'
                        }}
                      >
                        🔄 Restore
                      </button>
                      <button
                        className="btn"
                        onClick={() => handlePermanentDelete(item)}
                        disabled={loading}
                        style={{ 
                          background: '#dc3545',
                          padding: '6px 12px',
                          fontSize: '12px'
                        }}
                      >
                        🗑️ Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`
        .content {
          padding: 20px;
          max-width: 1200px;
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
      `}</style>
    </div>
  );
};

export default DataRecovery;
