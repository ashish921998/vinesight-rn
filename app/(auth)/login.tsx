import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  ScrollView,
  Pressable,
  Image,
  ImageSourcePropType,
  StyleSheet,
  Platform,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '@/stores';
import { Button, Input } from '@/components/ui';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
import { useTranslation } from 'react-i18next';
import appLogo from '../../assets/icons/ios-light.png';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';

export default function LoginScreen() {
  const { t } = useTranslation();
  const m3 = useM3();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  const {
    isLoading,
    errorMessage,
    pendingOTPEmail,
    signIn,
    signUpWithOTP,
    clearError,
    isAuthenticated,
    signInWithApple,
    signInWithGoogle,
  } = useAuthStore();

  // Navigate to OTP screen when pending
  useEffect(() => {
    if (pendingOTPEmail) {
      router.push({
        pathname: '/(auth)/otp-verification',
        params: { email: pendingOTPEmail },
      });
    }
  }, [pendingOTPEmail]);

  // Navigate to main app when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated]);

  const handleAuth = async () => {
    if (!email || !password) return;
    if (isSignUp && !name) return;

    clearError();

    if (isSignUp) {
      await signUpWithOTP(email, password, name);
    } else {
      await signIn(email, password);
    }
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    clearError();
    setName('');
  };

  const isFormValid = email && password && (!isSignUp || name);

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
    width: 112,
    height: 112,
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

  const toggleContainerStyle: ViewStyle = {
    alignItems: 'center',
    paddingVertical: spacing[4],
    marginTop: spacing[4],
  };

  const toggleTextStyle: TextStyle = {
    fontSize: fontSize.sm,
    color: m3.colorScheme.onSurfaceVariant,
  };

  const toggleLinkStyle: TextStyle = {
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
          {/* Logo & Title */}
          <View style={logoContainerStyle}>
            <View style={logoBoxStyle}>
              <Image
                source={appLogo as ImageSourcePropType}
                style={{ width: 88, height: 88 }}
                resizeMode="contain"
              />
            </View>
            <Text style={titleTextStyle}>Vinesight</Text>
            <Text style={subtitleTextStyle}>{t('auth.subtitle')}</Text>
          </View>

          {/* Form */}
          <View style={formContainerStyle}>
            <View style={formInnerStyle}>
              {isSignUp && (
                <Input
                  placeholder={t('auth.fullName')}
                  value={name}
                  onChangeText={setName}
                  leftIcon="person.fill"
                  autoCapitalize="words"
                  textContentType="name"
                  containerStyle={{ marginBottom: spacing[4] }}
                />
              )}

              <Input
                placeholder={t('auth.email')}
                value={email}
                onChangeText={setEmail}
                leftIcon="mail"
                keyboardType="email-address"
                autoCapitalize="none"
                textContentType="emailAddress"
                autoComplete="email"
                containerStyle={{ marginBottom: spacing[4] }}
              />

              <Input
                placeholder={t('auth.password')}
                value={password}
                onChangeText={setPassword}
                leftIcon="lock.fill"
                isPassword
                textContentType={isSignUp ? 'newPassword' : 'password'}
                autoComplete={isSignUp ? 'password-new' : 'password'}
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

              {/* Submit Button */}
              <Button
                title={isSignUp ? t('auth.signUp') : t('auth.signIn')}
                onPress={handleAuth}
                isLoading={isLoading}
                disabled={!isFormValid || isLoading}
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
              style={{ marginBottom: spacing[3] }}
            />

            {/* Phone Sign In */}
            <Button
              title={t('auth.continueWithPhone')}
              variant="outline"
              leftIcon={<UiSymbol name="phone.fill" size={20} color={m3.colorScheme.primary} />}
              onPress={() =>
                router.push({
                  pathname: '/(auth)/phone-login',
                  params: { mode: isSignUp ? 'signup' : 'signin' },
                })
              }
              disabled={isLoading}
            />
          </View>

          {/* Toggle Sign Up/Sign In */}
          <Pressable
            onPress={toggleMode}
            style={toggleContainerStyle}
            disabled={isLoading}
            accessibilityRole="button"
            accessibilityLabel={
              isSignUp ? t('auth.a11y.switchToSignIn') : t('auth.a11y.switchToSignUp')
            }
          >
            {({ pressed }) => (
              <View style={{ paddingVertical: spacing[2], paddingHorizontal: spacing[2] }}>
                <Text style={toggleTextStyle}>
                  {isSignUp ? t('auth.alreadyHaveAccount') : t('auth.dontHaveAccount')}{' '}
                  <Text style={toggleLinkStyle}>
                    {isSignUp ? t('auth.signIn') : t('auth.signUp')}
                  </Text>
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
    </KeyboardAvoidingView>
  );
}
