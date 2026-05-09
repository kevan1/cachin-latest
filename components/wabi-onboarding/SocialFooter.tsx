import React from "react";
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  useWindowDimensions,
  ViewStyle,
} from "react-native";
import Animated, { AnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type SocialFooterProps = {
  animatedStyle: StyleProp<AnimatedStyle<ViewStyle>>;
  onRegister?: () => void;
  onLogin?: () => void;
  loginLabel?: string;
  disabled?: boolean;
};

export function SocialFooter({
  animatedStyle,
  onRegister,
  onLogin,
  loginLabel = "Login",
  disabled = false,
}: SocialFooterProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isCompactLayout = height - insets.top - insets.bottom < 700 || width < 380;
  const footerBottom = Math.max(insets.bottom + 18, isCompactLayout ? 22 : height * 0.09);
  const footerWidth = isCompactLayout ? "90%" : "85%";

  return (
    <Animated.View
      style={[
        styles.container,
        isCompactLayout ? styles.containerCompact : null,
        { bottom: footerBottom, width: footerWidth },
        animatedStyle,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        style={({ pressed }) => [
          styles.button,
          isCompactLayout ? styles.buttonCompact : null,
          styles.primaryButton,
          disabled && styles.disabledButton,
          pressed && !disabled && styles.pressedButton,
        ]}
        onPress={onRegister}
      >
        <Text style={[styles.buttonText, styles.primaryButtonText]}>
          Register
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        style={({ pressed }) => [
          styles.button,
          isCompactLayout ? styles.buttonCompact : null,
          styles.secondaryButton,
          disabled && styles.disabledButton,
          pressed && !disabled && styles.pressedButton,
        ]}
        onPress={onLogin}
      >
        <Text style={[styles.buttonText, styles.secondaryButtonText]}>
          {loginLabel}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
    backgroundColor: "black",
    flexDirection: "row",
    position: "absolute",
    minHeight: 64,
    padding: 8,
    borderRadius: 75,
    alignItems: "center",
    justifyContent: "center",
  },
  containerCompact: {
    minHeight: 58,
    padding: 6,
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonCompact: {
    height: 44,
  },
  primaryButton: {
    backgroundColor: "white",
  },
  secondaryButton: {
    borderColor: "rgba(255,255,255,0.55)",
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  pressedButton: {
    opacity: 0.76,
  },
  disabledButton: {
    opacity: 0.55,
  },
  buttonText: {
    textAlign: "center",
    fontFamily: "LexendDeca",
    fontSize: 16,
    fontWeight: "700",
  },
  primaryButtonText: {
    color: "black",
  },
  secondaryButtonText: {
    color: "white",
  },
});
