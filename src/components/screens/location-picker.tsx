/* eslint-disable react-native/no-unused-styles */
import React, { Component, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ActivityIndicator, Alert } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, MapPressEvent } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { useTranslation } from 'react-i18next';
import { useM3, useThemeColors } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';

interface LocationPickerProps {
  visible: boolean;
  onClose: () => void;
  onLocationSelect: (latitude: number, longitude: number, locationName?: string) => void;
  initialLatitude?: number;
  initialLongitude?: number;
}

interface MapErrorBoundaryProps {
  children: React.ReactNode;
  onError: (error: Error) => void;
  fallback: React.ReactNode;
}

interface MapErrorBoundaryState {
  hasError: boolean;
}

class MapErrorBoundary extends Component<MapErrorBoundaryProps, MapErrorBoundaryState> {
  state: MapErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): MapErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    this.props.onError(error);
  }

  componentDidUpdate(prevProps: MapErrorBoundaryProps) {
    if (this.state.hasError && prevProps.children !== this.props.children) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

export default function LocationPicker({
  visible,
  onClose,
  onLocationSelect,
  initialLatitude,
  initialLongitude,
}: LocationPickerProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const m3 = useM3();
  const styles = createStyles(colors, m3);

  const [selectedCoordinate, setSelectedCoordinate] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const mapRef = useRef<MapView>(null);
  const wasVisibleRef = useRef(false);

  useEffect(() => {
    if (!visible) {
      wasVisibleRef.current = false;
      return;
    }

    if (wasVisibleRef.current) return;
    wasVisibleRef.current = true;

    if (
      typeof initialLatitude === 'number' &&
      typeof initialLongitude === 'number' &&
      Number.isFinite(initialLatitude) &&
      Number.isFinite(initialLongitude)
    ) {
      setSelectedCoordinate({ latitude: initialLatitude, longitude: initialLongitude });
    } else {
      setSelectedCoordinate(null);
    }
  }, [initialLatitude, initialLongitude, visible]);

  const handleGetCurrentLocation = async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('common.error'), t('locationPicker.permissionDenied'));
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
      Alert.alert(t('common.error'), t('locationPicker.unableToGetCurrentLocation'));
    } finally {
      setLoading(false);
    }
  };

  const handleMapPress = (event: MapPressEvent) => {
    const { coordinate } = event.nativeEvent;
    setSelectedCoordinate(coordinate);
  };

  const handleConfirm = async () => {
    if (!selectedCoordinate) {
      Alert.alert(t('common.error'), t('locationPicker.pleaseSelectOnMap'));
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
      Alert.alert(t('common.error'), t('locationPicker.unableToSelectLocation'));
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <View style={styles.modalContainer}>
      <View style={styles.modalContent}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('locationPicker.title')}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.gray[500]} />
          </TouchableOpacity>
        </View>

        <MapErrorBoundary
          fallback={
            <View style={styles.mapFallback}>
              <View style={styles.mapFallbackIcon}>
                <Ionicons name="map" size={32} color={colors.gray[600]} />
              </View>
              <Text style={styles.mapFallbackTitle}>
                {t('locationPicker.mapsUnavailableTitle')}
              </Text>
              <Text style={styles.mapFallbackBody}>{t('locationPicker.mapsUnavailableBody')}</Text>
              {selectedCoordinate && (
                <Text style={styles.mapFallbackCoords}>
                  {selectedCoordinate.latitude.toFixed(6)},{' '}
                  {selectedCoordinate.longitude.toFixed(6)}
                </Text>
              )}
            </View>
          }
          onError={(error) => {
            if (__DEV__) {
              console.error('MapView crashed while rendering:', error);
            }
          }}
        >
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_DEFAULT}
            initialRegion={{
              latitude:
                typeof initialLatitude === 'number' && Number.isFinite(initialLatitude)
                  ? initialLatitude
                  : 20.5937,
              longitude:
                typeof initialLongitude === 'number' && Number.isFinite(initialLongitude)
                  ? initialLongitude
                  : 78.9629,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
            onPress={handleMapPress}
          >
            {selectedCoordinate && (
              <Marker
                coordinate={selectedCoordinate}
                title={t('locationPicker.selectedLocationMarkerTitle')}
              />
            )}
          </MapView>
        </MapErrorBoundary>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.locationButton}
            onPress={handleGetCurrentLocation}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.success} />
            ) : (
              <>
                <Ionicons name="navigate" size={20} color={colors.success} />
                <Text style={styles.locationButtonText}>{t('locationPicker.useCurrent')}</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.confirmButton, !selectedCoordinate && styles.confirmButtonDisabled]}
            onPress={handleConfirm}
            disabled={!selectedCoordinate || loading}
          >
            {loading ? (
              <ActivityIndicator color={m3.colorScheme.onPrimary} />
            ) : (
              <Text style={styles.confirmButtonText}>{t('locationPicker.confirm')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useThemeColors>, m3: ReturnType<typeof useM3>) =>
  StyleSheet.create({
    modalContainer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colorWithOpacity(m3.colorScheme.shadow, 0.5),
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
      elevation: 1000,
    },
    modalContent: {
      width: '90%',
      height: '80%',
      backgroundColor: colors.surface[100],
      borderRadius: borderRadius['2xl'],
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: spacing[4],
      borderBottomWidth: 1,
      borderBottomColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
    },
    headerTitle: {
      fontSize: fontSize.lg,
      fontWeight: fontWeight.semibold,
      color: m3.colorScheme.onSurface,
    },
    closeButton: {
      padding: spacing[1],
    },
    map: {
      flex: 1,
    },
    mapFallback: {
      flex: 1,
      paddingHorizontal: spacing[6],
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface[50],
    },
    mapFallbackIcon: {
      width: 72,
      height: 72,
      borderRadius: borderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface[100],
      marginBottom: spacing[4],
    },
    mapFallbackTitle: {
      fontSize: fontSize.lg,
      fontWeight: fontWeight.semibold,
      color: m3.colorScheme.onSurface,
      textAlign: 'center',
      marginBottom: spacing[2],
    },
    mapFallbackBody: {
      fontSize: fontSize.sm,
      color: m3.colorScheme.onSurfaceVariant,
      textAlign: 'center',
      marginBottom: spacing[4],
    },
    mapFallbackCoords: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.medium,
      color: m3.colorScheme.onSurface,
      textAlign: 'center',
    },
    footer: {
      padding: spacing[4],
      borderTopWidth: 1,
      borderTopColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
      gap: spacing[3],
    },
    locationButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.1),
      padding: spacing[3],
      borderRadius: borderRadius.md,
      gap: spacing[2],
    },
    locationButtonText: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.medium,
      color: m3.colorScheme.primary,
    },
    confirmButton: {
      backgroundColor: m3.colorScheme.primary,
      padding: spacing[3] + 2,
      borderRadius: borderRadius.md,
      alignItems: 'center',
    },
    confirmButtonDisabled: {
      backgroundColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
    },
    confirmButtonText: {
      fontSize: fontSize.base,
      fontWeight: fontWeight.semibold,
      color: m3.colorScheme.onPrimary,
    },
  });
