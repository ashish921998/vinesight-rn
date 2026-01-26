import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  ViewStyle,
} from 'react-native';
import { Symbol } from '@/components/ui/Symbol';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface FormModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  onSave?: () => void;
  saveLabel?: string;
  isLoading?: boolean;
  isSaveDisabled?: boolean;
  children: React.ReactNode;
  showResetButton?: boolean;
  onReset?: () => void;
}

export function FormModal({
  visible,
  onClose,
  title,
  onSave,
  saveLabel = 'Next',
  isLoading = false,
  isSaveDisabled = false,
  children,
  showResetButton = false,
  onReset,
}: FormModalProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 bg-white"
      >
        <View
          className="flex-row items-center justify-between px-6 border-b border-surface-100"
          style={{ paddingTop: Math.max(insets.top, 12), paddingBottom: 12 }}
        >
          <TouchableOpacity
            onPress={onClose}
            className="w-10 h-10 rounded-full bg-surface-100 items-center justify-center"
            disabled={isLoading}
          >
            <Symbol name="xmark" size={20} color="#111827" />
          </TouchableOpacity>
          <Text
            className="text-lg font-semibold text-surface-900 flex-1 text-center mx-2"
            numberOfLines={1}
          >
            {title}
          </Text>
          <View className="w-10" />
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>

        <View
          className="absolute bottom-0 left-0 right-0 bg-white border-t border-surface-100 px-6 flex-row items-center justify-between"
          style={{ paddingBottom: Math.max(insets.bottom, 16), paddingTop: 16 }}
        >
          {showResetButton && onReset ? (
            <TouchableOpacity onPress={onReset} disabled={isLoading}>
              <Text className="text-base font-semibold text-surface-900 underline">Reset</Text>
            </TouchableOpacity>
          ) : (
            <View />
          )}

          {onSave && (
            <TouchableOpacity
              onPress={onSave}
              disabled={isSaveDisabled || isLoading}
              className="px-8 py-3.5 rounded-xl"
              style={{
                backgroundColor: isSaveDisabled || isLoading ? '#F3F4F6' : '#111827',
              }}
            >
              <Text
                className="text-base font-semibold"
                style={{
                  color: isSaveDisabled || isLoading ? '#9CA3AF' : '#FFFFFF',
                }}
              >
                {isLoading ? 'Saving...' : saveLabel}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

interface FullScreenFormProps {
  title: string;
  onClose: () => void;
  onSave?: () => void;
  saveLabel?: string;
  isLoading?: boolean;
  isSaveDisabled?: boolean;
  children: React.ReactNode;
  showResetButton?: boolean;
  onReset?: () => void;
}

export function FullScreenForm({
  title,
  onClose,
  onSave,
  saveLabel = 'Next',
  isLoading = false,
  isSaveDisabled = false,
  children,
  showResetButton = false,
  onReset,
}: FullScreenFormProps) {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-white">
      <View
        className="flex-row items-center justify-between px-6 border-b border-surface-100"
        style={{ paddingTop: Math.max(insets.top, 12), paddingBottom: 12 }}
      >
        <TouchableOpacity
          onPress={onClose}
          className="w-10 h-10 rounded-full bg-surface-100 items-center justify-center"
          disabled={isLoading}
        >
          <Symbol name="xmark" size={20} color="#111827" />
        </TouchableOpacity>
        <Text
          className="text-lg font-semibold text-surface-900 flex-1 text-center mx-2"
          numberOfLines={1}
        >
          {title}
        </Text>
        <View className="w-10" />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>

        <View
          className="absolute bottom-0 left-0 right-0 bg-white border-t border-surface-100 px-6 flex-row items-center justify-between"
          style={{ paddingBottom: Math.max(insets.bottom, 16), paddingTop: 16 }}
        >
          {showResetButton && onReset ? (
            <TouchableOpacity onPress={onReset} disabled={isLoading}>
              <Text className="text-base font-semibold text-surface-900 underline">Reset</Text>
            </TouchableOpacity>
          ) : (
            <View />
          )}

          {onSave && (
            <TouchableOpacity
              onPress={onSave}
              disabled={isSaveDisabled || isLoading}
              className="px-8 py-3.5 rounded-xl"
              style={{
                backgroundColor: isSaveDisabled || isLoading ? '#F3F4F6' : '#111827',
              }}
            >
              <Text
                className="text-base font-semibold"
                style={{
                  color: isSaveDisabled || isLoading ? '#9CA3AF' : '#FFFFFF',
                }}
              >
                {isLoading ? 'Saving...' : saveLabel}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  style?: ViewStyle;
}

export function SectionHeader({ title, subtitle, style }: SectionHeaderProps) {
  return (
    <View style={style} className="mb-6">
      <Text className="text-3xl font-bold text-surface-900 mb-1">{title}</Text>
      {subtitle && <Text className="text-base text-surface-500 mt-1">{subtitle}</Text>}
    </View>
  );
}

interface PillOption {
  value: string;
  label: string;
  icon?: string;
}

interface PillSelectorProps {
  options: PillOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
  multiSelect?: boolean;
  selectedValues?: string[];
  style?: ViewStyle;
}

export function PillSelector({
  options,
  selectedValue,
  onSelect,
  multiSelect = false,
  selectedValues = [],
  style,
}: PillSelectorProps) {
  const isSelected = (value: string) => {
    if (multiSelect) {
      return selectedValues.includes(value);
    }
    return selectedValue === value;
  };

  return (
    <View style={style} className="flex-row flex-wrap gap-3 mb-6">
      {options.map((option) => {
        const selected = isSelected(option.value);
        return (
          <TouchableOpacity
            key={option.value}
            onPress={() => onSelect(option.value)}
            className="px-6 py-3.5 rounded-full border-2 flex-row items-center"
            style={{
              borderColor: selected ? '#111827' : '#E5E7EB',
              backgroundColor: selected ? '#F9FAFB' : '#FFFFFF',
            }}
          >
            {option.icon && (
              <View style={{ marginRight: 8 }}>
                <Symbol name={option.icon} size={18} color={selected ? '#111827' : '#6B7280'} />
              </View>
            )}
            <Text
              className="text-base font-medium"
              style={{ color: selected ? '#111827' : '#6B7280' }}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

interface SegmentOption {
  value: string;
  label: string;
}

interface SegmentedControlProps {
  options: SegmentOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
}

export function SegmentedControl({ options, selectedValue, onSelect }: SegmentedControlProps) {
  return (
    <View className="flex-row bg-surface-100 rounded-full p-1 mb-6">
      {options.map((option) => {
        const selected = selectedValue === option.value;
        return (
          <TouchableOpacity
            key={option.value}
            onPress={() => onSelect(option.value)}
            className="flex-1 py-2.5 rounded-full items-center"
            style={{
              backgroundColor: selected ? '#FFFFFF' : 'transparent',
            }}
          >
            <Text
              className="text-sm font-medium"
              style={{ color: selected ? '#111827' : '#6B7280' }}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

interface CardOption {
  value: string;
  label: string;
  sublabel?: string;
  icon?: string;
  iconColor?: string;
  renderIcon?: (props: { size: number; color: string; selected: boolean }) => React.ReactNode;
}

interface CardSelectorProps {
  options: CardOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
  columns?: number;
  style?: ViewStyle;
}

export function CardSelector({
  options,
  selectedValue,
  onSelect,
  columns = 2,
  style,
}: CardSelectorProps) {
  return (
    <View style={style} className="flex-row flex-wrap gap-3 mb-6">
      {options.map((option) => {
        const selected = selectedValue === option.value;
        return (
          <TouchableOpacity
            key={option.value}
            onPress={() => onSelect(option.value)}
            className="rounded-2xl border-2 p-3 items-center justify-center"
            style={{
              width: columns === 2 ? '48%' : columns === 3 ? '31%' : '100%',
              borderColor: selected ? '#111827' : '#E5E7EB',
              backgroundColor: selected ? '#F9FAFB' : '#FFFFFF',
            }}
          >
            <View
              className="w-12 h-12 rounded-full items-center justify-center mb-2"
              style={{ backgroundColor: option.iconColor || '#F3F4F6' }}
            >
              {option.renderIcon ? (
                option.renderIcon({
                  size: 24,
                  color: selected ? '#111827' : '#6B7280',
                  selected,
                })
              ) : option.icon ? (
                <Symbol name={option.icon} size={24} color={selected ? '#111827' : '#6B7280'} />
              ) : (
                <Symbol name="questionmark.circle" size={24} color="#9CA3AF" />
              )}
            </View>
            <Text
              className="text-sm font-semibold text-center"
              style={{ color: selected ? '#111827' : '#6B7280' }}
            >
              {option.label}
            </Text>
            {option.sublabel && (
              <Text className="text-xs text-surface-500 text-center mt-0.5">{option.sublabel}</Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

interface FormInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  required?: boolean;
  prefix?: string;
  suffix?: string;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad' | 'phone-pad' | 'email-address';
  multiline?: boolean;
  numberOfLines?: number;
  autoFocus?: boolean;
  style?: ViewStyle;
}

export function FormInput({
  label,
  value,
  onChangeText,
  placeholder,
  required = false,
  prefix,
  suffix,
  keyboardType = 'default',
  multiline = false,
  numberOfLines = 1,
  autoFocus = false,
  style,
}: FormInputProps) {
  return (
    <View style={style} className="mb-6">
      <Text className="text-sm font-medium text-surface-700 mb-2">
        {label}
        {required && <Text className="text-red-500"> *</Text>}
      </Text>
      <View
        className="flex-row items-center bg-white border-2 border-surface-200 rounded-xl overflow-hidden"
        style={multiline ? { alignItems: 'flex-start' } : undefined}
      >
        {prefix && <Text className="text-base text-surface-500 pl-4">{prefix}</Text>}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          keyboardType={keyboardType}
          multiline={multiline}
          numberOfLines={numberOfLines}
          autoFocus={autoFocus}
          className="flex-1 px-4 py-3.5 text-base text-surface-900"
          style={
            multiline ? { minHeight: numberOfLines * 24, textAlignVertical: 'top' } : undefined
          }
        />
        {suffix && <Text className="text-base text-surface-500 pr-4">{suffix}</Text>}
      </View>
    </View>
  );
}

interface ToggleProps {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  style?: ViewStyle;
}

export function Toggle({ label, description, value, onValueChange, style }: ToggleProps) {
  return (
    <TouchableOpacity
      onPress={() => onValueChange(!value)}
      style={style}
      className="flex-row items-center justify-between py-4 mb-4"
      activeOpacity={0.7}
    >
      <View className="flex-1 mr-4">
        <Text className="text-base font-medium text-surface-900">{label}</Text>
        {description && <Text className="text-sm text-surface-500 mt-1">{description}</Text>}
      </View>
      <View
        className="w-14 h-8 rounded-full p-1 justify-center"
        style={{ backgroundColor: value ? '#111827' : '#E5E7EB' }}
      >
        <Animated.View
          className="w-6 h-6 rounded-full bg-white"
          style={{
            transform: [{ translateX: value ? 22 : 0 }],
          }}
        />
      </View>
    </TouchableOpacity>
  );
}

interface InfoCardProps {
  icon: string;
  iconColor?: string;
  backgroundColor?: string;
  title?: string;
  message: string;
  style?: ViewStyle;
}

export function InfoCard({
  icon,
  iconColor = '#3B82F6',
  backgroundColor = '#EFF6FF',
  title,
  message,
  style,
}: InfoCardProps) {
  return (
    <View style={[{ backgroundColor }, style]} className="rounded-2xl p-4 mb-6">
      <View className="flex-row items-start">
        <Symbol name={icon} size={24} color={iconColor} />
        <View className="flex-1 ml-3">
          {title && (
            <Text className="text-sm font-semibold mb-1" style={{ color: iconColor }}>
              {title}
            </Text>
          )}
          <Text className="text-sm" style={{ color: iconColor, opacity: 0.8 }}>
            {message}
          </Text>
        </View>
      </View>
    </View>
  );
}

interface PreviewItem {
  label: string;
  value: string;
}

interface PreviewCardProps {
  title: string;
  items: PreviewItem[];
  backgroundColor?: string;
}

export function PreviewCard({ title, items, backgroundColor = '#F0FDF4' }: PreviewCardProps) {
  return (
    <View className="rounded-2xl p-5 mb-6" style={{ backgroundColor }}>
      <Text className="text-xs font-bold tracking-wider text-surface-600 mb-4">{title}</Text>
      <View className="gap-3">
        {items.map((item, index) => (
          <View key={index} className="flex-row justify-between items-baseline">
            <Text className="text-sm text-surface-600">{item.label}</Text>
            <Text className="text-xl font-bold text-surface-900">{item.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
