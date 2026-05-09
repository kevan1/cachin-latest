import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
  useWindowDimensions,
} from "react-native";
import MapView, {
  Marker,
  PROVIDER_GOOGLE,
  UrlTile,
} from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MapFilterChips } from "@/components/MapFilterChips";
import {
  ShopDetailContent,
  ShopListContent,
} from "@/components/map/shop-sheet-content";
import { ShopMarker } from "@/components/map/shop-marker";
import { GlassView } from "@/components/ui/GlassView";
import { IconSymbol } from "@/components/ui/icon-symbol";
import {
  getOnboardedShops,
  type CachinShop,
} from "@/services/shopService";

type MapSearchBarProps = {
  placeholder?: string;
  onChangeText?: (text: string) => void;
  value?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  onListPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

const INITIAL_REGION = {
  latitude: -34.5959,
  longitude: -58.4326,
  latitudeDelta: 0.0422,
  longitudeDelta: 0.0221,
};

const SELECTED_REGION_DELTA = {
  latitudeDelta: 0.018,
  longitudeDelta: 0.012,
};

const USER_LOCATION_REGION_DELTA = {
  latitudeDelta: 0.012,
  longitudeDelta: 0.008,
};

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase();
}

const SearchBar: React.FC<MapSearchBarProps> = ({
  placeholder = "Search...",
  onChangeText,
  value,
  onFocus,
  onBlur,
  onListPress,
  style,
}) => {
  return (
    <View style={[searchStyles.container, style]}>
      <GlassView style={searchStyles.searchContainer} intensity={24}>
        <View style={searchStyles.leadingIconPadding}>
          <IconSymbol name="magnifyingglass" color="#8E8E93" size={20} />
        </View>
        <TextInput
          placeholder={placeholder}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholderTextColor="#8E8E93"
          style={searchStyles.input}
          onChangeText={onChangeText}
          value={value}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
      </GlassView>
      <View style={searchStyles.avatarContainer}>
        <Pressable
          accessibilityRole="button"
          onPress={onListPress}
          style={({ pressed }) => [
            searchStyles.listButton,
            pressed && searchStyles.listButtonPressed,
          ]}
        >
          <IconSymbol name="list.bullet" color="#000" size={20} />
        </Pressable>
      </View>
    </View>
  );
};

const searchStyles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    gap: 12,
  },
  searchContainer: {
    flex: 1,
    borderRadius: 99,
    borderCurve: "continuous",
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.05)",
    backgroundColor: "#fff",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
  },
  leadingIconPadding: {
    paddingLeft: 15,
  },
  input: {
    flex: 1,
    paddingHorizontal: 10,
    paddingRight: 15,
    fontSize: 17,
    color: "#000",
    height: "100%",
  },
  avatarContainer: {
    width: 50,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  listButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderCurve: "continuous",
    backgroundColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
  },
  listButtonPressed: {
    opacity: 0.76,
  },
});

