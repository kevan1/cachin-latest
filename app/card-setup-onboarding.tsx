import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { useMemo, useState, type ReactNode } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Transition from "react-native-screen-transitions";
import {
  createComponentStackNavigator,
  type ComponentStackScreenProps,
} from "react-native-screen-transitions/component-stack";
import { saveCardSetupCompleted } from "@/utils/cardSetupStorage";

type CardSetupStackParamList = {
  step01: undefined;
  step03: undefined;
  step04: undefined;
  step05: undefined;
  step06: undefined;
  step07: undefined;
  step08: undefined;
  step09: undefined;
  step10: undefined;
  step11: undefined;
  step12: undefined;
  step13: undefined;
};

type WorkflowStep = keyof CardSetupStackParamList;
type StepProps<RouteName extends WorkflowStep> = ComponentStackScreenProps<
  CardSetupStackParamList,
  RouteName
>;

const WorkflowStack = createComponentStackNavigator<CardSetupStackParamList>();
const DARK_BG = "#020812";
const SURFACE = "#141B27";
const SURFACE_2 = "#1B2331";
const TEXT_PRIMARY = "#EEF2F8";
const TEXT_SECONDARY = "#8D99AE";
const YELLOW = "#F3EA3A";

const RECOVERY_WORDS = [
  "pizza",
  "curious",
  "earn",
  "young",
  "announce",
  "buzz",
  "hub",
  "mule",
  "maid",
  "leg",
  "exercise",
  "thrive",
];

const CONFIRM_OPTIONS = ["announce", "leg", "buzz", "curious", "mule", "pizza"];
const CORRECT_CONFIRM_WORD = "curious";
const PIN_LENGTH = 6;
let createdPin = "";

