import { PropsWithChildren } from "react";
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { BlurView, type BlurTint } from "expo-blur";
import {
  GlassView as ExpoGlassView,
  isLiquidGlassAvailable,
} from "expo-glass-effect";
import { LinearGradient } from "expo-linear-gradient";

type GlassViewProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  tint?: BlurTint;
  interactive?: boolean;
}>;

export function GlassView({
  children,
  style,
  intensity,
  tint,
  interactive,
}: GlassViewProps) {
  const resolvedTint: BlurTint =
    tint ??
    (Platform.OS === "ios"
      ? interactive
        ? "systemUltraThinMaterial"
        : "systemMaterial"
      : "default");
  const resolvedIntensity =
    intensity ?? (Platform.OS === "ios" ? (interactive ? 32 : 55) : 35);
  const useLiquidGlass =
    Platform.OS === "ios" && typeof isLiquidGlassAvailable === "function" && isLiquidGlassAvailable();

  if (useLiquidGlass) {
    return (
      <ExpoGlassView
        isInteractive={Boolean(interactive)}
        glassEffectStyle={interactive ? "clear" : "regular"}
        style={[styles.outer, styles.liquidOuter, style]}
      >
        {children}
      </ExpoGlassView>
    );
  }

  return (
    <View style={[styles.outer, style]}>
      <BlurView
        intensity={resolvedIntensity}
        tint={resolvedTint}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <LinearGradient
          colors={[
            "rgba(255,255,255,0.55)",
            "rgba(255,255,255,0.18)",
            "rgba(255,255,255,0.10)",
          ]}
          locations={[0, 0.55, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.38)",
    borderCurve: "continuous",
    boxShadow: "0 8px 18px rgba(11, 26, 51, 0.18)",
  },
  liquidOuter: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.4)",
    boxShadow: "0 10px 24px rgba(11, 26, 51, 0.22)",
  },
});
