// Cross-platform icon component.
// We intentionally avoid iOS-only dependencies (like expo-symbols) so the app can be
// downgraded to older Expo SDKs (e.g. SDK 51 for Android 6.0 / API 23 support).

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type { ComponentProps } from "react";
import type { OpaqueColorValue, StyleProp, TextStyle } from "react-native";

type IconMapping = Record<string, ComponentProps<typeof MaterialIcons>["name"]>;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the Icons Directory: https://icons.expo.fyi
 * - see SF Symbols in the SF Symbols app.
 */
const MAPPING: IconMapping = {
  "house.fill": "home",
  "paperplane.fill": "send",
  "wallet.pass.fill": "account-balance-wallet",
  "qrcode.viewfinder": "qr-code-scanner",
  qrcode: "qr-code",
  "map.fill": "map",
  "cart.fill": "shopping-cart",
  "bell.fill": "notifications",
  ellipsis: "more-horiz",
  plus: "add",
  magnifyingglass: "search",
  mic: "mic",
  photo: "photo",
  "lock.fill": "lock",
  "list.bullet": "format-list-bulleted",
  "location.fill": "location-on",
  "slider.horizontal.3": "tune",
  "chevron.down": "expand-more",
  "arrow.uturn.backward": "undo",
  "paintpalette.fill": "palette",
  "circle.lefthalf.filled": "brightness-6",
  "arrow.up": "arrow-upward",
  "arrow.down": "arrow-downward",
  "person.crop.circle": "account-circle",
  link: "link",
  "doc.on.doc": "content-copy",
  creditcard: "credit-card",
  "info.circle": "info-outline",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron-right",
  xmark: "close",
  "xmark.circle.fill": "cancel",
  cpu: "memory",
};

export type IconSymbolName = keyof typeof MAPPING;

/**
 * Icon names are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <MaterialIcons
      color={color}
      size={size}
      name={MAPPING[name]}
      style={style}
    />
  );
}
