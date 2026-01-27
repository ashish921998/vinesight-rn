/**
 * Onboarding Screen
 * Multi-step onboarding flow for new users
 */

import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';

import { Symbol } from '@/components/ui/Symbol';
import { router } from 'expo-router';
import { useOnboardingStore } from '../src/stores/onboardingStore';
import { ONBOARDING_STEPS, ONBOARDING_FEATURES, COUNTRIES } from '../src/types/onboarding';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';

export default function OnboardingScreen() {
  const { currentStep, preferences, nextStep, previousStep, setPreferences, completeOnboarding } =
    useOnboardingStore();

  const [selectedCountry, setSelectedCountry] = useState(preferences.country);
  const [selectedAreaUnit, setSelectedAreaUnit] = useState(preferences.areaUnit);
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  const filteredFeatures = useMemo(() => ONBOARDING_FEATURES, []);
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
      if (__DEV__) {
        console.log('Notifications not available or failed to load:', error);
      }
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
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'center',
        paddingVertical: spacing[4],
        gap: spacing[2],
      }}
    >
      {ONBOARDING_STEPS.map((step, index) => (
        <View
          key={step}
          style={{
            height: 4,
            borderRadius: borderRadius.full,
            backgroundColor: index <= currentIndex ? colors.primary[600] : colors.gray[300],
            width: index <= currentIndex ? 32 : 24,
          }}
        />
      ))}
    </View>
  );

  const renderWelcomeStep = () => (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing[8],
      }}
    >
      <View
        style={{
          width: 128,
          height: 128,
          borderRadius: borderRadius.full,
          backgroundColor: colors.primary[100],
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing[8],
        }}
      >
        <Symbol name="leaf.fill" size={64} color="#1a5d1a" />
      </View>
      <Text
        style={{
          fontSize: fontSize['3xl'],
          fontWeight: fontWeight.bold,
          color: colors.gray[800],
          textAlign: 'center',
          marginBottom: spacing[3],
        }}
      >
        Welcome to Vinesight
      </Text>
      <Text style={{ fontSize: fontSize.lg, color: colors.gray[500], textAlign: 'center' }}>
        Your smart farming companion
      </Text>
    </View>
  );

  const renderFeaturesStep = () => (
    <ScrollView
      style={{ flex: 1, paddingHorizontal: spacing[6] }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingVertical: spacing[6] }}
    >
      <Text
        style={{
          fontSize: fontSize['2xl'],
          fontWeight: fontWeight.bold,
          color: colors.gray[800],
          textAlign: 'center',
          marginBottom: spacing[2],
        }}
      >
        How It Works
      </Text>
      <Text style={{ color: colors.gray[500], textAlign: 'center', marginBottom: spacing[6] }}>
        Everything you need to manage your farm
      </Text>

      {filteredFeatures.map((feature, index) => (
        <View
          key={index}
          style={{
            backgroundColor: colors.white,
            borderRadius: borderRadius['2xl'],
            padding: spacing[4],
            marginBottom: spacing[3],
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: borderRadius.xl,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: spacing[4],
              backgroundColor: `${feature.color}15`,
            }}
          >
            <Symbol name={feature.icon} size={24} color={feature.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: fontSize.base,
                fontWeight: fontWeight.semibold,
                color: colors.gray[800],
              }}
            >
              {feature.title}
            </Text>
            <Text style={{ fontSize: fontSize.sm, color: colors.gray[500], marginTop: spacing[1] }}>
              {feature.description}
            </Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );

  const renderPreferencesStep = () => (
    <ScrollView
      style={{ flex: 1, paddingHorizontal: spacing[6] }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingVertical: spacing[6] }}
    >
      <Text
        style={{
          fontSize: fontSize['2xl'],
          fontWeight: fontWeight.bold,
          color: colors.gray[800],
          textAlign: 'center',
          marginBottom: spacing[2],
        }}
      >
        Farm Preferences
      </Text>
      <Text style={{ color: colors.gray[500], textAlign: 'center', marginBottom: spacing[8] }}>
        Help us customize your experience
      </Text>

      {/* Country Selection */}
      <View style={{ marginBottom: spacing[6] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing[3] }}>
          <Symbol name="globe" size={20} color="#1a5d1a" />
          <Text
            style={{
              fontSize: fontSize.base,
              fontWeight: fontWeight.semibold,
              color: colors.gray[800],
              marginLeft: spacing[2],
            }}
          >
            Country
          </Text>
        </View>
        <Pressable
          onPress={() => setShowCountryPicker(!showCountryPicker)}
          style={{
            backgroundColor: colors.white,
            borderRadius: borderRadius.xl,
            padding: spacing[4],
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Text
            style={{
              fontSize: fontSize.base,
              color: selectedCountry ? colors.gray[800] : colors.gray[400],
            }}
          >
            {selectedCountry || 'Select a country'}
          </Text>
          <Symbol name={showCountryPicker ? 'chevron-up' : 'chevron-down'} size={20} color="#666" />
        </Pressable>

        {showCountryPicker && (
          <View
            style={{
              backgroundColor: colors.white,
              borderRadius: borderRadius.xl,
              marginTop: spacing[2],
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: colors.gray[200],
            }}
          >
            {COUNTRIES.map((country) => (
              <Pressable
                key={country}
                onPress={() => {
                  setSelectedCountry(country);
                  setShowCountryPicker(false);
                }}
                style={{
                  padding: spacing[4],
                  borderBottomWidth: 1,
                  borderBottomColor: colors.gray[100],
                  backgroundColor: selectedCountry === country ? colors.primary[50] : colors.white,
                }}
              >
                <Text
                  style={{
                    fontSize: fontSize.base,
                    color: selectedCountry === country ? colors.primary[700] : colors.gray[700],
                    fontWeight:
                      selectedCountry === country ? fontWeight.semibold : fontWeight.normal,
                  }}
                >
                  {country}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {/* Area Unit Selection */}
      <View style={{ marginBottom: spacing[6] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing[3] }}>
          <Symbol name="resize" size={20} color="#1a5d1a" />
          <Text
            style={{
              fontSize: fontSize.base,
              fontWeight: fontWeight.semibold,
              color: colors.gray[800],
              marginLeft: spacing[2],
            }}
          >
            Area Unit
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing[3] }}>
          <Pressable
            onPress={() => setSelectedAreaUnit('acres')}
            style={{
              flex: 1,
              padding: spacing[4],
              borderRadius: borderRadius.xl,
              borderWidth: 2,
              borderColor: selectedAreaUnit === 'acres' ? colors.primary[600] : colors.gray[200],
              backgroundColor: selectedAreaUnit === 'acres' ? colors.primary[50] : colors.white,
            }}
          >
            <Text
              style={{
                textAlign: 'center',
                fontWeight: fontWeight.semibold,
                color: selectedAreaUnit === 'acres' ? colors.primary[700] : colors.gray[600],
              }}
            >
              Acres
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setSelectedAreaUnit('hectares')}
            style={{
              flex: 1,
              padding: spacing[4],
              borderRadius: borderRadius.xl,
              borderWidth: 2,
              borderColor: selectedAreaUnit === 'hectares' ? colors.primary[600] : colors.gray[200],
              backgroundColor: selectedAreaUnit === 'hectares' ? colors.primary[50] : colors.white,
            }}
          >
            <Text
              style={{
                textAlign: 'center',
                fontWeight: fontWeight.semibold,
                color: selectedAreaUnit === 'hectares' ? colors.primary[700] : colors.gray[600],
              }}
            >
              Hectares
            </Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );

  const renderNotificationsStep = () => (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing[8],
      }}
    >
      <View
        style={{
          width: 96,
          height: 96,
          borderRadius: borderRadius.full,
          backgroundColor: '#DBEAFE',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing[8],
        }}
      >
        <Symbol name="notifications" size={48} color="#3B82F6" />
      </View>
      <Text
        style={{
          fontSize: fontSize['2xl'],
          fontWeight: fontWeight.bold,
          color: colors.gray[800],
          textAlign: 'center',
          marginBottom: spacing[3],
        }}
      >
        Stay Updated
      </Text>
      <Text style={{ color: colors.gray[500], textAlign: 'center', marginBottom: spacing[6] }}>
        Get reminders for irrigation schedules, task deadlines, and important farm alerts.
      </Text>
      <View
        style={{ backgroundColor: '#EFF6FF', padding: spacing[4], borderRadius: borderRadius.xl }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing[2] }}>
          <Symbol name="drop.fill" size={20} color="#3B82F6" />
          <Text style={{ color: '#1D4ED8', marginLeft: spacing[2] }}>Irrigation reminders</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing[2] }}>
          <Symbol name="alarm" size={20} color="#3B82F6" />
          <Text style={{ color: '#1D4ED8', marginLeft: spacing[2] }}>Task deadlines</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Symbol name="warning" size={20} color="#3B82F6" />
          <Text style={{ color: '#1D4ED8', marginLeft: spacing[2] }}>Weather alerts</Text>
        </View>
      </View>
    </View>
  );

  const renderCompleteStep = () => (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing[8],
      }}
    >
      <View
        style={{
          width: 96,
          height: 96,
          borderRadius: borderRadius.full,
          backgroundColor: colors.primary[100],
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing[8],
        }}
      >
        <Symbol name="checkmark.circle.fill" size={64} color="#1a5d1a" />
      </View>
      <Text
        style={{
          fontSize: fontSize['2xl'],
          fontWeight: fontWeight.bold,
          color: colors.gray[800],
          textAlign: 'center',
          marginBottom: spacing[3],
        }}
      >
        You&apos;re All Set!
      </Text>
      <Text style={{ color: colors.gray[500], textAlign: 'center' }}>
        Start managing your farms with Vinesight. Add your first farm to get started.
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
    <View style={{ flex: 1, backgroundColor: colors.gray[50] }}>
      {/* Progress Indicator */}
      {renderProgressIndicator()}

      {/* Skip Button */}
      {!isLastStep && (
        <Pressable
          onPress={handleSkip}
          style={{ position: 'absolute', right: spacing[4], top: spacing[12], zIndex: 10 }}
        >
          <Text style={{ color: colors.gray[500], fontSize: fontSize.base }}>Skip</Text>
        </Pressable>
      )}

      {/* Content */}
      {renderCurrentStep()}

      {/* Navigation Buttons */}
      <View style={{ paddingHorizontal: spacing[6], paddingBottom: spacing[6] }}>
        <View style={{ flexDirection: 'row', gap: spacing[3] }}>
          {!isFirstStep && !isLastStep && (
            <Pressable
              onPress={previousStep}
              style={{
                flex: 1,
                paddingVertical: spacing[4],
                borderRadius: borderRadius.xl,
                backgroundColor: colors.gray[200],
              }}
            >
              <Text
                style={{
                  color: colors.gray[700],
                  textAlign: 'center',
                  fontWeight: fontWeight.semibold,
                }}
              >
                Back
              </Text>
            </Pressable>
          )}
          <Pressable
            onPress={handleNext}
            style={{
              paddingVertical: spacing[4],
              borderRadius: borderRadius.xl,
              backgroundColor: colors.primary[600],
              flex: 1,
            }}
          >
            <Text
              style={{
                color: colors.white,
                textAlign: 'center',
                fontWeight: fontWeight.semibold,
                fontSize: fontSize.lg,
              }}
            >
              {isLastStep
                ? 'Get Started'
                : currentStep === 'notifications'
                  ? 'Enable Notifications'
                  : 'Continue'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
