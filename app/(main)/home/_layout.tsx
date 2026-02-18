import { Stack } from "expo-router";
import { useColorScheme } from "react-native";

export default function HomeLayout() {
  const theme = useColorScheme() ?? "light";
  const blurEffect =
    theme === "dark" ? "systemMaterialDark" : "systemMaterialLight";

  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          headerLargeTitle: false,
          headerTransparent: true,
          headerTintColor: theme === "dark" ? "white" : "black",
          headerLargeStyle: { backgroundColor: "transparent" },
          headerBlurEffect: blurEffect,
          title: "",
          headerTitle: "",
        }}
      />
    </Stack>
  );
}
