import type { RecentCardProps, SearchBarProps } from "@/typings/index";
import BottomSheet, {
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import { Image } from "expo-image";
import React, { useMemo, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  Linking,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, UrlTile } from "react-native-maps";
import { MapFilterChips } from "@/components/MapFilterChips";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { GlassView } from "@/components/ui/GlassView";

// Mock Data for Buenos Aires Locations
const JEVI_LOGO = require("../../assets/images/jevi-logo.png");

const LOCATIONS = [
  {
    id: "1",
    title: "Tazzino - Villa Crespo",
    coordinate: { latitude: -34.5959, longitude: -58.4326 }, // Near Villa Crespo
    category: "Coffee",
    image: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?q=80&w=1000&auto=format&fit=crop",
    rating: 4.8,
    discount: "-20%",
    distance: "200 m",
    openStatus: "Abre Mar 08:30hs",
    address: "Av. Corrientes 5000",
  },
  {
    id: "2",
    title: "4090 Burger & Fries",
    coordinate: { latitude: -34.5843, longitude: -58.4286 }, // Palermo Hollywood approx
    category: "Burger",
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=1000&auto=format&fit=crop",
    rating: 5.0,
    discount: "-25%",
    distance: "1.2 km",
    openStatus: "Abierto ahora",
    address: "Nicaragua 4090",
  },
  {
    id: "3",
    title: "Quebracho Bar",
    coordinate: { latitude: -34.5870, longitude: -58.4300 },
    category: "Bar",
    image: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?q=80&w=1000&auto=format&fit=crop",
    rating: 4.5,
    distance: "800 m",
    openStatus: "Cierra 02:00hs",
    address: "Humboldt 1500",
  },
  {
    id: "4",
    title: "Supermercado Coto",
    coordinate: { latitude: -34.6000, longitude: -58.4200 },
    category: "Supermarket",
    image: "https://images.unsplash.com/photo-1534723452862-4c874018d66d?q=80&w=1000&auto=format&fit=crop",
    rating: 4.2,
    distance: "1.5 km",
    openStatus: "Abierto 24hs",
    address: "Av. Diaz Velez 4500",
  },
  {
    id: "5",
    title: "Zara - Palermo Soho",
    coordinate: { latitude: -34.5889, longitude: -58.4225 },
    category: "Clothes",
    image: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1000&auto=format&fit=crop",
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
    image: "https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=1000&auto=format&fit=crop",
    rating: 4.4,
    distance: "900 m",
    openStatus: "Abierto 24hs",
    address: "Charcas 3405, CABA",
  },
  {
    id: "jevi-2",
    title: "El Jevi Kiosco - Pueyrredon",
    coordinate: { latitude: -34.5959475, longitude: -58.4030948 },
    category: "Kiosko",
    image: "https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=1000&auto=format&fit=crop",
    rating: 4.5,
    distance: "1.2 km",
    openStatus: "Abierto 24hs",
    address: "Av. Pueyrredon 1270, CABA",
  },
  {
    id: "jevi-3",
    title: "El Jevi Kiosco - Cabrera",
    coordinate: { latitude: -34.5966556, longitude: -58.4156186 },
    category: "Kiosko",
    image: "https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=1000&auto=format&fit=crop",
    rating: 4.4,
    distance: "1.0 km",
    openStatus: "Abierto 24hs",
    address: "Cabrera 3501, CABA",
  },
  {
    id: "jevi-4",
    title: "El Jevi Kiosco - Scalabrini Ortiz",
    coordinate: { latitude: -34.5907049, longitude: -58.4250183 },
    category: "Kiosko",
    image: "https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=1000&auto=format&fit=crop",
    rating: 4.5,
    distance: "1.6 km",
    openStatus: "Abierto 24hs",
    address: "Av. Raul Scalabrini Ortiz 1602, CABA",
  },
];

const SearchBar: React.FC<SearchBarProps> = ({
  placeholder = "Search...",
  onChangeText,
  value,
  onFocus,
  onBlur,
}) => {
  return (
    <View style={searchStyles.container}>
      <GlassView
        style={searchStyles.searchContainer}
        intensity={24}
      >
        <View style={{ paddingLeft: 15 }}>
          <IconSymbol name="magnifyingglass" color={"#8E8E93"} size={20} />
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
        <View style={{ paddingRight: 15 }}>
          <IconSymbol name="mic" color={"#8E8E93"} size={20} />
        </View>
      </GlassView>
      <View style={searchStyles.avatarContainer}>
          <View style={searchStyles.listButton}>
            <IconSymbol name="list.bullet" color={"#000"} size={20} />
          </View>
      </View>
    </View>
  );
};

const searchStyles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 50, // Adjust based on safe area
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
          <IconSymbol name={icon as any} size={24} color={iconColor} />
        </View>
        <View style={recentCardStyles.textContainer}>
          <Text style={recentCardStyles.title}>{title}</Text>
          <Text style={recentCardStyles.subtitle}>{subtitle}</Text>
        </View>
        <Pressable style={recentCardStyles.moreButton}>
          <IconSymbol name="ellipsis" size={20} color="#8E8E93" />
        </Pressable>
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
  moreButton: {
    padding: 4,
  },
});

