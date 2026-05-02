import React, { forwardRef, useImperativeHandle } from 'react';
import type { Region } from 'react-native-maps';

export interface LocationPickerMapRef {
  animateToRegion: (region: Region, duration?: number) => void;
}

interface LocationPickerMapProps {
  fallback: React.ReactNode;
}

const LocationPickerMap = forwardRef<LocationPickerMapRef, LocationPickerMapProps>(
  ({ fallback }, ref) => {
    useImperativeHandle(
      ref,
      () => ({
        animateToRegion: () => {
          // react-native-maps is native-only in this app. On web, search/current-location
          // selection still updates coordinates, and the fallback renders those values.
        },
      }),
      [],
    );

    return <>{fallback}</>;
  },
);

LocationPickerMap.displayName = 'LocationPickerMap';

export default LocationPickerMap;
