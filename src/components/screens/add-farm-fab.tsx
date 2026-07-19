import { Pressable } from 'react-native';
import { Symbol as Icon } from '@/components/ui/symbol';
import { borderRadius } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';

export type AddFarmFabProps = {
  onPress: () => void;
  accessibilityLabel: string;
};

// iOS / fallback: plain circular Pressable. Android gets the Material 3
// FloatingActionButton via add-farm-fab.android.tsx.
export function AddFarmFab({ onPress, accessibilityLabel }: AddFarmFabProps) {
  const m3 = useM3();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={{
        width: '100%',
        height: '100%',
        borderRadius: borderRadius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: m3.primary.p500,
      }}
    >
      <Icon name="plus" size={28} color={m3.colorScheme.onPrimary} />
    </Pressable>
  );
}
