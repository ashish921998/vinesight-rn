import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  Modal,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Symbol as UISymbol } from '@/components/ui/symbol';
import { Spinner } from '@/components/ui/spinner';
import { spacing } from '@/styles/theme';
import { isIOS } from '@/hooks';
import type { getM3Theme } from '@/styles/theme';
import type { SettingsStyles } from './settings-styles';

interface ProfileSectionProps {
  userName: string;
  userEmail: string;
  linkedAuthPhone: string | null;
  hasSavedPhoneToVerify: boolean;
  styles: SettingsStyles;
  m3: ReturnType<typeof getM3Theme>;
  profile: { full_name?: string | null } | undefined;
  onSaveProfile: (name: string) => Promise<void>;
  onOpenLinkPhone: () => void;
}

export function ProfileSection({
  userName,
  userEmail,
  linkedAuthPhone,
  hasSavedPhoneToVerify,
  styles,
  m3,
  profile,
  onSaveProfile,
  onOpenLinkPhone,
}: ProfileSectionProps) {
  const { t } = useTranslation();
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleOpenEdit = () => {
    setEditName(profile?.full_name || '');
    setShowEditProfile(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveProfile(editName.trim());
      setShowEditProfile(false);
    } catch {
      // Error handling done by parent
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <View style={styles.profileCard}>
        <View style={styles.rowCenter}>
          <View style={styles.profileAvatar}>
            {userName ? (
              <Text
                style={styles.profileInitial}
                textBreakStrategy="highQuality"
                lineBreakStrategyIOS="standard"
              >
                {userName.charAt(0).toUpperCase()}
              </Text>
            ) : (
              <UISymbol name="person.fill" size={32} color={m3.colorScheme.primary} />
            )}
          </View>
          <View style={styles.profileInfo}>
            <Text
              style={styles.profileName}
              textBreakStrategy="highQuality"
              lineBreakStrategyIOS="standard"
            >
              {userName}
            </Text>
            <Text
              style={styles.profileEmail}
              textBreakStrategy="highQuality"
              lineBreakStrategyIOS="standard"
            >
              {userEmail}
            </Text>
          </View>
          <Pressable
            onPress={handleOpenEdit}
            accessibilityRole="button"
            accessibilityLabel={t('settings.editProfile')}
          >
            <UISymbol name="pencil" size={24} color={m3.colorScheme.primary} />
          </Pressable>
        </View>
      </View>

      <Modal
        visible={showEditProfile}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowEditProfile(false)}
      >
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          <KeyboardAvoidingView behavior={isIOS ? 'padding' : 'height'} style={styles.container}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderInner}>
                <Text
                  style={styles.modalTitle}
                  textBreakStrategy="highQuality"
                  lineBreakStrategyIOS="standard"
                >
                  {t('settings.editProfile')}
                </Text>
                <Pressable
                  onPress={() => setShowEditProfile(false)}
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
              <View style={styles.formCard}>
                <View style={styles.mb4}>
                  <Text
                    style={styles.inputLabel}
                    textBreakStrategy="highQuality"
                    lineBreakStrategyIOS="standard"
                  >
                    {t('settings.email')}
                  </Text>
                  <View style={styles.inputDisabled}>
                    <Text
                      style={styles.inputDisabledText}
                      textBreakStrategy="highQuality"
                      lineBreakStrategyIOS="standard"
                    >
                      {userEmail}
                    </Text>
                  </View>
                  <Text
                    style={styles.inputHint}
                    textBreakStrategy="highQuality"
                    lineBreakStrategyIOS="standard"
                  >
                    {t('settings.emailCannotBeChanged')}
                  </Text>
                </View>

                <View style={styles.mb4}>
                  <Text
                    style={styles.inputLabel}
                    textBreakStrategy="highQuality"
                    lineBreakStrategyIOS="standard"
                  >
                    {t('settings.fullName')}
                  </Text>
                  <TextInput
                    value={editName}
                    onChangeText={setEditName}
                    placeholder={t('settings.enterName')}
                    placeholderTextColor={m3.neutral.n400}
                    style={styles.input}
                  />
                </View>

                <View style={styles.mb4}>
                  <Text
                    style={styles.inputLabel}
                    textBreakStrategy="highQuality"
                    lineBreakStrategyIOS="standard"
                  >
                    {t('settings.phone')}
                  </Text>
                  <View style={styles.inputDisabled}>
                    <Text
                      style={styles.inputDisabledText}
                      textBreakStrategy="highQuality"
                      lineBreakStrategyIOS="standard"
                    >
                      {linkedAuthPhone ?? t('settings.linkPhone.notLinked')}
                    </Text>
                  </View>
                  <Text
                    style={styles.inputHint}
                    textBreakStrategy="highQuality"
                    lineBreakStrategyIOS="standard"
                  >
                    {linkedAuthPhone
                      ? t('settings.linkPhone.verified')
                      : t('settings.linkPhone.verificationRequired')}
                  </Text>
                  <Pressable
                    onPress={() => {
                      setShowEditProfile(false);
                      onOpenLinkPhone();
                    }}
                    style={styles.verifyPhoneCta}
                  >
                    <Text
                      style={styles.verifyPhoneCtaText}
                      textBreakStrategy="highQuality"
                      lineBreakStrategyIOS="standard"
                    >
                      {linkedAuthPhone
                        ? t('settings.linkPhone.changePhone')
                        : hasSavedPhoneToVerify
                          ? t('settings.linkPhone.verifyTitle')
                          : t('settings.linkPhone.title')}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable
                onPress={handleSave}
                disabled={isSaving}
                style={[styles.saveButton, { backgroundColor: m3.primary.p600 }]}
              >
                {isSaving ? (
                  <Spinner color={m3.colorScheme.onPrimary} />
                ) : (
                  <Text
                    style={styles.saveButtonText}
                    textBreakStrategy="highQuality"
                    lineBreakStrategyIOS="standard"
                  >
                    {t('common.saveChanges')}
                  </Text>
                )}
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </>
  );
}
