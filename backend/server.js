const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Initialize Firebase Admin (use your existing Firebase config)
// You'll need to add your Firebase service account key
const serviceAccount = require('./firebase-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://YOUR_PROJECT_ID.firebaseio.com' // Replace with your Firebase URL
});

const db = admin.database();

// Store active payment sessions
const paymentSessions = new Map();

// Create payment session
app.post('/api/create-payment-session', async (req, res) => {
  try {
    const { ticketId, amount, paymentType } = req.body;
    
    const sessionId = `PAY_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    paymentSessions.set(sessionId, {
      ticketId,
      amount,
      paymentType,
      status: 'pending',
      createdAt: new Date().toISOString()
    });
    
    res.json({
      success: true,
      sessionId,
      message: 'Payment session created'
    });
  } catch (error) {
    console.error('Error creating payment session:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// BharatPe Webhook endpoint
app.post('/api/bharatpe/webhook', async (req, res) => {
  try {
    console.log('Received BharatPe webhook:', req.body);
    
    const {
      merchant_transaction_id,
      status,
      amount,
      upi_transaction_id,
      customer_vpa
    } = req.body;
    
    // Verify webhook signature (BharatPe provides this for security)
    // const isValid = verifyBharatPeSignature(req);
    // if (!isValid) {
    //   return res.status(401).json({ error: 'Invalid signature' });
    // }
    
    if (status === 'SUCCESS' || status === 'COMPLETED') {
      // Find the payment session
      const sessionId = merchant_transaction_id;
      const session = paymentSessions.get(sessionId);
      
      if (session) {
        // Update Firebase with payment success
        await db.ref(`tickets/${session.ticketId}`).update({
          paymentCollected: true,
          paymentMethod: 'upi',
          paymentStatus: 'paid',
          amountPaid: parseFloat(amount),
          dueAmount: 0,
          paymentCollectedAt: new Date().toISOString(),
          status: 'completed',
          upiTransactionId: upi_transaction_id,
          customerVpa: customer_vpa,
          paymentVerified: true
        });
        
        // Update session status
        paymentSessions.set(sessionId, {
          ...session,
          status: 'completed',
          completedAt: new Date().toISOString()
        });
        
        console.log(`Payment verified for ticket ${session.ticketId}`);
      }
    }
    
    // Always respond with 200 to acknowledge webhook receipt
    res.status(200).json({ status: 'received' });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check payment status (polling endpoint for frontend)
app.get('/api/check-payment/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = paymentSessions.get(sessionId);
    
    if (!session) {
      return res.status(404).json({ 
        success: false, 
        error: 'Session not found' 
      });
    }
    
    res.json({
      success: true,
      status: session.status,
      session
    });
  } catch (error) {
    console.error('Error checking payment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Payment webhook server running' });
});

app.listen(PORT, () => {
  console.log(`🚀 Payment webhook server running on port ${PORT}`);
  console.log(`Webhook URL: http://localhost:${PORT}/api/bharatpe/webhook`);
});
