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
import { colors, spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';

interface OTPInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  error?: string;
}

export function OTPInput({ length = 6, value, onChange, autoFocus = true, error }: OTPInputProps) {
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [cursorAnim] = useState(() => new Animated.Value(0));

  // Cursor blinking animation
  useEffect(() => {
    if (isFocused) {
      Animated.loop(
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
      ).start();
    } else {
      cursorAnim.setValue(0);
    }
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
    gap: 10,
  };

  const getBoxStyle = (index: number): ViewStyle => {
    const digit = getDigit(index);
    const isActive = isDigitActive(index);
    const isFilled = digit !== '';

    let borderColor: string = colors.surface[200];
    let backgroundColor: string = colors.surface[50];

    if (error) {
      borderColor = 'rgba(239, 68, 68, 0.6)';
      backgroundColor = 'rgba(254, 242, 242, 1)';
    } else if (isActive) {
      borderColor = colors.primary[500];
      backgroundColor = colors.primary[50];
    } else if (isFilled) {
      borderColor = colors.primary[300];
      backgroundColor = colors.surface[100];
    }

    return {
      width: 48,
      height: 56,
      borderRadius: borderRadius.xl,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor,
      backgroundColor,
    };
  };

  const digitTextStyle: TextStyle = {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.surface[900],
  };

  const errorContainerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing[3],
  };

  const errorTextStyle: TextStyle = {
    fontSize: fontSize.sm,
    color: colors.error,
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
          {Array.from({ length }).map((_, index) => {
            const digit = getDigit(index);
            const isActive = isDigitActive(index);
            const isFilled = digit !== '';

            return (
              <View key={index} style={getBoxStyle(index)}>
                {isFilled ? (
                  <Text style={digitTextStyle}>{digit}</Text>
                ) : isActive ? (
                  <Animated.View
                    style={{
                      width: 2,
                      height: 24,
                      backgroundColor: colors.primary[500],
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
