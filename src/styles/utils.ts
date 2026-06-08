/**
 * Style utility functions for VineSight
 */

import type { ViewStyle, TextStyle } from 'react-native';
import { getThemeColors, spacing, borderRadius, shadows } from './theme';
import { colorWithOpacity } from '@/utils/color';

/**
 * Create a card style with optional glass effect
 */
export const createCardStyle = (options?: {
  glass?: boolean;
  dark?: boolean;
  padding?: number;
  margin?: number;
}): ViewStyle => {
  const themeColors = getThemeColors(Boolean(options?.dark));
  const glassBackground = colorWithOpacity(themeColors.surface[100], options?.dark ? 0.75 : 0.85);
  const base: ViewStyle = {
    backgroundColor: options?.glass
      ? glassBackground
      : options?.dark
        ? themeColors.surface[50]
        : themeColors.surface[100],
    borderRadius: borderRadius['2xl'],
    padding: options?.padding ?? spacing[4],
    margin: options?.margin,
    ...shadows.md,
  };

  return base;
};

/**
 * Create flex container styles
 */
export const flex = {
  row: { flexDirection: 'row' as const },
  col: { flexDirection: 'column' as const },
  center: { justifyContent: 'center' as const, alignItems: 'center' as const },
  spaceBetween: { justifyContent: 'space-between' as const },
  spaceAround: { justifyContent: 'space-around' as const },
  alignCenter: { alignItems: 'center' as const },
  alignStart: { alignItems: 'flex-start' as const },
  alignEnd: { alignItems: 'flex-end' as const },
  justifyCenter: { justifyContent: 'center' as const },
  justifyStart: { justifyContent: 'flex-start' as const },
  justifyEnd: { justifyContent: 'flex-end' as const },
  wrap: { flexWrap: 'wrap' as const },
} as const;

/**
 * Create text style with common patterns
 */
export const createTextStyle = (options?: {
  size?: number;
  weight?: '400' | '500' | '600' | '700';
  color?: string;
  align?: 'left' | 'center' | 'right';
  dark?: boolean;
}): TextStyle => {
  const themeColors = getThemeColors(Boolean(options?.dark));
  return {
    fontSize: options?.size ?? 16,
    fontWeight: options?.weight ?? '400',
    color: options?.color ?? themeColors.gray[900],
    textAlign: options?.align ?? 'left',
  };
};

/**
 * Common padding/margin utilities
 */
export const space = {
  p: (value: keyof typeof spacing) => ({ padding: spacing[value] }),
  px: (value: keyof typeof spacing) => ({
    paddingHorizontal: spacing[value],
  }),
  py: (value: keyof typeof spacing) => ({ paddingVertical: spacing[value] }),
  pt: (value: keyof typeof spacing) => ({ paddingTop: spacing[value] }),
  pb: (value: keyof typeof spacing) => ({ paddingBottom: spacing[value] }),
  pl: (value: keyof typeof spacing) => ({ paddingLeft: spacing[value] }),
  pr: (value: keyof typeof spacing) => ({ paddingRight: spacing[value] }),
  m: (value: keyof typeof spacing) => ({ margin: spacing[value] }),
  mx: (value: keyof typeof spacing) => ({ marginHorizontal: spacing[value] }),
  my: (value: keyof typeof spacing) => ({ marginVertical: spacing[value] }),
  mt: (value: keyof typeof spacing) => ({ marginTop: spacing[value] }),
  mb: (value: keyof typeof spacing) => ({ marginBottom: spacing[value] }),
  ml: (value: keyof typeof spacing) => ({ marginLeft: spacing[value] }),
  mr: (value: keyof typeof spacing) => ({ marginRight: spacing[value] }),
} as const;

/**
 * Combine multiple style objects (type-safe)
 */
export const combineStyles = <T extends ViewStyle | TextStyle>(
  ...styles: (T | undefined | false | null)[]
): T => {
  return Object.assign({}, ...styles.filter(Boolean)) as T;
};
