import { useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { usePrivy } from '@privy-io/expo';
import { PrivyUser } from '@privy-io/public-api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { useToast } from 'react-native-pretty-toast';

import { GeneratedProfileAvatar } from '@/components/profile/GeneratedProfileAvatar';

const SHEET_BACKGROUND = '#1C1C1E';
const TOP_FADE_HEIGHT = 56;
const PROFILE_AVATAR_SIZE = 86;

type LinkedAccountLike = {
  type?: string;
  address?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  phone_number?: string | null;
  number?: string | null;
};

type MetadataRecord = Record<string, unknown>;

type AccountDetailsUser = PrivyUser & {
  linkedAccounts?: LinkedAccountLike[];
  linked_accounts?: LinkedAccountLike[];
  email?: string | { address?: string | null } | null;
  phoneNumber?: string | null;
  phone_number?: string | null;
  custom_metadata?: MetadataRecord;
  customMetadata?: MetadataRecord;
  firstName?: string | null;
  first_name?: string | null;
  lastName?: string | null;
  last_name?: string | null;
  name?: string | null;
};

function normalizeText(value: unknown) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const normalized = normalizeText(value);
    if (normalized) return normalized;
  }

  return null;
}

function getLinkedAccounts(user: AccountDetailsUser | null | undefined) {
  const linkedAccounts = user?.linkedAccounts ?? user?.linked_accounts;
  return Array.isArray(linkedAccounts) ? linkedAccounts : [];
}

function getMetadata(user: AccountDetailsUser | null | undefined) {
  const metadata = user?.custom_metadata ?? user?.customMetadata;
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? metadata
    : {};
}

function getEmail(user: AccountDetailsUser | null | undefined) {
  const emailAccount = getLinkedAccounts(user).find((account) => account?.type === 'email');
  const rawEmail = user?.email;

  return firstText(
    emailAccount?.address,
    emailAccount?.email,
    typeof rawEmail === 'string' ? rawEmail : rawEmail?.address
  );
}

function getPhone(user: AccountDetailsUser | null | undefined) {
  const phoneAccount = getLinkedAccounts(user).find((account) => account?.type === 'phone');

  return firstText(
    phoneAccount?.phoneNumber,
    phoneAccount?.number,
    phoneAccount?.phone_number,
    phoneAccount?.address,
    user?.phoneNumber,
    user?.phone_number
  );
}

function formatCountry(country: string | null) {
  if (!country) return null;
  return country.length <= 3 ? country.toUpperCase() : country;
}

function buildAddress(metadata: MetadataRecord) {
  const directAddress = firstText(
    metadata.address,
    metadata.legal_address,
    metadata.legalAddress,
    metadata.residential_address,
    metadata.residentialAddress,
    metadata.street_address,
    metadata.streetAddress
  );
  if (directAddress) return directAddress;

  const addressParts = [
    firstText(metadata.address_line_1, metadata.addressLine1, metadata.street),
    firstText(metadata.city, metadata.locality),
    firstText(metadata.state, metadata.region, metadata.province),
    firstText(metadata.postal_code, metadata.postalCode, metadata.zip),
  ].filter(Boolean);

  return addressParts.length > 0 ? addressParts.join(', ') : null;
}

