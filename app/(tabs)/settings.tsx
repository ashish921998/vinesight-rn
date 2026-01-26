import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Switch,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
} from 'react-native';
import { useAuthStore } from '@/stores';
import { useProfile, useUpdateProfile } from '@/hooks';
import { CURRENCIES, AREA_UNITS } from '@/constants/calculatorModels';
import { Symbol } from '@/components/ui/Symbol';

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
    <ScrollView
      className="flex-1 bg-surface-50"
      contentContainerStyle={{ paddingBottom: 32 }}
      style={{ backgroundColor: '#f2f2f7' }}
    >
      {/* Profile Section */}
      <View className="bg-white mx-4 mt-4 rounded-2xl p-4">
        <View className="flex-row items-center">
          <View className="w-16 h-16 bg-primary-100 rounded-full items-center justify-center">
            {userName ? (
              <Text className="text-2xl font-bold text-primary-600">
                {userName.charAt(0).toUpperCase()}
              </Text>
            ) : (
              <Symbol name="person.fill" size={32} color="#408059" />
            )}
          </View>
          <View className="flex-1 ml-4">
            <Text className="text-lg font-semibold text-surface-900">{userName}</Text>
            <Text className="text-sm text-surface-500">{userEmail}</Text>
            {userPhone ? (
              <Text className="text-xs text-surface-400 mt-0.5">{userPhone}</Text>
            ) : null}
          </View>
          <TouchableOpacity onPress={() => setShowEditProfile(true)}>
            <Symbol name="pencil" size={24} color="#408059" />
          </TouchableOpacity>
        </View>
      </View>

      {/* General Section */}
      <View className="mt-6 px-4">
        <Text className="text-xs font-bold text-surface-500 tracking-wider mb-2 px-2">GENERAL</Text>
        <View className="bg-white rounded-2xl overflow-hidden">
          <SettingsItem icon="globe" title="Language" value="System Default" disabled />
          <TouchableOpacity onPress={() => setShowAreaPicker(true)}>
            <SettingsItem
              icon="arrow.up.left.and.arrow.down.right"
              title="Area Unit"
              value={getAreaUnitLabel(selectedAreaUnit)}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowCurrencyPicker(true)}>
            <SettingsItem
              icon="dollarsign.circle"
              title="Currency"
              value={getCurrencyLabel(selectedCurrency)}
              isLast
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Notifications Section */}
      <View className="mt-6 px-4">
        <Text className="text-xs font-bold text-surface-500 tracking-wider mb-2 px-2">
          NOTIFICATIONS
        </Text>
        <View className="bg-white rounded-2xl overflow-hidden">
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
        <Text className="text-xs text-surface-400 mt-2 px-2">
          Notification settings are stored locally
        </Text>
      </View>

      {/* Support Section */}
      <View className="mt-6 px-4">
        <Text className="text-xs font-bold text-surface-500 tracking-wider mb-2 px-2">SUPPORT</Text>
        <View className="bg-white rounded-2xl overflow-hidden">
          <SettingsItem icon="questionmark.circle" title="Help Center" />
          <SettingsItem icon="message" title="Contact Support" />
          <SettingsItem icon="doc.text" title="Privacy Policy" />
          <SettingsItem icon="checkmark.shield" title="Terms of Service" isLast />
        </View>
      </View>

      {/* Account Section */}
      <View className="mt-6 px-4">
        <Text className="text-xs font-bold text-surface-500 tracking-wider mb-2 px-2">ACCOUNT</Text>
        <View className="bg-white rounded-2xl overflow-hidden">
          <TouchableOpacity
            onPress={handleSignOut}
            disabled={authLoading}
            className="flex-row items-center px-4 py-3.5"
          >
            <View className="w-9 h-9 rounded-lg bg-red-100 items-center justify-center">
              <Symbol name="rectangle.portrait.and.arrow.right" size={20} color="#EF4444" />
            </View>
            <Text className="flex-1 ml-3 text-base text-red-600">Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* App Version */}
      <View className="items-center mt-8">
        <Text className="text-sm text-surface-400">Vinesight v1.0.0</Text>
        <Text className="text-xs text-surface-300 mt-1">Made for vineyard management</Text>
      </View>

      {/* Edit Profile Modal */}
      <Modal
        visible={showEditProfile}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowEditProfile(false)}
      >
        <KeyboardAvoidingView
          behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'}
          className="flex-1 bg-surface-50"
        >
          <View className="bg-white px-4 py-4 border-b border-surface-100">
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-bold text-surface-900">Edit Profile</Text>
              <TouchableOpacity onPress={() => setShowEditProfile(false)}>
                <Symbol name="xmark.circle.fill" size={28} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
            <View className="bg-white rounded-2xl p-4">
              <View className="mb-4">
                <Text className="text-sm font-medium text-surface-700 mb-2">Email</Text>
                <View className="bg-surface-100 rounded-xl px-4 py-3">
                  <Text className="text-base text-surface-500">{userEmail}</Text>
                </View>
                <Text className="text-xs text-surface-400 mt-1">Email cannot be changed</Text>
              </View>

              <View className="mb-4">
                <Text className="text-sm font-medium text-surface-700 mb-2">Full Name</Text>
                <TextInput
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Enter your name"
                  placeholderTextColor="#9CA3AF"
                  className="bg-surface-50 rounded-xl px-4 py-3 text-base text-surface-900"
                />
              </View>

              <View className="mb-4">
                <Text className="text-sm font-medium text-surface-700 mb-2">Phone</Text>
                <TextInput
                  value={editPhone}
                  onChangeText={setEditPhone}
                  placeholder="Enter phone number"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="phone-pad"
                  className="bg-surface-50 rounded-xl px-4 py-3 text-base text-surface-900"
                />
              </View>
            </View>
          </ScrollView>

          <View className="bg-white px-4 py-4 border-t border-surface-100">
            <TouchableOpacity
              onPress={handleSaveProfile}
              disabled={isSaving}
              className="py-3.5 rounded-xl items-center"
              style={{ backgroundColor: '#408059' }}
            >
              {isSaving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="text-white font-semibold">Save Changes</Text>
              )}
            </TouchableOpacity>
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
        <View className="flex-1 bg-surface-50">
          <View className="bg-white px-4 py-4 border-b border-surface-100">
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-bold text-surface-900">Select Currency</Text>
              <TouchableOpacity onPress={() => setShowCurrencyPicker(false)}>
                <Symbol name="xmark.circle.fill" size={28} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
          </View>
          <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
            <View className="bg-white rounded-2xl overflow-hidden">
              {CURRENCIES.map((currency, index) => (
                <TouchableOpacity
                  key={currency.code}
                  onPress={() => handleCurrencySelect(currency.code)}
                  className={`flex-row items-center px-4 py-3.5 ${
                    index < CURRENCIES.length - 1 ? 'border-b border-surface-100' : ''
                  }`}
                >
                  <Text className="flex-1 text-base text-surface-900">{currency.label}</Text>
                  {selectedCurrency === currency.code && (
                    <Symbol name="checkmark.circle.fill" size={22} color="#408059" />
                  )}
                </TouchableOpacity>
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
        <View className="flex-1 bg-surface-50">
          <View className="bg-white px-4 py-4 border-b border-surface-100">
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-bold text-surface-900">Select Area Unit</Text>
              <TouchableOpacity onPress={() => setShowAreaPicker(false)}>
                <Symbol name="xmark.circle.fill" size={28} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
          </View>
          <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
            <View className="bg-white rounded-2xl overflow-hidden">
              {AREA_UNITS.map((unit, index) => (
                <TouchableOpacity
                  key={unit.id}
                  onPress={() => {
                    setSelectedAreaUnit(unit.id);
                    setShowAreaPicker(false);
                  }}
                  className={`flex-row items-center px-4 py-3.5 ${
                    index < AREA_UNITS.length - 1 ? 'border-b border-surface-100' : ''
                  }`}
                >
                  <Text className="flex-1 text-base text-surface-900">{unit.label}</Text>
                  {selectedAreaUnit === unit.id && (
                    <Symbol name="checkmark.circle.fill" size={22} color="#408059" />
                  )}
                </TouchableOpacity>
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
    <View
      className={`flex-row items-center px-4 py-3.5 ${
        !isLast ? 'border-b border-surface-100' : ''
      }`}
    >
      <View className="w-9 h-9 rounded-lg bg-surface-100 items-center justify-center">
        <Symbol name={icon} size={20} color="#6B7280" />
      </View>
      <Text className="flex-1 ml-3 text-base text-surface-900">{title}</Text>
      {value && <Text className="text-sm text-surface-500 mr-2">{value}</Text>}
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
    <View
      className={`flex-row items-center px-4 py-3 ${!isLast ? 'border-b border-surface-100' : ''}`}
    >
      <View className="flex-1">
        <Text className="text-base text-surface-900">{title}</Text>
        <Text className="text-xs text-surface-500 mt-0.5">{subtitle}</Text>
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
