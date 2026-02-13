import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '@/stores';
import { Button, Input } from '@/components/ui';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
import { useTranslation } from 'react-i18next';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { useIsDark, useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';

export default function ProfileCompletionScreen() {
  const { t } = useTranslation();
  const m3 = useM3();
  const isDark = useIsDark();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);

  const {
    isLoading,
    errorMessage,
    isAuthenticated,
    needsProfileCompletion,
    completeProfile,
    clearError,
  } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated && !needsProfileCompletion) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, needsProfileCompletion]);

  const handleContinue = async () => {
    if (!firstName.trim() || !lastName.trim()) return;
    const trimmedEmail = email.trim();
    if (trimmedEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        setEmailError('Please enter a valid email address');
        return;
      }
    }
    setEmailError(null);
    clearError();
    await completeProfile({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: trimmedEmail || undefined,
    });
  };

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

  const iconContainerStyle: ViewStyle = {
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
          <View style={headerContainerStyle}>
            <View style={iconContainerStyle}>
              <UiSymbol
                name="person.crop.circle.fill.badge.plus"
                size={40}
                color={m3.colorScheme.primary}
              />
            </View>
            <Text style={titleTextStyle}>{t('profileCompletion.title')}</Text>
            <Text style={subtitleTextStyle}>{t('profileCompletion.subtitle')}</Text>
          </View>

          <View style={formContainerStyle}>
            <View style={formInnerStyle}>
              <Input
                placeholder={t('profileCompletion.firstName')}
                value={firstName}
                onChangeText={setFirstName}
                leftIcon="person.fill"
                autoCapitalize="words"
                textContentType="givenName"
                containerStyle={{ marginBottom: spacing[4] }}
              />

              <Input
                placeholder={t('profileCompletion.lastName')}
                value={lastName}
                onChangeText={setLastName}
                leftIcon="person.fill"
                autoCapitalize="words"
                textContentType="familyName"
                containerStyle={{ marginBottom: spacing[4] }}
              />

              <Input
                placeholder={t('profileCompletion.emailPlaceholder')}
                value={email}
                onChangeText={setEmail}
                leftIcon="mail"
                keyboardType="email-address"
                autoCapitalize="none"
                textContentType="emailAddress"
                autoComplete="email"
                containerStyle={{ marginBottom: spacing[2] }}
              />

              {(errorMessage || emailError) && (
                <View style={errorContainerStyle}>
                  <UiSymbol
                    name="exclamationmark.circle.fill"
                    size={18}
                    color={m3.colorScheme.error}
                  />
                  <Text style={errorTextStyle}>{emailError || errorMessage}</Text>
                </View>
              )}

              <Button
                title={t('profileCompletion.continue')}
                onPress={handleContinue}
                isLoading={isLoading}
                disabled={!firstName.trim() || !lastName.trim() || isLoading}
                style={{ marginTop: spacing[4] }}
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
