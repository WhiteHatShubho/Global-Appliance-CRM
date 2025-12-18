// Google Contacts Service - Syncs customer data to Google Contacts
// Uses Google People API with OAuth 2.0

class GoogleContactsService {
  constructor() {
    this.CLIENT_ID = '147793758556-4ivs0bt6bpq3vuhvhp1gjbo83l8ilrki.apps.googleusercontent.com';
    this.SCOPES = 'https://www.googleapis.com/auth/contacts';
    this.DISCOVERY_DOCS = ['https://people.googleapis.com/$discovery/rest?version=v1'];
    this.isInitialized = false;
    this.accessToken = localStorage.getItem('googleAccessToken');
    this.initPromise = null;
    this.tokenClient = null;
    this.initGoogleAPI();
  }

  // Initialize Google API on startup
  initGoogleAPI() {
    if (!this.initPromise) {
      this.initPromise = new Promise((resolve) => {
        // Wait for Google API to load
        const checkGoogleAPI = () => {
          if (window.gapi && window.gapi.load) {
            window.gapi.load('client', async () => {
              try {
                await window.gapi.client.init({
                  discoveryDocs: this.DISCOVERY_DOCS,
                });
                
                // Initialize the token client for OAuth
                if (window.google && window.google.accounts) {
                  this.tokenClient = window.google.accounts.oauth2.initTokenClient({
                    client_id: this.CLIENT_ID,
                    scope: this.SCOPES,
                    callback: '', // Will be set during authorize
                  });
                  this.isInitialized = true;
                  console.log('✅ Google API initialized successfully');
                  console.log('📌 Client ID:', this.CLIENT_ID);
                  resolve(true);
                } else {
                  console.error('❌ Google Identity Services not loaded');
                  console.warn('Please check that https://accounts.google.com/gsi/client is loaded');
                  resolve(false);
                }
              } catch (error) {
                console.error('❌ Google API init error:', error);
                console.error('Error details:', error.message);
                resolve(false);
              }
            });
          } else {
            // Retry after a delay
            setTimeout(checkGoogleAPI, 500);
          }
        };
        checkGoogleAPI();
      });
    }
    return this.initPromise;
  }

  // Ensure Google API is initialized
  async ensureInitialized() {
    if (!this.isInitialized) {
      await this.initGoogleAPI();
    }
  }

  // Authorize with Google
  async authorize() {
    try {
      await this.ensureInitialized();
      
      if (!this.tokenClient) {
        console.error('❌ Token client not initialized');
        console.warn('⚠️ Please ensure:');
        console.warn('1. Google API scripts are loaded in index.html');
        console.warn('2. Your localhost port is authorized in Google Cloud Console');
        console.warn('3. Client ID is correct:', this.CLIENT_ID);
        alert('❌ Google sign-in failed. Please make sure your localhost port is authorized in Google Cloud Console.\n\nAuthorized origins should include:\nhttp://localhost:3000\nhttp://localhost:3001\nhttp://localhost:3002');
        return null;
      }
      
      return new Promise((resolve, reject) => {
        try {
          // Set the callback to handle the token response
          this.tokenClient.callback = async (resp) => {
            if (resp.error !== undefined) {
              console.error('❌ OAuth error:', resp);
              alert(`❌ Google sign-in failed: ${resp.error}\n\nPlease verify your localhost port is authorized in Google Cloud Console.`);
              reject(resp);
              return;
            }
            
            this.accessToken = resp.access_token;
            localStorage.setItem('googleAccessToken', this.accessToken);
            console.log('✅ Google authorization successful');
            resolve(this.accessToken);
          };
          
          // Trigger the OAuth flow
          if (this.accessToken && window.gapi.client.getToken()) {
            // Already have a valid token
            console.log('✅ Using existing access token');
            resolve(this.accessToken);
          } else {
            // Request new token
            console.log('🔐 Requesting Google authorization...');
            this.tokenClient.requestAccessToken({ prompt: 'consent' });
          }
        } catch (error) {
          console.error('❌ Authorization error:', error);
          alert('❌ Google sign-in failed. Please try again.');
          reject(error);
        }
      });
    } catch (error) {
      console.error('❌ Authorization error:', error);
      return null;
    }
  }

