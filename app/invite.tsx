import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Share,
  useColorScheme,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState, useMemo } from 'react';
import * as Clipboard from 'expo-clipboard';
import { usePrivy } from '@privy-io/expo';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { getUsername } from '@/utils/userStorage';
import { Colors } from '@/constants/theme';
import { GlassView } from '@/components/ui/GlassView';
import { formatAmount } from '@/utils/formatAmount';

export default function InviteScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const cardBorder = colorScheme === 'dark' ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.52)';
  const { user } = usePrivy();
  const [username, setUsername] = useState<string>('User');
  const [points] = useState<number>(2693);

  useEffect(() => {
    const rawUser = user as {
      linkedAccounts?: {
        type?: string;
        chainType?: string;
        chain_type?: string;
        address?: string | null;
      }[];
      linked_accounts?: {
        type?: string;
        chainType?: string;
        chain_type?: string;
        address?: string | null;
      }[];
    } | null;

    const linkedAccounts = rawUser?.linkedAccounts ?? rawUser?.linked_accounts ?? [];
    const solanaAccount = linkedAccounts.find(
      (account) =>
        account?.type === 'wallet' &&
        (account.chainType === 'solana' || account.chain_type === 'solana')
    );
    const solanaAddress = solanaAccount?.address?.trim() || undefined;

    const load = async () => {
      const stored = await getUsername(solanaAddress);
      if (stored && !stored.startsWith('user-')) setUsername(stored);
    };
    void load();
  }, [user]);

  const inviteCode = useMemo(() => {
    const base = (username || 'USER').toUpperCase();
    const hash = base.split('').reduce((s, c) => s + c.charCodeAt(0), 0) % 1000;
    return `${base}INVITESYOU${hash.toString().padStart(3, '0')}`;
  }, [username]);

  const handleCopyCode = async () => {
    await Clipboard.setStringAsync(inviteCode);
    Alert.alert('Copied', 'Invite code copied to clipboard');
  };

  const handleShare = async () => {
    try {
      const message = `Join ¢a¢hito with my code ${inviteCode}`;
      await Share.share({ message });
    } catch {
      // ignore
    }
  };

  const pointsToNextTier = Math.max(0, 10000 - points); // simple placeholder logic
  const progress = Math.min(1, points / 10000);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButtonPressable} onPress={() => router.back()} activeOpacity={0.78}>
          <GlassView style={[styles.iconButton, { borderColor: cardBorder }]} intensity={26} interactive>
            <MaterialIcons name="arrow-back" size={20} color={palette.primaryText} />
          </GlassView>
        </TouchableOpacity>
        <Text style={[styles.title, { color: palette.primaryText }]}>Invite</Text>
        <View style={styles.headerSpacer} />
      </View>

      <GlassView style={[styles.pointsCard, { borderColor: cardBorder }]} intensity={30}>
        <Text style={[styles.pointsLarge, { color: palette.primaryText }]}>
          {formatAmount(points, { maxFractionDigits: 0 })} Points
        </Text>

        <View style={styles.tierRow}>
          <View style={[styles.tierBadge, { backgroundColor: palette.surfaceMuted }]}>
            <Text style={[styles.tierBadgeText, { color: palette.primaryText }]}>1</Text>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: palette.borderSubtle }]}>
            <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: palette.primary }]} />
          </View>
          <View style={[styles.tierBadge, styles.tierBadgeMuted, { backgroundColor: palette.surfaceMuted }]}>
            <Text style={[styles.tierBadgeText, { color: palette.primaryText }]}>2</Text>
          </View>
        </View>

        <Text style={[styles.tierText, { color: palette.primaryText }]}>You&apos;re at tier 1.</Text>
        <Text style={[styles.subText, { color: palette.secondaryText }]}>
          {formatAmount(pointsToNextTier, { maxFractionDigits: 0 })} points needed to level up
        </Text>
      </GlassView>

      <Text style={[styles.bannerText, { color: palette.secondaryText }]}>
        Invite friends and get 20% of their points.
      </Text>

      <Text style={[styles.sectionTitle, { color: palette.primaryText }]}>Invite with your code</Text>
      <TouchableOpacity style={styles.codeBoxPressable} onPress={handleCopyCode} activeOpacity={0.82}>
        <GlassView style={[styles.codeBox, { borderColor: cardBorder }]} intensity={28} interactive>
          <Text style={[styles.codeText, { color: palette.primaryText }]}>{inviteCode}</Text>
          <MaterialIcons name="content-copy" size={18} color={palette.secondaryText} />
        </GlassView>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.shareButton, { backgroundColor: palette.actionPrimary }]}
        onPress={handleShare}
        activeOpacity={0.86}
      >
        <MaterialIcons name="ios-share" size={18} color={palette.actionPrimaryText} />
        <Text style={[styles.shareButtonText, { color: palette.actionPrimaryText }]}>Share invite link</Text>
      </TouchableOpacity>

      <Text style={[styles.sectionTitle, { color: palette.primaryText }]}>People you invited</Text>
      <GlassView style={[styles.invitedList, { borderColor: cardBorder }]} intensity={28}>
        {[{name:'pepe', pts:'+20 pts'}, {name:'lockfryer', pts:'+20 pts'}].map((p, i) => (
          <View key={i} style={styles.invitedItem}>
            <View
              style={[
                styles.invitedAvatar,
                { backgroundColor: i === 0 ? '#D8D5FF' : '#FFD0D0' },
              ]}
            >
              <Text style={styles.invitedAvatarText}>{p.name.slice(0,2).toUpperCase()}</Text>
            </View>
            <Text style={[styles.invitedName, { color: palette.primaryText }]}>{p.name} 💞</Text>
            <Text style={[styles.invitedPts, { color: palette.secondaryText }]}>{p.pts}</Text>
          </View>
        ))}
      </GlassView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  iconButtonPressable: {
    borderRadius: 20,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  headerSpacer: {
    width: 40,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  pointsCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
    marginBottom: 16,
  },
  pointsLarge: {
    fontSize: 36,
    fontWeight: '800',
    marginBottom: 10,
    fontVariant: ['tabular-nums'],
  },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  tierBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tierBadgeMuted: {
    opacity: 0.8,
  },
  tierBadgeText: {
    fontSize: 18,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    flex: 1,
    height: 10,
    backgroundColor: '#E5E7EB',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  tierText: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 6,
  },
  subText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  bannerText: {
    fontSize: 13,
    marginBottom: 16,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
  },
  codeBoxPressable: {
    borderRadius: 14,
    marginBottom: 12,
  },
  codeBox: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  codeText: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  shareButton: {
    borderRadius: 14,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  shareButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  invitedList: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  invitedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(125,125,125,0.16)',
  },
  invitedAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  invitedAvatarText: {
    color: '#111827',
    fontWeight: '800',
  },
  invitedName: {
    flex: 1,
    fontSize: 16,
    marginLeft: 12,
  },
  invitedPts: {
    fontSize: 16,
  },
});
