import React, { useState } from 'react';
import { Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';
import { Symbol as IconSymbol } from '@/components/ui/symbol';
import { borderRadius, fontSize, fontWeight, spacing } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';

interface QtyUnitFieldProps {
  value: string;
  onChangeText: (text: string) => void;
  /** Fused chip key ("kg/acre") or the verbatim unit string. */
  unitLabel: string;
  /** Opens the unit menu. */
  onUnitPress: () => void;
  /** Form accent for the focus ring (fertigation success / spray tertiary). */
  accentColor: string;
  placeholder?: string;
  editable?: boolean;
  inputRef?: React.RefObject<TextInput | null>;
  onFocus?: TextInputProps['onFocus'];
  onBlur?: () => void;
  onSubmitEditing?: () => void;
  returnKeyType?: TextInputProps['returnKeyType'];
  blurOnSubmit?: boolean;
  unitAccessibilityLabel?: string;
}

/**
 * One fused input per product dose (v2 drawer design): the quantity on the
 * left, the unit attached as a tappable trailing segment that opens the unit
 * menu. Replaces the separate qty input + unit-chip rows.
 */
export function QtyUnitField({
  value,
  onChangeText,
  unitLabel,
  onUnitPress,
  accentColor,
  placeholder,
  editable = true,
  inputRef,
  onFocus,
  onBlur,
  onSubmitEditing,
  returnKeyType,
  blurOnSubmit,
  unitAccessibilityLabel,
}: QtyUnitFieldProps) {
  const m3 = useM3();
  const [focused, setFocused] = useState(false);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'stretch',
        borderRadius: borderRadius.lg,
        backgroundColor: m3.surface.s100,
        borderWidth: 1.5,
        borderColor: focused ? accentColor : m3.surface.s200,
        overflow: 'hidden',
      }}
    >
      <TextInput
        ref={inputRef}
        style={{
          flex: 1,
          paddingHorizontal: spacing[3],
          paddingVertical: 12,
          fontSize: fontSize.lg,
          fontWeight: fontWeight.bold,
          color: m3.surface.s900,
          textAlign: 'center',
        }}
        placeholder={placeholder}
        placeholderTextColor={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)}
        keyboardType="decimal-pad"
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={() => {
          setFocused(false);
          onBlur?.();
        }}
        onSubmitEditing={onSubmitEditing}
        returnKeyType={returnKeyType}
        blurOnSubmit={blurOnSubmit}
      />
      <Pressable
        onPress={onUnitPress}
        disabled={!editable}
        accessibilityRole="button"
        accessibilityLabel={unitAccessibilityLabel ?? unitLabel}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing[1],
          paddingHorizontal: spacing[3],
          backgroundColor: m3.surface.s50,
          borderLeftWidth: 1.5,
          borderLeftColor: focused ? accentColor : m3.surface.s200,
        }}
      >
        <Text
          style={{ fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: m3.surface.s700 }}
        >
          {unitLabel}
        </Text>
        <IconSymbol name="chevron.down" size={11} color={m3.surface.s600} />
      </Pressable>
    </View>
  );
}
