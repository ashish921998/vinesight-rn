/**
 * VineSight Design System - Native Styles
 * Pi-Inspired Warm & Minimal Design Language
 */

import { colorWithOpacity } from '@/utils/color';

// ============================================================
// MARK: - Warm Earthy Gray Scale
// ============================================================

const lightGray = {
  50: '#FAF8F5',
  100: '#F5F0EB',
  200: '#E8E2DB',
  300: '#D4CBC1',
  400: '#A8A099',
  500: '#7A756F',
  600: '#5C5751',
  700: '#3D3A36',
  800: '#2D2D2A',
  900: '#1C1C1A',
} as const;

const darkGray = {
  50: '#1C1C1A',
  100: '#2D2D2A',
  200: '#3D3A36',
  300: '#5C5751',
  400: '#7A756F',
  500: '#A8A099',
  600: '#D4CBC1',
  700: '#E8E2DB',
  800: '#F5F0EB',
  900: '#FAF8F5',
} as const;

const lightSurface = {
  50: '#FAF8F5',
  100: '#FFFEFA',
  200: '#F5F0EB',
  300: '#E8E2DB',
  400: '#D4CBC1',
  500: '#A8A099',
  600: '#7A756F',
  700: '#5C5751',
  800: '#3D3A36',
  900: '#2D2D2A',
} as const;

const darkSurface = {
  50: '#1A1A18',
  100: '#242420',
  200: '#2E2E28',
  300: '#3A3A34',
  400: '#4A4A42',
  500: '#5E5E54',
  600: '#7A756F',
  700: '#A8A099',
  800: '#D4CBC1',
  900: '#F5F0EB',
} as const;

// ============================================================
// MARK: - Base Colors — Warm Earthy Palette
// ============================================================

const baseColors = {
  white: '#FFFEFA',
  black: '#1C1C1A',
  // Primary - Warm Sage Green Palette
  primary: {
    50: '#F2F7F3',
    100: '#E0EDE3',
    200: '#C2DBC8',
    300: '#99C4A4',
    400: '#7FB48D',
    500: '#6B8F71',
    600: '#5A7A60',
    700: '#4C6652',
    800: '#3F5444',
    900: '#344538',
    950: '#1A2B1E',
  },
  // Accent - Terracotta for CTAs and highlights
  secondary: {
    500: '#C27B5A',
  },
  accent: {
    500: '#C27B5A',
  },
  // Activity Colors — Warmer, earthier tones
  irrigation: {
    500: '#5B9EA6',
  },
  spray: {
    500: '#7A9E6B',
  },
  fertigation: {
    500: '#6B8F71',
  },
  harvest: {
    500: '#C2955A',
  },
  observation: {
    500: '#8E9B7A',
  },
  task: {
    500: '#5B9EA6',
  },
  expense: {
    500: '#B07D5B',
  },
  labTest: {
    soil: '#8E7B5A',
    petiole: '#6B8F71',
  },
  // Status Colors — Softened
  warning: '#E89B3E',
  error: '#D9534F',
  errorRed: {
    500: '#D9534F',
  },
  success: '#5CB85C',
  // Water Status — Softened
  water: {
    critical: '#D9534F',
    low: '#E89B3E',
    medium: '#E8C44A',
    good: '#5CB85C',
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

export const size = {
  0: 0,
  xs: 64,
  sm: 72,
  md: 80,
  lg: 88,
  xl: 96,
  '2xl': 104,
  '3xl': 112,
  '4xl': 128,
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  base: 17,
  lg: 19,
  xl: 22,
  '2xl': 28,
  '3xl': 34,
  '4xl': 40,
  display: 48,
} as const;

export const fontWeight = {
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
} as const;

export const shadows = {
  // Note: iOS uses shadow* props, Android uses elevation.
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
  },
  glass: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 32,
    elevation: 8,
  },
} as const;

const m3Base = {
  stateLayerOpacity: {
    pressed: 0.1,
    focus: 0.1,
    hover: 0.06,
    dragged: 0.14,
  },
  typography: {
    // Pi-style large welcoming display text
    display: {
      fontSize: fontSize.display,
      lineHeight: 56,
      fontWeight: fontWeight.bold,
    },
    headlineLarge: {
      fontSize: fontSize['3xl'],
      lineHeight: 42,
      fontWeight: fontWeight.bold,
    },
    headlineSmall: {
      fontSize: fontSize['2xl'],
      lineHeight: 36,
      fontWeight: fontWeight.bold,
    },
    titleMedium: {
      fontSize: fontSize.base,
      lineHeight: 26,
      fontWeight: fontWeight.semibold,
    },
    bodyLarge: {
      fontSize: fontSize.base,
      lineHeight: 26,
      fontWeight: fontWeight.normal,
    },
    bodyMedium: {
      fontSize: fontSize.sm,
      lineHeight: 22,
      fontWeight: fontWeight.normal,
    },
    labelLarge: {
      fontSize: fontSize.sm,
      lineHeight: 22,
      fontWeight: fontWeight.medium,
    },
    labelSmall: {
      fontSize: fontSize.xs,
      lineHeight: 18,
      fontWeight: fontWeight.medium,
    },
  },
  shape: {
    cornerSmall: borderRadius.md,
    cornerMedium: borderRadius.xl,
    cornerLarge: borderRadius['3xl'],
    cornerFull: borderRadius.full,
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

// Common component styles — Pi-inspired warm minimal
export const commonStyles = {
  // Warm soft-shadow cards (no hard borders)
  warmCard: {
    backgroundColor: colors.surface[100],
    borderRadius: borderRadius['3xl'],
    ...shadows.md,
  },
  warmCardDark: {
    backgroundColor: darkColors.surface[100],
    borderRadius: borderRadius['3xl'],
    ...shadows.md,
  },
  // Glass effect cards
  glassCard: {
    backgroundColor: colorWithOpacity(colors.surface[100], 0.85),
    borderRadius: borderRadius['3xl'],
    ...shadows.glass,
  },
  glassCardDark: {
    backgroundColor: colorWithOpacity(darkColors.surface[100], 0.8),
    borderRadius: borderRadius['3xl'],
    ...shadows.glass,
  },
  // Buttons — Pill-shaped, warm
  primaryButton: {
    backgroundColor: colors.primary[500],
    borderRadius: borderRadius.full,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[8],
  },
  primaryButtonText: {
    color: '#FFFEFA',
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    textAlign: 'center' as const,
  },
  // Terracotta accent button for prominent CTAs
  accentButton: {
    backgroundColor: baseColors.accent[500],
    borderRadius: borderRadius.full,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[8],
  },
  accentButtonText: {
    color: '#FFFEFA',
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    textAlign: 'center' as const,
  },
  secondaryButton: {
    backgroundColor: colors.surface[100],
    borderRadius: borderRadius.full,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[8],
    borderWidth: 1,
    borderColor: colors.surface[300],
  },
  secondaryButtonText: {
    color: colors.primary[500],
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    textAlign: 'center' as const,
  },
  // Inputs
  input: {
    backgroundColor: colors.surface[50],
    borderWidth: 1,
    borderColor: colors.surface[300],
    borderRadius: borderRadius['2xl'],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
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
  size,
  fontSize,
  fontWeight,
  shadows,
  commonStyles,
} as const;

export default theme;
