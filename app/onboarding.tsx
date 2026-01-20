/**
 * Onboarding Screen
 * Multi-step onboarding flow for new users
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Animated,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useOnboardingStore } from '../src/stores/onboardingStore';
import {
  ONBOARDING_STEPS,
  ONBOARDING_FEATURES,
  COUNTRIES,
} from '../src/types/onboarding';

export default function OnboardingScreen() {
  const {
    currentStep,
    preferences,
    nextStep,
    previousStep,
    setPreferences,
    completeOnboarding,
  } = useOnboardingStore();

  const [selectedCountry, setSelectedCountry] = useState(preferences.country);
  const [selectedAreaUnit, setSelectedAreaUnit] = useState(preferences.areaUnit);
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  const currentIndex = ONBOARDING_STEPS.indexOf(currentStep);
  const isFirstStep = currentIndex === 0;
  const isLastStep = currentIndex === ONBOARDING_STEPS.length - 1;

  const handleNext = async () => {
    if (currentStep === 'preferences') {
      setPreferences({
        country: selectedCountry,
        areaUnit: selectedAreaUnit,
      });
    }

    if (currentStep === 'notifications') {
      await requestNotificationPermission();
    }

    if (isLastStep) {
      completeOnboarding();
      router.replace('/(tabs)');
    } else {
      nextStep();
    }
  };

  const requestNotificationPermission = async () => {
    try {
      // Dynamically import to avoid breaking in environments (like Expo Go)
      // where full notifications support is not available.
      const Notifications = await import('expo-notifications');

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      setPreferences({ notificationsEnabled: finalStatus === 'granted' });
    } catch (error) {
      console.log('Notifications not available or failed to load:', error);
      // In Expo Go or unsupported environments, just continue without
      // enabling notifications so onboarding can still complete.
      setPreferences({ notificationsEnabled: false });
    }
  };

  const handleSkip = () => {
    completeOnboarding();
    router.replace('/(tabs)');
  };

  const renderProgressIndicator = () => (
    <View className="flex-row justify-center py-4 gap-2">
      {ONBOARDING_STEPS.map((step, index) => (
        <View
          key={step}
          className={`h-1 rounded-full ${
            index <= currentIndex ? 'bg-green-600' : 'bg-gray-300'
          }`}
          style={{ width: index <= currentIndex ? 32 : 24 }}
        />
      ))}
    </View>
  );

  const renderWelcomeStep = () => (
    <View className="flex-1 items-center justify-center px-8">
      <View className="w-32 h-32 rounded-full bg-green-100 items-center justify-center mb-8">
        <Ionicons name="leaf" size={64} color="#1a5d1a" />
      </View>
      <Text className="text-3xl font-bold text-gray-800 text-center mb-3">
        Welcome to Vinesight
      </Text>
      <Text className="text-lg text-gray-500 text-center">
        Your smart farming companion
      </Text>
    </View>
  );

  const renderFeaturesStep = () => (
    <ScrollView
      className="flex-1 px-6"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingVertical: 24 }}
    >
      <Text className="text-2xl font-bold text-gray-800 text-center mb-2">
        How It Works
      </Text>
      <Text className="text-gray-500 text-center mb-6">
        Everything you need to manage your farm
      </Text>

      {ONBOARDING_FEATURES.map((feature, index) => (
        <View
          key={index}
          className="bg-white rounded-2xl p-4 mb-3 flex-row items-center"
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          <View
            className="w-12 h-12 rounded-xl items-center justify-center mr-4"
            style={{ backgroundColor: `${feature.color}15` }}
          >
            <Ionicons
              name={feature.icon as any}
              size={24}
              color={feature.color}
            />
          </View>
          <View className="flex-1">
            <Text className="text-base font-semibold text-gray-800">
              {feature.title}
            </Text>
            <Text className="text-sm text-gray-500 mt-1">
              {feature.description}
            </Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );

  const renderPreferencesStep = () => (
    <ScrollView
      className="flex-1 px-6"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingVertical: 24 }}
    >
      <Text className="text-2xl font-bold text-gray-800 text-center mb-2">
        Farm Preferences
      </Text>
      <Text className="text-gray-500 text-center mb-8">
        Help us customize your experience
      </Text>

      {/* Country Selection */}
      <View className="mb-6">
        <View className="flex-row items-center mb-3">
          <Ionicons name="globe" size={20} color="#1a5d1a" />
          <Text className="text-base font-semibold text-gray-800 ml-2">
            Country
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowCountryPicker(!showCountryPicker)}
          className="bg-white rounded-xl p-4 flex-row items-center justify-between"
        >
          <Text
            className={`text-base ${
              selectedCountry ? 'text-gray-800' : 'text-gray-400'
            }`}
          >
            {selectedCountry || 'Select a country'}
          </Text>
          <Ionicons
            name={showCountryPicker ? 'chevron-up' : 'chevron-down'}
            size={20}
            color="#666"
          />
        </TouchableOpacity>

        {showCountryPicker && (
          <View className="bg-white rounded-xl mt-2 overflow-hidden border border-gray-200">
            {COUNTRIES.map((country) => (
              <TouchableOpacity
                key={country}
                onPress={() => {
                  setSelectedCountry(country);
                  setShowCountryPicker(false);
                }}
                className={`p-4 border-b border-gray-100 ${
                  selectedCountry === country ? 'bg-green-50' : ''
                }`}
              >
                <Text
                  className={`text-base ${
                    selectedCountry === country
                      ? 'text-green-700 font-semibold'
                      : 'text-gray-700'
                  }`}
                >
                  {country}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Area Unit Selection */}
      <View className="mb-6">
        <View className="flex-row items-center mb-3">
          <Ionicons name="resize" size={20} color="#1a5d1a" />
          <Text className="text-base font-semibold text-gray-800 ml-2">
            Area Unit
          </Text>
        </View>
        <View className="flex-row gap-3">
          <TouchableOpacity
            onPress={() => setSelectedAreaUnit('acres')}
            className={`flex-1 p-4 rounded-xl border-2 ${
              selectedAreaUnit === 'acres'
                ? 'border-green-600 bg-green-50'
                : 'border-gray-200 bg-white'
            }`}
          >
            <Text
              className={`text-center font-semibold ${
                selectedAreaUnit === 'acres'
                  ? 'text-green-700'
                  : 'text-gray-600'
              }`}
            >
              Acres
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setSelectedAreaUnit('hectares')}
            className={`flex-1 p-4 rounded-xl border-2 ${
              selectedAreaUnit === 'hectares'
                ? 'border-green-600 bg-green-50'
                : 'border-gray-200 bg-white'
            }`}
          >
            <Text
              className={`text-center font-semibold ${
                selectedAreaUnit === 'hectares'
                  ? 'text-green-700'
                  : 'text-gray-600'
              }`}
            >
              Hectares
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );

  const renderNotificationsStep = () => (
    <View className="flex-1 items-center justify-center px-8">
      <View className="w-24 h-24 rounded-full bg-blue-100 items-center justify-center mb-8">
        <Ionicons name="notifications" size={48} color="#3B82F6" />
      </View>
      <Text className="text-2xl font-bold text-gray-800 text-center mb-3">
        Stay Updated
      </Text>
      <Text className="text-gray-500 text-center mb-6">
        Get reminders for irrigation schedules, task deadlines, and important
        farm alerts.
      </Text>
      <View className="bg-blue-50 p-4 rounded-xl">
        <View className="flex-row items-center mb-2">
          <Ionicons name="water" size={20} color="#3B82F6" />
          <Text className="text-blue-700 ml-2">Irrigation reminders</Text>
        </View>
        <View className="flex-row items-center mb-2">
          <Ionicons name="alarm" size={20} color="#3B82F6" />
          <Text className="text-blue-700 ml-2">Task deadlines</Text>
        </View>
        <View className="flex-row items-center">
          <Ionicons name="warning" size={20} color="#3B82F6" />
          <Text className="text-blue-700 ml-2">Weather alerts</Text>
        </View>
      </View>
    </View>
  );

  const renderCompleteStep = () => (
    <View className="flex-1 items-center justify-center px-8">
      <View className="w-24 h-24 rounded-full bg-green-100 items-center justify-center mb-8">
        <Ionicons name="checkmark-circle" size={64} color="#1a5d1a" />
      </View>
      <Text className="text-2xl font-bold text-gray-800 text-center mb-3">
        You're All Set!
      </Text>
      <Text className="text-gray-500 text-center">
        Start managing your farms with Vinesight. Add your first farm to get
        started.
      </Text>
    </View>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'welcome':
        return renderWelcomeStep();
      case 'features':
        return renderFeaturesStep();
      case 'preferences':
        return renderPreferencesStep();
      case 'notifications':
        return renderNotificationsStep();
      case 'complete':
        return renderCompleteStep();
      default:
        return renderWelcomeStep();
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Progress Indicator */}
      {renderProgressIndicator()}

      {/* Skip Button */}
      {!isLastStep && (
        <TouchableOpacity
          onPress={handleSkip}
          className="absolute right-4 top-12 z-10"
        >
          <Text className="text-gray-500 text-base">Skip</Text>
        </TouchableOpacity>
      )}

      {/* Content */}
      {renderCurrentStep()}

      {/* Navigation Buttons */}
      <View className="px-6 pb-6">
        <View className="flex-row gap-3">
          {!isFirstStep && !isLastStep && (
            <TouchableOpacity
              onPress={previousStep}
              className="flex-1 py-4 rounded-xl bg-gray-200"
            >
              <Text className="text-gray-700 text-center font-semibold">
                Back
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={handleNext}
            className={`py-4 rounded-xl bg-green-600 ${
              isFirstStep || isLastStep ? 'flex-1' : 'flex-1'
            }`}
          >
            <Text className="text-white text-center font-semibold text-lg">
              {isLastStep
                ? 'Get Started'
                : currentStep === 'notifications'
                ? 'Enable Notifications'
                : 'Continue'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
