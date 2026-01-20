import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  TextInput,
  Text,
  Pressable,
  Animated,
} from 'react-native';

interface OTPInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  error?: string;
}

export function OTPInput({
  length = 6,
  value,
  onChange,
  autoFocus = true,
  error,
}: OTPInputProps) {
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);
  const cursorAnim = useRef(new Animated.Value(0)).current;

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
        ])
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
        <View className="flex-row justify-center" style={{ gap: 10 }}>
          {Array.from({ length }).map((_, index) => {
            const digit = getDigit(index);
            const isActive = isDigitActive(index);
            const isFilled = digit !== '';

            return (
              <View
                key={index}
                className={`
                  w-12 h-14 rounded-xl items-center justify-center
                  border-2
                  ${error ? 'border-red-400 bg-red-50' : ''}
                  ${!error && isActive ? 'border-primary-500 bg-primary-50' : ''}
                  ${!error && !isActive && isFilled ? 'border-primary-300 bg-white' : ''}
                  ${!error && !isActive && !isFilled ? 'border-surface-200 bg-surface-50' : ''}
                `}
              >
                {isFilled ? (
                  <Text className="text-2xl font-bold text-surface-900">
                    {digit}
                  </Text>
                ) : isActive ? (
                  <Animated.View
                    style={{
                      width: 2,
                      height: 24,
                      backgroundColor: '#408059',
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
        <View className="flex-row items-center justify-center mt-3">
          <Text className="text-sm text-red-500">{error}</Text>
        </View>
      )}
    </View>
  );
}
