# 🚀 Technician App APK Build Guide

Your technician web app has been successfully converted to Capacitor! Follow these steps to build the APK.

## ✅ What's Been Done

1. ✓ Installed Capacitor Core and CLI
2. ✓ Initialized Capacitor with app ID: `com.globalappliance.technician`
3. ✓ Added Android platform
4. ✓ Installed required plugins:
   - Camera plugin
   - Geolocation plugin
   - Local Notifications plugin

---

## 📋 Prerequisites (IMPORTANT - MUST INSTALL)

Before building the APK, you MUST install these tools on your Windows machine:

### 1. **Java Development Kit (JDK 11 or 17)**
   - Download: https://www.oracle.com/java/technologies/downloads/
   - Choose: **JDK 17** (latest stable)
   - Install and set `JAVA_HOME` environment variable
   
   **How to set JAVA_HOME:**
   - Right-click "This PC" → Properties → Advanced system settings
   - Click "Environment Variables"
   - Add new system variable:
     - Variable name: `JAVA_HOME`
     - Variable value: `C:\Program Files\Java\jdk-17` (or your JDK install path)
   - Verify: Open PowerShell and type `java -version`

### 2. **Android SDK**
   - **Option A (Easiest):** Install Android Studio
     - Download: https://developer.android.com/studio
     - During setup, it will automatically install Android SDK and tools
   
   - **Option B (CLI only):** Install Android SDK Command-line Tools
     - Download: https://developer.android.com/studio#command-tools
     - Extract and set environment variables for SDK locations

### 3. **Android SDK Components** (if using Android Studio)
   - Open Android Studio → SDK Manager
   - Install:
     - Android SDK Platform 34 (or latest)
     - Android SDK Build Tools 34.0.0
     - Android Emulator (optional, for testing)
     - Android SDK Platform-Tools
     - Android SDK Tools

### 4. **Set Environment Variables**
   After installing Android SDK, set:
   
   ```
   ANDROID_HOME = C:\Users\YourUsername\AppData\Local\Android\Sdk
   ANDROID_SDK_ROOT = C:\Users\YourUsername\AppData\Local\Android\Sdk
   ```
   
   Add to PATH:
   - `%ANDROID_HOME%\platform-tools`
   - `%ANDROID_HOME%\tools`
   - `%ANDROID_HOME%\cmdline-tools\latest\bin`

   Verify: Open PowerShell and type `adb version`

### 5. **Gradle** (usually included with Android Studio)
   - If not installed, download from: https://gradle.org/releases/
   - Set `GRADLE_HOME` environment variable

---

## 🔨 Build Steps

### Step 1: Update Android Project with Latest Build

```powershell
cd f:\Serve\technician-web
npm run build
npx cap sync android
```

### Step 2: Open Android Studio

```powershell
cd f:\Serve\technician-web\android
# If Android Studio is installed, it will open the project
# Or manually open it from Android Studio: File → Open → select 'android' folder
```

### Step 3: Build APK in Android Studio

1. **Connect Android Device** (optional, for direct installation)
   - Enable Developer Mode: Settings → About Phone → tap Build Number 7 times
   - Enable USB Debugging: Settings → Developer Options → USB Debugging
   - Connect via USB cable

2. **Build APK:**
   - In Android Studio: **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
   - Wait for build to complete (2-5 minutes)
   - APK location: `android/app/build/outputs/apk/debug/app-debug.apk`

3. **Or Build Release APK (Recommended for Distribution):**
   - **Build** → **Build Bundle(s) / APK(s)** → **Build Bundle(s)**
   - Or use command line:
   
   ```powershell
   cd f:\Serve\technician-web\android
   gradlew.bat build
   ```

   - APK location: `android/app/build/outputs/apk/release/app-release.apk`

### Step 4: Install APK on Device

**Option A: From Android Studio**
- **Run** → **Run 'app'** (if device connected)
- APK installs automatically

**Option B: Manual Installation**
```powershell
# Using adb (Android Debug Bridge)
adb install -r f:\Serve\technician-web\android\app\build\outputs\apk\debug\app-debug.apk
```

**Option C: Transfer to Phone**
- Copy APK file to your Android phone
- Open file manager, tap APK, and install

---

## 📱 Configure Android App (AndroidManifest.xml)

The app already has required permissions, but verify:

- ✓ Camera permission (photo capture)
- ✓ Location permission (GPS tracking)
- ✓ Internet permission (Firebase sync)
- ✓ Notification permission

These are automatically set by Capacitor plugins.

---

## 🔑 Firebase Configuration in APK

Your Firebase config is already embedded in the APK from your React app. The APK will:
1. Connect to your Firebase project
2. Load attendance data
3. Save attendance photos and location
4. Sync with admin panel

**Verify:** Open your APK and check:
- Can login with technician credentials
- Can capture photos
- Can upload location data

---

## 🐛 Common Issues & Solutions

### Issue: "java: command not found"
**Solution:** Install JDK 17 and set `JAVA_HOME` environment variable. Restart PowerShell.

### Issue: "android: command not found" or "SDK not found"
**Solution:** 
- Install Android Studio
- Set `ANDROID_HOME` environment variable
- Add `%ANDROID_HOME%\platform-tools` to PATH

### Issue: "gradlew.bat not found"
**Solution:** 
- Run `npx cap sync android` again
- Ensure you're in the `android` directory

### Issue: APK build fails with "Gradle sync failed"
**Solution:**
1. Delete `android/.gradle` folder
2. Run `npx cap sync android` again
3. Open Android Studio and let it re-sync

### Issue: App crashes on startup
**Solution:**
1. Check logcat in Android Studio for errors
2. Verify Firebase config is correct
3. Check console.log in browser DevTools (if using emulator)

---

## 📤 Building Release APK (For Distribution)

For App Store or sharing, create a signed release APK:

1. **In Android Studio:**
   - **Build** → **Generate Signed Bundle / APK**
   - Select **APK** (not Bundle)
   - Create new keystore or use existing
   - Choose **Release** variant
   - Wait for signing to complete

2. **Or Command Line:**
   ```powershell
   cd f:\Serve\technician-web\android
   gradlew.bat bundleRelease
   ```

**Release APK location:** `android/app/build/outputs/bundle/release/app-release.aab`

---

## ✅ Testing Checklist

After building APK, verify:
- [ ] App launches successfully
- [ ] Login screen appears
- [ ] Can login with technician credentials
- [ ] Camera permission works (photo capture)
- [ ] Location/GPS permission works
- [ ] Notification permission prompts appear
- [ ] Can view job list
- [ ] Can complete job with photo and location
- [ ] Data syncs to Firebase
- [ ] Admin panel shows technician's work

---

## 📞 Next Steps

1. **Install JDK & Android SDK** (if not already done)
2. **Set environment variables** (JAVA_HOME, ANDROID_HOME)
3. **Open Android Studio** → Open the `android` folder
4. **Build APK** using Android Studio UI
5. **Install on Android device** via USB or file transfer
6. **Test all features** using the checklist above

---

## 🚀 Update App After Changes

Whenever you modify the React code:

```powershell
cd f:\Serve\technician-web
npm run build
npx cap sync android
# Then rebuild APK in Android Studio
```

---

**Questions?** Check Capacitor docs: https://capacitorjs.com/docs/android
