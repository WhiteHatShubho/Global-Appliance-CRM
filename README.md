# Service Management System

This project is a service management system with two main components:

1. **Admin Web Panel** - Built with React
2. **Technician Android App** - Built with Flutter

## Project Structure

### Admin Web Panel (admin-panel/)
- Built with React.js
- Uses Firebase for backend services
- Features:
  - Login screen
  - Dashboard with statistics
  - Customer management
  - Ticket/complaint management
  - Technician management
  - Payment tracking
  - Reporting

### Technician Android App (technician_app/)
- Built with Flutter
- Uses Firebase for backend services
- Features:
  - Phone number authentication with OTP
  - Today's jobs listing
  - Job details view
  - Job completion with:
    - Work description
    - Parts used
    - Before/after photos
    - Customer signature
  - Payment processing (Cash/UPI)
  - Job history
  - Technician profile

## Firebase Structure

The application uses Firebase Firestore with the following collections:

- `users` - Admin and technician accounts
- `customers` - Customer information
- `tickets` - Service tickets/complaints
- `visits` - Job visit records
- `payments` - Payment records

## Setup Instructions

### Admin Web Panel

1. Navigate to the `admin-panel` directory
2. Install dependencies: `npm install`
3. Update Firebase configuration in `src/firebase.js`
4. Start the development server: `npm start`

### Technician Android App

1. Navigate to the `technician_app` directory
2. Install dependencies: `flutter pub get`
3. Update Firebase configuration files
4. Run the app: `flutter run`

## Security Rules

Firebase Security Rules ensure that:
- Technicians can only see their assigned tickets
- Admins can see all data
- Users can only modify their own data

## Workflow

1. Admin creates a ticket
2. Admin assigns ticket to a technician
3. Technician updates job status (start → complete)
4. Technician collects payment
5. Job is closed

## Technologies Used

- **Frontend**: React.js, Flutter
- **Backend**: Firebase (Firestore, Authentication, Storage)
- **State Management**: React Context API, Provider (Flutter)