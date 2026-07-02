import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
import { borderRadius, fontSize, fontWeight, shadows, spacing } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { useAuthStore, useAppModeStore, useAppModeIntroStore } from '@/stores';
import { useGuidedTourStore } from '@/features/guided-tour';

interface Props {
  visible: boolean;
  onEnableDetailed: () => void;
  onStaySimplified: () => void;
}

/**
 * One-time "Simplified mode" intro prompt. Shown the first time a user lands on
 * Simplified mode after the app-mode toggle ships. Offers a direct path back to
 * Detailed mode so existing users don't lose features silently.
 *
 * The backdrop is intentionally NOT tap-to-dismiss — the user must pick one of
 * the two actions so they can't accidentally lose the easy path to Detailed.
 */
export function AppModeIntroModal({ visible, onEnableDetailed, onStaySimplified }: Props) {
  const { t } = useTranslation();
  const m3 = useM3();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onStaySimplified}>
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          padding: spacing[5],
          backgroundColor: colorWithOpacity('#000000', 0.5),
        }}
      >
        <View
          style={{
            backgroundColor: m3.surface.surfaceContainer,
            borderRadius: borderRadius['2xl'],
            padding: spacing[5],
            maxWidth: 480,
            alignSelf: 'center',
            width: '100%',
            borderWidth: 1,
            borderColor: colorWithOpacity(m3.colorScheme.outline, 0.24),
            ...shadows.xl,
            elevation: 8,
          }}
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: borderRadius.full,
              alignItems: 'center',
              justifyContent: 'center',
              alignSelf: 'center',
              marginBottom: spacing[4],
              backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
            }}
          >
            <UiSymbol name="rectangle.stack" size={26} color={m3.colorScheme.primary} />
          </View>

          <Text
            style={{
              color: m3.colorScheme.onSurface,
              fontSize: fontSize['2xl'],
              fontWeight: fontWeight.bold,
              textAlign: 'center',
            }}
          >
            {t('settings.appModeIntro.title')}
          </Text>
          <Text
            style={{
              color: m3.colorScheme.onSurfaceVariant,
              marginTop: spacing[2],
              fontSize: fontSize.base,
              lineHeight: 22,
              textAlign: 'center',
            }}
          >
            {t('settings.appModeIntro.body')}
          </Text>

          <Pressable
            onPress={onEnableDetailed}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={({ pressed }) => ({
              marginTop: spacing[5],
              backgroundColor: pressed
                ? colorWithOpacity(m3.colorScheme.primary, 0.88)
                : m3.colorScheme.primary,
              borderRadius: borderRadius.xl,
              paddingVertical: spacing[3],
              alignItems: 'center',
              shadowColor: m3.colorScheme.primary,
              shadowOpacity: 0.2,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 6 },
              elevation: 3,
              transform: [{ scale: pressed ? 0.992 : 1 }],
            })}
          >
            <Text
              style={{
                color: m3.colorScheme.onPrimary,
                fontWeight: fontWeight.semibold,
                fontSize: fontSize.base,
              }}
            >
              {t('settings.appModeIntro.enableDetailed')}
            </Text>
          </Pressable>

          <Pressable
            onPress={onStaySimplified}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={({ pressed }) => ({
              marginTop: spacing[2],
              alignItems: 'center',
              paddingVertical: spacing[3],
              borderRadius: borderRadius.lg,
              backgroundColor: pressed
                ? colorWithOpacity(m3.colorScheme.onSurface, 0.06)
                : 'transparent',
            })}
          >
            <Text style={{ color: m3.colorScheme.onSurfaceVariant, fontWeight: fontWeight.medium }}>
              {t('settings.appModeIntro.staySimplified')}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Mount beside the app's global overlays (e.g. GuidedTourController). Decides
 * whether to show the one-time Simplified-mode intro and wires the actions.
 *
 * Visible only when: authenticated, not mid-profile-completion, intro store has
 * hydrated, the user hasn't seen it yet, they're currently on Simplified mode,
 * and the guided tour isn't actively presenting (so the two overlays never
 * stack).
 */
export function AppModeIntroGate() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const needsProfileCompletion = useAuthStore((s) => s.needsProfileCompletion);

  const detailedMode = useAppModeStore((s) => s.detailedMode);
  const setDetailedMode = useAppModeStore((s) => s.setDetailedMode);

  const hasSeenIntro = useAppModeIntroStore((s) => s.hasSeenSimplifiedModeIntro);
  const introHydrated = useAppModeIntroStore((s) => s.hydrated);
  const markIntroSeen = useAppModeIntroStore((s) => s.markSeen);

  const guidedTourStatus = useGuidedTourStore((s) => s.status);

  const tourIsPresenting = guidedTourStatus === 'in_progress' || guidedTourStatus === 'not_started';

  const visible =
    isAuthenticated &&
    !isLoading &&
    !needsProfileCompletion &&
    introHydrated &&
    !hasSeenIntro &&
    !detailedMode &&
    !tourIsPresenting;

  if (!visible) return null;

  return (
    <AppModeIntroModal
      visible={visible}
      onEnableDetailed={() => {
        setDetailedMode(true);
        markIntroSeen();
      }}
      onStaySimplified={markIntroSeen}
    />
  );
}
