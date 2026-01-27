import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useAuthStore } from '@/stores';
import { Button, OTPInput } from '@/components/ui';
import { Symbol } from '@/components/ui/symbol';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';

const RESEND_COOLDOWN = 60; // seconds

export default function OTPVerificationScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const [otpCode, setOtpCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN);

  const {
    isLoading,
    errorMessage,
    isAuthenticated,
    otpSentSuccessfully,
    verifyOTP,
    resendOTP,
    cancelOTPFlow,
    clearError,
  } = useAuthStore();

  const lastOtpSentSuccessRef = useRef(otpSentSuccessfully);
  const verificationTriggeredRef = useRef(false);

  // Redirect when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated]);

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
    if (!email || otpCode.length !== 6) return;
    clearError();
    await verifyOTP(email, otpCode);

    // Clear code on error
    if (useAuthStore.getState().errorMessage) {
      setOtpCode('');
    }
  }, [email, otpCode, verifyOTP, clearError]);

  // Stable verify function that doesn't change on every render
  const verifyRef = useRef(handleVerify);
  useEffect(() => {
    verifyRef.current = handleVerify;
  }, [handleVerify]);

  // Auto-submit when 6 digits entered
  useEffect(() => {
    if (otpCode.length === 6 && email && !isLoading && !verificationTriggeredRef.current) {
      verificationTriggeredRef.current = true;
      verifyRef.current();
    } else if (otpCode.length !== 6) {
      verificationTriggeredRef.current = false;
    }
  }, [otpCode, email, isLoading]);

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    await resendOTP();
  };

  const handleBack = () => {
    cancelOTPFlow();
    router.back();
  };

  const containerStyle: ViewStyle = {
    flex: 1,
    backgroundColor: colors.surface[100],
    paddingHorizontal: spacing[8],
  };

  const errorContainerStyle: ViewStyle = {
    flex: 1,
    backgroundColor: colors.surface[100],
    alignItems: 'center',
    justifyContent: 'center',
  };

  const errorTextStyle: TextStyle = {
    color: colors.surface[500],
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
    backgroundColor: colors.primary[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[6],
  };

  const titleTextStyle: TextStyle = {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.surface[900],
    textAlign: 'center',
  };

  const subtitleTextStyle: TextStyle = {
    fontSize: fontSize.base,
    color: colors.surface[500],
    textAlign: 'center',
    marginTop: spacing[3],
  };

  const emailBadgeStyle: ViewStyle = {
    backgroundColor: colors.surface[100],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.lg,
    marginTop: spacing[2],
  };

  const emailTextStyle: TextStyle = {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.surface[900],
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
    color: colors.surface[400],
  };

  const resendEnabledTextStyle: TextStyle = {
    fontSize: fontSize.sm,
    color: colors.primary[600],
    fontWeight: fontWeight.medium,
  };

  const backButtonTextStyle: TextStyle = {
    fontSize: fontSize.sm,
    color: colors.surface[500],
  };

  const backButtonWrapperStyle: ViewStyle = {
    paddingVertical: spacing[2],
    marginTop: spacing[2],
  };

  if (!email) {
    return (
      <View style={errorContainerStyle}>
        <Text style={errorTextStyle}>Invalid email</Text>
      </View>
    );
  }

  return (
    <View style={containerStyle}>
      {/* Header */}
      <View style={headerContainerStyle}>
        <View style={iconContainerStyle}>
          <Symbol name="checkmark.shield.fill" size={40} color={colors.primary[500]} />
        </View>

        <Text style={titleTextStyle}>Enter Verification Code</Text>

        <Text style={subtitleTextStyle}>We sent a 6-digit code to</Text>

        <View style={emailBadgeStyle}>
          <Text style={emailTextStyle}>{email}</Text>
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
        title="Verify"
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
          style={buttonWrapperStyle}
        >
          {resendCooldown > 0 ? (
            <Text style={resendDisabledTextStyle}>Resend code in {resendCooldown}s</Text>
          ) : (
            <Text style={resendEnabledTextStyle}>Resend Code</Text>
          )}
        </Pressable>

        <Pressable onPress={handleBack} disabled={isLoading} style={backButtonWrapperStyle}>
          <Text style={backButtonTextStyle}>Use Different Email</Text>
        </Pressable>
      </View>
    </View>
  );
}
