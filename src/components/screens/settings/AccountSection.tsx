import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Symbol as UISymbol } from '@/components/ui/symbol';
import type { getM3Theme } from '@/styles/theme';
import type { SettingsStyles } from './settings-styles';

interface AccountSectionProps {
  phoneActionTitle: string;
  phoneActionValue: string | null;
  authLoading: boolean;
  styles: SettingsStyles;
  m3: ReturnType<typeof getM3Theme>;
  onOpenLinkPhone: () => void;
  onSignOut: () => void;
  onDeleteAccount: () => void;
}

export function AccountSection({
  phoneActionTitle,
  phoneActionValue,
  authLoading,
  styles,
  m3,
  onOpenLinkPhone,
  onSignOut,
  onDeleteAccount,
}: AccountSectionProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.section}>
      <Text
        style={styles.sectionHeader}
        accessibilityRole="header"
        textBreakStrategy="highQuality"
        lineBreakStrategyIOS="standard"
      >
        {t('settings.sectionAccount')}
      </Text>
      <View style={styles.sectionContent}>
        <Pressable
          onPress={onOpenLinkPhone}
          accessibilityRole="button"
          accessibilityLabel={phoneActionTitle}
          style={[styles.settingsItem, styles.borderBottom]}
        >
          <View style={styles.settingsIcon}>
            <UISymbol name="phone.fill" size={20} color={m3.colorScheme.primary} />
          </View>
          <Text
            style={styles.settingsTitle}
            textBreakStrategy="highQuality"
            lineBreakStrategyIOS="standard"
          >
            {phoneActionTitle}
          </Text>
          <Text
            style={styles.settingsValue}
            textBreakStrategy="highQuality"
            lineBreakStrategyIOS="standard"
          >
            {phoneActionValue ?? t('settings.linkPhone.sendCode')}
          </Text>
          <UISymbol name="chevron.right" size={16} color={m3.surface.s400} />
        </Pressable>
        <Pressable
          onPress={onSignOut}
          disabled={authLoading}
          accessibilityRole="button"
          accessibilityLabel={t('settings.signOut')}
          style={[styles.settingsItem, styles.borderBottom]}
        >
          <View style={styles.signOutIcon}>
            <UISymbol
              name="rectangle.portrait.and.arrow.right"
              size={20}
              color={m3.colorScheme.error}
            />
          </View>
          <Text
            style={styles.signOutText}
            textBreakStrategy="highQuality"
            lineBreakStrategyIOS="standard"
          >
            {t('settings.signOut')}
          </Text>
        </Pressable>
        <Pressable
          onPress={onDeleteAccount}
          disabled={authLoading}
          accessibilityRole="button"
          accessibilityLabel={t('settings.deleteAccount')}
          accessibilityState={{ disabled: authLoading }}
          style={styles.settingsItem}
        >
          <View style={styles.deleteIcon}>
            <UISymbol name="trash" size={20} color={m3.colorScheme.error} />
          </View>
          <Text
            style={styles.deleteText}
            textBreakStrategy="highQuality"
            lineBreakStrategyIOS="standard"
          >
            {t('settings.deleteAccount')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
