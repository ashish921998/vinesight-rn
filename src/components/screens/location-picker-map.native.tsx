import React, { forwardRef } from 'react';
import MapView, { Marker, PROVIDER_DEFAULT, MapPressEvent, Region } from 'react-native-maps';

export interface LocationPickerMapRef {
  animateToRegion: (region: Region, duration?: number) => void;
}

interface Coordinate {
  latitude: number;
  longitude: number;
}

interface LocationPickerMapProps {
  style: unknown;
  initialRegion: Region;
  selectedCoordinate: Coordinate | null;
  selectedLocationMarkerTitle: string;
  onCoordinateSelect: (coordinate: Coordinate) => void;
  fallback?: React.ReactNode;
}

const LocationPickerMap = forwardRef<LocationPickerMapRef, LocationPickerMapProps>(
  (
    { style, initialRegion, selectedCoordinate, selectedLocationMarkerTitle, onCoordinateSelect },
    ref,
  ) => {
    const handleMapPress = (event: MapPressEvent) => {
      onCoordinateSelect(event.nativeEvent.coordinate);
    };

    return (
      <MapView
        ref={ref as React.Ref<MapView>}
        style={style}
        provider={PROVIDER_DEFAULT}
        initialRegion={initialRegion}
        onPress={handleMapPress}
      >
        {selectedCoordinate && (
          <Marker coordinate={selectedCoordinate} title={selectedLocationMarkerTitle} />
        )}
      </MapView>
    );
  },
);

LocationPickerMap.displayName = 'LocationPickerMap';

export default LocationPickerMap;
