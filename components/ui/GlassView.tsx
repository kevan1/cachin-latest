import { PropsWithChildren } from "react";
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { BlurView, type BlurTint } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

type GlassViewProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  tint?: BlurTint;
}>;

export function GlassView({
  children,
  style,
  intensity,
  tint,
}: GlassViewProps) {
  const resolvedTint: BlurTint =
    tint ?? (Platform.OS === "ios" ? "systemMaterial" : "default");
  const resolvedIntensity =
    intensity ?? (Platform.OS === "ios" ? 55 : 35);

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
});
