import React, { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import {
  View,
  Text,
  Pressable,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  ScrollView,
  Animated,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { Symbol as IconSymbol } from '@/components/ui/symbol';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, fontSize, fontWeight, shadows } from '@/styles/theme';

interface FormModalProps {
  visible?: boolean;
  onClose: () => void;
  title: string;
  onSave?: () => void;
  saveLabel?: string;
  isLoading?: boolean;
  isSaveDisabled?: boolean;
  children: React.ReactNode;
  showResetButton?: boolean;
  onReset?: () => void;
  presentation?: 'modal' | 'screen';
  scrollViewRef?: React.Ref<ScrollView>;
  scrollViewProps?: ScrollViewProps;
  scrollViewStyle?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
}

export function FormModal({
  visible = true,
  onClose,
  title,
  onSave,
  saveLabel = 'Next',
  isLoading = false,
  isSaveDisabled = false,
  children,
  showResetButton = false,
  onReset,
  presentation = 'modal',
  scrollViewRef,
  scrollViewProps,
  scrollViewStyle,
  contentContainerStyle,
}: FormModalProps) {
  const insets = useSafeAreaInsets();
  const {
    style: scrollStyle,
    contentContainerStyle: scrollContentStyle,
    ...restScrollProps
  } = scrollViewProps ?? {};

  const headerStyle: ViewStyle = {
    borderBottomWidth: 1,
    borderBottomColor: colors.surface[100],
    paddingTop: Math.max(insets.top, 12),
    paddingBottom: 12,
    paddingHorizontal: spacing[6],
    backgroundColor: colors.white,
  };

  const handleStyle: ViewStyle = {
    alignSelf: 'center',
    width: 48,
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.surface[100],
    marginBottom: 8,
  };

  const titleStyle: TextStyle = {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.surface[900],
    textAlign: 'center',
  };

  const footerStyle: ViewStyle = {
    backgroundColor: colors.surface[100],
    borderTopWidth: 1,
    borderTopColor: colors.surface[100],
    paddingHorizontal: spacing[6],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Math.max(insets.bottom, 16),
    paddingTop: 16,
  };

  const resetTextStyle: TextStyle = {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.surface[900],
    textDecorationLine: 'underline',
  };

  const saveButtonStyle: ViewStyle = {
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.xl,
    backgroundColor: isSaveDisabled || isLoading ? '#F3F4F6' : '#111827',
  };

  const saveTextStyle: TextStyle = {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: isSaveDisabled || isLoading ? '#9CA3AF' : colors.surface[100],
  };

  const content = (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: colors.surface[100] }}
    >
      <View style={headerStyle}>
        <View style={handleStyle} />
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 40 }} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={titleStyle} numberOfLines={2} accessibilityRole="header">
              {title}
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={{ width: 40, alignItems: 'flex-end' }}
          >
            <IconSymbol name="xmark.circle.fill" size={26} color={colors.surface[300]} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={[{ flex: 1 }, scrollViewStyle, scrollStyle]}
        contentContainerStyle={[
          {
            paddingHorizontal: spacing[6],
            paddingTop: spacing[6],
            paddingBottom: spacing[6],
          },
          contentContainerStyle,
          scrollContentStyle,
        ]}
        showsVerticalScrollIndicator={false}
        {...restScrollProps}
      >
        {children}
      </ScrollView>

      <View style={footerStyle}>
        {showResetButton && onReset ? (
          <Pressable onPress={onReset} disabled={isLoading}>
            <Text style={resetTextStyle}>Reset</Text>
          </Pressable>
        ) : (
          <View />
        )}

        {onSave && (
          <Pressable
            onPress={onSave}
            disabled={isSaveDisabled || isLoading}
            style={saveButtonStyle}
          >
            <Text style={saveTextStyle}>{isLoading ? 'Saving...' : saveLabel}</Text>
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  );

  if (presentation === 'screen') {
    return content;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      {content}
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

  const headerStyle: ViewStyle = {
    borderBottomWidth: 1,
    borderBottomColor: colors.surface[100],
    paddingTop: Math.max(insets.top, 12),
    paddingBottom: 12,
    paddingHorizontal: spacing[6],
    backgroundColor: colors.white,
  };

  const handleStyle: ViewStyle = {
    alignSelf: 'center',
    width: 48,
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.surface[100],
    marginBottom: 8,
  };

  const titleStyle: TextStyle = {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.surface[900],
    textAlign: 'center',
  };

  const footerStyle: ViewStyle = {
    backgroundColor: colors.surface[100],
    borderTopWidth: 1,
    borderTopColor: colors.surface[100],
    paddingHorizontal: spacing[6],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Math.max(insets.bottom, 16),
    paddingTop: 16,
  };

  const resetTextStyle: TextStyle = {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.surface[900],
    textDecorationLine: 'underline',
  };

  const saveButtonStyle: ViewStyle = {
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.xl,
    backgroundColor: isSaveDisabled || isLoading ? '#F3F4F6' : '#111827',
  };

  const saveTextStyle: TextStyle = {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: isSaveDisabled || isLoading ? '#9CA3AF' : colors.surface[100],
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface[100] }}>
      <View style={headerStyle}>
        <View style={handleStyle} />
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 40 }} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={titleStyle} numberOfLines={2} accessibilityRole="header">
              {title}
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={{ width: 40, alignItems: 'flex-end' }}
          >
            <IconSymbol name="xmark.circle.fill" size={26} color={colors.surface[300]} />
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: spacing[6],
            paddingTop: spacing[6],
            paddingBottom: spacing[6],
          }}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>

        <View style={footerStyle}>
          {showResetButton && onReset ? (
            <Pressable onPress={onReset} disabled={isLoading}>
              <Text style={resetTextStyle}>Reset</Text>
            </Pressable>
          ) : (
            <View />
          )}

          {onSave && (
            <Pressable
              onPress={onSave}
              disabled={isSaveDisabled || isLoading}
              style={saveButtonStyle}
            >
              <Text style={saveTextStyle}>{isLoading ? 'Saving...' : saveLabel}</Text>
            </Pressable>
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
  const containerStyle: ViewStyle = {
    marginBottom: spacing[6],
  };

  const titleTextStyle: TextStyle = {
    fontSize: fontSize['3xl'],
    fontWeight: fontWeight.bold,
    color: colors.surface[900],
    marginBottom: spacing[1],
  };

  const subtitleTextStyle: TextStyle = {
    fontSize: fontSize.base,
    color: colors.surface[500],
    marginTop: spacing[1],
  };

  return (
    <View style={[containerStyle, style]}>
      <Text style={titleTextStyle}>{title}</Text>
      {subtitle && <Text style={subtitleTextStyle}>{subtitle}</Text>}
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

  const containerStyle: ViewStyle = {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
    marginBottom: spacing[6],
  };

  const getPillStyle = (selected: boolean): ViewStyle => ({
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.full,
    borderWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
    borderColor: selected ? '#111827' : '#E5E7EB',
    backgroundColor: selected ? '#F9FAFB' : colors.surface[100],
  });

  const getPillTextStyle = (selected: boolean): TextStyle => ({
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    color: selected ? '#111827' : '#6B7280',
  });

  return (
    <View style={[containerStyle, style]}>
      {options.map((option) => {
        const selected = isSelected(option.value);
        return (
          <Pressable
            key={option.value}
            onPress={() => onSelect(option.value)}
            style={getPillStyle(selected)}
          >
            {option.icon && (
              <View style={{ marginRight: 8 }}>
                <IconSymbol name={option.icon} size={18} color={selected ? '#111827' : '#6B7280'} />
              </View>
            )}
            <Text style={getPillTextStyle(selected)}>{option.label}</Text>
          </Pressable>
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
  const containerStyle: ViewStyle = {
    flexDirection: 'row',
    backgroundColor: colors.surface[200],
    borderColor: colors.surface[300],
    borderWidth: 1,
    borderRadius: borderRadius.full,
    padding: spacing[1],
    gap: spacing[1],
    borderCurve: 'continuous',
  };

  const getSegmentStyle = (selected: boolean, pressed: boolean): ViewStyle => ({
    flex: 1,
    paddingVertical: spacing[2],
    borderRadius: borderRadius.full,
    alignItems: 'center',
    backgroundColor: selected ? colors.white : pressed ? colors.surface[300] : 'transparent',
    borderWidth: selected ? 1 : 0,
    borderColor: selected ? colors.surface[300] : 'transparent',
    borderCurve: 'continuous',
    ...(selected ? { ...shadows.sm, elevation: 2 } : null),
  });

  const getSegmentTextStyle = (selected: boolean): TextStyle => ({
    fontSize: fontSize.sm,
    fontWeight: selected ? fontWeight.semibold : fontWeight.medium,
    color: selected ? colors.gray[900] : colors.gray[500],
  });

  return (
    <View style={containerStyle}>
      {options.map((option) => {
        const selected = selectedValue === option.value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onSelect(option.value)}
            style={({ pressed }) => getSegmentStyle(selected, pressed)}
          >
            <Text style={getSegmentTextStyle(selected)}>{option.label}</Text>
          </Pressable>
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
  const containerStyle: ViewStyle = {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
    marginBottom: spacing[6],
  };

  const getCardStyle = (selected: boolean): ViewStyle => ({
    width: columns === 2 ? '48%' : columns === 3 ? '31%' : '100%',
    borderRadius: borderRadius['2xl'],
    borderWidth: 2,
    padding: spacing[3],
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: selected ? '#111827' : '#E5E7EB',
    backgroundColor: selected ? '#F9FAFB' : colors.surface[100],
  });

  const iconContainerStyle: ViewStyle = {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[2],
  };

  const getLabelTextStyle = (selected: boolean): TextStyle => ({
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
    color: selected ? '#111827' : '#6B7280',
  });

  const sublabelTextStyle: TextStyle = {
    fontSize: fontSize.xs,
    color: colors.surface[500],
    textAlign: 'center',
    marginTop: 2,
  };

  return (
    <View style={[containerStyle, style]}>
      {options.map((option) => {
        const selected = selectedValue === option.value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onSelect(option.value)}
            style={getCardStyle(selected)}
          >
            <View style={[iconContainerStyle, { backgroundColor: option.iconColor || '#F3F4F6' }]}>
              {option.renderIcon ? (
                option.renderIcon({
                  size: 24,
                  color: selected ? '#111827' : '#6B7280',
                  selected,
                })
              ) : option.icon ? (
                <IconSymbol name={option.icon} size={24} color={selected ? '#111827' : '#6B7280'} />
              ) : (
                <IconSymbol name="questionmark.circle" size={24} color="#9CA3AF" />
              )}
            </View>
            <Text style={getLabelTextStyle(selected)}>{option.label}</Text>
            {option.sublabel && <Text style={sublabelTextStyle}>{option.sublabel}</Text>}
          </Pressable>
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
  const containerStyle: ViewStyle = {
    marginBottom: spacing[6],
  };

  const labelStyle: TextStyle = {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.surface[700],
    marginBottom: spacing[2],
  };

  const requiredStyle: TextStyle = {
    color: colors.error,
  };

  const inputContainerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: multiline ? 'flex-start' : 'center',
    backgroundColor: colors.surface[100],
    borderWidth: 2,
    borderColor: colors.surface[200],
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  };

  const prefixSuffixStyle: TextStyle = {
    fontSize: fontSize.base,
    color: colors.surface[500],
  };

  const inputStyle: TextStyle = {
    flex: 1,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    fontSize: fontSize.base,
    color: colors.surface[900],
  };

  return (
    <View style={[containerStyle, style]}>
      <Text style={labelStyle}>
        {label}
        {required && <Text style={requiredStyle}> *</Text>}
      </Text>
      <View style={inputContainerStyle}>
        {prefix && <Text style={[prefixSuffixStyle, { paddingLeft: spacing[4] }]}>{prefix}</Text>}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          keyboardType={keyboardType}
          multiline={multiline}
          numberOfLines={numberOfLines}
          autoFocus={autoFocus}
          style={[
            inputStyle,
            multiline && { minHeight: numberOfLines * 24, textAlignVertical: 'top' },
          ]}
        />
        {suffix && <Text style={[prefixSuffixStyle, { paddingRight: spacing[4] }]}>{suffix}</Text>}
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
  const translateXAnimRef = useRef(new Animated.Value(value ? 22 : 0));

  useEffect(() => {
    Animated.timing(translateXAnimRef.current, {
      toValue: value ? 22 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [value]);

  const containerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[4],
    marginBottom: spacing[4],
  };

  const labelContainerStyle: ViewStyle = {
    flex: 1,
    marginRight: spacing[4],
  };

  const labelTextStyle: TextStyle = {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    color: colors.surface[900],
  };

  const descriptionTextStyle: TextStyle = {
    fontSize: fontSize.sm,
    color: colors.surface[500],
    marginTop: spacing[1],
  };

  const toggleContainerStyle: ViewStyle = {
    width: 56,
    height: 32,
    borderRadius: borderRadius.full,
    padding: spacing[1],
    justifyContent: 'center',
    backgroundColor: value ? '#111827' : '#E5E7EB',
  };

  const toggleCircleStyle: ViewStyle = {
    width: 24,
    height: 24,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface[100],
  };

  return (
    <Pressable onPress={() => onValueChange(!value)} style={[containerStyle, style]}>
      <View style={labelContainerStyle}>
        <Text style={labelTextStyle}>{label}</Text>
        {description && <Text style={descriptionTextStyle}>{description}</Text>}
      </View>
      <View style={toggleContainerStyle}>
        <Animated.View
          style={[
            toggleCircleStyle,
            {
              // eslint-disable-next-line react-hooks/refs
              transform: [{ translateX: translateXAnimRef.current }],
            },
          ]}
        />
      </View>
    </Pressable>
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
  const containerStyle: ViewStyle = {
    backgroundColor,
    borderRadius: borderRadius['2xl'],
    padding: spacing[4],
    marginBottom: spacing[6],
  };

  const contentContainerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'flex-start',
  };

  const textContainerStyle: ViewStyle = {
    flex: 1,
    marginLeft: spacing[3],
  };

  const titleTextStyle: TextStyle = {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing[1],
    color: iconColor,
  };

  const messageTextStyle: TextStyle = {
    fontSize: fontSize.sm,
    color: iconColor,
    opacity: 0.8,
  };

  return (
    <View style={[containerStyle, style]}>
      <View style={contentContainerStyle}>
        <IconSymbol name={icon} size={24} color={iconColor} />
        <View style={textContainerStyle}>
          {title && <Text style={titleTextStyle}>{title}</Text>}
          <Text style={messageTextStyle}>{message}</Text>
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
  const containerStyle: ViewStyle = {
    borderRadius: borderRadius['2xl'],
    padding: spacing[5],
    marginBottom: spacing[6],
    backgroundColor,
  };

  const titleTextStyle: TextStyle = {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    letterSpacing: 1.2,
    color: colors.surface[600],
    marginBottom: spacing[4],
  };

  const itemsContainerStyle: ViewStyle = {
    gap: spacing[3],
  };

  const itemStyle: ViewStyle = {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  };

  const labelTextStyle: TextStyle = {
    fontSize: fontSize.sm,
    color: colors.surface[600],
  };

  const valueTextStyle: TextStyle = {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.surface[900],
  };

  return (
    <View style={containerStyle}>
      <Text style={titleTextStyle}>{title}</Text>
      <View style={itemsContainerStyle}>
        {items.map((item, index) => (
          <View key={index} style={itemStyle}>
            <Text style={labelTextStyle}>{item.label}</Text>
            <Text style={valueTextStyle}>{item.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
