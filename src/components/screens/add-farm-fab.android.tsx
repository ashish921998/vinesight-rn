import { FloatingActionButton, Host, Icon } from '@expo/ui/jetpack-compose';
import { useM3 } from '@/styles/use-theme';
import addIcon from '../../../assets/tab-icons/add.xml';

// Android: native Material 3 FloatingActionButton from @expo/ui. Host fills the
// 56x56 box the caller positions (GuidedTourTarget), matching the M3 FAB size.
// Props kept in sync with add-farm-fab.tsx (moduleSuffixes makes a cross-import
// resolve back to this file, so the type is declared locally).
export function AddFarmFab({
  onPress,
  accessibilityLabel,
}: {
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const m3 = useM3();
  return (
    <Host style={{ width: '100%', height: '100%' }}>
      <FloatingActionButton onClick={onPress} containerColor={m3.primary.p500}>
        <FloatingActionButton.Icon>
          <Icon
            source={addIcon}
            tint={m3.colorScheme.onPrimary}
            contentDescription={accessibilityLabel}
          />
        </FloatingActionButton.Icon>
      </FloatingActionButton>
    </Host>
  );
}
