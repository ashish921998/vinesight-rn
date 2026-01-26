import { SymbolView, SymbolWeight } from 'expo-symbols';
import React from 'react';
import { View, Text, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SymbolProps {
  name: string;
  size?: number;
  color?: string;
  weight?: SymbolWeight;
}

// Map SF Symbol names to Ionicons as fallback
const SYMBOL_TO_IONICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  // Navigation
  'chevron.left': 'chevron-back',
  'chevron.right': 'chevron-forward',
  'chevron.up': 'chevron-up',
  'chevron.down': 'chevron-down',
  xmark: 'close',
  'xmark.circle.fill': 'close-circle',

  // Actions
  plus: 'add',
  'plus.circle.fill': 'add-circle',
  'minus.circle.fill': 'remove-circle',
  checkmark: 'checkmark',
  'checkmark.circle.fill': 'checkmark-circle',
  'checkmark.square.fill': 'checkbox',
  pencil: 'pencil',
  trash: 'trash',
  magnifyingglass: 'search',
  'arrow.clockwise': 'refresh',
  'arrow.up.left.and.arrow.down.right': 'resize',
  'arrow.up.circle.fill': 'arrow-up-circle',

  // UI Elements
  'square.grid.2x2': 'grid',
  'list.bullet': 'list',
  ellipsis: 'ellipsis-horizontal',
  'ellipsis.circle': 'ellipsis-horizontal-circle',
  'line.3.horizontal': 'menu',
  square: 'square-outline',
  circle: 'ellipse-outline',

  // Agriculture
  leaf: 'leaf-outline',
  'leaf.fill': 'leaf',
  drop: 'water-outline',
  'drop.fill': 'water',
  'sun.max.fill': 'sunny',
  'cloud.sun.fill': 'partly-sunny',
  'cloud.rain.fill': 'rainy',
  'bolt.fill': 'flash',

  // Business
  calendar: 'calendar-outline',
  clock: 'time-outline',
  'clock.fill': 'time',
  location: 'location-outline',
  'location.fill': 'location',
  'dollarsign.circle': 'cash-outline',
  'dollarsign.circle.fill': 'cash',
  receipt: 'receipt',
  'wallet.pass': 'wallet-outline',

  // People
  person: 'person-outline',
  'person.fill': 'person',
  'person.2': 'people-outline',
  'person.2.fill': 'people',

  // Analytics
  'chart.bar': 'bar-chart-outline',
  'chart.bar.fill': 'analytics',
  'chart.line.uptrend.xyaxis': 'trending-up',
  'chart.line.downtrend.xyaxis': 'trending-down',
  gauge: 'speedometer',

  // Info & Alerts
  'info.circle': 'information-circle-outline',
  'info.circle.fill': 'information-circle',
  'exclamationmark.circle': 'alert-circle-outline',
  'exclamationmark.circle.fill': 'alert-circle',
  'exclamationmark.triangle': 'warning-outline',
  'exclamationmark.triangle.fill': 'warning',
  'questionmark.circle': 'help-circle-outline',

  // Documents
  document: 'document',
  'doc.fill': 'document',
  'doc.text': 'document-text-outline',
  'doc.text.fill': 'document-text',

  // Tools & Science
  flask: 'flask-outline',
  'flask.fill': 'flask',

  // Settings
  gearshape: 'settings-outline',
  'gearshape.fill': 'settings',

  // Misc
  'bell.fill': 'notifications',
  star: 'star-outline',
  'basket.fill': 'basket',

  // Additional common mappings
  'chevron.up.chevron.down': 'swap-vertical',
  'arrow.left': 'arrow-back',
  'arrow.right': 'arrow-forward',
  'arrow.up': 'arrow-up',
  'arrow.down': 'arrow-down',
};

export function Symbol({ name, size = 24, color = '#000', weight = 'regular' }: SymbolProps) {
  // On iOS 17+, use SF Symbols
  if (Platform.OS === 'ios') {
    const fallbackIcon = SYMBOL_TO_IONICON[name] || 'ellipse-outline';
    return (
      <SymbolView
        name={name}
        size={size}
        tintColor={color}
        weight={weight}
        type="monochrome"
        fallback={<Ionicons name={fallbackIcon} size={size} color={color} />}
      />
    );
  }

  // On Android/web, use Ionicons as fallback
  const ionicon = SYMBOL_TO_IONICON[name];
  if (ionicon) {
    return <Ionicons name={ionicon} size={size} color={color} />;
  }

  // Final fallback: show a placeholder
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: size * 0.6, color }}>•</Text>
    </View>
  );
}
