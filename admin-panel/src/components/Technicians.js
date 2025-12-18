import React, { useState, useEffect } from 'react';
import dataService from '../services/dataService';
import { showLoader, hideLoader } from '../utils/globalLoader';

const Technicians = () => {
  const [technicians, setTechnicians] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    gauto: '',
    email: '',
    password: ''
  });

  useEffect(() => {
    // Load technicians from data service
    const loadTechnicians = async () => {
      setLoading(true);
      setError('');
      try {
        showLoader();
        const loadedTechnicians = await dataService.getTechnicians(false); // Use cache
        setTechnicians(loadedTechnicians);
        console.log('Technicians loaded:', loadedTechnicians.length);
      } catch (err) {
        console.error('Error loading technicians:', err);
        setError('Failed to load technicians');
      } finally {
        hideLoader();
        setLoading(false);
      }
    };
    loadTechnicians();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Reload technicians when needed
  const reloadTechnicians = async () => {
    setLoading(true);
    setError('');
    try {
      showLoader();
      const loadedTechnicians = await dataService.getTechnicians(true); // Force refresh from Firebase
      setTechnicians(loadedTechnicians);
      setSuccess('Technicians refreshed!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error reloading technicians:', err);
      setError('Failed to refresh technicians');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      if (editingId) {
        // Update existing technician
        const updatedTechnician = await dataService.updateTechnician({
          id: editingId,
          ...formData
        });
        if (updatedTechnician) {
          setTechnicians(technicians.map(t => t.id === editingId ? { id: editingId, ...formData } : t));
          setSuccess('Technician updated successfully!');
          setEditingId(null);
          setTimeout(() => setSuccess(''), 3000);
        } else {
          setError('Failed to update technician');
        }
      } else {
        // Add new technician
        const newTechnician = await dataService.addTechnician(formData);
        if (newTechnician) {
          // Reload from dataService cache to avoid duplicates
          const allTechnicians = await dataService.getTechnicians(false);
          setTechnicians(allTechnicians);
          setSuccess('Technician added successfully!');
          setTimeout(() => setSuccess(''), 3000);
        } else {
          setError('Failed to add technician');
        }
      }
      
      setFormData({ name: '', phone: '', gauto: '', email: '', password: '' });
      setShowForm(false);
    } catch (err) {
      console.error('Error saving technician:', err);
      setError('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (technician) => {
    setFormData({
      name: technician.name,
      phone: technician.phone,
      gauto: technician.gauto || '',
      email: technician.email,
      password: technician.password || ''
    });
    setEditingId(technician.id);
    setShowForm(true);
  };

  const handleToggleStatus = async (technician) => {
    setLoading(true);
    setError('');
    try {
      const newStatus = technician.status === 'active' ? 'inactive' : 'active';
      const updatedTechnician = await dataService.updateTechnician({
        id: technician.id,
        ...technician,
        status: newStatus
      });
      if (updatedTechnician) {
        setTechnicians(technicians.map(t => 
          t.id === technician.id ? { ...t, status: newStatus } : t
        ));
        setSuccess(`Technician ${newStatus}!`);
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      console.error('Error updating technician status:', err);
      setError('Failed to update technician status');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTechnician = async (technician) => {
    const confirmDelete = window.confirm(`Are you sure you want to remove ${technician.name}? This action cannot be undone.`);
    if (confirmDelete) {
      try {
        await dataService.deleteTechnician(technician.id);
        setTechnicians(technicians.filter(t => t.id !== technician.id));
        alert('Technician removed successfully!');
      } catch (error) {
        console.error('Error deleting technician:', error);
        alert('Failed to remove technician. Please try again.');
      }
    }
  };

  return (
    <div className="content">
      {error && (
        <div style={{ padding: '10px', marginBottom: '20px', backgroundColor: '#f8d7da', color: '#721c24', borderRadius: '4px' }}>
          ❌ {error}
        </div>
      )}
      {success && (
        <div style={{ padding: '10px', marginBottom: '20px', backgroundColor: '#d4edda', color: '#155724', borderRadius: '4px' }}>
          ✅ {success}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>Technicians {loading && <span style={{ fontSize: '0.8rem', color: '#999' }}>Loading...</span>}</h1>
        <div>
          <button className="btn" style={{ width: 'auto', marginRight: '10px' }} onClick={reloadTechnicians} disabled={loading}>
            Refresh
          </button>
          <button className="btn" style={{ width: 'auto' }} onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : 'Add Technician'}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <h2>{editingId ? 'Edit Technician' : 'Add New Technician'}</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="name">Name:</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="phone">📱 Phone:</label>
              <input
                type="text"
                id="phone"
                name="phone"
                placeholder="9876543210 or +919876543210"
                value={formData.phone}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="gauto">🔧 Gauto (Skills):</label>
              <input
                type="text"
                id="gauto"
                name="gauto"
                placeholder="e.g., Washing Machine, AC, Refrigerator"
                value={formData.gauto}
                onChange={handleInputChange}
              />
            </div>
            <div className="form-group">
              <label htmlFor="email">Email:</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">Password:</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                required={!editingId}
                placeholder={editingId ? "Leave blank to keep current password" : "Create a secure password"}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="submit" className="btn">{editingId ? 'Update Technician' : 'Save Technician'}</button>
              <button 
                type="button" 
                className="btn" 
                style={{ backgroundColor: '#6c757d' }}
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                  setFormData({ name: '', phone: '', gauto: '', email: '', password: '' });
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="table-container">
        {technicians.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#999', padding: '20px' }}>
            {loading ? '📥 Loading technicians...' : '📭 No technicians added yet. Click "Add Technician" to get started!'}
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Gauto</th>
                <th>Email</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {technicians.map(technician => (
                <tr key={technician.id}>
                  <td>{technician.id}</td>
                  <td>{technician.name}</td>
                  <td>{technician.phone}</td>
                  <td>{technician.gauto || '-'}</td>
                  <td>{technician.email}</td>
                  <td>
                    <span className={`status-badge ${technician.status === 'active' ? 'status-completed' : 'status-closed'}`}>
                      {technician.status || 'active'}
                    </span>
                  </td>
                  <td>
                    <button 
                      className="btn" 
                      style={{ width: 'auto', padding: '5px 10px', marginRight: '5px' }}
                      onClick={() => handleEdit(technician)}
                      disabled={loading}
                    >
                      Edit
                    </button>
                    {(technician.status || 'active') === 'active' ? (
                      <button 
                        className="btn" 
                        style={{ width: 'auto', padding: '5px 10px', backgroundColor: '#ffc107', marginRight: '5px' }}
                        onClick={() => handleToggleStatus(technician)}
                        disabled={loading}
                      >
                        Deactivate
                      </button>
                    ) : (
                      <button 
                        className="btn" 
                        style={{ width: 'auto', padding: '5px 10px', backgroundColor: '#28a745', marginRight: '5px' }}
                        onClick={() => handleToggleStatus(technician)}
                        disabled={loading}
                      >
                        Activate
                      </button>
                    )}
                    <button
                      className="btn"
                      style={{ width: 'auto', padding: '5px 10px', backgroundColor: '#dc3545' }}
                      onClick={() => handleDeleteTechnician(technician)}
                      disabled={loading}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Technicians;