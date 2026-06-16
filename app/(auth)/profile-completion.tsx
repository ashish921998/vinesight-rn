import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '@/stores';
import { useProfile } from '@/hooks';
import { Button, Input } from '@/components/ui';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
import { joinOrganizationBySlug, joinOrgMessage } from '@/services/organization';
import { useTranslation } from 'react-i18next';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { useIsDark, useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';

export default function ProfileCompletionScreen() {
  const { t } = useTranslation();
  const m3 = useM3();
  const isDark = useIsDark();

  const [firstNameDraft, setFirstNameDraft] = useState<string | null>(null);
  const [lastNameDraft, setLastNameDraft] = useState<string | null>(null);
  const [emailDraft, setEmailDraft] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  // Optional consultant code. A farmer who has a consultant enters their org's
  // slug here to self-link via the join_organization_by_slug RPC after their
  // profile is saved. Blank = no consultant (freelance farmer), which is fine.
  const [orgCode, setOrgCode] = useState('');
  const [orgJoinError, setOrgJoinError] = useState<string | null>(null);
  const [orgJoinInfo, setOrgJoinInfo] = useState<string | null>(null);
  const hasRedirectedRef = useRef(false);

  const {
    isLoading,
    errorMessage,
    isAuthenticated,
    needsProfileCompletion,
    user,
    completeProfile,
    clearError,
  } = useAuthStore();
  const { data: profile, isLoading: profileLoading } = useProfile({ enabled: isAuthenticated });
  const hasProfileName = Boolean(profile?.full_name && profile.full_name.trim().length > 0);

  const { defaultFirstName, defaultLastName, defaultEmail } = useMemo(() => {
    const metadata = user?.user_metadata ?? {};
    const metadataFirstName =
      typeof metadata?.first_name === 'string'
        ? metadata.first_name
        : typeof metadata?.given_name === 'string'
          ? metadata.given_name
          : '';
    const metadataLastName =
      typeof metadata?.last_name === 'string'
        ? metadata.last_name
        : typeof metadata?.family_name === 'string'
          ? metadata.family_name
          : '';
    const metadataFullName =
      typeof metadata?.full_name === 'string'
        ? metadata.full_name
        : typeof metadata?.name === 'string'
          ? metadata.name
          : '';
    const splitFullName = metadataFullName.trim().split(/\s+/).filter(Boolean);
    const derivedFirstName = splitFullName[0] ?? '';
    const derivedLastName = splitFullName.slice(1).join(' ');

    return {
      defaultFirstName: metadataFirstName || derivedFirstName || '',
      defaultLastName: metadataLastName || derivedLastName || '',
      defaultEmail: user?.email ?? '',
    };
  }, [user]);

  const firstNameValue = firstNameDraft ?? defaultFirstName;
  const lastNameValue = lastNameDraft ?? defaultLastName;
  const emailValue = emailDraft ?? defaultEmail;

  useEffect(() => {
    if (
      isAuthenticated &&
      !profileLoading &&
      !needsProfileCompletion &&
      hasProfileName &&
      !hasRedirectedRef.current
    ) {
      hasRedirectedRef.current = true;
      router.replace('/');
    }
    if (!isAuthenticated || needsProfileCompletion || !hasProfileName) {
      hasRedirectedRef.current = false;
    }
  }, [isAuthenticated, needsProfileCompletion, hasProfileName, profileLoading]);

  const handleContinue = async () => {
    const trimmedFirstName = firstNameValue.trim();
    const trimmedLastName = lastNameValue.trim();
    if (!trimmedFirstName || !trimmedLastName) return;
    const trimmedEmail = emailValue.trim();
    if (trimmedEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        setEmailError('Please enter a valid email address');
        return;
      }
    }
    setEmailError(null);
    clearError();
    await completeProfile({
      firstName: trimmedFirstName,
      lastName: trimmedLastName,
      email: trimmedEmail || undefined,
    });

    // Profile saved. If the farmer entered a consultant code, link them to that
    // org now. Failures here must NOT block onboarding — the farmer's profile is
    // already saved and they can retry joining from Settings. Surface the message
    // and let the normal redirect proceed on success.
    const trimmedCode = orgCode.trim();
    if (trimmedCode) {
      const result = await joinOrganizationBySlug(trimmedCode);
      if (result.ok) {
        setOrgJoinInfo(
          result.organizationName
            ? `Linked to ${result.organizationName}.`
            : joinOrgMessage(result.status),
        );
        setOrgJoinError(null);
      } else {
        setOrgJoinError(joinOrgMessage(result.status));
        setOrgJoinInfo(null);
      }
    }
  };

  const containerStyle: ViewStyle = {
    flex: 1,
    backgroundColor: m3.colorScheme.surface,
  };

  const contentContainerStyle: ViewStyle = {
    flex: 1,
    paddingHorizontal: spacing[8],
    paddingTop: spacing[16],
    paddingBottom: spacing[8],
  };

  const headerContainerStyle: ViewStyle = {
    alignItems: 'center',
    marginTop: spacing[8],
    marginBottom: spacing[12],
  };

  const iconContainerStyle: ViewStyle = {
    width: 80,
    height: 80,
    borderRadius: borderRadius.full,
    backgroundColor: m3.colorScheme.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[6],
  };

  const titleTextStyle: TextStyle = {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: m3.colorScheme.onSurface,
    textAlign: 'center',
  };

  const subtitleTextStyle: TextStyle = {
    fontSize: fontSize.base,
    color: m3.colorScheme.onSurfaceVariant,
    textAlign: 'center',
    marginTop: spacing[3],
  };

  const formContainerStyle: ViewStyle = {
    flex: 1,
    justifyContent: 'center',
  };

  const formInnerStyle: ViewStyle = {
    gap: spacing[4],
  };

  const errorContainerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.xl,
    marginBottom: spacing[2],
    backgroundColor: colorWithOpacity(m3.colorScheme.error, isDark ? 0.2 : 0.12),
    borderWidth: 1,
    borderColor: colorWithOpacity(m3.colorScheme.error, isDark ? 0.42 : 0.25),
  };

  const errorTextStyle: TextStyle = {
    fontSize: fontSize.sm,
    marginLeft: spacing[2],
    flex: 1,
    color: m3.colorScheme.error,
  };

  const helperTextStyle: TextStyle = {
    fontSize: fontSize.xs,
    color: m3.colorScheme.onSurfaceVariant,
    marginTop: spacing[1],
    marginBottom: spacing[2],
  };

  const infoContainerStyle: ViewStyle = {
    ...errorContainerStyle,
    backgroundColor: colorWithOpacity(m3.colorScheme.primary, isDark ? 0.18 : 0.1),
    borderColor: colorWithOpacity(m3.colorScheme.primary, isDark ? 0.4 : 0.25),
  };

  const infoTextStyle: TextStyle = {
    ...errorTextStyle,
    color: m3.colorScheme.onSurface,
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={containerStyle}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={contentContainerStyle}>
          <View style={headerContainerStyle}>
            <View style={iconContainerStyle}>
              <UiSymbol
                name="person.crop.circle.fill.badge.plus"
                size={40}
                color={m3.colorScheme.primary}
              />
            </View>
            <Text style={titleTextStyle}>{t('profileCompletion.title')}</Text>
            <Text style={subtitleTextStyle}>{t('profileCompletion.subtitle')}</Text>
          </View>

          <View style={formContainerStyle}>
            <View style={formInnerStyle}>
              <Input
                placeholder={t('profileCompletion.firstName')}
                value={firstNameValue}
                onChangeText={setFirstNameDraft}
                leftIcon="person.fill"
                autoCapitalize="words"
                textContentType="givenName"
                containerStyle={{ marginBottom: spacing[4] }}
              />

              <Input
                placeholder={t('profileCompletion.lastName')}
                value={lastNameValue}
                onChangeText={setLastNameDraft}
                leftIcon="person.fill"
                autoCapitalize="words"
                textContentType="familyName"
                containerStyle={{ marginBottom: spacing[4] }}
              />

              <Input
                placeholder={t('profileCompletion.emailPlaceholder')}
                value={emailValue}
                onChangeText={setEmailDraft}
                leftIcon="mail"
                keyboardType="email-address"
                autoCapitalize="none"
                textContentType="emailAddress"
                autoComplete="email"
                containerStyle={{ marginBottom: spacing[2] }}
              />

              <Input
                label={t('profileCompletion.consultantCodeLabel', {
                  defaultValue: 'Consultant code (optional)',
                })}
                placeholder={t('profileCompletion.consultantCodePlaceholder', {
                  defaultValue: 'e.g. acme-agro',
                })}
                value={orgCode}
                onChangeText={(value) => {
                  setOrgCode(value.replace(/\s/g, '').toLowerCase());
                  if (orgJoinError || orgJoinInfo) {
                    setOrgJoinError(null);
                    setOrgJoinInfo(null);
                  }
                }}
                leftIcon="building.2.fill"
                autoCapitalize="none"
                autoCorrect={false}
                containerStyle={{ marginBottom: spacing[1] }}
              />
              <Text style={helperTextStyle}>
                {t('profileCompletion.consultantCodeHelper', {
                  defaultValue:
                    'Got a consultant? Enter the code they gave you to link your farm to them. Skip if not.',
                })}
              </Text>
              {orgJoinInfo && (
                <View style={infoContainerStyle}>
                  <UiSymbol name="checkmark.circle.fill" size={18} color={m3.colorScheme.primary} />
                  <Text style={infoTextStyle}>{orgJoinInfo}</Text>
                </View>
              )}

              {(errorMessage || emailError || orgJoinError) && (
                <View style={errorContainerStyle}>
                  <UiSymbol
                    name="exclamationmark.circle.fill"
                    size={18}
                    color={m3.colorScheme.error}
                  />
                  <Text style={errorTextStyle}>{emailError || orgJoinError || errorMessage}</Text>
                </View>
              )}

              <Button
                title={
                  isLoading
                    ? t('profileCompletion.continuing', { defaultValue: 'Continuing...' })
                    : t('profileCompletion.continue')
                }
                onPress={handleContinue}
                isLoading={isLoading}
                disabled={!firstNameValue.trim() || !lastNameValue.trim()}
                style={{ marginTop: spacing[4] }}
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