const Maps: React.FC = (): React.ReactElement => {
  const router = useRouter();
  const bottomSheetRef = useRef<BottomSheet>(null);
  const mapRef = useRef<MapView>(null);
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const isAndroid = Platform.OS === "android";

  const [shops, setShops] = useState<CachinShop[]>([]);
  const [isLoadingShops, setIsLoadingShops] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [isLocatingUser, setIsLocatingUser] = useState(false);

  const googleMapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
    ?.trim()
    .replace(/^['"]|['"]$/g, "");
  const hasAndroidGoogleMapsKey =
    !isAndroid || /^AIza[A-Za-z0-9_-]{35}$/.test(googleMapsKey ?? "");

  useEffect(() => {
    let isMounted = true;

    Location.getForegroundPermissionsAsync()
      .then((permission) => {
        if (!isMounted) return;
        setHasLocationPermission(permission.granted);
      })
      .catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadShops = async () => {
      setIsLoadingShops(true);
      const nextShops = await getOnboardedShops();
      if (!isMounted) return;
      setShops(nextShops);
      setIsLoadingShops(false);
    };

    void loadShops();

    return () => {
      isMounted = false;
    };
  }, []);

  const categories = useMemo(() => {
    return Array.from(new Set(shops.map((shop) => shop.category).filter(Boolean))).sort(
      (a, b) => a.localeCompare(b)
    );
  }, [shops]);

  useEffect(() => {
    if (activeCategory && !categories.includes(activeCategory)) {
      setActiveCategory(null);
    }
  }, [activeCategory, categories]);

  const filteredShops = useMemo(() => {
    const normalizedSearch = normalizeSearch(searchText);

    return shops.filter((shop) => {
      const matchesCategory = !activeCategory || shop.category === activeCategory;
      if (!matchesCategory) return false;

      if (!normalizedSearch) return true;

      return (
        shop.name.toLowerCase().includes(normalizedSearch) ||
        shop.address.toLowerCase().includes(normalizedSearch) ||
        shop.category.toLowerCase().includes(normalizedSearch) ||
        shop.cachinUsername?.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [activeCategory, searchText, shops]);

  const selectedShop = useMemo(
    () => filteredShops.find((shop) => shop.id === selectedShopId) ?? null,
    [filteredShops, selectedShopId]
  );

  useEffect(() => {
    if (selectedShopId && !filteredShops.some((shop) => shop.id === selectedShopId)) {
      setSelectedShopId(null);
      bottomSheetRef.current?.collapse();
    }
  }, [filteredShops, selectedShopId]);

  const snapPoints = useMemo(() => ["32%", "58%", "88%"], []);
  const sheetContentBottomPadding = isAndroid
    ? 132
    : Math.max(insets.bottom + 104, 140);
  const navBarScrimHeight = isAndroid
    ? 96
    : Math.max(insets.bottom + 58, 92);
  const topInset = insets.top + 118;
  const locationButtonBottom = Math.round(windowHeight * 0.32) + 18;

  const focusShopOnMap = useCallback((shop: CachinShop) => {
    mapRef.current?.animateToRegion(
      {
        latitude: shop.latitude,
        longitude: shop.longitude,
        ...SELECTED_REGION_DELTA,
      },
      360
    );
  }, []);

  const handleSelectShop = useCallback(
    (shop: CachinShop) => {
      setSelectedShopId(shop.id);
      focusShopOnMap(shop);
      bottomSheetRef.current?.snapToIndex(1);
    },
    [focusShopOnMap]
  );

  const handleClearSelection = useCallback(() => {
    setSelectedShopId(null);
    bottomSheetRef.current?.collapse();
  }, []);

  const handleOpenList = useCallback(() => {
    setSelectedShopId(null);
    bottomSheetRef.current?.snapToIndex(2);
  }, []);

  const focusUserLocationOnMap = useCallback(
    (coordinate: { latitude: number; longitude: number }) => {
      setSelectedShopId(null);
      bottomSheetRef.current?.collapse();
      mapRef.current?.animateToRegion(
        {
          ...coordinate,
          ...USER_LOCATION_REGION_DELTA,
        },
        360
      );
    },
    []
  );

  const handleFocusUserLocation = useCallback(async () => {
    setIsLocatingUser(true);

    try {
      const currentPermission = await Location.getForegroundPermissionsAsync();
      const permission = currentPermission.granted
        ? currentPermission
        : await Location.requestForegroundPermissionsAsync();

      setHasLocationPermission(permission.granted);

      if (!permission.granted) {
        return;
      }

      const currentPosition = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const nextLocation = {
        latitude: currentPosition.coords.latitude,
        longitude: currentPosition.coords.longitude,
      };

      focusUserLocationOnMap(nextLocation);
    } catch (error) {
      console.warn("[Map] Failed to get current location", error);
    } finally {
      setIsLocatingUser(false);
    }
  }, [focusUserLocationOnMap]);

  const handlePayWithCachin = useCallback(
    (shop: CachinShop) => {
      const username = shop.cachinUsername?.trim();
      if (username) {
        router.push({
          pathname: "/send-amount",
          params: {
            recipient: username,
            username,
          },
        });
        return;
      }

      const address = shop.solanaAddress?.trim();
      if (address) {
        router.push({
          pathname: "/send-amount",
          params: {
            recipient: shop.name,
            address,
          },
        });
      }
    },
    [router]
  );

  return (
    <View style={styles.container}>
      <SearchBar
        style={{ top: insets.top + 8 }}
        onFocus={() => undefined}
        placeholder="Search Cachin shops"
        value={searchText}
        onChangeText={setSearchText}
        onListPress={handleOpenList}
      />

      <View style={[styles.filterChipsContainer, { top: insets.top + 72 }]}>
        <MapFilterChips
          activeCategory={activeCategory}
          categories={categories}
          onCategoryPress={setActiveCategory}
        />
      </View>

      <MapView
        ref={mapRef}
        provider={isAndroid ? PROVIDER_GOOGLE : undefined}
        mapType={isAndroid && !hasAndroidGoogleMapsKey ? "none" : "standard"}
        showsTraffic={false}
        showsUserLocation={hasLocationPermission}
        showsMyLocationButton={false}
        style={styles.map}
        showsCompass={false}
        showsIndoors={false}
        showsScale={false}
        showsPointsOfInterests={false}
        customMapStyle={[
          {
            featureType: "poi",
            elementType: "labels",
            stylers: [{ visibility: "off" }],
          },
        ]}
        initialRegion={INITIAL_REGION}
        onPress={handleClearSelection}
      >
        {isAndroid && !hasAndroidGoogleMapsKey && (
          <UrlTile
            maximumZ={19}
            urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        )}

        {filteredShops.map((shop) => (
          <Marker
            key={shop.id}
            coordinate={{ latitude: shop.latitude, longitude: shop.longitude }}
            stopPropagation
            onPress={() => handleSelectShop(shop)}
          >
            <ShopMarker shop={shop} isSelected={selectedShopId === shop.id} />
          </Marker>
        ))}
      </MapView>

      {isAndroid && !hasAndroidGoogleMapsKey && (
        <View style={[styles.warningBanner, { top: insets.top + 130 }]}>
          <Text style={styles.warningText}>
            Android Google Maps key inválida. Mostrando mapa base OpenStreetMap.
          </Text>
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Center map on current location"
        onPress={handleFocusUserLocation}
        style={({ pressed }) => [
          styles.locationButton,
          { bottom: locationButtonBottom },
          isLocatingUser && styles.locationButtonLocating,
          pressed && styles.locationButtonPressed,
        ]}
      >
        <IconSymbol
          name="location.fill"
          size={21}
          color={isLocatingUser ? "#007AFF" : "#111114"}
        />
      </Pressable>

      <BottomSheet
        ref={bottomSheetRef}
        index={0}
        snapPoints={snapPoints}
        topInset={topInset}
        bottomInset={0}
        enablePanDownToClose={false}
        backgroundStyle={styles.bottomSheetBackground}
        handleIndicatorStyle={styles.handleIndicator}
      >
        <BottomSheetScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: sheetContentBottomPadding },
          ]}
        >
          {selectedShop ? (
            <ShopDetailContent
              shop={selectedShop}
              onBack={handleClearSelection}
              onPay={handlePayWithCachin}
            />
          ) : (
            <ShopListContent
              shops={filteredShops}
              isLoading={isLoadingShops}
              searchText={searchText}
              activeCategory={activeCategory}
              onSelectShop={handleSelectShop}
            />
          )}
        </BottomSheetScrollView>
      </BottomSheet>

      <View
        pointerEvents="none"
        style={[styles.navBarScrim, { height: navBarScrimHeight }]}
      >
        <BlurView
          intensity={18}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={[
            "rgba(0,0,0,0)",
            "rgba(0,0,0,0.34)",
            "rgba(0,0,0,0.78)",
          ]}
          locations={[0, 0.54, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>
    </View>
  );
};

export default Maps;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  filterChipsContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 9,
  },
  warningBanner: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 15,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "rgba(255, 196, 0, 0.92)",
  },
  warningText: {
    color: "#272400",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  locationButton: {
    position: "absolute",
    right: 18,
    zIndex: 18,
    width: 48,
    height: 48,
    borderRadius: 24,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.18)",
  },
  locationButtonPressed: {
    transform: [{ scale: 0.96 }],
  },
  locationButtonLocating: {
    borderColor: "rgba(0, 122, 255, 0.34)",
  },
  bottomSheetBackground: {
    backgroundColor: "rgba(22, 22, 24, 0.98)",
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    boxShadow: "0 12px 24px rgba(0, 0, 0, 0.55)",
  },
  handleIndicator: {
    width: 44,
    backgroundColor: "rgba(255,255,255,0.42)",
  },
  scrollContent: {
    paddingTop: 8,
  },
  navBarScrim: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 30,
  },
});
