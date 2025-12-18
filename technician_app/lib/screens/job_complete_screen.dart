import 'package:flutter/material.dart';
import 'package:signature/signature.dart';
import 'payment_screen.dart';

class JobCompleteScreen extends StatefulWidget {
  final String ticketId;

  const JobCompleteScreen({super.key, required this.ticketId});

  @override
  State<JobCompleteScreen> createState() => _JobCompleteScreenState();
}

class _JobCompleteScreenState extends State<JobCompleteScreen> {
  final _workDoneController = TextEditingController();
  final _partsUsedController = TextEditingController();
  final _signatureController = SignatureController(
    penStrokeWidth: 3,
    penColor: Colors.black,
    exportBackgroundColor: Colors.white,
  );

  List<String> _beforePhotos = [];
  List<String> _afterPhotos = [];

  Future<void> _pickImage(bool isBefore) async {
    // In a real app, you would use image_picker to select images
    // For demo, we'll just add a placeholder
    setState(() {
      if (isBefore) {
        _beforePhotos.add('https://via.placeholder.com/150');
      } else {
        _afterPhotos.add('https://via.placeholder.com/150');
      }
    });
  }

  void _clearSignature() {
    _signatureController.clear();
  }

  void _saveAndContinue() {
    // In a real app, you would save the job completion data
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => PaymentScreen(ticketId: widget.ticketId),
      ),
    );
  }

  @override
  void dispose() {
    _workDoneController.dispose();
    _partsUsedController.dispose();
    _signatureController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Complete Job - ${widget.ticketId}'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Work Done',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 10),
            TextFormField(
              controller: _workDoneController,
              maxLines: 3,
              decoration: const InputDecoration(
                hintText: 'Describe the work done...',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              'Parts Used',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 10),
            TextFormField(
              controller: _partsUsedController,
              decoration: const InputDecoration(
                hintText: 'List parts used...',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              'Before Photos',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 10,
              children: [
                ..._beforePhotos.map((photo) => Image.network(
                      photo,
                      width: 100,
                      height: 100,
                      fit: BoxFit.cover,
                    )),
                IconButton(
                  icon: const Icon(Icons.add_a_photo),
                  onPressed: () => _pickImage(true),
                ),
              ],
            ),
            const SizedBox(height: 20),
            const Text(
              'After Photos',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 10,
              children: [
                ..._afterPhotos.map((photo) => Image.network(
                      photo,
                      width: 100,
                      height: 100,
                      fit: BoxFit.cover,
                    )),
                IconButton(
                  icon: const Icon(Icons.add_a_photo),
                  onPressed: () => _pickImage(false),
                ),
              ],
            ),
            const SizedBox(height: 20),
            const Text(
              'Customer Signature',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 10),
            Container(
              height: 200,
              decoration: BoxDecoration(
                border: Border.all(color: Colors.grey),
              ),
              child: Signature(
                controller: _signatureController,
                width: double.infinity,
                height: 200,
                backgroundColor: Colors.white,
              ),
            ),
            const SizedBox(height: 10),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                ElevatedButton(
                  onPressed: _clearSignature,
                  child: const Text('Clear'),
                ),
                ElevatedButton(
                  onPressed: _saveAndContinue,
                  child: const Text('Save & Continue'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}