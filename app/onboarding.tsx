/**
 * Onboarding Screen
 * Multi-step onboarding flow for new users
 */

import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, SafeAreaView } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import { router } from 'expo-router';
import { useOnboardingStore } from '../src/stores/onboarding-store';
import { useLanguageStore } from '@/stores';
import { ONBOARDING_STEPS, ONBOARDING_FEATURES, COUNTRIES } from '../src/types/onboarding';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import type { SupportedLanguageCode } from '@/i18n/languages';
import { useThemeColors } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';

export default function OnboardingScreen() {
  const colors = useThemeColors();
  const { t } = useTranslation();

  const { currentStep, preferences, nextStep, previousStep, setPreferences, completeOnboarding } =
    useOnboardingStore();

  const currentLanguage = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);

  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguageCode>(
    currentLanguage ?? 'en',
  );

  const [selectedCountry, setSelectedCountry] = useState(preferences.country);
  const [selectedAreaUnit, setSelectedAreaUnit] = useState(preferences.areaUnit);
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  const filteredFeatures = useMemo(() => ONBOARDING_FEATURES, []);
  const currentIndex = ONBOARDING_STEPS.indexOf(currentStep);
  const isFirstStep = currentIndex === 0;
  const isLastStep = currentIndex === ONBOARDING_STEPS.length - 1;

  const handleNext = async () => {
    if (currentStep === 'language') {
      setLanguage(selectedLanguage);
    }

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
        <SymbolIcon name="leaf.fill" size={64} color={colors.primary[700]} />
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
        {t('onboarding.welcome.title')}
      </Text>
      <Text style={{ fontSize: fontSize.lg, color: colors.gray[500], textAlign: 'center' }}>
        {t('onboarding.welcome.subtitle')}
      </Text>
    </View>
  );

  const renderLanguageStep = () => (
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
        <SymbolIcon name="globe" size={48} color={colors.primary[700]} />
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
        {t('onboarding.language.title')}
      </Text>
      <Text style={{ color: colors.gray[500], textAlign: 'center', marginBottom: spacing[6] }}>
        {t('onboarding.language.subtitle')}
      </Text>

      <View style={{ width: '100%', maxWidth: 420, gap: spacing[3] }}>
        <Pressable
          onPress={() => {
            setSelectedLanguage('en');
          }}
          accessibilityRole="button"
          accessibilityLabel={t('onboarding.language.english')}
          accessibilityState={{ selected: selectedLanguage === 'en' }}
          style={{
            padding: spacing[4],
            borderRadius: borderRadius.xl,
            borderWidth: 2,
            borderColor: selectedLanguage === 'en' ? colors.primary[600] : colors.gray[200],
            backgroundColor: selectedLanguage === 'en' ? colors.primary[50] : colors.surface[100],
          }}
        >
          <Text
            style={{
              textAlign: 'center',
              fontWeight: fontWeight.semibold,
              color: selectedLanguage === 'en' ? colors.primary[700] : colors.gray[700],
              fontSize: fontSize.lg,
            }}
          >
            {t('onboarding.language.english')}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => {
            setSelectedLanguage('mr');
          }}
          accessibilityRole="button"
          accessibilityLabel={t('onboarding.language.marathi')}
          accessibilityState={{ selected: selectedLanguage === 'mr' }}
          style={{
            padding: spacing[4],
            borderRadius: borderRadius.xl,
            borderWidth: 2,
            borderColor: selectedLanguage === 'mr' ? colors.primary[600] : colors.gray[200],
            backgroundColor: selectedLanguage === 'mr' ? colors.primary[50] : colors.surface[100],
          }}
        >
          <Text
            style={{
              textAlign: 'center',
              fontWeight: fontWeight.semibold,
              color: selectedLanguage === 'mr' ? colors.primary[700] : colors.gray[700],
              fontSize: fontSize.lg,
            }}
          >
            {t('onboarding.language.marathi')}
          </Text>
        </Pressable>
      </View>
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
        {t('onboarding.howItWorks.title')}
      </Text>
      <Text style={{ color: colors.gray[500], textAlign: 'center', marginBottom: spacing[6] }}>
        {t('onboarding.howItWorks.subtitle')}
      </Text>

      {filteredFeatures.map((feature, index) => (
        <View
          key={index}
          style={{
            backgroundColor: colors.surface[100],
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
            <SymbolIcon name={feature.icon} size={24} color={feature.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: fontSize.base,
                fontWeight: fontWeight.semibold,
                color: colors.gray[800],
              }}
            >
              {t(`onboarding.features.${feature.id}.title`)}
            </Text>
            <Text style={{ fontSize: fontSize.sm, color: colors.gray[500], marginTop: spacing[1] }}>
              {t(`onboarding.features.${feature.id}.description`)}
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
        {t('onboarding.preferences.title')}
      </Text>
      <Text style={{ color: colors.gray[500], textAlign: 'center', marginBottom: spacing[8] }}>
        {t('onboarding.preferences.subtitle')}
      </Text>

      {/* Country Selection */}
      <View style={{ marginBottom: spacing[6] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing[3] }}>
          <SymbolIcon name="globe" size={20} color={colors.primary[700]} />
          <Text
            style={{
              fontSize: fontSize.base,
              fontWeight: fontWeight.semibold,
              color: colors.gray[800],
              marginLeft: spacing[2],
            }}
          >
            {t('onboarding.preferences.country')}
          </Text>
        </View>
        <Pressable
          onPress={() => setShowCountryPicker(!showCountryPicker)}
          style={{
            backgroundColor: colors.surface[100],
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
            {selectedCountry || t('onboarding.preferences.selectCountry')}
          </Text>
          <SymbolIcon
            name={showCountryPicker ? 'chevron.up' : 'chevron.down'}
            size={20}
            color="#666"
          />
        </Pressable>

        {showCountryPicker && (
          <View
            style={{
              backgroundColor: colors.surface[100],
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
                  backgroundColor:
                    selectedCountry === country ? colors.primary[50] : colors.surface[100],
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
          <SymbolIcon
            name="arrow.up.left.and.arrow.down.right"
            size={20}
            color={colors.primary[700]}
          />
          <Text
            style={{
              fontSize: fontSize.base,
              fontWeight: fontWeight.semibold,
              color: colors.gray[800],
              marginLeft: spacing[2],
            }}
          >
            {t('onboarding.preferences.areaUnit')}
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
              backgroundColor:
                selectedAreaUnit === 'acres' ? colors.primary[50] : colors.surface[100],
            }}
          >
            <Text
              style={{
                textAlign: 'center',
                fontWeight: fontWeight.semibold,
                color: selectedAreaUnit === 'acres' ? colors.primary[700] : colors.gray[600],
              }}
            >
              {t('units.acres')}
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
              backgroundColor:
                selectedAreaUnit === 'hectares' ? colors.primary[50] : colors.surface[100],
            }}
          >
            <Text
              style={{
                textAlign: 'center',
                fontWeight: fontWeight.semibold,
                color: selectedAreaUnit === 'hectares' ? colors.primary[700] : colors.gray[600],
              }}
            >
              {t('units.hectares')}
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
          backgroundColor: colorWithOpacity('#3B82F6', 0.16),
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing[8],
        }}
      >
        <SymbolIcon name="bell.fill" size={48} color="#3B82F6" />
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
        {t('onboarding.notifications.title')}
      </Text>
      <Text style={{ color: colors.gray[500], textAlign: 'center', marginBottom: spacing[6] }}>
        {t('onboarding.notifications.subtitle')}
      </Text>
      <View
        style={{ backgroundColor: '#EFF6FF', padding: spacing[4], borderRadius: borderRadius.xl }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing[2] }}>
          <SymbolIcon name="drop.fill" size={20} color="#3B82F6" />
          <Text style={{ color: '#1D4ED8', marginLeft: spacing[2] }}>
            {t('onboarding.notifications.item1')}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing[2] }}>
          <SymbolIcon name="alarm.fill" size={20} color="#3B82F6" />
          <Text style={{ color: '#1D4ED8', marginLeft: spacing[2] }}>
            {t('onboarding.notifications.item2')}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <SymbolIcon name="exclamationmark.triangle.fill" size={20} color="#3B82F6" />
          <Text style={{ color: '#1D4ED8', marginLeft: spacing[2] }}>
            {t('onboarding.notifications.item3')}
          </Text>
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
        <SymbolIcon name="checkmark.circle.fill" size={64} color={colors.primary[700]} />
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
        {t('onboarding.complete.title')}
      </Text>
      <Text style={{ color: colors.gray[500], textAlign: 'center' }}>
        {t('onboarding.complete.subtitle')}
      </Text>
    </View>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'language':
        return renderLanguageStep();
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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.gray[50] }}>
      {/* Progress Indicator */}
      {renderProgressIndicator()}

      {/* Skip Button */}
      {!isLastStep && (
        <Pressable
          onPress={handleSkip}
          style={{ position: 'absolute', right: spacing[4], top: spacing[12], zIndex: 10 }}
        >
          <Text style={{ color: colors.gray[500], fontSize: fontSize.base }}>
            {t('common.skip')}
          </Text>
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
                {t('common.back')}
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
                ? t('onboarding.cta.getStarted')
                : currentStep === 'notifications'
                  ? t('onboarding.cta.enableNotifications')
                  : t('onboarding.cta.continue')}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
