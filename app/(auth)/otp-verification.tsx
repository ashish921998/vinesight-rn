import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores';
import { Button, OTPInput } from '@/components/ui';

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

  if (!email) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <Text className="text-surface-500">Invalid email</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white px-8">
      {/* Header */}
      <View className="items-center mt-20 mb-8">
        <View className="w-20 h-20 rounded-full bg-primary-100 items-center justify-center mb-6">
          <Ionicons name="shield-checkmark" size={40} color="#408059" />
        </View>

        <Text className="text-2xl font-bold text-surface-900 text-center">
          Enter Verification Code
        </Text>

        <Text className="text-base text-surface-500 text-center mt-3">
          We sent a 6-digit code to
        </Text>

        <View className="bg-surface-100 px-4 py-2 rounded-lg mt-2">
          <Text className="text-base font-semibold text-surface-900">{email}</Text>
        </View>
      </View>

      {/* OTP Input */}
      <View className="mt-8">
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
        className="mt-8"
      />

      {/* Resend & Back */}
      <View className="items-center mt-8 space-y-3">
        <TouchableOpacity
          onPress={handleResend}
          disabled={resendCooldown > 0 || isLoading}
          className="py-2"
        >
          {resendCooldown > 0 ? (
            <Text className="text-sm text-surface-400">Resend code in {resendCooldown}s</Text>
          ) : (
            <Text className="text-sm text-primary-600 font-medium">Resend Code</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={handleBack} disabled={isLoading} className="py-2 mt-2">
          <Text className="text-sm text-surface-500">Use Different Email</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
