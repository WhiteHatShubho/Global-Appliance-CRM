import 'package:flutter/material.dart';

class PaymentScreen extends StatefulWidget {
  final String ticketId;

  const PaymentScreen({super.key, required this.ticketId});

  @override
  State<PaymentScreen> createState() => _PaymentScreenState();
}

class _PaymentScreenState extends State<PaymentScreen> {
  final _amountController = TextEditingController();
  String _paymentMethod = 'cash';
  final _upiReferenceController = TextEditingController();
  bool _paymentCompleted = false;

  void _processPayment() {
    // In a real app, you would process the payment
    setState(() {
      _paymentCompleted = true;
    });
  }

  @override
  void dispose() {
    _amountController.dispose();
    _upiReferenceController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Payment - ${widget.ticketId}'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Payment Details',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 20),
            TextFormField(
              controller: _amountController,
              decoration: const InputDecoration(
                labelText: 'Amount (₹)',
                border: OutlineInputBorder(),
              ),
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 20),
            const Text(
              'Payment Method',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
            ListTile(
              title: const Text('Cash'),
              leading: Radio<String>(
                value: 'cash',
                groupValue: _paymentMethod,
                onChanged: (value) {
                  setState(() {
                    _paymentMethod = value!;
                  });
                },
              ),
            ),
            ListTile(
              title: const Text('UPI'),
              leading: Radio<String>(
                value: 'upi',
                groupValue: _paymentMethod,
                onChanged: (value) {
                  setState(() {
                    _paymentMethod = value!;
                  });
                },
              ),
            ),
            if (_paymentMethod == 'upi')
              Column(
                children: [
                  const SizedBox(height: 10),
                  TextFormField(
                    controller: _upiReferenceController,
                    decoration: const InputDecoration(
                      labelText: 'UPI Reference ID',
                      border: OutlineInputBorder(),
                    ),
                  ),
                ],
              ),
            const SizedBox(height: 30),
            Center(
              child: ElevatedButton(
                onPressed: _paymentCompleted ? null : _processPayment,
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 50, vertical: 15),
                ),
                child: Text(
                  _paymentCompleted ? 'Payment Completed' : 'Process Payment',
                  style: const TextStyle(fontSize: 18),
                ),
              ),
            ),
            if (_paymentCompleted)
              Padding(
                padding: const EdgeInsets.only(top: 20),
                child: Card(
                  color: Colors.green.withOpacity(0.2),
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      children: [
                        const Icon(
                          Icons.check_circle,
                          color: Colors.green,
                          size: 50,
                        ),
                        const SizedBox(height: 10),
                        const Text(
                          'Payment Successful!',
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                            color: Colors.green,
                          ),
                        ),
                        const SizedBox(height: 10),
                        Text('Ticket ${widget.ticketId} has been completed'),
                        const SizedBox(height: 20),
                        ElevatedButton(
                          onPressed: () {
                            Navigator.pushNamedAndRemoveUntil(
                                context, '/home', (route) => false);
                          },
                          child: const Text('Back to Home'),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}