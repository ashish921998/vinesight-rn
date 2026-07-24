import React from 'react';
import { KeyboardAvoidingView, Modal, Pressable, View } from 'react-native';
import { borderRadius } from '@/styles/theme';

interface QuickLogSheetContainerProps {
  open: boolean;
  fullHeight: boolean;
  backgroundColor: string;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * The Expo Compose bottom sheet cannot hand IME focus to nested RN TextInputs
 * on Android. Keep the same sheet presentation in a native RN Modal so inputs
 * receive window focus and the software keyboard opens normally.
 */
export function QuickLogSheetContainer({
  open,
  fullHeight,
  backgroundColor,
  onClose,
  children,
}: QuickLogSheetContainerProps) {
  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView behavior="height" style={{ flex: 1 }}>
        <View
          style={{
            flex: 1,
            justifyContent: 'flex-end',
            backgroundColor: 'rgba(0, 0, 0, 0.32)',
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close quick log"
            onPress={onClose}
            style={{ flex: 1 }}
          />
          <View
            style={{
              height: fullHeight ? '92%' : undefined,
              maxHeight: '92%',
              overflow: 'hidden',
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              backgroundColor,
            }}
          >
            <View
              style={{
                alignSelf: 'center',
                width: 32,
                height: 4,
                marginTop: 10,
                marginBottom: 4,
                borderRadius: borderRadius.full,
                backgroundColor: 'rgba(0, 0, 0, 0.28)',
              }}
            />
            {children}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
