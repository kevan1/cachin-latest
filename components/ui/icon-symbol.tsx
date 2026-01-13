// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type IconMapping = Record<
  string,
  ComponentProps<typeof MaterialIcons>["name"]
>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING: IconMapping = {
  "house.fill": "home",
  "paperplane.fill": "send",
  "wallet.pass.fill": "account-balance-wallet",
  "qrcode.viewfinder": "qr-code-scanner",
  "qrcode": "qr-code",
  "map.fill": "map",
  "cart.fill": "shopping-cart",
  "bell.fill": "notifications",
  "ellipsis": "more-horiz",
  "plus": "add",
  "magnifyingglass": "search",
  "arrow.up": "arrow-upward",
  "arrow.down": "arrow-downward",
  "doc.on.doc": "content-copy",
  "creditcard": "credit-card",
  "info.circle": "info-outline",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron-right",
  "xmark": "close",
};

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
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
