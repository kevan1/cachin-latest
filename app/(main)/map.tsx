import type { RecentCardProps, SearchBarProps } from "@/typings/index";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { Image } from "expo-image";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Linking,
  PermissionsAndroid,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, UrlTile } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MapFilterChips, type MerchantCategory } from "@/components/MapFilterChips";
import { GlassView } from "@/components/ui/GlassView";
import { IconSymbol } from "@/components/ui/icon-symbol";

const JEVI_LOGO = require("../../assets/images/jevi-logo.png");

type MapLocation = {
  id: string;
  title: string;
  coordinate: {
    latitude: number;
    longitude: number;
  };
  category: MerchantCategory;
  image: string;
  rating: number;
  distance: string;
  openStatus: string;
  address: string;
  discount?: string;
  acceptsCachin?: boolean;
};

const LOCATIONS: MapLocation[] = [
  {
    id: "1",
    title: "Tazzino - Villa Crespo",
    coordinate: { latitude: -34.5959, longitude: -58.4326 },
    category: "Coffee",
    image:
      "https://images.unsplash.com/photo-1554118811-1e0d58224f24?q=80&w=1000&auto=format&fit=crop",
    rating: 4.8,
    discount: "-20%",
    distance: "200 m",
    openStatus: "Abre Mar 08:30hs",
    address: "Av. Corrientes 5000",
    acceptsCachin: true,
  },
  {
    id: "2",
    title: "4090 Burger & Fries",
    coordinate: { latitude: -34.5843, longitude: -58.4286 },
    category: "Burger",
    image:
      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=1000&auto=format&fit=crop",
    rating: 5.0,
    discount: "-25%",
    distance: "1.2 km",
    openStatus: "Abierto ahora",
    address: "Nicaragua 4090",
    acceptsCachin: true,
  },
  {
    id: "3",
    title: "Quebracho Bar",
    coordinate: { latitude: -34.587, longitude: -58.43 },
    category: "Bar",
    image:
      "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?q=80&w=1000&auto=format&fit=crop",
    rating: 4.5,
    distance: "800 m",
    openStatus: "Cierra 02:00hs",
    address: "Humboldt 1500",
  },
  {
    id: "4",
    title: "Supermercado Coto",
    coordinate: { latitude: -34.6, longitude: -58.42 },
    category: "Supermarket",
    image:
      "https://images.unsplash.com/photo-1534723452862-4c874018d66d?q=80&w=1000&auto=format&fit=crop",
    rating: 4.2,
    distance: "1.5 km",
    openStatus: "Abierto 24hs",
    address: "Av. Diaz Velez 4500",
    acceptsCachin: true,
  },
  {
    id: "5",
    title: "Zara - Palermo Soho",
    coordinate: { latitude: -34.5889, longitude: -58.4225 },
    category: "Clothes",
    image:
      "https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1000&auto=format&fit=crop",
    rating: 4.6,
    distance: "1.8 km",
    openStatus: "Abre 10:00hs",
    address: "Gurruchaga 1500",
  },
  {
    id: "jevi-1",
    title: "El Jevi Kiosco - Charcas",
    coordinate: { latitude: -34.5903433, longitude: -58.4139933 },
    category: "Kiosko",
    image:
      "https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=1000&auto=format&fit=crop",
    rating: 4.4,
    distance: "900 m",
    openStatus: "Abierto 24hs",
    address: "Charcas 3405, CABA",
    acceptsCachin: true,
  },
  {
    id: "jevi-2",
    title: "El Jevi Kiosco - Pueyrredon",
    coordinate: { latitude: -34.5959475, longitude: -58.4030948 },
    category: "Kiosko",
    image:
      "https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=1000&auto=format&fit=crop",
    rating: 4.5,
    distance: "1.2 km",
    openStatus: "Abierto 24hs",
    address: "Av. Pueyrredon 1270, CABA",
    acceptsCachin: true,
  },
  {
    id: "jevi-3",
    title: "El Jevi Kiosco - Cabrera",
    coordinate: { latitude: -34.5966556, longitude: -58.4156186 },
    category: "Kiosko",
    image:
      "https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=1000&auto=format&fit=crop",
    rating: 4.4,
    distance: "1.0 km",
    openStatus: "Abierto 24hs",
    address: "Cabrera 3501, CABA",
    acceptsCachin: true,
  },
  {
    id: "jevi-4",
    title: "El Jevi Kiosco - Scalabrini Ortiz",
    coordinate: { latitude: -34.5907049, longitude: -58.4250183 },
    category: "Kiosko",
    image:
      "https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=1000&auto=format&fit=crop",
    rating: 4.5,
    distance: "1.6 km",
    openStatus: "Abierto 24hs",
    address: "Av. Raul Scalabrini Ortiz 1602, CABA",
    acceptsCachin: true,
  },
];