const LocationCard = ({ location, onClose }: { location: any; onClose: () => void }) => {
  const openMaps = () => {
    const isIos = process.env.EXPO_OS === "ios";
    const scheme = isIos ? "maps:0,0?q=" : "geo:0,0?q=";
    const latLng = `${location.coordinate.latitude},${location.coordinate.longitude}`;
    const label = location.title;
    const url = isIos
      ? `${scheme}${label}@${latLng}`
      : `${scheme}${latLng}(${label})`;

    if (url) {
        Linking.openURL(url);
    }
  };

  const statusTone = () => {
    if (!location.openStatus) return null;
    if (location.openStatus.includes("Abierto")) return "open";
    if (location.openStatus.includes("Cierra")) return "closing";
    if (location.openStatus.includes("Abre")) return "closed";
    return "neutral";
  };
  const tone = statusTone();
  const isJevi = location.id?.startsWith("jevi-") || location.category === "Kiosko";

  return (
    <View style={locationCardStyles.container}>
      <View style={locationCardStyles.card}>
        <View style={locationCardStyles.imageContainer}>
             <Image source={{ uri: location.image }} style={locationCardStyles.image} contentFit="cover" />
             {location.openStatus && (
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
             )}
             <Pressable style={locationCardStyles.logoContainer}>
                  {isJevi ? (
                    <Image
                      source={JEVI_LOGO}
                      style={locationCardStyles.logoImage}
                      contentFit="contain"
                    />
                  ) : (
                    <View style={{width: 20, height: 20, backgroundColor: '#F00', borderRadius: 4}} /> 
                  )}
             </Pressable>
        </View>
        <View style={locationCardStyles.content}>
            <Text style={locationCardStyles.title}>{location.title}</Text>
            <View style={locationCardStyles.detailsRow}>
                 <Text style={locationCardStyles.distance}>🏃 {location.distance}</Text>
                 {/* Rating */}
            </View>
        </View>
        <Pressable style={locationCardStyles.directionsButton} onPress={openMaps}>
          <IconSymbol name="location.fill" size={24} color="#FFF" />
        </Pressable>
      </View>
    </View>
  );
};

const locationCardStyles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 100, // Above tab bar
        left: 20,
        right: 20,
        zIndex: 20,
    },
    card: {
        backgroundColor: '#FFF',
        borderRadius: 20,
        borderCurve: "continuous",
        overflow: 'hidden',
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)",
    },
    imageContainer: {
        height: 150,
        width: '100%',
        position: 'relative',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    statusTag: {
        position: 'absolute',
        top: 12,
        left: 12,
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    statusText: {
        color: '#0F172A',
        fontSize: 12,
        fontWeight: '600',
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
        position: 'absolute',
        bottom: 12,
        left: 12,
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#FFD700', // Yellow bg as in design
        justifyContent: 'center',
        alignItems: 'center',
    },
    logoImage: {
        width: 22,
        height: 22,
    },
    content: {
        padding: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#000',
        marginBottom: 4,
    },
    detailsRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    distance: {
        fontSize: 14,
        color: '#8E8E93',
    },
    directionsButton: {
        position: 'absolute',
        bottom: 16,
        right: 16,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
    }
});

const MarkerContent = ({ location, isSelected }: { location: any; isSelected: boolean }) => {
    const isJevi = location.id?.startsWith("jevi-") || location.category === "Kiosko";
    const markerLabel = isJevi ? "EL Jevi" : location.title.split(' ')[0];
    return (
        <View style={{ alignItems: 'center' }}>
            {location.discount && (
                <View style={[markerStyles.bubble, { backgroundColor: '#333' }]}>
                    <Text style={markerStyles.discountText}>{location.discount}</Text>
                </View>
            )}
            <View style={[markerStyles.marker, isSelected && markerStyles.selectedMarker]}>
                <View style={markerStyles.iconContainer}>
                     {isJevi ? (
                        <Image source={JEVI_LOGO} style={markerStyles.jeviLogo} contentFit="contain" />
                     ) : (
                       <>
                         {/* Simplified icon logic */}
                         {location.category === 'Coffee' && <Text>☕</Text>}
                         {location.category === 'Burger' && <Text>🍔</Text>}
                         {location.category === 'Bar' && <Text>🍸</Text>}
                         {location.category === 'Supermarket' && <Text>🛒</Text>}
                         {location.category === 'Clothes' && <Text>👕</Text>}
                       </>
                     )}
                </View>
                {location.rating && (
                     <View style={markerStyles.ratingBadge}>
                         <Text style={markerStyles.ratingText}>{location.rating}</Text>
                     </View>
                )}
            </View>
            <View style={markerStyles.arrow} />
            <Text style={[markerStyles.label, isSelected && { color: '#000', fontWeight: 'bold' }]}>{markerLabel}</Text>
        </View>
    )
}

