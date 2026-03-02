import React from 'react';
import {
  Pressable,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useM3 } from '@/styles/use-theme';
import { spacing, fontWeight } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { tapLight } from '@/lib/haptics';
import { PRESS_SCALE, springPress } from '@/lib/animations';
import { Symbol as SymbolIcon } from './symbol';

interface ListRowProps extends Omit<PressableProps, 'style'> {
  title: string;
  subtitle?: string;
  leftIcon?: string;
  rightIcon?: string;
  style?: StyleProp<ViewStyle>;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function ListRow({
  title,
  subtitle,
  leftIcon,
  rightIcon = 'chevron.right',
  style,
  onPress,
  ...props
}: ListRowProps) {
  const m3 = useM3();
  return (
    <AnimatedPressable
      onPress={(event) => {
        tapLight();
        onPress?.(event);
      }}
      style={({ pressed }) => [
        {
          minHeight: 56,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[3],
          borderBottomWidth: 1,
          borderBottomColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.15),
          transform: [{ scale: springPress(pressed ? PRESS_SCALE : 1) }],
          backgroundColor: pressed
            ? colorWithOpacity(m3.colorScheme.onSurface, m3.stateLayerOpacity.pressed)
            : 'transparent',
        },
        style,
      ]}
      {...props}
    >
      {leftIcon ? (
        <View style={{ marginRight: spacing[3] }}>
          <SymbolIcon name={leftIcon} size={20} color={m3.colorScheme.primary} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text
          style={{
            ...m3.typography.bodyLarge,
            color: m3.colorScheme.onSurface,
            fontWeight: fontWeight.semibold,
          }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text style={{ ...m3.typography.labelSmall, color: m3.colorScheme.onSurfaceVariant }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {rightIcon ? (
        <SymbolIcon name={rightIcon} size={16} color={m3.colorScheme.onSurfaceVariant} />
      ) : null}
    </AnimatedPressable>
  );
}
