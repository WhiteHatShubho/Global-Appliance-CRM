const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Firebase Admin (optional - only if credentials file exists)
let admin, db;
try {
  admin = require('firebase-admin');
  const serviceAccount = require('./firebase-service-account.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://service-management-syste-5a9f5.firebaseio.com'
  });
  db = admin.database();
} catch (error) {
  console.warn('⚠️  Firebase Admin not configured - using mock DB');
  db = null;
}

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

// Root endpoint
app.get('/', (req, res) => {
  res.json({ status: 'running', service: 'Global Appliance CRM Backend' });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Payment webhook server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Webhook URL: http://localhost:${PORT}/api/bharatpe/webhook`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
