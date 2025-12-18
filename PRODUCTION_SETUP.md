# Production Setup Guide

## System Overview
This is a **production-ready** Service Management System with:
- ✅ Admin Panel (React) - `f:\Serve\admin-panel`
- ✅ Technician Web App - `f:\Serve\technician-web`
- ✅ Technician Mobile App (Flutter) - `f:\Serve\technician_app`
- ✅ Firebase Realtime Database backend

---

## 🔴 CRITICAL: First Time Setup

### 1. Create Your Admin Account
**DO NOT use demo accounts.** Create your own admin:

```bash
# Go to Firebase Console
# https://console.firebase.google.com/
# Select: service-management-syste-5a9f5

# Navigate to: Realtime Database > Data
# Click: + Add Child
# Name: admins
# Click: Add

# Click: + Add Child (under admins)
# Enter your email as key (e.g., "admin-001")
# Click: Add

# Set the data to:
{
  "name": "Your Full Name",
  "email": "your-email@example.com",
  "password": "your-secure-password",
  "createdAt": "2025-11-27T00:00:00Z",
  "status": "active"
}
```

### 2. Create Your First Technician
```bash
# In Firebase Console > Realtime Database

# Navigate to: admins > Create "technicians" path
# Add your first technician:

{
  "name": "Technician Name",
  "email": "tech@example.com",
  "password": "tech-password",
  "phone": "9876543210",
  "createdAt": "2025-11-27T00:00:00Z",
  "status": "active"
}
```

---

## 🚀 Running in Production

### Admin Panel
```bash
cd f:\Serve\admin-panel

# Build for production
npm run build

# Serve production build
npm run serve

# Or both together:
npm run production
```

**Access:** http://localhost:3000

### Technician Web App
```bash
cd f:\Serve\technician-web

# Build for production
npm run build

# Serve production build
npm run serve
```

**Access:** http://localhost:5000

### Technician Mobile App (Flutter)
```bash
cd f:\Serve\technician_app

# Build APK for Android
flutter build apk --release

# Output: build/app/outputs/flutter-apk/app-release.apk
```

---

## 📊 Key Features Ready for Use

✅ **Admin Panel:**
- Dashboard with real-time metrics
- Customer management
- Technician management
- Job scheduling & calendar
- Ticket/complaint tracking
- Payment tracking
- Service assignment
- Reports & analytics
- Google Maps integration (Plus Codes)
- Photo/Document upload capability

✅ **Technician Web App:**
- View assigned jobs
- Job details with customer info
- Mark jobs complete
- Location mapping
- Payment records
- Profile management

✅ **Technician Mobile App:**
- Native Android experience
- Offline capability
- Photo capture
- Real-time sync

---

## 🔐 Security Features

✅ **Session Management:**
- Secure session tokens
- Auto-logout on inactivity
- Protected routes (only logged-in users)
- Session validation

✅ **Data Protection:**
- Firebase Security Rules enforced
- Email-based authentication
- Password verification

✅ **Production Optimizations:**
- Removed demo accounts (configure your own)
- Removed test endpoints
- Removed debug logs
- Production build optimization

---

## 📱 Default Setup

### Firebase Project
- **Project ID:** service-management-syste-5a9f5
- **Database:** Realtime Database (RTD)
- **Region:** Automatic

### Database Structure
```
admins/
  {admin-id}/
    name
    email
    password
    status
    createdAt

technicians/
  {tech-id}/
    name
    email
    password
    phone
    status
    createdAt

customers/
  {customer-id}/
    fullName
    cardNumber
    machineName
    amcStartDate
    amcEndDate
    amcAmount
    mapCode

tickets/
  {ticket-id}/
    title
    description
    customerName
    customerId
    status
    priority
    assignedTo
    assignedToId
    createdAt

payments/
  {payment-id}/
    amount
    status
    method
    ticketId
    createdAt

visits/
  {visit-id}/
    ticketId
    technicianId
    checkInTime
    checkOutTime
    notes
```

---

## 🔄 Regular Operations

### Adding New Technicians
1. Admin Panel → Technicians
2. Click "Add New Technician"
3. Fill form and save

### Creating Jobs/Tickets
1. Admin Panel → Tickets
2. Click "Add New Ticket"
3. Select customer, enter details
4. Assign to technician

### Assigning Work
1. Admin Panel → Scheduling (Calendar View)
2. Click on job
3. Select technician
4. Click "Assign Technician"

### Tracking Progress
1. Dashboard shows real-time stats
2. Technician Web → View assigned jobs
3. Admin Panel → Scheduling shows calendar of work
4. Payments tab tracks collections

---

## ⚙️ Configuration

### Change Firebase Project
Edit: `f:\Serve\admin-panel\src\firebase.js`
```javascript
const firebaseConfig = {
  apiKey: "YOUR-API-KEY",
  authDomain: "YOUR-PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR-PROJECT-default-rtdb.firebaseio.com",
  projectId: "YOUR-PROJECT",
  // ... rest of config
};
```

### Environment Variables
Create `.env` file in admin-panel:
```
REACT_APP_FIREBASE_API_KEY=your-key
REACT_APP_FIREBASE_PROJECT_ID=your-project
```

---

## 🚨 Troubleshooting

### Can't Login
1. Check admin account exists in Firebase Console
2. Verify email and password are correct
3. Clear browser cache (Ctrl+Shift+Delete)

### App Won't Load
1. Check console for errors (F12)
2. Verify Firebase connection (test-firebase.html)
3. Restart npm server

### Database Errors
1. Check Firebase Realtime Database rules
2. Verify indexing on email fields
3. Check quota/usage in Firebase Console

---

## 📈 Scaling for Multiple Users

### Add More Admins
1. Firebase Console > Admins
2. Add new admin entries
3. Each admin can manage their own data

### Add More Technicians
1. Admin Panel → Technicians
2. Add as needed (no limit)
3. Assign via Scheduling calendar

### Backup Data
```bash
# Export from Firebase Console
# Settings > Import/Export > Export
# Schedule regular exports
```

---

## 🎯 Next Steps

1. ✅ Create your admin account
2. ✅ Create first technician
3. ✅ Add your customers
4. ✅ Create initial jobs
5. ✅ Assign work to technicians
6. ✅ Monitor progress in dashboard
7. ✅ Track payments
8. ✅ Run reports

**System is ready to use!** 🚀
