import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import { useLocalSearchParams, router, type Href } from 'expo-router';
import { useAuthStore } from '@/stores';
import { Button, OTPInput } from '@/components/ui';
import { Symbol as IconSymbol } from '@/components/ui/symbol';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { useIsDark, useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '@/i18n/format';
import {
  isAndroidSmsRetrieverSupported,
  startAndroidSmsRetriever,
  stopAndroidSmsRetriever,
} from '@/services/android-sms-retriever';

const RESEND_COOLDOWN = 60; // seconds

type OTPRouteParams = {
  email?: string;
  phone?: string;
  channel?: string;
  mode?: string;
  redirect?: string;
};

export default function OTPVerificationScreen() {
  const { t } = useTranslation();
  const m3 = useM3();
  const isDark = useIsDark();

  const { email, phone, channel, mode, redirect } = useLocalSearchParams<OTPRouteParams>();
  const redirectPath = useMemo(() => {
    if (typeof redirect === 'string' && redirect.startsWith('/')) return redirect;
    return '/';
  }, [redirect]);
  const phoneAuthMode = mode === 'signup' ? 'signup' : 'signin';
  const isPhoneOTP = channel === 'phone' && !!phone;
  const identifier = isPhoneOTP ? phone : email;
  const [otpCode, setOtpCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN);
  const [otpFocusKey, setOtpFocusKey] = useState(0);

  const isLoading = useAuthStore((s) => s.isLoading);
  const errorMessage = useAuthStore((s) => s.errorMessage);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const otpSentSuccessfully = useAuthStore((s) => s.otpSentSuccessfully);
  const needsProfileCompletion = useAuthStore((s) => s.needsProfileCompletion);
  const verifyOTP = useAuthStore((s) => s.verifyOTP);
  const verifyPhoneOTP = useAuthStore((s) => s.verifyPhoneOTP);
  const resendOTP = useAuthStore((s) => s.resendOTP);
  const resendPhoneOTP = useAuthStore((s) => s.resendPhoneOTP);
  const cancelOTPFlow = useAuthStore((s) => s.cancelOTPFlow);
  const cancelPhoneOTPFlow = useAuthStore((s) => s.cancelPhoneOTPFlow);
  const clearError = useAuthStore((s) => s.clearError);

  const lastOtpSentSuccessRef = useRef(otpSentSuccessfully);
  const verificationTriggeredRef = useRef(false);
  const smsRetrieverAttemptRef = useRef(0);
  const smsRetrieverTransitionRef = useRef<Promise<void>>(Promise.resolve());

  // Redirect when authenticated
  useEffect(() => {
    if (isAuthenticated && needsProfileCompletion) {
      router.replace('/(auth)/profile-completion');
    } else if (isAuthenticated) {
      router.replace(redirectPath as Href);
    }
  }, [isAuthenticated, needsProfileCompletion, redirectPath]);

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
      setOtpFocusKey((current) => current + 1);
    }
    lastOtpSentSuccessRef.current = otpSentSuccessfully;
  }, [otpSentSuccessfully]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!errorMessage) return;
    const timeoutId = setTimeout(() => {
      setOtpFocusKey((current) => current + 1);
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [errorMessage]);

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

  useEffect(() => {
    if (!isPhoneOTP) return;

    const stopSmsRetrieverNow = (invalidateAttempt = true): Promise<void> => {
      if (invalidateAttempt) {
        // Invalidate any in-flight start attempt immediately so stale
        // completions are ignored even if the native start promise resolves
        // later.
        smsRetrieverAttemptRef.current += 1;
      }
      const stopPromise = stopAndroidSmsRetriever();
      smsRetrieverTransitionRef.current = stopPromise.then(
        () => undefined,
        () => undefined,
      );
      return stopPromise;
    };

    const queueSmsRetrieverStart = (): Promise<string | null> => {
      const nextStart = smsRetrieverTransitionRef.current.then(
        () => startAndroidSmsRetriever(),
        () => startAndroidSmsRetriever(),
      );
      smsRetrieverTransitionRef.current = nextStart.then(
        () => undefined,
        () => undefined,
      );
      return nextStart;
    };

    // When verification is in flight, stop any active listener so a late SMS
    // can't overwrite the code or trigger a focus/state change mid-request.
    if (isLoading) {
      void stopSmsRetrieverNow();
      return () => {
        void stopSmsRetrieverNow();
      };
    }

    let isCancelled = false;
    smsRetrieverAttemptRef.current += 1;
    const attemptId = smsRetrieverAttemptRef.current;

    const startListener = async () => {
      const isSupported = await isAndroidSmsRetrieverSupported();
      if (!isSupported || isCancelled) return;

      await stopSmsRetrieverNow(false);
      if (isCancelled || smsRetrieverAttemptRef.current !== attemptId) return;

      const detectedCode = await queueSmsRetrieverStart();
      if (
        isCancelled ||
        smsRetrieverAttemptRef.current !== attemptId ||
        !detectedCode ||
        !/^\d{6}$/.test(detectedCode)
      ) {
        return;
      }

      setOtpCode(detectedCode);
      setOtpFocusKey((current) => current + 1);
    };

    void startListener();

    return () => {
      isCancelled = true;
      void stopSmsRetrieverNow();
    };
  }, [isPhoneOTP, isLoading, otpSentSuccessfully]);

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    if (isPhoneOTP) {
      await resendPhoneOTP(phoneAuthMode, identifier);
    } else {
      await resendOTP();
    }
    setOtpFocusKey((current) => current + 1);
  };

  const handleBack = () => {
    if (isPhoneOTP) {
      void stopAndroidSmsRetriever();
      cancelPhoneOTPFlow();
      router.replace({
        pathname: '/(auth)/phone-login',
        params: { mode: phoneAuthMode, redirect: redirectPath },
      });
      return;
    } else {
      cancelOTPFlow();
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(auth)/login');
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
          focusKey={otpFocusKey}
        />
      </View>

      {/* Verify Button */}
      <Button
        title={isLoading ? t('authOtp.verifying') : t('authOtp.verify')}
        onPress={handleVerify}
        isLoading={isLoading}
        disabled={otpCode.length !== 6}
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
