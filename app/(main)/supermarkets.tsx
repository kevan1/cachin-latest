import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useState } from 'react';

// Kioskos in Buenos Aires
const SUPERMARKETS = [
  {
    id: 1,
    name: 'Kiosko Palermo',
    latitude: -34.5875,
    longitude: -58.4225,
  },
  {
    id: 2,
    name: 'Kiosko Recoleta',
    latitude: -34.5889,
    longitude: -58.3931,
  },
  {
    id: 3,
    name: 'Kiosko San Telmo',
    latitude: -34.6211,
    longitude: -58.3724,
  },
  {
    id: 4,
    name: 'Kiosko Belgrano',
    latitude: -34.5627,
    longitude: -58.4575,
  },
  {
    id: 5,
    name: 'Kiosko Caballito',
    latitude: -34.6177,
    longitude: -58.4398,
  },
  {
    id: 6,
    name: 'Kiosko Villa Crespo',
    latitude: -34.6006,
    longitude: -58.4384,
  },
  {
    id: 7,
    name: 'Kiosko Nuñez',
    latitude: -34.5431,
    longitude: -58.4519,
  },
  {
    id: 8,
    name: 'Kiosko Monserrat',
    latitude: -34.6106,
    longitude: -58.3831,
  },
];

export default function SupermarketsScreen() {
  const [selectedMarker, setSelectedMarker] = useState<typeof SUPERMARKETS[0] | null>(null);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Kioskos en Buenos Aires</Text>
      </View>

      {/* Map */}
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: -34.6037,
          longitude: -58.4216,
          latitudeDelta: 0.15,
          longitudeDelta: 0.15,
        }}
      >
        {SUPERMARKETS.map((supermarket) => (
          <Marker
            key={supermarket.id}
            coordinate={{
              latitude: supermarket.latitude,
              longitude: supermarket.longitude,
            }}
            title={supermarket.name}
            onPress={() => setSelectedMarker(supermarket)}
          />
        ))}
      </MapView>

      {/* Selected Marker Info */}
      {selectedMarker && (
        <View style={styles.infoCard}>
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>{selectedMarker.name}</Text>
            <Text style={styles.infoSubtitle}>
              {selectedMarker.latitude.toFixed(4)}, {selectedMarker.longitude.toFixed(4)}
            </Text>
          </View>
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={() => setSelectedMarker(null)}
          >
            <Text style={styles.closeIcon}>×</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5E6D3',
  },
  header: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#F5E6D3',
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  map: {
    flex: 1,
  },
  infoCard: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#000000',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
  },
  infoSubtitle: {
    fontSize: 14,
    color: '#666666',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFD580',
    borderWidth: 2,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeIcon: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    lineHeight: 24,
  },
});
