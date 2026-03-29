import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
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
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  interpolate,
  useAnimatedRef,
  useAnimatedStyle,
  useScrollOffset,
} from "react-native-reanimated";
import {
  loadCardSetupCompleted,
  saveCardSetupCompleted,
} from "@/utils/cardSetupStorage";

const HEADER_HEIGHT = 292;
const REFRESH_DELAY_MS = 950;
const DEFAULT_CARD_BALANCE = 2430.25;

type Benefit = {
  icon: ComponentProps<typeof MaterialIcons>["name"];
  title: string;
  description: string;
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

export default function CardScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [isCardConfigured, setIsCardConfigured] = useState(false);
  const [setupStateLoaded, setSetupStateLoaded] = useState(false);
  const [showSettingsSheet, setShowSettingsSheet] = useState(false);
  const [isFrozen, setIsFrozen] = useState(false);
  const [balance, setBalance] = useState(DEFAULT_CARD_BALANCE);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollOffset = useScrollOffset(scrollRef);

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

  const headerAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: interpolate(
            scrollOffset.value,
            [-HEADER_HEIGHT, 0, HEADER_HEIGHT],
            [-HEADER_HEIGHT / 2, 0, HEADER_HEIGHT * 0.75],
          ),
        },
        {
          scale: interpolate(
            scrollOffset.value,
            [-HEADER_HEIGHT, 0, HEADER_HEIGHT],
            [1.95, 1, 1],
          ),
        },
      ],
    };
  });

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

  const formattedBalance = useMemo(
    () =>
      `$${balance.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
    [balance],
  );

  const handleTopUp = useCallback(() => {
    setBalance((previous) => previous + 150);
    Alert.alert("Top up complete", "$150.00 was added to your card balance.");
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
    setShowSettingsSheet(true);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setShowSettingsSheet(false);
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
    router.push("/card-setup-onboarding");
  }, [router]);

  const handleDisableBiometrics = useCallback(() => {
    Alert.alert("Biometrics disabled", "You can re-enable this during card setup.");
  }, []);

  if (!setupStateLoaded) {
    return <View style={styles.screen} />;
  }

  return (
    <View style={styles.screen}>
      <Animated.ScrollView
        ref={scrollRef}
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#D1D5DB"
            progressBackgroundColor="#111111"
          />
        }
      >
        <Animated.View style={[styles.header, headerAnimatedStyle]}>
          <LinearGradient
            colors={["#121416", "#1C1F22", "#111215"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerGradient}
          >
            <LinearGradient
              colors={["#A99B7B", "#8E8166", "#6E6451"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.generatedCard}
            >
              <View style={styles.chip} />
              <Image
                source={require("@/assets/images/logomark.png")}
                resizeMode="contain"
                style={styles.logo}
              />
              <View style={styles.cardFooterMark}>
                <View style={styles.footerCircle} />
                <View style={[styles.footerCircle, styles.footerCircleOverlap]} />
              </View>
            </LinearGradient>
            <LinearGradient
              pointerEvents="none"
              colors={["rgba(9,10,11,0)", "rgba(9,10,11,0.78)", "#090A0B"]}
              locations={[0, 0.65, 1]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.headerFade}
            />
          </LinearGradient>
        </Animated.View>

        <View style={styles.body}>
          {isCardConfigured ? (
            <>
              <View style={styles.accountHeaderRow}>
                <Text style={styles.title}>Your card is ready</Text>
                <Pressable style={styles.settingsButton} onPress={handleOpenSettings}>
                  <MaterialIcons name="settings" size={19} color="#F4F4F5" />
                </Pressable>
              </View>
              <Text style={styles.subtitle}>
                Your card works like a prepaid account. Top up from your wallet
                and freeze it instantly whenever needed.
              </Text>

              <View style={styles.accountCard}>
                <View style={styles.accountCardTop}>
                  <Text style={styles.accountCardLabel}>Cachin prepaid</Text>
                  <MaterialIcons name="credit-card" size={22} color="#E9EDF5" />
                </View>
                <Text style={styles.accountCardNumber}>•••• 4821</Text>
                <View style={styles.accountCardBottom}>
                  <Text style={styles.accountCardName}>Main card</Text>
                  <Text
                    style={[
                      styles.accountCardStatus,
                      isFrozen ? styles.accountCardStatusFrozen : null,
                    ]}
                  >
                    {isFrozen ? "Frozen" : "Active"}
                  </Text>
                </View>
              </View>

              <View style={styles.balancePanel}>
                <Text style={styles.balanceLabel}>Card balance</Text>
                <Text style={styles.balanceValue}>{formattedBalance}</Text>
                <View style={styles.balanceActions}>
                  <Pressable style={styles.balanceActionPrimary} onPress={handleTopUp}>
                    <Text style={styles.balanceActionPrimaryText}>Top up</Text>
                  </Pressable>
                  <Pressable style={styles.balanceActionSecondary} onPress={handleToggleFreeze}>
                    <Text style={styles.balanceActionSecondaryText}>
                      {isFrozen ? "Unfreeze" : "Freeze"}
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.cardHint}>
                <Text style={styles.cardHintTitle}>Prepaid account behavior</Text>
                <Text style={styles.cardHintText}>
                  Spend only from available balance. Use settings to manage PIN,
                  biometrics, and card removal.
                </Text>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.title}>You're on the waitlist</Text>
              <Text style={styles.subtitle}>
                Get early access to a self-custody card experience powered by your
                USDC. You spend from your wallet and keep full control of your
                funds.
              </Text>

              <View style={styles.benefitsList}>
                {BENEFITS.map((benefit) => (
                  <View key={benefit.title} style={styles.benefitItem}>
                    <View style={styles.benefitIconWrap}>
                      <MaterialIcons
                        name={benefit.icon}
                        size={22}
                        color="#F4F4F5"
                      />
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
                <Pressable
                  style={styles.secondaryButton}
                  onPress={handleExistingCardPress}
                >
                  <Text style={styles.secondaryButtonText}>I already have a card</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </Animated.ScrollView>

      {isCardConfigured && showSettingsSheet ? (
        <View style={styles.settingsOverlay}>
          <Pressable style={styles.settingsScrim} onPress={handleCloseSettings} />
          <View style={styles.settingsSheet}>
            <View style={styles.settingsSheetHeader}>
              <Text style={styles.settingsSheetTitle}>Device settings</Text>
              <Pressable style={styles.settingsSheetClose} onPress={handleCloseSettings}>
                <MaterialIcons name="close" size={18} color="#AEB8C9" />
              </Pressable>
            </View>

            <Pressable style={styles.settingsRow} onPress={handleChangePin}>
              <View style={styles.settingsIconWrap}>
                <MaterialIcons name="dialpad" size={18} color="#F4F7FC" />
              </View>
              <View style={styles.settingsTextWrap}>
                <Text style={styles.settingsRowTitle}>Change PIN</Text>
                <Text style={styles.settingsRowSubtitle}>Restart flow to set a new card PIN</Text>
              </View>
            </Pressable>

            <Pressable style={styles.settingsRow} onPress={handleDisableBiometrics}>
              <View style={styles.settingsIconWrap}>
                <MaterialIcons name="fingerprint" size={18} color="#F4F7FC" />
              </View>
              <View style={styles.settingsTextWrap}>
                <Text style={styles.settingsRowTitle}>Disable biometrics</Text>
                <Text style={styles.settingsRowSubtitle}>Require PIN for transaction approvals</Text>
              </View>
            </Pressable>

            <Pressable style={styles.settingsRow} onPress={handleRemoveCard}>
              <View style={styles.settingsIconWrap}>
                <MaterialIcons name="close" size={18} color="#F4F7FC" />
              </View>
              <View style={styles.settingsTextWrap}>
                <Text style={styles.settingsRowTitle}>Remove card</Text>
                <Text style={styles.settingsRowSubtitle}>Restart onboarding from the beginning</Text>
              </View>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#090A0B",
  },
  container: {
    flex: 1,
    backgroundColor: "#090A0B",
  },
  contentContainer: {
    paddingBottom: 106,
  },
  header: {
    height: HEADER_HEIGHT,
    overflow: "hidden",
  },
  headerGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 18,
    paddingHorizontal: 18,
  },
  generatedCard: {
    width: "86%",
    maxWidth: 332,
    aspectRatio: 1.62,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    padding: 18,
    justifyContent: "space-between",
    transform: [{ rotate: "-10deg" }],
    shadowColor: "#000000",
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 10,
    },
  },
  headerFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 148,
  },
  chip: {
    width: 44,
    height: 30,
    borderRadius: 7,
    backgroundColor: "rgba(36,31,25,0.35)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },
  logo: {
    width: 134,
    height: 46,
    tintColor: "#FAFAFA",
    alignSelf: "center",
  },
  cardFooterMark: {
    flexDirection: "row",
    justifyContent: "flex-end",
    opacity: 0.4,
  },
  footerCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#DBDBDC",
  },
  footerCircleOverlap: {
    marginLeft: -12,
    backgroundColor: "#9FA3A9",
  },
  body: {
    marginTop: -8,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  title: {
    fontSize: 23,
    lineHeight: 29,
    fontWeight: "800",
    color: "#F9FAFB",
    letterSpacing: -0.25,
    fontFamily: Platform.select({
      ios: "System",
      android: "sans-serif",
      default: "System",
    }),
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: "#D1D5DB",
    fontFamily: Platform.select({
      ios: "System",
      android: "sans-serif",
      default: "System",
    }),
  },
  accountHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  settingsButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  accountCard: {
    marginTop: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(140,150,170,0.22)",
    backgroundColor: "rgba(20,27,39,0.92)",
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 154,
    justifyContent: "space-between",
  },
  accountCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  accountCardLabel: {
    color: "#C6D0E1",
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  accountCardNumber: {
    color: "#F4F7FC",
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  accountCardBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  accountCardName: {
    color: "#AEB8C9",
    fontSize: 14,
    fontWeight: "700",
  },
  accountCardStatus: {
    color: "#86EFAC",
    fontSize: 13,
    fontWeight: "700",
  },
  accountCardStatusFrozen: {
    color: "#FCA5A5",
  },
  balancePanel: {
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(140,150,170,0.2)",
    backgroundColor: "rgba(20,27,39,0.76)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  balanceLabel: {
    color: "#8D99AE",
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  balanceValue: {
    color: "#EEF2F8",
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "800",
    letterSpacing: -0.7,
  },
  balanceActions: {
    flexDirection: "row",
    gap: 10,
  },
  balanceActionPrimary: {
    flex: 1,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3EA3A",
  },
  balanceActionPrimaryText: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "800",
  },
  balanceActionSecondary: {
    flex: 1,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(140,150,170,0.35)",
    backgroundColor: "rgba(20,27,39,0.95)",
  },
  balanceActionSecondaryText: {
    color: "#EEF2F8",
    fontSize: 14,
    fontWeight: "700",
  },
  cardHint: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(140,150,170,0.18)",
    backgroundColor: "rgba(20,27,39,0.58)",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  cardHintTitle: {
    color: "#EEF2F8",
    fontSize: 15,
    fontWeight: "700",
  },
  cardHintText: {
    marginTop: 4,
    color: "#8D99AE",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  benefitsList: {
    marginTop: 14,
    gap: 12,
  },
  benefitItem: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  benefitIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
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
    fontFamily: Platform.select({
      ios: "System",
      android: "sans-serif-medium",
      default: "System",
    }),
  },
  benefitDescription: {
    color: "#BFC5CD",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
    fontFamily: Platform.select({
      ios: "System",
      android: "sans-serif",
      default: "System",
    }),
  },
  buttonStack: {
    marginTop: 18,
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
    fontFamily: Platform.select({
      ios: "System",
      android: "sans-serif-medium",
      default: "System",
    }),
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
    fontFamily: Platform.select({
      ios: "System",
      android: "sans-serif-medium",
      default: "System",
    }),
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
    letterSpacing: 0.2,
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
  },
  settingsRowSubtitle: {
    marginTop: 2,
    color: "#8D99AE",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
});
