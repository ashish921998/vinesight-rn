import React, { Component, ReactNode } from 'react';
import { View, Text, Pressable, ScrollView, Platform, Appearance } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { Symbol as IconSymbol } from '@/components/ui/symbol';
import { getThemeColors, spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { useThemeStore } from '@/stores';
import { colorWithOpacity } from '@/utils/color';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo: errorInfo.componentStack || null,
    });

    // Report to Sentry
    Sentry.withScope((scope) => {
      scope.setContext('errorInfo', {
        componentStack: errorInfo.componentStack || 'No component stack',
      });
      Sentry.captureException(error);
    });

    if (__DEV__) {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      const monospaceFont =
        Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' }) ??
        'monospace';
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const themeMode = useThemeStore.getState().mode;
      const systemScheme = Appearance.getColorScheme();
      const resolvedMode =
        themeMode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : themeMode;
      const colors = getThemeColors(resolvedMode === 'dark');

      return (
        <View
          style={{
            flex: 1,
            backgroundColor: colors.gray[50],
            alignItems: 'center',
            justifyContent: 'center',
            padding: spacing[6],
          }}
        >
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: borderRadius['3xl'],
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: spacing[6],
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
            }}
          >
            <IconSymbol name="exclamationmark.circle.fill" size={56} color="#EF4444" />
          </View>

          <Text
            style={{
              fontSize: fontSize['2xl'],
              fontWeight: fontWeight.bold,
              color: colors.gray[900],
              textAlign: 'center',
              marginBottom: spacing[2],
            }}
          >
            Oops! Something went wrong
          </Text>

          <Text
            style={{
              fontSize: fontSize.base,
              color: colors.gray[600],
              textAlign: 'center',
              marginBottom: spacing[6],
            }}
          >
            We&apos;re sorry for the inconvenience. The app encountered an unexpected error.
          </Text>

          {__DEV__ && this.state.error && (
            <ScrollView
              style={{
                width: '100%',
                maxHeight: 192,
                marginBottom: spacing[6],
                backgroundColor: colorWithOpacity(colors.error, 0.12),
                borderRadius: borderRadius['2xl'],
                padding: spacing[4],
              }}
            >
              <Text
                style={{
                  fontSize: fontSize.xs,
                  fontFamily: monospaceFont,
                  color: colors.error,
                  marginBottom: spacing[2],
                }}
              >
                {this.state.error.toString()}
              </Text>
              {this.state.errorInfo && (
                <Text
                  style={{ fontSize: fontSize.xs, fontFamily: monospaceFont, color: colors.error }}
                >
                  {this.state.errorInfo}
                </Text>
              )}
            </ScrollView>
          )}

          <Pressable
            onPress={this.handleReset}
            style={{
              backgroundColor: colors.primary[600],
              paddingHorizontal: spacing[8],
              paddingVertical: spacing[4],
              borderRadius: borderRadius['2xl'],
            }}
          >
            <Text
              style={{
                color: colors.white,
                fontSize: fontSize.base,
                fontWeight: fontWeight.semibold,
              }}
            >
              Try Again
            </Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}
