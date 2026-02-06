/* eslint-disable react-native/no-unused-styles */
import React, { Component, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Alert,
  Platform,
  TextInput,
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, MapPressEvent } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
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
  const [latitudeInput, setLatitudeInput] = useState('');
  const [longitudeInput, setLongitudeInput] = useState('');
  const mapRef = useRef<MapView>(null);
  const wasVisibleRef = useRef(false);
  const configuredMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  const androidMapsConfigKey =
    Constants.expoConfig?.android?.config?.googleMaps?.apiKey?.trim() ?? '';
  const hasAndroidMapsSetup =
    Platform.OS !== 'android' || Boolean(configuredMapsApiKey) || Boolean(androidMapsConfigKey);

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
      const nextCoordinate = { latitude: initialLatitude, longitude: initialLongitude };
      setSelectedCoordinate(nextCoordinate);
      setLatitudeInput(nextCoordinate.latitude.toFixed(6));
      setLongitudeInput(nextCoordinate.longitude.toFixed(6));
    } else {
      setSelectedCoordinate(null);
      setLatitudeInput('');
      setLongitudeInput('');
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
      setLatitudeInput(latitude.toFixed(6));
      setLongitudeInput(longitude.toFixed(6));

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
    setLatitudeInput(coordinate.latitude.toFixed(6));
    setLongitudeInput(coordinate.longitude.toFixed(6));
  };

  const handleApplyCoordinates = () => {
    const trimmedLatitude = latitudeInput.trim();
    const trimmedLongitude = longitudeInput.trim();

    // Prevent empty coordinates from being parsed as 0
    if (!trimmedLatitude || !trimmedLongitude) {
      Alert.alert(t('common.error'), t('locationPicker.invalidCoordinates'));
      return;
    }

    const latitude = Number(trimmedLatitude);
    const longitude = Number(trimmedLongitude);
    const isValidLatitude = Number.isFinite(latitude) && latitude >= -90 && latitude <= 90;
    const isValidLongitude = Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;

    if (!isValidLatitude || !isValidLongitude) {
      Alert.alert(t('common.error'), t('locationPicker.invalidCoordinates'));
      return;
    }

    setSelectedCoordinate({ latitude, longitude });
    mapRef.current?.animateToRegion({
      latitude,
      longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
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
          {hasAndroidMapsSetup ? (
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
          ) : (
            <View style={styles.mapFallback}>
              <View style={styles.mapFallbackIcon}>
                <Ionicons name="map" size={32} color={colors.gray[600]} />
              </View>
              <Text style={styles.mapFallbackTitle}>
                {t('locationPicker.mapsUnavailableTitle')}
              </Text>
              <Text style={styles.mapFallbackBody}>{t('locationPicker.mapsUnavailableBody')}</Text>
            </View>
          )}
        </MapErrorBoundary>

        <View style={styles.footer}>
          <View style={styles.manualCoordinatesSection}>
            <Text style={styles.manualCoordinatesTitle}>
              {t('locationPicker.manualCoordinatesTitle')}
            </Text>
            <View style={styles.manualCoordinatesRow}>
              <View style={styles.manualCoordinateField}>
                <Text style={styles.manualCoordinateLabel}>
                  {t('locationPicker.latitudeLabel')}
                </Text>
                <TextInput
                  value={latitudeInput}
                  onChangeText={setLatitudeInput}
                  placeholder="19.076000"
                  keyboardType="numbers-and-punctuation"
                  style={styles.coordinateInput}
                  placeholderTextColor={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7)}
                />
              </View>
              <View style={styles.manualCoordinateField}>
                <Text style={styles.manualCoordinateLabel}>
                  {t('locationPicker.longitudeLabel')}
                </Text>
                <TextInput
                  value={longitudeInput}
                  onChangeText={setLongitudeInput}
                  placeholder="72.877700"
                  keyboardType="numbers-and-punctuation"
                  style={styles.coordinateInput}
                  placeholderTextColor={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7)}
                />
              </View>
            </View>
            <TouchableOpacity
              style={styles.applyCoordinatesButton}
              onPress={handleApplyCoordinates}
            >
              <Text style={styles.applyCoordinatesButtonText}>
                {t('locationPicker.applyCoordinates')}
              </Text>
            </TouchableOpacity>
          </View>

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
    manualCoordinatesSection: {
      backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.06),
      borderWidth: 1,
      borderColor: colorWithOpacity(m3.colorScheme.primary, 0.2),
      borderRadius: borderRadius.md,
      padding: spacing[3],
      gap: spacing[2],
    },
    manualCoordinatesTitle: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      color: m3.colorScheme.onSurface,
    },
    manualCoordinatesRow: {
      flexDirection: 'row',
      gap: spacing[2],
    },
    manualCoordinateField: {
      flex: 1,
      gap: spacing[1],
    },
    manualCoordinateLabel: {
      fontSize: fontSize.xs,
      fontWeight: fontWeight.medium,
      color: m3.colorScheme.onSurfaceVariant,
    },
    coordinateInput: {
      backgroundColor: colors.surface[100],
      borderWidth: 1,
      borderColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
      borderRadius: borderRadius.sm,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
      fontSize: fontSize.sm,
      color: m3.colorScheme.onSurface,
    },
    applyCoordinatesButton: {
      alignSelf: 'flex-start',
      backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.15),
      borderRadius: borderRadius.sm,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
    },
    applyCoordinatesButtonText: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      color: m3.colorScheme.primary,
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
