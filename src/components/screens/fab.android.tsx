import { FloatingActionButton, Host, Icon } from '@expo/ui/jetpack-compose';
import { alpha } from '@expo/ui/jetpack-compose/modifiers';
import { useM3 } from '@/styles/use-theme';
import addIcon from '../../../assets/tab-icons/add.xml';

// Android: native Material 3 FloatingActionButton from @expo/ui. Its intrinsic
// Compose elevation means it wins Android touch hit-testing over any scroll
// content beneath it — so it needs none of the elevation/zIndex workaround a
// hand-rolled absolutely-positioned Pressable does. Props kept in sync with
// fab.tsx. The native button exposes no `disabled` prop or accessibility-state
// prop, so when disabled we dim it via the `alpha` modifier (matching fab.tsx's
// 0.7 opacity) and leave `onClick` unwired instead of installing a no-op.
// See extended-fab.android.tsx.
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
        onClick={disabled ? undefined : onPress}
        containerColor={m3.colorScheme.primary}
        modifiers={disabled ? [alpha(0.7)] : undefined}
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
