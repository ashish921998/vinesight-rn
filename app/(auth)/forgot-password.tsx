import React, { useEffect, useState } from 'react';
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
import { router, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '@/stores';
import { Button, Input } from '@/components/ui';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
import { useTranslation } from 'react-i18next';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { useIsDark, useM3 } from '@/styles/use-theme';

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const m3 = useM3();
  const isDark = useIsDark();

  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(typeof emailParam === 'string' ? emailParam : '');

  const {
    isLoading,
    errorMessage,
    passwordResetEmailSent,
    resetPasswordForEmail,
    clearPasswordResetState,
    clearError,
  } = useAuthStore();

  // Clear any stale reset/error state on mount and when leaving the screen.
  useEffect(() => {
    clearPasswordResetState();
    return () => clearPasswordResetState();
  }, [clearPasswordResetState]);

  const handleSend = async () => {
    if (!email.trim()) return;
    clearError();
    await resetPasswordForEmail(email);
  };

  const handleBack = () => {
    clearPasswordResetState();
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(auth)/login');
  };

  const containerStyle: ViewStyle = {
    flex: 1,
    backgroundColor: m3.colorScheme.surface,
  };

  const contentContainerStyle: ViewStyle = {
    flexGrow: 1,
    paddingHorizontal: spacing[8],
    paddingTop: spacing[16],
    paddingBottom: spacing[8],
  };

  const headerContainerStyle: ViewStyle = {
    alignItems: 'center',
    marginTop: spacing[8],
    marginBottom: spacing[10],
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

  const emailBadgeStyle: ViewStyle = {
    backgroundColor: m3.surface.surfaceContainerHigh,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.lg,
    marginTop: spacing[3],
    borderWidth: 1,
    borderColor: m3.colorScheme.outlineVariant,
  };

  const emailTextStyle: TextStyle = {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: m3.colorScheme.onSurface,
  };

  const hintTextStyle: TextStyle = {
    fontSize: fontSize.sm,
    color: m3.colorScheme.onSurfaceVariant,
    textAlign: 'center',
    marginTop: spacing[4],
    lineHeight: fontSize.sm * 1.5,
  };

  const errorContainerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.xl,
    marginTop: spacing[4],
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

  const backButtonWrapperStyle: ViewStyle = {
    alignSelf: 'center',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    marginTop: spacing[6],
  };

  const backButtonTextStyle: TextStyle = {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: m3.colorScheme.primary,
  };

  const renderBackButton = () => (
    <Pressable
      onPress={handleBack}
      disabled={isLoading}
      style={({ pressed }) => [
        backButtonWrapperStyle,
        {
          backgroundColor: pressed
            ? colorWithOpacity(m3.colorScheme.onSurface, m3.stateLayerOpacity.pressed)
            : 'transparent',
          borderRadius: m3.shape.cornerMedium,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={t('authForgotPassword.a11y.back')}
    >
      <Text style={backButtonTextStyle}>{t('authForgotPassword.backToSignIn')}</Text>
    </Pressable>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={containerStyle}
    >
      <ScrollView
        contentContainerStyle={contentContainerStyle}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {passwordResetEmailSent ? (
          <>
            <View style={headerContainerStyle}>
              <View style={iconContainerStyle}>
                <UiSymbol name="envelope.fill" size={40} color={m3.colorScheme.primary} />
              </View>
              <Text style={titleTextStyle}>{t('authForgotPassword.sentTitle')}</Text>
              <Text style={subtitleTextStyle}>{t('authForgotPassword.sentSubtitle')}</Text>
              <View style={emailBadgeStyle}>
                <Text style={emailTextStyle}>{email.trim()}</Text>
              </View>
              <Text style={hintTextStyle}>{t('authForgotPassword.sentHint')}</Text>
            </View>

            <Button
              title={isLoading ? t('authForgotPassword.sending') : t('authForgotPassword.resend')}
              variant="outline"
              onPress={handleSend}
              isLoading={isLoading}
              disabled={isLoading}
            />

            {renderBackButton()}
          </>
        ) : (
          <>
            <View style={headerContainerStyle}>
              <View style={iconContainerStyle}>
                <UiSymbol name="lock.fill" size={40} color={m3.colorScheme.primary} />
              </View>
              <Text style={titleTextStyle}>{t('authForgotPassword.title')}</Text>
              <Text style={subtitleTextStyle}>{t('authForgotPassword.subtitle')}</Text>
            </View>

            <Input
              placeholder={t('authForgotPassword.email')}
              value={email}
              onChangeText={setEmail}
              leftIcon="mail"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="emailAddress"
              autoComplete="email"
              editable={!isLoading}
              onSubmitEditing={handleSend}
              returnKeyType="send"
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
              title={
                isLoading ? t('authForgotPassword.sending') : t('authForgotPassword.sendButton')
              }
              onPress={handleSend}
              isLoading={isLoading}
              disabled={!email.trim() || isLoading}
              style={{ marginTop: spacing[6] }}
            />

            {renderBackButton()}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
