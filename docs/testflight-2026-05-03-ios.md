# TestFlight Build Notes - iOS - 2026-05-03

What to test:

- New Cachin onboarding with the copied bubble visual system, reduced bubble spawn rate, softer image sizing, shimmer "Swipe up to enter" prompt, and updated headline copy.
- Updated profile screen matching the dark reference layout, including generated profile avatar, native-style back navigation, account rows, referral row, and grouped settings sections.
- Added Notification settings screen from Profile with native iOS-style header blur/scroll edge effect, centered Push Notifications toggle, and explanatory copy.
- Added Security screen from Profile with Face ID and Authenticator app rows, native-style header blur/scroll edge effect, and bank-style security layout.
- Added Face ID app lock. When enabled from Security, Cachin requires Face ID when opening the app or returning from background. Canceling keeps the app locked until the user unlocks.
- Added native `expo-local-authentication` support and Face ID permission text for the iOS native build.
- Reduced onboarding bubble/image workload to improve performance on device.
- Updated navigation so Profile rows open Notification settings and Security directly.

Regression checks:

- Login and existing authenticated sessions still route correctly.
- The Security Face ID toggle can enable and disable app lock after biometric confirmation.
- Opening the app with Face ID enabled blocks access until authentication succeeds.
- Returning from background with Face ID enabled re-locks the app.
- Notification settings toggle remains visually centered.
- Profile back button, grouped settings, and screen spacing match the latest references.
