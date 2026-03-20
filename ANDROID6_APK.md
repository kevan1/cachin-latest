# Android 6.0 (API 23) APK Build Notes

Android 6.0 is **API 23**.

This repository is currently on **Expo SDK 55 preview / React Native 0.83**, which requires **minSdkVersion 24** (Android 7.0+). That means the APK **will not install** on an Android 6.0 device.

To support Android 6.0 you must downgrade to an Expo SDK that still supports API 23 (for example **Expo SDK 51**).

## Important Feature Caveat (Android 6)

Even if the app installs, some features may still not work on Android 6.0:

- **Passkeys**: typically require newer Android / Play Services APIs than Android 6.0.
- Any feature depending on modern system components may be unavailable.

## Steps (Run Locally With Internet Access)

1. Downgrade Expo to SDK 51 and align dependencies:

```sh
npx expo install expo@~51.0.0 --fix
```

2. Regenerate native projects so Gradle settings match the downgraded SDK:

```sh
npx expo prebuild --clean
```

3. Ensure your Android build uses **minSdkVersion 23** (Android 6.0).

Add/update this in `app.json` under the `expo-build-properties` plugin:

```json
[
  "expo-build-properties",
  {
    "android": {
      "minSdkVersion": 23
    }
  }
]
```

4. Build an APK with EAS:

```sh
npx eas-cli login
npm run build:apk
```

EAS will output a build URL; download the `.apk` from there.

