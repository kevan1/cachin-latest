import { useCallback } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SHEET_BACKGROUND = '#1C1C1E';
const TOP_FADE_HEIGHT = 56;
const BOTTOM_FADE_HEIGHT = 132;

const POLICY_SECTIONS = [
  {
    title: '1. About the Platform',
    body: [
      'Cachin provides digital wallet, payments, and account tools that help users manage supported financial services from a mobile application.',
      'This sample Privacy Policy explains the types of information we may collect, how we may use it, and the choices available to you when you use Cachin.',
    ],
  },
  {
    title: '2. Information We Collect',
    body: [
      'We may collect account information such as your name, username, email address, phone number, wallet address, and authentication details.',
      'We may also collect transaction details, device information, approximate location, support messages, app diagnostics, and usage activity needed to provide and improve the service.',
    ],
  },
  {
    title: '3. How We Use Information',
    body: [
      'We use information to create and secure your account, process transactions, show balances, prevent fraud, provide support, and improve app reliability.',
      'We may use limited information to send important service notices, security alerts, and updates about changes to the app or your account.',
    ],
  },
  {
    title: '4. Sharing Information',
    body: [
      'We may share information with service providers that help us operate Cachin, including hosting, identity verification, analytics, customer support, payments, and compliance partners.',
      'We do not sell your personal information. We may disclose information when required by law, to protect users, or to respond to valid legal requests.',
    ],
  },
  {
    title: '5. Security',
    body: [
      'We use administrative, technical, and organizational safeguards designed to protect personal information. No method of transmission or storage is completely secure.',
      'You are responsible for keeping your device, account credentials, passkeys, and recovery methods secure.',
    ],
  },
  {
    title: '6. Your Choices',
    body: [
      'You may update account details, manage notification settings, request support, or ask us to review, correct, or delete eligible personal information.',
      'Some information may be retained when needed for security, fraud prevention, legal compliance, transaction records, or legitimate business purposes.',
    ],
  },
  {
    title: '7. Contact',
    body: [
      'If you have questions about this sample Privacy Policy or how Cachin handles information, contact support from the Profile screen.',
      'This text is placeholder policy content and should be replaced with the final reviewed privacy policy before production release.',
    ],
  },
];

export default function PrivacyPolicyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const closeSheet = useCallback(() => {
    if (process.env.EXPO_OS === 'ios') {
      void Haptics.selectionAsync();
    }
    router.back();
  }, [router]);

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom: Math.max(insets.bottom, 0) + 132,
          },
        ]}
      >
        <Text
          selectable
          maxFontSizeMultiplier={1.05}
          style={styles.contentTitle}
        >
          Privacy Policy
        </Text>

        <Text selectable maxFontSizeMultiplier={1.05} style={styles.intro}>
          Cachin is committed to protecting the privacy of its users. This sample
          Privacy Policy describes how information may be collected, used, shared,
          and protected when you access the Cachin mobile application, website,
          dashboards, APIs, or related digital services.
        </Text>

        <Text selectable maxFontSizeMultiplier={1.05} style={styles.paragraph}>
          This Privacy Policy outlines the types of information we collect, how we
          use and share it, and the rights you have. By using Cachin, you
          acknowledge that you have read and understood this Privacy Policy and
          any related terms that apply to the platform.
        </Text>

        {POLICY_SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text selectable maxFontSizeMultiplier={1.05} style={styles.sectionTitle}>
              {section.title.toUpperCase()}
            </Text>
            {section.body.map((paragraph) => (
              <Text
                selectable
                maxFontSizeMultiplier={1.05}
                key={paragraph}
                style={styles.paragraph}
              >
                {paragraph}
              </Text>
            ))}
          </View>
        ))}
      </ScrollView>

      <LinearGradient
        pointerEvents="none"
        colors={[
          SHEET_BACKGROUND,
          'rgba(28,28,30,0.96)',
          'rgba(28,28,30,0.78)',
          'rgba(28,28,30,0)',
        ]}
        locations={[0, 0.46, 0.72, 1]}
        style={styles.topFade}
      />

      <LinearGradient
        pointerEvents="none"
        colors={['rgba(28,28,30,0)', 'rgba(28,28,30,0.78)', SHEET_BACKGROUND]}
        locations={[0, 0.48, 1]}
        style={[
          styles.bottomFade,
          {
            height: Math.max(insets.bottom, 0) + BOTTOM_FADE_HEIGHT,
          },
        ]}
      />

      <View
        pointerEvents="box-none"
        style={styles.header}
      >
        <Text numberOfLines={1} maxFontSizeMultiplier={1.05} style={styles.title}>
          Privacy Policy
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close Privacy Policy"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={closeSheet}
          style={({ pressed }) => [
            styles.closeButton,
            pressed ? styles.closeButtonPressed : null,
          ]}
        >
          <SymbolView
            name="xmark"
            fallback={<Text style={styles.closeFallback}>X</Text>}
            resizeMode="scaleAspectFit"
            scale="large"
            size={21}
            tintColor="#FFFFFF"
            weight="semibold"
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: SHEET_BACKGROUND,
  },
  scrollView: {
    flex: 1,
    backgroundColor: SHEET_BACKGROUND,
  },
  content: {
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  contentTitle: {
    marginBottom: 16,
    color: '#FFFFFF',
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    letterSpacing: 0,
  },
  intro: {
    color: 'rgba(255,255,255,0.63)',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    letterSpacing: 0,
  },
  paragraph: {
    marginTop: 22,
    color: 'rgba(255,255,255,0.63)',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    letterSpacing: 0,
  },
  section: {
    paddingTop: 4,
  },
  sectionTitle: {
    marginTop: 28,
    color: 'rgba(255,255,255,0.82)',
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '800',
    letterSpacing: 0,
  },
  topFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: TOP_FADE_HEIGHT,
  },
  bottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    minHeight: 110,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 32,
    paddingHorizontal: 20,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '700',
    letterSpacing: 0,
    textAlign: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 20,
    right: 30,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  closeButtonPressed: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    transform: [{ scale: 0.96 }],
  },
  closeFallback: {
    color: '#FFFFFF',
    fontSize: 19,
    lineHeight: 21,
    fontWeight: '700',
  },
});
