// BharatPe Payment Verification Service
// Requires: BharatPe Business Account API credentials

const BHARATPE_API_BASE = 'https://api.bharatpe.in/api/v2';

class BharatPeService {
  constructor() {
    this.clientId = process.env.REACT_APP_BHARATPE_CLIENT_ID;
    this.clientSecret = process.env.REACT_APP_BHARATPE_CLIENT_SECRET;
    this.apiKey = process.env.REACT_APP_BHARATPE_API_KEY;
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  // Authenticate with BharatPe API
  async authenticate() {
    try {
      if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
        return this.accessToken;
      }

      const response = await fetch(`${BHARATPE_API_BASE}/auth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Merchant-Id': this.clientId,
        },
        body: JSON.stringify({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'client_credentials'
        })
      });

      if (!response.ok) {
        throw new Error('BharatPe authentication failed');
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + (data.expires_in * 1000 - 60000); // Refresh 1 min before expiry
      
      return this.accessToken;
    } catch (error) {
      console.error('BharatPe auth error:', error);
      throw error;
    }
  }

  // Get transaction/payment by reference ID
  async getPaymentStatus(referenceId) {
    try {
      const token = await this.authenticate();

      const response = await fetch(
        `${BHARATPE_API_BASE}/transactions/${referenceId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-Merchant-Id': this.clientId
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Payment lookup failed: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        status: data.status, // SUCCESS, PENDING, FAILED
        amount: data.amount,
        referenceId: data.reference_id,
        transactionId: data.transaction_id,
        timestamp: data.created_at,
        paymentMethod: data.payment_method, // CARD, UPI, NETBANKING
        orderId: data.order_id
      };
    } catch (error) {
      console.error('Error fetching payment status:', error);
      throw error;
    }
  }

  // Get all transactions for a date range
  async getTransactions(startDate, endDate, limit = 100) {
    try {
      const token = await this.authenticate();

      const response = await fetch(
        `${BHARATPE_API_BASE}/transactions?start_date=${startDate}&end_date=${endDate}&limit=${limit}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-Merchant-Id': this.clientId
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch transactions');
      }

      const data = await response.json();
      return data.transactions || [];
    } catch (error) {
      console.error('Error fetching transactions:', error);
      throw error;
    }
  }

  // Verify payment and map to ticket
  async verifyAndMapPayment(ticketId, expectedAmount, referenceId) {
    try {
      const paymentStatus = await this.getPaymentStatus(referenceId);

      if (paymentStatus.status === 'SUCCESS') {
        return {
          verified: true,
          amount: paymentStatus.amount,
          transactionId: paymentStatus.transactionId,
          status: 'paid',
          timestamp: paymentStatus.timestamp,
          method: paymentStatus.paymentMethod
        };
      } else if (paymentStatus.status === 'PENDING') {
        return {
          verified: false,
          status: 'pending',
          message: 'Payment still processing'
        };
      } else {
        return {
          verified: false,
          status: 'failed',
          message: 'Payment failed'
        };
      }
    } catch (error) {
      console.error('Error verifying payment:', error);
      throw error;
    }
  }

  // Auto-verify multiple payments by scanning recent transactions
  async autoVerifyMultiplePayments(ticketPayments, hoursBack = 24) {
    try {
      const now = new Date();
      const startDate = new Date(now - hoursBack * 60 * 60 * 1000).toISOString();
      const endDate = now.toISOString();

      const bharatpeTransactions = await this.getTransactions(startDate, endDate);
      
      const verifiedPayments = [];
      const unverifiedPayments = [];

      for (const payment of ticketPayments) {
        // Try to match with BharatPe transaction
        const matchedTransaction = bharatpeTransactions.find(t =>
          Math.abs(t.amount - payment.dueAmount) < 1 && // Amount match (±1 rupee tolerance)
          t.status === 'SUCCESS'
        );

        if (matchedTransaction) {
          verifiedPayments.push({
            ticketId: payment.id,
            verified: true,
            amount: matchedTransaction.amount,
            transactionId: matchedTransaction.transaction_id,
            referenceId: matchedTransaction.reference_id,
            timestamp: matchedTransaction.created_at
          });
        } else {
          unverifiedPayments.push(payment.id);
        }
      }

      return {
        verified: verifiedPayments,
        unverified: unverifiedPayments,
        total: ticketPayments.length,
        verificationRate: `${((verifiedPayments.length / ticketPayments.length) * 100).toFixed(1)}%`
      };
    } catch (error) {
      console.error('Error auto-verifying payments:', error);
      throw error;
    }
  }

  // Check if BharatPe credentials are configured
  isConfigured() {
    return !!(this.clientId && this.clientSecret && this.apiKey);
  }

  // Get configuration status
  getStatus() {
    return {
      configured: this.isConfigured(),
      hasApiKey: !!this.apiKey,
      hasCredentials: !!(this.clientId && this.clientSecret),
      authenticated: !!this.accessToken,
      message: !this.isConfigured() 
        ? 'BharatPe credentials not configured. Add environment variables: REACT_APP_BHARATPE_CLIENT_ID, REACT_APP_BHARATPE_CLIENT_SECRET, REACT_APP_BHARATPE_API_KEY'
        : 'BharatPe configured successfully'
    };
  }
}

export default new BharatPeService();
