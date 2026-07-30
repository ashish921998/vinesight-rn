import { Pressable, StyleSheet, View } from 'react-native';
import { Symbol as Icon } from '@/components/ui/symbol';
import { borderRadius } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';

export type FabProps = {
  onPress: () => void;
  accessibilityLabel?: string;
  disabled?: boolean;
};

// iOS / fallback: hand-rolled circular (56dp) FAB. Android gets the native
// Material 3 FloatingActionButton via fab.android.tsx. On iOS touch hit-testing
// follows paint order, so an absolutely-positioned Pressable overlaps correctly
// without extra elevation.
export function Fab({ onPress, accessibilityLabel, disabled }: FabProps) {
  const m3 = useM3();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      style={{
        width: 56,
        height: 56,
        backgroundColor: m3.colorScheme.primary,
        borderRadius: borderRadius.full,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        opacity: disabled ? 0.7 : 1,
      }}
    >
      {({ pressed }) => (
        <>
          <Icon name="plus" size={28} color={m3.colorScheme.onPrimary} />
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
