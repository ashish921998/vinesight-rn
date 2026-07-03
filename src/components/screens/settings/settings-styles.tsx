import { StyleSheet, type ViewStyle, type TextStyle } from 'react-native';
import { borderRadius, fontSize, fontWeight, getM3Theme, radius, spacing } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { Symbol as UISymbol } from '@/components/ui/symbol';
import { View, Text, Switch, Pressable } from 'react-native';
import React from 'react';

export const createStyles = (m3: ReturnType<typeof getM3Theme>) => ({
  container: { flex: 1, backgroundColor: m3.surface.s50 } as ViewStyle,
  profileCard: {
    backgroundColor: m3.surface.s100,
    marginHorizontal: spacing[4],
    marginTop: spacing[4],
    borderRadius: borderRadius['2xl'],
    padding: spacing[4],
  } as ViewStyle,
  rowCenter: { flexDirection: 'row', alignItems: 'center' } as ViewStyle,
  profileAvatar: {
    width: 64,
    height: 64,
    backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
    borderRadius: radius['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  profileInitial: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: m3.primary.p600,
  } as TextStyle,
  profileInfo: { flex: 1, marginLeft: spacing[4] } as ViewStyle,
  profileName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: m3.surface.s900,
  } as TextStyle,
  profileEmail: { fontSize: fontSize.sm, color: m3.surface.s500 } as TextStyle,
  profilePhone: { fontSize: fontSize.xs, color: m3.surface.s400, marginTop: 2 } as TextStyle,

  section: { marginTop: spacing[6], paddingHorizontal: spacing[4] } as ViewStyle,
  sectionHeader: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: m3.surface.s500,
    letterSpacing: 0.5,
    marginBottom: spacing[2],
    paddingHorizontal: spacing[2],
  } as TextStyle,
  sectionContent: {
    backgroundColor: m3.surface.s100,
    borderRadius: borderRadius['2xl'],
    overflow: 'hidden',
  } as ViewStyle,

  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: 14,
  } as ViewStyle,
  settingsIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.lg,
    backgroundColor: m3.surface.s50,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  signOutIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.lg,
    backgroundColor: colorWithOpacity(m3.colorScheme.error, 0.12),
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  deleteIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.lg,
    backgroundColor: colorWithOpacity(m3.colorScheme.error, 0.2),
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  settingsTitle: {
    flex: 1,
    marginLeft: spacing[3],
    fontSize: fontSize.base,
    color: m3.surface.s900,
  } as TextStyle,
  signOutText: {
    flex: 1,
    marginLeft: spacing[3],
    fontSize: fontSize.base,
    color: m3.colorScheme.error,
  } as TextStyle,
  deleteText: {
    flex: 1,
    marginLeft: spacing[3],
    fontSize: fontSize.base,
    color: m3.colorScheme.error,
  } as TextStyle,
  settingsValue: {
    fontSize: fontSize.sm,
    color: m3.surface.s500,
    marginRight: spacing[2],
  } as TextStyle,
  settingsSubtitle: {
    fontSize: fontSize.xs,
    color: m3.surface.s500,
    marginTop: 2,
  } as TextStyle,
  borderBottom: { borderBottomWidth: 1, borderBottomColor: m3.surface.s200 } as ViewStyle,
  disabledItem: {
    opacity: 0.6,
  } as ViewStyle,

  flex1: { flex: 1 } as ViewStyle,

  appVersionContainer: { alignItems: 'center', marginTop: spacing[8] } as ViewStyle,
  appVersion: { fontSize: fontSize.sm, color: m3.surface.s400 } as TextStyle,
  appVersionSubtitle: {
    fontSize: fontSize.xs,
    color: m3.surface.s500,
    marginTop: spacing[1],
  } as TextStyle,
  sentryTestButton: {
    marginTop: spacing[3],
    backgroundColor: colorWithOpacity(m3.primary.p600, 0.14),
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  } as ViewStyle,
  sentryTestButtonText: {
    color: m3.primary.p700,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  } as TextStyle,

  modalHeader: {
    backgroundColor: m3.surface.s100,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: m3.surface.s200,
  } as ViewStyle,
  modalHeaderInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  } as ViewStyle,
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: m3.surface.s900,
  } as TextStyle,

  formCard: {
    backgroundColor: m3.surface.s100,
    borderRadius: borderRadius['2xl'],
    padding: spacing[4],
  } as ViewStyle,
  mb4: { marginBottom: spacing[4] } as ViewStyle,
  inputLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: m3.surface.s700,
    marginBottom: spacing[2],
  } as TextStyle,
  inputDisabled: {
    backgroundColor: m3.surface.s50,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  } as ViewStyle,
  inputDisabledText: { fontSize: fontSize.base, color: m3.surface.s500 } as TextStyle,
  inputHint: {
    fontSize: fontSize.xs,
    color: m3.surface.s400,
    marginTop: spacing[1],
  } as TextStyle,
  input: {
    backgroundColor: m3.surface.s50,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    fontSize: fontSize.base,
    color: m3.surface.s900,
  } as ViewStyle & TextStyle,
  linkPhoneInputRow: {
    flexDirection: 'row',
    gap: spacing[2],
    alignItems: 'center',
  } as ViewStyle,
  linkPhoneCountryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    backgroundColor: m3.surface.s50,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
  } as ViewStyle,
  linkPhoneCountryCode: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: m3.surface.s900,
  } as TextStyle,
  linkPhoneInputField: {
    flex: 1,
    backgroundColor: m3.surface.s50,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    fontSize: fontSize.base,
    color: m3.surface.s900,
  } as ViewStyle & TextStyle,
  verifyPhoneCta: {
    marginTop: spacing[3],
    alignSelf: 'flex-start',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.lg,
    backgroundColor: colorWithOpacity(m3.primary.p600, 0.12),
  } as ViewStyle,
  verifyPhoneCtaText: {
    color: m3.primary.p700,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  } as TextStyle,

  modalFooter: {
    backgroundColor: m3.surface.s100,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderTopWidth: 1,
    borderTopColor: m3.surface.s200,
  } as ViewStyle,
  saveButton: {
    paddingVertical: 14,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
  } as ViewStyle,
  saveButtonText: { color: m3.colorScheme.onPrimary, fontWeight: fontWeight.semibold } as TextStyle,

  pickerItemText: { flex: 1, fontSize: fontSize.base, color: m3.surface.s900 } as TextStyle,

  alertBox: {
    backgroundColor: colorWithOpacity(m3.colorScheme.error, 0.08),
    borderRadius: borderRadius['2xl'],
    padding: spacing[4],
    marginBottom: spacing[4],
  } as ViewStyle,
  dangerAlert: {
    borderLeftWidth: 4,
    borderLeftColor: m3.colorScheme.error,
  } as ViewStyle,
  alertTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: m3.colorScheme.error,
    marginTop: spacing[2],
  } as TextStyle,
  alertText: {
    fontSize: fontSize.sm,
    color: m3.surface.s700,
    marginTop: spacing[1],
  } as TextStyle,
  deleteWarnings: {
    marginBottom: spacing[4],
  } as ViewStyle,
  deleteWarningItem: {
    fontSize: fontSize.sm,
    color: m3.surface.s600,
    marginBottom: spacing[2],
    paddingLeft: spacing[1],
  } as TextStyle,
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
  } as ViewStyle,
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: radius.xs,
    borderWidth: 2,
    borderColor: m3.surface.s300,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  } as ViewStyle,
  checkboxChecked: {
    backgroundColor: m3.colorScheme.error,
    borderColor: m3.colorScheme.error,
  } as ViewStyle,
  checkboxText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: m3.surface.s700,
    lineHeight: 20,
  } as TextStyle,
  checkboxBold: {
    fontWeight: fontWeight.bold,
    color: m3.colorScheme.error,
  } as TextStyle,
  deleteButton: {
    paddingVertical: 14,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
  } as ViewStyle,
  deleteButtonText: { color: m3.colorScheme.onError, fontWeight: fontWeight.semibold } as TextStyle,
  countryPickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  } as ViewStyle,
  countryPickerBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colorWithOpacity(m3.surface.s900, 0.35),
  } as ViewStyle,
  countryPickerSheet: {
    backgroundColor: m3.surface.s100,
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
    maxHeight: '72%',
    paddingBottom: spacing[4],
  } as ViewStyle,
  countryPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    paddingBottom: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: m3.surface.s200,
  } as ViewStyle,
  countrySearchInput: {
    backgroundColor: m3.surface.s50,
    borderRadius: borderRadius.xl,
    marginHorizontal: spacing[4],
    marginVertical: spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    fontSize: fontSize.base,
    color: m3.surface.s900,
  } as ViewStyle & TextStyle,
  countryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: m3.surface.s200,
  } as ViewStyle,
  countryName: {
    fontSize: fontSize.base,
    color: m3.surface.s900,
  } as TextStyle,
  countryDialCode: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: m3.surface.s600,
  } as TextStyle,
});

