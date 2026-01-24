import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Image,
  ImageSourcePropType,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores';
import { Button, Input } from '@/components/ui';
import playstoreLogo from '../../assets/playstore.png';

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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1 px-8 pt-16 pb-8">
          {/* Logo & Title */}
          <View className="items-center mt-8 mb-12">
            <View
              className="w-28 h-28 rounded-3xl items-center justify-center mb-4"
              style={{ backgroundColor: 'rgba(64, 128, 89, 0.1)' }}
            >
              <Image
                source={playstoreLogo as ImageSourcePropType}
                style={{ width: 80, height: 80 }}
                resizeMode="contain"
              />
            </View>
            <Text className="text-3xl font-bold" style={{ color: '#000000' }}>
              Vinesight
            </Text>
            <Text className="text-base mt-1" style={{ color: '#8e8e93' }}>
              Farm Management
            </Text>
          </View>

          {/* Form */}
          <View className="flex-1 justify-center">
            <View className="space-y-4">
              {isSignUp && (
                <Input
                  placeholder="Full Name"
                  value={name}
                  onChangeText={setName}
                  leftIcon="person-outline"
                  autoCapitalize="words"
                  textContentType="name"
                  containerClassName="mb-4"
                />
              )}

              <Input
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                leftIcon="mail-outline"
                keyboardType="email-address"
                autoCapitalize="none"
                textContentType="emailAddress"
                autoComplete="email"
                containerClassName="mb-4"
              />

              <Input
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                leftIcon="lock-closed-outline"
                isPassword
                textContentType={isSignUp ? 'newPassword' : 'password'}
                autoComplete={isSignUp ? 'password-new' : 'password'}
                containerClassName="mb-2"
              />

              {/* Error Message */}
              {errorMessage && (
                <View
                  className="flex-row items-center px-4 py-3 rounded-xl mb-2"
                  style={{ backgroundColor: 'rgba(255, 59, 48, 0.1)' }}
                >
                  <Ionicons name="alert-circle" size={18} color="#ff3b30" />
                  <Text className="text-sm ml-2 flex-1" style={{ color: '#ff3b30' }}>
                    {errorMessage}
                  </Text>
                </View>
              )}

              {/* Submit Button */}
              <Button
                title={isSignUp ? 'Sign Up' : 'Sign In'}
                onPress={handleAuth}
                isLoading={isLoading}
                disabled={!isFormValid || isLoading}
                className="mt-4"
              />
            </View>

            {/* Divider */}
            <View className="flex-row items-center my-8">
              <View className="flex-1 h-px" style={{ backgroundColor: '#e5e5ea' }} />
              <Text className="text-sm mx-4" style={{ color: '#c7c7cc' }}>
                or
              </Text>
              <View className="flex-1 h-px" style={{ backgroundColor: '#e5e5ea' }} />
            </View>

            {/* Google Sign In */}
            <Button
              title="Continue with Google"
              variant="outline"
              leftIcon={<Ionicons name="logo-google" size={20} color="#408059" />}
              onPress={signInWithGoogle}
              disabled={isLoading}
            />
          </View>

          {/* Toggle Sign Up/Sign In */}
          <TouchableOpacity
            onPress={toggleMode}
            className="items-center py-4 mt-4"
            disabled={isLoading}
          >
            <Text className="text-sm" style={{ color: '#8e8e93' }}>
              {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
              <Text className="font-semibold" style={{ color: '#408059' }}>
                {isSignUp ? 'Sign In' : 'Sign Up'}
              </Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
