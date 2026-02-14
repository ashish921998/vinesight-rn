/**
 * Offline Error Boundary – Catches rendering errors in offline-related
 * components and displays a graceful fallback instead of crashing.
 *
 * Phase 8 of offline functionality.
 */

import React, { type ErrorInfo, type ReactNode } from 'react';
import { View, Text, Pressable } from 'react-native';
import { logOfflineEvent } from '@/services/offline-logger';
import { spacing, fontSize, fontWeight, borderRadius, colors } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';

// ── Types ──────────────────────────────────────────────────────────

interface OfflineErrorBoundaryProps {
  /** Child components to render. */
  children: ReactNode;
  /** Optional fallback to render instead of the default error UI. */
  fallback?: ReactNode;
  /** Called when an error is caught. */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface OfflineErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// ── Component ──────────────────────────────────────────────────────

const monospaceFont = 'monospace';

export class OfflineErrorBoundary extends React.Component<
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

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    logOfflineEvent(
      'sync_failed',
      {
        component: 'OfflineErrorBoundary',
        componentStack: errorInfo.componentStack?.slice(0, 500),
      },
      error.message,
    );

    this.props.onError?.(error, errorInfo);
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

        {typeof __DEV__ !== 'undefined' && __DEV__ && this.state.error && (
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
