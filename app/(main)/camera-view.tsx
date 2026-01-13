import { useCallback } from "react";
import { StyleSheet, View, useColorScheme } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Colors } from "@/constants/theme";

export default function CameraViewScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";
  const palette = Colors[colorScheme];

  useFocusEffect(
    useCallback(() => {
      router.replace({
        pathname: "/scanner",
        params: { openQr: Date.now().toString() },
      });
    }, [router])
  );

  return <View style={[styles.container, { backgroundColor: palette.background }]} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