const markerStyles = StyleSheet.create({
    bubble: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginBottom: 4,
    },
    discountText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: '700',
    },
    marker: {
        width: 44,
        height: 44,
        borderRadius: 22,
        borderCurve: "continuous",
        backgroundColor: '#FFF',
        justifyContent: 'center',
        alignItems: 'center',
        boxShadow: "0 2px 4px rgba(0, 0, 0, 0.2)",
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
    },
    selectedMarker: {
        transform: [{ scale: 1.1 }],
        borderColor: '#000',
        borderWidth: 2,
    },
    iconContainer: {
        
    },
    jeviLogo: {
        width: 22,
        height: 22,
    },
    ratingBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: '#000',
        borderRadius: 6,
        paddingHorizontal: 4,
        paddingVertical: 2,
    },
    ratingText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: '700',
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
        color: '#555',
        marginTop: 2,
        backgroundColor: 'rgba(255,255,255,0.8)',
        paddingHorizontal: 4,
        borderRadius: 4,
        overflow: 'hidden',
    }
});


const Maps: React.FC = (): React.ReactElement => {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const [searchText, setSearchText] = useState<string>("");
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const isAndroid = Platform.OS === "android";
  const googleMapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim().replace(/^['"]|['"]$/g, "");
  const hasAndroidGoogleMapsKey = !isAndroid || /^AIza[A-Za-z0-9_-]{35}$/.test(googleMapsKey ?? "");

  const selectedLocation = useMemo(() => 
      LOCATIONS.find(l => l.id === selectedLocationId), 
  [selectedLocationId]);

  const snapPoints = useMemo(() => ["15%", "90%"], []); // Reduced snap points to not cover map initially

  const onMarkerPress = (id: string) => {
      setSelectedLocationId(id);
      // Maybe close bottom sheet or minimize it
      bottomSheetRef.current?.collapse();
  };

  const onMapPress = () => {
      setSelectedLocationId(null);
  }

  return (
    <View style={styles.container}>
      <SearchBar
        onFocus={() => {}}
        placeholder="Buscá en Buenos Aires"
        value={searchText}
        onChangeText={setSearchText}
      />
      
      <View style={{ position: 'absolute', top: 110, left: 0, right: 0, zIndex: 9 }}>
         <MapFilterChips />
      </View>

      <MapView
        provider={isAndroid ? PROVIDER_GOOGLE : undefined}
        mapType={isAndroid && !hasAndroidGoogleMapsKey ? "none" : "standard"}
        showsTraffic={false}
        showsUserLocation={!isAndroid}
        style={styles.map}
        showsCompass={false}
        showsIndoors={false}
        showsScale={false}
        showsPointsOfInterest={false}
        customMapStyle={[
            {
                "featureType": "poi",
                "elementType": "labels",
                "stylers": [
                  { "visibility": "off" }
                ]
            }
        ]}
        initialRegion={{
          latitude: -34.5959,
          longitude: -58.4326,
          latitudeDelta: 0.0422,
          longitudeDelta: 0.0221,
        }}
        onPress={onMapPress}
      >
          {isAndroid && !hasAndroidGoogleMapsKey && (
            <UrlTile
              maximumZ={19}
              urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          )}
          {LOCATIONS.map(location => (
              <Marker
                key={location.id}
                coordinate={location.coordinate}
                onPress={() => onMarkerPress(location.id)}
              >
                  <MarkerContent location={location} isSelected={selectedLocationId === location.id} />
              </Marker>
          ))}
      </MapView>

      {isAndroid && !hasAndroidGoogleMapsKey && (
        <View style={styles.androidMapWarning}>
          <Text style={styles.androidMapWarningText}>
            Android Google Maps key is invalid. Showing OpenStreetMap fallback.
          </Text>
        </View>
      )}
      
      {selectedLocation && (
          <LocationCard location={selectedLocation} onClose={() => setSelectedLocationId(null)} />
      )}

      {/* Only show bottom sheet if no location is selected, or make it behave differently */}
      {!selectedLocation && (
        <BottomSheet
            ref={bottomSheetRef}
            index={0}
            snapPoints={snapPoints}
            enablePanDownToClose={false}
            backgroundStyle={styles.bottomSheetBackground}
            handleIndicatorStyle={{ backgroundColor: '#D1D1D6' }}
        >
            <BottomSheetScrollView contentContainerStyle={styles.scrollContent}>
                 <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: '#FFF' }}>Explorá Buenos Aires</Text>
                 <View style={{ gap: 10 }}>
                     {LOCATIONS.map(loc => (
                         <RecentCard
                             key={loc.id}
                             icon="map.fill"
                             iconColor="#FFF"
                             iconBackground="#007AFF"
                             title={loc.title}
                             subtitle={loc.address || loc.category}
                             onPress={() => {
                                 setSelectedLocationId(loc.id);
                             }}
                         />
                     ))}
                 </View>
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
  androidMapWarning: {
    position: "absolute",
    top: 150,
    left: 16,
    right: 16,
    zIndex: 15,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "rgba(255, 196, 0, 0.92)",
  },
  androidMapWarningText: {
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
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  avatar: {
    width: 50,
    height: 50,
    alignSelf: "center",
    borderRadius: 99,
  },
});
