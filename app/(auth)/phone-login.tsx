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
  Image,
  Platform,
  StyleSheet,
  type ImageSourcePropType,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useAuthStore } from '@/stores';
import { Button, Input } from '@/components/ui';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
import { useTranslation } from 'react-i18next';
import { spacing, borderRadius, fontSize, fontWeight, size } from '@/styles/theme';
import { useIsDark, useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { buildE164PhoneNumber } from '@/utils/phone';
import appLogoDark from '../../assets/icons/ios-dark.png';
import appLogoLight from '../../assets/icons/ios-light.png';

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
  const isDark = useIsDark();
  const appLogo = isDark ? appLogoDark : appLogoLight;
  const { mode, redirect } = useLocalSearchParams<{ mode?: string; redirect?: string }>();
  const redirectPath = useMemo(() => {
    if (typeof redirect === 'string' && redirect.startsWith('/')) return redirect;
    return '/';
  }, [redirect]);
  const phoneAuthMode = mode === 'signup' ? 'signup' : 'signin';

  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const lastNavigatedPhoneRef = useRef<string | null>(null);
  const [localPhoneError, setLocalPhoneError] = useState<string | null>(null);

  const {
    isLoading,
    errorMessage,
    pendingOTPPhone,
    isAuthenticated,
    needsProfileCompletion,
    signInWithPhone,
    signInWithApple,
    signInWithGoogle,
    clearError,
  } = useAuthStore();

  useEffect(() => {
    if (pendingOTPPhone && lastNavigatedPhoneRef.current !== pendingOTPPhone) {
      lastNavigatedPhoneRef.current = pendingOTPPhone;
      router.push({
        pathname: '/(auth)/otp-verification',
        params: {
          phone: pendingOTPPhone,
          channel: 'phone',
          mode: phoneAuthMode,
          redirect: redirectPath,
        },
      });
    } else if (!pendingOTPPhone) {
      lastNavigatedPhoneRef.current = null;
    }
  }, [pendingOTPPhone, phoneAuthMode, redirectPath]);

  const normalizedPhoneNumber = useMemo(
    () => buildE164PhoneNumber(selectedCountry.dialCode, phoneNumber),
    [selectedCountry.dialCode, phoneNumber],
  );

  useEffect(() => {
    if (isAuthenticated && needsProfileCompletion) {
      router.replace('/(auth)/profile-completion');
    } else if (isAuthenticated) {
      router.replace(redirectPath as Href);
    }
  }, [isAuthenticated, needsProfileCompletion, redirectPath]);

  const handleSendCode = async () => {
    const fullPhoneNumber = normalizedPhoneNumber;
    if (!fullPhoneNumber) {
      setLocalPhoneError(t('authPhone.invalidPhone'));
      return;
    }
    clearError();
    setLocalPhoneError(null);
    await signInWithPhone(fullPhoneNumber, phoneAuthMode);
  };

  const handleSelectCountry = (country: Country) => {
    setSelectedCountry(country);
    setShowCountryPicker(false);
    setCountrySearch('');
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

  const logoContainerStyle: ViewStyle = {
    alignItems: 'center',
    marginTop: spacing[8],
    marginBottom: spacing[12],
  };

  const logoBoxStyle: ViewStyle = {
    width: size['3xl'],
    height: size['3xl'],
    borderRadius: borderRadius['3xl'],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
    backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
  };

  const titleTextStyle: TextStyle = {
    fontSize: fontSize['3xl'],
    fontWeight: fontWeight.bold,
    color: m3.colorScheme.onSurface,
  };

  const subtitleTextStyle: TextStyle = {
    fontSize: fontSize.base,
    marginTop: spacing[1],
    color: m3.colorScheme.onSurfaceVariant,
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
    backgroundColor: colorWithOpacity(m3.colorScheme.error, isDark ? 0.2 : 0.12),
    borderWidth: 1,
    borderColor: colorWithOpacity(m3.colorScheme.error, isDark ? 0.42 : 0.25),
  };

  const errorTextStyle: TextStyle = {
    fontSize: fontSize.sm,
    marginLeft: spacing[2],
    flex: 1,
    color: m3.colorScheme.error,
  };

  const dividerContainerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing[8],
  };

  const dividerLineStyle: ViewStyle = {
    flex: 1,
    height: 1,
    backgroundColor: m3.colorScheme.outlineVariant,
  };

  const dividerTextStyle: TextStyle = {
    fontSize: fontSize.sm,
    marginHorizontal: spacing[4],
    color: m3.colorScheme.onSurfaceVariant,
  };

  const emailLinkContainerStyle: ViewStyle = {
    alignItems: 'center',
    paddingVertical: spacing[4],
    marginTop: spacing[4],
  };

  const emailLinkTextStyle: TextStyle = {
    fontSize: fontSize.sm,
    color: m3.colorScheme.onSurfaceVariant,
  };

  const emailLinkHighlightStyle: TextStyle = {
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
          {/* Logo & Title */}
          <View style={logoContainerStyle}>
            <View style={logoBoxStyle}>
              <Image
                source={appLogo as ImageSourcePropType}
                style={{ width: size.lg, height: size.lg }}
                resizeMode="contain"
              />
            </View>
            <Text style={titleTextStyle}>Vinesight</Text>
            <Text style={subtitleTextStyle}>{t('auth.subtitle')}</Text>
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
                onChangeText={(value) => {
                  setLocalPhoneError(null);
                  setPhoneNumber(value.replace(/[^\d]/g, ''));
                }}
                leftIcon="phone.fill"
                keyboardType="phone-pad"
                maxLength={15}
                autoCapitalize="none"
                textContentType="telephoneNumber"
                autoComplete="tel"
                containerStyle={{ marginBottom: spacing[2] }}
              />

              {/* Error Message */}
              {(errorMessage || localPhoneError) && (
                <View style={errorContainerStyle}>
                  <UiSymbol
                    name="exclamationmark.circle.fill"
                    size={18}
                    color={m3.colorScheme.error}
                  />
                  <Text style={errorTextStyle}>{localPhoneError ?? errorMessage}</Text>
                </View>
              )}

              {/* Send Code Button */}
              <Button
                title={isLoading ? t('authPhone.sendingCode') : t('authPhone.sendCode')}
                onPress={handleSendCode}
                isLoading={isLoading}
                disabled={!phoneNumber || !normalizedPhoneNumber}
                style={{ marginTop: spacing[4] }}
              />
            </View>

            {/* Divider */}
            <View style={dividerContainerStyle}>
              <View style={dividerLineStyle} />
              <Text style={dividerTextStyle}>{t('auth.or')}</Text>
              <View style={dividerLineStyle} />
            </View>

            {/* Apple Sign In (required on iOS if Google is offered) */}
            {Platform.OS === 'ios' && (
              <Button
                title={t('auth.continueWithApple')}
                variant="outline"
                leftIcon={<UiSymbol name="apple.logo" size={20} color={m3.colorScheme.primary} />}
                onPress={signInWithApple}
                disabled={isLoading}
                style={{ marginBottom: spacing[3] }}
              />
            )}

            {/* Google Sign In */}
            <Button
              title={t('auth.continueWithGoogle')}
              variant="outline"
              leftIcon={<UiSymbol name="g.circle.fill" size={20} color={m3.colorScheme.primary} />}
              onPress={signInWithGoogle}
              disabled={isLoading}
            />
          </View>

          {/* Sign in with email link */}
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/(auth)/login',
                params: { redirect: redirectPath, mode: phoneAuthMode },
              })
            }
            style={emailLinkContainerStyle}
            disabled={isLoading}
            accessibilityRole="button"
            accessibilityLabel={t('auth.continueWithEmail')}
          >
            {({ pressed }) => (
              <View style={{ paddingVertical: spacing[2], paddingHorizontal: spacing[2] }}>
                <Text style={emailLinkTextStyle}>
                  {t('authPhone.preferEmail')}{' '}
                  <Text style={emailLinkHighlightStyle}>{t('authPhone.signInWithEmail')}</Text>
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
        <View style={modalOverlayStyle}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowCountryPicker(false)} />
          <View style={modalContentStyle}>
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
              keyExtractor={(item) => `${item.code}-${item.dialCode}`}
              renderItem={renderCountryItem}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
