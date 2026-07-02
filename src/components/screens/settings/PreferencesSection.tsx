import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Symbol as UISymbol } from '@/components/ui/symbol';
import { spacing } from '@/styles/theme';
import { CURRENCIES, AREA_UNITS } from '@/constants/calculator-models';
import { isIOS } from '@/hooks';
import type { getM3Theme } from '@/styles/theme';
import type { SupportedLanguageCode } from '@/i18n/languages';
import type { ThemeMode } from '@/stores/theme-store';
import type { SettingsStyles } from './settings-styles';
import { SettingsItem, SettingsToggleItem } from './settings-styles';

interface PreferencesSectionProps {
  language: SupportedLanguageCode | null;
  themeMode: ThemeMode;
  selectedCurrency: string;
  selectedAreaUnit: 'acres' | 'hectares';
  isResettingGuidedTour: boolean;
  detailedMode: boolean;
  styles: SettingsStyles;
  m3: ReturnType<typeof getM3Theme>;
  onLanguageChange: (code: SupportedLanguageCode) => void;
  onThemeChange: (mode: ThemeMode) => void;
  onCurrencyChange: (code: string) => void;
  onAreaUnitChange: (unit: 'hectares' | 'acres') => void;
  onReplayGuidedTour: () => void;
  onDetailedModeChange: (value: boolean) => void;
}

