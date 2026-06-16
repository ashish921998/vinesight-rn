import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  KeyboardAvoidingView,
  Platform,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Symbol as UISymbol } from '@/components/ui/symbol';
import { Button, Input } from '@/components/ui';
import { toast } from '@/components/ui/toast';
import { isIOS } from '@/hooks';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import {
  joinOrganizationBySlug,
  joinOrgMessage,
  type JoinOrgStatus,
} from '@/services/organization';

interface JoinOrgModalProps {
  visible: boolean;
  onClose: () => void;
  onJoined?: (organizationName?: string) => void;
}

/**
 * Lets a signed-in farmer link themselves to a consultant's organization by
 * entering that org's slug (the "consultant code"). Self-contained modal that
 * mirrors LinkPhoneModal's shell. Calls join_organization_by_slug and renders
 * the result inline; success also fires a toast and onJoined.
 */
export function JoinOrgModal({ visible, onClose, onJoined }: JoinOrgModalProps) {
  const { t } = useTranslation();
  const m3 = useM3();

  const [slug, setSlug] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resultStatus, setResultStatus] = useState<JoinOrgStatus | null>(null);
  const [successOrgName, setSuccessOrgName] = useState<string | undefined>();

  // NOTE: state is reset on mount. The parent should mount/unmount this modal
  // (or render it with a key that changes per open) rather than keeping it
  // permanently mounted, so each open starts with a clean form. Mounting fresh
  // avoids the setState-in-effect anti-pattern.

  const trimmedSlug = slug.trim();
  const canSubmit = trimmedSlug.length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setResultStatus(null);
    const result = await joinOrganizationBySlug(trimmedSlug);
    setResultStatus(result.status);
    setSubmitting(false);

    if (result.ok) {
      setSuccessOrgName(result.organizationName);
      toast.success(
        result.organizationName
          ? `Linked to ${result.organizationName}.`
          : joinOrgMessage(result.status),
      );
      onJoined?.(result.organizationName);
    }
  };

  const handleClose = () => {
    onClose();
  };

  const isSuccess = resultStatus === 'joined' || resultStatus === 'already_joined';
  const showError = resultStatus !== null && !isSuccess;

  const overlayStyle: ViewStyle = {
    flex: 1,
    backgroundColor: m3.colorScheme.surface,
  };

  const headerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    paddingBottom: spacing[2],
  };

  const titleStyle: TextStyle = {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    color: m3.colorScheme.onSurface,
  };

  const bodyStyle: ViewStyle = {
    flex: 1,
    paddingHorizontal: spacing[6],
    paddingTop: spacing[2],
  };

  const helperStyle: TextStyle = {
    fontSize: fontSize.sm,
    color: m3.colorScheme.onSurfaceVariant,
    marginTop: spacing[2],
  };

  const bannerBaseStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
    marginTop: spacing[3],
  };

  const successBannerStyle: ViewStyle = {
    ...bannerBaseStyle,
    backgroundColor: colorWithOpacity(m3.colorScheme.primary, isIOS ? 0.12 : 0.1),
    borderWidth: 1,
    borderColor: colorWithOpacity(m3.colorScheme.primary, 0.3),
  };

  const errorBannerStyle: ViewStyle = {
    ...bannerBaseStyle,
    backgroundColor: colorWithOpacity(m3.colorScheme.error, isIOS ? 0.14 : 0.1),
    borderWidth: 1,
    borderColor: colorWithOpacity(m3.colorScheme.error, 0.3),
  };

  const bannerTextStyle: TextStyle = {
    flex: 1,
    fontSize: fontSize.sm,
    color: isSuccess ? m3.colorScheme.onSurface : m3.colorScheme.error,
  };

  const footerStyle: ViewStyle = {
    flexDirection: 'row',
    gap: spacing[3],
    paddingHorizontal: spacing[6],
    paddingTop: spacing[3],
    paddingBottom: spacing[6],
  };

  const iconColor = useMemo(
    () => (isSuccess ? m3.colorScheme.primary : m3.colorScheme.error),
    [isSuccess, m3.colorScheme],
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={overlayStyle} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={overlayStyle}
        >
          <View style={headerStyle}>
            <Text style={titleStyle}>
              {t('settings.joinOrg.title', { defaultValue: 'Join your consultant' })}
            </Text>
            <Pressable
              onPress={handleClose}
              accessibilityRole="button"
              accessibilityLabel={t('common.close', { defaultValue: 'Close' })}
              hitSlop={12}
            >
              <UISymbol
                name="xmark.circle.fill"
                size={26}
                color={m3.colorScheme.onSurfaceVariant}
              />
            </Pressable>
          </View>

          <View style={bodyStyle}>
            <Input
              label={t('settings.joinOrg.codeLabel', { defaultValue: 'Consultant code' })}
              placeholder={t('settings.joinOrg.codePlaceholder', {
                defaultValue: 'e.g. acme-agro',
              })}
              value={slug}
              onChangeText={(value) => {
                setSlug(value.replace(/\s/g, '').toLowerCase());
                if (resultStatus) setResultStatus(null);
              }}
              leftIcon="building.2.fill"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!submitting}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
            <Text style={helperStyle}>
              {t('settings.joinOrg.helper', {
                defaultValue:
                  "Enter the code your consultant gave you. It's the short word they shared (e.g. in a WhatsApp group).",
              })}
            </Text>

            {isSuccess && (
              <View style={successBannerStyle}>
                <UISymbol name="checkmark.circle.fill" size={20} color={iconColor} />
                <Text style={bannerTextStyle}>
                  {successOrgName ? `Linked to ${successOrgName}.` : joinOrgMessage(resultStatus!)}
                </Text>
              </View>
            )}

            {showError && (
              <View style={errorBannerStyle}>
                <UISymbol name="exclamationmark.circle.fill" size={20} color={iconColor} />
                <Text style={bannerTextStyle}>{joinOrgMessage(resultStatus!)}</Text>
              </View>
            )}
          </View>

          <View style={footerStyle}>
            <Button
              title={t('common.cancel', { defaultValue: 'Cancel' })}
              variant="outline"
              onPress={handleClose}
              disabled={submitting}
              style={{ flex: 1 }}
            />
            {isSuccess ? (
              <Button
                title={t('common.done', { defaultValue: 'Done' })}
                onPress={handleClose}
                style={{ flex: 1 }}
              />
            ) : (
              <Button
                title={
                  submitting
                    ? t('settings.joinOrg.joining', { defaultValue: 'Joining…' })
                    : t('settings.joinOrg.join', { defaultValue: 'Join' })
                }
                onPress={handleSubmit}
                disabled={!canSubmit}
                style={{ flex: 1 }}
              />
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
