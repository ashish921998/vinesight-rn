import { SymbolView, type SymbolViewProps, SymbolWeight } from 'expo-symbols';
import React from 'react';
import { View, Text, Platform, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ICON_MAPPING } from '@/utils/icon-mapping';
import { useM3 } from '@/styles/use-theme';
import { AppIcon } from './app-icon';

interface SymbolProps {
  name: SymbolViewProps['name'] | string;
  size?: number;
  color?: string;
  weight?: SymbolWeight;
  style?: StyleProp<ViewStyle>;
}

// Map SF Symbol names to MaterialCommunityIcons for farm/agriculture icons
const SYMBOL_TO_MATERIAL_ICON: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  house: 'barn',
  'house.fill': 'barn',
  spraycan: 'spray-bottle',
  'spraycan.fill': 'spray-bottle',
};

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
  checklist: 'clipboard-outline',
  'checklist.fill': 'clipboard',
  pencil: 'pencil',
  trash: 'trash',
  magnifyingglass: 'search',
  'arrow.clockwise': 'refresh',
  'arrow.up.left.and.arrow.down.right': 'resize',
  'arrow.up.circle.fill': 'arrow-up-circle',
  'envelope.fill': 'mail',
  'lock.fill': 'lock-closed',

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
  'person.badge.clock': 'person-add-outline',
  'person.badge.clock.fill': 'person-add',

  // Money
  banknote: 'cash',

  // Note: 'house' and 'house.fill' are mapped to MaterialCommunityIcons (barn) in SYMBOL_TO_MATERIAL_ICON

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
  spraycan: 'water-outline',
  'spraycan.fill': 'water',
  flask: 'flask-outline',
  'flask.fill': 'flask',
  cube: 'cube-outline',
  'cube.fill': 'cube',
  'square.stack.3d.up': 'cube-outline',
  'square.stack.3d.up.fill': 'cube',
  'wrench.and.screwdriver': 'build-outline',
  'wrench.and.screwdriver.fill': 'build',

  // Settings
  gearshape: 'settings-outline',
  'gearshape.fill': 'settings',
  'rectangle.portrait.and.arrow.right': 'log-out-outline',

  // Misc
  'bell.fill': 'notifications',
  'g.circle.fill': 'logo-google',
  'indianrupeesign.circle': 'cash',
  star: 'star-outline',
  'basket.fill': 'basket',
  compass: 'compass-outline',
  'compass.fill': 'compass',
  'checkmark.shield.fill': 'shield-checkmark',
  'lightbulb.fill': 'bulb',
  'ant.fill': 'bug',
  'paperplane.fill': 'paper-plane',
  mic: 'mic-outline',
  'mic.fill': 'mic',
  'stop.fill': 'stop-circle',

  // Additional common mappings
  'chevron.up.chevron.down': 'swap-vertical',
  'arrow.left': 'arrow-back',
  'arrow.right': 'arrow-forward',
  'arrow.up': 'arrow-up',
  'arrow.down': 'arrow-down',
};

export function SymbolComponent({
  name,
  size = 24,
  color,
  weight = 'regular',
  style,
}: SymbolProps) {
  const m3 = useM3();
  const resolvedColor = color ?? m3.colorScheme.onSurface;
  const resolvedName = ICON_MAPPING[name] ?? name;
  const directIonicon = Object.prototype.hasOwnProperty.call(Ionicons.glyphMap, name)
    ? (name as keyof typeof Ionicons.glyphMap)
    : undefined;
  const materialIcon = SYMBOL_TO_MATERIAL_ICON[resolvedName] || SYMBOL_TO_MATERIAL_ICON[name];
  const isSprayIcon = resolvedName === 'spraycan' || resolvedName === 'spraycan.fill';
  const isFertigationIcon = resolvedName === 'fertigation' || name === 'fertigation';

  // Keep spray icon identical to AppIcon across all platforms.
  if (isSprayIcon) return <AppIcon name="spraycan" size={size} color={resolvedColor} />;
  if (isFertigationIcon) return <AppIcon name="fertigation" size={size} color={resolvedColor} />;

  // On iOS 17+, use SF Symbols
  if (Platform.OS === 'ios') {
    const fallbackIcon =
      SYMBOL_TO_IONICON[resolvedName] ||
      SYMBOL_TO_IONICON[name] ||
      directIonicon ||
      'ellipse-outline';
    return (
      <SymbolView
        name={resolvedName as SymbolViewProps['name']}
        size={size}
        tintColor={resolvedColor}
        weight={weight}
        type="hierarchical"
        style={style}
        fallback={
          <Ionicons
            name={fallbackIcon}
            size={size}
            color={resolvedColor}
            style={style as StyleProp<TextStyle>}
          />
        }
      />
    );
  }

  // On Android/web, check for MaterialCommunityIcons first, then Ionicons
  if (materialIcon) {
    return (
      <MaterialCommunityIcons
        name={materialIcon}
        size={size}
        color={resolvedColor}
        style={style as StyleProp<TextStyle>}
      />
    );
  }

  const ionicon = SYMBOL_TO_IONICON[resolvedName] || SYMBOL_TO_IONICON[name] || directIonicon;
  if (ionicon) {
    return (
      <Ionicons
        name={ionicon}
        size={size}
        color={resolvedColor}
        style={style as StyleProp<TextStyle>}
      />
    );
  }

  // Final fallback: show a placeholder
  const containerStyle: StyleProp<ViewStyle> = [
    { width: size, height: size, justifyContent: 'center', alignItems: 'center' },
    style,
  ];

  return (
    <View style={containerStyle}>
      <Text style={{ fontSize: size * 0.6, color: resolvedColor }}>•</Text>
    </View>
  );
}

export { SymbolComponent as Symbol, SymbolComponent as Icon };
