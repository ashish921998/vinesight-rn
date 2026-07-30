import { FloatingActionButton, Host, Icon } from '@expo/ui/jetpack-compose';
import { useM3 } from '@/styles/use-theme';
import addIcon from '../../../assets/tab-icons/add.xml';

// Android: native Material 3 FloatingActionButton from @expo/ui. Its intrinsic
// Compose elevation means it wins Android touch hit-testing over any scroll
// content beneath it — so it needs none of the elevation/zIndex workaround a
// hand-rolled absolutely-positioned Pressable does. Props kept in sync with
// fab.tsx (`disabled` is accepted for parity; the native button has no disabled
// state, callers guard the handler instead). See extended-fab.android.tsx.
export function Fab({
  onPress,
  accessibilityLabel,
  disabled,
}: {
  onPress: () => void;
  accessibilityLabel?: string;
  disabled?: boolean;
}) {
  const m3 = useM3();
  return (
    <Host matchContents>
      <FloatingActionButton
        onClick={disabled ? () => {} : onPress}
        containerColor={m3.colorScheme.primary}
      >
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
