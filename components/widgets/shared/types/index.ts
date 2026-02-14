import { ViewStyle } from 'react-native';

export interface BaseWidgetProps {
  testID?: string;
  accessibilityLabel?: string;
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
