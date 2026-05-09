import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import { IconSymbol, type IconSymbolName } from "@/components/ui/icon-symbol";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const SHEET_BACKGROUND = "rgba(248, 248, 250, 0.9)";

type AlertSheetProps = {
  isVisible: boolean;
  title: string;
  message: string;
  primaryLabel: string;
  onPrimaryPress: () => void;
  eyebrow?: string;
  helperText?: string;
  iconName?: IconSymbolName;
  secondaryLabel?: string;
  onSecondaryPress?: () => void;
  onClose?: () => void;
  showClose?: boolean;
};

function SheetIconButton({
  name,
  onPress,
}: {
  name: IconSymbolName;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.iconButton,
        { opacity: pressed ? 0.72 : 1 },
      ]}
    >
      <IconSymbol name={name} size={15} color="#1C1C1E" />
    </Pressable>
  );
}

export function AlertSheet({
  isVisible,
  title,
  message,
  primaryLabel,
  onPrimaryPress,
  eyebrow,
  helperText,
  iconName = "lock.fill",
  secondaryLabel,
  onSecondaryPress,
  onClose,
  showClose = true,
}: AlertSheetProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  if (!isVisible) return null;

  const sheetWidth = Math.min(width - 28, 380);

  return (
    <Modal
      transparent
      visible={isVisible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose ?? (() => {})}
    >
      <View style={styles.modalRoot}>
        <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFill} />

        <Animated.View
          entering={FadeIn}
          exiting={FadeOut}
          style={[
            styles.sheet,
            {
              width: sheetWidth,
              marginBottom: Math.max(16, insets.bottom + 6),
            },
          ]}
        >
          <BlurView tint="light" intensity={82} style={StyleSheet.absoluteFill} />
          <View style={styles.handle} />

          {showClose ? (
            <View style={styles.closeButton}>
              <SheetIconButton name="xmark" onPress={onClose} />
            </View>
          ) : null}

          <View style={styles.statusIcon}>
            <IconSymbol name={iconName} size={30} color="#111114" />
          </View>

          <View style={styles.titleBlock}>
            {eyebrow ? (
              <Text selectable style={styles.eyebrow}>
                {eyebrow}
              </Text>
            ) : null}
            <Text selectable style={styles.title}>
              {title}
            </Text>
            <Text selectable style={styles.message}>
              {message}
            </Text>
          </View>

          {helperText ? (
            <View style={styles.helperBox}>
              <IconSymbol name="info.circle" size={18} color="#6E6E73" />
              <Text selectable style={styles.helperText}>
                {helperText}
              </Text>
            </View>
          ) : null}

          <View style={styles.actionRow}>
            <Pressable
              accessibilityRole="button"
              onPress={onPrimaryPress}
              style={({ pressed }) => [
                styles.primaryButton,
                { opacity: pressed ? 0.9 : 1 },
              ]}
            >
              <Text selectable style={styles.primaryButtonText}>
                {primaryLabel}
              </Text>
            </Pressable>
            {secondaryLabel && onSecondaryPress ? (
              <Pressable
                accessibilityRole="button"
                onPress={onSecondaryPress}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  { opacity: pressed ? 0.72 : 1 },
                ]}
              >
                <Text selectable style={styles.secondaryButtonText}>
                  {secondaryLabel}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.16)",
  },
  sheet: {
    backgroundColor: SHEET_BACKGROUND,
    borderRadius: 34,
    borderCurve: "continuous",
    overflow: "hidden",
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 14,
    alignItems: "center",
    gap: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.58)",
    boxShadow: "0 18px 42px rgba(0, 0, 0, 0.24)",
  },
  handle: {
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(60, 60, 67, 0.22)",
    marginBottom: 6,
  },
  closeButton: {
    position: "absolute",
    top: 14,
    right: 14,
    zIndex: 2,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(120, 120, 128, 0.16)",
  },
  statusIcon: {
    width: 66,
    height: 66,
    borderRadius: 33,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.82)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(60, 60, 67, 0.12)",
    boxShadow: "0 8px 20px rgba(0, 0, 0, 0.12)",
  },
  titleBlock: {
    width: "100%",
    alignItems: "center",
    gap: 7,
  },
  eyebrow: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    letterSpacing: 0,
    color: "#6E6E73",
    textTransform: "uppercase",
  },
  title: {
    fontSize: 24,
    lineHeight: 29,
    fontWeight: "700",
    color: "#111114",
    textAlign: "center",
  },
  message: {
    fontSize: 16,
    lineHeight: 23,
    color: "#5F6067",
    textAlign: "center",
  },
  helperBox: {
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    borderCurve: "continuous",
    backgroundColor: "rgba(118, 118, 128, 0.1)",
  },
  helperText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: "#6E6E73",
  },
  actionRow: {
    width: "100%",
    gap: 8,
    marginTop: 2,
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: 25,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111114",
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
  },
  secondaryButton: {
    minHeight: 42,
    borderRadius: 21,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  secondaryButtonText: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "600",
    color: "#4D4D54",
    textAlign: "center",
  },
});
