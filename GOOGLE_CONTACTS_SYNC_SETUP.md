# Google Contacts Sync Setup Guide

## Overview
This document explains how to set up Google Contacts synchronization for the CRM. When a customer is added or edited, their information is automatically synced to Google Contacts with formatted details in the contact name field.

## Features
- ✅ Auto-sync on customer add
- ✅ Auto-sync on customer edit
- ✅ Match existing contacts by phone number
- ✅ Formatted name with all customer details
- ✅ Non-blocking (sync failures don't stop the operation)

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project:
   - Click "Select a Project" → "New Project"
   - Name: "Service Management CRM"
   - Click "Create"

3. Wait for project creation to complete

## Step 2: Enable People API

1. In Google Cloud Console, go to **APIs & Services** → **Library**
2. Search for "People API"
3. Click on "People API"
4. Click the **Enable** button

## Step 3: Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Select **Web application**
4. Configure the OAuth consent screen:
   - Click "Create" (if prompted)
   - App name: "Service Management CRM"
   - User support email: (your email)
   - Save and Continue
   - Add scopes:
     - `https://www.googleapis.com/auth/contacts`
   - Save and Continue
   - Add test users (optional)
   - Save and Continue

5. Back to OAuth client ID creation:
   - Application type: **Web application**
   - Name: "CRM Admin Panel"
   - Authorized JavaScript origins:
     - `http://localhost:3002`
     - `http://localhost:3000`
     - `http://127.0.0.1:3002`
   - Authorized redirect URIs:
     - `http://localhost:3002/`
     - `http://localhost:3000/`
     - `http://127.0.0.1:3002/`
   - Click "Create"

6. Copy the **Client ID** (you'll need this)

## Step 4: Configure Environment Variables

1. Open `f:\Serve\admin-panel\.env` (create if doesn't exist)
2. Add these lines:
```
REACT_APP_GOOGLE_API_KEY=YOUR_API_KEY_HERE
REACT_APP_GOOGLE_CLIENT_ID=YOUR_CLIENT_ID_HERE
```

3. Replace:
   - `YOUR_CLIENT_ID_HERE` with the Client ID from Step 3

4. Save the file

## Step 5: Restart the Application

1. Stop the React development server (Ctrl+C)
2. Run:
```bash
npm start
```

## How It Works

### Adding a Customer
1. Fill in customer details in the form
2. Click "Save Customer"
3. System automatically:
   - Saves customer to database
   - Attempts to sync to Google Contacts
   - Shows success message

### Editing a Customer
1. Click "Edit" on a customer
2. Modify the details
3. Click "Update Customer"
4. System automatically:
   - Updates customer in database
   - Looks for existing Google contact by phone number
   - Updates or creates the contact
   - Shows success message

### Formatted Name in Google Contacts

**For AMC Customers (Active AMC):**
```
Ro11Sarkar Subhash Joramandir11/11/2024-2025 AMC-4500/- Sarkar 001
```
Format: `Ro<MONTH><LastName> <FirstName> <Address><START_DATE>-<END_YEAR> AMC-<AMOUNT>/- <LastName> <CardNo>`

**For Non-AMC or Expired AMC:**
```
Ro01 Sarkar Subhash Joramandir 11/11/2024 - 4500/- Sarkar 001
```
Format: `Ro<MONTH> <LastName> <FirstName> <Address> <DATE> - <AMOUNT>/- <LastName> <CardNo>`

## Matching Logic

The system matches existing Google contacts using:
1. **Phone Number**: Extracts digits and compares
2. **Priority**: Exact phone match → Update contact
3. **Fallback**: If no match found → Create new contact

## Troubleshooting

### Error: "Google API not loaded"
- Make sure `index.html` has the Google API script tag
- Clear browser cache and refresh
- Check browser console for errors

### Error: "Failed to authorize with Google"
- Check if Client ID is correct in `.env`
- Ensure the OAuth app is in development mode (for testing)
- Clear browser cookies for this site
- Try logging out and back in

### Error: "Could not sync to Google Contacts"
- Check if People API is enabled in Google Cloud Console
- Verify OAuth scopes include: `https://www.googleapis.com/auth/contacts`
- Check browser console for detailed error
- This won't block customer creation - customer still saves locally

### Contacts not appearing in Google Contacts
- Wait 30-60 seconds for sync to complete
- Refresh Google Contacts
- Check if the phone number format is valid (+91XXXXXXXXXX)
- Verify Google account has permission to modify contacts

## Testing

1. Add a new customer with valid details:
   - Name: "Test Customer"
   - Phone: "9876543210"
   - Other details...

2. Click "Save Customer"

3. Check Google Contacts:
   - Open https://contacts.google.com
   - Search for the customer name or phone
   - Verify the formatted name is correct

4. Edit the customer:
   - Change any field
   - Click "Update"
   - Verify the Google contact is updated with new information

## Important Notes

⚠️ **Security:**
- Never commit `.env` files with actual credentials
- Keep Google OAuth credentials private
- Use environment variables for all sensitive data

⚠️ **Rate Limiting:**
- Google API has rate limits
- If syncing many customers at once, consider implementing delays
- Current implementation uses OAuth tokens with automatic refresh

⚠️ **Data Privacy:**
- All customer details are stored in the contact name field
- No sensitive data is stored in separate Google Contact fields
- Users must have Google account and permissions to modify contacts

## Files Modified/Created

- **Created**: `src/services/googleContactsService.js` - Main sync service
- **Modified**: `public/index.html` - Added Google API script
- **Modified**: `src/components/Customers.js` - Added sync calls

## API Endpoints Used

- `GET /people:searchContacts` - Find existing contacts by phone
- `POST /people:createContact` - Create new contact
- `PATCH /people/{resourceName}:updateContact` - Update existing contact

## Support

For issues with Google API:
- [Google People API Documentation](https://developers.google.com/people)
- [OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Google Cloud Console](https://console.cloud.google.com/)
