// PhonePe Payment Gateway Service
// Requires: PhonePe Business Account API credentials

const PHONEPE_API_BASE = 'https://api.phonepe.com/apis/hermes';

class PhonePeService {
  constructor() {
    this.merchantId = process.env.REACT_APP_PHONEPE_MERCHANT_ID;
    this.apiKey = process.env.REACT_APP_PHONEPE_API_KEY;
    this.saltKey = process.env.REACT_APP_PHONEPE_SALT_KEY;
    this.saltIndex = process.env.REACT_APP_PHONEPE_SALT_INDEX || '1';
    this.environment = process.env.REACT_APP_PHONEPE_ENVIRONMENT || 'PRODUCTION';
  }

  // Generate SHA256 hash for request verification
  async generateHash(data) {
    try {
      // Use browser's SubtleCrypto API instead of Node.js crypto
      const encoder = new TextEncoder();
      const message = encoder.encode(data + this.saltKey);
      const hashBuffer = await crypto.subtle.digest('SHA-256', message);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex;
    } catch (error) {
      console.error('Error generating hash:', error);
      throw error;
    }
  }

  // Check transaction status by transaction ID
  async checkTransactionStatus(transactionId, merchantTransactionId) {
    try {
      const endpoint = `/pg/v1/status/${this.merchantId}/${merchantTransactionId}`;
      const message = endpoint + this.saltKey;
      const checksum = await this.generateHash(message);

      const response = await fetch(`${PHONEPE_API_BASE}${endpoint}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-VERIFY': `${checksum}###${this.saltIndex}`,
          'X-MERCHANT-ID': this.merchantId
        }
      });

      if (!response.ok) {
        throw new Error(`Transaction lookup failed: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        transactionId: data.data?.transactionId,
        merchantTransactionId: data.data?.merchantTransactionId,
        status: data.data?.responseCode, // SUCCESS, FAILED, PENDING
        amount: data.data?.amount / 100, // Convert from paise to rupees
        paymentMethod: data.data?.paymentInstrument?.type, // NETBANKING, UPI, CARD, WALLET
        transactionDateTime: data.data?.transactionDateTime,
        success: data.success
      };
    } catch (error) {
      console.error('Error checking transaction status:', error);
      throw error;
    }
  }

  // Get transaction history for a date range
  async getTransactionHistory(startDate, endDate) {
    try {
      const endpoint = `/pg/v1/merchant/transactions`;
      const message = endpoint + this.saltKey;
      const checksum = await this.generateHash(message);

      const response = await fetch(
        `${PHONEPE_API_BASE}${endpoint}?startDate=${startDate}&endDate=${endDate}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-VERIFY': `${checksum}###${this.saltIndex}`,
            'X-MERCHANT-ID': this.merchantId
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch transaction history');
      }

      const data = await response.json();
      return (data.data?.transactions || []).map(txn => ({
        transactionId: txn.transactionId,
        merchantTransactionId: txn.merchantTransactionId,
        amount: txn.amount / 100, // Convert from paise
        status: txn.responseCode,
        paymentMethod: txn.paymentInstrument?.type,
        timestamp: txn.transactionDateTime
      }));
    } catch (error) {
      console.error('Error fetching transaction history:', error);
      throw error;
    }
  }

  // Verify webhook signature from PhonePe
  verifyWebhookSignature(body, signature) {
    try {
      const message = JSON.stringify(body) + this.saltKey;
      const expectedSignature = this.generateHash(message);
      return signature === expectedSignature;
    } catch (error) {
      console.error('Error verifying webhook:', error);
      return false;
    }
  }

  // Auto-verify multiple payments by scanning recent transactions
  async autoVerifyMultiplePayments(ticketPayments, hoursBack = 24) {
    try {
      const now = new Date();
      const startTime = new Date(now - hoursBack * 60 * 60 * 1000);
      const startDate = startTime.toISOString().replace(/[-:.]/g, '').slice(0, 12);
      const endDate = now.toISOString().replace(/[-:.]/g, '').slice(0, 12);

      const phonePeTransactions = await this.getTransactionHistory(startDate, endDate);

      const verifiedPayments = [];
      const unverifiedPayments = [];

      for (const payment of ticketPayments) {
        // Try to match with PhonePe transaction
        const matchedTransaction = phonePeTransactions.find(t =>
          Math.abs(t.amount - payment.dueAmount) < 1 && // Amount match (±1 rupee tolerance)
          t.status === 'SUCCESS'
        );

        if (matchedTransaction) {
          verifiedPayments.push({
            ticketId: payment.id,
            verified: true,
            amount: matchedTransaction.amount,
            transactionId: matchedTransaction.transactionId,
            merchantTransactionId: matchedTransaction.merchantTransactionId,
            timestamp: matchedTransaction.timestamp,
            paymentMethod: matchedTransaction.paymentMethod
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

  // Verify single payment and map to ticket
  async verifyAndMapPayment(ticketId, expectedAmount, merchantTransactionId) {
    try {
      const transactionStatus = await this.checkTransactionStatus(null, merchantTransactionId);

      if (transactionStatus.status === 'SUCCESS') {
        return {
          verified: true,
          amount: transactionStatus.amount,
          transactionId: transactionStatus.transactionId,
          merchantTransactionId: transactionStatus.merchantTransactionId,
          status: 'paid',
          timestamp: transactionStatus.transactionDateTime,
          method: transactionStatus.paymentMethod
        };
      } else if (transactionStatus.status === 'PENDING') {
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

  // Check if PhonePe credentials are configured
  isConfigured() {
    return !!(this.merchantId && this.apiKey && this.saltKey);
  }

  // Get configuration status
  getStatus() {
    return {
      configured: this.isConfigured(),
      hasMerchantId: !!this.merchantId,
      hasApiKey: !!this.apiKey,
      hasSaltKey: !!this.saltKey,
      environment: this.environment,
      message: !this.isConfigured()
        ? 'PhonePe credentials not configured. Add environment variables: REACT_APP_PHONEPE_MERCHANT_ID, REACT_APP_PHONEPE_API_KEY, REACT_APP_PHONEPE_SALT_KEY'
        : 'PhonePe configured successfully'
    };
  }

  // Get supported payment methods
  getSupportedPaymentMethods() {
    return [
      'UPI',
      'NETBANKING',
      'CARD',
      'WALLET',
      'EMI'
    ];
  }
}

export default new PhonePeService();
