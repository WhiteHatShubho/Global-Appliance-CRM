import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import sessionManager from '../services/sessionManager';
import { showLoader, hideLoader } from '../utils/globalLoader';

const ProfileScreen = () => {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    phone: '',
    profilePicture: null
  });
  const [previewImage, setPreviewImage] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Load current profile data from session and localStorage
    const savedProfile = localStorage.getItem('technicianProfile');
    if (savedProfile) {
      const parsed = JSON.parse(savedProfile);
      setProfileData(parsed);
      if (parsed.profilePicture) {
        setPreviewImage(parsed.profilePicture);
      }
    } else {
      setProfileData({
        name: sessionManager.getTechnicianName(),
        email: sessionManager.getEmail(),
        phone: sessionManager.getPhone() || '',
        profilePicture: null
      });
    }
  }, []);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileData({
          ...profileData,
          profilePicture: reader.result
        });
        setPreviewImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProfileData({
      ...profileData,
      [name]: value
    });
  };

  const handleSaveProfile = () => {
    setLoading(true);
    showLoader();
    // Save to localStorage
    localStorage.setItem('technicianProfile', JSON.stringify(profileData));
    setTimeout(() => {
      hideLoader();
      setLoading(false);
      setIsEditing(false);
      alert('✅ Profile updated successfully!');
    }, 500);
  };

  const handleLogout = () => {
    sessionManager.clearSession();
    localStorage.removeItem('isAdmin');
    localStorage.removeItem('technicianProfile');
    setTimeout(() => {
      navigate('/login', { replace: true });
    }, 100);
  };

  return (
    <>
      <style>{`
        .profile-container {
          max-width: 500px;
          margin: 0 auto;
          padding: 20px;
        }

        .profile-card {
          background: white;
          border-radius: 16px;
          padding: 30px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          margin-bottom: 20px;
        }

        .profile-picture-section {
          text-align: center;
          margin-bottom: 30px;
        }

        .profile-picture-display {
          width: 120px;
          height: 120px;
          border-radius: 50%;
          object-fit: cover;
          border: 3px solid #2563eb;
          margin-bottom: 15px;
          display: block;
          margin-left: auto;
          margin-right: auto;
          background: #f0f4ff;
        }

        .profile-picture-placeholder {
          width: 120px;
          height: 120px;
          border-radius: 50%;
          border: 3px solid #2563eb;
          margin-bottom: 15px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-left: auto;
          margin-right: auto;
          background: #f0f4ff;
          font-size: 48px;
        }

        .file-input-label {
          display: inline-block;
          padding: 10px 20px;
          background: #2563eb;
          color: white;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          transition: background 0.3s;
        }

        .file-input-label:hover {
          background: #1d4ed8;
        }

        input[type="file"] {
          display: none;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-group label {
          display: block;
          font-weight: 600;
          margin-bottom: 8px;
          color: #111827;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .form-group input {
          width: 100%;
          padding: 12px;
          border: 2px solid #e5e7eb;
          border-radius: 8px;
          font-size: 16px;
          font-family: inherit;
          box-sizing: border-box;
          transition: border-color 0.3s;
        }

        .form-group input:focus {
          outline: none;
          border-color: #2563eb;
          background: #f0f4ff;
        }

        .form-group input:disabled {
          background: #f9fafb;
          color: #6b7280;
          cursor: not-allowed;
        }

        .button-group {
          display: flex;
          gap: 10px;
          margin-top: 30px;
        }

        .btn-primary {
          flex: 1;
          padding: 12px;
          background: #2563eb;
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.3s;
          font-size: 16px;
        }

        .btn-primary:hover {
          background: #1d4ed8;
        }

        .btn-primary:disabled {
          background: #9ca3af;
          cursor: not-allowed;
        }

        .btn-secondary {
          flex: 1;
          padding: 12px;
          background: #6b7280;
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.3s;
          font-size: 16px;
        }

        .btn-secondary:hover {
          background: #4b5563;
        }

        .btn-danger {
          flex: 1;
          padding: 12px;
          background: #dc3545;
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.3s;
          font-size: 16px;
        }

        .btn-danger:hover {
          background: #c82333;
        }

        .info-display {
          background: #f0f4ff;
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 15px;
        }

        .info-label {
          font-size: 12px;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }

        .info-value {
          font-size: 18px;
          font-weight: 600;
          color: #111827;
        }
      `}</style>

      <div className="header">
        <div className="header-title">👤 My Profile</div>
      </div>

      <div className="profile-container">
        <div className="profile-card">
          {/* Profile Picture Section */}
          <div className="profile-picture-section">
            {previewImage ? (
              <img src={previewImage} alt="Profile" className="profile-picture-display" />
            ) : (
              <div className="profile-picture-placeholder">📷</div>
            )}
            
            {isEditing && (
              <>
                <label htmlFor="image-upload" className="file-input-label">
                  📸 Change Photo
                </label>
                <input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                />
              </>
            )}
          </div>

          {/* Profile Information */}
          {!isEditing ? (
            <>
              <div className="info-display">
                <div className="info-label">Name</div>
                <div className="info-value">{profileData.name}</div>
              </div>
              <div className="info-display">
                <div className="info-label">Email</div>
                <div className="info-value">{profileData.email}</div>
              </div>
              <div className="info-display">
                <div className="info-label">Phone</div>
                <div className="info-value">{profileData.phone || 'Not set'}</div>
              </div>
            </>
          ) : (
            <>
              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  name="name"
                  value={profileData.name}
                  onChange={handleInputChange}
                  placeholder="Enter your name"
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  name="email"
                  value={profileData.email}
                  onChange={handleInputChange}
                  placeholder="Enter your email"
                />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input
                  type="tel"
                  name="phone"
                  value={profileData.phone}
                  onChange={handleInputChange}
                  placeholder="Enter your phone number"
                />
              </div>
            </>
          )}

          {/* Action Buttons */}
          <div className="button-group">
            {!isEditing ? (
              <>
                <button
                  className="btn-primary"
                  onClick={() => setIsEditing(true)}
                >
                  ✏️ Edit Profile
                </button>
                <button
                  className="btn-danger"
                  onClick={handleLogout}
                >
                  🚪 Logout
                </button>
              </>
            ) : (
              <>
                <button
                  className="btn-primary"
                  onClick={handleSaveProfile}
                  disabled={loading}
                >
                  {loading ? '💾 Saving...' : '💾 Save Changes'}
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => setIsEditing(false)}
                  disabled={loading}
                >
                  ❌ Cancel
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default ProfileScreen;
