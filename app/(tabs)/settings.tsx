import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  TextInput,
  Switch,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { useAuthStore } from '@/stores';
import { useProfile, useUpdateProfile } from '@/hooks';
import { CURRENCIES, AREA_UNITS } from '@/constants/calculator-models';
import { Symbol } from '@/components/ui/symbol';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';

export default function SettingsScreen() {
  const { user, signOut, isLoading: authLoading } = useAuthStore();
  const { data: profile, refetch: refetchProfile } = useProfile();
  const updateProfile = useUpdateProfile();

  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [showAreaPicker, setShowAreaPicker] = useState(false);

  // Edit profile form state
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Local preferences state
  const [selectedCurrency, setSelectedCurrency] = useState('INR');
  const [selectedAreaUnit, setSelectedAreaUnit] = useState('hectares');

  useEffect(() => {
    if (profile) {
      setEditName(profile.full_name || '');
      setEditPhone(profile.phone || '');
      setSelectedCurrency(profile.preferred_currency || 'INR');
      // Area unit from user metadata
    }
    if (user?.user_metadata?.area_unit) {
      setSelectedAreaUnit(user.user_metadata.area_unit as string);
    }
  }, [profile, user]);

  const userName = profile?.full_name || user?.user_metadata?.full_name || 'User';
  const userEmail = profile?.email || user?.email || '';
  const userPhone = profile?.phone || '';

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
          } catch (error) {
            if (__DEV__) {
              console.error('Sign out error:', error);
            }
            Alert.alert('Error', 'Failed to sign out. Please try again.');
          }
        },
      },
    ]);
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      await updateProfile.mutateAsync({
        full_name: editName.trim() || undefined,
        phone: editPhone.trim() || undefined,
        preferred_currency: selectedCurrency,
      });
      setShowEditProfile(false);
      refetchProfile();
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to update profile:', error);
      }
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCurrencySelect = async (code: string) => {
    setSelectedCurrency(code);
    setShowCurrencyPicker(false);
    try {
      await updateProfile.mutateAsync({ preferred_currency: code });
      refetchProfile();
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to update currency:', error);
      }
    }
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
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 32 }}>
      {/* Profile Section */}
      <View style={styles.profileCard}>
        <View style={styles.rowCenter}>
          <View style={styles.profileAvatar}>
            {userName ? (
              <Text style={styles.profileInitial}>{userName.charAt(0).toUpperCase()}</Text>
            ) : (
              <Symbol name="person.fill" size={32} color="#408059" />
            )}
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{userName}</Text>
            <Text style={styles.profileEmail}>{userEmail}</Text>
            {userPhone ? <Text style={styles.profilePhone}>{userPhone}</Text> : null}
          </View>
          <Pressable onPress={() => setShowEditProfile(true)}>
            <Symbol name="pencil" size={24} color="#408059" />
          </Pressable>
        </View>
      </View>

      {/* General Section */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>GENERAL</Text>
        <View style={styles.sectionContent}>
          <SettingsItem icon="globe" title="Language" value="System Default" disabled />
          <Pressable onPress={() => setShowAreaPicker(true)}>
            <SettingsItem
              icon="arrow.up.left.and.arrow.down.right"
              title="Area Unit"
              value={getAreaUnitLabel(selectedAreaUnit)}
            />
          </Pressable>
          <Pressable onPress={() => setShowCurrencyPicker(true)}>
            <SettingsItem
              icon="dollarsign.circle"
              title="Currency"
              value={getCurrencyLabel(selectedCurrency)}
              isLast
            />
          </Pressable>
        </View>
      </View>

      {/* Notifications Section */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>NOTIFICATIONS</Text>
        <View style={styles.sectionContent}>
          <NotificationToggle
            title="Daily Water Reminder"
            subtitle="Remind to check water levels"
          />
          <NotificationToggle
            title="Low Water Alerts"
            subtitle="Alert when water is critically low"
          />
          <NotificationToggle
            title="Task Reminders"
            subtitle="Remind about scheduled tasks"
            isLast
          />
        </View>
        <Text style={styles.notificationNote}>Notification settings are stored locally</Text>
      </View>

      {/* Support Section */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>SUPPORT</Text>
        <View style={styles.sectionContent}>
          <SettingsItem icon="questionmark.circle" title="Help Center" />
          <SettingsItem icon="message" title="Contact Support" />
          <SettingsItem icon="doc.text" title="Privacy Policy" />
          <SettingsItem icon="checkmark.shield" title="Terms of Service" isLast />
        </View>
      </View>

      {/* Account Section */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>ACCOUNT</Text>
        <View style={styles.sectionContent}>
          <Pressable onPress={handleSignOut} disabled={authLoading} style={styles.settingsItem}>
            <View style={styles.signOutIcon}>
              <Symbol name="rectangle.portrait.and.arrow.right" size={20} color="#EF4444" />
            </View>
            <Text style={styles.signOutText}>Sign Out</Text>
          </Pressable>
        </View>
      </View>

      {/* App Version */}
      <View style={styles.appVersionContainer}>
        <Text style={styles.appVersion}>Vinesight v1.0.0</Text>
        <Text style={styles.appVersionSubtitle}>Made for vineyard management</Text>
      </View>

      {/* Edit Profile Modal */}
      <Modal
        visible={showEditProfile}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowEditProfile(false)}
      >
        <KeyboardAvoidingView behavior="padding" style={styles.container}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderInner}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <Pressable onPress={() => setShowEditProfile(false)}>
                <Symbol name="xmark.circle.fill" size={28} color="#9CA3AF" />
              </Pressable>
            </View>
          </View>

          <ScrollView style={styles.flex1} contentContainerStyle={{ padding: 16 }}>
            <View style={styles.formCard}>
              <View style={styles.mb4}>
                <Text style={styles.inputLabel}>Email</Text>
                <View style={styles.inputDisabled}>
                  <Text style={styles.inputDisabledText}>{userEmail}</Text>
                </View>
                <Text style={styles.inputHint}>Email cannot be changed</Text>
              </View>

              <View style={styles.mb4}>
                <Text style={styles.inputLabel}>Full Name</Text>
                <TextInput
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Enter your name"
                  placeholderTextColor="#9CA3AF"
                  style={styles.input}
                />
              </View>

              <View style={styles.mb4}>
                <Text style={styles.inputLabel}>Phone</Text>
                <TextInput
                  value={editPhone}
                  onChangeText={setEditPhone}
                  placeholder="Enter phone number"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="phone-pad"
                  style={styles.input}
                />
              </View>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <Pressable
              onPress={handleSaveProfile}
              disabled={isSaving}
              style={[styles.saveButton, { backgroundColor: colors.primary[600] }]}
            >
              {isSaving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>Save Changes</Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Currency Picker Modal */}
      <Modal
        visible={showCurrencyPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCurrencyPicker(false)}
      >
        <View style={styles.container}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderInner}>
              <Text style={styles.modalTitle}>Select Currency</Text>
              <Pressable onPress={() => setShowCurrencyPicker(false)}>
                <Symbol name="xmark.circle.fill" size={28} color="#9CA3AF" />
              </Pressable>
            </View>
          </View>
          <ScrollView style={styles.flex1} contentContainerStyle={{ padding: 16 }}>
            <View style={styles.sectionContent}>
              {CURRENCIES.map((currency, index) => (
                <Pressable
                  key={currency.code}
                  onPress={() => handleCurrencySelect(currency.code)}
                  style={[
                    styles.settingsItem,
                    index < CURRENCIES.length - 1 && styles.borderBottom,
                  ]}
                >
                  <Text style={styles.pickerItemText}>{currency.label}</Text>
                  {selectedCurrency === currency.code && (
                    <Symbol name="checkmark.circle.fill" size={22} color="#408059" />
                  )}
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Area Unit Picker Modal */}
      <Modal
        visible={showAreaPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAreaPicker(false)}
      >
        <View style={styles.container}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderInner}>
              <Text style={styles.modalTitle}>Select Area Unit</Text>
              <Pressable onPress={() => setShowAreaPicker(false)}>
                <Symbol name="xmark.circle.fill" size={28} color="#9CA3AF" />
              </Pressable>
            </View>
          </View>
          <ScrollView style={styles.flex1} contentContainerStyle={{ padding: 16 }}>
            <View style={styles.sectionContent}>
              {AREA_UNITS.map((unit, index) => (
                <Pressable
                  key={unit.id}
                  onPress={() => {
                    setSelectedAreaUnit(unit.id);
                    setShowAreaPicker(false);
                  }}
                  style={[
                    styles.settingsItem,
                    index < AREA_UNITS.length - 1 && styles.borderBottom,
                  ]}
                >
                  <Text style={styles.pickerItemText}>{unit.label}</Text>
                  {selectedAreaUnit === unit.id && (
                    <Symbol name="checkmark.circle.fill" size={22} color="#408059" />
                  )}
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

// Settings Item Component
function SettingsItem({
  icon,
  title,
  value,
  isLast,
  disabled,
}: {
  icon: string;
  title: string;
  value?: string;
  isLast?: boolean;
  disabled?: boolean;
}) {
  return (
    <View style={[styles.settingsItem, !isLast && styles.borderBottom]}>
      <View style={styles.settingsIcon}>
        <Symbol name={icon} size={20} color="#6B7280" />
      </View>
      <Text style={styles.settingsTitle}>{title}</Text>
      {value && <Text style={styles.settingsValue}>{value}</Text>}
      {!disabled && <Symbol name="chevron.right" size={18} color="#D1D5DB" />}
    </View>
  );
}

// Notification Toggle Component
function NotificationToggle({
  title,
  subtitle,
  isLast,
}: {
  title: string;
  subtitle: string;
  isLast?: boolean;
}) {
  const [enabled, setEnabled] = useState(false);

  return (
    <View style={[styles.notificationItem, !isLast && styles.borderBottom]}>
      <View style={styles.flex1}>
        <Text style={styles.notificationTitle}>{title}</Text>
        <Text style={styles.notificationSubtitle}>{subtitle}</Text>
      </View>
      <Switch
        value={enabled}
        onValueChange={setEnabled}
        trackColor={{ false: '#D1D5DB', true: '#86EFAC' }}
        thumbColor={enabled ? '#22C55E' : '#F3F4F6'}
      />
    </View>
  );
}

const styles = {
  container: { flex: 1, backgroundColor: colors.surface[50] } as ViewStyle,
  profileCard: {
    backgroundColor: colors.surface[100],
    marginHorizontal: spacing[4],
    marginTop: spacing[4],
    borderRadius: borderRadius['2xl'],
    padding: spacing[4],
  } as ViewStyle,
  rowCenter: { flexDirection: 'row', alignItems: 'center' } as ViewStyle,
  profileAvatar: {
    width: 64,
    height: 64,
    backgroundColor: 'rgba(64, 128, 89, 0.1)',
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  profileInitial: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.primary[600],
  } as TextStyle,
  profileInfo: { flex: 1, marginLeft: spacing[4] } as ViewStyle,
  profileName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.surface[900],
  } as TextStyle,
  profileEmail: { fontSize: fontSize.sm, color: colors.surface[500] } as TextStyle,
  profilePhone: { fontSize: fontSize.xs, color: colors.surface[400], marginTop: 2 } as TextStyle,

  section: { marginTop: spacing[6], paddingHorizontal: spacing[4] } as ViewStyle,
  sectionHeader: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.surface[500],
    letterSpacing: 0.5,
    marginBottom: spacing[2],
    paddingHorizontal: spacing[2],
  } as TextStyle,
  sectionContent: {
    backgroundColor: colors.surface[100],
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
    backgroundColor: colors.surface[50],
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  signOutIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.lg,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  settingsTitle: {
    flex: 1,
    marginLeft: spacing[3],
    fontSize: fontSize.base,
    color: colors.surface[900],
  } as TextStyle,
  signOutText: {
    flex: 1,
    marginLeft: spacing[3],
    fontSize: fontSize.base,
    color: '#DC2626',
  } as TextStyle,
  settingsValue: {
    fontSize: fontSize.sm,
    color: colors.surface[500],
    marginRight: spacing[2],
  } as TextStyle,
  borderBottom: { borderBottomWidth: 1, borderBottomColor: colors.surface[50] } as ViewStyle,

  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  } as ViewStyle,
  flex1: { flex: 1 } as ViewStyle,
  notificationTitle: { fontSize: fontSize.base, color: colors.surface[900] } as TextStyle,
  notificationSubtitle: {
    fontSize: fontSize.xs,
    color: colors.surface[500],
    marginTop: 2,
  } as TextStyle,
  notificationNote: {
    fontSize: fontSize.xs,
    color: colors.surface[400],
    marginTop: spacing[2],
    paddingHorizontal: spacing[2],
  } as TextStyle,

  appVersionContainer: { alignItems: 'center', marginTop: spacing[8] } as ViewStyle,
  appVersion: { fontSize: fontSize.sm, color: colors.surface[400] } as TextStyle,
  appVersionSubtitle: {
    fontSize: fontSize.xs,
    color: '#D1D5DB',
    marginTop: spacing[1],
  } as TextStyle,

  modalContainer: { flex: 1, backgroundColor: colors.surface[50] } as ViewStyle,
  modalHeader: {
    backgroundColor: colors.surface[100],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.surface[50],
  } as ViewStyle,
  modalHeaderInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  } as ViewStyle,
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.surface[900],
  } as TextStyle,

  formCard: {
    backgroundColor: colors.surface[100],
    borderRadius: borderRadius['2xl'],
    padding: spacing[4],
  } as ViewStyle,
  mb4: { marginBottom: spacing[4] } as ViewStyle,
  inputLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.surface[700],
    marginBottom: spacing[2],
  } as TextStyle,
  inputDisabled: {
    backgroundColor: colors.surface[50],
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  } as ViewStyle,
  inputDisabledText: { fontSize: fontSize.base, color: colors.surface[500] } as TextStyle,
  inputHint: {
    fontSize: fontSize.xs,
    color: colors.surface[400],
    marginTop: spacing[1],
  } as TextStyle,
  input: {
    backgroundColor: colors.surface[50],
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    fontSize: fontSize.base,
    color: colors.surface[900],
  } as ViewStyle & TextStyle,

  modalFooter: {
    backgroundColor: colors.surface[100],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.surface[50],
  } as ViewStyle,
  saveButton: {
    paddingVertical: 14,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
  } as ViewStyle,
  saveButtonText: { color: colors.surface[100], fontWeight: fontWeight.semibold } as TextStyle,

  pickerItemText: { flex: 1, fontSize: fontSize.base, color: colors.surface[900] } as TextStyle,
};
