/**
 * VineSight Design System - Native Styles
 * Cellar Ledger design - warm earth tones, shadow-minimal cards
 */

// Gray palette - not used in Cellar Ledger but kept for compatibility
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

// Light mode neutrals (warm earth tones)
const lightSurface = {
  50: '#FBF8F3', // bg
  100: '#F7F3ED', // card
  200: '#EEE7DD', // hover/dividers
  300: '#D9D0C4', // border
  400: '#A89E92', // muted
  500: '#5C584F', // secondary text
  600: '#48484a',
  700: '#3a3a3c',
  800: '#2c2c2e',
  900: '#1E241F', // primary text (ink)
} as const;

// Dark mode neutrals (bark-charcoal palette)
const darkSurface = {
  50: '#121613', // bg
  100: '#1A1E1B', // card
  200: '#242A24', // surface-2/hover
  300: '#2E342F', // border
  400: '#7A756D', // muted
  500: '#A89E92', // secondary text (bark)
  600: '#B5BDB8',
  700: '#D9DED9',
  800: '#E8E4DE', // primary text (ink)
  900: '#F0F2F0',
} as const;

// Base colors - Cellar Ledger palette
const baseColors = {
  white: '#ffffff',
  black: '#000000',
  // Primary palette - Light mode
  primary: {
    50: '#f0f5f2',
    100: '#e1ebe5',
    200: '#c3d6cc',
    300: '#9cc5b1',
    400: '#75b397',
    500: '#355847', // primary #355847
    600: '#2d4a3a',
    700: '#264035',
    800: '#1f352c',
    900: '#1E241F',
    950: '#0f2116',
  },
  secondary: {
    500: '#A56B4F', // secondary #A56B4F
  },
  accent: {
    500: '#D0A14A', // accent #D0A14A
  },
  // Status colors - Light mode
  info: '#4E7384',
  warning: '#C58A2B',
  error: '#B84C3A',
  success: '#4F7A5A',
  // Category colors - Light mode
  irrigation: {
    500: '#3F6E78',
  },
  spray: {
    500: '#6C7C46',
  },
  fertigation: {
    500: '#56704E',
  },
  harvest: {
    500: '#A9752F',
  },
  labour: {
    500: '#7A5E8E',
  },
  note: {
    500: '#5C6D91', // Cellar Ledger note category
  },
  // observation maps to note color
  observation: {
    500: '#5C6D91', // note color
  },
  task: {
    500: '#4d8573',
  },
  expense: {
    500: '#598066',
  },
  labTest: {
    soil: '#5C6D91',
    petiole: '#4E7384',
  },
  // Water Status
  water: {
    critical: '#B84C3A',
    low: '#C58A2B',
    medium: '#D0A14A',
    good: '#4F7A5A',
  },
} as const;

// Dark mode colors - lighter variants for dark backgrounds
const darkModeColors = {
  white: '#ffffff',
  black: '#000000',
  // Primary palette - Dark mode
  primary: {
    50: '#f0f5f2',
    100: '#e1ebe5',
    200: '#c3d6cc',
    300: '#9cc5b1',
    400: '#75b397',
    500: '#4A8B6B', // primary #4A8B6B
    600: '#3d7459',
    700: '#345d4a',
    800: '#2b473a',
    900: '#E8E4DE',
    950: '#0f2116',
  },
  secondary: {
    500: '#9A6A52', // secondary #9A6A52
  },
  accent: {
    500: '#C49843', // accent #C49843
  },
  // Status colors - Dark mode
  info: '#5A8090',
  warning: '#B88030',
  error: '#C45A4A',
  success: '#5A8B65',
  // Category colors - Dark mode (lighter for dark bg)
  irrigation: {
    500: '#5A8B96',
  },
  spray: {
    500: '#8A9A5E',
  },
  fertigation: {
    500: '#6A8A5E',
  },
  harvest: {
    500: '#C48A40',
  },
  labour: {
    500: '#9A7EAE',
  },
  note: {
    500: '#7A8DAA', // Cellar Ledger note category - dark mode
  },
  // observation maps to note color
  observation: {
    500: '#7A8DAA', // note color - dark mode
  },
  task: {
    500: '#5a8b96',
  },
  expense: {
    500: '#6a9078',
  },
  labTest: {
    soil: '#7A8DAA',
    petiole: '#5A8090',
  },
  // Water Status - Dark mode
  water: {
    critical: '#C45A4A',
    low: '#B88030',
    medium: '#C49843',
    good: '#5A8B65',
  },
} as const;

