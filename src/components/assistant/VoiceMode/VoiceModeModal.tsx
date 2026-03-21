/**
 * VoiceModeModal Component
 * Full-screen voice mode overlay with:
 * - Animated orb (5 states: idle / listening / processing / speaking / error)
 * - Scrollable voice conversation thread
 * - Close button (X) accessible in all states
 * - Swipe down to dismiss (gesture-handler + reanimated)
 * - Android back button dismisses (BackHandler)
 * - Theme-aware (light / dark) — M3 tokens only
 * - Haptic feedback on orb tap (expo-haptics)
 * - Animated status label with fade transitions
 */

import React, { useCallback, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  BackHandler,
} from 'react-native';
import { GestureHandlerRootView, GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useThemeTokens } from '@/styles/use-theme';
import { spacing } from '@/styles/theme';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import { triggerHapticMedium } from '@/utils/haptics';
import { AnimatedOrb } from './AnimatedOrb';
import { VoiceThread } from './VoiceThread';
import type { VoiceModeState } from './AnimatedOrb';
import type { VoiceModeMessage } from './VoiceThread';
import type { VoiceModeError } from '@/hooks/use-voice-mode';

export type { VoiceModeState } from './AnimatedOrb';
export type { VoiceModeMessage } from './VoiceThread';

interface VoiceModeModalProps {
  visible: boolean;
  voiceState: VoiceModeState;
  messages: VoiceModeMessage[];
  onOrbPress: () => void;
  onClose: () => void;
  voiceModeError?: VoiceModeError | null;
  onClearError?: () => void;
}

const SWIPE_DOWN_THRESHOLD = 80;

