/**
 * OfflineBanner
 *
 * A small, non-intrusive banner displayed at the top of the screen when the
 * device is offline. Automatically hides when connectivity is restored.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useOnlineStatus } from '@/hooks/use-online-status';
import { useThemeTokens } from '@/styles/use-theme';

/**
 * Renders a banner when the device is offline.
 * Place this near the top of your layout (e.g. inside the root layout).
 */
export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const insets = useSafeAreaInsets();
  const { m3 } = useThemeTokens();

  if (isOnline) return null;

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + 4,
          backgroundColor: m3.colorScheme.errorContainer,
        },
      ]}
    >
      <Text style={[styles.text, { color: m3.colorScheme.onErrorContainer }]}>
        You are offline — changes will sync when reconnected
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});
