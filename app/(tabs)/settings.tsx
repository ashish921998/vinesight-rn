import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as Sentry from '@sentry/react-native';
import { useAuthStore, useLanguageStore, useThemeStore } from '@/stores';
import { useProfile, useUpdateProfile, useCurrency, isIOS } from '@/hooks';
import { setAppLanguage } from '@/i18n';
import type { SupportedLanguageCode } from '@/i18n/languages';
import { useM3, useThemeColors } from '@/styles/use-theme';
import { getDefaultCurrency } from '@/i18n/currency';
import { resolveAreaUnitPreference } from '@/utils/preferences';
import { telemetry } from '@/services/telemetry';
import { upsertGuidedTourServerState } from '@/features/guided-tour/service';
import { useGuidedTourStore } from '@/features/guided-tour/store';
import { GUIDED_TOUR_VERSION } from '@/features/guided-tour/constants';
import { isValidE164PhoneNumber, sanitizePhoneDigits } from '@/utils/phone';

import {
  createStyles,
  ProfileSection,
  PreferencesSection,
  AccountSection,
  LinkPhoneModal,
  DeleteAccountModal,
} from '@/components/screens/settings';

interface LinkPhoneParams {
  linkPhone?: string | string[];
}

export default function SettingsScreen() {
  const router = useRouter();
  const { linkPhone } = useLocalSearchParams() as LinkPhoneParams;
  const linkPhoneValue = Array.isArray(linkPhone) ? linkPhone[0] : linkPhone;
  const colors = useThemeColors();
  const m3 = useM3();
  const styles = useMemo(() => createStyles(colors, m3), [colors, m3]);
  const { t } = useTranslation();
  const appVersion =
    Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? 'unknown';
  const appBuild =
    Application.nativeBuildVersion ??
    String(
      Constants.expoConfig?.ios?.buildNumber ?? Constants.expoConfig?.android?.versionCode ?? '',
    );
  const appVersionLabel = appBuild
    ? `Vinesight v${appVersion} (${appBuild})`
    : `Vinesight v${appVersion}`;
  const sentryDsnConfigured = Boolean(process.env.EXPO_PUBLIC_SENTRY_DSN?.trim());

  const handleSendSentryTestEvent = useCallback(() => {
    if (!sentryDsnConfigured) {
      Alert.alert(
        t('settings.sentry.transportDisabledTitle', {
          defaultValue: 'Sentry transport is disabled',
        }),
        t('settings.sentry.transportDisabledDescriptionProd', {
          defaultValue: 'Sentry DSN is missing. Add EXPO_PUBLIC_SENTRY_DSN and rebuild.',
        }),
      );
      return;
    }

    try {
      const eventId = Sentry.captureException(new Error('Sentry setup verification error'));
      Alert.alert(
        t('settings.sentry.testSentTitle', { defaultValue: 'Sentry test event sent' }),
        eventId
          ? t('settings.sentry.testSentDescriptionWithId', {
              defaultValue: 'Event ID: {{eventId}}',
              eventId,
            })
          : t('settings.sentry.testSentDescription', {
              defaultValue: 'Check your Sentry project in a few moments for the test issue.',
            }),
      );
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to send Sentry test event:', error);
      }
      Alert.alert(
        t('settings.sentry.testFailedTitle', { defaultValue: 'Sentry test failed' }),
        t('settings.sentry.testFailedDescription', {
          defaultValue: 'Unable to send a test event. Check Sentry configuration.',
        }),
      );
    }
  }, [sentryDsnConfigured, t]);

  const {
    user,
    session,
    signOut,
    deleteAccount,
    updateUserAreaUnit,
    clearError,
    isLoading: authLoading,
  } = useAuthStore();

  const language = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);
  const themeMode = useThemeStore((s) => s.mode);
  const setThemeMode = useThemeStore((s) => s.setMode);

  const { data: profile, refetch: refetchProfile } = useProfile();
  const updateProfile = useUpdateProfile();
  const currency = useCurrency();

  const [isResettingGuidedTour, setIsResettingGuidedTour] = useState(false);
  const [showLinkPhoneModal, setShowLinkPhoneModal] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);

  const [selectedCurrency, setSelectedCurrency] = useState(() => getDefaultCurrency());
  const [selectedAreaUnit, setSelectedAreaUnit] = useState<'acres' | 'hectares'>('acres');

  const resetGuidedTour = useGuidedTourStore((s) => s.resetForReplay);
  const setReplayResetPending = useGuidedTourStore((s) => s.setReplayResetPending);

  useEffect(() => {
    if (profile) {
      setSelectedCurrency(currency);
    }
    setSelectedAreaUnit(
      resolveAreaUnitPreference(profile?.area_unit_preference ?? user?.user_metadata?.area_unit),
    );
  }, [profile, user, currency]);

  const userName = profile?.full_name || user?.user_metadata?.full_name || 'User';
  const userEmail = session?.user?.email || user?.email || '';

  const authIdentityProviders = useMemo(() => {
    const identities = [
      ...(((user as { identities?: Array<{ provider?: string }> } | null)?.identities ??
        []) as Array<{ provider?: string }>),
      ...(((session?.user as { identities?: Array<{ provider?: string }> } | null)?.identities ??
        []) as Array<{ provider?: string }>),
    ];
    return new Set(
      identities
        .map((identity) => identity.provider?.trim().toLowerCase())
        .filter((provider): provider is string => Boolean(provider)),
    );
  }, [session?.user, user]);

  const isPhoneAuthUser = authIdentityProviders.has('phone');

  const linkedAuthPhone = useMemo(() => {
    const normalizeToE164 = (value: string | null | undefined): string | null => {
      const trimmed = value?.trim();
      if (!trimmed) return null;
      if (isValidE164PhoneNumber(trimmed)) return trimmed;

      if (trimmed.startsWith('+')) {
        const digits = sanitizePhoneDigits(trimmed);
        const normalized = digits ? `+${digits}` : '';
        return isValidE164PhoneNumber(normalized) ? normalized : null;
      }

      const digits = sanitizePhoneDigits(trimmed);
      const normalized = digits ? `+${digits}` : '';
      return isValidE164PhoneNumber(normalized) ? normalized : null;
    };

    const identityPhones = [
      ...(((user as { identities?: Array<{ identity_data?: { phone?: string } }> } | null)
        ?.identities ?? []) as Array<{ identity_data?: { phone?: string } }>),
      ...(((session?.user as { identities?: Array<{ identity_data?: { phone?: string } }> } | null)
        ?.identities ?? []) as Array<{ identity_data?: { phone?: string } }>),
    ]
      .map((identity) => normalizeToE164(identity.identity_data?.phone))
      .filter((value): value is string => Boolean(value));

    const candidates = [session?.user?.phone, ...identityPhones];

    for (const candidate of candidates) {
      const normalized = normalizeToE164(candidate);
      if (normalized) return normalized;
    }
    return null;
  }, [session?.user, user]);

  const deleteVerificationPhone = linkedAuthPhone ?? '';
  const isEmailOtpEnforced = Boolean(userEmail.trim());
  const requireEmailOtpForDelete = isEmailOtpEnforced && !isPhoneAuthUser;
  const canAttemptDeleteWithPhone = isValidE164PhoneNumber(deleteVerificationPhone);
  const hasSavedPhoneToVerify = false;

  const phoneActionTitle = linkedAuthPhone
    ? t('settings.linkPhone.changePhone')
    : hasSavedPhoneToVerify
      ? t('settings.linkPhone.verifyTitle')
      : t('settings.linkPhone.title');
  const phoneActionValue = linkedAuthPhone;

  // Open link phone modal from deep link param
  useEffect(() => {
    if (linkPhoneValue !== '1') return;
    clearError();
    setShowLinkPhoneModal(true);
  }, [linkPhoneValue, clearError]);

  const handleOpenLinkPhone = useCallback(() => {
    router.setParams({ linkPhone: '1' });
    clearError();
    setShowLinkPhoneModal(true);
  }, [clearError, router]);

  const handleCloseLinkPhone = useCallback(() => {
    setShowLinkPhoneModal(false);
    router.setParams({ linkPhone: undefined });
  }, [router]);

  const handleSignOut = () => {
    Alert.alert(t('settings.signOutConfirmTitle'), t('settings.signOutConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.signOut'),
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
          } catch (error) {
            if (__DEV__) {
              console.error('Sign out error:', error);
            }
            Alert.alert(t('common.error'), t('settings.errors.signOutFailed'));
          }
        },
      },
    ]);
  };

  const handleReplayGuidedTour = useCallback(async () => {
    if (isResettingGuidedTour) return;
    setIsResettingGuidedTour(true);
    try {
      resetGuidedTour();
      setReplayResetPending(true);
      void upsertGuidedTourServerState({
        tour_status: 'not_started',
        current_step: 'welcome',
        skipped_at_step: null,
        reminders_sent: 0,
        tour_started_at: null,
        tour_completed_at: null,
        tour_expired_at: null,
        last_active_at: new Date().toISOString(),
        active_farm_id: null,
        locale: language === 'hi' || language === 'mr' ? language : 'en',
        tour_version: GUIDED_TOUR_VERSION,
        clear_nullable_fields: true,
      })
        .then(() => setReplayResetPending(false))
        .catch((error) => {
          if (__DEV__) {
            console.warn(
              '[guided-tour] server reset sync failed (will retry automatically):',
              error,
            );
          }
        });

      telemetry.capture('tour_restarted');
      router.push('/(tabs)');
    } catch (error) {
      if (__DEV__) {
        console.warn('Failed to reset guided tour:', error);
      }
      Alert.alert(t('common.error'), t('common.tryAgain'));
    } finally {
      setIsResettingGuidedTour(false);
    }
  }, [isResettingGuidedTour, language, resetGuidedTour, router, t, setReplayResetPending]);

  const handleDeleteAccount = () => {
    telemetry.capture('account_delete_flow_opened', {
      has_phone_verification: canAttemptDeleteWithPhone,
      requires_email_otp: requireEmailOtpForDelete,
    });
    setShowDeleteAccount(true);
  };

  const handleSaveProfile = async (name: string) => {
    try {
      await updateProfile.mutateAsync({
        full_name: name || undefined,
      });
      refetchProfile();
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to update profile:', error);
      }
      Alert.alert(t('common.error'), t('settings.errors.updateProfileFailed'));
      throw error;
    }
  };

  const handleLanguageChange = (code: SupportedLanguageCode) => {
    setLanguage(code);
    setAppLanguage(code);
  };

  const handleCurrencyChange = async (code: string) => {
    try {
      await updateProfile.mutateAsync({ currency_preference: code });
      setSelectedCurrency(code);
      refetchProfile();
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to update currency:', error);
      }
      Alert.alert(t('common.error'), t('settings.errors.updateCurrencyFailed'));
    }
  };

  const handleAreaUnitChange = async (unit: 'hectares' | 'acres') => {
    const previousUnit = selectedAreaUnit;
    try {
      await updateProfile.mutateAsync({ area_unit_preference: unit });
      try {
        await updateUserAreaUnit(unit);
      } catch (areaUnitError) {
        // Rollback profile change if auth metadata update fails
        await updateProfile.mutateAsync({ area_unit_preference: previousUnit });
        throw areaUnitError;
      }
      setSelectedAreaUnit(resolveAreaUnitPreference(unit));
      refetchProfile();
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to update area unit:', error);
      }
      Alert.alert(t('common.error'), t('settings.errors.updateAreaUnitFailed'));
    }
  };

  const handleConfirmDeleteAccount = async (reason: string) => {
    await deleteAccount(reason);
    // Note: DeleteAccountModal handles success/failure alerts and modal closing
    // If deleteAccount throws, it propagates up so DeleteAccountModal can show error alert
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 32 }}
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets={isIOS}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <ProfileSection
        userName={userName}
        userEmail={userEmail}
        linkedAuthPhone={linkedAuthPhone}
        hasSavedPhoneToVerify={hasSavedPhoneToVerify}
        styles={styles}
        colors={colors}
        m3={m3}
        profile={profile ?? { full_name: userName }}
        onSaveProfile={handleSaveProfile}
        onOpenLinkPhone={handleOpenLinkPhone}
      />

      <PreferencesSection
        language={language}
        themeMode={themeMode}
        selectedCurrency={selectedCurrency}
        selectedAreaUnit={selectedAreaUnit}
        isResettingGuidedTour={isResettingGuidedTour}
        styles={styles}
        colors={colors}
        m3={m3}
        onLanguageChange={handleLanguageChange}
        onThemeChange={setThemeMode}
        onCurrencyChange={handleCurrencyChange}
        onAreaUnitChange={handleAreaUnitChange}
        onReplayGuidedTour={handleReplayGuidedTour}
      />

      <AccountSection
        phoneActionTitle={phoneActionTitle}
        phoneActionValue={phoneActionValue}
        authLoading={authLoading}
        styles={styles}
        colors={colors}
        m3={m3}
        onOpenLinkPhone={handleOpenLinkPhone}
        onSignOut={handleSignOut}
        onDeleteAccount={handleDeleteAccount}
      />

      {/* App Version */}
      <View style={styles.appVersionContainer}>
        <Text
          style={styles.appVersion}
          textBreakStrategy="highQuality"
          lineBreakStrategyIOS="standard"
        >
          {appVersionLabel}
        </Text>
        <Text
          style={styles.appVersionSubtitle}
          textBreakStrategy="highQuality"
          lineBreakStrategyIOS="standard"
        >
          {t('settings.madeForVineyardManagement')}
        </Text>
        {__DEV__ ? (
          <Pressable
            onPress={handleSendSentryTestEvent}
            style={styles.sentryTestButton}
            accessibilityRole="button"
            accessibilityLabel={t('settings.sentry.testButtonA11y', {
              defaultValue: 'Send Sentry test event',
            })}
          >
            <Text
              style={styles.sentryTestButtonText}
              textBreakStrategy="highQuality"
              lineBreakStrategyIOS="standard"
            >
              {t('settings.sentry.testButton', { defaultValue: 'Send Sentry test event' })}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <LinkPhoneModal
        visible={showLinkPhoneModal}
        linkedAuthPhone={linkedAuthPhone}
        hasSavedPhoneToVerify={hasSavedPhoneToVerify}
        styles={styles}
        colors={colors}
        m3={m3}
        onClose={handleCloseLinkPhone}
        onSuccess={handleCloseLinkPhone}
        refetchProfile={refetchProfile}
      />

      <DeleteAccountModal
        visible={showDeleteAccount}
        onClose={() => setShowDeleteAccount(false)}
        userEmail={userEmail}
        deleteVerificationPhone={deleteVerificationPhone}
        canAttemptDeleteWithPhone={canAttemptDeleteWithPhone}
        requireEmailOtpForDelete={requireEmailOtpForDelete}
        onDeleteAccount={handleConfirmDeleteAccount}
        styles={styles}
        colors={colors}
        m3={m3}
      />
    </ScrollView>
  );
}
