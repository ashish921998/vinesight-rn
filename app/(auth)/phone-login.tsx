import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  ScrollView,
  Pressable,
  Modal,
  FlatList,
  TextInput,
  Platform,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '@/stores';
import { Button, Input } from '@/components/ui';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
import { useTranslation } from 'react-i18next';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';

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

const DEFAULT_COUNTRY = COUNTRIES[0]; // India

export default function PhoneLoginScreen() {
  const { t } = useTranslation();
  const m3 = useM3();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const phoneAuthMode = mode === 'signup' ? 'signup' : 'signin';

  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const lastNavigatedPhoneRef = useRef<string | null>(null);

  const {
    isLoading,
    errorMessage,
    pendingOTPPhone,
    isAuthenticated,
    needsProfileCompletion,
    signInWithPhone,
    clearError,
  } = useAuthStore();

  useEffect(() => {
    if (pendingOTPPhone && lastNavigatedPhoneRef.current !== pendingOTPPhone) {
      lastNavigatedPhoneRef.current = pendingOTPPhone;
      router.push({
        pathname: '/(auth)/otp-verification',
        params: { phone: pendingOTPPhone, channel: 'phone', mode: phoneAuthMode },
      });
    } else if (!pendingOTPPhone) {
      lastNavigatedPhoneRef.current = null;
    }
  }, [pendingOTPPhone, phoneAuthMode]);

  useEffect(() => {
    if (isAuthenticated && needsProfileCompletion) {
      router.replace('/(auth)/profile-completion');
    } else if (isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, needsProfileCompletion]);

  const handleSendCode = async () => {
    if (!phoneNumber) return;
    clearError();
    const digitsOnly = phoneNumber.replace(/[^\d]/g, '');
    const normalizedLocalNumber = digitsOnly.replace(/^0+/, '');
    if (!normalizedLocalNumber) return;
    const fullPhoneNumber = selectedCountry.dialCode + normalizedLocalNumber;
    await signInWithPhone(fullPhoneNumber, phoneAuthMode);
  };

  const handleSelectCountry = (country: Country) => {
    setSelectedCountry(country);
    setShowCountryPicker(false);
    setCountrySearch('');
  };

  const handleBack = () => {
    router.back();
  };

  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return COUNTRIES;
    const query = countrySearch.toLowerCase();
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.dialCode.includes(query) ||
        c.code.toLowerCase().includes(query),
    );
  }, [countrySearch]);

  const containerStyle: ViewStyle = {
    flex: 1,
    backgroundColor: m3.colorScheme.surface,
  };

  const contentContainerStyle: ViewStyle = {
    flex: 1,
    paddingHorizontal: spacing[8],
    paddingTop: spacing[16],
    paddingBottom: spacing[8],
  };

  const headerContainerStyle: ViewStyle = {
    alignItems: 'center',
    marginTop: spacing[8],
    marginBottom: spacing[12],
  };

  const iconBoxStyle: ViewStyle = {
    width: 80,
    height: 80,
    borderRadius: borderRadius.full,
    backgroundColor: m3.colorScheme.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[6],
  };

  const titleTextStyle: TextStyle = {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: m3.colorScheme.onSurface,
    textAlign: 'center',
  };

  const subtitleTextStyle: TextStyle = {
    fontSize: fontSize.base,
    color: m3.colorScheme.onSurfaceVariant,
    textAlign: 'center',
    marginTop: spacing[3],
  };

  const formContainerStyle: ViewStyle = {
    flex: 1,
    justifyContent: 'center',
  };

  const formInnerStyle: ViewStyle = {
    gap: spacing[4],
  };

  const countryPickerButtonStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: m3.colorScheme.outlineVariant,
    backgroundColor: m3.surface.surfaceContainerHigh,
  };

  const countryDialCodeStyle: TextStyle = {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: m3.colorScheme.onSurface,
    marginLeft: spacing[2],
  };

  const countryNameStyle: TextStyle = {
    fontSize: fontSize.sm,
    color: m3.colorScheme.onSurfaceVariant,
    marginLeft: spacing[2],
    flex: 1,
  };

  const errorContainerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.xl,
    marginBottom: spacing[2],
    backgroundColor: colorWithOpacity(m3.colorScheme.error, 0.12),
    borderWidth: 1,
    borderColor: colorWithOpacity(m3.colorScheme.error, 0.25),
  };

  const errorTextStyle: TextStyle = {
    fontSize: fontSize.sm,
    marginLeft: spacing[2],
    flex: 1,
    color: m3.colorScheme.error,
  };

  const backContainerStyle: ViewStyle = {
    alignItems: 'center',
    paddingVertical: spacing[4],
    marginTop: spacing[4],
  };

  const backTextStyle: TextStyle = {
    fontSize: fontSize.sm,
    color: m3.colorScheme.onSurfaceVariant,
  };

  const backLinkStyle: TextStyle = {
    fontWeight: fontWeight.semibold,
    color: m3.colorScheme.primary,
  };

  // Modal styles
  const modalOverlayStyle: ViewStyle = {
    flex: 1,
    backgroundColor: colorWithOpacity('#000000', 0.5),
    justifyContent: 'flex-end',
  };

  const modalContentStyle: ViewStyle = {
    backgroundColor: m3.colorScheme.surface,
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
    maxHeight: '70%',
    paddingBottom: spacing[8],
  };

  const modalHeaderStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[6],
    paddingTop: spacing[5],
    paddingBottom: spacing[3],
  };

  const modalTitleStyle: TextStyle = {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: m3.colorScheme.onSurface,
  };

  const searchInputStyle: TextStyle = {
    fontSize: fontSize.base,
    color: m3.colorScheme.onSurface,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    marginHorizontal: spacing[6],
    marginBottom: spacing[2],
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: m3.colorScheme.outlineVariant,
    backgroundColor: m3.surface.surfaceContainerHigh,
  };

  const countryItemStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
  };

  const countryItemNameStyle: TextStyle = {
    fontSize: fontSize.base,
    color: m3.colorScheme.onSurface,
    flex: 1,
  };

  const countryItemDialCodeStyle: TextStyle = {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    color: m3.colorScheme.onSurfaceVariant,
  };

  const renderCountryItem = ({ item }: { item: Country }) => (
    <Pressable
      onPress={() => handleSelectCountry(item)}
      style={({ pressed }) => [
        countryItemStyle,
        {
          backgroundColor: pressed
            ? colorWithOpacity(m3.colorScheme.onSurface, m3.stateLayerOpacity.pressed)
            : item.code === selectedCountry.code
              ? colorWithOpacity(m3.colorScheme.primary, 0.08)
              : 'transparent',
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${item.name} ${item.dialCode}`}
    >
      <Text style={countryItemNameStyle}>{item.name}</Text>
      <Text style={countryItemDialCodeStyle}>{item.dialCode}</Text>
    </Pressable>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={containerStyle}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={contentContainerStyle}>
          {/* Header */}
          <View style={headerContainerStyle}>
            <View style={iconBoxStyle}>
              <UiSymbol name="phone.fill" size={40} color={m3.colorScheme.primary} />
            </View>
            <Text style={titleTextStyle}>{t('authPhone.title')}</Text>
            <Text style={subtitleTextStyle}>{t('authPhone.subtitle')}</Text>
          </View>

          {/* Form */}
          <View style={formContainerStyle}>
            <View style={formInnerStyle}>
              {/* Country Code Picker */}
              <Pressable
                onPress={() => setShowCountryPicker(true)}
                style={({ pressed }) => [
                  countryPickerButtonStyle,
                  {
                    backgroundColor: pressed
                      ? colorWithOpacity(m3.colorScheme.onSurface, m3.stateLayerOpacity.pressed)
                      : m3.surface.surfaceContainerHigh,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={t('authPhone.selectCountryA11y')}
              >
                <UiSymbol name="globe" size={20} color={m3.colorScheme.onSurfaceVariant} />
                <Text style={countryDialCodeStyle}>{selectedCountry.dialCode}</Text>
                <Text style={countryNameStyle}>{selectedCountry.name}</Text>
                <UiSymbol name="chevron.down" size={14} color={m3.colorScheme.onSurfaceVariant} />
              </Pressable>

              {/* Phone Number Input */}
              <Input
                placeholder={t('authPhone.phoneNumber')}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                leftIcon="phone.fill"
                keyboardType="phone-pad"
                autoCapitalize="none"
                textContentType="telephoneNumber"
                autoComplete="tel"
                containerStyle={{ marginBottom: spacing[2] }}
              />

              {/* Error Message */}
              {errorMessage && (
                <View style={errorContainerStyle}>
                  <UiSymbol
                    name="exclamationmark.circle.fill"
                    size={18}
                    color={m3.colorScheme.error}
                  />
                  <Text style={errorTextStyle}>{errorMessage}</Text>
                </View>
              )}

              {/* Send Code Button */}
              <Button
                title={t('authPhone.sendCode')}
                onPress={handleSendCode}
                isLoading={isLoading}
                disabled={!phoneNumber || isLoading}
                style={{ marginTop: spacing[4] }}
              />
            </View>
          </View>

          {/* Back to Login */}
          <Pressable
            onPress={handleBack}
            style={backContainerStyle}
            disabled={isLoading}
            accessibilityRole="button"
            accessibilityLabel={t('authPhone.backToLoginA11y')}
          >
            {({ pressed }) => (
              <View style={{ paddingVertical: spacing[2], paddingHorizontal: spacing[2] }}>
                <Text style={backTextStyle}>
                  {t('authPhone.backToLoginPrefix')}{' '}
                  <Text style={backLinkStyle}>{t('authPhone.backToLoginLink')}</Text>
                </Text>
                <View
                  pointerEvents="none"
                  style={[
                    StyleSheet.absoluteFillObject,
                    {
                      backgroundColor: pressed
                        ? colorWithOpacity(m3.colorScheme.onSurface, m3.stateLayerOpacity.pressed)
                        : 'transparent',
                      borderRadius: m3.shape.cornerMedium,
                    },
                  ]}
                />
              </View>
            )}
          </Pressable>
        </View>
      </ScrollView>

      {/* Country Picker Modal */}
      <Modal
        visible={showCountryPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCountryPicker(false)}
      >
        <Pressable style={modalOverlayStyle} onPress={() => setShowCountryPicker(false)}>
          <Pressable style={modalContentStyle} onPress={() => {}}>
            <View style={modalHeaderStyle}>
              <Text style={modalTitleStyle}>{t('authPhone.selectCountry')}</Text>
              <Pressable
                onPress={() => setShowCountryPicker(false)}
                accessibilityRole="button"
                accessibilityLabel={t('authPhone.closeA11y')}
              >
                <UiSymbol
                  name="xmark.circle.fill"
                  size={24}
                  color={m3.colorScheme.onSurfaceVariant}
                />
              </Pressable>
            </View>

            <TextInput
              placeholder={t('authPhone.searchCountry')}
              value={countrySearch}
              onChangeText={setCountrySearch}
              style={searchInputStyle}
              placeholderTextColor={m3.colorScheme.onSurfaceVariant}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <FlatList
              data={filteredCountries}
              keyExtractor={(item) => item.code}
              renderItem={renderCountryItem}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}
