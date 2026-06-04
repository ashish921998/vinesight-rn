import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useLanguageStore } from '@/stores';
import { setAppLanguage } from '@/i18n';
import { SUPPORTED_LANGUAGES, type SupportedLanguageCode } from '@/i18n/languages';
import { useIsDark, useM3 } from '@/styles/use-theme';
import { borderRadius, fontSize, fontWeight, radius, spacing } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import appLogoDark from '../assets/icons/ios-dark.png';
import appLogoLight from '../assets/icons/ios-light.png';

const CONTINUE_LABELS: Record<SupportedLanguageCode, string> = {
  hi: 'जारी रखें',
  mr: 'पुढे चला',
  en: 'Continue',
};

const ENGLISH_LABELS: Record<SupportedLanguageCode, string> = {
  en: 'English',
  mr: 'Marathi',
  hi: 'Hindi',
};

export default function LanguageSelectionScreen() {
  const m3 = useM3();
  const isDark = useIsDark();
  const appLogo = isDark ? appLogoDark : appLogoLight;
  const setLanguage = useLanguageStore((s) => s.setLanguage);
  const [selected, setSelected] = useState<SupportedLanguageCode | null>(null);

  const handleContinue = () => {
    if (!selected) return;
    setLanguage(selected);
    setAppLanguage(selected);
    router.replace('/');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: m3.colorScheme.background }]}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View
          style={[
            styles.backgroundOrb,
            styles.orbTop,
            { backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12) },
          ]}
        />
        <View
          style={[
            styles.backgroundOrb,
            styles.orbBottom,
            { backgroundColor: colorWithOpacity(m3.colorScheme.tertiary, 0.16) },
          ]}
        />
      </View>

      <View style={styles.content}>
        <View style={styles.header}>
          <View
            style={[
              styles.logoCircle,
              {
                backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.1),
                borderColor: colorWithOpacity(m3.colorScheme.primary, 0.2),
              },
            ]}
          >
            <Image
              source={appLogo as ImageSourcePropType}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <Text style={[styles.title, { color: m3.colorScheme.onSurface }]}>VineSight</Text>
          {/* Show the prompt in all supported languages since the user hasn't chosen yet */}
          <Text style={[styles.subtitle, { color: m3.colorScheme.onSurfaceVariant }]}>
            {'Choose your language / भाषा चुनें / भाषा निवडा'}
          </Text>
        </View>

        <View style={styles.options}>
          {SUPPORTED_LANGUAGES.map((lang) => {
            const isSelected = selected === lang.code;
            return (
              <Pressable
                key={lang.code}
                onPress={() => setSelected(lang.code)}
                accessible={true}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${lang.label}${isSelected ? ', selected' : ''}`}
                testID={`language-card-${lang.code}`}
                style={[
                  styles.card,
                  {
                    backgroundColor: isSelected
                      ? colorWithOpacity(m3.colorScheme.primary, 0.12)
                      : colorWithOpacity(
                          isDark ? m3.colorScheme.surfaceVariant : m3.colorScheme.surface,
                          isDark ? 0.5 : 0.92,
                        ),
                    borderColor: isSelected
                      ? m3.colorScheme.primary
                      : colorWithOpacity(m3.colorScheme.outline, 0.15),
                  },
                ]}
              >
                <View style={styles.cardText}>
                  <Text style={[styles.nativeLabel, { color: m3.colorScheme.onSurface }]}>
                    {lang.label}
                  </Text>
                  {lang.code !== 'en' && (
                    <Text style={[styles.englishLabel, { color: m3.colorScheme.onSurfaceVariant }]}>
                      {ENGLISH_LABELS[lang.code]}
                    </Text>
                  )}
                </View>
                {isSelected && (
                  <SymbolIcon
                    name="checkmark.circle.fill"
                    size={24}
                    color={m3.colorScheme.primary}
                  />
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.footer}>
        <Pressable
          onPress={handleContinue}
          disabled={!selected}
          style={[
            styles.continueButton,
            {
              backgroundColor: selected
                ? m3.colorScheme.primary
                : colorWithOpacity(m3.colorScheme.primary, 0.38),
            },
          ]}
        >
          {/* Show Continue in all supported languages before a selection is made */}
          <Text
            style={[
              styles.continueText,
              {
                color: selected
                  ? m3.colorScheme.onPrimary
                  : colorWithOpacity(m3.colorScheme.onPrimary, 0.6),
              },
            ]}
          >
            {selected ? CONTINUE_LABELS[selected] : 'Continue / जारी रखें / पुढे चला'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundOrb: {
    position: 'absolute',
    borderRadius: borderRadius.full,
  },
  orbTop: {
    width: 240,
    height: 240,
    top: -72,
    right: -40,
  },
  orbBottom: {
    width: 300,
    height: 300,
    bottom: 56,
    left: -96,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
    gap: spacing[10],
  },
  header: {
    alignItems: 'center',
    gap: spacing[3],
  },
  logoCircle: {
    width: 84,
    height: 84,
    borderRadius: radius['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginBottom: spacing[2],
  },
  logoImage: {
    width: 54,
    height: 54,
  },
  title: {
    fontSize: fontSize['3xl'],
    fontWeight: fontWeight.bold,
  },
  subtitle: {
    fontSize: fontSize.lg,
  },
  options: {
    gap: spacing[3],
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderRadius: borderRadius['2xl'],
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
  },
  cardText: {
    gap: spacing[1],
  },
  nativeLabel: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
  },
  englishLabel: {
    fontSize: fontSize.sm,
  },
  footer: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[4],
  },
  continueButton: {
    borderRadius: borderRadius['2xl'],
    paddingVertical: spacing[4],
    alignItems: 'center',
  },
  continueText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
});
