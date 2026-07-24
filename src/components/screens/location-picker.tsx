/* eslint-disable react-native/no-unused-styles */
import React, { Component, useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Alert,
  TextInput,
  FlatList,
  Keyboard,
  Platform,
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, MapPressEvent } from 'react-native-maps';
import * as Location from 'expo-location';
import Ionicons from '@expo/vector-icons/Ionicons';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { useTranslation } from 'react-i18next';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { EmptyState } from '@/components/ui';
import { Spinner } from '@/components/ui/spinner';

const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

interface SearchResult {
  placeId: string;
  name: string;
  displayName: string;
}

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

function ResultSeparator() {
  const m3 = useM3();
  const styles = createStyles(m3);
  return <View style={styles.resultSeparator} />;
}

export default function LocationPicker({
  visible,
  onClose,
  onLocationSelect,
  initialLatitude,
  initialLongitude,
}: LocationPickerProps) {
  const { t } = useTranslation();
  const m3 = useM3();
  const styles = createStyles(m3);

  const [selectedCoordinate, setSelectedCoordinate] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const searchInputRef = useRef<TextInput>(null);
  const mapRef = useRef<MapView>(null);
  const wasVisibleRef = useRef(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!visible) {
      wasVisibleRef.current = false;
      setSearchQuery('');
      setSearchResults([]);
      setShowResults(false);
      setSearchError(false);
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

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowResults(false);
      setSearchError(false);
      return;
    }

    if (!GOOGLE_PLACES_API_KEY) {
      console.error('Google Places API key not configured');
      setSearchResults([]);
      setShowResults(true);
      setSearchError(true);
      return;
    }

    const myRequestId = ++requestIdRef.current;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsSearching(true);
    setShowResults(true);
    setSearchError(false);

    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${GOOGLE_PLACES_API_KEY}&language=en`,
        { signal: controller.signal },
      );

      const data = await response.json();

      if (requestIdRef.current !== myRequestId) return;

      if (__DEV__) {
        console.log('Google Places results for', query, ':', JSON.stringify(data, null, 2));
      }

      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        console.error('Google Places API error:', data.status, data.error_message);
        setSearchResults([]);
        setSearchError(true);
        return;
      }

      const results: SearchResult[] = (data.predictions || []).map(
        (prediction: {
          place_id: string;
          structured_formatting?: { main_text?: string };
          description: string;
        }) => ({
          placeId: prediction.place_id,
          name: prediction.structured_formatting?.main_text || prediction.description.split(',')[0],
          displayName: prediction.description,
        }),
      );

      setSearchResults(results);
    } catch (error) {
      if (controller.signal.aborted || (error as Error)?.name === 'AbortError') return;
      console.error('Error searching location:', error);
      if (requestIdRef.current !== myRequestId) return;
      setSearchResults([]);
      setSearchError(true);
    } finally {
      if (requestIdRef.current === myRequestId) {
        setIsSearching(false);
      }
    }
  }, []);

  const getPlaceDetails = useCallback(
    async (placeId: string): Promise<{ lat: number; lng: number } | null> => {
      if (!GOOGLE_PLACES_API_KEY) {
        return null;
      }

      const myRequestId = ++requestIdRef.current;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry&key=${GOOGLE_PLACES_API_KEY}`,
          { signal: controller.signal },
        );

        const data = await response.json();

        if (requestIdRef.current !== myRequestId) return null;

        if (data.status === 'OK' && data.result?.geometry?.location) {
          return data.result.geometry.location;
        }

        return null;
      } catch (error) {
        if (controller.signal.aborted || (error as Error)?.name === 'AbortError') return null;
        console.error('Error fetching place details:', error);
        return null;
      }
    },
    [],
  );

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!text.trim()) {
      setSearchResults([]);
      setShowResults(false);
      setSearchError(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      performSearch(text);
    }, 400);
  };

  const handleSearchSubmit = () => {
    if (searchQuery.trim()) {
      performSearch(searchQuery);
    }
    Keyboard.dismiss();
  };

  const handleResultPress = async (result: SearchResult) => {
    setIsSearching(true);
    setShowResults(false);
    Keyboard.dismiss();

    try {
      const location = await getPlaceDetails(result.placeId);

      if (location && Number.isFinite(location.lat) && Number.isFinite(location.lng)) {
        setSelectedCoordinate({ latitude: location.lat, longitude: location.lng });

        mapRef.current?.animateToRegion(
          {
            latitude: location.lat,
            longitude: location.lng,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          },
          500,
        );
      } else {
        Alert.alert(t('common.error'), t('locationPicker.unableToGetLocationDetails'));
      }
    } catch (error) {
      console.error('Error selecting location:', error);
      Alert.alert(t('common.error'), t('locationPicker.unableToGetLocationDetails'));
    } finally {
      setIsSearching(false);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowResults(false);
    setSearchError(false);
    searchInputRef.current?.focus();
  };

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
            <Ionicons name="close" size={24} color={m3.neutral.n500} />
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <View style={styles.searchInputWrapper}>
            <Ionicons name="search" size={20} color={m3.neutral.n500} style={styles.searchIcon} />
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder={t('locationPicker.searchPlaceholder')}
              placeholderTextColor={m3.neutral.n500}
              value={searchQuery}
              onChangeText={handleSearchChange}
              onSubmitEditing={handleSearchSubmit}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="words"
            />
            {isSearching && (
              <Spinner size="small" color={m3.colorScheme.primary} style={styles.searchLoader} />
            )}
            {searchQuery.length > 0 && !isSearching && (
              <TouchableOpacity onPress={handleClearSearch} style={styles.clearButton}>
                <Ionicons name="close-circle" size={18} color={m3.neutral.n500} />
              </TouchableOpacity>
            )}
          </View>
          {showResults && (
            <View style={styles.resultsContainer}>
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.placeId}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => {
                  return (
                    <TouchableOpacity
                      style={styles.resultItem}
                      onPress={() => handleResultPress(item)}
                    >
                      <Ionicons name="location" size={18} color={m3.colorScheme.primary} />
                      <Text style={styles.resultText} numberOfLines={2}>
                        {item.displayName}
                      </Text>
                    </TouchableOpacity>
                  );
                }}
                ItemSeparatorComponent={ResultSeparator}
                ListEmptyComponent={
                  isSearching ? null : (
                    <View style={styles.emptyResultsWrap}>
                      <EmptyState
                        icon={searchError ? 'exclamationmark.triangle' : 'magnifyingglass'}
                        title={
                          searchError
                            ? t('locationPicker.searchFailedTitle')
                            : t('locationPicker.noResultsFound')
                        }
                        description={
                          searchError
                            ? t('locationPicker.searchFailedBody')
                            : t('locationPicker.noResultsHint')
                        }
                      />
                    </View>
                  )
                }
              />
            </View>
          )}
        </View>

        <MapErrorBoundary
          fallback={
            <View style={styles.mapFallback}>
              <View style={styles.mapFallbackIcon}>
                <Ionicons name="map" size={32} color={m3.neutral.n600} />
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
              <Spinner color={m3.colorScheme.success} />
            ) : (
              <>
                <Ionicons name="navigate" size={20} color={m3.colorScheme.success} />
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
              <Spinner color={m3.colorScheme.onPrimary} />
            ) : (
              <Text style={styles.confirmButtonText}>{t('locationPicker.confirm')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const createStyles = (m3: ReturnType<typeof useM3>) =>
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
      backgroundColor: m3.surface.s100,
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
    searchContainer: {
      padding: spacing[3],
      backgroundColor: m3.surface.s100,
      zIndex: 10,
    },
    searchInputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: m3.surface.s50,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colorWithOpacity(m3.colorScheme.outlineVariant, 0.8),
      paddingHorizontal: spacing[3],
    },
    searchIcon: {
      marginRight: spacing[2],
    },
    searchInput: {
      flex: 1,
      paddingVertical: Platform.OS === 'ios' ? spacing[3] : spacing[2],
      fontSize: fontSize.base,
      color: m3.colorScheme.onSurface,
    },
    searchLoader: {
      marginLeft: spacing[2],
    },
    clearButton: {
      padding: spacing[1],
      marginLeft: spacing[1],
    },
    resultsContainer: {
      marginTop: spacing[2],
      backgroundColor: m3.surface.s100,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colorWithOpacity(m3.colorScheme.outlineVariant, 0.5),
      maxHeight: 200,
      boxShadow: `0 2px 4px ${colorWithOpacity(m3.colorScheme.shadow, 0.1)}`,
    },
    resultItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing[3],
      gap: spacing[2],
    },
    resultText: {
      flex: 1,
      fontSize: fontSize.sm,
      color: m3.colorScheme.onSurface,
    },
    resultSeparator: {
      height: 1,
      backgroundColor: colorWithOpacity(m3.colorScheme.outlineVariant, 0.3),
      marginLeft: spacing[3] + 18 + spacing[2],
    },
    emptyResultsWrap: {
      height: 188,
    },
    map: {
      flex: 1,
    },
    mapFallback: {
      flex: 1,
      paddingHorizontal: spacing[6],
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: m3.surface.s50,
    },
    mapFallbackIcon: {
      width: 72,
      height: 72,
      borderRadius: borderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: m3.surface.s100,
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
