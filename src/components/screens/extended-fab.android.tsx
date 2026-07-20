import { ExtendedFloatingActionButton, Host, Icon, Text } from '@expo/ui/jetpack-compose';
import { useM3 } from '@/styles/use-theme';
import addIcon from '../../../assets/tab-icons/add.xml';

// Android: native Material 3 ExtendedFloatingActionButton from @expo/ui.
// `Host matchContents` sizes the host box to the pill so the caller can
// position it. Props kept in sync with extended-fab.tsx (moduleSuffixes makes a
// cross-import resolve back to this file, so the type is declared locally).
export function ExtendedFab({
  onPress,
  label,
  accessibilityLabel,
}: {
  onPress: () => void;
  label: string;
  accessibilityLabel?: string;
}) {
  const m3 = useM3();
  return (
    <Host matchContents>
      <ExtendedFloatingActionButton onClick={onPress} containerColor={m3.primary.p500}>
        <ExtendedFloatingActionButton.Icon>
          <Icon
            source={addIcon}
            tint={m3.colorScheme.onPrimary}
            contentDescription={accessibilityLabel ?? label}
          />
        </ExtendedFloatingActionButton.Icon>
        <ExtendedFloatingActionButton.Text>
          <Text color={m3.colorScheme.onPrimary}>{label}</Text>
        </ExtendedFloatingActionButton.Text>
      </ExtendedFloatingActionButton>
    </Host>
  );
}