export type SettingsStyles = ReturnType<typeof createStyles>;

export function SettingsItem({
  icon,
  title,
  value,
  subtitle,
  toggle,
  isLast,
  disabled,
  styles,
  m3,
}: {
  icon: string;
  title: string;
  value?: string;
  subtitle?: string;
  /** When provided, renders a trailing Switch instead of the value + chevron. */
  toggle?: { value: boolean; onValueChange: (value: boolean) => void };
  isLast?: boolean;
  disabled?: boolean;
  styles: SettingsStyles;
  m3: ReturnType<typeof getM3Theme>;
}) {
  const content = (
    <View style={[styles.settingsItem, !isLast && styles.borderBottom]}>
      <View style={styles.settingsIcon}>
        <UISymbol name={icon} size={20} color={m3.neutral.n500} />
      </View>
      {subtitle ? (
        <View style={{ flex: 1, marginLeft: spacing[3] }}>
          <Text
            style={[styles.settingsTitle, { marginLeft: 0 }]}
            textBreakStrategy="highQuality"
            lineBreakStrategyIOS="standard"
          >
            {title}
          </Text>
          <Text
            style={styles.settingsSubtitle}
            textBreakStrategy="highQuality"
            lineBreakStrategyIOS="standard"
          >
            {subtitle}
          </Text>
        </View>
      ) : (
        <Text
          style={styles.settingsTitle}
          textBreakStrategy="highQuality"
          lineBreakStrategyIOS="standard"
        >
          {title}
        </Text>
      )}
      {toggle ? (
        // The wrapping Pressable is the single accessible control for this row
        // (role=switch + label). Hide the inner Switch from the accessibility
        // tree so screen readers don't announce two switches for one toggle.
        <Switch
          value={toggle.value}
          onValueChange={toggle.onValueChange}
          trackColor={{ false: m3.surface.s300, true: m3.colorScheme.primary }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      ) : (
        <>
          {value && (
            <Text
              style={styles.settingsValue}
              textBreakStrategy="highQuality"
              lineBreakStrategyIOS="standard"
            >
              {value}
            </Text>
          )}
          {!disabled && <UISymbol name="chevron.right" size={18} color={m3.surface.s500} />}
        </>
      )}
    </View>
  );

  // The toggle variant wraps the row in a Pressable so the whole row is tappable
  // (matching the other settings rows) and exposes switch a11y semantics.
  // Non-toggle rows stay a plain View — their tap behavior is supplied by a
  // wrapping Pressable at the call site.
  if (toggle) {
    return (
      <Pressable
        onPress={() => toggle.onValueChange(!toggle.value)}
        accessibilityRole="switch"
        accessibilityState={{ checked: toggle.value }}
        accessibilityLabel={title}
      >
        {content}
      </Pressable>
    );
  }
  return content;
}
