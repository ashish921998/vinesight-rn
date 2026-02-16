import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useAuthStore } from '@/stores';
import { Button, OTPInput } from '@/components/ui';
import { Symbol as IconSymbol } from '@/components/ui/symbol';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { useIsDark, useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '@/i18n/format';

const RESEND_COOLDOWN = 60; // seconds

type OTPRouteParams = {
  email?: string;
  phone?: string;
  channel?: string;
  mode?: string;
};

export default function OTPVerificationScreen() {
  const { t } = useTranslation();
  const m3 = useM3();
  const isDark = useIsDark();

  const { email, phone, channel, mode } = useLocalSearchParams<OTPRouteParams>();
  const phoneAuthMode = mode === 'signup' ? 'signup' : 'signin';
  const isPhoneOTP = channel === 'phone' && !!phone;
  const identifier = isPhoneOTP ? phone : email;
  const [otpCode, setOtpCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN);

  const {
    isLoading,
    errorMessage,
    isAuthenticated,
    otpSentSuccessfully,
    needsProfileCompletion,
    verifyOTP,
    verifyPhoneOTP,
    resendOTP,
    resendPhoneOTP,
    cancelOTPFlow,
    cancelPhoneOTPFlow,
    clearError,
  } = useAuthStore();

  const lastOtpSentSuccessRef = useRef(otpSentSuccessfully);
  const verificationTriggeredRef = useRef(false);

  // Redirect when authenticated
  useEffect(() => {
    if (isAuthenticated && needsProfileCompletion) {
      router.replace('/(auth)/profile-completion');
    } else if (isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, needsProfileCompletion]);

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;

    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Reset cooldown when OTP sent successfully
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (otpSentSuccessfully && !lastOtpSentSuccessRef.current) {
      setResendCooldown(RESEND_COOLDOWN);
    }
    lastOtpSentSuccessRef.current = otpSentSuccessfully;
  }, [otpSentSuccessfully]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleVerify = useCallback(async () => {
    if (!identifier || otpCode.length !== 6) return;
    clearError();
    if (isPhoneOTP) {
      await verifyPhoneOTP(identifier, otpCode);
    } else {
      await verifyOTP(identifier, otpCode);
    }
    if (useAuthStore.getState().errorMessage) {
      setOtpCode('');
    }
  }, [identifier, otpCode, isPhoneOTP, verifyOTP, verifyPhoneOTP, clearError]);

  // Stable verify function that doesn't change on every render
  const verifyRef = useRef(handleVerify);
  useEffect(() => {
    verifyRef.current = handleVerify;
  }, [handleVerify]);

  // Auto-submit when 6 digits entered
  useEffect(() => {
    if (otpCode.length === 6 && identifier && !isLoading && !verificationTriggeredRef.current) {
      verificationTriggeredRef.current = true;
      verifyRef.current();
    } else if (otpCode.length !== 6) {
      verificationTriggeredRef.current = false;
    }
  }, [otpCode, identifier, isLoading]);

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    if (isPhoneOTP) {
      await resendPhoneOTP(phoneAuthMode, identifier);
    } else {
      await resendOTP();
    }
  };

  const handleBack = () => {
    if (isPhoneOTP) {
      cancelPhoneOTPFlow();
    } else {
      cancelOTPFlow();
    }
    router.back();
  };

  const containerStyle: ViewStyle = {
    flex: 1,
    backgroundColor: m3.colorScheme.surface,
    paddingHorizontal: spacing[8],
  };

  const errorContainerStyle: ViewStyle = {
    flex: 1,
    backgroundColor: m3.colorScheme.surface,
    alignItems: 'center',
    justifyContent: 'center',
  };

  const errorTextStyle: TextStyle = {
    color: m3.colorScheme.onSurfaceVariant,
  };

  const headerContainerStyle: ViewStyle = {
    alignItems: 'center',
    marginTop: 80,
    marginBottom: spacing[8],
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
    marginTop: spacing[2],
    borderWidth: 1,
    borderColor: m3.colorScheme.outlineVariant,
  };

  const emailTextStyle: TextStyle = {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: m3.colorScheme.onSurface,
  };

  const otpContainerStyle: ViewStyle = {
    marginTop: spacing[8],
  };

  const actionsContainerStyle: ViewStyle = {
    alignItems: 'center',
    marginTop: spacing[8],
    gap: spacing[3],
  };

  const buttonWrapperStyle: ViewStyle = {
    paddingVertical: spacing[2],
  };

  const resendDisabledTextStyle: TextStyle = {
    fontSize: fontSize.sm,
    color: colorWithOpacity(m3.colorScheme.onSurfaceVariant, isDark ? 0.92 : 0.75),
  };

  const resendEnabledTextStyle: TextStyle = {
    fontSize: fontSize.sm,
    color: m3.colorScheme.primary,
    fontWeight: fontWeight.medium,
  };

  const backButtonTextStyle: TextStyle = {
    fontSize: fontSize.sm,
    color: m3.colorScheme.onSurfaceVariant,
  };

  const backButtonWrapperStyle: ViewStyle = {
    paddingVertical: spacing[2],
    marginTop: spacing[2],
  };

  if (!identifier) {
    const invalidMessage =
      channel === 'phone' ? t('authPhone.invalidPhone') : t('authOtp.invalidEmail');
    return (
      <View style={errorContainerStyle}>
        <Text style={errorTextStyle}>{invalidMessage}</Text>
      </View>
    );
  }

  return (
    <View style={containerStyle}>
      {/* Header */}
      <View style={headerContainerStyle}>
        <View style={iconContainerStyle}>
          <IconSymbol name="checkmark.shield.fill" size={40} color={m3.colorScheme.primary} />
        </View>

        <Text style={titleTextStyle}>{t('authOtp.title')}</Text>

        <Text style={subtitleTextStyle}>
          {isPhoneOTP ? t('authOtp.subtitlePhone') : t('authOtp.subtitle')}
        </Text>

        <View style={emailBadgeStyle}>
          <Text style={emailTextStyle}>{identifier}</Text>
        </View>
      </View>

      {/* OTP Input */}
      <View style={otpContainerStyle}>
        <OTPInput
          value={otpCode}
          onChange={setOtpCode}
          error={errorMessage || undefined}
          autoFocus
        />
      </View>

      {/* Verify Button */}
      <Button
        title={t('authOtp.verify')}
        onPress={handleVerify}
        isLoading={isLoading}
        disabled={otpCode.length !== 6 || isLoading}
        style={{ marginTop: spacing[8] }}
      />

      {/* Resend & Back */}
      <View style={actionsContainerStyle}>
        <Pressable
          onPress={handleResend}
          disabled={resendCooldown > 0 || isLoading}
          style={({ pressed }) => [
            buttonWrapperStyle,
            {
              backgroundColor: pressed
                ? colorWithOpacity(m3.colorScheme.onSurface, m3.stateLayerOpacity.pressed)
                : 'transparent',
              borderRadius: m3.shape.cornerMedium,
              paddingHorizontal: spacing[2],
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={
            resendCooldown > 0
              ? t('authOtp.resendA11yWithSeconds', { seconds: formatNumber(resendCooldown) })
              : t('authOtp.resendA11y')
          }
        >
          {resendCooldown > 0 ? (
            <Text style={resendDisabledTextStyle}>
              {t('authOtp.resendInSecondsShort', { seconds: formatNumber(resendCooldown) })}
            </Text>
          ) : (
            <Text style={resendEnabledTextStyle}>{t('authOtp.resend')}</Text>
          )}
        </Pressable>

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
              paddingHorizontal: spacing[2],
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={
            isPhoneOTP ? t('authOtp.useDifferentPhoneA11y') : t('authOtp.useDifferentEmailA11y')
          }
        >
          <Text style={backButtonTextStyle}>
            {isPhoneOTP ? t('authOtp.useDifferentPhone') : t('authOtp.useDifferentEmail')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
