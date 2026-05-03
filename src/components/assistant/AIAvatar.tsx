/**
 * AIAvatar — the AI brand mark used across the Assistant module.
 * Gradient circle (primary → info-blue) with a two-star sparkle SVG.
 *
 * Matches the design in `vs-ai-primitives.jsx` (IAI icon + gradient circle):
 *   background: linear-gradient(135deg, primary 0%, #4E7384 100%)
 *   icon: two stars, big + small, stroked.
 */

import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeTokens } from '@/styles/use-theme';

interface AIAvatarProps {
  size?: number;
  iconSize?: number;
  style?: ViewStyle;
}

// The info-blue secondary stop (matches `--vs-info` / `#4E7384` in the design).
// Slightly lighter in dark mode to keep contrast on the gradient.
const GRADIENT_END_LIGHT = '#4E7384';
const GRADIENT_END_DARK = '#5A8090';

export function AIAvatar({ size = 28, iconSize, style }: AIAvatarProps) {
  const { m3, isDark } = useThemeTokens();
  const glyphSize = iconSize ?? Math.round(size * 0.5);
  const radius = size / 2;
  const end = isDark ? GRADIENT_END_DARK : GRADIENT_END_LIGHT;

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: radius }, style]}>
      <LinearGradient
        colors={[m3.colorScheme.primary, end]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
      />
      <SparkleIcon size={glyphSize} color={m3.colorScheme.onPrimary} />
    </View>
  );
}

/**
 * Two-star sparkle glyph used as the AI brand mark in the design.
 * Stroked paths (no fill), matching `IAI` in vs-ai-primitives.jsx.
 */
export function SparkleIcon({ size = 14, color = '#FFFFFF' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Big star */}
      <Path
        d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
        fill="none"
      />
      {/* Small star */}
      <Path
        d="M19 16l.7 2L21.5 19l-1.8.7L19 22l-.7-2.3L16.5 19l1.8-1z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
