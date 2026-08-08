import { SymbolView, type SymbolViewProps, type SymbolWeight } from 'expo-symbols';
import React from 'react';
import { View, Text, Platform, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ICON_MAPPING } from '@/utils/icon-mapping';
import { useM3 } from '@/styles/use-theme';
import { AppIcon } from './app-icon';

interface SymbolProps {
  name: string;
  size?: number;
  color?: string;
  /** SF Symbol weight. Applied by `expo-symbols` on iOS. */
  weight?: SymbolWeight;
  style?: StyleProp<ViewStyle>;
}

// Map SF Symbol names to MaterialCommunityIcons for farm/agriculture icons (web fallback).
const SYMBOL_TO_MATERIAL_ICON: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  house: 'barn',
  'house.fill': 'barn',
  spraycan: 'spray-bottle',
  'spraycan.fill': 'spray-bottle',
  'indianrupeesign.circle': 'currency-inr',
  'indianrupeesign.circle.fill': 'currency-inr',
  brain: 'brain',
  'brain.fill': 'brain',
  'building.2.fill': 'office-building',
  'rectangle.stack': 'view-dashboard-outline',
  // Theme/Appearance settings row — SF "circle.lefthalf.filled" (a circle split
  // half light / half dark). Without this it fell through to the "•" placeholder
  // and rendered as a dot on Android.
  'circle.lefthalf.filled': 'theme-light-dark',
  // SF "note.text" (note/document with text lines).
  'note.text': 'note-text-outline',
};

// Map SF Symbol names to Ionicons (web fallback).
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
  'plus.circle': 'add-circle-outline',
  'plus.circle.fill': 'add-circle',
  minus: 'remove',
  'minus.circle': 'remove-circle-outline',
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
  'arrow.down.circle.fill': 'arrow-down-circle',
  'arrow.uturn.backward': 'return-up-back',
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
  'calendar.badge.clock': 'calendar-clear-outline',
  'calendar.badge.exclamationmark': 'calendar-outline',
  clock: 'time-outline',
  'clock.fill': 'time',
  mappin: 'location-outline',
  location: 'location-outline',
  'location.fill': 'location',
  'dollarsign.circle': 'cash-outline',
  'dollarsign.circle.fill': 'cash',
  receipt: 'receipt',
  'receipt.fill': 'receipt',
  'wallet.pass': 'wallet-outline',
  cart: 'cart-outline',
  'cart.fill': 'cart',

  // People
  person: 'person-outline',
  'person.fill': 'person',
  'person.2': 'people-outline',
  'person.2.fill': 'people',
  'person.crop.circle.fill.badge.plus': 'person-add',
  'person.badge.plus': 'person-add',
  'person.badge.plus.fill': 'person-add',
  'person.badge.clock': 'person-add-outline',
  'person.badge.clock.fill': 'person-add',

  // Communication
  phone: 'call-outline',
  'phone.fill': 'call',
  mail: 'mail-outline',
  'mail.fill': 'mail',
  globe: 'globe-outline',

  // Money
  banknote: 'cash',

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
  'cube.box.fill': 'cube',
  'square.stack.3d.up': 'cube-outline',
  'square.stack.3d.up.fill': 'cube',
  'wrench.and.screwdriver': 'build-outline',
  'wrench.and.screwdriver.fill': 'build',
  car: 'car-outline',
  'car.fill': 'car',
  bus: 'bus-outline',
  'bus.fill': 'bus',
  hammer: 'hammer-outline',
  'hammer.fill': 'hammer',

  // Settings
  gearshape: 'settings-outline',
  'gearshape.fill': 'settings',
  'rectangle.portrait.and.arrow.right': 'log-out-outline',

  // Misc
  'bell.fill': 'notifications',
  'bell.badge.fill': 'notifications',
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
  'mic.slash.fill': 'mic-off',
  waveform: 'pulse',
  'sidebar.left': 'menu',
  paperclip: 'attach',
  'square.and.pencil': 'create-outline',
  photo: 'image-outline',
  'photo.fill': 'image',

  // Eye icons for password visibility toggle
  eye: 'eye-outline',
  'eye.slash': 'eye-off-outline',

  // AI Assistant
  sparkles: 'sparkles-outline',
  'sparkles.fill': 'sparkles',

  // Additional common mappings
  'chevron.up.chevron.down': 'swap-vertical',
  'arrow.left': 'arrow-back',
  'arrow.right': 'arrow-forward',
  'arrow.up': 'arrow-up',
  'arrow.down': 'arrow-down',

  // Icons missing from previous mapping
  'list.bullet.rectangle.portrait': 'list-outline',
  'list.bullet.rectangle.portrait.fill': 'list',
  'waveform.and.mic': 'mic-outline',
  'checkmark.seal': 'ribbon-outline',
  'checkmark.seal.fill': 'ribbon',
  'apple.logo': 'logo-apple',
  'arrow.triangle.branch': 'git-branch-outline',
  'drop.circle': 'water-outline',
  'drop.circle.fill': 'water',
  // Web-fallback additions for names that previously had no glyph on Android/web
  'circle.inset.filled': 'radio-button-on',
  'creditcard.fill': 'card',
  'tablecells.fill': 'grid',
  'xmark.seal.fill': 'close-circle',
  'cloud.fill': 'cloud',
  'cloud.drizzle.fill': 'rainy',
  'alarm.fill': 'alarm',
  function: 'calculator',
  scissors: 'cut',
  'square.and.arrow.down.fill': 'download',
  'square.and.arrow.up': 'share-outline',
  'slider.horizontal.3': 'options',
  'hand.tap.fill': 'hand-right',
  'line.3.horizontal.decrease': 'options',
  'line.3.horizontal.decrease.circle': 'options',
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
  const isSprayIcon = resolvedName === 'spraycan' || resolvedName === 'spraycan.fill';
  const isFertigationIcon = resolvedName === 'fertigation' || name === 'fertigation';
  const isAssistantIcon = resolvedName === 'assistant' || name === 'assistant';
  const isGrapeSparkleIcon = resolvedName === 'grape-sparkle' || name === 'grape-sparkle';

  // Keep bespoke AppIcon assets identical across all platforms.
  if (isSprayIcon) return <AppIcon name="spraycan" size={size} color={resolvedColor} />;
  if (isFertigationIcon) return <AppIcon name="fertigation" size={size} color={resolvedColor} />;
  if (isAssistantIcon) return <AppIcon name="assistant" size={size} color={resolvedColor} />;
  if (isGrapeSparkleIcon) return <AppIcon name="grape-sparkle" size={size} color={resolvedColor} />;

  const directIonicon = Object.prototype.hasOwnProperty.call(Ionicons.glyphMap, resolvedName)
    ? (resolvedName as keyof typeof Ionicons.glyphMap)
    : undefined;

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

  // Android/web: vector icons stay in the React Native layout tree and cannot
  // create detached native overlays above modal routes.
  const materialIcon = SYMBOL_TO_MATERIAL_ICON[resolvedName] || SYMBOL_TO_MATERIAL_ICON[name];

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
