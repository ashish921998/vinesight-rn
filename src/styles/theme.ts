/**
 * VineSight Design System - Native Styles
 * Ported from tailwind.config.js for inline style usage
 */

import { colorWithOpacity } from '@/utils/color';

const lightGray = {
  50: '#f9fafb',
  100: '#f3f4f6',
  200: '#e5e7eb',
  300: '#d1d5db',
  400: '#9ca3af',
  500: '#6b7280',
  600: '#4b5563',
  700: '#374151',
  800: '#1f2937',
  900: '#111827',
} as const;

const darkGray = {
  50: '#111827',
  100: '#1f2937',
  200: '#374151',
  300: '#4b5563',
  400: '#6b7280',
  500: '#9ca3af',
  600: '#d1d5db',
  700: '#e5e7eb',
  800: '#f3f4f6',
  900: '#f9fafb',
} as const;

const lightSurface = {
  50: '#f2f2f7',
  100: '#ffffff',
  200: '#f2f2f7',
  300: '#e5e5ea',
  400: '#d1d1d6',
  500: '#8e8e93',
  600: '#636366',
  700: '#48484a',
  800: '#3a3a3c',
  900: '#2c2c2e',
} as const;

const darkSurface = {
  50: '#0b0f14',
  100: '#11161d',
  200: '#1a2029',
  300: '#232b36',
  400: '#2c3542',
  500: '#3a4453',
  600: '#4b5666',
  700: '#667180',
  800: '#8a94a3',
  900: '#b8c0cc',
} as const;

const baseColors = {
  white: '#ffffff',
  black: '#000000',
  // Primary - Monochromatic Green Palette
  primary: {
    50: '#f0f5f2',
    100: '#e1ebe5',
    200: '#c3d6cc',
    300: '#9cc5b1',
    400: '#75b397',
    500: '#408059',
    600: '#346a4a',
    700: '#2d5c3f',
    800: '#264d35',
    900: '#1f412b',
    950: '#0f2116',
  },
  secondary: {
    500: '#598d6b',
  },
  accent: {
    500: '#33734d',
  },
  // Activity Colors
  irrigation: {
    500: '#4d8573',
  },
  spray: {
    500: '#598d6b',
  },
  fertigation: {
    500: '#408059',
  },
  harvest: {
    500: '#669475',
  },
  observation: {
    500: '#738c7a',
  },
  task: {
    500: '#4d8573',
  },
  expense: {
    500: '#598066',
  },
  labTest: {
    soil: '#597A61',
    petiole: '#4C806B',
  },
  // Status Colors
  warning: '#ff9500',
  error: '#ff3b30',
  errorRed: {
    500: '#ef4444',
  },
  success: '#34c759',
  // Water Status
  water: {
    critical: '#db4437',
    low: '#ea8600',
    medium: '#f9a825',
    good: '#0b8d32',
  },
} as const;

export const colors = {
  ...baseColors,
  gray: lightGray,
  surface: lightSurface,
} as const;

export const darkColors = {
  ...baseColors,
  gray: darkGray,
  surface: darkSurface,
} as const;

export type ThemeColors = typeof colors | typeof darkColors;

export const getThemeColors = (isDark: boolean): ThemeColors => (isDark ? darkColors : colors);

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
  14: 56,
  16: 64,
  20: 80,
  24: 96,
} as const;

// Android text padding constants for includeFontPadding workaround
export const androidTextPadding = {
  bottom: 2,
  right: 3,
} as const;

export const borderRadius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,
  '3xl': 24,
  '4xl': 32,
  full: 9999,
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
} as const;

export const fontWeight = {
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
} as const;

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
  },
  glass: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 32,
  },
} as const;

const m3Base = {
  stateLayerOpacity: {
    pressed: 0.12,
    focus: 0.12,
    hover: 0.08,
    dragged: 0.16,
  },
  typography: {
    headlineSmall: {
      fontSize: fontSize['2xl'],
      lineHeight: 32,
      fontWeight: fontWeight.bold,
    },
    titleMedium: {
      fontSize: fontSize.base,
      lineHeight: 24,
      fontWeight: fontWeight.semibold,
    },
    bodyMedium: {
      fontSize: fontSize.sm,
      lineHeight: 20,
      fontWeight: fontWeight.normal,
    },
    labelLarge: {
      fontSize: fontSize.sm,
      lineHeight: 20,
      fontWeight: fontWeight.medium,
    },
    labelSmall: {
      fontSize: fontSize.xs,
      lineHeight: 16,
      fontWeight: fontWeight.medium,
    },
  },
  shape: {
    cornerSmall: borderRadius.md,
    cornerMedium: borderRadius.xl,
    cornerLarge: borderRadius['2xl'],
  },
} as const;

