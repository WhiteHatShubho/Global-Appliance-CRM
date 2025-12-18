# Google OAuth Sign-In Fix Guide

## Issue Fixed
✅ Updated Google OAuth implementation from deprecated `gapi.auth2` to new Google Identity Services
✅ Fixed Google API script loading in HTML
✅ Added proper error handling and diagnostics

## Critical: Google Cloud Console Configuration

### Step 1: Go to Google Cloud Console
1. Open: https://console.cloud.google.com/
2. Select your project (or create one if you don't have)

### Step 2: Enable Google People API
1. Go to **APIs & Services** > **Library**
2. Search for "**Google People API**"
3. Click on it and press **ENABLE** (if not already enabled)

### Step 3: Configure OAuth Consent Screen
1. Go to **APIs & Services** > **OAuth consent screen**
2. Choose **External** user type (unless you have Google Workspace)
3. Fill in the required fields:
   - App name: `Global Appliance Admin`
   - User support email: Your email
   - Developer contact: Your email
4. Click **Save and Continue**
5. On **Scopes** page, click **Add or Remove Scopes**
6. Find and add: `https://www.googleapis.com/auth/contacts`
7. Click **Save and Continue**
8. Add test users (your email address)
9. Click **Save and Continue**

### Step 4: Configure OAuth 2.0 Client ID ⚠️ MOST IMPORTANT

**Current Client ID:** `147793758556-4ivs0bt6bpq3vuhvhp1gjbo83l8ilrki.apps.googleusercontent.com`

1. Go to **APIs & Services** > **Credentials**
2. Find the OAuth 2.0 Client ID with the ID above
3. Click on it to edit
4. **Add these Authorized JavaScript origins:**
   ```
   http://localhost:3000
   http://localhost:3001
   http://localhost:3002
   http://localhost:3003
   http://127.0.0.1:3000
   http://127.0.0.1:3001
   http://127.0.0.1:3002
   http://127.0.0.1:3003
   https://globalapplianceadmin.netlify.app
   ```

5. **Add these Authorized redirect URIs:**
   ```
   http://localhost:3000/
   http://localhost:3001/
   http://localhost:3002/
   http://localhost:3003/
   http://127.0.0.1:3000/
   http://127.0.0.1:3001/
   http://127.0.0.1:3002/
   http://127.0.0.1:3003/
   https://globalapplianceadmin.netlify.app/
   ```

6. Click **SAVE**

⚠️ **IMPORTANT:** After saving, wait 5-10 minutes for changes to propagate!

### Step 5: Check Which Port Your App is Running On

1. Start your admin panel:
   ```bash
   cd f:\Serve\admin-panel
   npm start
   ```

2. Check the console output - it will show something like:
   ```
   Compiled successfully!
   
   You can now view service-management-admin in the browser.
   
     Local:            http://localhost:3000
   ```

3. **Note the port number** (usually 3000, but could be 3001, 3002, etc.)

4. Make sure that EXACT port is in the Authorized JavaScript origins in Google Cloud Console

### Step 6: Test the Fix

1. **Clear browser cache and localStorage:**
   - Open DevTools (F12)
   - Go to **Application** tab
   - Click **Clear storage** > **Clear site data**

2. **Refresh the page** (Ctrl + F5)

3. **Go to Customers page**

4. **Try adding a new customer** with a phone number

5. **Check the browser console** (F12) for these messages:
   - ✅ `Google API initialized successfully`
   - ✅ `📌 Client ID: 147793758556-4ivs0bt6bpq3vuhvhp1gjbo83l8ilrki.apps.googleusercontent.com`
   - When signing in: `🔐 Requesting Google authorization...`
   - After success: ✅ `Google authorization successful`

### Troubleshooting

#### Error: "Google sign-in failed"
**Cause:** Port not authorized in Google Cloud Console
**Fix:** 
1. Check which port your app is running on (see Step 5)
2. Add that port to Authorized JavaScript origins
3. Wait 5-10 minutes
4. Clear cache and try again

#### Error: "Google Identity Services not loaded"
**Cause:** Scripts not loading properly
**Fix:**
1. Check your internet connection
2. Try disabling ad blockers
3. Clear browser cache (Ctrl + Shift + Delete)
4. Hard refresh (Ctrl + F5)

#### Error: "Access blocked: This app's request is invalid"
**Cause:** Mismatch between configured origins and actual URL
**Fix:**
1. Check the URL in your browser address bar
2. Make sure it EXACTLY matches one of the authorized origins
3. No trailing slash in origins: `http://localhost:3000` (not `http://localhost:3000/`)

#### Error: "The OAuth client was not found"
**Cause:** Wrong Client ID
**Fix:**
1. Verify you're using the correct Client ID in Google Cloud Console
2. The client ID in the code is: `147793758556-4ivs0bt6bpq3vuhvhp1gjbo83l8ilrki.apps.googleusercontent.com`

## What Changed in the Code

### 1. HTML (`admin-panel/public/index.html`)
```html
<!-- OLD (Deprecated) -->
<script src="https://apis.google.com/js/platform.js" async defer></script>

<!-- NEW (Modern) -->
<script src="https://apis.google.com/js/api.js"></script>
<script src="https://accounts.google.com/gsi/client" async defer></script>
```

### 2. Service (`admin-panel/src/services/googleContactsService.js`)
- ❌ Removed deprecated `gapi.auth2` 
- ✅ Added new Google Identity Services OAuth 2.0
- ✅ Better error handling with helpful console messages
- ✅ Clear instructions when auth fails

## Testing Checklist

- [ ] Google People API is enabled in Google Cloud Console
- [ ] OAuth consent screen is configured with contacts scope
- [ ] Current port (e.g., 3000) is in Authorized JavaScript origins
- [ ] Browser cache and localStorage are cleared
- [ ] Console shows "✅ Google API initialized successfully"
- [ ] Adding a customer triggers Google sign-in popup
- [ ] After signing in, customer syncs to Google Contacts
- [ ] No errors in browser console

## Need Help?

If you're still seeing errors after following all steps:

1. **Take a screenshot of:**
   - The error message in the UI
   - The browser console (F12)
   - Your Google Cloud Console OAuth settings

2. **Check:**
   - Which port your app is running on
   - If that port is in the authorized origins list
   - If you waited 5-10 minutes after saving changes

3. **Try:**
   - Using incognito/private browsing mode
   - Different browser
   - Running on port 3000 specifically (stop other processes using that port)
