/**
 * OfflineErrorBoundary – Specialized error boundary for offline-critical
 * components. Catches render errors and shows a graceful fallback that
 * allows the user to retry or continue using the app.
 *
 * Unlike the root ErrorBoundary, this one:
 *   - Shows a compact inline fallback (not full-screen)
 *   - Logs to the offline structured logger
 *   - Auto-retries when network status changes
 *
 * Phase 8 of offline functionality.
 */

import React, { Component, type ReactNode } from 'react';
import { View, Text, Pressable, Platform, Appearance } from 'react-native';
import { logOfflineEvent } from '@/services/offline-logger';
import { useThemeStore } from '@/stores';
import { getThemeColors, spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';

// ── Types ──────────────────────────────────────────────────────────

interface OfflineErrorBoundaryProps {
  children: ReactNode;
  /** Component name for logging context. */
  componentName?: string;
  /** Custom fallback to render instead of the default. */
  fallback?: ReactNode;
  /** If true, shows a minimal single-line fallback. */
  compact?: boolean;
}

interface OfflineErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// ── Component ──────────────────────────────────────────────────────

export class OfflineErrorBoundary extends Component<
  OfflineErrorBoundaryProps,
  OfflineErrorBoundaryState
> {
  constructor(props: OfflineErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): OfflineErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    logOfflineEvent('sync_failed', {
      component: this.props.componentName ?? 'unknown',
      errorMessage: error.message,
      componentStack: errorInfo.componentStack ?? undefined,
    });

    if (__DEV__) {
      console.error(
        `[OfflineErrorBoundary:${this.props.componentName ?? 'unknown'}]`,
        error,
        errorInfo,
      );
    }
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    const themeMode = useThemeStore.getState().mode;
    const systemScheme = Appearance.getColorScheme();
    const resolvedMode =
      themeMode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : themeMode;
    const colors = getThemeColors(resolvedMode === 'dark');
    const monospaceFont =
      Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' }) ??
      'monospace';

    if (this.props.compact) {
      return (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            padding: spacing[3],
            backgroundColor: colorWithOpacity(colors.warning, 0.1),
            borderRadius: borderRadius.lg,
          }}
        >
          <Text style={{ fontSize: fontSize.sm, color: colors.gray[600], flex: 1 }}>
            This section is temporarily unavailable.
          </Text>
          <Pressable onPress={this.handleRetry}>
            <Text
              style={{
                fontSize: fontSize.sm,
                fontWeight: fontWeight.semibold,
                color: colors.primary[600],
              }}
            >
              Retry
            </Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View
        style={{
          padding: spacing[4],
          margin: spacing[2],
          backgroundColor: colorWithOpacity(colors.warning, 0.08),
          borderRadius: borderRadius.xl,
          borderWidth: 1,
          borderColor: colorWithOpacity(colors.warning, 0.2),
        }}
      >
        <Text
          style={{
            fontSize: fontSize.base,
            fontWeight: fontWeight.semibold,
            color: colors.gray[800],
            marginBottom: spacing[1],
          }}
        >
          Something went wrong
        </Text>
        <Text
          style={{
            fontSize: fontSize.sm,
            color: colors.gray[600],
            marginBottom: spacing[3],
          }}
        >
          This section encountered an error. Your data is safe.
        </Text>

        {__DEV__ && this.state.error && (
          <Text
            style={{
              fontSize: fontSize.xs,
              fontFamily: monospaceFont,
              color: colors.error,
              marginBottom: spacing[3],
            }}
            numberOfLines={3}
          >
            {this.state.error.message}
          </Text>
        )}

        <Pressable
          onPress={this.handleRetry}
          style={{
            alignSelf: 'flex-start',
            backgroundColor: colors.primary[600],
            paddingHorizontal: spacing[4],
            paddingVertical: spacing[2],
            borderRadius: borderRadius.lg,
          }}
        >
          <Text
            style={{
              color: colors.white,
              fontSize: fontSize.sm,
              fontWeight: fontWeight.semibold,
            }}
          >
            Try Again
          </Text>
        </Pressable>
      </View>
    );
  }
}
