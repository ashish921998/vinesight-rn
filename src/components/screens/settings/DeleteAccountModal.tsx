import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Symbol as UISymbol } from '@/components/ui/symbol';
import { spacing, type ThemeColors, getM3Theme } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { supabase } from '@/lib/supabase';
import { telemetry } from '@/services/telemetry';
import { isIOS } from '@/hooks';
import type { SettingsStyles } from './settings-styles';

export interface DeleteAccountModalProps {
  visible: boolean;
  onClose: () => void;
  userEmail: string;
  deleteVerificationPhone: string;
  canAttemptDeleteWithPhone: boolean;
  requireEmailOtpForDelete: boolean;
  onDeleteAccount: (reason: string) => Promise<void>;
  styles: SettingsStyles;
  colors: ThemeColors;
  m3: ReturnType<typeof getM3Theme>;
}

export function DeleteAccountModal({
  visible,
  onClose,
  userEmail,
  deleteVerificationPhone,
  canAttemptDeleteWithPhone,
  requireEmailOtpForDelete,
  onDeleteAccount,
  styles,
  colors,
  m3,
}: DeleteAccountModalProps) {
  const { t } = useTranslation();

  // Internal state
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [deletePhoneOtp, setDeletePhoneOtp] = useState('');
  const [deleteEmailOtp, setDeleteEmailOtp] = useState('');
  const [deletePhoneOtpSent, setDeletePhoneOtpSent] = useState(false);
  const [deleteEmailOtpSent, setDeleteEmailOtpSent] = useState(false);
  const [deletePhoneVerified, setDeletePhoneVerified] = useState(false);
  const [deleteEmailVerified, setDeleteEmailVerified] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSendingDeleteOtp, setIsSendingDeleteOtp] = useState(false);
  const [isVerifyingDeleteOtp, setIsVerifyingDeleteOtp] = useState(false);
  const emailOtpRequestedAtRef = useRef<number | null>(null);

  const phoneVerificationLabel = canAttemptDeleteWithPhone
    ? t('settings.deleteAccountModal.phoneVerificationLabelRequired', {
        defaultValue: 'Mobile verification (required)',
      })
    : t('settings.deleteAccountModal.phoneVerificationLabelOptional', {
        defaultValue: 'Mobile verification',
      });

  const hasRequiredPhoneVerification = !canAttemptDeleteWithPhone || deletePhoneVerified;
  const hasRequiredEmailVerification = !requireEmailOtpForDelete || deleteEmailVerified;

  const hasAtLeastOneVerificationPath = canAttemptDeleteWithPhone || requireEmailOtpForDelete;
  const canSubmitDeleteAccount =
    deleteConfirmed &&
    hasAtLeastOneVerificationPath &&
    hasRequiredPhoneVerification &&
    hasRequiredEmailVerification &&
    !isDeleting &&
    !isSendingDeleteOtp &&
    !isVerifyingDeleteOtp;

  const resetState = useCallback(() => {
    setDeleteReason('');
    setDeleteConfirmed(false);
    setDeletePhoneOtp('');
    setDeleteEmailOtp('');
    setDeletePhoneOtpSent(false);
    setDeleteEmailOtpSent(false);
    setDeletePhoneVerified(false);
    setDeleteEmailVerified(false);
    setIsDeleting(false);
    setIsSendingDeleteOtp(false);
    setIsVerifyingDeleteOtp(false);
    emailOtpRequestedAtRef.current = null;
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [onClose, resetState]);

  const handleSendDeletePhoneOtp = async () => {
    if (!canAttemptDeleteWithPhone) {
      telemetry.capture('account_delete_phone_otp_blocked', {
        reason: 'phone_not_linked',
      });
      Alert.alert(
        t('common.error'),
        t('settings.deleteAccountModal.errors.phoneNotLinked', {
          defaultValue:
            'A verified phone number is required. Link your phone in Settings before deleting your account.',
        }),
      );
      return;
    }

    setIsSendingDeleteOtp(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: deleteVerificationPhone,
        options: { shouldCreateUser: false },
      });

      if (error) {
        Alert.alert(
          t('common.error'),
          t('settings.deleteAccountModal.errors.otpSendFailed', {
            defaultValue: 'Failed to send OTP. Please try again.',
          }),
        );
        return;
      }

      setDeletePhoneOtpSent(true);
      setDeletePhoneVerified(false);
      telemetry.capture('account_delete_phone_otp_sent');
      Alert.alert(
        t('settings.deleteAccountModal.phoneOtpSentTitle', { defaultValue: 'OTP sent' }),
        t('settings.deleteAccountModal.phoneOtpSentBody', {
          defaultValue: 'We sent an OTP to your mobile number.',
        }),
      );
    } catch (error) {
      telemetry.capture('account_delete_phone_otp_send_failed');
      if (__DEV__) {
        console.error('Failed to send phone OTP:', error);
      }
      Alert.alert(
        t('common.error'),
        t('settings.deleteAccountModal.errors.otpSendFailed', {
          defaultValue: 'Failed to send OTP. Please try again.',
        }),
      );
    } finally {
      setIsSendingDeleteOtp(false);
    }
  };

  const handleVerifyDeletePhoneOtp = async () => {
    if (!canAttemptDeleteWithPhone || !/^\d{6}$/.test(deletePhoneOtp.trim())) {
      Alert.alert(
        t('common.error'),
        t('settings.deleteAccountModal.errors.invalidOtp', {
          defaultValue: 'Enter a valid OTP.',
        }),
      );
      return;
    }

    setIsVerifyingDeleteOtp(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: deleteVerificationPhone,
        token: deletePhoneOtp.trim(),
        type: 'sms',
      });

      if (error) {
        Alert.alert(
          t('common.error'),
          t('settings.deleteAccountModal.errors.otpVerifyFailed', {
            defaultValue: 'OTP verification failed. Please try again.',
          }),
        );
        return;
      }

      setDeletePhoneVerified(true);
      telemetry.capture('account_delete_phone_otp_verified');
      Alert.alert(
        t('settings.deleteAccountModal.phoneVerifiedTitle', { defaultValue: 'Phone verified' }),
        t('settings.deleteAccountModal.phoneVerifiedBody', {
          defaultValue: 'Mobile verification completed.',
        }),
      );
    } catch (error) {
      telemetry.capture('account_delete_phone_otp_verify_failed');
      if (__DEV__) {
        console.error('Failed to verify phone OTP:', error);
      }
      Alert.alert(
        t('common.error'),
        t('settings.deleteAccountModal.errors.otpVerifyFailed', {
          defaultValue: 'OTP verification failed. Please try again.',
        }),
      );
    } finally {
      setIsVerifyingDeleteOtp(false);
    }
  };

  const handleSendDeleteEmailOtp = async () => {
    if (!requireEmailOtpForDelete) {
      return;
    }

    setIsSendingDeleteOtp(true);
    try {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      const accessToken = currentSession?.access_token;
      const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
      if (!accessToken) {
        Alert.alert(
          t('common.error'),
          t('settings.deleteAccountModal.errors.sessionExpired', {
            defaultValue: 'Your session has expired. Please sign in again and try.',
          }),
        );
        return;
      }

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/delete-account-email-otp`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
            apikey: anonKey,
          },
          body: JSON.stringify({
            action: 'send',
            email: userEmail.trim().toLowerCase(),
          }),
        },
      );

      const data = await response.json();

      if (!response.ok || data.error) {
        Alert.alert(
          t('common.error'),
          t('settings.deleteAccountModal.errors.emailOtpSendFailed', {
            defaultValue: 'Failed to send OTP to email. Please try again.',
          }),
        );
        return;
      }

      emailOtpRequestedAtRef.current = Date.now();
      setDeleteEmailOtpSent(true);
      setDeleteEmailOtp('');
      setDeleteEmailVerified(false);
      telemetry.capture('account_delete_email_otp_sent');
      Alert.alert(
        t('settings.deleteAccountModal.emailOtpSentTitle', {
          defaultValue: 'Email OTP sent',
        }),
        t('settings.deleteAccountModal.emailOtpSentBody', {
          defaultValue: 'We sent an OTP to your email. Enter it below to continue.',
        }),
      );
    } catch (error) {
      telemetry.capture('account_delete_email_otp_send_failed');
      if (__DEV__) {
        console.error('Failed to send email OTP:', error);
      }
      Alert.alert(
        t('common.error'),
        t('settings.deleteAccountModal.errors.emailOtpSendFailed', {
          defaultValue: 'Failed to send OTP to email. Please try again.',
        }),
      );
    } finally {
      setIsSendingDeleteOtp(false);
    }
  };

  const handleVerifyDeleteEmailOtp = async () => {
    if (!requireEmailOtpForDelete) {
      return;
    }

    setIsVerifyingDeleteOtp(true);
    try {
      const normalizedOtp = deleteEmailOtp.trim();
      if (!/^\d{6}$/.test(normalizedOtp)) {
        Alert.alert(
          t('common.error'),
          t('settings.deleteAccountModal.errors.otpVerifyFailed', {
            defaultValue: 'Please enter the OTP sent to your email.',
          }),
        );
        return;
      }

      const requestTime = emailOtpRequestedAtRef.current;
      if (!requestTime) {
        Alert.alert(
          t('common.error'),
          t('settings.deleteAccountModal.errors.otpVerifyFailed', {
            defaultValue: 'Email verification failed. Please request a new OTP.',
          }),
        );
        return;
      }

      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      const accessToken = currentSession?.access_token;
      const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
      if (!accessToken) {
        Alert.alert(
          t('common.error'),
          t('settings.deleteAccountModal.errors.sessionExpired', {
            defaultValue: 'Your session has expired. Please sign in again and try.',
          }),
        );
        return;
      }

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/delete-account-email-otp`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
            apikey: anonKey,
          },
          body: JSON.stringify({
            action: 'verify',
            email: userEmail.trim().toLowerCase(),
            otp: normalizedOtp,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok || data.error) {
        Alert.alert(
          t('common.error'),
          t('settings.deleteAccountModal.errors.otpVerifyFailed', {
            defaultValue: 'Email verification failed. Please check the OTP and try again.',
          }),
        );
        return;
      }

      setDeleteEmailVerified(true);
      setDeleteEmailOtp('');
      telemetry.capture('account_delete_email_otp_verified');
      Alert.alert(
        t('settings.deleteAccountModal.emailVerifiedTitle', { defaultValue: 'Email verified' }),
        t('settings.deleteAccountModal.emailVerifiedBody', {
          defaultValue: 'Email verification completed.',
        }),
      );
    } catch (error) {
      telemetry.capture('account_delete_email_otp_verify_failed');
      if (__DEV__) {
        console.error('Failed to verify email OTP:', error);
      }
      Alert.alert(
        t('common.error'),
        t('settings.deleteAccountModal.errors.otpVerifyFailed', {
          defaultValue: 'Email verification failed. Please try again.',
        }),
      );
    } finally {
      setIsVerifyingDeleteOtp(false);
    }
  };

  const handleConfirmDeleteAccount = async () => {
    telemetry.capture('account_delete_submit_attempted');

    if (!canAttemptDeleteWithPhone && !requireEmailOtpForDelete) {
      telemetry.capture('account_delete_submit_blocked', {
        reason: 'no_verification_method',
      });
      Alert.alert(
        t('common.error'),
        t('settings.deleteAccountModal.errors.noVerificationMethod', {
          defaultValue:
            'No verification method available. Please link a phone number or ensure email is set up before deleting your account.',
        }),
      );
      return;
    }

    if (canAttemptDeleteWithPhone && !deletePhoneVerified) {
      telemetry.capture('account_delete_submit_blocked', {
        reason: 'phone_not_verified',
      });
      Alert.alert(
        t('common.error'),
        t('settings.deleteAccountModal.errors.phoneOtpRequired', {
          defaultValue: 'Verify OTP on your mobile number before deleting your account.',
        }),
      );
      return;
    }

    if (requireEmailOtpForDelete && !deleteEmailVerified) {
      telemetry.capture('account_delete_submit_blocked', {
        reason: 'email_not_verified',
      });
      Alert.alert(
        t('common.error'),
        t('settings.deleteAccountModal.errors.emailOtpRequired', {
          defaultValue: 'Verify OTP on your email before deleting your account.',
        }),
      );
      return;
    }

    if (!deleteConfirmed) {
      telemetry.capture('account_delete_submit_blocked', {
        reason: 'confirmation_not_checked',
      });
      Alert.alert(t('common.error'), t('settings.deleteAccountModal.errors.missingConfirmation'));
      return;
    }

    setIsDeleting(true);

    try {
      await onDeleteAccount(deleteReason);
      setIsDeleting(false);
      Alert.alert(
        t('settings.deleteAccountModal.submittedTitle'),
        t('settings.deleteAccountModal.submittedBody'),
      );
      handleClose();
    } catch (error) {
      if (__DEV__) {
        console.error('Delete account error:', error);
      }
      setIsDeleting(false);
      Alert.alert(t('common.error'), t('settings.deleteAccountModal.errors.submitFailed'));
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
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
                {t('settings.deleteAccountModal.title')}
              </Text>
              <Pressable
                onPress={handleClose}
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
              >
                <UISymbol name="xmark.circle.fill" size={28} color={colors.gray[400]} />
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
            <View style={[styles.alertBox, styles.dangerAlert]}>
              <UISymbol name="exclamationmark.triangle.fill" size={20} color={colors.error} />
              <Text
                style={styles.alertTitle}
                textBreakStrategy="highQuality"
                lineBreakStrategyIOS="standard"
              >
                {t('settings.deleteAccountModal.warningTitle')}
              </Text>
              <Text
                style={styles.alertText}
                textBreakStrategy="highQuality"
                lineBreakStrategyIOS="standard"
              >
                {t('settings.deleteAccountModal.warningBody')}
              </Text>
            </View>

            <View style={styles.deleteWarnings}>
              <Text
                style={styles.deleteWarningItem}
                textBreakStrategy="highQuality"
                lineBreakStrategyIOS="standard"
              >
                • {t('settings.deleteAccountModal.dataList.farms')}
              </Text>
              <Text
                style={styles.deleteWarningItem}
                textBreakStrategy="highQuality"
                lineBreakStrategyIOS="standard"
              >
                • {t('settings.deleteAccountModal.dataList.records')}
              </Text>
              <Text
                style={styles.deleteWarningItem}
                textBreakStrategy="highQuality"
                lineBreakStrategyIOS="standard"
              >
                • {t('settings.deleteAccountModal.dataList.workers')}
              </Text>
              <Text
                style={styles.deleteWarningItem}
                textBreakStrategy="highQuality"
                lineBreakStrategyIOS="standard"
              >
                • {t('settings.deleteAccountModal.dataList.org')}
              </Text>
              <Text
                style={styles.deleteWarningItem}
                textBreakStrategy="highQuality"
                lineBreakStrategyIOS="standard"
              >
                • {t('settings.deleteAccountModal.dataList.uploads')}
              </Text>
              <Text
                style={styles.deleteWarningItem}
                textBreakStrategy="highQuality"
                lineBreakStrategyIOS="standard"
              >
                • {t('settings.deleteAccountModal.dataList.profile')}
              </Text>
            </View>

            <View style={styles.formCard}>
              <View style={styles.mb4}>
                <Text
                  style={styles.inputLabel}
                  textBreakStrategy="highQuality"
                  lineBreakStrategyIOS="standard"
                >
                  {phoneVerificationLabel}
                </Text>
                <View style={styles.inputDisabled}>
                  <Text
                    style={styles.inputDisabledText}
                    textBreakStrategy="highQuality"
                    lineBreakStrategyIOS="standard"
                  >
                    {canAttemptDeleteWithPhone
                      ? deleteVerificationPhone
                      : t('settings.deleteAccountModal.phoneNotAvailable', {
                          defaultValue: 'No verified phone linked',
                        })}
                  </Text>
                </View>
                <Text
                  style={styles.inputHint}
                  textBreakStrategy="highQuality"
                  lineBreakStrategyIOS="standard"
                >
                  {t('settings.deleteAccountModal.phoneVerificationHint', {
                    defaultValue: 'Send OTP to your mobile number and verify it to continue.',
                  })}
                </Text>
                <View style={styles.linkPhoneInputRow}>
                  <Pressable
                    onPress={handleSendDeletePhoneOtp}
                    disabled={isSendingDeleteOtp || !canAttemptDeleteWithPhone}
                    style={[
                      styles.verifyPhoneCta,
                      {
                        opacity: isSendingDeleteOtp || !canAttemptDeleteWithPhone ? 0.5 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={styles.verifyPhoneCtaText}
                      textBreakStrategy="highQuality"
                      lineBreakStrategyIOS="standard"
                    >
                      {deletePhoneOtpSent
                        ? t('settings.deleteAccountModal.resendOtp', {
                            defaultValue: 'Resend OTP',
                          })
                        : t('settings.deleteAccountModal.sendOtp', { defaultValue: 'Send OTP' })}
                    </Text>
                  </Pressable>
                </View>
                {deletePhoneOtpSent ? (
                  <View style={{ marginTop: spacing[3] }}>
                    <TextInput
                      value={deletePhoneOtp}
                      onChangeText={(value) => {
                        setDeletePhoneOtp(value.replace(/[^0-9]/g, ''));
                        setDeletePhoneVerified(false);
                      }}
                      placeholder={t('settings.deleteAccountModal.enterOtp', {
                        defaultValue: 'Enter OTP',
                      })}
                      placeholderTextColor={colors.gray[400]}
                      keyboardType="number-pad"
                      maxLength={6}
                      style={styles.input}
                    />
                    <Pressable
                      onPress={handleVerifyDeletePhoneOtp}
                      disabled={isVerifyingDeleteOtp || deletePhoneVerified}
                      style={[styles.verifyPhoneCta, { marginTop: spacing[2] }]}
                    >
                      <Text
                        style={styles.verifyPhoneCtaText}
                        textBreakStrategy="highQuality"
                        lineBreakStrategyIOS="standard"
                      >
                        {deletePhoneVerified
                          ? t('settings.deleteAccountModal.verified', {
                              defaultValue: 'Verified',
                            })
                          : t('settings.deleteAccountModal.verifyOtp', {
                              defaultValue: 'Verify OTP',
                            })}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>

              {requireEmailOtpForDelete ? (
                <View style={styles.mb4}>
                  <Text
                    style={styles.inputLabel}
                    textBreakStrategy="highQuality"
                    lineBreakStrategyIOS="standard"
                  >
                    {t('settings.deleteAccountModal.emailVerificationLabel', {
                      defaultValue: 'Email verification (required)',
                    })}
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
                    {t('settings.deleteAccountModal.emailVerificationHint', {
                      defaultValue: 'Send OTP to your email and verify it to continue.',
                    })}
                  </Text>
                  <View style={styles.linkPhoneInputRow}>
                    <Pressable
                      onPress={handleSendDeleteEmailOtp}
                      disabled={isSendingDeleteOtp}
                      style={[
                        styles.verifyPhoneCta,
                        {
                          opacity: isSendingDeleteOtp ? 0.5 : 1,
                        },
                      ]}
                    >
                      <Text
                        style={styles.verifyPhoneCtaText}
                        textBreakStrategy="highQuality"
                        lineBreakStrategyIOS="standard"
                      >
                        {deleteEmailOtpSent
                          ? t('settings.deleteAccountModal.resendLink', {
                              defaultValue: 'Resend OTP',
                            })
                          : t('settings.deleteAccountModal.sendLink', {
                              defaultValue: 'Send OTP',
                            })}
                      </Text>
                    </Pressable>
                  </View>
                  {deleteEmailOtpSent ? (
                    <View style={{ marginTop: spacing[3] }}>
                      <TextInput
                        value={deleteEmailOtp}
                        onChangeText={(value) => {
                          setDeleteEmailOtp(value.replace(/[^0-9]/g, ''));
                          setDeleteEmailVerified(false);
                        }}
                        placeholder={t('settings.deleteAccountModal.enterOtp', {
                          defaultValue: 'Enter OTP',
                        })}
                        placeholderTextColor={colors.gray[400]}
                        keyboardType="number-pad"
                        maxLength={6}
                        style={styles.input}
                      />
                      <Pressable
                        onPress={handleVerifyDeleteEmailOtp}
                        disabled={isVerifyingDeleteOtp || deleteEmailVerified}
                        style={[
                          styles.verifyPhoneCta,
                          {
                            marginTop: spacing[2],
                            backgroundColor: colorWithOpacity(colors.primary[600], 0.2),
                          },
                        ]}
                      >
                        <Text
                          style={styles.verifyPhoneCtaText}
                          textBreakStrategy="highQuality"
                          lineBreakStrategyIOS="standard"
                        >
                          {deleteEmailVerified
                            ? t('settings.deleteAccountModal.verified', {
                                defaultValue: 'Verified',
                              })
                            : t('settings.deleteAccountModal.verifyEmail', {
                                defaultValue: 'Verify OTP',
                              })}
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              ) : null}

              <View style={styles.mb4}>
                <Text
                  style={styles.inputLabel}
                  textBreakStrategy="highQuality"
                  lineBreakStrategyIOS="standard"
                >
                  {t('settings.deleteAccountModal.reason.label')}
                </Text>
                <TextInput
                  value={deleteReason}
                  onChangeText={setDeleteReason}
                  placeholder={t('settings.deleteAccountModal.reason.placeholder')}
                  placeholderTextColor={colors.gray[400]}
                  multiline
                  numberOfLines={3}
                  style={[styles.input, { height: 80 }]}
                />
                <Text
                  style={styles.inputHint}
                  textBreakStrategy="highQuality"
                  lineBreakStrategyIOS="standard"
                >
                  {t('settings.deleteAccountModal.reason.hint')}
                </Text>
              </View>

              <Pressable
                onPress={() => setDeleteConfirmed(!deleteConfirmed)}
                style={styles.checkboxContainer}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: deleteConfirmed }}
                accessibilityLabel={t('settings.deleteAccountModal.checkbox.bold')}
                accessibilityHint={t('settings.deleteAccountModal.checkbox.suffix')}
              >
                <View style={[styles.checkbox, deleteConfirmed && styles.checkboxChecked]}>
                  {deleteConfirmed && (
                    <UISymbol name="checkmark" size={14} color={m3.colorScheme.onError} />
                  )}
                </View>
                <Text
                  style={styles.checkboxText}
                  textBreakStrategy="highQuality"
                  lineBreakStrategyIOS="standard"
                >
                  {t('settings.deleteAccountModal.checkbox.prefix')}{' '}
                  <Text
                    style={styles.checkboxBold}
                    textBreakStrategy="highQuality"
                    lineBreakStrategyIOS="standard"
                  >
                    {t('settings.deleteAccountModal.checkbox.bold')}
                  </Text>{' '}
                  {t('settings.deleteAccountModal.checkbox.suffix')}
                </Text>
              </Pressable>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <Pressable
              onPress={handleConfirmDeleteAccount}
              disabled={!canSubmitDeleteAccount}
              style={[
                styles.deleteButton,
                { backgroundColor: colors.error, opacity: canSubmitDeleteAccount ? 1 : 0.5 },
              ]}
            >
              {isDeleting ? (
                <ActivityIndicator color={m3.colorScheme.onPrimary} />
              ) : (
                <Text
                  style={styles.deleteButtonText}
                  textBreakStrategy="highQuality"
                  lineBreakStrategyIOS="standard"
                >
                  {t('settings.deleteAccountModal.submit')}
                </Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