type MapSearchBarProps = SearchBarProps & {
  topOffset: number;
};

const SearchBar: React.FC<MapSearchBarProps> = ({
  placeholder = "Search...",
  onChangeText,
  value,
  onFocus,
  onBlur,
  topOffset,
}) => {
  return (
    <View style={[searchStyles.container, { top: topOffset }]}>
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
        />
        <View style={searchStyles.trailingIconPadding}>
          <IconSymbol name="mic" color="#8E8E93" size={20} />
        </View>
      </GlassView>
      <View style={searchStyles.avatarContainer}>
        <View style={searchStyles.listButton}>
          <IconSymbol name="list.bullet" color="#000" size={20} />
        </View>
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
    justifyContent: "space-between",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.05)",
    backgroundColor: "#fff",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
  },
  leadingIconPadding: {
    paddingLeft: 15,
  },
  trailingIconPadding: {
    paddingRight: 15,
  },
  input: {
    flex: 1,
    paddingHorizontal: 10,
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
});

const RecentCard: React.FC<RecentCardProps> = ({
  icon,
  iconColor,
  iconBackground,
  title,
  subtitle,
  onPress,
}) => {
  return (
    <View style={recentCardStyles.wrapper}>
      <Pressable style={recentCardStyles.container} onPress={onPress}>
        <View
          style={[
            recentCardStyles.iconContainer,
            { backgroundColor: iconBackground },
          ]}
        >
          <IconSymbol name={icon} size={24} color={iconColor} />
        </View>
        <View style={recentCardStyles.textContainer}>
          <Text style={recentCardStyles.title}>{title}</Text>
          <Text style={recentCardStyles.subtitle}>{subtitle}</Text>
        </View>
      </Pressable>
    </View>
  );
};

const recentCardStyles = StyleSheet.create({
  wrapper: {
    backgroundColor: "rgba(58, 58, 60, 0.6)",
    borderRadius: 12,
    marginBottom: 8,
    overflow: "hidden",
  },
  container: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
  },
  subtitle: {
    color: "#8E8E93",
    fontSize: 15,
  },
});

function getStatusTone(openStatus: string) {
  if (openStatus.includes("Abierto")) return "open";
  if (openStatus.includes("Cierra")) return "closing";
  if (openStatus.includes("Abre")) return "closed";
  return "neutral";
}