function TopHeader({
  title,
  left,
  right,
  onLeftPress,
  onRightPress,
}: {
  title?: string;
  left?: "close" | "back" | null;
  right?: "headset" | "close" | null;
  onLeftPress?: () => void;
  onRightPress?: () => void;
}) {
  const leftIcon = left === "close" ? "close" : left === "back" ? "arrow-back" : null;
  const rightIcon = right === "headset" ? "headset-mic" : right === "close" ? "close" : null;

  return (
    <View style={styles.header}>
      <View style={styles.headerSide}>
        {leftIcon ? (
          <Pressable
            style={styles.headerIconButton}
            onPress={() => {
              if (onLeftPress) {
                onLeftPress();
                return;
              }
              if (left === "close" || left === "back") {
                router.back();
                return;
              }
            }}
          >
            <MaterialIcons name={leftIcon} size={22} color={TEXT_SECONDARY} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.headerTitleWrap}>
        {title ? <Text style={styles.headerTitle}>{title}</Text> : null}
      </View>

      <View style={styles.headerSideRight}>
        {rightIcon ? (
          <Pressable
            style={styles.headerIconButton}
            onPress={() => {
              if (right === "headset") return;
              if (onRightPress) {
                onRightPress();
                return;
              }
              if (right === "close") {
                router.back();
              }
            }}
          >
            <MaterialIcons name={rightIcon} size={20} color={TEXT_SECONDARY} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function ProgressBar({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  return (
    <View style={styles.progressRow}>
      {Array.from({ length: total }).map((_, idx) => (
        <View
          key={`segment-${idx + 1}`}
          style={[
            styles.progressSegment,
            idx < current ? styles.progressSegmentActive : null,
          ]}
        />
      ))}
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={[styles.primaryButton, disabled ? styles.primaryButtonDisabled : null]}
      disabled={disabled}
      onPress={onPress}
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.secondaryButton} onPress={onPress}>
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function IllustrationShell({
  children,
}: {
  children: ReactNode;
}) {
  return <View style={styles.illustrationShell}>{children}</View>;
}

function IllustrationScan() {
  return (
    <IllustrationShell>
      <View style={[styles.cardShape, styles.cardShapeBack]} />
      <View style={[styles.phoneShape, styles.phoneShapeFront]} />
    </IllustrationShell>
  );
}

function IllustrationKeys() {
  return (
    <IllustrationShell>
      <MaterialIcons name="vpn-key" size={150} color="#E5E7EB" />
    </IllustrationShell>
  );
}

function IllustrationShield() {
  return (
    <IllustrationShell>
      <MaterialIcons name="security" size={148} color="#E5E7EB" />
    </IllustrationShell>
  );
}

function IllustrationOffline() {
  return (
    <IllustrationShell>
      <MaterialIcons name="edit-note" size={144} color="#E5E7EB" />
    </IllustrationShell>
  );
}

function IllustrationPinCard() {
  return (
    <IllustrationShell>
      <View style={styles.pinCardMock}>
        <MaterialIcons name="password" size={48} color="#111827" />
      </View>
    </IllustrationShell>
  );
}

function IllustrationConfirmCard() {
  return (
    <IllustrationShell>
      <View style={styles.confirmCardMock}>
        <MaterialIcons name="smartphone" size={92} color="#E5E7EB" />
        <MaterialIcons
          name="nfc"
          size={38}
          color="#B0B7C3"
          style={styles.confirmCardNfc}
        />
      </View>
    </IllustrationShell>
  );
}

function IllustrationBiometric() {
  return (
    <IllustrationShell>
      <MaterialIcons name="fingerprint" size={150} color="#E5E7EB" />
    </IllustrationShell>
  );
}

function HeroStep({
  header,
  progress,
  illustration,
  title,
  description,
  primary,
  secondary,
}: {
  header: { title?: string; left?: "close" | "back" | null; right?: "headset" | null };
  progress?: { current: number; total: number };
  illustration: ReactNode;
  title: string;
  description: string;
  primary: { label: string; onPress: () => void; disabled?: boolean };
  secondary?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.stepScreen}>
      <TopHeader title={header.title} left={header.left} right={header.right} />
      {progress ? <ProgressBar current={progress.current} total={progress.total} /> : null}

      <View style={styles.heroMain}>
        {illustration}
        <Text style={styles.heroTitle}>{title}</Text>
        <Text style={styles.heroDescription}>{description}</Text>
      </View>

      <View style={styles.actionsDock}>
        <PrimaryButton
          label={primary.label}
          onPress={primary.onPress}
          disabled={primary.disabled}
        />
        {secondary ? (
          <SecondaryButton label={secondary.label} onPress={secondary.onPress} />
        ) : null}
      </View>
    </View>
  );
}

function Step01({ navigation }: StepProps<"step01">) {
  const [showContinueModal, setShowContinueModal] = useState(false);
  const sheetProgress = useSharedValue(0);

  const openContinueModal = () => {
    if (showContinueModal) return;
    setShowContinueModal(true);
    sheetProgress.value = 0;
    setTimeout(() => {
      sheetProgress.value = withTiming(1, {
        duration: 300,
        easing: Easing.out(Easing.cubic),
      });
    }, 0);
  };

  const closeContinueModal = (onClosed?: () => void) => {
    sheetProgress.value = withTiming(0, {
      duration: 220,
      easing: Easing.in(Easing.cubic),
    });

    setTimeout(() => {
      setShowContinueModal(false);
      onClosed?.();
    }, 220);
  };

  const modalScrimAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(sheetProgress.value, [0, 1], [0, 1]),
  }));

  const modalSheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(sheetProgress.value, [0, 1], [240, 0]),
      },
    ],
    opacity: interpolate(sheetProgress.value, [0, 1], [0.8, 1]),
  }));

  return (
    <View style={styles.stepScreen}>
      <TopHeader left="close" right="headset" />

      <View style={styles.heroMain}>
        <IllustrationScan />
        <Text style={styles.heroTitle}>Scan your Solflare Shield</Text>
        <Text style={styles.heroDescription}>
          Tap Scan card to start and follow the instructions.
        </Text>
      </View>

      {!showContinueModal ? (
        <View style={styles.actionsDock}>
          <PrimaryButton label="Scan card" onPress={openContinueModal} />
          <SecondaryButton
            label="Learn more"
            onPress={() => navigation.navigate("step03")}
          />
        </View>
      ) : null}

      {showContinueModal ? (
        <View style={styles.modalBackdrop}>
          <Animated.View style={[styles.modalBackdropScrim, modalScrimAnimatedStyle]} />
          <Pressable
            style={styles.modalBackdropTapArea}
            onPress={() => closeContinueModal()}
          />

          <Animated.View style={[styles.continueSheetWrap, modalSheetAnimatedStyle]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>How would you like to continue?</Text>
              <Pressable
                style={styles.sheetClose}
                onPress={() => closeContinueModal()}
              >
                <MaterialIcons name="close" size={18} color={TEXT_SECONDARY} />
              </Pressable>
            </View>

            <Pressable
              style={styles.optionRow}
              onPress={() => closeContinueModal(() => navigation.navigate("step03"))}
            >
              <View style={styles.optionIcon}>
                <MaterialIcons name="view-carousel" size={18} color={TEXT_PRIMARY} />
              </View>
              <View style={styles.optionBody}>
                <View style={styles.optionTopRow}>
                  <Text style={styles.optionTitle}>Create a new wallet</Text>
                  <View style={styles.recommendedBadge}>
                    <Text style={styles.recommendedBadgeText}>Recommended</Text>
                  </View>
                </View>
                <Text style={styles.optionSubtitle}>Receive a new recovery phrase</Text>
              </View>
            </Pressable>

            <Pressable
              style={styles.optionRow}
              onPress={() => closeContinueModal(() => navigation.navigate("step06"))}
            >
              <View style={styles.optionIcon}>
                <MaterialIcons name="credit-card" size={18} color={TEXT_PRIMARY} />
              </View>
              <View style={styles.optionBody}>
                <Text style={styles.optionTitle}>Import existing wallet</Text>
                <Text style={styles.optionSubtitle}>Use an existing Solflare Shield phrase</Text>
              </View>
            </Pressable>
          </Animated.View>
        </View>
      ) : null}
    </View>
  );
}

