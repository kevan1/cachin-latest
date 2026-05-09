import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import {
  Alert,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassView } from "@/components/ui/GlassView";
import { IconSymbol } from "@/components/ui/icon-symbol";
import {
  loadCardSetupCompleted,
  saveCardSetupCompleted,
} from "@/utils/cardSetupStorage";
import { formatStableValue } from "@/utils/numberFormat";

const REFRESH_DELAY_MS = 950;
const DEFAULT_CARD_BALANCE = 126.78;

type Benefit = {
  icon: ComponentProps<typeof MaterialIcons>["name"];
  title: string;
  description: string;
};

type ActionPill = {
  icon: ComponentProps<typeof MaterialIcons>["name"];
  label: string;
  onPress: () => void;
  primary?: boolean;
};

type CardTransaction = {
  id: string;
  merchant: string;
  date: string;
  amount: string;
  icon: ComponentProps<typeof MaterialIcons>["name"];
  avatarText?: string;
  avatarBackground: string;
  avatarColor: string;
};

const BENEFITS: Benefit[] = [
  {
    icon: "security",
    title: "Your keys, your funds",
    description:
      "Spend with USDC while staying self-custodial. Cachin never takes custody of your balance.",
  },
  {
    icon: "swap-horiz",
    title: "Top up directly from your wallet",
    description:
      "Move funds from savings to spending in seconds with no bank dependency.",
  },
  {
    icon: "tune",
    title: "Full control in-app",
    description:
      "Set limits, pause your card, and track every payment in real time.",
  },
];

const RECENT_TRANSACTIONS: CardTransaction[] = [
  {
    id: "higgsfield",
    merchant: "Higgsfield Inc.",
    date: "07 Mar 2026",
    amount: "-$49.00",
    icon: "gesture",
    avatarBackground: "#CFFF18",
    avatarColor: "#101010",
  },
  {
    id: "chatgpt",
    merchant: "Chat GPT",
    date: "01 Mar 2026",
    amount: "-$20.00",
    icon: "all-inclusive",
    avatarBackground: "#151515",
    avatarColor: "#F5F5F5",
  },
  {
    id: "aws",
    merchant: "AWS",
    date: "25 Mar 2026",
    amount: "-$60.00",
    icon: "cloud",
    avatarText: "aws",
    avatarBackground: "#061C2D",
    avatarColor: "#FFFFFF",
  },
  {
    id: "spotify",
    merchant: "Spotify",
    date: "19 Mar 2026",
    amount: "-$12.99",
    icon: "music-note",
    avatarBackground: "#143D22",
    avatarColor: "#4ADE80",
  },
];

