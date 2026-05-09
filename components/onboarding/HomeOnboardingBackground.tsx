import { useEffect, useState } from "react";
import { Platform, StyleSheet, useColorScheme, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MeshGradientView } from "@wilmxre/react-native-mesh-gradient/src";

import { MESH_POINTS, THEMES } from "@/constants/themes";
import { loadThemePreference } from "@/utils/themePreferences";

const MESH_DIMENSION = 3;

function getIosVersion() {
  if (process.env.EXPO_OS !== "ios") return 0;
  if (typeof Platform.Version === "number") return Platform.Version;
  if (typeof Platform.Version === "string") return Number.parseFloat(Platform.Version);
  return 0;
}

export function HomeOnboardingBackground() {
  const colorScheme = useColorScheme() === "dark" ? "dark" : "light";
  const [themeId, setThemeId] = useState("blue");
  const currentTheme = THEMES.find((theme) => theme.id === themeId) ?? THEMES[0];
  const meshColors = colorScheme === "dark" ? currentTheme.colors.dark : currentTheme.colors.light;
  const supportsMeshGradient =
    process.env.EXPO_OS === "ios" && Number.isFinite(getIosVersion()) && getIosVersion() >= 16;

  useEffect(() => {
    let isMounted = true;

    loadThemePreference()
      .then((storedThemeId) => {
        if (isMounted) setThemeId(storedThemeId);
      })
      .catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {supportsMeshGradient ? (
        <MeshGradientView
          meshWidth={MESH_DIMENSION}
          meshHeight={MESH_DIMENSION}
          points={MESH_POINTS}
          primaryColors={meshColors.primary}
          secondaryColors={meshColors.secondary}
          background={meshColors.background}
          smoothsColors
          colorSpace="device"
          isAnimated
          animationDuration={2400}
          animationType="sine"
          style={styles.background}
          pointerEvents="none"
        />
      ) : (
        <LinearGradient
          colors={[meshColors.primary[0], meshColors.primary[1], meshColors.primary[2]]}
          locations={[0, 0.6, 1]}
          style={styles.background}
          pointerEvents="none"
        />
      )}
      <LinearGradient
        colors={[
          "rgba(255,255,255,0.96)",
          "rgba(255,255,255,0.72)",
          "rgba(255,255,255,0)",
        ]}
        locations={[0, 0.38, 1]}
        start={{ x: 0.5, y: 1 }}
        end={{ x: 0.5, y: 0.5 }}
        style={styles.background}
        pointerEvents="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  background: {
    ...StyleSheet.absoluteFillObject,
  },
});