const LocationCard = ({
  location,
  onClose,
}: {
  location: MapLocation;
  onClose: () => void;
}) => {
  const openMaps = () => {
    const isIos = process.env.EXPO_OS === "ios";
    const scheme = isIos ? "maps:0,0?q=" : "geo:0,0?q=";
    const latLng = `${location.coordinate.latitude},${location.coordinate.longitude}`;
    const label = location.title;
    const url = isIos ? `${scheme}${label}@${latLng}` : `${scheme}${latLng}(${label})`;

    void Linking.openURL(url);
  };

  const tone = getStatusTone(location.openStatus);
  const isJevi = location.id.startsWith("jevi-") || location.category === "Kiosko";

  return (
    <View style={locationCardStyles.container}>
      <View style={locationCardStyles.card}>
        <View style={locationCardStyles.imageContainer}>
          <Image
            source={{ uri: location.image }}
            style={locationCardStyles.image}
            contentFit="cover"
          />
          <View
            style={[
              locationCardStyles.statusTag,
              tone === "open" && locationCardStyles.statusTagOpen,
              tone === "closing" && locationCardStyles.statusTagClosing,
              tone === "closed" && locationCardStyles.statusTagClosed,
            ]}
          >
            <Text
              style={[
                locationCardStyles.statusText,
                tone === "open" && locationCardStyles.statusTextOpen,
                tone === "closing" && locationCardStyles.statusTextClosing,
                tone === "closed" && locationCardStyles.statusTextClosed,
              ]}
            >
              {location.openStatus}
            </Text>
          </View>
          <View style={locationCardStyles.logoContainer}>
            {isJevi ? (
              <Image
                source={JEVI_LOGO}
                style={locationCardStyles.logoImage}
                contentFit="contain"
              />
            ) : (
              <View style={locationCardStyles.genericLogo} />
            )}
          </View>
          <Pressable style={locationCardStyles.closeButton} onPress={onClose}>
            <IconSymbol name="xmark" size={16} color="#111827" />
          </Pressable>
        </View>

        <View style={locationCardStyles.content}>
          <Text style={locationCardStyles.title}>{location.title}</Text>

          <View style={locationCardStyles.metaRow}>
            <View style={locationCardStyles.categoryTag}>
              <Text style={locationCardStyles.categoryTagText}>{location.category}</Text>
            </View>
            <Text style={locationCardStyles.ratingText}>★ {location.rating.toFixed(1)}</Text>
            <Text style={locationCardStyles.distanceText}>🏃 {location.distance}</Text>
          </View>

          <View
            style={[
              locationCardStyles.openStatusBadge,
              tone === "open" && locationCardStyles.openStatusBadgeOpen,
              tone === "closing" && locationCardStyles.openStatusBadgeClosing,
              tone === "closed" && locationCardStyles.openStatusBadgeClosed,
            ]}
          >
            <Text
              style={[
                locationCardStyles.openStatusBadgeText,
                tone === "open" && locationCardStyles.openStatusBadgeTextOpen,
                tone === "closing" && locationCardStyles.openStatusBadgeTextClosing,
                tone === "closed" && locationCardStyles.openStatusBadgeTextClosed,
              ]}
            >
              {location.openStatus}
            </Text>
          </View>

          <View style={locationCardStyles.actionsRow}>
            <Pressable style={locationCardStyles.directionsButton} onPress={openMaps}>
              <IconSymbol name="location.fill" size={18} color="#FFFFFF" />
              <Text style={locationCardStyles.directionsButtonText}>Cómo llegar</Text>
            </Pressable>

            {location.acceptsCachin ? (
              <Pressable style={locationCardStyles.payButton}>
                <IconSymbol name="creditcard" size={16} color="#FFFFFF" />
                <Text style={locationCardStyles.payButtonText}>Pagar con Cachin</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
};

const locationCardStyles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 100,
    left: 20,
    right: 20,
    zIndex: 20,
  },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 20,
    borderCurve: "continuous",
    overflow: "hidden",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)",
  },
  imageContainer: {
    height: 160,
    width: "100%",
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  statusTag: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  statusText: {
    color: "#0F172A",
    fontSize: 12,
    fontWeight: "700",
  },
  statusTagOpen: {
    backgroundColor: "#DCFCE7",
  },
  statusTextOpen: {
    color: "#166534",
  },
  statusTagClosing: {
    backgroundColor: "#FFEDD5",
  },
  statusTextClosing: {
    color: "#9A3412",
  },
  statusTagClosed: {
    backgroundColor: "#FFE4E6",
  },
  statusTextClosed: {
    color: "#9F1239",
  },
  logoContainer: {
    position: "absolute",
    bottom: 12,
    left: 12,
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#FFD700",
    justifyContent: "center",
    alignItems: "center",
  },
  logoImage: {
    width: 22,
    height: 22,
  },
  genericLogo: {
    width: 18,
    height: 18,
    borderRadius: 5,
    backgroundColor: "#EF4444",
  },
  closeButton: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    padding: 16,
    gap: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#000",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryTag: {
    backgroundColor: "#EEF2FF",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  categoryTagText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#3730A3",
  },
  ratingText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
  },
  distanceText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4B5563",
  },
  openStatusBadge: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#F8FAFC",
  },
  openStatusBadgeText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  openStatusBadgeOpen: {
    backgroundColor: "#DCFCE7",
  },
  openStatusBadgeTextOpen: {
    color: "#166534",
  },
  openStatusBadgeClosing: {
    backgroundColor: "#FFEDD5",
  },
  openStatusBadgeTextClosing: {
    color: "#9A3412",
  },
  openStatusBadgeClosed: {
    backgroundColor: "#FFE4E6",
  },
  openStatusBadgeTextClosed: {
    color: "#9F1239",
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  directionsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111827",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
  },
  directionsButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  payButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
  },
  payButtonText: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "800",
  },
});

