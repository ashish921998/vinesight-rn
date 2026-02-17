import { ViewStyle } from 'react-native';

/** Base props shared by all widget components */
export interface BaseWidgetProps {
  /** Test identifier for testing frameworks */
  testID?: string;
  /** Accessibility label for screen readers */
  accessibilityLabel?: string;
  /** Custom styles to merge with widget container */
  style?: ViewStyle;
}

export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export type TrendDirection = 'up' | 'down' | 'neutral';

export type StatusType = 'critical' | 'due' | 'optimal' | 'delayed' | 'info';

export interface ThemeColors {
  primary: string;
  secondary: string;
  background: string;
  text: string;
  error: string;
  success: string;
  warning: string;
}

export interface ThemeSpacing {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
}

export interface Theme {
  colors: ThemeColors;
  spacing: ThemeSpacing;
  borderRadius: number;
}
