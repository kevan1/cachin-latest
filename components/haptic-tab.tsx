import { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { PlatformPressable } from "@react-navigation/elements";
import * as Haptics from "expo-haptics";
import type { StyleProp, ViewStyle } from "react-native";

export function HapticTab(props: BottomTabBarButtonProps) {
  const roundedStyle: StyleProp<ViewStyle> = [
    props.style,
    {
      borderRadius: 26,
      overflow: "hidden",
    },
  ];

  return (
    <PlatformPressable
      {...props}
      style={roundedStyle}
      onPressIn={(ev) => {
        if (process.env.EXPO_OS === "ios") {
          // Add a soft haptic feedback when pressing down on the tabs.
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        props.onPressIn?.(ev);
      }}
    />
  );
}
