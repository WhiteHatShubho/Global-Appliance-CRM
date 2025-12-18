@echo off
REM Quick APK Build Script for Technician App
REM This script automates the build process

setlocal enabledelayedexpansion

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║       Technician App - Quick APK Build Script             ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

REM Step 1: Check if in correct directory
if not exist "f:\Serve\technician-web\package.json" (
    echo ERROR: package.json not found in f:\Serve\technician-web
    echo Please run this script from the technician-web directory
    exit /b 1
)

echo [Step 1/4] Building React app...
cd f:\Serve\technician-web
call npm run build
if errorlevel 1 (
    echo ERROR: React build failed
    exit /b 1
)
echo ✓ React build completed successfully
echo.

echo [Step 2/4] Syncing with Android project...
call npx cap sync android
if errorlevel 1 (
    echo ERROR: Capacitor sync failed
    exit /b 1
)
echo ✓ Android project synced successfully
echo.

echo [Step 3/4] Building Gradle project...
cd f:\Serve\technician-web\android
call gradlew.bat build -x test
if errorlevel 1 (
    echo ERROR: Gradle build failed
    exit /b 1
)
echo ✓ Gradle build completed successfully
echo.

echo [Step 4/4] Building APK...
call gradlew.bat assembleDebug
if errorlevel 1 (
    echo ERROR: APK assembly failed
    exit /b 1
)
echo ✓ APK built successfully
echo.

echo ╔════════════════════════════════════════════════════════════╗
echo ║                    BUILD SUCCESSFUL! ✓                    ║
echo ╚════════════════════════════════════════════════════════════╝
echo.
echo Your APK is ready at:
echo   f:\Serve\technician-web\android\app\build\outputs\apk\debug\app-debug.apk
echo.
echo To install on device:
echo   - Connect Android device via USB
echo   - Run: adb install -r [APK_PATH]
echo   - Or copy APK to phone and install manually
echo.
pause
