import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  FlatList,
  Alert,
  TextInput,
  Switch,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as Sentry from '@sentry/react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore, useLanguageStore, useNotificationStore, useThemeStore } from '@/stores';
import { useProfile, useUpdateProfile, useCurrency, isIOS } from '@/hooks';
import { CURRENCIES, AREA_UNITS } from '@/constants/calculator-models';
import { Symbol as UISymbol } from '@/components/ui/symbol';
import {
  spacing,
  borderRadius,
  fontSize,
  fontWeight,
  type ThemeColors,
  getM3Theme,
} from '@/styles/theme';
import { supabase } from '@/lib/supabase';
import { setAppLanguage } from '@/i18n';
import type { SupportedLanguageCode } from '@/i18n/languages';
import type { ThemeMode } from '@/stores/theme-store';
import {
  ensureNotificationPermissions,
  scheduleDailyWaterReminder,
  cancelNotification,
} from '@/services/notifications';
import { useM3, useThemeColors } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { getDefaultCurrency } from '@/i18n/currency';
import { resolveAreaUnitPreference } from '@/utils/preferences';
import { assistantMemoryService } from '@/services/assistant-memory';
import { telemetry } from '@/services/telemetry';
import { upsertGuidedTourServerState } from '@/features/guided-tour/service';
import { useGuidedTourStore } from '@/features/guided-tour/store';
import { ASSISTANT_MEMORY_RETENTION_DAYS } from '@/constants/assistant-memory';
import { assistantFeatureFlags } from '@/constants/assistant-flags';
import {
  buildE164PhoneNumber as buildNormalizedE164PhoneNumber,
  sanitizePhoneDigits,
  isValidE164PhoneNumber,
} from '@/utils/phone';

interface Country {
  name: string;
  code: string;
  dialCode: string;
}

const COUNTRIES: Country[] = [
  { name: 'India', code: 'IN', dialCode: '+91' },
  { name: 'United States', code: 'US', dialCode: '+1' },
  { name: 'United Kingdom', code: 'GB', dialCode: '+44' },
  { name: 'Australia', code: 'AU', dialCode: '+61' },
  { name: 'Canada', code: 'CA', dialCode: '+1' },
  { name: 'Germany', code: 'DE', dialCode: '+49' },
  { name: 'France', code: 'FR', dialCode: '+33' },
  { name: 'Brazil', code: 'BR', dialCode: '+55' },
  { name: 'Japan', code: 'JP', dialCode: '+81' },
  { name: 'South Africa', code: 'ZA', dialCode: '+27' },
  { name: 'New Zealand', code: 'NZ', dialCode: '+64' },
  { name: 'Mexico', code: 'MX', dialCode: '+52' },
  { name: 'Italy', code: 'IT', dialCode: '+39' },
  { name: 'Spain', code: 'ES', dialCode: '+34' },
  { name: 'Netherlands', code: 'NL', dialCode: '+31' },
  { name: 'UAE', code: 'AE', dialCode: '+971' },
  { name: 'China', code: 'CN', dialCode: '+86' },
  { name: 'Russia', code: 'RU', dialCode: '+7' },
  { name: 'Nigeria', code: 'NG', dialCode: '+234' },
  { name: 'Kenya', code: 'KE', dialCode: '+254' },
];