export function PreferencesSection({
  language,
  themeMode,
  selectedCurrency,
  selectedAreaUnit,
  isResettingGuidedTour,
  detailedMode,
  styles,
  m3,
  onLanguageChange,
  onThemeChange,
  onCurrencyChange,
  onAreaUnitChange,
  onReplayGuidedTour,
  onDetailedModeChange,
}: PreferencesSectionProps) {
  const { t } = useTranslation();
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [showAreaPicker, setShowAreaPicker] = useState(false);

  const getLanguageLabel = (code: SupportedLanguageCode | null) => {
    if (code === 'mr') return t('settings.languageMarathi');
    if (code === 'hi') return t('settings.languageHindi');
    return t('settings.languageEnglish');
  };

  const getThemeLabel = (mode: ThemeMode) => {
    if (mode === 'light') return t('settings.themeLight');
    if (mode === 'dark') return t('settings.themeDark');
    return t('settings.themeSystem');
  };

  const getCurrencyLabel = (code: string) => {
    const currency = CURRENCIES.find((c) => c.code === code);
    return currency?.label || code;
  };

  const getAreaUnitLabel = (id: string) => {
    const unit = AREA_UNITS.find((u) => u.id === id);
    return unit?.label || id;
  };

  return (
    <>
      <View style={styles.section}>
        <Text
          style={styles.sectionHeader}
          accessibilityRole="header"
          textBreakStrategy="highQuality"
          lineBreakStrategyIOS="standard"
        >
          {t('settings.sectionGeneral')}
        </Text>
        <View style={styles.sectionContent}>
          <SettingsToggleItem
            icon="rectangle.stack"
            title={t('settings.appMode.title')}
            subtitle={t('settings.appMode.subtitle')}
            value={detailedMode}
            onValueChange={onDetailedModeChange}
            isLast={false}
            styles={styles}
            m3={m3}
          />
          <Pressable
            onPress={() => setShowLanguagePicker(true)}
            accessibilityRole="button"
            accessibilityLabel={t('settings.language')}
            accessibilityValue={{ text: getLanguageLabel(language) }}
          >
            <SettingsItem
              icon="globe"
              title={t('settings.language')}
              value={getLanguageLabel(language)}
              isLast={false}
              styles={styles}
              m3={m3}
            />
          </Pressable>
          <Pressable
            onPress={() => setShowThemePicker(true)}
            accessibilityRole="button"
            accessibilityLabel={t('settings.theme')}
            accessibilityValue={{ text: getThemeLabel(themeMode) }}
          >
            <SettingsItem
              icon="sun.max.fill"
              title={t('settings.theme')}
              value={getThemeLabel(themeMode)}
              isLast={false}
              styles={styles}
              m3={m3}
            />
          </Pressable>
          <Pressable
            onPress={() => setShowAreaPicker(true)}
            accessibilityRole="button"
            accessibilityLabel={t('settings.areaUnit')}
            accessibilityValue={{ text: getAreaUnitLabel(selectedAreaUnit) }}
          >
            <SettingsItem
              icon="arrow.up.left.and.arrow.down.right"
              title={t('settings.areaUnit')}
              value={getAreaUnitLabel(selectedAreaUnit)}
              isLast={false}
              styles={styles}
              m3={m3}
            />
          </Pressable>
          <Pressable
            onPress={() => setShowCurrencyPicker(true)}
            accessibilityRole="button"
            accessibilityLabel={t('settings.currency')}
            accessibilityValue={{ text: getCurrencyLabel(selectedCurrency) }}
          >
            <SettingsItem
              icon="banknote"
              title={t('settings.currency')}
              value={getCurrencyLabel(selectedCurrency)}
              isLast={false}
              styles={styles}
              m3={m3}
            />
          </Pressable>
          <Pressable
            onPress={onReplayGuidedTour}
            disabled={isResettingGuidedTour}
            accessibilityRole="button"
            accessibilityLabel={t('guidedTour.settings.replay')}
          >
            <SettingsItem
              icon="sparkles"
              title={t('guidedTour.settings.replay')}
              value={isResettingGuidedTour ? t('common.loading') : undefined}
              isLast
              disabled={isResettingGuidedTour}
              styles={styles}
              m3={m3}
            />
          </Pressable>
        </View>
      </View>

      {/* Language Picker Modal */}
      <Modal
        visible={showLanguagePicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowLanguagePicker(false)}
      >
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderInner}>
              <Text
                style={styles.modalTitle}
                textBreakStrategy="highQuality"
                lineBreakStrategyIOS="standard"
              >
                {t('settings.selectLanguage')}
              </Text>
              <Pressable
                onPress={() => setShowLanguagePicker(false)}
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
              >
                <UISymbol name="xmark.circle.fill" size={28} color={m3.neutral.n400} />
              </Pressable>
            </View>
          </View>
          <ScrollView
            style={styles.flex1}
            contentContainerStyle={{ padding: spacing[4] }}
            contentInsetAdjustmentBehavior="automatic"
            automaticallyAdjustKeyboardInsets={isIOS}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <View style={styles.sectionContent} accessibilityRole="radiogroup">
              {(
                [
                  { code: 'en' as const, label: t('settings.languageEnglish') },
                  { code: 'mr' as const, label: t('settings.languageMarathi') },
                  { code: 'hi' as const, label: t('settings.languageHindi') },
                ] as const
              ).map((opt, index, arr) => (
                <Pressable
                  key={opt.code}
                  onPress={() => {
                    onLanguageChange(opt.code);
                    setShowLanguagePicker(false);
                  }}
                  style={[styles.settingsItem, index < arr.length - 1 && styles.borderBottom]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: language === opt.code }}
                >
                  <Text
                    style={styles.pickerItemText}
                    textBreakStrategy="highQuality"
                    lineBreakStrategyIOS="standard"
                  >
                    {opt.label}
                  </Text>
                  {language === opt.code && (
                    <UISymbol
                      name="checkmark.circle.fill"
                      size={22}
                      color={m3.colorScheme.primary}
                    />
                  )}
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Theme Picker Modal */}
      <Modal
        visible={showThemePicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowThemePicker(false)}
      >
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderInner}>
              <Text
                style={styles.modalTitle}
                textBreakStrategy="highQuality"
                lineBreakStrategyIOS="standard"
              >
                {t('settings.selectTheme')}
              </Text>
              <Pressable
                onPress={() => setShowThemePicker(false)}
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
              >
                <UISymbol name="xmark.circle.fill" size={28} color={m3.neutral.n400} />
              </Pressable>
            </View>
          </View>
          <ScrollView
            style={styles.flex1}
            contentContainerStyle={{ padding: spacing[4] }}
            contentInsetAdjustmentBehavior="automatic"
            automaticallyAdjustKeyboardInsets={isIOS}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <View style={styles.sectionContent} accessibilityRole="radiogroup">
              {(
                [
                  { mode: 'system' as const, label: t('settings.themeSystem') },
                  { mode: 'light' as const, label: t('settings.themeLight') },
                  { mode: 'dark' as const, label: t('settings.themeDark') },
                ] as const
              ).map((opt, index, arr) => (
                <Pressable
                  key={opt.mode}
                  onPress={() => {
                    onThemeChange(opt.mode);
                    setShowThemePicker(false);
                  }}
                  style={[styles.settingsItem, index < arr.length - 1 && styles.borderBottom]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: themeMode === opt.mode }}
                >
                  <Text
                    style={styles.pickerItemText}
                    textBreakStrategy="highQuality"
                    lineBreakStrategyIOS="standard"
                  >
                    {opt.label}
                  </Text>
                  {themeMode === opt.mode && (
                    <UISymbol
                      name="checkmark.circle.fill"
                      size={22}
                      color={m3.colorScheme.primary}
                    />
                  )}
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Currency Picker Modal */}
      <Modal
        visible={showCurrencyPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCurrencyPicker(false)}
      >
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderInner}>
              <Text
                style={styles.modalTitle}
                textBreakStrategy="highQuality"
                lineBreakStrategyIOS="standard"
              >
                {t('settings.selectCurrency')}
              </Text>
              <Pressable
                onPress={() => setShowCurrencyPicker(false)}
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
              >
                <UISymbol name="xmark.circle.fill" size={28} color={m3.neutral.n400} />
              </Pressable>
            </View>
          </View>
          <ScrollView
            style={styles.flex1}
            contentContainerStyle={{ padding: spacing[4] }}
            contentInsetAdjustmentBehavior="automatic"
            automaticallyAdjustKeyboardInsets={isIOS}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <View style={styles.sectionContent} accessibilityRole="radiogroup">
              {CURRENCIES.map((currency, index) => (
                <Pressable
                  key={currency.code}
                  onPress={() => {
                    onCurrencyChange(currency.code);
                    setShowCurrencyPicker(false);
                  }}
                  style={[
                    styles.settingsItem,
                    index < CURRENCIES.length - 1 && styles.borderBottom,
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selectedCurrency === currency.code }}
                >
                  <Text
                    style={styles.pickerItemText}
                    textBreakStrategy="highQuality"
                    lineBreakStrategyIOS="standard"
                  >
                    {currency.label}
                  </Text>
                  {selectedCurrency === currency.code && (
                    <UISymbol
                      name="checkmark.circle.fill"
                      size={22}
                      color={m3.colorScheme.primary}
                    />
                  )}
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Area Unit Picker Modal */}
      <Modal
        visible={showAreaPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAreaPicker(false)}
      >
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderInner}>
              <Text
                style={styles.modalTitle}
                textBreakStrategy="highQuality"
                lineBreakStrategyIOS="standard"
              >
                {t('settings.selectAreaUnit')}
              </Text>
              <Pressable
                onPress={() => setShowAreaPicker(false)}
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
              >
                <UISymbol name="xmark.circle.fill" size={28} color={m3.neutral.n400} />
              </Pressable>
            </View>
          </View>
          <ScrollView
            style={styles.flex1}
            contentContainerStyle={{ padding: spacing[4] }}
            contentInsetAdjustmentBehavior="automatic"
            automaticallyAdjustKeyboardInsets={isIOS}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <View style={styles.sectionContent} accessibilityRole="radiogroup">
              {AREA_UNITS.map((unit, index) => (
                <Pressable
                  key={unit.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selectedAreaUnit === unit.id }}
                  onPress={() => {
                    onAreaUnitChange(unit.id as 'hectares' | 'acres');
                    setShowAreaPicker(false);
                  }}
                  style={[
                    styles.settingsItem,
                    index < AREA_UNITS.length - 1 && styles.borderBottom,
                  ]}
                >
                  <Text
                    style={styles.pickerItemText}
                    textBreakStrategy="highQuality"
                    lineBreakStrategyIOS="standard"
                  >
                    {unit.label}
                  </Text>
                  {selectedAreaUnit === unit.id && (
                    <UISymbol
                      name="checkmark.circle.fill"
                      size={22}
                      color={m3.colorScheme.primary}
                    />
                  )}
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}
