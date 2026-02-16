/**
 * Responsive height hook.
 * Encapsulates useWindowDimensions().height and common breakpoints for sheet/layout calculations.
 */

import { useWindowDimensions } from 'react-native';

const SMALL_SCREEN_THRESHOLD = 600;

export function useResponsiveHeight(): {
  windowHeight: number;
  isSmallScreen: boolean;
} {
  const { height } = useWindowDimensions();
  return {
    windowHeight: height,
    isSmallScreen: height < SMALL_SCREEN_THRESHOLD,
  };
}