const MarkerContent = ({
  location,
  isSelected,
}: {
  location: MapLocation;
  isSelected: boolean;
}) => {
  const isJevi = location.id.startsWith("jevi-") || location.category === "Kiosko";
  const markerLabel = isJevi ? "EL Jevi" : location.title.split(" ")[0];

  return (
    <View style={markerStyles.container}>
      {location.discount && (
        <View style={markerStyles.discountBubble}>
          <Text style={markerStyles.discountText}>{location.discount}</Text>
        </View>
      )}
      <View style={[markerStyles.marker, isSelected && markerStyles.selectedMarker]}>
        {isJevi ? (
          <Image source={JEVI_LOGO} style={markerStyles.jeviLogo} contentFit="contain" />
        ) : (
          <>
            {location.category === "Coffee" && <Text>☕</Text>}
            {location.category === "Burger" && <Text>🍔</Text>}
            {location.category === "Bar" && <Text>🍸</Text>}
            {location.category === "Supermarket" && <Text>🛒</Text>}
            {location.category === "Clothes" && <Text>👕</Text>}
            {location.category === "Kiosko" && <Text>🧃</Text>}
          </>
        )}
        <View style={markerStyles.ratingBadge}>
          <Text style={markerStyles.ratingBadgeText}>{location.rating.toFixed(1)}</Text>
        </View>
      </View>
      <View style={markerStyles.arrow} />
      <Text style={[markerStyles.label, isSelected && markerStyles.selectedLabel]}>
        {markerLabel}
      </Text>
    </View>
  );
};

const markerStyles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  discountBubble: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
    backgroundColor: "#333",
  },
  discountText: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "700",
  },
  marker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderCurve: "continuous",
    backgroundColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  selectedMarker: {
    transform: [{ scale: 1.1 }],
    borderColor: "#000",
    borderWidth: 2,
  },
  jeviLogo: {
    width: 22,
    height: 22,
  },
  ratingBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#000",
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  ratingBadgeText: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "700",
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
    boxShadow: "0 2px 2px rgba(0, 0, 0, 0.1)",
  },
  label: {
    fontSize: 12,
    color: "#555",
    marginTop: 2,
    backgroundColor: "rgba(255,255,255,0.8)",
    paddingHorizontal: 4,
    borderRadius: 4,
    overflow: "hidden",
  },
  selectedLabel: {
    color: "#000",
    fontWeight: "700",
  },
});