  // Normalize phone number to E.164 format (+91XXXXXXXXXX)
  normalizePhoneNumber(phoneNumber) {
    if (!phoneNumber) return '';
    
    // Remove all non-digit characters
    const digits = phoneNumber.replace(/[^0-9]/g, '');
    
    // If already starts with 91, add +
    if (digits.startsWith('91') && digits.length === 12) {
      return '+' + digits;
    }
    
    // If 10 digits, add +91
    if (digits.length === 10) {
      return '+91' + digits;
    }
    
    // If 12 digits and starts with 91, add +
    if (digits.length === 12) {
      return '+' + digits;
    }
    
    // Otherwise return with + if not present
    return digits.startsWith('+') ? digits : '+' + digits;
  }

  // Generate formatted customer name for Google Contact (segment-aware)
  generateFormattedName(customer) {
    // If customer.formattedText exists, use it directly (already formatted)
    if (customer.formattedText && (customer.formattedText.startsWith('RO') || customer.formattedText.startsWith('CH') || customer.formattedText.startsWith('RentRo'))) {
      return customer.formattedText;
    }
    
    // Otherwise generate it from customer data
    const fullName = customer.fullName || customer.name || 'Unknown';
    const cardNumber = customer.cardNumber || '';
    
    // Basic validation
    if (!fullName || !cardNumber) {
      return fullName;
    }

    // Split name into parts
    const nameParts = fullName.trim().split(' ');
    const lastName = nameParts[nameParts.length - 1];
    const firstName = nameParts.slice(0, -1).join(' ') || nameParts[0];
    const cleanAddress = (customer.address || '').trim();

    // Determine prefix based on segment
    let prefix = 'RO'; // Default for Water Purifier
    if (customer.segment === 'chimney') prefix = 'CH';
    if (customer.segment === 'rent') prefix = 'RentRo';

    // Rent Water Purifier (no AMC option)
    if (customer.segment === 'rent') {
      if (!customer.rentStartDate || !customer.monthlyRent) return fullName;
      const monthNumber = customer.rentStartDate.substring(5, 7);
      return `${prefix}${monthNumber} ${lastName} ${firstName} ${cleanAddress} Rent-${customer.monthlyRent}/- ${lastName} ${cardNumber}`;
    }

    // Water Purifier & Chimney - AMC
    if (customer.customerType === 'AMC') {
      if (!customer.amcStartDate || !customer.amcAmount) return fullName;
      const monthNumber = customer.amcStartDate.substring(5, 7);
      const year = customer.amcStartDate.substring(0, 4);
      const endYear = customer.amcEndDate ? customer.amcEndDate.substring(0, 4) : year;
      return `${prefix}${monthNumber}${lastName} ${firstName} ${cleanAddress}${customer.amcStartDate}-${endYear} AMC-${customer.amcAmount}/- ${lastName} ${cardNumber}`;
    }

    // Water Purifier & Chimney - Non-AMC
    if (customer.customerType === 'NON_AMC' && (customer.filterChangeDate || customer.rentStartDate)) {
      const dateToUse = customer.filterChangeDate || customer.rentStartDate || '';
      const monthNumber = dateToUse.substring(5, 7);
      const amountToUse = customer.filterChangeAmount || customer.monthlyRent || '';
      return `${prefix}${monthNumber} ${lastName} ${firstName} ${cleanAddress} ${dateToUse} - ${amountToUse}/- ${lastName} ${cardNumber}`;
    }

    // Fallback to original name if data incomplete
    return fullName;
  }

