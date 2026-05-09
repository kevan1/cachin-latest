import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";
import type { CachinShop } from "@/services/shopService";

const JEVI_LOGO = require("../../assets/images/jevi-logo.png");

function isJeviShop(shop: CachinShop): boolean {
  return shop.name.toLowerCase().includes("jevi");
}

function getShopInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function ShopMarker({
  shop,
  isSelected,
}: {
  shop: CachinShop;
  isSelected: boolean;
}) {
  const markerLabel = shop.name.split(" ")[0] || shop.category;
  const localLogo = isJeviShop(shop) ? JEVI_LOGO : null;
  const isProspect = shop.status === "prospect";

  return (
    <View collapsable={false} style={styles.container}>
      {shop.featured || isProspect ? (
        <View style={[styles.featuredBubble, isProspect && styles.prospectBubble]}>
          <Text style={[styles.featuredText, isProspect && styles.prospectText]}>
            {isProspect ? "Soon" : "Cachin"}
          </Text>
        </View>
      ) : null}

      <View
        style={[
          styles.marker,
          isProspect && styles.prospectMarker,
          isSelected && styles.selectedMarker,
        ]}
      >
        {shop.logoUrl ? (
          <Image source={{ uri: shop.logoUrl }} style={styles.logoImage} contentFit="contain" />
        ) : localLogo ? (
          <Image source={localLogo} style={styles.logoImage} contentFit="contain" />
        ) : (
          <Text style={styles.initials}>{getShopInitials(shop.name)}</Text>
        )}
      </View>

      <View
        style={[
          styles.arrow,
          isProspect && styles.prospectArrow,
          isSelected && styles.selectedArrow,
        ]}
      />
      <Text
        numberOfLines={1}
        style={[
          styles.label,
          isProspect && styles.prospectLabel,
          isSelected && styles.selectedLabel,
        ]}
      >
        {markerLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 112,
    minHeight: 92,
    paddingHorizontal: 10,
    paddingTop: 4,
    paddingBottom: 8,
    alignItems: "center",
    justifyContent: "flex-end",
    backgroundColor: "rgba(255,255,255,0.001)",
  },
  featuredBubble: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    marginBottom: 4,
    backgroundColor: "#111114",
  },
  featuredText: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "700",
  },
  prospectBubble: {
    backgroundColor: "#FFD60A",
  },
  prospectText: {
    color: "#111114",
  },
  marker: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderCurve: "continuous",
    backgroundColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
    boxShadow: "0 4px 10px rgba(0, 0, 0, 0.24)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  selectedMarker: {
    transform: [{ scale: 1.12 }],
    borderColor: "#111114",
    borderWidth: 2,
  },
  prospectMarker: {
    backgroundColor: "#FFF8D6",
    borderColor: "rgba(0,0,0,0.08)",
  },
  logoImage: {
    width: 26,
    height: 26,
  },
  initials: {
    color: "#111114",
    fontSize: 13,
    fontWeight: "800",
  },
  arrow: {
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderStyle: "solid",
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 0,
    borderTopWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#FFF",
    marginTop: -1,
    marginBottom: 2,
  },
  selectedArrow: {
    borderTopColor: "#111114",
  },
  prospectArrow: {
    borderTopColor: "#FFF8D6",
  },
  label: {
    maxWidth: 104,
    fontSize: 12,
    color: "#44484F",
    backgroundColor: "rgba(255,255,255,0.88)",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
    overflow: "hidden",
  },
  selectedLabel: {
    color: "#111114",
    fontWeight: "800",
  },
  prospectLabel: {
    backgroundColor: "rgba(255,248,214,0.94)",
  },
});