function ReadOnlyRow({
  label,
  value,
  divider,
  horizontal,
}: {
  label: string;
  value?: string | null;
  divider?: boolean;
  horizontal?: boolean;
}) {
  return (
    <View
      style={[
        styles.row,
        !horizontal && value ? styles.tallRow : null,
        divider ? styles.rowDivider : null,
      ]}
    >
      <View style={horizontal ? styles.horizontalRowInner : styles.verticalRowInner}>
        <Text style={styles.rowLabel}>{label}</Text>
        {value ? (
          <Text
            selectable
            numberOfLines={horizontal ? 1 : 2}
            style={[styles.rowValue, horizontal ? styles.horizontalRowValue : null]}
          >
            {value}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export default function AccountDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { user } = usePrivy();
  const profileUser = user as AccountDetailsUser | null;
  const metadata = useMemo(() => getMetadata(profileUser), [profileUser]);

  const firstName = firstText(
    metadata.first_name,
    metadata.firstName,
    metadata.given_name,
    metadata.givenName,
    profileUser?.first_name,
    profileUser?.firstName
  );
  const lastName = firstText(
    metadata.last_name,
    metadata.lastName,
    metadata.family_name,
    metadata.familyName,
    profileUser?.last_name,
    profileUser?.lastName
  );
  const legalName = firstText(
    metadata.legal_name,
    metadata.legalName,
    metadata.full_name,
    metadata.fullName,
    metadata.name,
    profileUser?.name,
    firstName && lastName ? `${firstName} ${lastName}` : null
  );
  const email = getEmail(profileUser);
  const phone = getPhone(profileUser);
  const address = buildAddress(metadata);
  const country = formatCountry(
    firstText(
      metadata.country,
      metadata.country_code,
      metadata.countryCode,
      metadata.nationality
    )
  );

  const handleBack = () => {
    if (process.env.EXPO_OS === 'ios') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.back();
  };

  const handleAvatarChange = () => {
    if (process.env.EXPO_OS === 'ios') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    toast.info('Profile picture update is coming soon.');
  };

  const handleLinkEmail = () => {
    if (process.env.EXPO_OS === 'ios') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push('/link-email');
  };

  return (
    <View collapsable={false} style={styles.screen}>
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom + 42, 72) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.avatarBlock}>
          <GeneratedProfileAvatar size={PROFILE_AVATAR_SIZE} showOuterRing={false} />
          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.84}
            onPress={handleAvatarChange}
            style={styles.changeButton}
          >
            <Text style={styles.changeButtonText}>Change</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <ReadOnlyRow label="First name" value={firstName} />
          <ReadOnlyRow label="Last name" value={lastName} />
          <ReadOnlyRow label="Phone" value={phone} horizontal />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account email</Text>
          <Text style={styles.sectionSubtitle}>
            {email
              ? 'Account email cannot be changed'
              : 'Link an email as an additional sign-in option for this passkey account.'}
          </Text>
          <View style={styles.card}>
            {email ? (
              <ReadOnlyRow label="Email" value={email} horizontal />
            ) : (
              <TouchableOpacity
                accessibilityRole="button"
                activeOpacity={0.84}
                onPress={handleLinkEmail}
                style={styles.linkEmailRow}
              >
                <Text style={styles.rowLabel}>Email</Text>
                <View style={styles.linkEmailAction}>
                  <Text style={styles.linkEmailText}>Add email</Text>
                  <SymbolView
                    name="chevron.right"
                    fallback={<Text style={styles.chevronFallback}>›</Text>}
                    resizeMode="scaleAspectFit"
                    scale="medium"
                    size={16}
                    tintColor="rgba(255,255,255,0.58)"
                    weight="semibold"
                  />
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Identity Details</Text>
          <Text style={styles.sectionSubtitle}>
            Your identity details cannot be changed after verification.
          </Text>
          <View style={styles.card}>
            <ReadOnlyRow label="Legal name" value={legalName?.toUpperCase()} divider />
            <ReadOnlyRow label="Address" value={address} divider />
            <ReadOnlyRow label="Country" value={country} />
          </View>
        </View>

        <Text style={styles.footerText}>
          If you would like to delete your account, please contact support.
        </Text>
      </ScrollView>

      <View collapsable={false} pointerEvents="box-none" style={styles.headerOverlay}>
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

        <Pressable
          collapsable={false}
          accessibilityRole="button"
          accessibilityLabel="Close account details"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={handleBack}
          style={({ pressed }) => [
            styles.backButton,
            pressed ? styles.backButtonPressed : null,
          ]}
        >
          <SymbolView
            name="chevron.left"
            fallback={<Text style={styles.backFallback}>‹</Text>}
            resizeMode="scaleAspectFit"
            scale="large"
            size={28}
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
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 112,
    zIndex: 10,
  },
  topFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: TOP_FADE_HEIGHT,
  },
  backButton: {
    position: 'absolute',
    top: 20,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: '#202020',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 18px 34px rgba(0,0,0,0.28)',
  },
  backButtonPressed: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    transform: [{ scale: 0.96 }],
  },
  backFallback: {
    color: '#FFFFFF',
    fontSize: 38,
    lineHeight: 40,
    fontWeight: '700',
  },
  avatarBlock: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 26,
  },
  changeButton: {
    minHeight: 34,
    marginTop: 14,
    paddingHorizontal: 20,
    borderRadius: 18,
    backgroundColor: '#4A4A4A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  changeButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
    letterSpacing: 0,
  },
  card: {
    overflow: 'hidden',
    borderRadius: 24,
    borderCurve: 'continuous',
    backgroundColor: '#303030',
  },
  row: {
    minHeight: 58,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  tallRow: {
    minHeight: 86,
    paddingVertical: 14,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  horizontalRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 18,
  },
  verticalRowInner: {
    gap: 8,
  },
  rowLabel: {
    color: '#FFFFFF',
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
    letterSpacing: 0,
  },
  rowValue: {
    color: 'rgba(255,255,255,0.46)',
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
    letterSpacing: 0,
  },
  horizontalRowValue: {
    flex: 1,
    textAlign: 'right',
  },
  linkEmailRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 18,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  linkEmailAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  linkEmailText: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
    letterSpacing: 0,
  },
  chevronFallback: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '800',
  },
  section: {
    marginTop: 42,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
    letterSpacing: 0,
    marginBottom: 13,
  },
  sectionSubtitle: {
    color: 'rgba(255,255,255,0.42)',
    fontSize: 17,
    lineHeight: 26,
    fontWeight: '500',
    letterSpacing: 0,
    marginBottom: 26,
  },
  footerText: {
    marginTop: 52,
    color: 'rgba(255,255,255,0.43)',
    fontSize: 17,
    lineHeight: 26,
    fontWeight: '500',
    letterSpacing: 0,
  },
});
