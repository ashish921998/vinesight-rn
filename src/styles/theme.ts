/**
 * VineSight Design System - Native Styles
 * Ported from tailwind.config.js for inline style usage
 */

export const colors = {
  white: '#ffffff',
  black: '#000000',
  gray: {
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
  },
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
  // Surface Colors (iOS System)
  surface: {
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
  },
  // Status Colors
  warning: '#ff9500',
  error: '#ff3b30',
  success: '#34c759',
  // Water Status
  water: {
    critical: '#db4437',
    low: '#ea8600',
    medium: '#f9a825',
    good: '#0b8d32',
  },
} as const;

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
  16: 64,
  20: 80,
  24: 96,
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

// Common component styles
export const commonStyles = {
  // Glass effect cards
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: borderRadius['2xl'],
    ...shadows.glass,
  },
  glassCardDark: {
    backgroundColor: 'rgba(44, 44, 46, 0.8)',
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
  spacing,
  borderRadius,
  fontSize,
  fontWeight,
  shadows,
  commonStyles,
} as const;

export default theme;
