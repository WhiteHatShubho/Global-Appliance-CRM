import 'package:audioplayers/audioplayers.dart';

class JobAlertService {
  static final JobAlertService _instance = JobAlertService._internal();
  
  final AudioPlayer _audioPlayer = AudioPlayer();
  bool _isPlaying = false;
  String? _currentAlertJobId;

  factory JobAlertService() {
    return _instance;
  }

  JobAlertService._internal();

  /// Start alert sound loop for new job
  Future<void> startJobAlert(String jobId) async {
    // Stop any existing alert
    if (_isPlaying && _currentAlertJobId != jobId) {
      await stopJobAlert();
    }

    _currentAlertJobId = jobId;
    _isPlaying = true;

    try {
      // Loop the alert sound continuously
      await _audioPlayer.setReleaseMode(ReleaseMode.loop);
      await _audioPlayer.setVolume(1.0);
      
      // Play alert sound - using system asset
      await _audioPlayer.play(
        AssetSource('sounds/job_alert.mp3'), // Your custom alert sound
      );
      
      print('🔔 Job Alert Started for Job: $jobId');
    } catch (e)
      {
      print('Error playing job alert: $e');
    }
  }

  /// Stop alert sound and mark job as notified
  Future<void> stopJobAlert() async {
    if (!_isPlaying) return;

    try {
      await _audioPlayer.stop();
      _isPlaying = false;
      _currentAlertJobId = null;
      
      print('🔕 Job Alert Stopped');
    } catch (e) {
      print('Error stopping job alert: $e');
    }
  }

  /// Check if alert is currently playing
  bool get isAlertPlaying => _isPlaying;

  /// Get current alert job ID
  String? get currentAlertJobId => _currentAlertJobId;

  /// Dispose resources
  Future<void> dispose() async {
    await _audioPlayer.dispose();
    _isPlaying = false;
    _currentAlertJobId = null;
  }
}
