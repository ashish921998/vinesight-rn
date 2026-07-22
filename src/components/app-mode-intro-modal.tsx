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
 * "Simplified mode" intro prompt. Shown once to *migrating* users who never ran
 * the onboarding pager (new users are marked seen at onboarding completion, so
 * they never reach this). Offers a direct path to Detailed mode so migrating
 * users don't lose features silently.
 *
 * The modal is dismissable: tapping the backdrop or pressing Android hardware
 * back both fall through to "stay simplified" (which marks it seen), so it can't
 * become a blocking teaching gate. The inner card stops touch propagation so
 * taps inside it don't dismiss.
 */
export function AppModeIntroModal({ visible, onEnableDetailed, onStaySimplified }: Props) {
  const { t } = useTranslation();
  const m3 = useM3();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onStaySimplified}>
      <Pressable
        onPress={onStaySimplified}
        style={{
          flex: 1,
          justifyContent: 'center',
          padding: spacing[5],
          backgroundColor: colorWithOpacity('#000000', 0.5),
        }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
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
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/**
 * Inputs to {@link shouldShowAppModeIntro}, mirroring the store fields the gate
 * reads. Kept as a plain object so the visibility rule is unit-testable without
 * mounting the component or the stores.
 */
export interface AppModeIntroVisibilityState {
  isAuthenticated: boolean;
  isLoading: boolean;
  needsProfileCompletion: boolean;
  detailedMode: boolean;
  modeHydrated: boolean;
  hasSeenIntro: boolean;
  introHydrated: boolean;
  tourIsPresenting: boolean;
}

/**
 * Pure predicate: should the Simplified-mode intro modal be shown?
 *
 * True only when the user is authenticated, not mid-profile-completion, both the
 * intro and app-mode stores have hydrated (so a Detailed-mode user can't briefly
 * flip to Simplified before AsyncStorage restores their choice), they haven't
 * seen it yet, they're currently on Simplified mode, and the guided tour isn't
 * actively presenting (so the two overlays never stack). New users never satisfy
 * `!hasSeenIntro` because onboarding completion marks it seen — leaving only the
 * migrating cohort that never ran onboarding.
 */
export function shouldShowAppModeIntro(state: AppModeIntroVisibilityState): boolean {
  return (
    state.isAuthenticated &&
    !state.isLoading &&
    !state.needsProfileCompletion &&
    state.introHydrated &&
    state.modeHydrated &&
    !state.hasSeenIntro &&
    !state.detailedMode &&
    !state.tourIsPresenting
  );
}

/**
 * Mount beside the app's global overlays (e.g. GuidedTourController). Decides
 * whether to show the Simplified-mode intro and wires the actions.
 *
 * This modal now targets only *migrating* users who never ran the onboarding
 * pager — new users are marked seen at onboarding completion, so they never
 * reach this gate. See {@link shouldShowAppModeIntro} for the visibility rule
 * (still guarded by `!tourIsPresenting` so the two overlays never stack).
 */
export function AppModeIntroGate() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const needsProfileCompletion = useAuthStore((s) => s.needsProfileCompletion);

  const detailedMode = useAppModeStore((s) => s.detailedMode);
  const modeHydrated = useAppModeStore((s) => s.hydrated);
  const setDetailedMode = useAppModeStore((s) => s.setDetailedMode);

  const hasSeenIntro = useAppModeIntroStore((s) => s.hasSeenSimplifiedModeIntro);
  const introHydrated = useAppModeIntroStore((s) => s.hydrated);
  const markIntroSeen = useAppModeIntroStore((s) => s.markSeen);

  const guidedTourStatus = useGuidedTourStore((s) => s.status);

  // Only block when the tour overlay is *actively* presenting. `not_started`
  // is the default persisted state for anyone who never launched the tour, so
  // including it here would suppress this intro for every such user.
  const tourIsPresenting = guidedTourStatus === 'in_progress';

  const visible = shouldShowAppModeIntro({
    isAuthenticated,
    isLoading,
    needsProfileCompletion,
    detailedMode,
    modeHydrated,
    hasSeenIntro,
    introHydrated,
    tourIsPresenting,
  });

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