function Step03({ navigation }: StepProps<"step03">) {
  return (
    <HeroStep
      header={{ left: null, right: "close", title: undefined }}
      progress={{ current: 1, total: 4 }}
      illustration={<IllustrationKeys />}
      title="What is a recovery phrase?"
      description="You'll receive a set of 12 secret words that unlock your wallet. It's not stored by Solflare. Only you have it."
      primary={{ label: "Next", onPress: () => navigation.navigate("step04") }}
    />
  );
}

function Step04({ navigation }: StepProps<"step04">) {
  return (
    <HeroStep
      header={{ left: null, right: "close" }}
      progress={{ current: 2, total: 4 }}
      illustration={<IllustrationShield />}
      title="Keep your recovery phrase safe"
      description="Your recovery phrase is the ultimate backup for your wallet. Without it, no one can access or recover your assets."
      primary={{ label: "Next", onPress: () => navigation.navigate("step05") }}
    />
  );
}

function Step05({ navigation }: StepProps<"step05">) {
  return (
    <HeroStep
      header={{ left: null, right: "close" }}
      progress={{ current: 3, total: 4 }}
      illustration={<IllustrationOffline />}
      title="Keep your recovery phrase offline"
      description="Write it on paper. Store it somewhere secure. Never share it or enter it anywhere online."
      primary={{ label: "Continue", onPress: () => navigation.navigate("step06") }}
    />
  );
}

function Step06({ navigation }: StepProps<"step06">) {
  return (
    <View style={styles.stepScreen}>
      <TopHeader title="Your recovery phrase" left="close" />

      <View style={styles.mainArea}>
        <Text style={styles.helperText}>
          Write these 12 words on paper in the correct order.
        </Text>

        <View style={styles.wordsCard}>
          <View style={styles.wordsColumns}>
            <View style={styles.wordsColumn}>
              {RECOVERY_WORDS.slice(0, 6).map((word, idx) => (
                <Text key={`left-${word}`} style={styles.wordRow}>
                  {idx + 1} {word}
                </Text>
              ))}
            </View>
            <View style={styles.wordsDivider} />
            <View style={styles.wordsColumn}>
              {RECOVERY_WORDS.slice(6).map((word, idx) => (
                <Text key={`right-${word}`} style={styles.wordRow}>
                  {idx + 7} {word}
                </Text>
              ))}
            </View>
          </View>

          <Pressable style={styles.copyRow} onPress={() => undefined}>
            <MaterialIcons name="content-copy" size={18} color={TEXT_PRIMARY} />
            <Text style={styles.copyText}>Copy</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.actionsDock}>
        <PrimaryButton
          label="Continue"
          onPress={() => navigation.navigate("step07")}
        />
      </View>
    </View>
  );
}