const createM3Theme = (isDark: boolean) => {
  const themeColors = getThemeColors(isDark);
  const onAccent = isDark ? themeColors.gray[50] : themeColors.surface[100];
  const primary = isDark ? colors.primary[300] : colors.primary[500];
  const error = isDark ? '#ff453a' : colors.error;
  const success = isDark ? '#32d74b' : colors.success;

  return {
    colorScheme: {
      primary,
      onPrimary: onAccent,
      primaryContainer: isDark ? colors.primary[800] : colors.primary[100],
      onPrimaryContainer: isDark ? colors.primary[50] : colors.primary[900],

      secondary: colors.secondary[500],
      onSecondary: onAccent,
      secondaryContainer: isDark ? colors.primary[700] : colors.primary[50],
      onSecondaryContainer: isDark ? colors.primary[50] : colors.primary[900],

      tertiary: colors.harvest[500],
      onTertiary: onAccent,
      tertiaryContainer: isDark ? colors.primary[700] : colors.primary[50],
      onTertiaryContainer: isDark ? colors.primary[50] : colors.primary[900],

      error,
      onError: onAccent,
      errorContainer: isDark ? '#5c1a1a' : '#FDE8E8',
      onErrorContainer: isDark ? '#FECACA' : '#7F1D1D',

      success,
      onSuccess: onAccent,

      background: themeColors.surface[50],
      onBackground: themeColors.gray[900],

      surface: themeColors.surface[50],
      onSurface: themeColors.gray[900],
      surfaceVariant: isDark ? themeColors.surface[200] : themeColors.surface[100],
      onSurfaceVariant: isDark ? themeColors.gray[600] : themeColors.gray[700],

      outline: isDark ? themeColors.gray[400] : themeColors.gray[300],
      outlineVariant: isDark ? themeColors.gray[300] : themeColors.gray[200],

      inverseSurface: themeColors.gray[900],
      inverseOnSurface: themeColors.gray[50],
      inversePrimary: colors.primary[200],

      shadow: '#000000',
      scrim: '#000000',

      // Not an official role; used for "Needs attention" affordances.
      warning: colors.warning,
      onWarning: onAccent,
    },
    surface: {
      surfaceDim: themeColors.surface[200],
      surfaceBright: themeColors.surface[50],
      surfaceContainerLowest: themeColors.surface[50],
      surfaceContainerLow: themeColors.surface[100],
      surfaceContainer: themeColors.surface[200],
      surfaceContainerHigh: themeColors.surface[300],
      surfaceContainerHighest: themeColors.surface[400],
    },
    ...m3Base,
  } as const;
};

// Material Design 3 (M3-ish) semantic roles
export const m3 = createM3Theme(false);
export const m3Dark = createM3Theme(true);

export const getM3Theme = (isDark: boolean) => (isDark ? m3Dark : m3);

// Common component styles
export const commonStyles = {
  // Glass effect cards
  glassCard: {
    backgroundColor: colorWithOpacity(colors.surface[100], 0.85),
    borderRadius: borderRadius['2xl'],
    ...shadows.glass,
  },
  glassCardDark: {
    backgroundColor: colorWithOpacity(darkColors.surface[100], 0.8),
    borderRadius: borderRadius['2xl'],
    ...shadows.glass,
  },
  // Buttons
  primaryButton: {
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.xl,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[6],
  },
  primaryButtonText: {
    color: colors.surface[100],
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    textAlign: 'center' as const,
  },
  secondaryButton: {
    backgroundColor: colors.surface[100],
    borderRadius: borderRadius.xl,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[6],
    borderWidth: 1,
    borderColor: colors.surface[300],
  },
  secondaryButtonText: {
    color: colors.primary[600],
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    textAlign: 'center' as const,
  },
  // Inputs
  input: {
    backgroundColor: colors.surface[50],
    borderWidth: 1,
    borderColor: colors.surface[300],
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3] + 2, // 14px
    fontSize: fontSize.base,
    color: colors.surface[900],
  },
  inputFocused: {
    borderColor: colors.primary[500],
    borderWidth: 2,
  },
  inputError: {
    borderColor: colors.error,
  },
  // Labels
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.surface[700],
    marginBottom: spacing[2],
  },
  errorText: {
    fontSize: fontSize.sm,
    color: colors.error,
    marginTop: spacing[1],
  },
} as const;

export const theme = {
  colors,
  darkColors,
  getThemeColors,
  m3,
  m3Dark,
  getM3Theme,
  spacing,
  borderRadius,
  fontSize,
  fontWeight,
  shadows,
  commonStyles,
} as const;

export default theme;
