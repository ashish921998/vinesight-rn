import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  TextInput,
  Text,
  Pressable,
  Animated,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { spacing, fontSize, fontWeight } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { useM3 } from '@/styles/use-theme';

interface OTPInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  error?: string;
  focusKey?: string | number;
}

export function OTPInput({
  length = 6,
  value,
  onChange,
  autoFocus = true,
  error,
  focusKey,
}: OTPInputProps) {
  const m3 = useM3();
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [cursorAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!autoFocus) return;

    const timeoutId = setTimeout(() => {
      inputRef.current?.focus();
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [autoFocus, focusKey]);

  // Cursor blinking animation
  useEffect(() => {
    if (isFocused) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(cursorAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(cursorAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
    cursorAnim.setValue(0);
    return undefined;
  }, [isFocused, cursorAnim]);

  const handleChange = (text: string) => {
    // Only allow digits
    const filtered = text.replace(/[^0-9]/g, '').slice(0, length);
    onChange(filtered);
  };

  const handlePress = () => {
    inputRef.current?.focus();
  };

  const getDigit = (index: number): string => {
    return value[index] || '';
  };

  const isDigitActive = (index: number): boolean => {
    return isFocused && value.length === index;
  };

  const containerStyle: ViewStyle = {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing[2],
  };

  const getBoxStyle = (index: number): ViewStyle => {
    const digit = getDigit(index);
    const isActive = isDigitActive(index);
    const isFilled = digit !== '';

    let borderColor: string = m3.colorScheme.outlineVariant;
    let backgroundColor: string = m3.surface.surfaceContainerLow;

    if (error) {
      borderColor = colorWithOpacity(m3.colorScheme.error, 0.6);
      backgroundColor = m3.colorScheme.errorContainer;
    } else if (isActive) {
      borderColor = m3.colorScheme.primary;
      backgroundColor = m3.colorScheme.primaryContainer;
    } else if (isFilled) {
      borderColor = colorWithOpacity(m3.colorScheme.primary, 0.5);
      backgroundColor = m3.surface.surfaceContainerLow;
    }

    return {
      width: 48,
      minHeight: 56,
      borderRadius: m3.shape.cornerMedium,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor,
      backgroundColor,
      paddingVertical: spacing[2],
    };
  };

  const digitTextStyle: TextStyle = {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: m3.colorScheme.onSurface,
  };

  const errorContainerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing[3],
  };

  const errorTextStyle: TextStyle = {
    fontSize: fontSize.sm,
    color: m3.colorScheme.error,
  };

  return (
    <View>
      {/* Hidden input for keyboard */}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        importantForAutofill="yes"
        maxLength={length}
        autoFocus={autoFocus}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        style={{
          position: 'absolute',
          opacity: 0,
          height: 1,
          width: 1,
        }}
      />

      {/* Visual OTP boxes */}
      <Pressable onPress={handlePress}>
        <View style={containerStyle}>
          {Array.from({ length }, (_, i) => i).map((pos) => {
            const digit = getDigit(pos);
            const isActive = isDigitActive(pos);
            const isFilled = digit !== '';

            return (
              <View key={`otp-box-${pos}`} style={getBoxStyle(pos)}>
                {isFilled ? (
                  <Text style={digitTextStyle}>{digit}</Text>
                ) : isActive ? (
                  <Animated.View
                    style={{
                      width: 2,
                      height: 24,
                      backgroundColor: m3.colorScheme.primary,
                      opacity: cursorAnim,
                    }}
                  />
                ) : null}
              </View>
            );
          })}
        </View>
      </Pressable>

      {error && (
        <View style={errorContainerStyle}>
          <Text style={errorTextStyle}>{error}</Text>
        </View>
      )}
    </View>
  );
}
