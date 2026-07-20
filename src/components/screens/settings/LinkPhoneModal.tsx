import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  FlatList,
  TextInput,
  Modal,
  KeyboardAvoidingView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Symbol as UISymbol } from '@/components/ui/symbol';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import { spacing } from '@/styles/theme';
import { isIOS } from '@/hooks';
import type { getM3Theme } from '@/styles/theme';
import type { SettingsStyles } from './settings-styles';
import { useAuthStore } from '@/stores';
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

interface LinkPhoneModalProps {
  visible: boolean;
  linkedAuthPhone: string | null;
  hasSavedPhoneToVerify: boolean;
  styles: SettingsStyles;
  m3: ReturnType<typeof getM3Theme>;
  onClose: () => void;
  onSuccess: () => void;
  refetchProfile: () => void;
}

export function LinkPhoneModal({
  visible,
  linkedAuthPhone,
  hasSavedPhoneToVerify,
  styles,
  m3,
  onClose,
  onSuccess,
  refetchProfile,
}: LinkPhoneModalProps) {
  const { t } = useTranslation();

  const {
    linkPhoneNumber,
    verifyPhoneLinking,
    cancelPhoneLinking,
    phoneLinkingPending,
    phoneLinkingNumber,
    phoneLinkingLoading,
    clearError,
    errorMessage: authErrorMessage,
  } = useAuthStore();

  const [linkPhoneInput, setLinkPhoneInput] = useState('');
  const [linkPhoneCode, setLinkPhoneCode] = useState('');
  const [isPhoneLinkCodeStep, setIsPhoneLinkCodeStep] = useState(false);
  const [phoneNumberEditCount, setPhoneNumberEditCount] = useState(0);
  const [linkPhoneLocalError, setLinkPhoneLocalError] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');

  const isLinkPhoneModalVisible = visible || phoneLinkingPending;
  const isShowingPhoneCodeStep = isPhoneLinkCodeStep || phoneLinkingPending;

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

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
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

  // Clear local error when phone input changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLinkPhoneLocalError(null);
  }, [linkPhoneInput]);

  // Sync with phoneLinkingPending from auth store
  useEffect(() => {
    if (!phoneLinkingPending) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsPhoneLinkCodeStep(true);
  }, [phoneLinkingPending]);

  // Reset state when modal becomes visible
  useEffect(() => {
    if (!visible) return;
    clearError();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLinkPhoneLocalError(null);
    setLinkPhoneCode('');
    setIsPhoneLinkCodeStep(false);
    setPhoneNumberEditCount(0);
    setCountrySearch('');
    setPhoneFormFromValue(linkedAuthPhone ?? '');
  }, [visible, clearError, linkedAuthPhone, setPhoneFormFromValue]);

  const handleCloseLinkPhone = () => {
    clearError();
    setLinkPhoneLocalError(null);
    cancelPhoneLinking();
    setShowCountryPicker(false);
    setCountrySearch('');
    setLinkPhoneCode('');
    setIsPhoneLinkCodeStep(false);
    setPhoneNumberEditCount(0);
    onClose();
  };

  const handleLinkPhoneSuccessClose = () => {
    clearError();
    setLinkPhoneLocalError(null);
    setShowCountryPicker(false);
    setCountrySearch('');
    setLinkPhoneCode('');
    setIsPhoneLinkCodeStep(false);
    setPhoneNumberEditCount(0);
    onSuccess();
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
      toast.success(t('settings.linkPhone.success'));
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

  return (
    <>
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
                <Pressable
                  onPress={handleCloseLinkPhone}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.close')}
                >
                  <UISymbol name="xmark.circle.fill" size={28} color={m3.neutral.n400} />
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
                        <UISymbol name="chevron.down" size={14} color={m3.surface.s500} />
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
                        placeholderTextColor={m3.neutral.n400}
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
                      onChangeText={(text) => setLinkPhoneCode(text.replace(/[^0-9]/g, ''))}
                      placeholder={t('settings.linkPhone.codePlaceholder')}
                      placeholderTextColor={m3.neutral.n400}
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
                      backgroundColor: m3.primary.p600,
                      marginBottom: spacing[3],
                      opacity: isDisabled ? 0.5 : pressed ? 0.8 : 1,
                    },
                  ];
                }}
              >
                {phoneLinkingLoading ? (
                  <Spinner color={m3.colorScheme.onPrimary} />
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
                  style={[styles.settingsTitle, { flex: 0, marginLeft: 0, color: m3.surface.s700 }]}
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
                <UISymbol name="xmark.circle.fill" size={24} color={m3.neutral.n400} />
              </Pressable>
            </View>

            <TextInput
              value={countrySearch}
              onChangeText={setCountrySearch}
              placeholder={t('authPhone.searchCountry')}
              placeholderTextColor={m3.neutral.n400}
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
    </>
  );
}
