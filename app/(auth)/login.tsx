import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  ScrollView,
  Pressable,
  Image,
  ImageSourcePropType,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '@/stores';
import { Button, Input } from '@/components/ui';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
import playstoreLogo from '../../assets/playstore.png';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';

export default function LoginScreen() {
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
    backgroundColor: colors.surface[100],
  };

  const contentContainerStyle: ViewStyle = {
    flex: 1,
    paddingHorizontal: spacing[8],
    paddingTop: 64,
    paddingBottom: spacing[8],
  };

  const logoContainerStyle: ViewStyle = {
    alignItems: 'center',
    marginTop: spacing[8],
    marginBottom: 48,
  };

  const logoBoxStyle: ViewStyle = {
    width: 112,
    height: 112,
    borderRadius: borderRadius['3xl'],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
    backgroundColor: 'rgba(64, 128, 89, 0.1)',
  };

  const titleTextStyle: TextStyle = {
    fontSize: fontSize['3xl'],
    fontWeight: fontWeight.bold,
    color: '#000000',
  };

  const subtitleTextStyle: TextStyle = {
    fontSize: fontSize.base,
    marginTop: spacing[1],
    color: colors.surface[500],
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
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
  };

  const errorTextStyle: TextStyle = {
    fontSize: fontSize.sm,
    marginLeft: spacing[2],
    flex: 1,
    color: colors.error,
  };

  const dividerContainerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing[8],
  };

  const dividerLineStyle: ViewStyle = {
    flex: 1,
    height: 1,
    backgroundColor: colors.surface[300],
  };

  const dividerTextStyle: TextStyle = {
    fontSize: fontSize.sm,
    marginHorizontal: spacing[4],
    color: colors.surface[400],
  };

  const toggleContainerStyle: ViewStyle = {
    alignItems: 'center',
    paddingVertical: spacing[4],
    marginTop: spacing[4],
  };

  const toggleTextStyle: TextStyle = {
    fontSize: fontSize.sm,
    color: colors.surface[500],
  };

  const toggleLinkStyle: TextStyle = {
    fontWeight: fontWeight.semibold,
    color: colors.primary[500],
  };

  return (
    <KeyboardAvoidingView
      behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'}
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
                source={playstoreLogo as ImageSourcePropType}
                style={{ width: 80, height: 80 }}
                resizeMode="contain"
              />
            </View>
            <Text style={titleTextStyle}>Vinesight</Text>
            <Text style={subtitleTextStyle}>Farm Management</Text>
          </View>

          {/* Form */}
          <View style={formContainerStyle}>
            <View style={formInnerStyle}>
              {isSignUp && (
                <Input
                  placeholder="Full Name"
                  value={name}
                  onChangeText={setName}
                  leftIcon="person.fill"
                  autoCapitalize="words"
                  textContentType="name"
                  containerStyle={{ marginBottom: spacing[4] }}
                />
              )}

              <Input
                placeholder="Email"
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
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                leftIcon="lock-closed"
                isPassword
                textContentType={isSignUp ? 'newPassword' : 'password'}
                autoComplete={isSignUp ? 'password-new' : 'password'}
                containerStyle={{ marginBottom: spacing[2] }}
              />

              {/* Error Message */}
              {errorMessage && (
                <View style={errorContainerStyle}>
                  <UiSymbol name="exclamationmark.circle.fill" size={18} color={colors.error} />
                  <Text style={errorTextStyle}>{errorMessage}</Text>
                </View>
              )}

              {/* Submit Button */}
              <Button
                title={isSignUp ? 'Sign Up' : 'Sign In'}
                onPress={handleAuth}
                isLoading={isLoading}
                disabled={!isFormValid || isLoading}
                style={{ marginTop: spacing[4] }}
              />
            </View>

            {/* Divider */}
            <View style={dividerContainerStyle}>
              <View style={dividerLineStyle} />
              <Text style={dividerTextStyle}>or</Text>
              <View style={dividerLineStyle} />
            </View>

            {/* Google Sign In */}
            <Button
              title="Continue with Google"
              variant="outline"
              leftIcon={<UiSymbol name="g.circle.fill" size={20} color={colors.primary[500]} />}
              onPress={signInWithGoogle}
              disabled={isLoading}
            />
          </View>

          {/* Toggle Sign Up/Sign In */}
          <Pressable onPress={toggleMode} style={toggleContainerStyle} disabled={isLoading}>
            <Text style={toggleTextStyle}>
              {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
              <Text style={toggleLinkStyle}>{isSignUp ? 'Sign In' : 'Sign Up'}</Text>
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
