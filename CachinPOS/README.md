# CachinPOS

Minimal Point-of-Sale app for Cachin.

Goal: enter an amount, generate a **Solana Pay** QR code for **USDC**, and let the main Cachin app scan + pay.

## Android 6.0 Support

Android 6.0 is **API 23**. To run on Android 6.0, this app must be built with `minSdkVersion: 23` and an Expo/RN stack that still supports it (typically Expo SDK ~51).

This folder includes config + code for that target, but installing the exact dependency versions requires network access:

```sh
cd CachinPOS
npx expo install --fix
```

## Run

```sh
cd CachinPOS
npm install
npm start
```

## If You See Missing Native Modules (WebView / SafeArea)

Errors like:
- `RNCWebViewModule could not be found`
- `RNCSafeAreaContext could not be found`

mean you are running an Android binary that was built **before** those native modules were included.

Fix (rebuild the dev client / native project):

```sh
cd CachinPOS
rm -rf node_modules
npm install
npx expo install --fix
npx expo prebuild --clean
npx expo run:android
```

## Build APK (EAS)

```sh
cd CachinPOS
npx eas-cli login
npx eas-cli build -p android --profile apk
```
