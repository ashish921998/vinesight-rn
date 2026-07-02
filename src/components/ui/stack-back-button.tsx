import { Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Symbol } from './symbol';
import { useM3 } from '@/styles/use-theme';
import { spacing } from '@/styles/theme';

/**
 * A stack header back button that navigates back when there is history, and
 * falls back to `fallback` (via `router.replace`) when there isn't — e.g. after
 * a deep link reload or a `replace`-based entry that leaves the native stack
 * empty. Renders a standard `chevron.left`.
 *
 * Used in the professional screens (farmer / farm / lab-reports) where a user
 * may land mid-stack from a notification or reload.
 */
interface StackBackButtonProps {
  /** Route used when `router.canGoBack()` is false. */
  fallback: Href;
}

export function StackBackButton({ fallback }: StackBackButtonProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const m3 = useM3();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('common.back')}
      onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback))}
      hitSlop={8}
      style={{ paddingHorizontal: spacing[2], paddingVertical: spacing[1] }}
    >
      <Symbol name="chevron.left" size={22} color={m3.colorScheme.onSurface} />
    </Pressable>
  );
}
