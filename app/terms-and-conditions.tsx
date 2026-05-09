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

const TERMS_SECTIONS = [
  {
    title: '1. About These Terms',
    body: [
      'These sample Terms and Conditions describe the rules that apply when you access or use Cachin, including the mobile app, account tools, wallet features, websites, APIs, and related services.',
      'The service is provided for supported users and supported regions only. Some features may be unavailable, limited, or changed depending on eligibility, compliance checks, or third-party provider requirements.',
    ],
  },
  {
    title: '2. Eligibility and Account',
    body: [
      'You are responsible for providing accurate account information and keeping it up to date. We may ask for additional information when needed to verify identity, protect accounts, or comply with legal requirements.',
      'You must keep your device, credentials, passkeys, recovery methods, and wallet access secure. Activity performed through your account may be treated as authorized unless you notify support of a suspected issue.',
    ],
  },
  {
    title: '3. Wallets and Transactions',
    body: [
      'Cachin may help you view balances, initiate transactions, manage supported wallets, and interact with supported payment or blockchain services.',
      'Transactions may be irreversible once submitted. You are responsible for reviewing recipient details, amounts, network fees, and any transaction confirmations before proceeding.',
    ],
  },
  {
    title: '4. User Responsibilities',
    body: [
      'You agree to use Cachin only for lawful purposes and in a way that does not interfere with the app, harm other users, bypass security controls, or violate third-party rights.',
      'You may not use the service for fraud, sanctions evasion, unauthorized access, abusive activity, market manipulation, or any activity prohibited by applicable law.',
    ],
  },
  {
    title: '5. Fees and Third-Party Services',
    body: [
      'Some transactions may include network fees, provider fees, exchange rates, taxes, or other charges shown before confirmation when available.',
      'Cachin may rely on third-party services for identity verification, payments, wallets, analytics, support, infrastructure, and compliance. Their services may be governed by separate terms.',
    ],
  },
  {
    title: '6. Changes, Suspension, and Limits',
    body: [
      'We may update, suspend, limit, or discontinue parts of Cachin when needed for security, maintenance, legal compliance, provider availability, or product changes.',
      'We may update these sample Terms and Conditions from time to time. Continued use of Cachin after changes means you accept the updated terms.',
    ],
  },
  {
    title: '7. Contact',
    body: [
      'If you have questions about these sample Terms and Conditions, contact support from the Profile screen.',
      'This text is placeholder terms content and should be replaced with the final reviewed terms before production release.',
    ],
  },
];

export default function TermsAndConditionsScreen() {
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
          Terms and Conditions
        </Text>

        <Text selectable maxFontSizeMultiplier={1.05} style={styles.intro}>
          These sample Terms and Conditions govern your access to and use of the
          Cachin mobile application, websites, dashboards, APIs, wallet tools,
          and related digital services.
        </Text>

        <Text selectable maxFontSizeMultiplier={1.05} style={styles.paragraph}>
          By using Cachin, you acknowledge that you have read and understood
          these Terms and Conditions and agree to follow the rules that apply to
          the platform, your account, and supported transactions.
        </Text>

        {TERMS_SECTIONS.map((section) => (
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
          Terms and Conditions
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close Terms and Conditions"
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