const DEFAULT_COUNTRY = COUNTRIES[0];
const MAX_PHONE_NUMBER_EDITS_PER_FLOW = 2;

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
  const canSendSentryEvent = !__DEV__ && sentryDsnConfigured;

  const handleSendSentryTestEvent = useCallback(() => {
    if (!canSendSentryEvent) {
      Alert.alert(
        t('settings.sentry.transportDisabledTitle', {
          defaultValue: 'Sentry transport is disabled',
        }),
        __DEV__
          ? t('settings.sentry.transportDisabledDescriptionDev', {
              defaultValue:
                'This app disables Sentry in development. Test with a preview/production build, or temporarily enable Sentry in app/_layout.tsx for local verification.',
            })
          : t('settings.sentry.transportDisabledDescriptionProd', {
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
  }, [canSendSentryEvent, t]);

  const {
    user,
    signOut,
    deleteAccount,
    updateUserAreaUnit,
    linkPhoneNumber,
    verifyPhoneLinking,
    cancelPhoneLinking,
    phoneLinkingPending,
    phoneLinkingNumber,
    phoneLinkingLoading,
    clearError,
    errorMessage: authErrorMessage,
    isLoading: authLoading,
  } = useAuthStore();

  const language = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);
  const themeMode = useThemeStore((s) => s.mode);
  const setThemeMode = useThemeStore((s) => s.setMode);

  const dailyWaterReminderEnabled = useNotificationStore((s) => s.dailyWaterReminderEnabled);
  const dailyWaterNotificationId = useNotificationStore((s) => s.dailyWaterReminderNotificationId);
  const setDailyWaterReminderEnabled = useNotificationStore((s) => s.setDailyWaterReminderEnabled);
  const setDailyWaterNotificationId = useNotificationStore(
    (s) => s.setDailyWaterReminderNotificationId,
  );

  const lowWaterAlertsEnabled = useNotificationStore((s) => s.lowWaterAlertsEnabled);
  const setLowWaterAlertsEnabled = useNotificationStore((s) => s.setLowWaterAlertsEnabled);

  const taskRemindersEnabled = useNotificationStore((s) => s.taskRemindersEnabled);
  const setTaskRemindersEnabled = useNotificationStore((s) => s.setTaskRemindersEnabled);
  const taskSchedules = useNotificationStore((s) => s.taskSchedules);
  const clearAllTaskSchedules = useNotificationStore((s) => s.clearAllTaskSchedules);

  const warehouseReorderAlertsEnabled = useNotificationStore(
    (s) => s.warehouseReorderAlertsEnabled,
  );
  const setWarehouseReorderAlertsEnabled = useNotificationStore(
    (s) => s.setWarehouseReorderAlertsEnabled,
  );
  const clearNotifiedWarehouseItemIds = useNotificationStore(
    (s) => s.clearNotifiedWarehouseItemIds,
  );

  const petioleTestRemindersEnabled = useNotificationStore((s) => s.petioleTestRemindersEnabled);
  const setPetioleTestRemindersEnabled = useNotificationStore(
    (s) => s.setPetioleTestRemindersEnabled,
  );
  const petioleTestSchedules = useNotificationStore((s) => s.petioleTestSchedules);
  const clearAllPetioleTestSchedules = useNotificationStore((s) => s.clearAllPetioleTestSchedules);
  const { data: profile, refetch: refetchProfile } = useProfile();
  const updateProfile = useUpdateProfile();

  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [showAreaPicker, setShowAreaPicker] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [showLinkPhoneModal, setShowLinkPhoneModal] = useState(false);
  const [isExportingAssistantData, setIsExportingAssistantData] = useState(false);
  const [isDeletingAssistantData, setIsDeletingAssistantData] = useState(false);
  const [isResettingGuidedTour, setIsResettingGuidedTour] = useState(false);

  // Edit profile form state
  const [editName, setEditName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Delete account form state
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletePhoneOtp, setDeletePhoneOtp] = useState('');
  const [deleteEmailOtp, setDeleteEmailOtp] = useState('');
  const [deletePhoneOtpSent, setDeletePhoneOtpSent] = useState(false);
  const [deleteEmailOtpSent, setDeleteEmailOtpSent] = useState(false);
  const [deletePhoneVerified, setDeletePhoneVerified] = useState(false);
  const [deleteEmailVerified, setDeleteEmailVerified] = useState(false);
  const [isSendingDeleteOtp, setIsSendingDeleteOtp] = useState(false);
  const [isVerifyingDeleteOtp, setIsVerifyingDeleteOtp] = useState(false);
  const [linkPhoneInput, setLinkPhoneInput] = useState('');
  const [linkPhoneCode, setLinkPhoneCode] = useState('');
  const [isPhoneLinkCodeStep, setIsPhoneLinkCodeStep] = useState(false);
  const [phoneNumberEditCount, setPhoneNumberEditCount] = useState(0);
  const [linkPhoneLocalError, setLinkPhoneLocalError] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const resetGuidedTour = useGuidedTourStore((s) => s.resetForReplay);

  // Local preferences state
  const [selectedCurrency, setSelectedCurrency] = useState(() => getDefaultCurrency());
  const [selectedAreaUnit, setSelectedAreaUnit] = useState<'acres' | 'hectares'>('acres');
  const currency = useCurrency();

  useEffect(() => {
    if (profile) {
      setEditName(profile.full_name || '');
      setSelectedCurrency(currency);
    }
    setSelectedAreaUnit(
      resolveAreaUnitPreference(profile?.area_unit_preference ?? user?.user_metadata?.area_unit),
    );
  }, [profile, user, currency]);

  const userName = profile?.full_name || user?.user_metadata?.full_name || 'User';
  const userEmail = profile?.email || user?.email || '';
  const linkedAuthPhone = user?.phone || null;
  const deleteVerificationPhone = linkedAuthPhone?.trim() ?? '';
  const isEmailOtpEnforced = Boolean(userEmail.trim());
  const requireEmailOtpForDelete = isEmailOtpEnforced;
  const canAttemptDeleteWithPhone = isValidE164PhoneNumber(deleteVerificationPhone);
  const phoneVerificationLabel = canAttemptDeleteWithPhone
    ? t('settings.deleteAccountModal.phoneVerificationLabel', {
        defaultValue: 'Mobile verification (required)',
      })
    : t('settings.deleteAccountModal.phoneVerificationLabel', {
        defaultValue: 'Mobile verification',
      });
  const hasSavedPhoneToVerify = false;
  const isLinkPhoneModalVisible = showLinkPhoneModal || phoneLinkingPending;
  const isShowingPhoneCodeStep = isPhoneLinkCodeStep || phoneLinkingPending;
  const phoneActionTitle = linkedAuthPhone
    ? t('settings.linkPhone.changePhone')
    : hasSavedPhoneToVerify
      ? t('settings.linkPhone.verifyTitle')
      : t('settings.linkPhone.title');
  const phoneActionValue = linkedAuthPhone;
  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return COUNTRIES;
    const query = countrySearch.toLowerCase();
    return COUNTRIES.filter(
      (country) =>
        country.name.toLowerCase().includes(query) ||
        country.code.toLowerCase().includes(query) ||
        country.dialCode.includes(query),
    );
  }, [countrySearch]);

  const sanitizeLocalPhoneInput = useCallback((value: string) => sanitizePhoneDigits(value), []);

  const setPhoneFormFromValue = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) {
        setSelectedCountry(DEFAULT_COUNTRY);
        setLinkPhoneInput('');
        return;
      }

      if (trimmed.startsWith('+')) {
        const matched = [...COUNTRIES]
          .sort((a, b) => b.dialCode.length - a.dialCode.length)
          .find((country) => trimmed.startsWith(country.dialCode));

        if (matched) {
          setSelectedCountry(matched);
          setLinkPhoneInput(sanitizeLocalPhoneInput(trimmed.slice(matched.dialCode.length)));
          return;
        }

        const sanitizedDigits = sanitizeLocalPhoneInput(trimmed);
        setLinkPhoneInput(sanitizedDigits ? `+${sanitizedDigits}` : '');
        return;
      }

      setLinkPhoneInput(sanitizeLocalPhoneInput(trimmed));
    },
    [sanitizeLocalPhoneInput],
  );

  const normalizedE164PhoneNumber = useMemo(() => {
    const raw = linkPhoneInput.trim();
    if (raw.startsWith('+')) {
      return isValidE164PhoneNumber(raw) ? raw : '';
    }
    return buildNormalizedE164PhoneNumber(selectedCountry.dialCode, linkPhoneInput);
  }, [linkPhoneInput, selectedCountry.dialCode]);
  const linkPhoneDisplayNumber =
    (phoneLinkingNumber ?? normalizedE164PhoneNumber) || linkPhoneInput;
  const isLocalPhoneValid = Boolean(linkPhoneInput) && Boolean(normalizedE164PhoneNumber);

  useEffect(() => {
    if (!linkPhoneLocalError) return;
    setLinkPhoneLocalError(null);
  }, [linkPhoneInput, linkPhoneLocalError]);

  useEffect(() => {
    if (linkPhoneValue !== '1') return;

    clearError();
    setLinkPhoneLocalError(null);
    setLinkPhoneCode('');
    setIsPhoneLinkCodeStep(false);
    setPhoneNumberEditCount(0);
    const trimmedValue = (linkedAuthPhone ?? '').trim();
    setPhoneFormFromValue(trimmedValue);
    setShowLinkPhoneModal(true);
  }, [linkPhoneValue, clearError, linkedAuthPhone, setPhoneFormFromValue]);

  useEffect(() => {
    if (!phoneLinkingPending) return;
    setIsPhoneLinkCodeStep(true);
    setShowLinkPhoneModal(true);
  }, [phoneLinkingPending]);

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
      // Always reset local state first — this is the critical step
      resetGuidedTour();

      // Fire-and-forget server sync — don't block the user on network failures.
      // The controller's debounced effect will re-sync state on the next render anyway.
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
        tour_version: 1,
        clear_nullable_fields: true,
      }).catch((error) => {
        if (__DEV__) {
          console.warn('[guided-tour] server reset sync failed (will retry automatically):', error);
        }
      });

      telemetry.capture('tour_restarted');
      // Navigate to dashboard where the welcome card will appear
      router.push('/(tabs)');
    } catch (error) {
      if (__DEV__) {
        console.warn('Failed to reset guided tour:', error);
      }
      Alert.alert(t('common.error'), t('common.tryAgain'));
    } finally {
      setIsResettingGuidedTour(false);
    }
  }, [isResettingGuidedTour, language, resetGuidedTour, router, t]);

  const handleToggleDailyWaterReminder = async (enabled: boolean) => {
    if (enabled) {
      const granted = await ensureNotificationPermissions();
      if (!granted) {
        Alert.alert(t('common.error'), t('settings.errors.notificationsPermissionDenied'));
        return;
      }
      const id = await scheduleDailyWaterReminder();
      if (!id) {
        Alert.alert(t('common.error'), t('settings.errors.notificationsUnavailable'));
        return;
      }
      setDailyWaterNotificationId(id);
      setDailyWaterReminderEnabled(true);
      return;
    }

    if (dailyWaterNotificationId) {
      await cancelNotification(dailyWaterNotificationId);
    }
    setDailyWaterNotificationId(null);
    setDailyWaterReminderEnabled(false);
  };

  const handleToggleTaskReminders = async (enabled: boolean) => {
    if (enabled) {
      const granted = await ensureNotificationPermissions();
      if (!granted) {
        Alert.alert(t('common.error'), t('settings.errors.notificationsPermissionDenied'));
        return;
      }
      setTaskRemindersEnabled(true);
      return;
    }

    // Disable: cancel any scheduled task notifications we know about
    const ids = Object.values(taskSchedules).flatMap((s) => s.notificationIds ?? []);
    await Promise.allSettled(ids.map((id) => cancelNotification(id)));
    clearAllTaskSchedules();
    setTaskRemindersEnabled(false);
  };

  const handleToggleLowWaterAlerts = async (enabled: boolean) => {
    if (enabled) {
      const granted = await ensureNotificationPermissions();
      if (!granted) {
        Alert.alert(t('common.error'), t('settings.errors.notificationsPermissionDenied'));
        return;
      }
      setLowWaterAlertsEnabled(true);
      return;
    }

    setLowWaterAlertsEnabled(false);
  };

  const handleToggleWarehouseReorderAlerts = async (enabled: boolean) => {
    if (enabled) {
      const granted = await ensureNotificationPermissions();
      if (!granted) {
        Alert.alert(t('common.error'), t('settings.errors.notificationsPermissionDenied'));
        return;
      }
      setWarehouseReorderAlertsEnabled(true);
      return;
    }
    setWarehouseReorderAlertsEnabled(false);
    clearNotifiedWarehouseItemIds();
  };

  const handleTogglePetioleTestReminders = async (enabled: boolean) => {
    if (enabled) {
      const granted = await ensureNotificationPermissions();
      if (!granted) {
        Alert.alert(t('common.error'), t('settings.errors.notificationsPermissionDenied'));
        return;
      }
      setPetioleTestRemindersEnabled(true);
      return;
    }

    // Disable: cancel any scheduled petiole test notifications
    const ids = Object.values(petioleTestSchedules).flatMap((s) => s.notificationIds ?? []);
    await Promise.allSettled(ids.map((id) => cancelNotification(id)));
    clearAllPetioleTestSchedules();
    setPetioleTestRemindersEnabled(false);
  };

  const handleDeleteAccount = () => {
    setDeleteReason('');
    setDeleteConfirmed(false);
    setDeletePhoneOtp('');
    setDeleteEmailOtp('');
    setDeletePhoneOtpSent(false);
    setDeleteEmailOtpSent(false);
    setDeletePhoneVerified(false);
    setDeleteEmailVerified(false);
    setIsSendingDeleteOtp(false);
    setIsVerifyingDeleteOtp(false);
    setShowDeleteAccount(true);
  };

  const handleSendDeletePhoneOtp = async () => {
    if (!canAttemptDeleteWithPhone) {
      Alert.alert(
        t('common.error'),
        t('settings.deleteAccountModal.errors.phoneNotLinked', {
          defaultValue:
            'A verified phone number is required. Link your phone in Settings before deleting your account.',
        }),
      );
      return;
    }

    setIsSendingDeleteOtp(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: deleteVerificationPhone,
        options: { shouldCreateUser: false },
      });

      if (error) {
        Alert.alert(
          t('common.error'),
          t('settings.deleteAccountModal.errors.otpSendFailed', {
            defaultValue: 'Failed to send OTP. Please try again.',
          }),
        );
        return;
      }

      setDeletePhoneOtpSent(true);
      setDeletePhoneVerified(false);
      Alert.alert(
        t('settings.deleteAccountModal.phoneOtpSentTitle', { defaultValue: 'OTP sent' }),
        t('settings.deleteAccountModal.phoneOtpSentBody', {
          defaultValue: 'We sent an OTP to your mobile number.',
        }),
      );
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to send phone OTP:', error);
      }
      Alert.alert(
        t('common.error'),
        t('settings.deleteAccountModal.errors.otpSendFailed', {
          defaultValue: 'Failed to send OTP. Please try again.',
        }),
      );
    } finally {
      setIsSendingDeleteOtp(false);
    }
  };

  const handleVerifyDeletePhoneOtp = async () => {
    if (!canAttemptDeleteWithPhone || deletePhoneOtp.trim().length < 4) {
      Alert.alert(
        t('common.error'),
        t('settings.deleteAccountModal.errors.invalidOtp', {
          defaultValue: 'Enter a valid OTP.',
        }),
      );
      return;
    }

    setIsVerifyingDeleteOtp(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: deleteVerificationPhone,
        token: deletePhoneOtp.trim(),
        type: 'sms',
      });

      if (error) {
        Alert.alert(
          t('common.error'),
          t('settings.deleteAccountModal.errors.otpVerifyFailed', {
            defaultValue: 'OTP verification failed. Please try again.',
          }),
        );
        return;
      }

      setDeletePhoneVerified(true);
      Alert.alert(
        t('settings.deleteAccountModal.phoneVerifiedTitle', { defaultValue: 'Phone verified' }),
        t('settings.deleteAccountModal.phoneVerifiedBody', {
          defaultValue: 'Mobile verification completed.',
        }),
      );
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to verify phone OTP:', error);
      }
      Alert.alert(
        t('common.error'),
        t('settings.deleteAccountModal.errors.otpVerifyFailed', {
          defaultValue: 'OTP verification failed. Please try again.',
        }),
      );
    } finally {
      setIsVerifyingDeleteOtp(false);
    }
  };

  const handleSendDeleteEmailOtp = async () => {
    if (!requireEmailOtpForDelete) {
      return;
    }

    setIsSendingDeleteOtp(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: userEmail.trim().toLowerCase(),
        options: { shouldCreateUser: false },
      });

      if (error) {
        Alert.alert(
          t('common.error'),
          t('settings.deleteAccountModal.errors.emailOtpSendFailed', {
            defaultValue: 'Failed to send OTP to email. Please try again.',
          }),
        );
        return;
      }

      setDeleteEmailOtpSent(true);
      setDeleteEmailVerified(false);
      Alert.alert(
        t('settings.deleteAccountModal.emailOtpSentTitle', { defaultValue: 'Email OTP sent' }),
        t('settings.deleteAccountModal.emailOtpSentBody', {
          defaultValue: 'We sent an OTP to your email.',
        }),
      );
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to send email OTP:', error);
      }
      Alert.alert(
        t('common.error'),
        t('settings.deleteAccountModal.errors.emailOtpSendFailed', {
          defaultValue: 'Failed to send OTP to email. Please try again.',
        }),
      );
    } finally {
      setIsSendingDeleteOtp(false);
    }
  };

  const handleVerifyDeleteEmailOtp = async () => {
    if (!requireEmailOtpForDelete || deleteEmailOtp.trim().length < 4) {
      Alert.alert(
        t('common.error'),
        t('settings.deleteAccountModal.errors.invalidOtp', {
          defaultValue: 'Enter a valid OTP.',
        }),
      );
      return;
    }

    setIsVerifyingDeleteOtp(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: userEmail.trim().toLowerCase(),
        token: deleteEmailOtp.trim(),
        type: 'email',
      });

      if (error) {
        Alert.alert(
          t('common.error'),
          t('settings.deleteAccountModal.errors.otpVerifyFailed', {
            defaultValue: 'OTP verification failed. Please try again.',
          }),
        );
        return;
      }

      setDeleteEmailVerified(true);
      Alert.alert(
        t('settings.deleteAccountModal.emailVerifiedTitle', { defaultValue: 'Email verified' }),
        t('settings.deleteAccountModal.emailVerifiedBody', {
          defaultValue: 'Email verification completed.',
        }),
      );
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to verify email OTP:', error);
      }
      Alert.alert(
        t('common.error'),
        t('settings.deleteAccountModal.errors.otpVerifyFailed', {
          defaultValue: 'OTP verification failed. Please try again.',
        }),
      );
    } finally {
      setIsVerifyingDeleteOtp(false);
    }
  };

  const handleExportAssistantMemory = async () => {
    if (isExportingAssistantData || isDeletingAssistantData) return;
    setIsExportingAssistantData(true);

    let fileUri: string | null = null;
    let shouldDelayCleanup = false;

    try {
      const exportData = await assistantMemoryService.exportUserData();
      if (!exportData) {
        Alert.alert(t('common.error'), t('settings.errors.assistantMemoryExportFailed'));
        return;
      }

      const payload = {
        exported_at: new Date().toISOString(),
        retention_days: ASSISTANT_MEMORY_RETENTION_DAYS,
        ...exportData,
      };

      const fileName = `vinesight-assistant-memory-${Date.now()}.json`;
      const directory = FileSystem.cacheDirectory;
      fileUri = directory ? `${directory}${fileName}` : null;

      if (!fileUri) {
        Alert.alert(t('common.error'), t('settings.errors.assistantMemoryExportFailed'));
        return;
      }

      await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(payload, null, 2));

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert(t('common.error'), t('settings.errors.assistantMemoryExportFailed'));
        return;
      }

      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/json',
        dialogTitle: t('settings.assistantMemory.exportShareTitle'),
      });
      shouldDelayCleanup = true;

      telemetry.capture('assistant_memory_exported', {
        conversations_count: exportData.conversations.length,
        turns_count: exportData.turns.length,
        memories_count: exportData.memories.length,
      });

      Alert.alert(
        t('settings.assistantMemory.exportedTitle'),
        t('settings.assistantMemory.exportedBody', {
          conversations: exportData.conversations.length,
          turns: exportData.turns.length,
          memories: exportData.memories.length,
        }),
      );
    } catch (error) {
      if (__DEV__) {
        console.error('Assistant memory export failed:', error);
      }
      Alert.alert(t('common.error'), t('settings.errors.assistantMemoryExportFailed'));
    } finally {
      if (fileUri) {
        if (shouldDelayCleanup) {
          setTimeout(() => {
            FileSystem.deleteAsync(fileUri!).catch((deleteError) => {
              if (__DEV__) {
                console.warn('Failed to delete temp file:', deleteError);
              }
            });
          }, 2000);
        } else {
          try {
            await FileSystem.deleteAsync(fileUri);
          } catch (deleteError) {
            if (__DEV__) {
              console.warn('Failed to delete temp file:', deleteError);
            }
          }
        }
      }
      setIsExportingAssistantData(false);
    }
  };

  const handleDeleteAssistantMemory = () => {
    if (isDeletingAssistantData || isExportingAssistantData) return;

    Alert.alert(
      t('settings.assistantMemory.deleteConfirmTitle'),
      t('settings.assistantMemory.deleteConfirmBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.assistantMemory.deleteAction'),
          style: 'destructive',
          onPress: async () => {
            setIsDeletingAssistantData(true);
            try {
              const success = await assistantMemoryService.deleteUserData();
              if (!success) {
                Alert.alert(t('common.error'), t('settings.errors.assistantMemoryDeleteFailed'));
                return;
              }
              telemetry.capture('assistant_memory_deleted');
              Alert.alert(
                t('settings.assistantMemory.deletedTitle'),
                t('settings.assistantMemory.deletedBody'),
              );
            } catch (error) {
              if (__DEV__) {
                console.error('Assistant memory delete failed:', error);
              }
              Alert.alert(t('common.error'), t('settings.errors.assistantMemoryDeleteFailed'));
            } finally {
              setIsDeletingAssistantData(false);
            }
          },
        },
      ],
    );
  };

  const handleOpenLinkPhone = () => {
    router.setParams({ linkPhone: '1' });
    clearError();
    setLinkPhoneLocalError(null);
    setLinkPhoneCode('');
    setIsPhoneLinkCodeStep(false);
    setPhoneNumberEditCount(0);
    setCountrySearch('');
    setPhoneFormFromValue(linkedAuthPhone ?? '');
    setShowLinkPhoneModal(true);
  };

  const handleCloseLinkPhone = () => {
    clearError();
    setLinkPhoneLocalError(null);
    cancelPhoneLinking();
    setShowCountryPicker(false);
    setCountrySearch('');
    setLinkPhoneCode('');
    setIsPhoneLinkCodeStep(false);
    setPhoneNumberEditCount(0);
    setShowLinkPhoneModal(false);
    router.setParams({ linkPhone: undefined });
  };

  const handleLinkPhoneSuccessClose = () => {
    clearError();
    setLinkPhoneLocalError(null);
    setShowCountryPicker(false);
    setCountrySearch('');
    setLinkPhoneCode('');
    setIsPhoneLinkCodeStep(false);
    setPhoneNumberEditCount(0);
    setShowLinkPhoneModal(false);
    router.setParams({ linkPhone: undefined });
  };

  const handleSendPhoneLinkCode = async () => {
    const phone = normalizedE164PhoneNumber;
    if (!phone) {
      setLinkPhoneLocalError(
        t('authPhone.invalidPhone', { defaultValue: 'Please enter a valid phone number' }),
      );
      return;
    }
    clearError();
    setLinkPhoneLocalError(null);
    setIsPhoneLinkCodeStep(true);
    try {
      await linkPhoneNumber(phone);
      const { errorMessage, phoneLinkingPending: stillPending } = useAuthStore.getState();
      if (errorMessage || !stillPending) {
        setIsPhoneLinkCodeStep(false);
      }
    } catch {
      setIsPhoneLinkCodeStep(false);
    }
  };

  const handleVerifyPhoneLinkCode = async () => {
    const code = linkPhoneCode.trim();
    const formattedPhone = normalizedE164PhoneNumber;
    const pendingPhone = phoneLinkingNumber ?? formattedPhone;
    if (!pendingPhone || code.length !== 6) return;

    clearError();
    await verifyPhoneLinking(pendingPhone, code);

    const { errorMessage, phoneLinkingPending: stillPending } = useAuthStore.getState();
    if (!errorMessage && !stillPending) {
      handleLinkPhoneSuccessClose();
      setLinkPhoneCode('');
      setLinkPhoneInput('');
      refetchProfile();
      Alert.alert(t('settings.linkPhone.success'));
    }
  };

  const handleResendPhoneLinkCode = async () => {
    const pendingPhone = phoneLinkingNumber ?? normalizedE164PhoneNumber;
    if (!pendingPhone) return;
    clearError();
    setLinkPhoneLocalError(null);
    await linkPhoneNumber(pendingPhone);
  };

  const handleEditPhoneNumber = () => {
    if (phoneNumberEditCount >= MAX_PHONE_NUMBER_EDITS_PER_FLOW) {
      setLinkPhoneLocalError(
        t('settings.linkPhone.editLimitReached', {
          count: MAX_PHONE_NUMBER_EDITS_PER_FLOW,
        }),
      );
      return;
    }

    clearError();
    setLinkPhoneLocalError(null);
    setPhoneNumberEditCount((prev) => prev + 1);
    setLinkPhoneCode('');
    setIsPhoneLinkCodeStep(false);
    cancelPhoneLinking();
  };

  const handleSelectCountry = (country: Country) => {
    setSelectedCountry(country);
    setShowCountryPicker(false);
    setCountrySearch('');
  };

  const handleConfirmDeleteAccount = async () => {
    if (canAttemptDeleteWithPhone && !deletePhoneVerified) {
      Alert.alert(
        t('common.error'),
        t('settings.deleteAccountModal.errors.phoneOtpRequired', {
          defaultValue: 'Verify OTP on your mobile number before deleting your account.',
        }),
      );
      return;
    }

    if (requireEmailOtpForDelete && !deleteEmailVerified) {
      Alert.alert(
        t('common.error'),
        t('settings.deleteAccountModal.errors.emailOtpRequired', {
          defaultValue: 'Verify OTP on your email before deleting your account.',
        }),
      );
      return;
    }

    if (!deleteConfirmed) {
      Alert.alert(t('common.error'), t('settings.deleteAccountModal.errors.missingConfirmation'));
      return;
    }

    setIsDeleting(true);

    try {
      await deleteAccount(deleteReason);
      setIsDeleting(false);
      setShowDeleteAccount(false);
      Alert.alert(
        t('settings.deleteAccountModal.submittedTitle'),
        t('settings.deleteAccountModal.submittedBody'),
      );
    } catch (error) {
      if (__DEV__) {
        console.error('Delete account error:', error);
      }
      setIsDeleting(false);
      Alert.alert(t('common.error'), t('settings.deleteAccountModal.errors.submitFailed'));
    }
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      await updateProfile.mutateAsync({
        full_name: editName.trim() || undefined,
        currency_preference: selectedCurrency,
      });
      setShowEditProfile(false);
      refetchProfile();
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to update profile:', error);
      }
      Alert.alert(t('common.error'), t('settings.errors.updateProfileFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCurrencySelect = async (code: string) => {
    setSelectedCurrency(code);
    setShowCurrencyPicker(false);
    try {
      await updateProfile.mutateAsync({ currency_preference: code });
      refetchProfile();
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to update currency:', error);
      }
    }
  };

  const getCurrencyLabel = (code: string) => {
    const currency = CURRENCIES.find((c) => c.code === code);
    return currency?.label || code;
  };

  const getAreaUnitLabel = (id: string) => {
    const unit = AREA_UNITS.find((u) => u.id === id);
    return unit?.label || id;
  };

  const getLanguageLabel = (code: SupportedLanguageCode | null) => {
    if (code === 'mr') return t('settings.languageMarathi');
    if (code === 'hi') return t('settings.languageHindi');
    return t('settings.languageEnglish');
  };

  const getThemeLabel = (mode: ThemeMode) => {
    if (mode === 'light') return t('settings.themeLight');
    if (mode === 'dark') return t('settings.themeDark');
    return t('settings.themeSystem');
  };

  const canSubmitDeleteAccount =
    deleteConfirmed &&
    (canAttemptDeleteWithPhone ? deletePhoneVerified : true) &&
    (!requireEmailOtpForDelete || deleteEmailVerified) &&
    !isDeleting &&
    !isSendingDeleteOtp &&
    !isVerifyingDeleteOtp;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 32 }}
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets={isIOS}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      {/* Profile Section */}
      <View style={styles.profileCard}>
        <View style={styles.rowCenter}>
          <View style={styles.profileAvatar}>
            {userName ? (
              <Text
                style={styles.profileInitial}
                textBreakStrategy="highQuality"
                lineBreakStrategyIOS="standard"
              >
                {userName.charAt(0).toUpperCase()}
              </Text>
            ) : (
              <UISymbol name="person.fill" size={32} color={m3.colorScheme.primary} />
            )}
          </View>
          <View style={styles.profileInfo}>
            <Text
              style={styles.profileName}
              textBreakStrategy="highQuality"
              lineBreakStrategyIOS="standard"
            >
              {userName}
            </Text>
            <Text
              style={styles.profileEmail}
              textBreakStrategy="highQuality"
              lineBreakStrategyIOS="standard"
            >
              {userEmail}
            </Text>
          </View>
          <Pressable onPress={() => setShowEditProfile(true)}>
            <UISymbol name="pencil" size={24} color={m3.colorScheme.primary} />
          </Pressable>
        </View>
      </View>

      {/* General Section */}
      <View style={styles.section}>
        <Text
          style={styles.sectionHeader}
          textBreakStrategy="highQuality"
          lineBreakStrategyIOS="standard"
        >
          {t('settings.sectionGeneral')}
        </Text>
        <View style={styles.sectionContent}>
          <Pressable onPress={() => setShowLanguagePicker(true)}>
            <SettingsItem
              icon="globe"
              title={t('settings.language')}
              value={getLanguageLabel(language)}
              isLast={false}
              styles={styles}
              colors={colors}
            />
          </Pressable>
          <Pressable onPress={() => setShowThemePicker(true)}>
            <SettingsItem
              icon="sun.max.fill"
              title={t('settings.theme')}
              value={getThemeLabel(themeMode)}
              isLast={false}
              styles={styles}
              colors={colors}
            />
          </Pressable>
          <Pressable onPress={() => setShowAreaPicker(true)}>
            <SettingsItem
              icon="arrow.up.left.and.arrow.down.right"
              title={t('settings.areaUnit')}
              value={getAreaUnitLabel(selectedAreaUnit)}
              isLast={false}
              styles={styles}
              colors={colors}
            />
          </Pressable>
          <Pressable onPress={() => setShowCurrencyPicker(true)}>
            <SettingsItem
              icon="dollarsign.circle"
              title={t('settings.currency')}
              value={getCurrencyLabel(selectedCurrency)}
              isLast={false}
              styles={styles}
              colors={colors}
            />
          </Pressable>
          <Pressable onPress={handleReplayGuidedTour} disabled={isResettingGuidedTour}>
            <SettingsItem
              icon="sparkles"
              title={t('guidedTour.settings.replay')}
              value={isResettingGuidedTour ? t('common.loading') : undefined}
              isLast
              styles={styles}
              colors={colors}
            />
          </Pressable>
        </View>
      </View>

      {/* Notifications Section */}
      <View style={styles.section}>
        <Text
          style={styles.sectionHeader}
          textBreakStrategy="highQuality"
          lineBreakStrategyIOS="standard"
        >
          {t('settings.sectionNotifications')}
        </Text>
        <View style={styles.sectionContent}>
          <NotificationToggle
            title={t('settings.dailyWaterReminder')}
            subtitle={t('settings.dailyWaterReminderSubtitle')}
            enabled={dailyWaterReminderEnabled}
            onToggle={handleToggleDailyWaterReminder}
            styles={styles}
            colors={colors}
            m3={m3}
          />
          <NotificationToggle
            title={t('settings.lowWaterAlerts')}
            subtitle={t('settings.lowWaterAlertsSubtitle')}
            enabled={lowWaterAlertsEnabled}
            onToggle={handleToggleLowWaterAlerts}
            styles={styles}
            colors={colors}
            m3={m3}
          />
          <NotificationToggle
            title={t('settings.taskReminders')}
            subtitle={t('settings.taskRemindersSubtitle')}
            enabled={taskRemindersEnabled}
            onToggle={handleToggleTaskReminders}
            styles={styles}
            colors={colors}
            m3={m3}
          />
          <NotificationToggle
            title={t('settings.warehouseReorderAlerts')}
            subtitle={t('settings.warehouseReorderAlertsSubtitle')}
            enabled={warehouseReorderAlertsEnabled}
            onToggle={handleToggleWarehouseReorderAlerts}
            styles={styles}
            colors={colors}
            m3={m3}
          />
          <NotificationToggle
            title={t('settings.petioleTestReminders')}
            subtitle={t('settings.petioleTestRemindersSubtitle')}
            enabled={petioleTestRemindersEnabled}
            onToggle={handleTogglePetioleTestReminders}
            isLast
            styles={styles}
            colors={colors}
            m3={m3}
          />
        </View>
        <Text
          style={styles.notificationNote}
          textBreakStrategy="highQuality"
          lineBreakStrategyIOS="standard"
        >
          {t('settings.notificationNote')}
        </Text>
      </View>

      {/* Assistant Section */}
      {assistantFeatureFlags.memoryEnabled && (
        <View style={styles.section}>
          <Text
            style={styles.sectionHeader}
            textBreakStrategy="highQuality"
            lineBreakStrategyIOS="standard"
          >
            {t('settings.sectionAssistant')}
          </Text>
          <View style={styles.sectionContent}>
            <Pressable
              onPress={handleExportAssistantMemory}
              disabled={isExportingAssistantData || isDeletingAssistantData}
              style={[
                styles.settingsItem,
                styles.borderBottom,
                (isExportingAssistantData || isDeletingAssistantData) && styles.disabledItem,
              ]}
            >
              <View style={styles.settingsIcon}>
                <UISymbol name="doc.text" size={20} color={m3.colorScheme.primary} />
              </View>
              <Text
                style={styles.settingsTitle}
                textBreakStrategy="highQuality"
                lineBreakStrategyIOS="standard"
              >
                {t('settings.assistantMemory.exportAction')}
              </Text>
              {isExportingAssistantData ? (
                <ActivityIndicator size="small" color={m3.colorScheme.primary} />
              ) : (
                <UISymbol name="chevron.right" size={16} color={colors.surface[400]} />
              )}
            </Pressable>
            <Pressable
              onPress={handleDeleteAssistantMemory}
              disabled={isDeletingAssistantData || isExportingAssistantData}
              style={[
                styles.settingsItem,
                (isDeletingAssistantData || isExportingAssistantData) && styles.disabledItem,
              ]}
            >
              <View style={styles.deleteIcon}>
                <UISymbol name="trash" size={20} color={colors.error} />
              </View>
              <Text
                style={styles.deleteText}
                textBreakStrategy="highQuality"
                lineBreakStrategyIOS="standard"
              >
                {t('settings.assistantMemory.deleteAction')}
              </Text>
              {isDeletingAssistantData ? (
                <ActivityIndicator size="small" color={colors.error} />
              ) : (
                <UISymbol name="chevron.right" size={16} color={colors.surface[400]} />
              )}
            </Pressable>
          </View>
          <Text
            style={styles.notificationNote}
            textBreakStrategy="highQuality"
            lineBreakStrategyIOS="standard"
          >
            {t('settings.assistantMemory.retentionNote', {
              days: ASSISTANT_MEMORY_RETENTION_DAYS,
            })}
          </Text>
        </View>
      )}
      {/* Account Section */}
      <View style={styles.section}>
        <Text
          style={styles.sectionHeader}
          textBreakStrategy="highQuality"
          lineBreakStrategyIOS="standard"
        >
          {t('settings.sectionAccount')}
        </Text>
        <View style={styles.sectionContent}>
          <Pressable
            onPress={handleOpenLinkPhone}
            style={[styles.settingsItem, styles.borderBottom]}
          >
            <View style={styles.settingsIcon}>
              <UISymbol name="phone.fill" size={20} color={m3.colorScheme.primary} />
            </View>
            <Text
              style={styles.settingsTitle}
              textBreakStrategy="highQuality"
              lineBreakStrategyIOS="standard"
            >
              {phoneActionTitle}
            </Text>
            <Text
              style={styles.settingsValue}
              textBreakStrategy="highQuality"
              lineBreakStrategyIOS="standard"
            >
              {phoneActionValue ?? t('settings.linkPhone.sendCode')}
            </Text>
            <UISymbol name="chevron.right" size={16} color={colors.surface[400]} />
          </Pressable>
          <Pressable
            onPress={handleSignOut}
            disabled={authLoading}
            style={[styles.settingsItem, styles.borderBottom]}
          >
            <View style={styles.signOutIcon}>
              <UISymbol name="rectangle.portrait.and.arrow.right" size={20} color={colors.error} />
            </View>
            <Text
              style={styles.signOutText}
              textBreakStrategy="highQuality"
              lineBreakStrategyIOS="standard"
            >
              {t('settings.signOut')}
            </Text>
          </Pressable>
          <Pressable onPress={handleDeleteAccount} style={styles.settingsItem}>
            <View style={styles.deleteIcon}>
              <UISymbol name="trash" size={20} color={colors.error} />
            </View>
            <Text
              style={styles.deleteText}
              textBreakStrategy="highQuality"
              lineBreakStrategyIOS="standard"
            >
              {t('settings.deleteAccount')}
            </Text>
          </Pressable>
        </View>
      </View>

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
        {canSendSentryEvent ? (
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

      {/* Edit Profile Modal */}
      <Modal
        visible={showEditProfile}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowEditProfile(false)}
      >
        <KeyboardAvoidingView behavior={isIOS ? 'padding' : 'height'} style={styles.container}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderInner}>
              <Text
                style={styles.modalTitle}
                textBreakStrategy="highQuality"
                lineBreakStrategyIOS="standard"
              >
                {t('settings.editProfile')}
              </Text>
              <Pressable onPress={() => setShowEditProfile(false)}>
                <UISymbol name="xmark.circle.fill" size={28} color={colors.gray[400]} />
              </Pressable>
            </View>
          </View>

          <ScrollView
            style={styles.flex1}
            contentContainerStyle={{ padding: spacing[4] }}
            contentInsetAdjustmentBehavior="automatic"
            automaticallyAdjustKeyboardInsets={isIOS}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <View style={styles.formCard}>
              <View style={styles.mb4}>
                <Text
                  style={styles.inputLabel}
                  textBreakStrategy="highQuality"
                  lineBreakStrategyIOS="standard"
                >
                  {t('settings.email')}
                </Text>
                <View style={styles.inputDisabled}>
                  <Text
                    style={styles.inputDisabledText}
                    textBreakStrategy="highQuality"
                    lineBreakStrategyIOS="standard"
                  >
                    {userEmail}
                  </Text>
                </View>
                <Text
                  style={styles.inputHint}
                  textBreakStrategy="highQuality"
                  lineBreakStrategyIOS="standard"
                >
                  {t('settings.emailCannotBeChanged')}
                </Text>
              </View>

              <View style={styles.mb4}>
                <Text
                  style={styles.inputLabel}
                  textBreakStrategy="highQuality"
                  lineBreakStrategyIOS="standard"
                >
                  {t('settings.fullName')}
                </Text>
                <TextInput
                  value={editName}
                  onChangeText={setEditName}
                  placeholder={t('settings.enterName')}
                  placeholderTextColor={colors.gray[400]}
                  style={styles.input}
                />
              </View>

              <View style={styles.mb4}>
                <Text
                  style={styles.inputLabel}
                  textBreakStrategy="highQuality"
                  lineBreakStrategyIOS="standard"
                >
                  {t('settings.phone')}
                </Text>
                <View style={styles.inputDisabled}>
                  <Text
                    style={styles.inputDisabledText}
                    textBreakStrategy="highQuality"
                    lineBreakStrategyIOS="standard"
                  >
                    {linkedAuthPhone ?? t('settings.linkPhone.notLinked')}
                  </Text>
                </View>
                <Text
                  style={styles.inputHint}
                  textBreakStrategy="highQuality"
                  lineBreakStrategyIOS="standard"
                >
                  {linkedAuthPhone
                    ? t('settings.linkPhone.verified')
                    : t('settings.linkPhone.verificationRequired')}
                </Text>
                <Pressable
                  onPress={() => {
                    setShowEditProfile(false);
                    handleOpenLinkPhone();
                  }}
                  style={styles.verifyPhoneCta}
                >
                  <Text
                    style={styles.verifyPhoneCtaText}
                    textBreakStrategy="highQuality"
                    lineBreakStrategyIOS="standard"
                  >
                    {linkedAuthPhone
                      ? t('settings.linkPhone.changePhone')
                      : hasSavedPhoneToVerify
                        ? t('settings.linkPhone.verifyTitle')
                        : t('settings.linkPhone.title')}
                  </Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <Pressable
              onPress={handleSaveProfile}
              disabled={isSaving}
              style={[styles.saveButton, { backgroundColor: colors.primary[600] }]}
            >
              {isSaving ? (
                <ActivityIndicator color={m3.colorScheme.onPrimary} />
              ) : (
                <Text
                  style={styles.saveButtonText}
                  textBreakStrategy="highQuality"
                  lineBreakStrategyIOS="standard"
                >
                  {t('common.saveChanges')}
                </Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Link Phone Modal */}
      <Modal
        visible={isLinkPhoneModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCloseLinkPhone}
      >
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          <KeyboardAvoidingView behavior={isIOS ? 'padding' : 'height'} style={styles.container}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderInner}>
                <Text
                  style={styles.modalTitle}
                  textBreakStrategy="highQuality"
                  lineBreakStrategyIOS="standard"
                >
                  {isShowingPhoneCodeStep
                    ? t('settings.linkPhone.verifyTitle')
                    : hasSavedPhoneToVerify
                      ? t('settings.linkPhone.verifyTitle')
                      : t('settings.linkPhone.title')}
                </Text>
                <Pressable onPress={handleCloseLinkPhone}>
                  <UISymbol name="xmark.circle.fill" size={28} color={colors.gray[400]} />
                </Pressable>
              </View>
            </View>

            <ScrollView
              style={styles.flex1}
              contentContainerStyle={{ padding: spacing[4] }}
              contentInsetAdjustmentBehavior="automatic"
              automaticallyAdjustKeyboardInsets={isIOS}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              <View style={styles.formCard}>
                <View style={styles.mb4}>
                  <Text
                    style={styles.inputLabel}
                    textBreakStrategy="highQuality"
                    lineBreakStrategyIOS="standard"
                  >
                    {isShowingPhoneCodeStep
                      ? t('settings.linkPhone.verifySubtitle')
                      : t('settings.linkPhone.subtitle')}
                  </Text>
                  {isShowingPhoneCodeStep ? (
                    <Text
                      style={styles.inputHint}
                      textBreakStrategy="highQuality"
                      lineBreakStrategyIOS="standard"
                    >
                      {linkPhoneDisplayNumber}
                    </Text>
                  ) : null}
                </View>

                {!isShowingPhoneCodeStep ? (
                  <View style={styles.mb4}>
                    <Text
                      style={styles.inputLabel}
                      textBreakStrategy="highQuality"
                      lineBreakStrategyIOS="standard"
                    >
                      {t('settings.linkPhone.phoneLabel')}
                    </Text>
                    <View style={styles.linkPhoneInputRow}>
                      <Pressable
                        onPress={() => setShowCountryPicker(true)}
                        style={styles.linkPhoneCountryButton}
                        accessibilityRole="button"
                        accessibilityLabel={t('authPhone.selectCountryA11y')}
                      >
                        <Text
                          style={styles.linkPhoneCountryCode}
                          textBreakStrategy="highQuality"
                          lineBreakStrategyIOS="standard"
                        >
                          {selectedCountry.dialCode}
                        </Text>
                        <UISymbol name="chevron.down" size={14} color={colors.surface[500]} />
                      </Pressable>
                      <TextInput
                        value={linkPhoneInput}
                        onChangeText={(value) => {
                          if (value.trim().startsWith('+')) {
                            setPhoneFormFromValue(value);
                            return;
                          }
                          setLinkPhoneInput(sanitizeLocalPhoneInput(value));
                        }}
                        placeholder={t('settings.linkPhone.phonePlaceholder')}
                        placeholderTextColor={colors.gray[400]}
                        keyboardType="phone-pad"
                        maxLength={15}
                        autoCapitalize="none"
                        autoCorrect={false}
                        style={styles.linkPhoneInputField}
                      />
                    </View>
                  </View>
                ) : (
                  <View style={styles.mb4}>
                    <Text
                      style={styles.inputLabel}
                      textBreakStrategy="highQuality"
                      lineBreakStrategyIOS="standard"
                    >
                      {t('settings.linkPhone.codeLabel')}
                    </Text>
                    <TextInput
                      value={linkPhoneCode}
                      onChangeText={setLinkPhoneCode}
                      placeholder={t('settings.linkPhone.codePlaceholder')}
                      placeholderTextColor={colors.gray[400]}
                      keyboardType="number-pad"
                      maxLength={6}
                      style={styles.input}
                    />
                    <Pressable onPress={handleResendPhoneLinkCode} disabled={phoneLinkingLoading}>
                      <Text
                        style={styles.inputHint}
                        textBreakStrategy="highQuality"
                        lineBreakStrategyIOS="standard"
                      >
                        {t('settings.linkPhone.resend')}
                      </Text>
                    </Pressable>
                    <Pressable onPress={handleEditPhoneNumber} disabled={phoneLinkingLoading}>
                      <Text
                        style={styles.inputHint}
                        textBreakStrategy="highQuality"
                        lineBreakStrategyIOS="standard"
                      >
                        {t('settings.linkPhone.changePhone')}
                      </Text>
                    </Pressable>
                  </View>
                )}

                {linkPhoneLocalError || authErrorMessage ? (
                  <View style={[styles.alertBox, styles.dangerAlert, { marginBottom: 0 }]}>
                    <Text
                      style={styles.alertText}
                      textBreakStrategy="highQuality"
                      lineBreakStrategyIOS="standard"
                    >
                      {linkPhoneLocalError ?? authErrorMessage}
                    </Text>
                  </View>
                ) : null}
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable
                onPress={
                  isShowingPhoneCodeStep ? handleVerifyPhoneLinkCode : handleSendPhoneLinkCode
                }
                disabled={
                  phoneLinkingLoading ||
                  (!isShowingPhoneCodeStep && !isLocalPhoneValid) ||
                  (isShowingPhoneCodeStep && linkPhoneCode.trim().length !== 6)
                }
                style={({ pressed }) => {
                  const isDisabled =
                    phoneLinkingLoading ||
                    (!isShowingPhoneCodeStep && !isLocalPhoneValid) ||
                    (isShowingPhoneCodeStep && linkPhoneCode.trim().length !== 6);
                  return [
                    styles.saveButton,
                    {
                      backgroundColor: colors.primary[600],
                      marginBottom: spacing[3],
                      opacity: isDisabled ? 0.5 : pressed ? 0.8 : 1,
                    },
                  ];
                }}
              >
                {phoneLinkingLoading ? (
                  <ActivityIndicator color={m3.colorScheme.onPrimary} />
                ) : (
                  <Text
                    style={styles.saveButtonText}
                    textBreakStrategy="highQuality"
                    lineBreakStrategyIOS="standard"
                  >
                    {isShowingPhoneCodeStep
                      ? t('settings.linkPhone.verify')
                      : t('settings.linkPhone.sendCode')}
                  </Text>
                )}
              </Pressable>

              <Pressable
                onPress={handleCloseLinkPhone}
                disabled={phoneLinkingLoading}
                style={styles.saveButton}
              >
                <Text
                  style={[
                    styles.settingsTitle,
                    { flex: 0, marginLeft: 0, color: colors.surface[700] },
                  ]}
                  textBreakStrategy="highQuality"
                  lineBreakStrategyIOS="standard"
                >
                  {t('settings.linkPhone.cancel')}
                </Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={showCountryPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCountryPicker(false)}
      >
        <View style={styles.countryPickerOverlay}>
          <Pressable
            style={styles.countryPickerBackdrop}
            onPress={() => setShowCountryPicker(false)}
          />
          <View style={styles.countryPickerSheet}>
            <View style={styles.countryPickerHeader}>
              <Text
                style={styles.modalTitle}
                textBreakStrategy="highQuality"
                lineBreakStrategyIOS="standard"
              >
                {t('authPhone.selectCountry')}
              </Text>
              <Pressable
                onPress={() => setShowCountryPicker(false)}
                accessibilityLabel={t('authPhone.closeA11y')}
              >
                <UISymbol name="xmark.circle.fill" size={24} color={colors.gray[400]} />
              </Pressable>
            </View>

            <TextInput
              value={countrySearch}
              onChangeText={setCountrySearch}
              placeholder={t('authPhone.searchCountry')}
              placeholderTextColor={colors.gray[400]}
              style={styles.countrySearchInput}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <FlatList
              data={filteredCountries}
              keyExtractor={(country) => `${country.code}-${country.dialCode}`}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable style={styles.countryRow} onPress={() => handleSelectCountry(item)}>
                  <Text
                    style={styles.countryName}
                    textBreakStrategy="highQuality"
                    lineBreakStrategyIOS="standard"
                  >
                    {item.name}
                  </Text>
                  <Text
                    style={styles.countryDialCode}
                    textBreakStrategy="highQuality"
                    lineBreakStrategyIOS="standard"
                  >
                    {item.dialCode}
                  </Text>
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Language Picker Modal */}
      <Modal
        visible={showLanguagePicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowLanguagePicker(false)}
      >
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderInner}>
              <Text
                style={styles.modalTitle}
                textBreakStrategy="highQuality"
                lineBreakStrategyIOS="standard"
              >
                {t('settings.selectLanguage')}
              </Text>
              <Pressable onPress={() => setShowLanguagePicker(false)}>
                <UISymbol name="xmark.circle.fill" size={28} color={colors.gray[400]} />
              </Pressable>
            </View>
          </View>
          <ScrollView
            style={styles.flex1}
            contentContainerStyle={{ padding: spacing[4] }}
            contentInsetAdjustmentBehavior="automatic"
            automaticallyAdjustKeyboardInsets={isIOS}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <View style={styles.sectionContent}>
              {(
                [
                  { code: 'en' as const, label: t('settings.languageEnglish') },
                  { code: 'mr' as const, label: t('settings.languageMarathi') },
                  { code: 'hi' as const, label: t('settings.languageHindi') },
                ] as const
              ).map((opt, index, arr) => (
                <Pressable
                  key={opt.code}
                  onPress={() => {
                    setLanguage(opt.code);
                    setAppLanguage(opt.code);
                    setShowLanguagePicker(false);
                  }}
                  style={[styles.settingsItem, index < arr.length - 1 && styles.borderBottom]}
                >
                  <Text
                    style={styles.pickerItemText}
                    textBreakStrategy="highQuality"
                    lineBreakStrategyIOS="standard"
                  >
                    {opt.label}
                  </Text>
                  {language === opt.code && (
                    <UISymbol
                      name="checkmark.circle.fill"
                      size={22}
                      color={m3.colorScheme.primary}
                    />
                  )}
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Theme Picker Modal */}
      <Modal
        visible={showThemePicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowThemePicker(false)}
      >
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderInner}>
              <Text
                style={styles.modalTitle}
                textBreakStrategy="highQuality"
                lineBreakStrategyIOS="standard"
              >
                {t('settings.selectTheme')}
              </Text>
              <Pressable onPress={() => setShowThemePicker(false)}>
                <UISymbol name="xmark.circle.fill" size={28} color={colors.gray[400]} />
              </Pressable>
            </View>
          </View>
          <ScrollView
            style={styles.flex1}
            contentContainerStyle={{ padding: spacing[4] }}
            contentInsetAdjustmentBehavior="automatic"
            automaticallyAdjustKeyboardInsets={isIOS}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <View style={styles.sectionContent}>
              {(
                [
                  { mode: 'system' as const, label: t('settings.themeSystem') },
                  { mode: 'light' as const, label: t('settings.themeLight') },
                  { mode: 'dark' as const, label: t('settings.themeDark') },
                ] as const
              ).map((opt, index, arr) => (
                <Pressable
                  key={opt.mode}
                  onPress={() => {
                    setThemeMode(opt.mode);
                    setShowThemePicker(false);
                  }}
                  style={[styles.settingsItem, index < arr.length - 1 && styles.borderBottom]}
                >
                  <Text
                    style={styles.pickerItemText}
                    textBreakStrategy="highQuality"
                    lineBreakStrategyIOS="standard"
                  >
                    {opt.label}
                  </Text>
                  {themeMode === opt.mode && (
                    <UISymbol
                      name="checkmark.circle.fill"
                      size={22}
                      color={m3.colorScheme.primary}
                    />
                  )}
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Currency Picker Modal */}
      <Modal
        visible={showCurrencyPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCurrencyPicker(false)}
      >
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderInner}>
              <Text
                style={styles.modalTitle}
                textBreakStrategy="highQuality"
                lineBreakStrategyIOS="standard"
              >
                {t('settings.selectCurrency')}
              </Text>
              <Pressable onPress={() => setShowCurrencyPicker(false)}>
                <UISymbol name="xmark.circle.fill" size={28} color={colors.gray[400]} />
              </Pressable>
            </View>
          </View>
          <ScrollView
            style={styles.flex1}
            contentContainerStyle={{ padding: spacing[4] }}
            contentInsetAdjustmentBehavior="automatic"
            automaticallyAdjustKeyboardInsets={isIOS}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <View style={styles.sectionContent}>
              {CURRENCIES.map((currency, index) => (
                <Pressable
                  key={currency.code}
                  onPress={() => handleCurrencySelect(currency.code)}
                  style={[
                    styles.settingsItem,
                    index < CURRENCIES.length - 1 && styles.borderBottom,
                  ]}
                >
                  <Text
                    style={styles.pickerItemText}
                    textBreakStrategy="highQuality"
                    lineBreakStrategyIOS="standard"
                  >
                    {currency.label}
                  </Text>
                  {selectedCurrency === currency.code && (
                    <UISymbol
                      name="checkmark.circle.fill"
                      size={22}
                      color={m3.colorScheme.primary}
                    />
                  )}
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Area Unit Picker Modal */}
      <Modal
        visible={showAreaPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAreaPicker(false)}
      >
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderInner}>
              <Text
                style={styles.modalTitle}
                textBreakStrategy="highQuality"
                lineBreakStrategyIOS="standard"
              >
                {t('settings.selectAreaUnit')}
              </Text>
              <Pressable onPress={() => setShowAreaPicker(false)}>
                <UISymbol name="xmark.circle.fill" size={28} color={colors.gray[400]} />
              </Pressable>
            </View>
          </View>
          <ScrollView
            style={styles.flex1}
            contentContainerStyle={{ padding: spacing[4] }}
            contentInsetAdjustmentBehavior="automatic"
            automaticallyAdjustKeyboardInsets={isIOS}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <View style={styles.sectionContent}>
              {AREA_UNITS.map((unit, index) => (
                <Pressable
                  key={unit.id}
                  onPress={async () => {
                    try {
                      await updateProfile.mutateAsync({
                        area_unit_preference: unit.id as 'hectares' | 'acres',
                      });
                      // Keep auth metadata in sync during migration period.
                      await updateUserAreaUnit(unit.id as 'hectares' | 'acres');
                      setSelectedAreaUnit(resolveAreaUnitPreference(unit.id));
                      refetchProfile();
                      setShowAreaPicker(false);
                    } catch (error) {
                      if (__DEV__) {
                        console.error('Failed to update area unit:', error);
                      }
                      Alert.alert(t('common.error'), t('settings.errors.updateAreaUnitFailed'));
                    }
                  }}
                  style={[
                    styles.settingsItem,
                    index < AREA_UNITS.length - 1 && styles.borderBottom,
                  ]}
                >
                  <Text
                    style={styles.pickerItemText}
                    textBreakStrategy="highQuality"
                    lineBreakStrategyIOS="standard"
                  >
                    {unit.label}
                  </Text>
                  {selectedAreaUnit === unit.id && (
                    <UISymbol
                      name="checkmark.circle.fill"
                      size={22}
                      color={m3.colorScheme.primary}
                    />
                  )}
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Delete Account Modal */}
      <Modal
        visible={showDeleteAccount}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDeleteAccount(false)}
      >
        <KeyboardAvoidingView behavior={isIOS ? 'padding' : 'height'} style={styles.container}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderInner}>
              <Text
                style={styles.modalTitle}
                textBreakStrategy="highQuality"
                lineBreakStrategyIOS="standard"
              >
                {t('settings.deleteAccountModal.title')}
              </Text>
              <Pressable onPress={() => setShowDeleteAccount(false)}>
                <UISymbol name="xmark.circle.fill" size={28} color={colors.gray[400]} />
              </Pressable>
            </View>
          </View>

          <ScrollView
            style={styles.flex1}
            contentContainerStyle={{ padding: spacing[4] }}
            contentInsetAdjustmentBehavior="automatic"
            automaticallyAdjustKeyboardInsets={isIOS}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <View style={[styles.alertBox, styles.dangerAlert]}>
              <UISymbol name="exclamationmark.triangle.fill" size={20} color={colors.error} />
              <Text
                style={styles.alertTitle}
                textBreakStrategy="highQuality"
                lineBreakStrategyIOS="standard"
              >
                {t('settings.deleteAccountModal.warningTitle')}
              </Text>
              <Text
                style={styles.alertText}
                textBreakStrategy="highQuality"
                lineBreakStrategyIOS="standard"
              >
                {t('settings.deleteAccountModal.warningBody')}
              </Text>
            </View>

            <View style={styles.deleteWarnings}>
              <Text
                style={styles.deleteWarningItem}
                textBreakStrategy="highQuality"
                lineBreakStrategyIOS="standard"
              >
                • {t('settings.deleteAccountModal.dataList.farms')}
              </Text>
              <Text
                style={styles.deleteWarningItem}
                textBreakStrategy="highQuality"
                lineBreakStrategyIOS="standard"
              >
                • {t('settings.deleteAccountModal.dataList.records')}
              </Text>
              <Text
                style={styles.deleteWarningItem}
                textBreakStrategy="highQuality"
                lineBreakStrategyIOS="standard"
              >
                • {t('settings.deleteAccountModal.dataList.workers')}
              </Text>
              <Text
                style={styles.deleteWarningItem}
                textBreakStrategy="highQuality"
                lineBreakStrategyIOS="standard"
              >
                • {t('settings.deleteAccountModal.dataList.org')}
              </Text>
              <Text
                style={styles.deleteWarningItem}
                textBreakStrategy="highQuality"
                lineBreakStrategyIOS="standard"
              >
                • {t('settings.deleteAccountModal.dataList.uploads')}
              </Text>
              <Text
                style={styles.deleteWarningItem}
                textBreakStrategy="highQuality"
                lineBreakStrategyIOS="standard"
              >
                • {t('settings.deleteAccountModal.dataList.profile')}
              </Text>
            </View>

            <View style={styles.formCard}>
              <View style={styles.mb4}>
                <Text
                  style={styles.inputLabel}
                  textBreakStrategy="highQuality"
                  lineBreakStrategyIOS="standard"
                >
                  {phoneVerificationLabel}
                </Text>
                <View style={styles.inputDisabled}>
                  <Text
                    style={styles.inputDisabledText}
                    textBreakStrategy="highQuality"
                    lineBreakStrategyIOS="standard"
                  >
                    {canAttemptDeleteWithPhone
                      ? deleteVerificationPhone
                      : t('settings.deleteAccountModal.phoneNotAvailable', {
                          defaultValue: 'No verified phone linked',
                        })}
                  </Text>
                </View>
                <Text
                  style={styles.inputHint}
                  textBreakStrategy="highQuality"
                  lineBreakStrategyIOS="standard"
                >
                  {t('settings.deleteAccountModal.phoneVerificationHint', {
                    defaultValue: 'Send OTP to your mobile number and verify it to continue.',
                  })}
                </Text>
                <View style={styles.linkPhoneInputRow}>
                  <Pressable
                    onPress={handleSendDeletePhoneOtp}
                    disabled={isSendingDeleteOtp || !canAttemptDeleteWithPhone}
                    style={[
                      styles.verifyPhoneCta,
                      {
                        opacity: isSendingDeleteOtp || !canAttemptDeleteWithPhone ? 0.5 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={styles.verifyPhoneCtaText}
                      textBreakStrategy="highQuality"
                      lineBreakStrategyIOS="standard"
                    >
                      {deletePhoneOtpSent
                        ? t('settings.deleteAccountModal.resendOtp', { defaultValue: 'Resend OTP' })
                        : t('settings.deleteAccountModal.sendOtp', { defaultValue: 'Send OTP' })}
                    </Text>
                  </Pressable>
                </View>
                {deletePhoneOtpSent ? (
                  <View style={{ marginTop: spacing[3] }}>
                    <TextInput
                      value={deletePhoneOtp}
                      onChangeText={(value) => {
                        setDeletePhoneOtp(value);
                        setDeletePhoneVerified(false);
                      }}
                      placeholder={t('settings.deleteAccountModal.enterOtp', {
                        defaultValue: 'Enter OTP',
                      })}
                      placeholderTextColor={colors.gray[400]}
                      keyboardType="number-pad"
                      maxLength={6}
                      style={styles.input}
                    />
                    <Pressable
                      onPress={handleVerifyDeletePhoneOtp}
                      disabled={isVerifyingDeleteOtp}
                      style={[styles.verifyPhoneCta, { marginTop: spacing[2] }]}
                    >
                      <Text
                        style={styles.verifyPhoneCtaText}
                        textBreakStrategy="highQuality"
                        lineBreakStrategyIOS="standard"
                      >
                        {deletePhoneVerified
                          ? t('settings.deleteAccountModal.verified', { defaultValue: 'Verified' })
                          : t('settings.deleteAccountModal.verifyOtp', {
                              defaultValue: 'Verify OTP',
                            })}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>

              {requireEmailOtpForDelete ? (
                <View style={styles.mb4}>
                  <Text
                    style={styles.inputLabel}
                    textBreakStrategy="highQuality"
                    lineBreakStrategyIOS="standard"
                  >
                    {t('settings.deleteAccountModal.emailVerificationLabel', {
                      defaultValue: 'Email verification (required)',
                    })}
                  </Text>
                  <View style={styles.inputDisabled}>
                    <Text
                      style={styles.inputDisabledText}
                      textBreakStrategy="highQuality"
                      lineBreakStrategyIOS="standard"
                    >
                      {userEmail}
                    </Text>
                  </View>
                  <Text
                    style={styles.inputHint}
                    textBreakStrategy="highQuality"
                    lineBreakStrategyIOS="standard"
                  >
                    {t('settings.deleteAccountModal.emailVerificationHint', {
                      defaultValue:
                        'For extra security, verify the OTP sent to your email as well.',
                    })}
                  </Text>
                  <View style={styles.linkPhoneInputRow}>
                    <Pressable
                      onPress={handleSendDeleteEmailOtp}
                      disabled={isSendingDeleteOtp}
                      style={[
                        styles.verifyPhoneCta,
                        {
                          opacity: isSendingDeleteOtp ? 0.5 : 1,
                        },
                      ]}
                    >
                      <Text
                        style={styles.verifyPhoneCtaText}
                        textBreakStrategy="highQuality"
                        lineBreakStrategyIOS="standard"
                      >
                        {deleteEmailOtpSent
                          ? t('settings.deleteAccountModal.resendOtp', {
                              defaultValue: 'Resend OTP',
                            })
                          : t('settings.deleteAccountModal.sendOtp', { defaultValue: 'Send OTP' })}
                      </Text>
                    </Pressable>
                  </View>
                  {deleteEmailOtpSent ? (
                    <View style={{ marginTop: spacing[3] }}>
                      <TextInput
                        value={deleteEmailOtp}
                        onChangeText={(value) => {
                          setDeleteEmailOtp(value);
                          setDeleteEmailVerified(false);
                        }}
                        placeholder={t('settings.deleteAccountModal.enterOtp', {
                          defaultValue: 'Enter OTP',
                        })}
                        placeholderTextColor={colors.gray[400]}
                        keyboardType="number-pad"
                        maxLength={6}
                        style={styles.input}
                      />
                      <Pressable
                        onPress={handleVerifyDeleteEmailOtp}
                        disabled={isVerifyingDeleteOtp}
                        style={[styles.verifyPhoneCta, { marginTop: spacing[2] }]}
                      >
                        <Text
                          style={styles.verifyPhoneCtaText}
                          textBreakStrategy="highQuality"
                          lineBreakStrategyIOS="standard"
                        >
                          {deleteEmailVerified
                            ? t('settings.deleteAccountModal.verified', {
                                defaultValue: 'Verified',
                              })
                            : t('settings.deleteAccountModal.verifyOtp', {
                                defaultValue: 'Verify OTP',
                              })}
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              ) : null}

              <View style={styles.mb4}>
                <Text
                  style={styles.inputLabel}
                  textBreakStrategy="highQuality"
                  lineBreakStrategyIOS="standard"
                >
                  {t('settings.deleteAccountModal.reason.label')}
                </Text>
                <TextInput
                  value={deleteReason}
                  onChangeText={setDeleteReason}
                  placeholder={t('settings.deleteAccountModal.reason.placeholder')}
                  placeholderTextColor={colors.gray[400]}
                  multiline
                  numberOfLines={3}
                  style={[styles.input, { height: 80 }]}
                />
                <Text
                  style={styles.inputHint}
                  textBreakStrategy="highQuality"
                  lineBreakStrategyIOS="standard"
                >
                  {t('settings.deleteAccountModal.reason.hint')}
                </Text>
              </View>

              <Pressable
                onPress={() => setDeleteConfirmed(!deleteConfirmed)}
                style={styles.checkboxContainer}
              >
                <View style={[styles.checkbox, deleteConfirmed && styles.checkboxChecked]}>
                  {deleteConfirmed && (
                    <UISymbol name="checkmark" size={14} color={m3.colorScheme.onError} />
                  )}
                </View>
                <Text
                  style={styles.checkboxText}
                  textBreakStrategy="highQuality"
                  lineBreakStrategyIOS="standard"
                >
                  {t('settings.deleteAccountModal.checkbox.prefix')}{' '}
                  <Text
                    style={styles.checkboxBold}
                    textBreakStrategy="highQuality"
                    lineBreakStrategyIOS="standard"
                  >
                    {t('settings.deleteAccountModal.checkbox.bold')}
                  </Text>{' '}
                  {t('settings.deleteAccountModal.checkbox.suffix')}
                </Text>
              </Pressable>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <Pressable
              onPress={handleConfirmDeleteAccount}
              disabled={!canSubmitDeleteAccount}
              style={[
                styles.deleteButton,
                { backgroundColor: colors.error, opacity: canSubmitDeleteAccount ? 1 : 0.5 },
              ]}
            >
              {isDeleting ? (
                <ActivityIndicator color={m3.colorScheme.onPrimary} />
              ) : (
                <Text
                  style={styles.deleteButtonText}
                  textBreakStrategy="highQuality"
                  lineBreakStrategyIOS="standard"
                >
                  {t('settings.deleteAccountModal.submit')}
                </Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

// Settings Item Component
function SettingsItem({
  icon,
  title,
  value,
  isLast,
  disabled,
  styles,
  colors,
}: {
  icon: string;
  title: string;
  value?: string;
  isLast?: boolean;
  disabled?: boolean;
  styles: SettingsStyles;
  colors: ThemeColors;
}) {
  return (
    <View style={[styles.settingsItem, !isLast && styles.borderBottom]}>
      <View style={styles.settingsIcon}>
        <UISymbol name={icon} size={20} color={colors.gray[500]} />
      </View>
      <Text
        style={styles.settingsTitle}
        textBreakStrategy="highQuality"
        lineBreakStrategyIOS="standard"
      >
        {title}
      </Text>
      {value && (
        <Text
          style={styles.settingsValue}
          textBreakStrategy="highQuality"
          lineBreakStrategyIOS="standard"
        >
          {value}
        </Text>
      )}
      {!disabled && <UISymbol name="chevron.right" size={18} color={colors.surface[300]} />}
    </View>
  );
}

// Notification Toggle Component
function NotificationToggle({
  title,
  subtitle,
  enabled,
  onToggle,
  isLast,
  styles,
  colors,
  m3,
}: {
  title: string;
  subtitle: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void | Promise<void>;
  isLast?: boolean;
  styles: SettingsStyles;
  colors: ThemeColors;
  m3: ReturnType<typeof getM3Theme>;
}) {
  return (
    <View style={[styles.notificationItem, !isLast && styles.borderBottom]}>
      <View style={styles.flex1}>
        <Text
          style={styles.notificationTitle}
          textBreakStrategy="highQuality"
          lineBreakStrategyIOS="standard"
        >
          {title}
        </Text>
        <Text
          style={styles.notificationSubtitle}
          textBreakStrategy="highQuality"
          lineBreakStrategyIOS="standard"
        >
          {subtitle}
        </Text>
      </View>
      <Switch
        value={enabled}
        onValueChange={(value) => {
          Promise.resolve(onToggle(value)).catch((error) => {
            if (__DEV__) {
              console.error('Toggle error:', error);
            }
          });
        }}
        trackColor={{
          false: colors.surface[300],
          true: colorWithOpacity(m3.colorScheme.primary, 0.4),
        }}
        thumbColor={enabled ? m3.colorScheme.primary : colors.surface[100]}
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors, m3: ReturnType<typeof getM3Theme>) => ({
  container: { flex: 1, backgroundColor: colors.surface[50] } as ViewStyle,
  profileCard: {
    backgroundColor: colors.surface[100],
    marginHorizontal: spacing[4],
    marginTop: spacing[4],
    borderRadius: borderRadius['2xl'],
    padding: spacing[4],
  } as ViewStyle,
  rowCenter: { flexDirection: 'row', alignItems: 'center' } as ViewStyle,
  profileAvatar: {
    width: 64,
    height: 64,
    backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  profileInitial: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.primary[600],
  } as TextStyle,
  profileInfo: { flex: 1, marginLeft: spacing[4] } as ViewStyle,
  profileName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.surface[900],
  } as TextStyle,
  profileEmail: { fontSize: fontSize.sm, color: colors.surface[500] } as TextStyle,
  profilePhone: { fontSize: fontSize.xs, color: colors.surface[400], marginTop: 2 } as TextStyle,

  section: { marginTop: spacing[6], paddingHorizontal: spacing[4] } as ViewStyle,
  sectionHeader: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.surface[500],
    letterSpacing: 0.5,
    marginBottom: spacing[2],
    paddingHorizontal: spacing[2],
  } as TextStyle,
  sectionContent: {
    backgroundColor: colors.surface[100],
    borderRadius: borderRadius['2xl'],
    overflow: 'hidden',
  } as ViewStyle,

  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: 14,
  } as ViewStyle,
  settingsIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface[50],
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  signOutIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.lg,
    backgroundColor: colorWithOpacity(colors.error, 0.12),
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  deleteIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.lg,
    backgroundColor: colorWithOpacity(colors.error, 0.2),
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  settingsTitle: {
    flex: 1,
    marginLeft: spacing[3],
    fontSize: fontSize.base,
    color: colors.surface[900],
  } as TextStyle,
  signOutText: {
    flex: 1,
    marginLeft: spacing[3],
    fontSize: fontSize.base,
    color: colors.error,
  } as TextStyle,
  deleteText: {
    flex: 1,
    marginLeft: spacing[3],
    fontSize: fontSize.base,
    color: colors.error,
  } as TextStyle,
  settingsValue: {
    fontSize: fontSize.sm,
    color: colors.surface[500],
    marginRight: spacing[2],
  } as TextStyle,
  borderBottom: { borderBottomWidth: 1, borderBottomColor: colors.surface[200] } as ViewStyle,
  disabledItem: {
    opacity: 0.6,
  } as ViewStyle,

  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  } as ViewStyle,
  flex1: { flex: 1 } as ViewStyle,
  notificationTitle: { fontSize: fontSize.base, color: colors.surface[900] } as TextStyle,
  notificationSubtitle: {
    fontSize: fontSize.xs,
    color: colors.surface[500],
    marginTop: 2,
  } as TextStyle,
  notificationNote: {
    fontSize: fontSize.xs,
    color: colors.surface[400],
    marginTop: spacing[2],
    paddingHorizontal: spacing[2],
  } as TextStyle,

  appVersionContainer: { alignItems: 'center', marginTop: spacing[8] } as ViewStyle,
  appVersion: { fontSize: fontSize.sm, color: colors.surface[400] } as TextStyle,
  appVersionSubtitle: {
    fontSize: fontSize.xs,
    color: colors.surface[300],
    marginTop: spacing[1],
  } as TextStyle,
  sentryTestButton: {
    marginTop: spacing[3],
    backgroundColor: colorWithOpacity(colors.primary[600], 0.14),
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  } as ViewStyle,
  sentryTestButtonText: {
    color: colors.primary[700],
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  } as TextStyle,

  modalHeader: {
    backgroundColor: colors.surface[100],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.surface[200],
  } as ViewStyle,
  modalHeaderInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  } as ViewStyle,
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.surface[900],
  } as TextStyle,

  formCard: {
    backgroundColor: colors.surface[100],
    borderRadius: borderRadius['2xl'],
    padding: spacing[4],
  } as ViewStyle,
  mb4: { marginBottom: spacing[4] } as ViewStyle,
  inputLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.surface[700],
    marginBottom: spacing[2],
  } as TextStyle,
  inputDisabled: {
    backgroundColor: colors.surface[50],
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  } as ViewStyle,
  inputDisabledText: { fontSize: fontSize.base, color: colors.surface[500] } as TextStyle,
  inputHint: {
    fontSize: fontSize.xs,
    color: colors.surface[400],
    marginTop: spacing[1],
  } as TextStyle,
  input: {
    backgroundColor: colors.surface[50],
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    fontSize: fontSize.base,
    color: colors.surface[900],
  } as ViewStyle & TextStyle,
  linkPhoneInputRow: {
    flexDirection: 'row',
    gap: spacing[2],
    alignItems: 'center',
  } as ViewStyle,
  linkPhoneCountryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    backgroundColor: colors.surface[50],
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
  } as ViewStyle,
  linkPhoneCountryCode: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.surface[900],
  } as TextStyle,
  linkPhoneInputField: {
    flex: 1,
    backgroundColor: colors.surface[50],
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    fontSize: fontSize.base,
    color: colors.surface[900],
  } as ViewStyle & TextStyle,
  verifyPhoneCta: {
    marginTop: spacing[3],
    alignSelf: 'flex-start',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.lg,
    backgroundColor: colorWithOpacity(colors.primary[600], 0.12),
  } as ViewStyle,
  verifyPhoneCtaText: {
    color: colors.primary[700],
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  } as TextStyle,

  modalFooter: {
    backgroundColor: colors.surface[100],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.surface[200],
  } as ViewStyle,
  saveButton: {
    paddingVertical: 14,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
  } as ViewStyle,
  saveButtonText: { color: m3.colorScheme.onPrimary, fontWeight: fontWeight.semibold } as TextStyle,

  pickerItemText: { flex: 1, fontSize: fontSize.base, color: colors.surface[900] } as TextStyle,

  alertBox: {
    backgroundColor: colorWithOpacity(colors.error, 0.08),
    borderRadius: borderRadius['2xl'],
    padding: spacing[4],
    marginBottom: spacing[4],
  } as ViewStyle,
  dangerAlert: {
    borderLeftWidth: 4,
    borderLeftColor: colors.error,
  } as ViewStyle,
  alertTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.error,
    marginTop: spacing[2],
  } as TextStyle,
  alertText: {
    fontSize: fontSize.sm,
    color: colors.surface[700],
    marginTop: spacing[1],
  } as TextStyle,
  deleteWarnings: {
    marginBottom: spacing[4],
  } as ViewStyle,
  deleteWarningItem: {
    fontSize: fontSize.sm,
    color: colors.surface[600],
    marginBottom: spacing[2],
    paddingLeft: spacing[1],
  } as TextStyle,
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
  } as ViewStyle,
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.surface[300],
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  } as ViewStyle,
  checkboxChecked: {
    backgroundColor: colors.error,
    borderColor: colors.error,
  } as ViewStyle,
  checkboxText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.surface[700],
    lineHeight: 20,
  } as TextStyle,
  checkboxBold: {
    fontWeight: fontWeight.bold,
    color: colors.error,
  } as TextStyle,
  deleteButton: {
    paddingVertical: 14,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
  } as ViewStyle,
  deleteButtonText: { color: m3.colorScheme.onError, fontWeight: fontWeight.semibold } as TextStyle,
  countryPickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  } as ViewStyle,
  countryPickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colorWithOpacity(colors.surface[900], 0.35),
  } as ViewStyle,
  countryPickerSheet: {
    backgroundColor: colors.surface[100],
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
    maxHeight: '72%',
    paddingBottom: spacing[4],
  } as ViewStyle,
  countryPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    paddingBottom: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.surface[200],
  } as ViewStyle,
  countrySearchInput: {
    backgroundColor: colors.surface[50],
    borderRadius: borderRadius.xl,
    marginHorizontal: spacing[4],
    marginVertical: spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    fontSize: fontSize.base,
    color: colors.surface[900],
  } as ViewStyle & TextStyle,
  countryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.surface[200],
  } as ViewStyle,
  countryName: {
    fontSize: fontSize.base,
    color: colors.surface[900],
  } as TextStyle,
  countryDialCode: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.surface[600],
  } as TextStyle,
});

type SettingsStyles = ReturnType<typeof createStyles>;
