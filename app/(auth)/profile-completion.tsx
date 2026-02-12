import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  ScrollView,
  Pressable,
  Platform,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '@/stores';
import { Button, Input } from '@/components/ui';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
import { useTranslation } from 'react-i18next';
import { m3, spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';

export default function ProfileCompletionScreen() {
  const { t } = useTranslation();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');

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
    if (!fullName.trim()) return;
    clearError();
    await completeProfile({ fullName: fullName.trim(), email: email.trim() || undefined });
  };

  const handleSkip = () => {
    useAuthStore.setState({ needsProfileCompletion: false });
    router.replace('/(tabs)');
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

  const skipContainerStyle: ViewStyle = {
    alignItems: 'center',
    paddingVertical: spacing[4],
    marginTop: spacing[4],
  };

  const skipTextStyle: TextStyle = {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: m3.colorScheme.primary,
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
                placeholder={t('profileCompletion.fullName')}
                value={fullName}
                onChangeText={setFullName}
                leftIcon="person.fill"
                autoCapitalize="words"
                textContentType="name"
                containerStyle={{ marginBottom: spacing[4] }}
              />

              <Input
                placeholder={t('profileCompletion.email')}
                value={email}
                onChangeText={setEmail}
                leftIcon="mail"
                keyboardType="email-address"
                autoCapitalize="none"
                textContentType="emailAddress"
                autoComplete="email"
                containerStyle={{ marginBottom: spacing[2] }}
              />

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

              <Button
                title={t('profileCompletion.continue')}
                onPress={handleContinue}
                isLoading={isLoading}
                disabled={!fullName.trim() || isLoading}
                style={{ marginTop: spacing[4] }}
              />
            </View>
          </View>

          <Pressable
            onPress={handleSkip}
            style={skipContainerStyle}
            disabled={isLoading}
            accessibilityRole="button"
            accessibilityLabel={t('profileCompletion.skipA11y')}
          >
            {({ pressed }) => (
              <View
                style={{
                  paddingVertical: spacing[2],
                  paddingHorizontal: spacing[2],
                  backgroundColor: pressed
                    ? colorWithOpacity(m3.colorScheme.onSurface, m3.stateLayerOpacity.pressed)
                    : 'transparent',
                  borderRadius: m3.shape.cornerMedium,
                }}
              >
                <Text style={skipTextStyle}>{t('profileCompletion.skip')}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
