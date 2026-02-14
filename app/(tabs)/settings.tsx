import React, { useMemo, useState, useEffect } from 'react';
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
  Platform,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore, useLanguageStore, useNotificationStore, useThemeStore } from '@/stores';
import { useProfile, useUpdateProfile, useCurrency } from '@/hooks';
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

type LinkPhoneParams = {
  linkPhone?: string;
};

export default function SettingsScreen() {
  const router = useRouter();
  const { linkPhone } = useLocalSearchParams<LinkPhoneParams>();
  const colors = useThemeColors();
  const m3 = useM3();
  const styles = useMemo(() => createStyles(colors, m3), [colors, m3]);
  const { t } = useTranslation();

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

  // Edit profile form state
  const [editName, setEditName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Delete account form state
  const [deleteEmail, setDeleteEmail] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [linkPhoneInput, setLinkPhoneInput] = useState('');
  const [linkPhoneCode, setLinkPhoneCode] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');

  // Local preferences state
  const [selectedCurrency, setSelectedCurrency] = useState(getDefaultCurrency());
  const [selectedAreaUnit, setSelectedAreaUnit] = useState<'acres' | 'hectares'>('acres');
  const currency = useCurrency();

  useEffect(() => {
    if (profile) {
      setEditName(profile.full_name || '');
      setSelectedCurrency(currency);
      // Area unit from user metadata
    }
    setSelectedAreaUnit(resolveAreaUnitPreference(user?.user_metadata?.area_unit));
  }, [profile, user, currency]);

  const userName = profile?.full_name || user?.user_metadata?.full_name || 'User';
  const userEmail = profile?.email || user?.email || '';
  const userPhone = profile?.phone || '';
  const linkedAuthPhone = user?.phone || null;
  const hasSavedPhoneToVerify = Boolean(userPhone) && !linkedAuthPhone;
  const isLinkPhoneModalVisible = showLinkPhoneModal || phoneLinkingPending;
  const phoneActionTitle = linkedAuthPhone
    ? t('settings.linkPhone.changePhone')
    : hasSavedPhoneToVerify
      ? t('settings.linkPhone.verifyTitle')
      : t('settings.linkPhone.title');
  const phoneActionValue = linkedAuthPhone ?? (hasSavedPhoneToVerify ? userPhone : null);
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

  const setPhoneFormFromValue = (value: string) => {
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
        setLinkPhoneInput(trimmed.slice(matched.dialCode.length));
        return;
      }
    }

    setLinkPhoneInput(trimmed);
  };

  const buildE164PhoneNumber = () => {
    const raw = linkPhoneInput.trim();
    if (!raw) return '';
    if (raw.startsWith('+')) return raw;
    const digitsOnly = raw.replace(/[^\d]/g, '');
    const normalizedLocalNumber = digitsOnly.replace(/^0+/, '');
    if (!normalizedLocalNumber) return '';
    return `${selectedCountry.dialCode}${normalizedLocalNumber}`;
  };

  useEffect(() => {
    if (linkPhone !== '1') return;

    clearError();
    setLinkPhoneCode('');
    const trimmedValue = (linkedAuthPhone ?? userPhone ?? '').trim();
    if (!trimmedValue) {
      setSelectedCountry(DEFAULT_COUNTRY);
      setLinkPhoneInput('');
    } else if (trimmedValue.startsWith('+')) {
      const matched = [...COUNTRIES]
        .sort((a, b) => b.dialCode.length - a.dialCode.length)
        .find((country) => trimmedValue.startsWith(country.dialCode));
      if (matched) {
        setSelectedCountry(matched);
        setLinkPhoneInput(trimmedValue.slice(matched.dialCode.length));
      } else {
        setLinkPhoneInput(trimmedValue);
      }
    } else {
      setLinkPhoneInput(trimmedValue);
    }
    setShowLinkPhoneModal(true);
  }, [linkPhone, clearError, linkedAuthPhone, userPhone]);

  useEffect(() => {
    if (!phoneLinkingPending) return;
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
    const ids = Object.values(taskSchedules).map((s) => s.notificationId);
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

  const handleDeleteAccount = () => {
    setDeleteEmail(userEmail);
    setShowDeleteAccount(true);
  };

  const handleExportAssistantMemory = async () => {
    if (isExportingAssistantData || isDeletingAssistantData) return;
    setIsExportingAssistantData(true);

    try {
      const exportData = await assistantMemoryService.exportUserData();
      if (!exportData) {
        Alert.alert(t('common.error'), t('settings.errors.assistantMemoryExportFailed'));
        return;
      }

      const payload = {
        exported_at: new Date().toISOString(),
        retention_days: 180,
        ...exportData,
      };

      const fileName = `vinesight-assistant-memory-${Date.now()}.json`;
      const directory = FileSystem.cacheDirectory;
      const fileUri = directory ? `${directory}${fileName}` : null;

      if (fileUri) {
        await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(payload, null, 2));
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/json',
            dialogTitle: t('settings.assistantMemory.exportShareTitle'),
          });
        }
      }

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
    setLinkPhoneCode('');
    setCountrySearch('');
    setPhoneFormFromValue(linkedAuthPhone ?? userPhone ?? '');
    setShowLinkPhoneModal(true);
  };

  const handleCloseLinkPhone = () => {
    clearError();
    cancelPhoneLinking();
    setShowCountryPicker(false);
    setCountrySearch('');
    setLinkPhoneCode('');
    setShowLinkPhoneModal(false);
    router.setParams({ linkPhone: undefined });
  };

  const handleLinkPhoneSuccessClose = () => {
    clearError();
    setShowCountryPicker(false);
    setCountrySearch('');
    setLinkPhoneCode('');
    setShowLinkPhoneModal(false);
    router.setParams({ linkPhone: undefined });
  };

  const handleSendPhoneLinkCode = async () => {
    const phone = buildE164PhoneNumber();
    if (!phone) return;
    clearError();
    await linkPhoneNumber(phone);
  };

  const handleVerifyPhoneLinkCode = async () => {
    const code = linkPhoneCode.trim();
    const formattedPhone = buildE164PhoneNumber();
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
    const pendingPhone = phoneLinkingNumber ?? buildE164PhoneNumber();
    if (!pendingPhone) return;
    clearError();
    await linkPhoneNumber(pendingPhone);
  };

  const handleSelectCountry = (country: Country) => {
    setSelectedCountry(country);
    setShowCountryPicker(false);
    setCountrySearch('');
  };

  const handleConfirmDeleteAccount = async () => {
    if (deleteEmail !== userEmail) {
      Alert.alert(t('common.error'), t('settings.deleteAccountModal.errors.emailMismatch'));
      return;
    }

    if (!deletePassword) {
      Alert.alert(t('common.error'), t('settings.deleteAccountModal.errors.missingPassword'));
      return;
    }

    if (!deleteConfirmed) {
      Alert.alert(t('common.error'), t('settings.deleteAccountModal.errors.missingConfirmation'));
      return;
    }

    setIsDeleting(true);

    try {
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: deleteEmail.toLowerCase(),
        password: deletePassword,
      });

      if (verifyError) {
        setIsDeleting(false);
        Alert.alert(t('common.error'), t('settings.deleteAccountModal.errors.invalidPassword'));
        return;
      }

      await deleteAccount(deleteReason);
      setIsDeleting(false);
      setDeletePassword('');
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
      setDeletePassword('');
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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 32 }}
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
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
            {userPhone ? (
              <Text
                style={styles.profilePhone}
                textBreakStrategy="highQuality"
                lineBreakStrategyIOS="standard"
              >
                {userPhone}
              </Text>
            ) : null}
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
          {t('settings.assistantMemory.retentionNote')}
        </Text>
      </View>

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
          Vinesight v1.0.0
        </Text>
        <Text
          style={styles.appVersionSubtitle}
          textBreakStrategy="highQuality"
          lineBreakStrategyIOS="standard"
        >
          {t('settings.madeForVineyardManagement')}
        </Text>
      </View>

      {/* Edit Profile Modal */}
      <Modal
        visible={showEditProfile}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowEditProfile(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
        >
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
            contentContainerStyle={{ padding: 16 }}
            contentInsetAdjustmentBehavior="automatic"
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
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
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
        >
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderInner}>
              <Text
                style={styles.modalTitle}
                textBreakStrategy="highQuality"
                lineBreakStrategyIOS="standard"
              >
                {phoneLinkingPending
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
            contentContainerStyle={{ padding: 16 }}
            contentInsetAdjustmentBehavior="automatic"
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
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
                  {phoneLinkingPending
                    ? t('settings.linkPhone.verifySubtitle')
                    : t('settings.linkPhone.subtitle')}
                </Text>
                {phoneLinkingPending ? (
                  <Text
                    style={styles.inputHint}
                    textBreakStrategy="highQuality"
                    lineBreakStrategyIOS="standard"
                  >
                    {phoneLinkingNumber ?? linkPhoneInput}
                  </Text>
                ) : null}
              </View>

              {!phoneLinkingPending ? (
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
                      onChangeText={setLinkPhoneInput}
                      placeholder={t('settings.linkPhone.phonePlaceholder')}
                      placeholderTextColor={colors.gray[400]}
                      keyboardType="phone-pad"
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
                  <Pressable onPress={handleResendPhoneLinkCode} disabled={authLoading}>
                    <Text
                      style={styles.inputHint}
                      textBreakStrategy="highQuality"
                      lineBreakStrategyIOS="standard"
                    >
                      {t('settings.linkPhone.resend')}
                    </Text>
                  </Pressable>
                </View>
              )}

              {authErrorMessage ? (
                <View style={[styles.alertBox, styles.dangerAlert, { marginBottom: 0 }]}>
                  <Text
                    style={styles.alertText}
                    textBreakStrategy="highQuality"
                    lineBreakStrategyIOS="standard"
                  >
                    {authErrorMessage}
                  </Text>
                </View>
              ) : null}
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <Pressable
              onPress={phoneLinkingPending ? handleVerifyPhoneLinkCode : handleSendPhoneLinkCode}
              disabled={
                authLoading ||
                (!phoneLinkingPending && !linkPhoneInput.trim()) ||
                (phoneLinkingPending && linkPhoneCode.trim().length !== 6)
              }
              style={[
                styles.saveButton,
                { backgroundColor: colors.primary[600], marginBottom: spacing[3] },
              ]}
            >
              {authLoading ? (
                <ActivityIndicator color={m3.colorScheme.onPrimary} />
              ) : (
                <Text
                  style={styles.saveButtonText}
                  textBreakStrategy="highQuality"
                  lineBreakStrategyIOS="standard"
                >
                  {phoneLinkingPending
                    ? t('settings.linkPhone.verify')
                    : t('settings.linkPhone.sendCode')}
                </Text>
              )}
            </Pressable>

            <Pressable
              onPress={handleCloseLinkPhone}
              disabled={authLoading}
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
            contentContainerStyle={{ padding: 16 }}
            contentInsetAdjustmentBehavior="automatic"
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
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
            contentContainerStyle={{ padding: 16 }}
            contentInsetAdjustmentBehavior="automatic"
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
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
            contentContainerStyle={{ padding: 16 }}
            contentInsetAdjustmentBehavior="automatic"
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
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
            contentContainerStyle={{ padding: 16 }}
            contentInsetAdjustmentBehavior="automatic"
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <View style={styles.sectionContent}>
              {AREA_UNITS.map((unit, index) => (
                <Pressable
                  key={unit.id}
                  onPress={async () => {
                    try {
                      await updateUserAreaUnit(unit.id as 'hectares' | 'acres');
                      setSelectedAreaUnit(resolveAreaUnitPreference(unit.id));
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
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
        >
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
            contentContainerStyle={{ padding: 16 }}
            contentInsetAdjustmentBehavior="automatic"
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
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
                  {t('settings.deleteAccountModal.confirmEmail.label')}
                </Text>
                <TextInput
                  value={deleteEmail}
                  onChangeText={setDeleteEmail}
                  placeholder={t('settings.deleteAccountModal.confirmEmail.placeholder')}
                  placeholderTextColor={colors.gray[400]}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={styles.input}
                />
                <Text
                  style={styles.inputHint}
                  textBreakStrategy="highQuality"
                  lineBreakStrategyIOS="standard"
                >
                  {t('settings.deleteAccountModal.confirmEmail.hint')}
                </Text>
              </View>

              <View style={styles.mb4}>
                <Text
                  style={styles.inputLabel}
                  textBreakStrategy="highQuality"
                  lineBreakStrategyIOS="standard"
                >
                  {t('settings.deleteAccountModal.confirmPassword.label')}
                </Text>
                <TextInput
                  value={deletePassword}
                  onChangeText={setDeletePassword}
                  placeholder={t('settings.deleteAccountModal.confirmPassword.placeholder')}
                  placeholderTextColor={colors.gray[400]}
                  secureTextEntry
                  style={styles.input}
                />
                <Text
                  style={styles.inputHint}
                  textBreakStrategy="highQuality"
                  lineBreakStrategyIOS="standard"
                >
                  {t('settings.deleteAccountModal.confirmPassword.hint')}
                </Text>
              </View>

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
              disabled={isDeleting}
              style={[styles.deleteButton, { backgroundColor: colors.error }]}
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
