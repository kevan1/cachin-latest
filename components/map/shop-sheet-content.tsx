import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { IconSymbol } from "@/components/ui/icon-symbol";
import type { CachinShop } from "@/services/shopService";

const JEVI_LOGO = require("../../assets/images/jevi-logo.png");

function isJeviShop(shop: CachinShop): boolean {
  return shop.name.toLowerCase().includes("jevi");
}

function formatPaymentTarget(shop: CachinShop): string {
  if (shop.cachinUsername) return `@${shop.cachinUsername}`;
  if (shop.status === "prospect") return "Not onboarded yet";
  if (!shop.solanaAddress) return "Payment details unavailable";
  return `${shop.solanaAddress.slice(0, 4)}...${shop.solanaAddress.slice(-4)}`;
}

function ShopLogo({ shop, size = 44 }: { shop: CachinShop; size?: number }) {
  const localLogo = isJeviShop(shop) ? JEVI_LOGO : null;
  const logoStyle = {
    width: size,
    height: size,
    borderRadius: Math.max(12, size * 0.28),
  };

  if (shop.logoUrl) {
    return <Image source={{ uri: shop.logoUrl }} style={logoStyle} contentFit="contain" />;
  }

  if (localLogo) {
    return <Image source={localLogo} style={logoStyle} contentFit="contain" />;
  }

  return (
    <View style={[styles.initialLogo, logoStyle]}>
      <Text style={styles.initialLogoText}>{shop.name[0]?.toUpperCase() ?? "C"}</Text>
    </View>
  );
}

function ShopListRow({
  shop,
  onPress,
}: {
  shop: CachinShop;
  onPress: (shop: CachinShop) => void;
}) {
  const isProspect = shop.status === "prospect";

  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [styles.listRow, pressed && styles.pressedRow]}
      onPress={() => onPress(shop)}
    >
      <ShopLogo shop={shop} />
      <View style={styles.listRowText}>
        <Text numberOfLines={1} style={styles.listRowTitle}>
          {shop.name}
        </Text>
        <Text numberOfLines={1} style={styles.listRowSubtitle}>
          {shop.address}
        </Text>
      </View>
      <View style={[styles.categoryPill, isProspect && styles.prospectPill]}>
        <Text
          numberOfLines={1}
          style={[styles.categoryPillText, isProspect && styles.prospectPillText]}
        >
          {isProspect ? "Soon" : shop.category}
        </Text>
      </View>
      <IconSymbol name="chevron.right" size={20} color="rgba(255,255,255,0.55)" />
    </Pressable>
  );
}

export function ShopListContent({
  shops,
  isLoading,
  searchText,
  activeCategory,
  onSelectShop,
}: {
  shops: CachinShop[];
  isLoading: boolean;
  searchText: string;
  activeCategory: string | null;
  onSelectShop: (shop: CachinShop) => void;
}) {
  const hasFilter = !!searchText.trim() || !!activeCategory;
  const onboardedCount = shops.filter((shop) => shop.acceptsCachin).length;
  const prospectCount = shops.length - onboardedCount;

  return (
    <View style={styles.listContainer}>
      <View style={styles.sheetHeader}>
        <Text style={styles.sheetEyebrow}>Cachin shops</Text>
        <Text style={styles.sheetTitle}>Pay nearby</Text>
        <Text style={styles.sheetSubtitle}>
          {isLoading ? "Loading shops..." : `${onboardedCount} live · ${prospectCount} coming soon`}
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator color="#FFFFFF" />
        </View>
      ) : shops.length > 0 ? (
        <View style={styles.listRows}>
          {shops.map((shop) => (
            <ShopListRow key={shop.id} shop={shop} onPress={onSelectShop} />
          ))}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <IconSymbol name="map.fill" size={28} color="rgba(255,255,255,0.7)" />
          <Text style={styles.emptyTitle}>
            {hasFilter ? "No matching shops" : "No Cachin shops yet"}
          </Text>
          <Text style={styles.emptySubtitle}>
            {hasFilter
              ? "Try another search or clear the category filter."
              : "Prospect shops will appear here while onboarding starts."}
          </Text>
        </View>
      )}
    </View>
  );
}

