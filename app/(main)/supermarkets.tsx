import type { RecentCardProps, SearchBarProps } from "@/typings/index";
import { Entypo } from "@expo/vector-icons";
import BottomSheet, {
  BottomSheetScrollView,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { GlassView } from "expo-glass-effect";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { SFSymbol, SymbolView } from "expo-symbols";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Linking,
  Dimensions,
} from "react-native";
import MapView, { Marker, Callout } from "react-native-maps";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MapFilterChips } from "@/components/MapFilterChips";
import { IconSymbol } from "@/components/ui/icon-symbol";

// Mock Data for Buenos Aires Locations
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
];

const AVATAR: string = `https://pbs.twimg.com/profile_images/1906923012651106304/O6ccYsNM_400x400.jpg`;
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
        glassEffectStyle="regular"
        tintColor="rgba(255, 255, 255, 0.8)"
      >
        <View style={{ paddingLeft: 15 }}>
          {Platform.OS === 'ios' ? (
               <SymbolView name="magnifyingglass" tintColor={"#8E8E93"} size={20} />
           ) : (
               <IconSymbol name="magnifyingglass" color={"#8E8E93"} size={20} />
           )}
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
           {Platform.OS === 'ios' ? (
              <SymbolView name="mic" tintColor={"#8E8E93"} size={20} />
           ) : (
               <View /> // No mic icon fallback for now or use another icon
           )}
        </View>
      </GlassView>
      <View style={searchStyles.avatarContainer}>
          <View style={searchStyles.listButton}>
             {Platform.OS === 'ios' ? (
                <SymbolView name="list.bullet" tintColor={"#000"} size={20} />
             ) : (
                <IconSymbol name="plus" color={"#000"} size={20} /> // Fallback
             )}
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
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.05)",
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
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
    backgroundColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
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
            {Platform.OS === 'ios' ? (
                 <SymbolView name={icon} size={24} tintColor={iconColor} />
            ) : (
                 <IconSymbol name={icon as any} size={24} color={iconColor} />
            )}
        </View>
        <View style={recentCardStyles.textContainer}>
          <Text style={recentCardStyles.title}>{title}</Text>
          <Text style={recentCardStyles.subtitle}>{subtitle}</Text>
        </View>
        <Pressable style={recentCardStyles.moreButton}>
            {Platform.OS === 'ios' ? (
                <SymbolView name="ellipsis" size={20} tintColor="#8E8E93" />
            ) : (
                <IconSymbol name="ellipsis" size={20} color="#8E8E93" />
            )}
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
    const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
    const latLng = `${location.coordinate.latitude},${location.coordinate.longitude}`;
    const label = location.title;
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`
    });

    if (url) {
        Linking.openURL(url);
    }
  };

  return (
    <View style={locationCardStyles.container}>
      <View style={locationCardStyles.card}>
        <View style={locationCardStyles.imageContainer}>
             <Image source={{ uri: location.image }} style={locationCardStyles.image} contentFit="cover" />
             {location.openStatus.includes("Abre") && (
                 <View style={locationCardStyles.statusTag}>
                     <Text style={locationCardStyles.statusText}>{location.openStatus}</Text>
                 </View>
             )}
             <Pressable style={locationCardStyles.logoContainer}>
                  {/* Placeholder for logo */}
                  <View style={{width: 20, height: 20, backgroundColor: '#F00', borderRadius: 4}} /> 
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
             {Platform.OS === 'ios' ? (
                 <SymbolView name="location.fill" size={24} tintColor="#FFF" />
             ) : (
                 <IconSymbol name="map.fill" size={24} color="#FFF" />
             )}
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
        overflow: 'hidden',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 8,
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
        backgroundColor: '#FFE4E4',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    statusText: {
        color: '#FF3B30',
        fontSize: 12,
        fontWeight: '600',
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
    return (
        <View style={{ alignItems: 'center' }}>
            {location.discount && (
                <View style={[markerStyles.bubble, { backgroundColor: '#333' }]}>
                    <Text style={markerStyles.discountText}>{location.discount}</Text>
                </View>
            )}
            <View style={[markerStyles.marker, isSelected && markerStyles.selectedMarker]}>
                <View style={markerStyles.iconContainer}>
                     {/* Simplified icon logic */}
                     {location.category === 'Coffee' && <Text>☕</Text>}
                     {location.category === 'Burger' && <Text>🍔</Text>}
                     {location.category === 'Bar' && <Text>🍸</Text>}
                     {location.category === 'Supermarket' && <Text>🛒</Text>}
                     {location.category === 'Clothes' && <Text>👕</Text>}
                </View>
                {location.rating && (
                     <View style={markerStyles.ratingBadge}>
                         <Text style={markerStyles.ratingText}>{location.rating}</Text>
                     </View>
                )}
            </View>
            <View style={markerStyles.arrow} />
            <Text style={[markerStyles.label, isSelected && { color: '#000', fontWeight: 'bold' }]}>{location.title.split(' ')[0]}</Text>
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
        backgroundColor: '#FFF',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
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
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
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
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);

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
        showsTraffic={false}
        showsUserLocation={true}
        style={{
          flex: 1,
          width: "100%",
          height: "100%",
        }}
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
  bottomSheetBackground: {
    backgroundColor: "rgba(30, 30, 32, 0.98)",
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    shadowColor: "#000000",
    shadowOpacity: 0.55,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
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