export default function CardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isIOS = process.env.EXPO_OS === "ios";
  const [refreshing, setRefreshing] = useState(false);
  const [isCardConfigured, setIsCardConfigured] = useState(false);
  const [setupStateLoaded, setSetupStateLoaded] = useState(false);
  const [showSettingsSheet, setShowSettingsSheet] = useState(false);
  const [isFrozen, setIsFrozen] = useState(false);
  const [balance, setBalance] = useState(DEFAULT_CARD_BALANCE);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current !== null) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  const syncCardSetupState = useCallback(async () => {
    const completed = await loadCardSetupCompleted();
    setIsCardConfigured(completed);
    setSetupStateLoaded(true);

    if (!completed) {
      setShowSettingsSheet(false);
      setIsFrozen(false);
      setBalance(DEFAULT_CARD_BALANCE);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void syncCardSetupState();
      return undefined;
    }, [syncCardSetupState]),
  );

  const balanceParts = useMemo(() => {
    const [whole, cents = "00"] = formatStableValue(balance, {
      context: "detailed",
    }).split(".");

    return { whole, cents };
  }, [balance]);

  const handleRefresh = useCallback(() => {
    if (refreshTimeoutRef.current !== null) {
      clearTimeout(refreshTimeoutRef.current);
    }

    setRefreshing(true);
    refreshTimeoutRef.current = setTimeout(() => {
      setRefreshing(false);
      refreshTimeoutRef.current = null;
    }, REFRESH_DELAY_MS);
  }, []);

  const handleWaitlistPress = useCallback(() => {
    Alert.alert(
      "Waitlist",
      "We'll notify you as soon as access to Cachin Card opens up.",
    );
  }, []);

  const handleExistingCardPress = useCallback(() => {
    router.push("/card-setup-onboarding");
  }, [router]);

  const handleTopUp = useCallback(() => {
    setBalance((previous) => previous + 50);
    Alert.alert("Top up complete", "$50.00 was added to your card balance.");
  }, []);

  const handleToggleFreeze = useCallback(() => {
    setIsFrozen((previous) => {
      const next = !previous;
      Alert.alert(
        next ? "Card frozen" : "Card unfrozen",
        next
          ? "Your card is now frozen and cannot be used until you unfreeze it."
          : "Your card can now be used normally.",
      );
      return next;
    });
  }, []);

  const handleOpenSettings = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowSettingsSheet(true);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setShowSettingsSheet(false);
  }, []);

  const handleLimitsPress = useCallback(() => {
    Alert.alert("Card limits", "Daily use limit is set to $500.00.");
  }, []);

  const handleProfilePress = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.navigate("/profile");
  }, [router]);

  const handleTransactionPress = useCallback((transaction: CardTransaction) => {
    Alert.alert(transaction.merchant, `${transaction.date}\n${transaction.amount}`);
  }, []);

  const handleRemoveCard = useCallback(() => {
    Alert.alert(
      "Remove card",
      "This will unlink the card and restart setup from the beginning.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            void (async () => {
              await saveCardSetupCompleted(false);
              setIsCardConfigured(false);
              setShowSettingsSheet(false);
              setIsFrozen(false);
              setBalance(DEFAULT_CARD_BALANCE);
            })();
          },
        },
      ],
    );
  }, []);

  const handleChangePin = useCallback(() => {
    setShowSettingsSheet(false);
    router.push("/card-setup-onboarding");
  }, [router]);

  const handleDisableBiometrics = useCallback(() => {
    Alert.alert("Biometrics disabled", "You can re-enable this during card setup.");
  }, []);

  const actionPills = useMemo<ActionPill[]>(
    () => [
      {
        icon: "add",
        label: "Top up",
        onPress: handleTopUp,
        primary: true,
      },
      {
        icon: "credit-card",
        label: "Card Details",
        onPress: handleOpenSettings,
      },
      {
        icon: isFrozen ? "lock-open" : "lock-outline",
        label: isFrozen ? "Unfreeze" : "Freeze",
        onPress: handleToggleFreeze,
      },
      {
        icon: "tune",
        label: "Limits",
        onPress: handleLimitsPress,
      },
    ],
    [
      handleLimitsPress,
      handleOpenSettings,
      handleToggleFreeze,
      handleTopUp,
      isFrozen,
    ],
  );

  if (!setupStateLoaded) {
    return <View style={styles.screen} />;
  }

  return (
    <View style={styles.screen}>
      {isCardConfigured ? (
        <View
          pointerEvents="box-none"
          style={[
            styles.fixedHeader,
            { paddingTop: Math.max(insets.top + 6, 6) },
          ]}
        >
          <TouchableOpacity
            style={styles.headerIconHit}
            activeOpacity={0.85}
            onPress={handleProfilePress}
          >
            <GlassView
              style={[
                styles.headerIconButton,
                isIOS ? styles.headerIconButtonIos : null,
              ]}
              intensity={isIOS ? 16 : 30}
              interactive
            >
              <IconSymbol
                name="person.crop.circle"
                size={24}
                color="rgba(0,0,0,0.72)"
              />
            </GlassView>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerIconHit}
            activeOpacity={0.85}
            onPress={handleOpenSettings}
          >
            <GlassView
              style={[
                styles.headerIconButton,
                isIOS ? styles.headerIconButtonIos : null,
              ]}
              intensity={isIOS ? 16 : 30}
              interactive
            >
              <IconSymbol
                name="creditcard"
                size={23}
                color="rgba(0,0,0,0.72)"
              />
            </GlassView>
          </TouchableOpacity>
        </View>
      ) : null}

      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.contentContainer,
          {
            paddingTop: isCardConfigured
              ? Math.max(insets.top + 64, 76)
              : Math.max(insets.top + 10, 34),
            paddingBottom: Math.max(insets.bottom + 108, 136),
          },
        ]}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#D1D5DB"
            progressBackgroundColor="#111111"
          />
        }
      >
        {isCardConfigured ? (
          <>
            <View style={styles.balanceHero}>
              <Text style={styles.balanceLabel}>Your Card Balance</Text>
              <Text style={styles.balanceValue} selectable>
                {balanceParts.whole}
                <Text style={styles.balanceCents}>.{balanceParts.cents}</Text>
              </Text>
            </View>

            <LinearGradient
              colors={["#1B1B1B", "#090909", "#000000"]}
              locations={[0, 0.48, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cardMock}
            >
              <View style={styles.cardFacetLeft} />
              <View style={styles.cardFacetCenter} />
              <View style={styles.cardFacetRight} />
              <View style={styles.cardMockBorder} />

              <View style={styles.cardMockTop}>
                <View>
                  <Text style={styles.visaText}>VISA</Text>
                  <Text style={styles.platinumText}>Platinum</Text>
                </View>
                <Image
                  source={require("@/assets/images/logomark.png")}
                  resizeMode="contain"
                  style={styles.cardLogomark}
                />
              </View>

              <View style={styles.cardMockBottom}>
                <Text style={styles.cardUseText}>DAILY USE | ** 1292</Text>
                {isFrozen ? (
                  <View style={styles.frozenBadge}>
                    <Text style={styles.frozenBadgeText}>Frozen</Text>
                  </View>
                ) : null}
              </View>
            </LinearGradient>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.actionRail}
            >
              {actionPills.map((action) => (
                <Pressable
                  key={action.label}
                  style={[
                    styles.actionPill,
                    action.primary ? styles.actionPillPrimary : null,
                  ]}
                  onPress={action.onPress}
                >
                  <MaterialIcons
                    name={action.icon}
                    size={18}
                    color={action.primary ? "#FFFFFF" : "#F3F5F8"}
                  />
                  <Text
                    style={[
                      styles.actionPillText,
                      action.primary ? styles.actionPillPrimaryText : null,
                    ]}
                  >
                    {action.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <View style={styles.transactionsSection}>
              <Text style={styles.sectionTitle}>Recent Transactions</Text>

              <View style={styles.transactionList}>
                {RECENT_TRANSACTIONS.map((transaction) => (
                  <Pressable
                    key={transaction.id}
                    style={styles.transactionRow}
                    onPress={() => handleTransactionPress(transaction)}
                  >
                    <View
                      style={[
                        styles.transactionAvatar,
                        { backgroundColor: transaction.avatarBackground },
                      ]}
                    >
                      {transaction.avatarText ? (
                        <Text
                          style={[
                            styles.transactionAvatarText,
                            { color: transaction.avatarColor },
                          ]}
                        >
                          {transaction.avatarText}
                        </Text>
                      ) : (
                        <MaterialIcons
                          name={transaction.icon}
                          size={23}
                          color={transaction.avatarColor}
                        />
                      )}
                    </View>

                    <View style={styles.transactionBody}>
                      <Text style={styles.transactionMerchant}>{transaction.merchant}</Text>
                      <Text style={styles.transactionDate}>{transaction.date}</Text>
                    </View>

                    <Text style={styles.transactionAmount}>{transaction.amount}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </>
        ) : (
          <View style={styles.waitlistContent}>
            <LinearGradient
              colors={["#111315", "#1B1E22", "#0A0B0C"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.waitlistCardPreview}
            >
              <Image
                source={require("@/assets/images/logomark.png")}
                resizeMode="contain"
                style={styles.waitlistCardLogo}
              />
              <Text style={styles.waitlistCardText}>CACHIN CARD</Text>
            </LinearGradient>

            <Text style={styles.title}>You&apos;re on the waitlist</Text>
            <Text style={styles.subtitle}>
              Get early access to a self-custody card experience powered by your
              USDC. You spend from your wallet and keep full control of your funds.
            </Text>

            <View style={styles.benefitsList}>
              {BENEFITS.map((benefit) => (
                <View key={benefit.title} style={styles.benefitItem}>
                  <View style={styles.benefitIconWrap}>
                    <MaterialIcons name={benefit.icon} size={22} color="#F4F4F5" />
                  </View>
                  <View style={styles.benefitTextWrap}>
                    <Text style={styles.benefitTitle}>{benefit.title}</Text>
                    <Text style={styles.benefitDescription}>
                      {benefit.description}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.buttonStack}>
              <Pressable style={styles.primaryButton} onPress={handleWaitlistPress}>
                <Text style={styles.primaryButtonText}>Join to the waitlist!</Text>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={handleExistingCardPress}>
                <Text style={styles.secondaryButtonText}>I already have a card</Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>

      {isCardConfigured && showSettingsSheet ? (
        <View style={styles.settingsOverlay}>
          <Pressable style={styles.settingsScrim} onPress={handleCloseSettings} />
          <View
            style={[
              styles.settingsSheet,
              { paddingBottom: Math.max(insets.bottom + 10, 20) },
            ]}
          >
            <View style={styles.settingsSheetHeader}>
              <Text style={styles.settingsSheetTitle}>Card Details</Text>
              <Pressable style={styles.settingsSheetClose} onPress={handleCloseSettings}>
                <MaterialIcons name="close" size={18} color="#AEB8C9" />
              </Pressable>
            </View>

            <View style={styles.cardDetailSummary}>
              <Text style={styles.cardDetailLabel}>Daily use card</Text>
              <Text style={styles.cardDetailValue}>VISA Platinum •• 1292</Text>
            </View>

            <Pressable style={styles.settingsRow} onPress={handleToggleFreeze}>
              <View style={styles.settingsIconWrap}>
                <MaterialIcons
                  name={isFrozen ? "lock-open" : "lock-outline"}
                  size={18}
                  color="#F4F7FC"
                />
              </View>
              <View style={styles.settingsTextWrap}>
                <Text style={styles.settingsRowTitle}>
                  {isFrozen ? "Unfreeze card" : "Freeze card"}
                </Text>
                <Text style={styles.settingsRowSubtitle}>
                  {isFrozen
                    ? "Allow new payments from this card"
                    : "Block new payments until you unfreeze"}
                </Text>
              </View>
            </Pressable>

            <Pressable style={styles.settingsRow} onPress={handleChangePin}>
              <View style={styles.settingsIconWrap}>
                <MaterialIcons name="dialpad" size={18} color="#F4F7FC" />
              </View>
              <View style={styles.settingsTextWrap}>
                <Text style={styles.settingsRowTitle}>Change PIN</Text>
                <Text style={styles.settingsRowSubtitle}>
                  Restart flow to set a new card PIN
                </Text>
              </View>
            </Pressable>

            <Pressable style={styles.settingsRow} onPress={handleDisableBiometrics}>
              <View style={styles.settingsIconWrap}>
                <MaterialIcons name="fingerprint" size={18} color="#F4F7FC" />
              </View>
              <View style={styles.settingsTextWrap}>
                <Text style={styles.settingsRowTitle}>Disable biometrics</Text>
                <Text style={styles.settingsRowSubtitle}>
                  Require PIN for transaction approvals
                </Text>
              </View>
            </Pressable>

            <Pressable style={styles.settingsRow} onPress={handleRemoveCard}>
              <View style={styles.settingsIconWrap}>
                <MaterialIcons name="close" size={18} color="#F4F7FC" />
              </View>
              <View style={styles.settingsTextWrap}>
                <Text style={styles.settingsRowTitle}>Remove card</Text>
                <Text style={styles.settingsRowSubtitle}>
                  Restart onboarding from the beginning
                </Text>
              </View>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const appFont = Platform.select({
  ios: "System",
  android: "sans-serif",
  default: "System",
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#111111",
  },
  container: {
    flex: 1,
    backgroundColor: "#111111",
  },
  contentContainer: {
    paddingHorizontal: 15,
  },
  fixedHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
    zIndex: 20,
  },
  headerIconHit: {
    borderRadius: 999,
  },
  headerIconButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: "rgba(255,255,255,0.18)",
    boxShadow: "0 10px 22px rgba(0, 0, 0, 0.28)",
  },
  headerIconButtonIos: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderColor: "rgba(255,255,255,0.24)",
  },
  balanceHero: {
    alignItems: "center",
    paddingTop: 4,
    paddingBottom: 22,
  },
  balanceLabel: {
    color: "#787D86",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    fontFamily: appFont,
  },
  balanceValue: {
    marginTop: 6,
    color: "#FFFFFF",
    fontSize: 44,
    lineHeight: 50,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
    fontFamily: appFont,
  },
  balanceCents: {
    color: "rgba(255,255,255,0.28)",
  },
  cardMock: {
    width: "100%",
    aspectRatio: 1.58,
    borderRadius: 15,
    overflow: "hidden",
    padding: 18,
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    boxShadow: "0 14px 26px rgba(0, 0, 0, 0.38)",
  },
  cardMockBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  cardFacetLeft: {
    position: "absolute",
    left: -42,
    top: -18,
    width: "54%",
    height: "132%",
    backgroundColor: "rgba(255,255,255,0.04)",
    transform: [{ rotate: "45deg" }],
  },
  cardFacetCenter: {
    position: "absolute",
    left: "20%",
    top: "22%",
    width: "52%",
    height: "82%",
    backgroundColor: "rgba(255,255,255,0.035)",
    transform: [{ rotate: "-34deg" }],
  },
  cardFacetRight: {
    position: "absolute",
    right: -70,
    top: 10,
    width: "70%",
    height: "64%",
    backgroundColor: "rgba(255,255,255,0.025)",
    transform: [{ rotate: "-28deg" }],
  },
  cardMockTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  visaText: {
    color: "rgba(255,255,255,0.36)",
    fontSize: 34,
    lineHeight: 34,
    fontWeight: "900",
    fontStyle: "italic",
    fontFamily: appFont,
  },
  platinumText: {
    marginTop: 2,
    color: "rgba(255,255,255,0.28)",
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "500",
    fontFamily: appFont,
  },
  cardLogomark: {
    width: 34,
    height: 34,
    tintColor: "#FFFFFF",
  },
  cardMockBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  cardUseText: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "800",
    fontFamily: appFont,
  },
  frozenBadge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  frozenBadgeText: {
    color: "#FCA5A5",
    fontSize: 10,
    fontWeight: "800",
    fontFamily: appFont,
  },
  actionRail: {
    paddingTop: 24,
    paddingBottom: 14,
    gap: 8,
  },
  actionPill: {
    height: 42,
    borderRadius: 21,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 15,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  actionPillPrimary: {
    backgroundColor: "#3298FF",
    borderColor: "rgba(255,255,255,0.18)",
  },
  actionPillText: {
    color: "#F3F5F8",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
    fontFamily: appFont,
  },
  actionPillPrimaryText: {
    color: "#FFFFFF",
  },
  transactionsSection: {
    paddingTop: 10,
  },
  sectionTitle: {
    color: "rgba(255,255,255,0.36)",
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
    fontFamily: appFont,
  },
  transactionList: {
    paddingTop: 14,
    gap: 14,
  },
  transactionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 44,
  },
  transactionAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  transactionAvatarText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "800",
    fontFamily: appFont,
  },
  transactionBody: {
    flex: 1,
    gap: 2,
  },
  transactionMerchant: {
    color: "#F6F7F9",
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "800",
    fontFamily: appFont,
  },
  transactionDate: {
    color: "rgba(255,255,255,0.38)",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    fontFamily: appFont,
  },
  transactionAmount: {
    color: "#F6F7F9",
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    fontFamily: appFont,
  },
  waitlistContent: {
    paddingTop: 24,
  },
  waitlistCardPreview: {
    width: "100%",
    aspectRatio: 1.58,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 26,
  },
  waitlistCardLogo: {
    width: 86,
    height: 86,
    tintColor: "#FFFFFF",
  },
  waitlistCardText: {
    color: "#F5F5F5",
    fontSize: 14,
    fontWeight: "800",
    fontFamily: appFont,
  },
  title: {
    fontSize: 25,
    lineHeight: 31,
    fontWeight: "800",
    color: "#F9FAFB",
    fontFamily: appFont,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: "#D1D5DB",
    fontFamily: appFont,
  },
  benefitsList: {
    marginTop: 18,
    gap: 12,
  },
  benefitItem: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  benefitIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    marginTop: 2,
  },
  benefitTextWrap: {
    flex: 1,
    gap: 2,
  },
  benefitTitle: {
    color: "#F5F5F5",
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "700",
    fontFamily: appFont,
  },
  benefitDescription: {
    color: "#BFC5CD",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
    fontFamily: appFont,
  },
  buttonStack: {
    marginTop: 22,
    gap: 9,
  },
  primaryButton: {
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5F5F5",
  },
  primaryButtonText: {
    color: "#171717",
    fontWeight: "800",
    fontSize: 16,
    fontFamily: appFont,
  },
  secondaryButton: {
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.26)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  secondaryButtonText: {
    color: "#E5E7EB",
    fontWeight: "700",
    fontSize: 15,
    fontFamily: appFont,
  },
  settingsOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
  },
  settingsScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  settingsSheet: {
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 22,
    padding: 10,
    backgroundColor: "rgba(20,27,39,0.98)",
    borderWidth: 1,
    borderColor: "rgba(140,150,170,0.24)",
  },
  settingsSheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 42,
    marginBottom: 6,
  },
  settingsSheetTitle: {
    color: "#EEF2F8",
    fontSize: 15,
    fontWeight: "700",
    fontFamily: appFont,
  },
  settingsSheetClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    position: "absolute",
    right: 0,
  },
  cardDetailSummary: {
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(140,150,170,0.18)",
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
  },
  cardDetailLabel: {
    color: "#8D99AE",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    textTransform: "uppercase",
    fontFamily: appFont,
  },
  cardDetailValue: {
    marginTop: 4,
    color: "#EEF2F8",
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "800",
    fontFamily: appFont,
  },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(140,150,170,0.18)",
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 8,
  },
  settingsIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  settingsTextWrap: {
    flex: 1,
  },
  settingsRowTitle: {
    color: "#EEF2F8",
    fontSize: 14,
    fontWeight: "700",
    fontFamily: appFont,
  },
  settingsRowSubtitle: {
    marginTop: 2,
    color: "#8D99AE",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    fontFamily: appFont,
  },
});