export function ShopDetailContent({
  shop,
  onBack,
  onPay,
}: {
  shop: CachinShop;
  onBack: () => void;
  onPay: (shop: CachinShop) => void;
}) {
  const isProspect = shop.status === "prospect";
  const canPay = shop.acceptsCachin && Boolean(shop.cachinUsername || shop.solanaAddress);
  const statusLabel = isProspect
    ? "Coming soon"
    : shop.openStatus || shop.hoursLabel || "Accepts Cachin";

  return (
    <View style={styles.detailContainer}>
      <View style={styles.detailTopRow}>
        <Pressable accessibilityRole="button" style={styles.backButton} onPress={onBack}>
          <IconSymbol name="chevron.down" size={20} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.detailTopTitle}>Shop details</Text>
        <View style={styles.backButtonSpacer} />
      </View>

      <View style={styles.hero}>
        <Image source={{ uri: shop.imageUrl }} style={styles.heroImage} contentFit="cover" />
        <View style={styles.heroOverlay} />
        <View style={styles.heroLogo}>
          <ShopLogo shop={shop} size={52} />
        </View>
        <View style={styles.heroStatus}>
          <Text numberOfLines={1} style={styles.heroStatusText}>
            {statusLabel}
          </Text>
        </View>
      </View>

      <View style={styles.detailBody}>
        <Text style={styles.detailTitle}>{shop.name}</Text>
        <View style={styles.detailMetaRow}>
          <View style={styles.detailMetaPill}>
            <Text style={styles.detailMetaText}>{shop.category}</Text>
          </View>
          {shop.featured ? (
            <View style={styles.detailMetaPill}>
              <Text style={styles.detailMetaText}>Featured</Text>
            </View>
          ) : null}
          {isProspect ? (
            <View style={styles.detailMetaPill}>
              <Text style={styles.detailMetaText}>Prospect</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.infoRows}>
          <View style={styles.infoRow}>
            <IconSymbol name="location.fill" size={18} color="rgba(255,255,255,0.62)" />
            <Text style={styles.infoText}>{shop.address}</Text>
          </View>
          <View style={styles.infoRow}>
            <IconSymbol name="creditcard" size={18} color="rgba(255,255,255,0.62)" />
            <Text style={styles.infoText}>{formatPaymentTarget(shop)}</Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={!canPay}
          style={({ pressed }) => [
            styles.payButton,
            !canPay && styles.payButtonDisabled,
            pressed && canPay && styles.payButtonPressed,
          ]}
          onPress={() => onPay(shop)}
        >
          <Text style={styles.payButtonText}>
            {canPay
              ? "Pay with Cachin"
              : isProspect
                ? "Coming soon"
                : "Payment details unavailable"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  initialLogo: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4F7FA",
  },
  initialLogoText: {
    color: "#111114",
    fontSize: 17,
    fontWeight: "800",
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 36,
    gap: 16,
  },
  sheetHeader: {
    alignItems: "center",
    gap: 3,
  },
  sheetEyebrow: {
    color: "rgba(255,255,255,0.52)",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  sheetTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "800",
  },
  sheetSubtitle: {
    color: "rgba(255,255,255,0.66)",
    fontSize: 14,
    fontWeight: "600",
  },
  loadingState: {
    minHeight: 110,
    alignItems: "center",
    justifyContent: "center",
  },
  listRows: {
    gap: 10,
  },
  listRow: {
    minHeight: 74,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 18,
    borderCurve: "continuous",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.1)",
  },
  pressedRow: {
    opacity: 0.78,
  },
  listRowText: {
    flex: 1,
    gap: 3,
  },
  listRowTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  listRowSubtitle: {
    color: "rgba(255,255,255,0.56)",
    fontSize: 13,
    fontWeight: "600",
  },
  categoryPill: {
    maxWidth: 90,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  prospectPill: {
    backgroundColor: "rgba(255, 214, 10, 0.16)",
  },
  categoryPillText: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 12,
    fontWeight: "800",
  },
  prospectPillText: {
    color: "#FFD60A",
  },
  emptyState: {
    minHeight: 160,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 28,
  },
  emptyTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
  emptySubtitle: {
    color: "rgba(255,255,255,0.58)",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  detailContainer: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 36,
    gap: 14,
  },
  detailTopRow: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  backButtonSpacer: {
    width: 34,
    height: 34,
  },
  detailTopTitle: {
    color: "rgba(255,255,255,0.64)",
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  hero: {
    height: 164,
    overflow: "hidden",
    borderRadius: 24,
    borderCurve: "continuous",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.14)",
  },
  heroLogo: {
    position: "absolute",
    left: 14,
    bottom: 14,
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  heroStatus: {
    position: "absolute",
    top: 14,
    left: 14,
    right: 14,
    alignItems: "flex-start",
  },
  heroStatusText: {
    overflow: "hidden",
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.92)",
    color: "#111114",
    fontSize: 12,
    fontWeight: "800",
  },
  detailBody: {
    gap: 14,
  },
  detailTitle: {
    color: "#FFFFFF",
    fontSize: 25,
    lineHeight: 30,
    fontWeight: "900",
  },
  detailMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  detailMetaPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  detailMetaText: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 12,
    fontWeight: "800",
  },
  infoRows: {
    gap: 10,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  infoText: {
    flex: 1,
    color: "rgba(255,255,255,0.72)",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  payButton: {
    minHeight: 52,
    borderRadius: 26,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    marginTop: 2,
  },
  payButtonPressed: {
    opacity: 0.86,
  },
  payButtonDisabled: {
    opacity: 0.42,
  },
  payButtonText: {
    color: "#111114",
    fontSize: 16,
    fontWeight: "800",
  },
});
