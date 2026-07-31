import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Symbol as Icon } from '@/components/ui/symbol';
import { borderRadius, fontSize, fontWeight, spacing } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';

export type ExtendedFabProps = {
  onPress: () => void;
  label: string;
  accessibilityLabel?: string;
};

// iOS / fallback: hand-rolled extended (pill) FAB. Android gets the Material 3
// ExtendedFloatingActionButton via extended-fab.android.tsx. The pressed
// state-layer matches fab.tsx and the Material 3 spec.
export function ExtendedFab({ onPress, label, accessibilityLabel }: ExtendedFabProps) {
  const m3 = useM3();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={{
        minWidth: 148,
        height: 56,
        borderRadius: borderRadius.full,
        paddingHorizontal: spacing[5],
        flexDirection: 'row',
        gap: spacing[2],
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: m3.primary.p500,
        overflow: 'hidden',
      }}
    >
      {({ pressed }) => (
        <>
          <Icon name="plus" size={20} color={m3.colorScheme.onPrimary} />
          <Text
            style={{
              color: m3.colorScheme.onPrimary,
              fontSize: fontSize.sm,
              fontWeight: fontWeight.semibold,
            }}
          >
            {label}
          </Text>
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: pressed
                  ? colorWithOpacity(m3.colorScheme.onPrimary, m3.stateLayerOpacity.pressed)
                  : 'transparent',
              },
            ]}
          />
        </>
      )}
    </Pressable>
  );
}
