#!/usr/bin/env python3
"""
Generate a loud alert sound for job notifications (Swiggy/Zomato style)
Output: assets/sounds/job_alert.mp3
"""

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt
import os

def generate_alert_sound(output_path, duration=5, sample_rate=44100):
    """
    Generate a loud, attention-grabbing alert sound similar to Swiggy/Zomato
    """
    # Create output directory if it doesn't exist
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    # Time array
    t = np.linspace(0, duration, int(sample_rate * duration), False)
    
    # Generate a multi-tone alert (rising pitch pattern)
    # Frequency pattern: 800Hz -> 1200Hz -> 800Hz (repeating)
    freq1 = 800  # Hz
    freq2 = 1200  # Hz
    
    # Create amplitude envelope (starts strong, slight fade)
    envelope = np.ones_like(t) * 0.9  # 90% volume = LOUD
    fade_start = int(sample_rate * (duration - 0.5))
    envelope[fade_start:] = np.linspace(0.9, 0.7, len(envelope) - fade_start)
    
    # Create the alert tone (combination of two frequencies for rich sound)
    cycle_length = int(sample_rate * 0.5)  # 500ms per cycle
    tone = np.zeros_like(t)
    
    for i, time_val in enumerate(t):
        cycle_pos = (i % cycle_length) / cycle_length
        
        if cycle_pos < 0.5:
            # First half: 800Hz
            tone[i] = np.sin(2 * np.pi * freq1 * time_val)
        else:
            # Second half: 1200Hz
            tone[i] = np.sin(2 * np.pi * freq2 * time_val)
    
    # Add harmonics for richer sound
    tone += 0.3 * np.sin(2 * np.pi * (freq1 + freq2) / 2 * t)
    
    # Apply envelope
    signal = tone * envelope
    
    # Normalize to prevent clipping
    signal = signal / np.max(np.abs(signal)) * 0.95
    
    # Convert to 16-bit audio
    audio_data = np.int16(signal * 32767)
    
    # Save as WAV first (scipy supports this)
    wav_path = output_path.replace('.mp3', '.wav')
    wavfile.write(wav_path, sample_rate, audio_data)
    print(f"✅ Generated WAV: {wav_path}")
    
    # Try to convert to MP3 if ffmpeg is available
    try:
        import subprocess
        result = subprocess.run(
            ['ffmpeg', '-i', wav_path, '-q:a', '9', output_path, '-y'],
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            print(f"✅ Converted to MP3: {output_path}")
            os.remove(wav_path)  # Remove WAV file
        else:
            print(f"⚠️  FFmpeg conversion failed, using WAV instead")
            print(f"ℹ️  Rename {wav_path} to job_alert.wav in your assets/sounds/")
    except FileNotFoundError:
        print(f"⚠️  FFmpeg not found. Using WAV format instead.")
        print(f"ℹ️  You can use the WAV file directly:")
        print(f"    1. Copy {wav_path} to assets/sounds/")
        print(f"    2. Update pubspec.yaml: - assets/sounds/job_alert.wav")

if __name__ == '__main__':
    # Generate the alert sound
    output_file = 'assets/sounds/job_alert.mp3'
    generate_alert_sound(output_file, duration=5, sample_rate=44100)
    
    print("\n" + "="*50)
    print("ALERT SOUND GENERATED")
    print("="*50)
    print("File: assets/sounds/job_alert.mp3 (or .wav)")
    print("Duration: 5 seconds")
    print("Volume: MAXIMUM (90%)")
    print("Pattern: Alternating 800Hz and 1200Hz tones")
    print("="*50)
