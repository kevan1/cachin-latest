import { useMemo } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import { IconSymbol } from "@/components/ui/icon-symbol";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const SHEET_BACKGROUND = "rgba(15, 15, 18, 0.4)";

type AlertSheetProps = {
  isVisible: boolean;
  title: string;
  message: string;
  primaryLabel: string;
  onPrimaryPress: () => void;
  onClose?: () => void;
  showClose?: boolean;
};

function GlassIconButton({
  icon,
  size = 16,
  onPress,
}: {
  icon: "xmark" | "cpu";
  size?: number;
  onPress?: () => void;
}) {
  const symbolName = icon === "cpu" ? "cpu" : "xmark";
  const content = (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.iconButton,
        { opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <IconSymbol name={symbolName} size={size} color="#fff" />
    </Pressable>
  );

  const wrapperStyle = useMemo(
    () => ({
      borderRadius: 20,
      overflow: "hidden" as const,
    }),
    []
  );

  return (
    <BlurView tint="dark" intensity={65} style={wrapperStyle}>
      {content}
    </BlurView>
  );
}

export function AlertSheet({
  isVisible,
  title,
  message,
  primaryLabel,
  onPrimaryPress,
  onClose,
  showClose = true,
}: AlertSheetProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  if (!isVisible) return null;

  const sheetWidth = Math.min(width - 32, 360);

  return (
    <Modal
      transparent
      visible={isVisible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose ?? (() => {})}
    >
      <View style={styles.modalRoot}>
        <BlurView
          intensity={22}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />

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
          <View style={styles.headerRow}>
            <GlassIconButton icon="cpu" size={22} />
            {showClose ? (
              <GlassIconButton icon="xmark" size={14} onPress={onClose} />
            ) : (
              <View style={styles.iconSpacer} />
            )}
          </View>

          <View style={styles.titleBlock}>
            <Text selectable style={styles.title}>
              {title}
            </Text>
            <Text selectable style={styles.message}>
              {message}
            </Text>
          </View>

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
    backgroundColor: "rgba(0, 0, 0, 0.2)",
  },
  sheet: {
    backgroundColor: SHEET_BACKGROUND,
    borderRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 6,
    gap: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.18)",
  },
  iconSpacer: {
    width: 40,
    height: 40,
  },
  titleBlock: {
    gap: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: "600",
    color: "#f7f7fb",
  },
  message: {
    fontSize: 15,
    lineHeight: 21,
    color: "rgba(247, 247, 251, 0.7)",
  },
  actionRow: {
    marginTop: 16,
  },
  primaryButton: {
    height: 44,
    borderRadius: 22,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f7f7fb",
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1f",
  },
});
