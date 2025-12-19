# Building Android APK for ESP RGBWW Controller

This guide explains how to build an Android APK for the Lightinator ESP RGBWW controller web app.

## Features

- **Native mDNS Discovery**: Automatically discovers ESP RGBWW controllers on the local network using `esprgbwwAPI._http._tcp.local` service
- **Fallback IP Scanning**: If mDNS fails, falls back to scanning common local IP ranges
- **Persistent Storage**: Saves selected controller for quick reconnection
- **Network Detection**: Checks network connectivity and guides users to connect to WiFi

## Installed Packages

```bash
npm install @capacitor/network@8.0.0
npm install @capacitor/preferences@8.0.0
npm install @devioarts/capacitor-mdns@0.0.2
```

## Setup Steps

### 1. Install Capacitor CLI and Android Platform

```bash
npm install -D @capacitor/core @capacitor/cli @capacitor/android
```

### 2. Add Capacitor to Quasar

```bash
npx quasar mode add capacitor
```

This creates:

- `src-capacitor/` directory
- `capacitor.config.json` configuration file

### 3. Configure Capacitor

Edit `src-capacitor/capacitor.config.json`:

```json
{
  "appId": "com.lightinator.app",
  "appName": "Lightinator",
  "webDir": "../dist/capacitor",
  "server": {
    "androidScheme": "https",
    "cleartext": true,
    "allowNavigation": ["*"]
  },
  "plugins": {
    "SplashScreen": {
      "launchShowDuration": 2000,
      "backgroundColor": "#667eea"
    }
  }
}
```

### 4. Configure Android Permissions

Edit `src-capacitor/android/app/src/main/AndroidManifest.xml` and add:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- Network permissions -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
    <uses-permission android:name="android.permission.CHANGE_WIFI_MULTICAST_STATE" />

    <application
        android:usesCleartextTraffic="true"
        ... >
```

**Important**: `CHANGE_WIFI_MULTICAST_STATE` is required for mDNS discovery to work.

### 5. Build for Android

```bash
# Build the web app for Capacitor
npx quasar build -m capacitor -T android

# Sync Capacitor files
npx cap sync android

# Open in Android Studio
npx cap open android
```

### 6. Build APK in Android Studio

1. Wait for Gradle sync to complete
2. Click **Build → Build Bundle(s) / APK(s) → Build APK(s)**
3. APK will be in `android/app/build/outputs/apk/debug/`

For release builds:

```bash
# Build release APK
npx quasar build -m capacitor -T android --mode production

# Then in Android Studio: Build → Generate Signed Bundle / APK
```

## How It Works

### App Startup Flow

1. **App Launch**: `App.vue` checks if running as native app
2. **Discovery Check**: Calls `initializeControllerDiscovery()`
3. **Stored Controller**: If a controller is stored, verifies it's reachable
4. **No Controller**: Redirects to `/discovery` page
5. **Discovery Page**:
   - Shows network status
   - Starts mDNS scan for `esprgbwwAPI._http._tcp.local`
   - Falls back to IP scanning if mDNS fails
   - Displays found controllers
6. **Selection**: User selects controller, saved to device storage
7. **Connect**: Redirects to main app with selected controller

### mDNS Discovery Process

```javascript
// Service discovery parameters
type: "_http._tcp";
domain: "local.";
service: "esprgbwwAPI";