  // Find existing contact by phone number
  async findContactByPhone(phoneNumber) {
    try {
      if (!this.accessToken) {
        await this.authorize();
      }

      // Normalize phone number to E.164 format for consistent search
      const normalizedPhone = this.normalizePhoneNumber(phoneNumber);
      console.log('🔍 Searching for contact with normalized phone:', normalizedPhone);
      
      const response = await fetch('https://people.googleapis.com/v1/people:searchContacts?query=' + encodeURIComponent(normalizedPhone) + '&readMask=phoneNumbers,names,metadata', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Token expired, re-authorize
          this.accessToken = null;
          localStorage.removeItem('googleAccessToken');
          await this.authorize();
          return this.findContactByPhone(phoneNumber);
        }
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        // Return the person with resourceName from the first match
        const result = data.results[0];
        console.log('✅ Found existing contact:', result.person.resourceName);
        return {
          resourceName: result.person.resourceName,
          person: result.person
        };
      }
      
      console.log('ℹ️ No existing contact found for phone:', normalizedPhone);
      return null;
    } catch (error) {
      console.error('Error finding contact:', error);
      return null;
    }
  }

  // Create new contact in Google Contacts
  async createContact(customer) {
    try {
      if (!this.accessToken) {
        await this.authorize();
      }

      const formattedName = this.generateFormattedName(customer);
      // Normalize phone number to E.164 format
      const phoneNumber = this.normalizePhoneNumber(customer.phone || '');

      const contactData = {
        names: [
          {
            givenName: formattedName,
            familyName: '',
            displayName: formattedName,
            unstructuredName: formattedName
          }
        ],
        phoneNumbers: phoneNumber ? [
          {
            value: phoneNumber,
            type: 'mobile'
          }
        ] : []
      };

      console.log('📤 Creating contact with data:', JSON.stringify(contactData, null, 2));

      const response = await fetch('https://people.googleapis.com/v1/people:createContact', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(contactData)
      });

      if (!response.ok) {
        if (response.status === 401) {
          this.accessToken = null;
          localStorage.removeItem('googleAccessToken');
          await this.authorize();
          return this.createContact(customer);
        }
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Contact created with formatted name:', formattedName);
      return data;
    } catch (error) {
      console.error('Error creating contact:', error);
      throw error;
    }
  }

  // Update existing contact in Google Contacts
  async updateContact(resourceName, customer) {
    try {
      if (!this.accessToken) {
        await this.authorize();
      }

      const formattedName = this.generateFormattedName(customer);
      // Normalize phone number to E.164 format
      const phoneNumber = this.normalizePhoneNumber(customer.phone || '');

      // First get the current contact to get the etag
      const getResponse = await fetch(`https://people.googleapis.com/v1/${resourceName}?personFields=names,phoneNumbers,metadata`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      let etag = '';
      if (getResponse.ok) {
        const currentContact = await getResponse.json();
        etag = currentContact.etag || '';
      }

      const contactData = {
        etag: etag,
        names: [
          {
            givenName: formattedName,
            familyName: '',
            displayName: formattedName,
            unstructuredName: formattedName
          }
        ],
        phoneNumbers: phoneNumber ? [
          {
            value: phoneNumber,
            type: 'mobile'
          }
        ] : []
      };

      console.log('📤 Updating contact with data:', JSON.stringify(contactData, null, 2));

      const response = await fetch(`https://people.googleapis.com/v1/${resourceName}:updateContact?updatePersonFields=names,phoneNumbers`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(contactData)
      });

      if (!response.ok) {
        if (response.status === 401) {
          this.accessToken = null;
          localStorage.removeItem('googleAccessToken');
          await this.authorize();
          return this.updateContact(resourceName, customer);
        }
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Contact updated with formatted name:', formattedName);
      return data;
    } catch (error) {
      console.error('Error updating contact:', error);
      throw error;
    }
  }

  // Sync customer to Google Contacts (creates or updates)
  async syncCustomerToGoogle(customer) {
    try {
      console.log('Starting Google Contacts sync for customer:', customer.fullName);
      
      // Ensure authorization
      if (!this.accessToken) {
        console.log('No access token, attempting authorization...');
        const token = await this.authorize();
        if (!token) {
          console.warn('⚠️ Google Contacts sync skipped - Google authentication not available');
          console.warn('📌 To enable Google Contacts sync:');
          console.warn('1. Go to Google Cloud Console: https://console.cloud.google.com/');
          console.warn('2. Add your localhost port to OAuth Authorized Origins');
          console.warn('3. Restart the app');
          return { skipped: true, reason: 'Google authentication not available' };
        }
      }

      // Validate required fields
      if (!customer.phone) {
        console.log('No phone number for customer, skipping sync');
        return { skipped: true, reason: 'No phone number' };
      }

      // First check if we have a stored googleContactId
      if (customer.googleContactId) {
        console.log('📌 Using stored Google Contact ID:', customer.googleContactId);
        try {
          const result = await this.updateContact(customer.googleContactId, customer);
          return { ...result, resourceName: customer.googleContactId };
        } catch (error) {
          console.warn('⚠️ Stored contact ID invalid, searching by phone...');
          // Fall through to search by phone
        }
      }

      // Try to find existing contact by phone number
      console.log('Searching for existing contact by phone:', customer.phone);
      const existingContact = await this.findContactByPhone(customer.phone);
      
      if (existingContact && existingContact.resourceName) {
        // Update existing contact
        console.log('✏️ Updating existing Google contact:', existingContact.resourceName);
        const result = await this.updateContact(existingContact.resourceName, customer);
        return { ...result, resourceName: existingContact.resourceName };
      }

      // Create new contact if not found
      console.log('📝 Creating new Google contact...');
      const result = await this.createContact(customer);
      return { ...result, resourceName: result.resourceName };
    } catch (error) {
      console.error('Error syncing customer to Google Contacts:', error);
      console.warn('⚠️ Google Contacts sync failed (customer still saved locally)');
      // Don't throw - log and continue
      return { error: error.message };
    }
  }

  // Delete contact from Google Contacts by resourceName or phone
  async deleteContact(resourceNameOrPhone) {
    try {
      if (!this.accessToken) {
        console.log('No token to delete contact');
        return { skipped: true, reason: 'No access token' };
      }

      let resourceName = resourceNameOrPhone;
      
      // If it looks like a phone number, search for the contact first
      if (!resourceNameOrPhone.startsWith('people/')) {
        console.log('🔍 Finding contact to delete by phone:', resourceNameOrPhone);
        const existingContact = await this.findContactByPhone(resourceNameOrPhone);
        
        if (!existingContact || !existingContact.resourceName) {
          console.log('⚠️ Contact not found in Google Contacts');
          return { skipped: true, reason: 'Contact not found' };
        }
        
        resourceName = existingContact.resourceName;
      }
      
      console.log('🗑️ Deleting Google contact:', resourceName);
      
      const response = await fetch(`https://people.googleapis.com/v1/${resourceName}:deleteContact`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          this.accessToken = null;
          localStorage.removeItem('googleAccessToken');
          await this.authorize();
          return this.deleteContact(resourceNameOrPhone);
        }
        throw new Error(`API error: ${response.status}`);
      }

      console.log('✅ Contact deleted from Google Contacts:', resourceName);
      return { success: true, resourceName };
    } catch (error) {
      console.error('Error deleting contact from Google:', error);
      // Don't throw - log and continue (customer delete shouldn't fail if Google delete fails)
      return { error: error.message };
    }
  }

  // Sync customer delete to Google Contacts
  async deleteCustomerFromGoogle(phoneNumberOrResourceName, googleContactId = null) {
    try {
      console.log('Starting Google Contacts delete for:', phoneNumberOrResourceName);
      
      if (!this.accessToken) {
        console.log('No access token, attempting authorization...');
        const token = await this.authorize();
        if (!token) {
          console.warn('⚠️ Google Contacts delete skipped - Google authentication not available');
          return { skipped: true, reason: 'Google authentication not available' };
        }
      }

      // Prefer using stored googleContactId if available
      if (googleContactId) {
        console.log('🎯 Using stored Google Contact ID for deletion:', googleContactId);
        return await this.deleteContact(googleContactId);
      }

      if (!phoneNumberOrResourceName) {
        console.log('No phone number or contact ID for customer, skipping Google delete');
        return { skipped: true, reason: 'No identifier provided' };
      }

      return await this.deleteContact(phoneNumberOrResourceName);
    } catch (error) {
      console.error('Error deleting customer from Google Contacts:', error);
      console.warn('⚠️ Google Contacts delete failed (customer still deleted locally)');
      return { error: error.message };
    }
  }

  // Check if user is authenticated with Google
  isAuthenticated() {
    try {
      return !!this.accessToken && !!window.gapi?.client?.getToken();
    } catch (error) {
      return false;
    }
  }

  // Logout from Google
  logout() {
    try {
      const token = window.gapi?.client?.getToken();
      if (token !== null) {
        window.google?.accounts?.oauth2?.revoke(token.access_token, () => {
          console.log('✅ Google token revoked');
        });
        window.gapi.client.setToken(null);
      }
      this.accessToken = null;
      localStorage.removeItem('googleAccessToken');
      console.log('✅ Logged out from Google');
    } catch (error) {
      console.error('❌ Error logging out from Google:', error);
      // Still clear local state even if revoke fails
      this.accessToken = null;
      localStorage.removeItem('googleAccessToken');
    }
  }
}

export default new GoogleContactsService();