function Step07({ navigation }: StepProps<"step07">) {
  const [selected, setSelected] = useState<string | null>(null);
  const isCorrect = selected === CORRECT_CONFIRM_WORD;

  return (
    <View style={styles.stepScreen}>
      <TopHeader title="Confirm your recovery phrase" left="back" />

      <View style={styles.mainArea}>
        <Text style={styles.questionText}>
          What is the 2nd word in your recovery phrase?
        </Text>

        <View style={styles.optionsList}>
          {CONFIRM_OPTIONS.map((option) => {
            const active = selected === option;
            return (
              <Pressable
                key={option}
                style={styles.confirmOption}
                onPress={() => setSelected(option)}
              >
                <Text style={styles.confirmOptionText}>{option}</Text>
                <View
                  style={[
                    styles.radioCircle,
                    active ? styles.radioCircleActive : null,
                  ]}
                >
                  {active ? (
                    <MaterialIcons name="check" size={16} color="#111827" />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        {isCorrect ? (
          <View style={styles.successBanner}>
            <Text style={styles.successTitle}>You are all set</Text>
            <Text style={styles.successSubtitle}>
              Keep your recovery phrase safe and private. It unlocks your wallet.
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.actionsDock}>
        <PrimaryButton
          label="Continue"
          onPress={() => navigation.navigate("step08")}
          disabled={!isCorrect}
        />
      </View>
    </View>
  );
}

function Step08({ navigation }: StepProps<"step08">) {
  return (
    <View style={styles.stepScreen}>
      <TopHeader left="close" />

      <View style={styles.mainArea}>
        <IllustrationPinCard />

        <Text style={styles.heroTitle}>Set your card PIN</Text>
        <Text style={styles.heroDescription}>
          This PIN protects your card from unauthorized use.
        </Text>

        <View style={styles.infoList}>
          <View style={styles.infoItem}>
            <View style={styles.infoIconWrap}>
              <MaterialIcons name="lock-outline" size={18} color={TEXT_SECONDARY} />
            </View>
            <View style={styles.infoBody}>
              <Text style={styles.infoTitle}>It's only for this card</Text>
              <Text style={styles.infoText}>
                This PIN protects your card. It differs from your app passcode.
              </Text>
            </View>
          </View>

          <View style={styles.infoItem}>
            <View style={styles.infoIconWrap}>
              <MaterialIcons name="layers" size={18} color={TEXT_SECONDARY} />
            </View>
            <View style={styles.infoBody}>
              <Text style={styles.infoTitle}>Don't lose it</Text>
              <Text style={styles.infoText}>
                If you forget your PIN, you'll need your recovery phrase to restore.
              </Text>
            </View>
          </View>

          <View style={styles.infoItem}>
            <View style={styles.infoIconWrap}>
              <MaterialIcons name="fingerprint" size={18} color={TEXT_SECONDARY} />
            </View>
            <View style={styles.infoBody}>
              <Text style={styles.infoTitle}>Secure transactions</Text>
              <Text style={styles.infoText}>
                Every transaction requires your PIN for approval.
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.actionsDock}>
        <PrimaryButton
          label="Continue"
          onPress={() => navigation.navigate("step09")}
        />
      </View>
    </View>
  );
}

function PinDots({ length }: { length: number }) {
  return (
    <View style={styles.pinDotsRow}>
      {Array.from({ length: PIN_LENGTH }).map((_, idx) => (
        <View
          key={`dot-${idx + 1}`}
          style={[styles.pinDot, idx < length ? styles.pinDotFilled : null]}
        />
      ))}
    </View>
  );
}

function PinPad({
  pin,
  onDigit,
  onBackspace,
}: {
  pin: string;
  onDigit: (digit: string) => void;
  onBackspace: () => void;
}) {
  const rows = useMemo(
    () => [
      ["1", "2", "3"],
      ["4", "5", "6"],
      ["7", "8", "9"],
      ["", "0", "backspace"],
    ],
    [],
  );

  return (
    <View style={styles.pinPad}>
      {rows.map((row, rowIdx) => (
        <View key={`row-${rowIdx + 1}`} style={styles.pinRow}>
          {row.map((item) => {
            if (item === "") {
              return <View key={`empty-${rowIdx}`} style={styles.pinKeyEmpty} />;
            }

            if (item === "backspace") {
              return (
                <Pressable
                  key="backspace"
                  style={styles.pinKeySmall}
                  onPress={onBackspace}
                >
                  <MaterialIcons name="backspace" size={22} color={TEXT_PRIMARY} />
                </Pressable>
              );
            }

            return (
              <Pressable
                key={item}
                style={styles.pinKey}
                onPress={() => {
                  if (pin.length >= PIN_LENGTH) return;
                  onDigit(item);
                }}
              >
                <Text style={styles.pinKeyText}>{item}</Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function Step09({ navigation }: StepProps<"step09">) {
  const [pin, setPin] = useState("");

  return (
    <View style={styles.stepScreen}>
      <TopHeader title="Set card PIN" left="back" />
      <View style={styles.pinMainArea}>
        <PinDots length={pin.length} />
        <PinPad
          pin={pin}
          onDigit={(digit) => {
            const next = pin + digit;
            if (next.length >= PIN_LENGTH) {
              createdPin = next;
              setPin("");
              navigation.navigate("step10");
              return;
            }
            setPin(next);
          }}
          onBackspace={() => setPin(pin.slice(0, -1))}
        />
      </View>
    </View>
  );
}

function Step10({ navigation }: StepProps<"step10">) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  return (
    <View style={styles.stepScreen}>
      <TopHeader title="Confirm new card PIN" left="back" />
      <View style={styles.pinMainArea}>
        <PinDots length={pin.length} />
        {error ? <Text style={styles.pinError}>{error}</Text> : null}
        <PinPad
          pin={pin}
          onDigit={(digit) => {
            const next = pin + digit;
            if (next.length >= PIN_LENGTH) {
              if (next !== createdPin) {
                setPin("");
                setError("PINs do not match. Try again.");
                return;
              }
              setError("");
              navigation.navigate("step11");
              return;
            }
            setPin(next);
          }}
          onBackspace={() => {
            setError("");
            setPin(pin.slice(0, -1));
          }}
        />
      </View>
    </View>
  );
}

function Step11({ navigation }: StepProps<"step11">) {
  return (
    <HeroStep
      header={{ left: "close", title: "Confirm your card" }}
      illustration={<IllustrationConfirmCard />}
      title="Almost done"
      description="Tap your card again to save your PIN and recovery phrase. This completes your cold wallet setup."
      primary={{ label: "Scan to confirm", onPress: () => navigation.navigate("step12") }}
    />
  );
}

function Step12() {
  const completeSetup = async () => {
    await saveCardSetupCompleted(true);
    router.back();
  };

  return (
    <View style={styles.stepScreen}>
      <TopHeader left="close" />
      <View style={styles.mainArea}>
        <IllustrationBiometric />

        <Text style={styles.heroTitle}>Enable biometrics</Text>
        <Text style={styles.heroDescription}>
          Use your face or fingerprint for faster, secure access.
        </Text>

        <View style={styles.infoList}>
          <View style={styles.infoItem}>
            <View style={styles.infoIconWrap}>
              <MaterialIcons name="lock-outline" size={18} color={TEXT_SECONDARY} />
            </View>
            <View style={styles.infoBody}>
              <Text style={styles.infoTitle}>It's only for this card</Text>
              <Text style={styles.infoText}>
                Biometrics unlock your card PIN, not the app passcode.
              </Text>
            </View>
          </View>

          <View style={styles.infoItem}>
            <View style={styles.infoIconWrap}>
              <MaterialIcons name="bolt" size={18} color={TEXT_SECONDARY} />
            </View>
            <View style={styles.infoBody}>
              <Text style={styles.infoTitle}>Skip the PIN</Text>
              <Text style={styles.infoText}>
                Approve transactions faster without entering your card PIN.
              </Text>
            </View>
          </View>

          <View style={styles.infoItem}>
            <View style={styles.infoIconWrap}>
              <MaterialIcons name="fingerprint" size={18} color={TEXT_SECONDARY} />
            </View>
            <View style={styles.infoBody}>
              <Text style={styles.infoTitle}>Your data stays private</Text>
              <Text style={styles.infoText}>Cachin can't access it.</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.actionsDock}>
        <PrimaryButton
          label="Enable biometrics"
          onPress={() => {
            void completeSetup();
          }}
        />
        <SecondaryButton
          label="Not now"
          onPress={() => {
            void completeSetup();
          }}
        />
      </View>
    </View>
  );
}

function Step13({ navigation }: StepProps<"step13">) {
  const [showSettingsSheet, setShowSettingsSheet] = useState(false);
  const [isFrozen, setIsFrozen] = useState(false);
  const [balance, setBalance] = useState(2430.25);

  const formattedBalance = `$${balance.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  const restartConfig = () => {
    createdPin = "";
    void saveCardSetupCompleted(false);
    navigation.popToTop();
  };

  const handleEraseCard = () => {
    Alert.alert(
      "Erase card",
      "This will remove the recovery phrase and PIN from the card. This action is not reversible.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Erase",
          style: "destructive",
          onPress: restartConfig,
        },
      ],
    );
  };

  const handleRemoveCard = () => {
    Alert.alert(
      "Remove card",
      "This will unlink the card and restart setup from the beginning.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: restartConfig,
        },
      ],
    );
  };

  return (
    <View style={styles.stepScreen}>
      <TopHeader title="Card" left="back" />

      <View style={styles.cardDashboard}>
        <View style={styles.dashboardCard}>
          <View style={styles.dashboardCardTop}>
            <Text style={styles.dashboardCardLabel}>Cachin prepaid</Text>
            <MaterialIcons name="credit-card" size={22} color="#E9EDF5" />
          </View>
          <Text style={styles.dashboardCardNumber}>•••• 4821</Text>
          <View style={styles.dashboardCardBottom}>
            <Text style={styles.dashboardCardName}>Main card</Text>
            <Text
              style={[
                styles.dashboardCardStatus,
                isFrozen ? styles.dashboardCardStatusFrozen : null,
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
            <Pressable
              style={styles.balanceActionPrimary}
              onPress={() => {
                setBalance((prev) => prev + 150);
                Alert.alert("Top up complete", "$150.00 was added to your card balance.");
              }}
            >
              <Text style={styles.balanceActionPrimaryText}>Top up</Text>
            </Pressable>
            <Pressable
              style={styles.balanceActionSecondary}
              onPress={() => {
                setIsFrozen((prev) => !prev);
                Alert.alert(
                  isFrozen ? "Card unfrozen" : "Card frozen",
                  isFrozen
                    ? "Your card can now be used normally."
                    : "Your card is now frozen and cannot be used until you unfreeze it.",
                );
              }}
            >
              <Text style={styles.balanceActionSecondaryText}>
                {isFrozen ? "Unfreeze" : "Freeze"}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.prepaidInfoCard}>
          <Text style={styles.prepaidInfoTitle}>Prepaid account behavior</Text>
          <Text style={styles.prepaidInfoText}>
            Spend only from available balance. Freeze or unfreeze the card anytime.
          </Text>
        </View>
      </View>

      {showSettingsSheet ? (
        <View style={styles.settingsSheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Device settings</Text>
            <Pressable style={styles.sheetClose} onPress={() => setShowSettingsSheet(false)}>
              <MaterialIcons name="close" size={18} color={TEXT_SECONDARY} />
            </Pressable>
          </View>

          {[
            {
              icon: "view-carousel",
              title: "Manage cold wallets",
              subtitle: "Add or remove wallets from the list",
              onPress: () => undefined,
            },
            {
              icon: "dialpad",
              title: "Change PIN",
              subtitle: "Update your card PIN",
              onPress: () => navigation.navigate("step09"),
            },
            {
              icon: "fingerprint",
              title: "Disable biometrics",
              subtitle: "Use your PIN to approve transactions instead",
              onPress: () => navigation.navigate("step12"),
            },
            {
              icon: "restart-alt",
              title: "Erase card",
              subtitle: "Erase recovery phrase and PIN from card",
              onPress: handleEraseCard,
            },
            {
              icon: "close",
              title: "Remove card",
              subtitle: "Restart card configuration from the beginning",
              onPress: handleRemoveCard,
            },
          ].map((item) => (
            <Pressable key={item.title} style={styles.optionRow} onPress={item.onPress}>
              <View style={styles.optionIcon}>
                <MaterialIcons
                  name={item.icon as keyof typeof MaterialIcons.glyphMap}
                  size={18}
                  color={TEXT_PRIMARY}
                />
              </View>
              <View style={styles.optionBody}>
                <Text style={styles.optionTitle}>{item.title}</Text>
                <Text style={styles.optionSubtitle}>{item.subtitle}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : (
        <Pressable style={styles.reopenSettingsButton} onPress={() => setShowSettingsSheet(true)}>
          <MaterialIcons name="settings" size={17} color={TEXT_PRIMARY} />
          <Text style={styles.reopenSettingsText}>Open device settings</Text>
        </Pressable>
      )}
    </View>
  );
}

export default function CardSetupOnboardingScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: Math.max(insets.top, 6),
          paddingBottom: Math.max(insets.bottom, 6),
        },
      ]}
    >
      <WorkflowStack.Navigator
        initialRouteName="step01"
        screenOptions={{
          detachPreviousScreen: false,
          gestureEnabled: true,
          gestureDirection: "horizontal-inverted",
          gestureActivationArea: "edge",
          transitionSpec: {
            open: Transition.Specs.DefaultSpec,
            close: Transition.Specs.DefaultSpec,
          },
          screenStyleInterpolator: ({ progress, layouts: { screen } }) => {
            "worklet";
            return {
              contentStyle: {
                opacity: interpolate(progress, [0, 0.4, 1, 2], [0.9, 1, 1, 0.9]),
                transform: [
                  {
                    translateX: interpolate(
                      progress,
                      [0, 1, 2],
                      [-screen.width * 0.86, 0, screen.width * 0.86],
                    ),
                  },
                ],
              },
            };
          },
        }}
      >
        <WorkflowStack.Screen name="step01" component={Step01} />
        <WorkflowStack.Screen name="step03" component={Step03} />
        <WorkflowStack.Screen name="step04" component={Step04} />
        <WorkflowStack.Screen name="step05" component={Step05} />
        <WorkflowStack.Screen name="step06" component={Step06} />
        <WorkflowStack.Screen name="step07" component={Step07} />
        <WorkflowStack.Screen name="step08" component={Step08} />
        <WorkflowStack.Screen name="step09" component={Step09} />
        <WorkflowStack.Screen name="step10" component={Step10} />
        <WorkflowStack.Screen name="step11" component={Step11} />
        <WorkflowStack.Screen name="step12" component={Step12} />
        <WorkflowStack.Screen name="step13" component={Step13} />
      </WorkflowStack.Navigator>
    </View>
  );
}

const absoluteFill: ViewStyle = {
  position: "absolute",
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK_BG,
    paddingHorizontal: 12,
  },
  stepScreen: {
    flex: 1,
    backgroundColor: DARK_BG,
  },
  header: {
    height: 42,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  headerSide: {
    width: 44,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: "center",
  },
  headerSideRight: {
    width: 44,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  headerIconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: TEXT_PRIMARY,
    fontSize: 20,
    fontWeight: "700",
  },
  progressRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 8,
  },
  progressSegment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(140,150,170,0.26)",
  },
  progressSegmentActive: {
    backgroundColor: "#F2F4FA",
  },
  heroMain: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  illustrationShell: {
    width: "100%",
    maxWidth: 280,
    height: 250,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  phoneShape: {
    width: 118,
    height: 210,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    backgroundColor: "rgba(220,226,236,0.12)",
  },
  phoneShapeFront: {
    transform: [{ rotate: "18deg" }],
  },
  cardShape: {
    width: 118,
    height: 72,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    backgroundColor: "rgba(220,226,236,0.12)",
  },
  cardShapeBack: {
    position: "absolute",
    left: 48,
    top: 40,
    transform: [{ rotate: "-11deg" }],
  },
  heroTitle: {
    color: TEXT_PRIMARY,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: -0.6,
  },
  heroDescription: {
    marginTop: 12,
    color: TEXT_SECONDARY,
    fontSize: 16,
    lineHeight: 23,
    textAlign: "center",
    maxWidth: 330,
    fontWeight: "600",
  },
  actionsDock: {
    paddingBottom: 6,
    gap: 10,
  },
  primaryButton: {
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: YELLOW,
  },
  primaryButtonDisabled: {
    opacity: 0.45,
  },
  primaryButtonText: {
    color: "#141414",
    fontSize: 21,
    lineHeight: 23,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  secondaryButton: {
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: SURFACE_2,
  },
  secondaryButtonText: {
    color: "#D1D5DE",
    fontSize: 20,
    lineHeight: 22,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  modalBackdrop: {
    ...absoluteFill,
    justifyContent: "flex-end",
  },
  modalBackdropScrim: {
    ...absoluteFill,
    backgroundColor: "rgba(0,0,0,0.34)",
  },
  modalBackdropTapArea: {
    flex: 1,
  },
  continueSheetWrap: {
    marginTop: "auto",
    marginBottom: 12,
    marginHorizontal: 8,
    borderRadius: 22,
    padding: 10,
    backgroundColor: "rgba(20,27,39,0.95)",
    borderWidth: 1,
    borderColor: "rgba(140,150,170,0.24)",
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 42,
    marginBottom: 6,
  },
  sheetTitle: {
    color: TEXT_PRIMARY,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  sheetClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    position: "absolute",
    right: 0,
  },
  optionRow: {
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
  optionIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  optionBody: {
    flex: 1,
  },
  optionTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  optionTitle: {
    color: TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: "700",
  },
  optionSubtitle: {
    marginTop: 2,
    color: TEXT_SECONDARY,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  recommendedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  recommendedBadgeText: {
    color: "#B7BFCE",
    fontSize: 11,
    fontWeight: "700",
  },
  mainArea: {
    flex: 1,
    paddingTop: 6,
  },
  helperText: {
    color: TEXT_SECONDARY,
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 12,
    textAlign: "center",
    fontWeight: "600",
    paddingHorizontal: 8,
  },
  wordsCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(140,150,170,0.24)",
    backgroundColor: "rgba(20,27,39,0.84)",
    overflow: "hidden",
  },
  wordsColumns: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  wordsColumn: {
    flex: 1,
    gap: 10,
  },
  wordsDivider: {
    width: 1,
    backgroundColor: "rgba(140,150,170,0.22)",
    marginHorizontal: 12,
  },
  wordRow: {
    color: TEXT_PRIMARY,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "600",
  },
  copyRow: {
    borderTopWidth: 1,
    borderTopColor: "rgba(140,150,170,0.22)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 58,
  },
  copyText: {
    color: TEXT_PRIMARY,
    fontSize: 18,
    fontWeight: "700",
  },
  questionText: {
    color: TEXT_SECONDARY,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
    marginBottom: 8,
  },
  optionsList: {
    gap: 4,
  },
  confirmOption: {
    minHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(140,150,170,0.2)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  confirmOptionText: {
    color: TEXT_PRIMARY,
    fontSize: 17,
    fontWeight: "600",
    textTransform: "lowercase",
  },
  radioCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: "rgba(140,150,170,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  radioCircleActive: {
    backgroundColor: YELLOW,
    borderColor: YELLOW,
  },
  successBanner: {
    marginTop: 18,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(57,184,95,0.45)",
    backgroundColor: "rgba(34,87,43,0.35)",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  successTitle: {
    color: "#8EE4A3",
    fontSize: 14,
    fontWeight: "700",
  },
  successSubtitle: {
    marginTop: 4,
    color: "#7BCF90",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  pinCardMock: {
    width: 150,
    height: 106,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E5E7EB",
    marginBottom: 6,
  },
  infoList: {
    marginTop: 18,
    gap: 12,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  infoIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  infoBody: {
    flex: 1,
  },
  infoTitle: {
    color: TEXT_PRIMARY,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "700",
  },
  infoText: {
    marginTop: 4,
    color: TEXT_SECONDARY,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
  },
  pinMainArea: {
    flex: 1,
    paddingTop: 10,
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 24,
  },
  pinDotsRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 30,
  },
  pinDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#E5E7EB",
  },
  pinDotFilled: {
    backgroundColor: YELLOW,
    borderColor: YELLOW,
  },
  pinPad: {
    width: "100%",
    maxWidth: 340,
    gap: 12,
  },
  pinRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pinKey: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: SURFACE,
    alignItems: "center",
    justifyContent: "center",
  },
  pinKeyText: {
    color: TEXT_PRIMARY,
    fontSize: 28,
    lineHeight: 30,
    fontWeight: "700",
  },
  pinKeyEmpty: {
    width: 88,
    height: 88,
  },
  pinKeySmall: {
    width: 88,
    height: 88,
    alignItems: "center",
    justifyContent: "center",
  },
  pinError: {
    marginTop: 10,
    color: "#FCA5A5",
    fontSize: 14,
    fontWeight: "700",
  },
  confirmCardMock: {
    width: 200,
    height: 210,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  confirmCardNfc: {
    position: "absolute",
    top: 40,
    right: 28,
  },
  cardDashboard: {
    flex: 1,
    paddingTop: 12,
    gap: 14,
  },
  dashboardCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(140,150,170,0.22)",
    backgroundColor: "rgba(20,27,39,0.92)",
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 154,
    justifyContent: "space-between",
  },
  dashboardCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dashboardCardLabel: {
    color: "#C6D0E1",
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  dashboardCardNumber: {
    color: "#F4F7FC",
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  dashboardCardBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dashboardCardName: {
    color: "#AEB8C9",
    fontSize: 14,
    fontWeight: "700",
  },
  dashboardCardStatus: {
    color: "#86EFAC",
    fontSize: 13,
    fontWeight: "700",
  },
  dashboardCardStatusFrozen: {
    color: "#FCA5A5",
  },
  balancePanel: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(140,150,170,0.2)",
    backgroundColor: "rgba(20,27,39,0.76)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  balanceLabel: {
    color: TEXT_SECONDARY,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  balanceValue: {
    color: TEXT_PRIMARY,
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
    backgroundColor: YELLOW,
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
    color: TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: "700",
  },
  prepaidInfoCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(140,150,170,0.18)",
    backgroundColor: "rgba(20,27,39,0.58)",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  prepaidInfoTitle: {
    color: TEXT_PRIMARY,
    fontSize: 15,
    fontWeight: "700",
  },
  prepaidInfoText: {
    marginTop: 4,
    color: TEXT_SECONDARY,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  settingsSheet: {
    marginTop: "auto",
    borderRadius: 22,
    padding: 10,
    backgroundColor: "rgba(20,27,39,0.95)",
    borderWidth: 1,
    borderColor: "rgba(140,150,170,0.24)",
  },
  reopenSettingsButton: {
    marginTop: "auto",
    marginBottom: 8,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(140,150,170,0.25)",
    backgroundColor: "rgba(20,27,39,0.9)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  reopenSettingsText: {
    color: TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: "700",
  },
});
