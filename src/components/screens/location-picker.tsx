import React, { useState, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, MapPressEvent } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';

interface LocationPickerProps {
  visible: boolean;
  onClose: () => void;
  onLocationSelect: (latitude: number, longitude: number, locationName?: string) => void;
  initialLatitude?: number;
  initialLongitude?: number;
}

export default function LocationPicker({
  visible,
  onClose,
  onLocationSelect,
  initialLatitude,
  initialLongitude,
}: LocationPickerProps) {
  const [selectedCoordinate, setSelectedCoordinate] = useState<{
    latitude: number;
    longitude: number;
  } | null>(
    initialLatitude && initialLongitude
      ? { latitude: initialLatitude, longitude: initialLongitude }
      : null,
  );
  const [loading, setLoading] = useState(false);
  const mapRef = useRef<MapView>(null);

  const handleGetCurrentLocation = async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        alert('Permission to access location was denied');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;

      setSelectedCoordinate({ latitude, longitude });

      const region = {
        latitude,
        longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };

      mapRef.current?.animateToRegion(region);
    } catch (error) {
      console.error('Error getting current location:', error);
      alert('Unable to get current location');
    } finally {
      setLoading(false);
    }
  };

  const handleMapPress = async (event: MapPressEvent) => {
    const { coordinate } = event.nativeEvent;
    setSelectedCoordinate(coordinate);
  };

  const handleConfirm = async () => {
    if (!selectedCoordinate) {
      alert('Please select a location on the map');
      return;
    }

    setLoading(true);
    try {
      const { latitude, longitude } = selectedCoordinate;

      let locationName;
      try {
        const results = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (results.length > 0) {
          const location = results[0];
          const parts = [
            location.name,
            location.street,
            location.city,
            location.region,
            location.country,
          ].filter(Boolean);
          locationName = parts.join(', ');
        }
      } catch (error) {
        console.error('Error reverse geocoding:', error);
      }

      onLocationSelect(latitude, longitude, locationName);
      onClose();
    } catch (error) {
      console.error('Error selecting location:', error);
      alert('Unable to select location');
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <View style={styles.modalContainer}>
      <View style={styles.modalContent}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Select Location</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#6b7280" />
          </TouchableOpacity>
        </View>

        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_DEFAULT}
          initialRegion={{
            latitude: initialLatitude || 37.7749,
            longitude: initialLongitude || -122.4194,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          onPress={handleMapPress}
        >
          {selectedCoordinate && (
            <Marker coordinate={selectedCoordinate} title="Selected Location" />
          )}
        </MapView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.locationButton}
            onPress={handleGetCurrentLocation}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#4ade80" />
            ) : (
              <>
                <Ionicons name="navigate" size={20} color="#4ade80" />
                <Text style={styles.locationButtonText}>Use Current Location</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.confirmButton, !selectedCoordinate && styles.confirmButtonDisabled]}
            onPress={handleConfirm}
            disabled={!selectedCoordinate || loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.confirmButtonText}>Confirm Location</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    width: '90%',
    height: '80%',
    backgroundColor: 'white',
    borderRadius: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  closeButton: {
    padding: 4,
  },
  map: {
    flex: 1,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 12,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  locationButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4ade80',
  },
  confirmButton: {
    backgroundColor: '#22c55e',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: '#d1d5db',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});
