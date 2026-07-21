import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { OptionPickerSheet } from '@/components/ui/option-picker-sheet';
import { CURRENCIES, AREA_UNITS } from '@/constants/calculator-models';
import type { getM3Theme } from '@/styles/theme';
import type { SupportedLanguageCode } from '@/i18n/languages';
import type { ThemeMode } from '@/stores/theme-store';
import type { SettingsStyles } from './settings-styles';
import { SettingsItem } from './settings-styles';

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
  onOpenAssistant: () => void;
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
  onOpenAssistant,
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
          <SettingsItem
            icon="rectangle.stack"
            title={t('settings.appMode.title')}
            subtitle={t('settings.appMode.subtitle')}
            toggle={{ value: detailedMode, onValueChange: onDetailedModeChange }}
            isLast={false}
            styles={styles}
            m3={m3}
          />
          <Pressable
            onPress={onOpenAssistant}
            accessibilityRole="button"
            accessibilityLabel={t('settings.aiAssistant.title')}
          >
            <SettingsItem
              icon="sparkles"
              title={t('settings.aiAssistant.title')}
              subtitle={t('settings.aiAssistant.subtitle')}
              isLast={false}
              styles={styles}
              m3={m3}
            />
          </Pressable>
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
              icon="circle.lefthalf.filled"
              title={t('settings.theme')}
              value={getThemeLabel(themeMode)}
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
              icon="indianrupeesign.circle"
              title={t('settings.currency')}
              value={getCurrencyLabel(selectedCurrency)}
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
              icon="square.grid.2x2"
              title={t('settings.areaUnit')}
              value={getAreaUnitLabel(selectedAreaUnit)}
              isLast={false}
              styles={styles}
              m3={m3}
            />
          </Pressable>
          <Pressable
            onPress={onReplayGuidedTour}
            accessibilityRole="button"
            accessibilityLabel={t('guidedTour.settings.replay')}
            disabled={isResettingGuidedTour}
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

      <OptionPickerSheet
        visible={showLanguagePicker}
        onClose={() => setShowLanguagePicker(false)}
        onSelect={(key) => onLanguageChange(key as SupportedLanguageCode)}
        options={[
          { key: 'en', label: t('settings.languageEnglish') },
          { key: 'mr', label: t('settings.languageMarathi') },
          { key: 'hi', label: t('settings.languageHindi') },
        ]}
        selectedKey={language}
        title={t('settings.selectLanguage')}
      />

      <OptionPickerSheet
        visible={showThemePicker}
        onClose={() => setShowThemePicker(false)}
        onSelect={(key) => onThemeChange(key as ThemeMode)}
        options={[
          { key: 'system', label: t('settings.themeSystem') },
          { key: 'light', label: t('settings.themeLight') },
          { key: 'dark', label: t('settings.themeDark') },
        ]}
        selectedKey={themeMode}
        title={t('settings.selectTheme')}
      />

      <OptionPickerSheet
        visible={showCurrencyPicker}
        onClose={() => setShowCurrencyPicker(false)}
        onSelect={onCurrencyChange}
        options={CURRENCIES.map((currency) => ({
          key: currency.code,
          label: currency.label,
        }))}
        selectedKey={selectedCurrency}
        title={t('settings.selectCurrency')}
      />

      <OptionPickerSheet
        visible={showAreaPicker}
        onClose={() => setShowAreaPicker(false)}
        onSelect={(key) => onAreaUnitChange(key as 'hectares' | 'acres')}
        options={AREA_UNITS.map((unit) => ({
          key: unit.id,
          label: unit.label,
        }))}
        selectedKey={selectedAreaUnit}
        title={t('settings.selectAreaUnit')}
      />
    </>
  );
}
