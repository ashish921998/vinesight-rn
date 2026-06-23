import React, { useState } from 'react';
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
import { spacing, componentRadius, fontSize, fontWeight } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { useIsDark, useM3 } from '@/styles/use-theme';

const MIN_PASSWORD_LENGTH = 6;

export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const m3 = useM3();
  const isDark = useIsDark();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);

  const { isLoading, errorMessage, updatePassword, clearError } = useAuthStore();

  const handleUpdate = async () => {
    setLocalError(null);

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setLocalError(t('authResetPassword.tooShort'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setLocalError(t('authResetPassword.mismatch'));
      return;
    }

    clearError();
    await updatePassword(newPassword);

    if (!useAuthStore.getState().errorMessage) {
      setSucceeded(true);
    }
  };

  const handleContinue = () => {
    router.replace('/');
  };

  const displayedError = localError || errorMessage;

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
    borderRadius: componentRadius.avatar,
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

  const errorContainerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: componentRadius.sheet,
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

  if (succeeded) {
    return (
      <View style={[containerStyle, { justifyContent: 'center', paddingHorizontal: spacing[8] }]}>
        <View style={headerContainerStyle}>
          <View style={iconContainerStyle}>
            <UiSymbol name="checkmark.circle.fill" size={40} color={m3.colorScheme.primary} />
          </View>
          <Text style={titleTextStyle}>{t('authResetPassword.successTitle')}</Text>
          <Text style={subtitleTextStyle}>{t('authResetPassword.successSubtitle')}</Text>
        </View>
        <Button title={t('authResetPassword.continueButton')} onPress={handleContinue} />
      </View>
    );
  }

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
        <View style={headerContainerStyle}>
          <View style={iconContainerStyle}>
            <UiSymbol name="lock.fill" size={40} color={m3.colorScheme.primary} />
          </View>
          <Text style={titleTextStyle}>{t('authResetPassword.title')}</Text>
          <Text style={subtitleTextStyle}>{t('authResetPassword.subtitle')}</Text>
        </View>

        <Input
          placeholder={t('authResetPassword.newPassword')}
          value={newPassword}
          onChangeText={setNewPassword}
          leftIcon="lock.fill"
          isPassword
          textContentType="newPassword"
          autoComplete="password-new"
          editable={!isLoading}
          containerStyle={{ marginBottom: spacing[4] }}
        />

        <Input
          placeholder={t('authResetPassword.confirmPassword')}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          leftIcon="lock.fill"
          isPassword
          textContentType="newPassword"
          autoComplete="password-new"
          editable={!isLoading}
          onSubmitEditing={handleUpdate}
          returnKeyType="done"
        />

        {displayedError && (
          <View style={errorContainerStyle}>
            <UiSymbol name="exclamationmark.circle.fill" size={18} color={m3.colorScheme.error} />
            <Text style={errorTextStyle}>{displayedError}</Text>
          </View>
        )}

        <Button
          title={isLoading ? t('authResetPassword.updating') : t('authResetPassword.updateButton')}
          onPress={handleUpdate}
          isLoading={isLoading}
          disabled={!newPassword || !confirmPassword || isLoading}
          style={{ marginTop: spacing[6] }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