const Maps: React.FC = (): React.ReactElement => {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const insets = useSafeAreaInsets();
  const isAndroid = Platform.OS === "android";

  const [searchText, setSearchText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<MerchantCategory | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(
    Platform.OS !== "android"
  );

  const googleMapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim().replace(/^['"]|['"]$/g, "");
  const hasAndroidGoogleMapsKey =
    !isAndroid || /^AIza[A-Za-z0-9_-]{35}$/.test(googleMapsKey ?? "");

  useEffect(() => {
    let isMounted = true;

    const requestLocationPermission = async () => {
      if (Platform.OS !== "android") {
        return;
      }

      try {
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: "Acceder a tu ubicación",
            message:
              "Necesitamos tu ubicación para mostrarte comercios y referencias cercanas.",
            buttonPositive: "Permitir",
            buttonNegative: "Ahora no",
          }
        );

        if (isMounted) {
          setLocationPermissionGranted(result === PermissionsAndroid.RESULTS.GRANTED);
        }
      } catch {
        if (isMounted) {
          setLocationPermissionGranted(false);
        }
      }
    };

    void requestLocationPermission();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredLocations = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    return LOCATIONS.filter((location) => {
      const matchesCategory = selectedCategory
        ? location.category === selectedCategory
        : true;
      const matchesSearch =
        query.length === 0 ||
        `${location.title} ${location.address} ${location.category}`
          .toLowerCase()
          .includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [searchText, selectedCategory]);

  const selectedLocation = useMemo(
    () => filteredLocations.find((location) => location.id === selectedLocationId) ?? null,
    [filteredLocations, selectedLocationId]
  );

  useEffect(() => {
    if (
      selectedLocationId &&
      !filteredLocations.some((location) => location.id === selectedLocationId)
    ) {
      setSelectedLocationId(null);
    }
  }, [filteredLocations, selectedLocationId]);

  const snapPoints = useMemo(() => ["15%", "90%"], []);

  const onMarkerPress = (id: string) => {
    setSelectedLocationId(id);
    bottomSheetRef.current?.collapse();
  };

  return (
    <View style={styles.container}>
      <SearchBar
        topOffset={insets.top + 10}
        onFocus={() => undefined}
        placeholder="Buscá en Buenos Aires"
        value={searchText}
        onChangeText={setSearchText}
      />

      <View style={[styles.filterChipsContainer, { top: insets.top + 72 }]}>
        <MapFilterChips
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
        />
      </View>

      <MapView
        provider={isAndroid ? PROVIDER_GOOGLE : undefined}
        mapType={isAndroid && !hasAndroidGoogleMapsKey ? "none" : "standard"}
        showsTraffic={false}
        showsUserLocation={true}
        style={styles.map}
        showsCompass={false}
        showsIndoors={false}
        showsScale={false}
        showsPointsOfInterest={false}
        customMapStyle={[
          {
            featureType: "poi",
            elementType: "labels",
            stylers: [{ visibility: "off" }],
          },
        ]}
        initialRegion={{
          latitude: -34.5959,
          longitude: -58.4326,
          latitudeDelta: 0.0422,
          longitudeDelta: 0.0221,
        }}
        onPress={() => setSelectedLocationId(null)}
      >
        {isAndroid && !hasAndroidGoogleMapsKey && (
          <UrlTile
            maximumZ={19}
            urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        )}

        {filteredLocations.map((location) => (
          <Marker
            key={location.id}
            coordinate={location.coordinate}
            onPress={() => onMarkerPress(location.id)}
          >
            <MarkerContent
              location={location}
              isSelected={selectedLocationId === location.id}
            />
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

      {isAndroid && !locationPermissionGranted && (
        <View style={[styles.warningBanner, { top: insets.top + 178 }]}>
          <Text style={styles.warningText}>
            Activá el permiso de ubicación para ver tu posición en el mapa.
          </Text>
        </View>
      )}

      {selectedLocation && (
        <LocationCard
          location={selectedLocation}
          onClose={() => setSelectedLocationId(null)}
        />
      )}

      {!selectedLocation && (
        <BottomSheet
          ref={bottomSheetRef}
          index={0}
          snapPoints={snapPoints}
          enablePanDownToClose={false}
          backgroundStyle={styles.bottomSheetBackground}
          handleIndicatorStyle={styles.handleIndicator}
        >
          <BottomSheetScrollView contentContainerStyle={styles.scrollContent}>
            <Text style={styles.sheetTitle}>Explorá Buenos Aires</Text>
            <View style={styles.sheetList}>
              {filteredLocations.map((location) => (
                <RecentCard
                  key={location.id}
                  icon="map.fill"
                  iconColor="#FFF"
                  iconBackground="#007AFF"
                  title={location.title}
                  subtitle={location.address || location.category}
                  onPress={() => setSelectedLocationId(location.id)}
                />
              ))}
            </View>

            {filteredLocations.length === 0 && (
              <Text style={styles.emptyStateText}>
                No encontramos comercios para ese filtro.
              </Text>
            )}
          </BottomSheetScrollView>
        </BottomSheet>
      )}
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
  bottomSheetBackground: {
    backgroundColor: "rgba(30, 30, 32, 0.98)",
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    boxShadow: "0 12px 24px rgba(0, 0, 0, 0.55)",
  },
  handleIndicator: {
    backgroundColor: "#D1D1D6",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 20,
    textAlign: "center",
    color: "#FFF",
  },
  sheetList: {
    gap: 10,
  },
  emptyStateText: {
    marginTop: 20,
    textAlign: "center",
    color: "#B3B3B3",
    fontSize: 14,
    fontWeight: "600",
  },
});