export function VoiceModeModal({
  visible,
  voiceState,
  messages,
  onOrbPress,
  onClose,
  voiceModeError,
  onClearError: _onClearError,
}: VoiceModeModalProps) {
  const { m3, isDark } = useThemeTokens();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const translateY = useSharedValue(0);
  const isDismissing = useSharedValue(0);

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (visible) {
      translateY.value = 0;
      isDismissing.value = 0;
    }
  }, [visible, translateY, isDismissing]);

  // Android back button handler
  useEffect(() => {
    if (!visible) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onCloseRef.current();
      return true;
    });
    return () => sub.remove();
  }, [visible]);

  const dismissModal = useCallback(() => {
    onCloseRef.current();
  }, []);

  const snapBack = useCallback(() => {
    'worklet';
    translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
  }, [translateY]);

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      'worklet';
      if (e.translationY > 0) {
        translateY.value = e.translationY;
      }
    })
    .onEnd((e) => {
      'worklet';
      if (e.translationY > SWIPE_DOWN_THRESHOLD || e.velocityY > 800) {
        isDismissing.value = 1;
        translateY.value = withTiming(800, { duration: 200 }, () => {
          runOnJS(dismissModal)();
        });
      } else {
        snapBack();
      }
    })
    .onFinalize(() => {
      'worklet';
      // Snap back if gesture was cancelled/stolen mid-swipe (not if we're dismissing)
      if (isDismissing.value === 0 && translateY.value > 0) {
        snapBack();
      }
    })
    .activeOffsetY(5)
    .failOffsetX([-15, 15]);

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const handleOrbPress = useCallback(() => {
    if (voiceState === 'error' && _onClearError) _onClearError();
    triggerHapticMedium();
    onOrbPress();
  }, [voiceState, _onClearError, onOrbPress]);

  const getStatusLabel = (): string => {
    switch (voiceState) {
      case 'idle':
        return t('assistant.chat.tapToSpeak');
      case 'listening':
        return t('ai.voice.listening');
      case 'processing':
        return t('assistant.chat.thinking');
      case 'speaking':
        return t('assistant.chat.assistantSpeaking');
      case 'error': {
        if (voiceModeError?.kind === 'permission_denied') {
          return t('assistant.voiceMode.micPermissionDenied');
        }
        if (voiceModeError?.kind === 'stt_failed' || voiceModeError?.kind === 'recording_failed') {
          return t('assistant.voiceMode.sttError');
        }
        if (voiceModeError?.kind === 'network_error' || voiceModeError?.kind === 'timeout') {
          return t('assistant.voiceMode.networkError');
        }
        return t('assistant.voiceMode.errorLabel');
      }
      default:
        return t('assistant.chat.tapToSpeak');
    }
  };

  const bgColor = isDark ? m3.surface.surfaceContainerLow : m3.colorScheme.surface;

  const orbA11y = (): string => {
    switch (voiceState) {
      case 'idle':
        return t('assistant.voiceMode.orbIdleA11y');
      case 'listening':
        return t('ai.voice.stopA11y');
      case 'processing':
        return t('assistant.chat.thinking');
      case 'speaking':
        return t('assistant.voiceMode.orbSpeakingA11y');
      case 'error':
        return t('assistant.voiceMode.errorRetry');
      default:
        return t('assistant.voiceMode.orbIdleA11y');
    }
  };

  const orbDisabled = voiceState === 'processing';
  const statusLabel = getStatusLabel();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      testID="voice-mode-modal"
    >
      <GestureHandlerRootView style={styles.gestureRoot}>
        <Animated.View
          style={[
            styles.container,
            {
              backgroundColor: bgColor,
              paddingTop: insets.top,
              paddingBottom: insets.bottom,
            },
            containerAnimatedStyle,
          ]}
          testID="voice-mode-container"
        >
          {/* Header row with swipe gesture */}
          <GestureDetector gesture={panGesture}>
            <Animated.View style={styles.header}>
              <View style={styles.dragHandleRow}>
                <View
                  style={[styles.dragHandle, { backgroundColor: m3.colorScheme.outlineVariant }]}
                />
              </View>
              <View style={styles.headerContent}>
                <Text
                  style={[
                    styles.headerTitle,
                    {
                      color: m3.colorScheme.onSurface,
                      ...m3.typography.titleMedium,
                    },
                  ]}
                >
                  {t('assistant.chat.voiceMode')}
                </Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={onClose}
                  accessibilityLabel={t('assistant.voiceMode.closeA11y')}
                  accessibilityRole="button"
                  testID="voice-mode-close-button"
                >
                  <SymbolIcon name="xmark" size={20} color={m3.colorScheme.onSurfaceVariant} />
                </TouchableOpacity>
              </View>
            </Animated.View>
          </GestureDetector>

          {/* Conversation thread */}
          <View style={styles.threadContainer}>
            <VoiceThread messages={messages} testID="voice-thread" />
          </View>

          {/* Orb area */}
          <View style={styles.orbArea}>
            {/* Animated status label */}
            <Animated.Text
              key={statusLabel}
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(150)}
              style={[
                styles.statusLabel,
                {
                  color: m3.colorScheme.onSurfaceVariant,
                  ...m3.typography.bodyMedium,
                },
              ]}
              testID="voice-mode-status-label"
            >
              {statusLabel}
            </Animated.Text>

            <AnimatedOrb
              state={voiceState}
              onPress={handleOrbPress}
              disabled={orbDisabled}
              accessibilityLabel={orbA11y()}
              testID="animated-orb"
            />

            {Platform.OS === 'ios' && messages.length === 0 && (
              <Text
                style={[
                  styles.swipeHint,
                  {
                    color: m3.colorScheme.outline ?? m3.colorScheme.onSurfaceVariant,
                    ...m3.typography.labelSmall,
                  },
                ]}
              >
                {t('assistant.voiceMode.swipeDownHint')}
              </Text>
            )}
          </View>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
  },
  dragHandleRow: {
    alignItems: 'center',
    paddingBottom: spacing[2],
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[2],
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    paddingLeft: 40,
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  threadContainer: {
    flex: 1,
    minHeight: 100,
  },
  orbArea: {
    alignItems: 'center',
    paddingVertical: spacing[8],
    paddingBottom: spacing[10],
    gap: spacing[4],
  },
  statusLabel: {
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  swipeHint: {
    textAlign: 'center',
    opacity: 0.5,
    marginTop: spacing[3],
  },
});
