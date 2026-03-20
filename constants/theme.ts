/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from "react-native";

const tintColorLight = "#0a7ea4";
const tintColorDark = "#fff";

export const Colors = {
  light: {
    text: "#11181C",
    background: "#fff",
    tint: tintColorLight,
    icon: "#687076",
    tabIconDefault: "#687076",
    tabIconSelected: tintColorLight,
    primary: "#7c6aff",
    primaryText: "#1A1A1A",
    secondaryText: "#6B7280",
    inputBorder: "#E5E5E5",
    buttonBorder: "#E5E5E5",
    surface: "#F8F9FB",
    surfaceMuted: "#F1F5F9",
    borderSubtle: "#E5E7EB",
    actionPrimary: "#111827",
    actionPrimaryText: "#FFFFFF",
    actionSecondary: "#F3F4F6",
    actionSecondaryText: "#111827",
    success: "#22C55E",
    accent: "#2563EB",
  },
  dark: {
    text: "#ECEDEE",
    background: "#151718",
    tint: tintColorDark,
    icon: "#9BA1A6",
    tabIconDefault: "#9BA1A6",
    tabIconSelected: tintColorDark,
    primary: "#7c6aff",
    primaryText: "#ECEDEE",
    secondaryText: "#9BA1A6",
    inputBorder: "#2A2B2C",
    buttonBorder: "#2A2B2C",
    surface: "#1C1C1E",
    surfaceMuted: "#2C2C2E",
    borderSubtle: "#2A2B2C",
    actionPrimary: "#F3F4F6",
    actionPrimaryText: "#0B0B0B",
    actionSecondary: "#2C2C2E",
    actionSecondaryText: "#F3F4F6",
    success: "#22C55E",
    accent: "#60A5FA",
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: "system-ui",
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: "ui-serif",
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: "ui-rounded",
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
