import { SymbolView, type SymbolViewProps, SymbolWeight } from 'expo-symbols';
import React from 'react';
import { View, Text, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SymbolProps {
  name: SymbolViewProps['name'] | string;
  size?: number;
  color?: string;
  weight?: SymbolWeight;
  style?: StyleProp<ViewStyle>;
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
  'arrow.up.right': 'arrow-up',

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
  'square.grid.2x2.fill': 'grid',
  'list.bullet': 'list',
  ellipsis: 'ellipsis-horizontal',
  'ellipsis.circle': 'ellipsis-horizontal-circle',
  'ellipsis.circle.fill': 'ellipsis-horizontal-circle',
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
  'cloud.slash.fill': 'cloud-offline',
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
  cube: 'cube-outline',

  // Settings
  gearshape: 'settings-outline',
  'gearshape.fill': 'settings',

  // Misc
  'bell.fill': 'notifications',
  'g.circle.fill': 'logo-google',
  'indianrupeesign.circle': 'cash',
  star: 'star-outline',
  'basket.fill': 'basket',

  // Additional common mappings
  'chevron.up.chevron.down': 'swap-vertical',
  'arrow.left': 'arrow-back',
  'arrow.right': 'arrow-forward',
  'arrow.up': 'arrow-up',
  'arrow.down': 'arrow-down',
};

export function Symbol({
  name,
  size = 24,
  color = '#000',
  weight = 'regular',
  style,
}: SymbolProps) {
  const directIonicon = Object.prototype.hasOwnProperty.call(Ionicons.glyphMap, name)
    ? (name as keyof typeof Ionicons.glyphMap)
    : undefined;

  // On iOS 17+, use SF Symbols
  if (process.env.EXPO_OS === 'ios') {
    const fallbackIcon = SYMBOL_TO_IONICON[name] || directIonicon || 'ellipse-outline';
    return (
      <SymbolView
        name={name as SymbolViewProps['name']}
        size={size}
        tintColor={color}
        weight={weight}
        type="monochrome"
        style={style}
        fallback={
          <Ionicons
            name={fallbackIcon}
            size={size}
            color={color}
            style={style as StyleProp<TextStyle>}
          />
        }
      />
    );
  }

  // On Android/web, use Ionicons as fallback
  const ionicon = SYMBOL_TO_IONICON[name] || directIonicon;
  if (ionicon) {
    return (
      <Ionicons name={ionicon} size={size} color={color} style={style as StyleProp<TextStyle>} />
    );
  }

  // Final fallback: show a placeholder
  const containerStyle: StyleProp<ViewStyle> = [
    { width: size, height: size, justifyContent: 'center', alignItems: 'center' },
    style,
  ];

  return (
    <View style={containerStyle}>
      <Text style={{ fontSize: size * 0.6, color }}>•</Text>
    </View>
  );
}