export const colors = {
  ...baseColors,
  gray: lightGray,
  surface: lightSurface,
} as const;

export const darkColors = {
  ...darkModeColors,
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
  xs: 8, // r-xs from wireframes
  md: 12, // r-sm from wireframes
  lg: 16, // r-md from wireframes
  xl: 24, // r-lg from wireframes
  '2xl': 20,
  '3xl': 32,
  '4xl': 40,
  full: 999, // r-pill from wireframes
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
  const onAccent = isDark ? darkColors.surface[800] : colors.surface[100];
  // Cellar Ledger primary: #355847 (light) / #4A8B6B (dark)
  const primary = isDark ? darkColors.primary[500] : colors.primary[500];
  const error = isDark ? darkColors.error : colors.error;
  const success = isDark ? darkColors.success : colors.success;

  return {
    colorScheme: {
      primary, // resolves to #355847 in light mode, #4A8B6B in dark mode
      onPrimary: onAccent,
      primaryContainer: isDark ? darkColors.primary[800] : colors.primary[100],
      onPrimaryContainer: isDark ? darkColors.primary[50] : colors.primary[900],

      secondary: isDark ? darkColors.secondary[500] : colors.secondary[500],
      onSecondary: onAccent,
      secondaryContainer: isDark ? darkColors.primary[700] : colors.primary[50],
      onSecondaryContainer: isDark ? darkColors.primary[50] : colors.primary[900],

      tertiary: isDark ? darkColors.harvest[500] : colors.harvest[500],
      onTertiary: onAccent,
      tertiaryContainer: isDark ? darkColors.primary[700] : colors.primary[50],
      onTertiaryContainer: isDark ? darkColors.primary[50] : colors.primary[900],

      error,
      onError: onAccent,
      errorContainer: isDark ? '#3d1a1a' : '#FDE8E8',
      onErrorContainer: isDark ? '#FECACA' : '#7F1D1D',

      success,
      onSuccess: onAccent,

      background: themeColors.surface[50], // #FBF8F3 (light) / #121613 (dark)
      // Dark mode uses surface[800] (#E8E4DE) for primary text, not surface[900] (#F0F2F0)
      onBackground: isDark ? themeColors.surface[800] : themeColors.surface[900], // #1E241F (light) / #E8E4DE (dark)

      surface: themeColors.surface[50],
      onSurface: isDark ? themeColors.surface[800] : themeColors.surface[900],
      surfaceVariant: isDark ? themeColors.surface[200] : themeColors.surface[100],
      onSurfaceVariant: isDark ? themeColors.surface[500] : themeColors.surface[500],

      outline: isDark ? themeColors.surface[300] : themeColors.surface[300],
      outlineVariant: isDark ? themeColors.surface[200] : themeColors.surface[200],

      inverseSurface: isDark ? colors.surface[900] : darkColors.surface[50],
      inverseOnSurface: isDark ? colors.surface[50] : darkColors.surface[900],
      inversePrimary: isDark ? darkColors.primary[300] : colors.primary[300],

      shadow: '#000000',
      scrim: '#000000',

      // Not an official role; used for "Needs attention" affordances.
      warning: isDark ? darkColors.warning : colors.warning,
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

// Common component styles - Cellar Ledger design (borders, no heavy shadows)
export const commonStyles = {
  // Glass effect cards - now using border instead of heavy shadow
  glassCard: {
    backgroundColor: colors.surface[100],
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.surface[300],
    // No heavy shadows - use minimal shadow if needed
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
  },
  glassCardDark: {
    backgroundColor: darkColors.surface[100],
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: darkColors.surface[300],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
  },
  // Buttons - use primary token
  primaryButton: {
    backgroundColor: colors.primary[500], // #355847
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
    color: colors.primary[500],
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    textAlign: 'center' as const,
  },
  // Inputs - surface 100 bg, surface 300 border
  input: {
    backgroundColor: colors.surface[100],
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
    color: colors.surface[500],
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