// Looks for: esprgbwwAPI._http._tcp.local
```

When a controller is discovered:

- Extracts IP address, hostname, device name
- Reads TXT records for firmware version, controller ID
- Verifies it's an ESP RGBWW controller
- Adds to available controllers list

### Fallback IP Scanning

If mDNS fails (e.g., on some networks):

- Scans common IP ranges: 192.168.1.x, 192.168.0.x, 10.0.0.x
- Calls `/info` endpoint on each IP
- Verifies JSON structure matches ESP RGBWW controller
- Extracts controller information

## Files Created/Modified

### New Files

- `src/services/controllerDiscovery.js` - mDNS discovery and controller storage
- `src/pages/ControllerDiscovery.vue` - Controller selection UI
- `ANDROID_BUILD.md` - This documentation

### Modified Files

- `src/App.vue` - Added native app detection and discovery redirect
- `src/router/routes.js` - Added `/discovery` route
- `src/stores/storeConstants.js` - Added deprecation note

## Testing

### Test on Desktop (Development)

```bash
npm run dev
```

The app uses `192.168.29.31` as the default controller in development mode.

### Test Discovery Page

Navigate to: http://localhost:9000/#/discovery

### Test on Android Device

1. Build and install APK
2. Connect device to same WiFi as ESP32 controllers
3. Launch app
4. Should show discovery page if no controller configured
5. Select a controller from the list
6. Should connect and show main interface

## Troubleshooting

### mDNS Discovery Not Working

- **Check WiFi**: Device must be on same network as controllers
- **Check Permissions**: Ensure `CHANGE_WIFI_MULTICAST_STATE` permission is granted
- **Network Security**: Some networks block multicast (corporate/guest WiFi)
- **Fallback Works**: App automatically falls back to IP scanning

### Controllers Not Found

- **Verify ESP32**: Check controller is advertising mDNS service
- **Network Isolation**: Some routers isolate wireless clients
- **Firewall**: Check firewall isn't blocking HTTP traffic
- **Manual Entry**: Use the "Manual Entry" button to enter IP directly

### APK Build Fails

- **Android Studio**: Ensure Android Studio and SDK are properly installed
- **Java Version**: Use JDK 11 or newer
- **Gradle Sync**: Wait for all dependencies to download
- **Clean Build**: Try `./gradlew clean` in android directory

## Development vs Production

### Development (Web)

- Uses `window.location.hostname` or configured dev IP
- No discovery needed when served from controller
- Fast refresh and debugging

### Native App

- Uses native mDNS discovery
- Stores selected controller in device preferences
- Requires network permissions
- Can connect to any controller on network

## CI/CD - Automated APK Builds

### GitHub Actions Workflow

The repository includes `.github/workflows/android-build.yml` that automatically builds Android APKs.

**Triggers:**

- Push to `devel`, `testing`, or `stable` branches
- Pull requests to these branches
- Manual workflow dispatch (with debug/release option)

**Workflow Steps:**

1. Checkout code
2. Setup Node.js 20, Java 17, and Android SDK
3. Install dependencies
4. Build Quasar app for Capacitor
5. Sync Capacitor files
6. Build Android APK (debug or release)
7. Upload APK as artifact

**Artifacts:**

- Debug APKs: Retained for 30 days
- Release APKs: Retained for 90 days
- Named: `lightinator-{type}-{commit-sha}`

### Manual Workflow Dispatch

To manually trigger a build:

1. Go to **Actions** tab in GitHub
2. Select **Build Android APK** workflow
3. Click **Run workflow**
4. Choose branch and build type (debug/release)
5. Click **Run workflow**

After build completes:

- Download APK from **Artifacts** section
- Install on Android device
- Test the app

### Debug vs Release Builds

**Debug Builds (Testing/Sideloading):**

- ✅ **No signing keys needed** - automatically signed with debug key
- ✅ Perfect for testing and development
- ✅ Can be sideloaded directly to devices
- ✅ Faster builds
- ❌ Cannot be uploaded to Play Store
- ❌ Some features may behave differently

**Release Builds (Play Store Distribution):**

- Requires proper signing key
- Optimized and minified code
- Required for Play Store submission
- Only needed when ready to publish

### For Testing (No Signing Needed)

Just use debug builds:

```bash
# Local build
npx quasar build -m capacitor -T android
cd android && ./gradlew assembleDebug

# Or use GitHub Actions workflow (defaults to debug)
```

Install the debug APK by:

1. Enable "Install from Unknown Sources" on Android device
2. Transfer APK via USB, cloud, or download from GitHub Actions
3. Open APK file and install

### Setting Up Release Builds (Only for Play Store)

**⚠️ Skip this section if you only want to test the app!**

For signed release builds (required for Play Store), add these secrets to your GitHub repository:

1. Generate a signing key:

   ```bash
   keytool -genkey -v -keystore release.keystore -alias lightinator \
     -keyalg RSA -keysize 2048 -validity 10000
   ```

2. Encode keystore to base64:

   ```bash
   base64 release.keystore > release.keystore.base64
   ```

3. Go to **Settings → Secrets and variables → Actions** and add:
   - `ANDROID_SIGNING_KEY_ALIAS`: Your keystore alias (e.g., "lightinator")
   - `ANDROID_SIGNING_KEY_PASSWORD`: Key password
   - `ANDROID_SIGNING_STORE_PASSWORD`: Keystore password
   - `ANDROID_SIGNING_KEYSTORE`: Base64 encoded keystore content

4. Update `android/app/build.gradle` with signing configuration

### First Time Setup

The workflow checks if Capacitor is configured. If not:

```bash
# On your machine or in a separate setup workflow
npx quasar mode add capacitor
git add src-capacitor/ capacitor.config.json
git commit -m "Add Capacitor configuration for Android builds"
git push
```

## Next Steps

1. **Run initial Capacitor setup** (`npx quasar mode add capacitor`)
2. Add app icon and splash screen
3. Configure signing key for release builds
4. Test on multiple Android versions
5. Add controller health monitoring
6. Implement reconnection logic
7. Add multiple controller management
8. Test on different network types (WiFi, mobile hotspot, etc.)

## Resources

- [Capacitor Documentation](https://capacitorjs.com/)
- [Quasar Capacitor Integration](https://quasar.dev/quasar-cli-vite/developing-capacitor-apps/introduction)
- [Android Developer Guide](https://developer.android.com/)
- [mDNS/Zeroconf](https://www.npmjs.com/package/@devioarts/capacitor-mdns)
