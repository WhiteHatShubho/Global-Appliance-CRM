# BharatPe Integration Setup

Auto-verify payments directly from your BharatPe Business Account!

## Features

✅ **Automatic Payment Verification** - Scan BharatPe transactions automatically  
✅ **Real-time Updates** - Update payment status instantly when verified  
✅ **Fallback Protection** - Automatic fallback to database verification if BharatPe is unavailable  
✅ **24-hour Transaction Scan** - Matches recent transactions automatically  
✅ **Success Rate Tracking** - Shows verification metrics

## Setup Instructions

### Step 1: Get BharatPe API Credentials

1. Log in to your BharatPe Business Account
   - Go to: https://dashboard.bharatpe.in

2. Navigate to **API Settings** or **Developer Console**
   - Look for: Settings → API Keys / Developer Settings

3. Create a new API Application and get:
   - **Client ID** (Merchant ID)
   - **Client Secret** (API Secret Key)
   - **API Key** (Authorization Key)

### Step 2: Add Environment Variables

Create or update `.env` file in `admin-panel` folder with:

```env
REACT_APP_BHARATPE_CLIENT_ID=your_client_id_here
REACT_APP_BHARATPE_CLIENT_SECRET=your_client_secret_here
REACT_APP_BHARATPE_API_KEY=your_api_key_here
```

**Windows (PowerShell):**
```powershell
# Edit .env file or add these lines
echo "REACT_APP_BHARATPE_CLIENT_ID=your_client_id" | Add-Content .env
echo "REACT_APP_BHARATPE_CLIENT_SECRET=your_secret" | Add-Content .env
echo "REACT_APP_BHARATPE_API_KEY=your_api_key" | Add-Content .env
```

### Step 3: Restart Application

```powershell
cd f:\Serve\admin-panel
npm run build
node server.js
```

## How to Use

### Manual Auto-Verification

1. Go to **Due Payments** tab in admin panel
2. Click **🔍 Auto-Verify (BharatPe)** button
3. System will:
   - Fetch all BharatPe transactions from last 24 hours
   - Match with pending payments by amount
   - Update verified payments automatically
   - Show success rate

### Automatic Features

When BharatPe is configured:
- Button shows: `🔍 Auto-Verify (BharatPe)` with ✅ indicator
- Verification scans 24 hours of transactions
- Matches payments by amount (±₹1 tolerance)
- Updates only verified "SUCCESS" transactions

### If BharatPe Credentials Missing

- Button shows: `🔍 Auto-Verify (Database)` with ⚠️ indicator
- Falls back to database verification
- Checks payment status from your local database

## Payment Matching Logic

System matches BharatPe transactions with pending payments by:

1. **Amount Matching** - Within ±₹1 rupee tolerance
2. **Status Check** - Only "SUCCESS" transactions
3. **Time Window** - Last 24 hours
4. **Source Filter** - Only ticket payments (not AMC)

## What Gets Updated

When payment is verified:
- ✅ Payment Status → "paid"
- ✅ Amount Paid → Transaction amount
- ✅ Due Amount → 0
- ✅ Transaction ID → Stored for reference
- ✅ Verification Time → ISO timestamp

## Troubleshooting

### "BharatPe credentials not configured"
- Check `.env` file exists in `admin-panel` folder
- Verify all three environment variables are set
- Restart the application

### "BharatPe authentication failed"
- Check Client ID and Client Secret are correct
- Verify credentials in BharatPe dashboard
- Ensure API credentials are active

### "No ticket payments to verify"
- Only ticket/service payments are verified via BharatPe
- AMC payments fall back to manual collection
- Check if pending payments exist

### Verification shows "Unverified" payments
- Verify transaction exists in BharatPe dashboard
- Check amount matches exactly (±₹1)
- Payment may still be processing - try again in 5 minutes

## BharatPe API Details

**Endpoint:** `https://api.bharatpe.in/api/v2`

**Supported Operations:**
- `POST /auth/token` - Authenticate
- `GET /transactions/{id}` - Get single transaction
- `GET /transactions?start_date=X&end_date=Y` - List transactions

**Timeout:** 30 seconds per request

## Security Notes

⚠️ **Never commit `.env` file to git**
- Add to `.gitignore` if not already there
- Keep credentials private
- Rotate API keys periodically

## API Rate Limits

BharatPe API limits:
- **Auth requests:** 100 per hour
- **Transaction queries:** 1000 per hour
- **Batch size:** Max 100 transactions per request

## Testing

### Test with Mock Data

If you don't have real BharatPe credentials yet:

1. Leave `.env` without BharatPe variables
2. Use Database verification (fallback mode)
3. Add test payments manually
4. Click Auto-Verify to test database flow

### Verify Connection

In browser console:
```javascript
// Check BharatPe status
console.log(bharatpeService.getStatus());

// Should output:
{
  configured: true/false,
  hasApiKey: true/false,
  hasCredentials: true/false,
  authenticated: false,
  message: "..."
}
```

## Support

For BharatPe API help:
- Visit: https://www.bharatpe.in/developers
- Contact: support@bharatpe.in
- Documentation: https://api-docs.bharatpe.in

## Next Steps

1. ✅ Get BharatPe credentials from dashboard
2. ✅ Add environment variables to `.env`
3. ✅ Rebuild application
4. ✅ Test with "Auto-Verify" button
5. ✅ Monitor verification rate and success metrics
