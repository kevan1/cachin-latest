import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Alert, Share } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState, useMemo } from 'react';
import * as Clipboard from 'expo-clipboard';
import { usePrivy } from '@privy-io/expo';
import { getUsername } from '@/utils/userStorage';

export default function InviteScreen() {
  const router = useRouter();
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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Points</Text>
        <View style={{ width: 50 }} />
      </View>

      {/* Points Card */}
      <View style={styles.pointsCard}>
        <Text style={styles.pointsLarge}>{points.toLocaleString()} Points</Text>

        <View style={styles.tierRow}>
          <View style={styles.tierBadge}><Text style={styles.tierBadgeText}>1</Text></View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
          <View style={[styles.tierBadge, styles.tierBadgeMuted]}><Text style={styles.tierBadgeText}>2</Text></View>
        </View>

        <Text style={styles.tierText}>You&apos;re at tier 1.</Text>
        <Text style={styles.subText}>{pointsToNextTier.toLocaleString()} points needed to level up</Text>
      </View>

      {/* Invite banner */}
      <Text style={styles.bannerText}>
        Invite friends and get 20% of their points.
      </Text>

      {/* Invite code */}
      <Text style={styles.sectionTitle}>Invite friends with your code</Text>
      <TouchableOpacity style={styles.codeBox} onPress={handleCopyCode} activeOpacity={0.8}>
        <Text style={styles.codeText}>{inviteCode}</Text>
        <Text style={styles.copyIcon}>📋</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
        <Text style={styles.shareButtonIcon}>⬆</Text>
        <Text style={styles.shareButtonText}>Share Invite link</Text>
      </TouchableOpacity>

      {/* People invited */}
      <Text style={styles.sectionTitle}>People you invited</Text>
      <View style={styles.invitedList}>
        {[{name:'pepe', pts:'+20 pts'}, {name:'lockfryer', pts:'+20 pts'}].map((p, i) => (
          <View key={i} style={styles.invitedItem}>
            <View style={[styles.invitedAvatar, { backgroundColor: i === 0 ? '#D8D5FF' : '#FFD0D0' }]}>
              <Text style={styles.invitedAvatarText}>{p.name.slice(0,2).toUpperCase()}</Text>
            </View>
            <Text style={styles.invitedName}>{p.name} 💞</Text>
            <Text style={styles.invitedPts}>{p.pts}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5EDE7',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  backButton: {
    width: 50,
    height: 50,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: '#000000',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1F2A44',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  pointsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 20,
    marginBottom: 16,
  },
  pointsLarge: {
    fontSize: 36,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 10,
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
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#FFECE0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tierBadgeMuted: {
    backgroundColor: '#F3F4F6',
  },
  tierBadgeText: {
    fontSize: 18,
    fontWeight: '800',
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
    backgroundColor: '#E87AD0',
  },
  tierText: {
    fontSize: 18,
    textAlign: 'center',
    color: '#374151',
    marginTop: 6,
  },
  subText: {
    fontSize: 14,
    textAlign: 'center',
    color: '#6B7280',
    marginTop: 4,
  },
  bannerText: {
    fontSize: 16,
    color: '#111827',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
  },
  codeBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  codeText: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
  },
  copyIcon: {
    fontSize: 18,
  },
  shareButton: {
    backgroundColor: '#FF86D2',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
    boxShadow: '3px 3px 0px rgba(0, 0, 0, 1)',
  },
  shareButtonIcon: {
    fontSize: 18,
  },
  shareButtonText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  invitedList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
    overflow: 'hidden',
  },
  invitedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
  },
  invitedAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#000',
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
    color: '#111827',
    marginLeft: 12,
  },
  invitedPts: {
    fontSize: 16,
    color: '#374151',
  },
});
