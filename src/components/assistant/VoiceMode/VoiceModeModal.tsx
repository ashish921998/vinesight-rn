/**
 * VoiceModeModal Component
 * Full-screen voice mode overlay with:
 * - Animated orb (5 states: idle / listening / processing / speaking / error)
 * - Scrollable voice conversation thread
 * - Close button (X) accessible in all states
 * - Swipe down to dismiss (PanResponder)
 * - Android back button dismisses (BackHandler)
 * - Theme-aware (light / dark) — M3 tokens only
 * - Haptic feedback on orb tap (expo-haptics)
 *
 * State machine: idle → listening → processing → speaking → idle (loop)
 *                ↑                                        ↓
 *                └────────── error (on failure) ←─────────┘
 *
 * Note: actual audio recording / STT / TTS are wired up by the
 * vm-recording-and-stt and vm-tts-playback-and-loop features.
 * This component exposes callbacks so the parent can drive the state.
 */

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  PanResponder,
  StyleSheet,
  Platform,
  Animated as RNAnimated,
  BackHandler,
} from 'react-native';
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

// Re-export types for external consumers
export type { VoiceModeState } from './AnimatedOrb';
export type { VoiceModeMessage } from './VoiceThread';

interface VoiceModeModalProps {
  visible: boolean;
  /** Current voice state — driven by parent (recording feature) */
  voiceState: VoiceModeState;
  /** Conversation messages to display in the thread */
  messages: VoiceModeMessage[];
  /** Callback when user taps the orb (start/stop) */
  onOrbPress: () => void;
  /** Callback to close the modal */
  onClose: () => void;
  /** Combined error from recording or backend — used to show distinct error messages */
  voiceModeError?: VoiceModeError | null;
  /** Callback to clear the current error */
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

  // Track drag translation for swipe-down-to-dismiss.
  // Using useMemo so the Animated.Value is stable across renders without
  // needing to access .current during the render phase.
  const translateY = useMemo(() => new RNAnimated.Value(0), []);

  // Keep latest onClose callback in a ref to avoid stale closure in PanResponder/BackHandler
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Reset translateY when modal becomes visible
  useEffect(() => {
    if (visible) {
      translateY.setValue(0);
    }
  }, [visible, translateY]);

  // Android back button handler
  useEffect(() => {
    if (!visible) return undefined;

    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onCloseRef.current();
      return true; // Prevent default back navigation
    });

    return () => sub.remove();
  }, [visible]);

  const handleDismiss = useCallback(() => {
    RNAnimated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 60,
      friction: 10,
    }).start();
  }, [translateY]);

  // PanResponder for swipe-down-to-dismiss.
  // useMemo keeps this stable without reading .current during render.
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          // Only capture downward swipes
          return gestureState.dy > 5 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
        },
        onPanResponderGrant: () => {
          // Start tracking drag
        },
        onPanResponderMove: (_, gestureState) => {
          const dy = Math.max(0, gestureState.dy);
          translateY.setValue(dy);
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy > SWIPE_DOWN_THRESHOLD || gestureState.vy > 0.8) {
            // Swipe fast or far enough → dismiss
            RNAnimated.timing(translateY, {
              toValue: 800,
              duration: 200,
              useNativeDriver: true,
            }).start(() => {
              onCloseRef.current();
            });
          } else {
            // Snap back
            handleDismiss();
          }
        },
        onPanResponderTerminate: () => {
          handleDismiss();
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [translateY],
  );

  const handleOrbPress = useCallback(() => {
    if (voiceState === 'error' && _onClearError) _onClearError();
    triggerHapticMedium();
    onOrbPress();
  }, [voiceState, _onClearError, onOrbPress]);

  // Status label based on voice state — shows distinct error messages per error kind
  const getStatusLabel = (): string => {
    switch (voiceState) {
      case 'idle':
        return t('ai.chat.tapToSpeak');
      case 'listening':
        return t('ai.voice.listening');
      case 'processing':
        return t('ai.chat.thinking');
      case 'speaking':
        return t('ai.chat.assistantSpeaking');
      case 'error': {
        // Distinct messages per error kind
        if (voiceModeError?.kind === 'permission_denied') {
          // Guide user to open Settings to grant microphone access
          return t('assistant.voiceMode.micPermissionDenied');
        }
        if (voiceModeError?.kind === 'stt_failed' || voiceModeError?.kind === 'recording_failed') {
          return t('assistant.voiceMode.sttError');
        }
        if (voiceModeError?.kind === 'network_error' || voiceModeError?.kind === 'timeout') {
          return t('assistant.voiceMode.networkError');
        }
        // Fallback generic error
        return t('assistant.voiceMode.errorLabel');
      }
      default:
        return t('ai.chat.tapToSpeak');
    }
  };

  // Background color — slightly different in dark/light
  const bgColor = isDark ? m3.surface.surfaceContainerLow : m3.colorScheme.surface;

  // Orb accessibility label
  const orbA11y = (): string => {
    switch (voiceState) {
      case 'idle':
        return t('assistant.voiceMode.orbIdleA11y');
      case 'listening':
        return t('ai.voice.stopA11y');
      case 'processing':
        return t('ai.chat.thinking');
      case 'speaking':
        return t('assistant.voiceMode.orbSpeakingA11y');
      case 'error':
        return t('assistant.voiceMode.errorRetry');
      default:
        return t('assistant.voiceMode.orbIdleA11y');
    }
  };

  // Whether orb should be disabled (can't tap during processing)
  const orbDisabled = voiceState === 'processing';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      testID="voice-mode-modal"
    >
      <RNAnimated.View
        style={[
          styles.container,
          {
            backgroundColor: bgColor,
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            transform: [{ translateY }],
          },
        ]}
        testID="voice-mode-container"
      >
        {/* Header row: swipe indicator + title + close button.
            Pan handlers are attached here (not the full container) so that
            VoiceThread can scroll freely without triggering modal dismiss. */}
        <View style={styles.header} {...panResponder.panHandlers}>
          {/* Drag handle */}
          <View style={styles.dragHandleRow}>
            <View style={[styles.dragHandle, { backgroundColor: m3.colorScheme.outlineVariant }]} />
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
              {t('ai.chat.voiceMode')}
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
        </View>

        {/* Conversation thread */}
        <View style={styles.threadContainer}>
          <VoiceThread messages={messages} testID="voice-thread" />
        </View>

        {/* Orb area */}
        <View style={styles.orbArea}>
          {/* Status label */}
          <Text
            style={[
              styles.statusLabel,
              {
                color: m3.colorScheme.onSurfaceVariant,
                ...m3.typography.bodyMedium,
              },
            ]}
            testID="voice-mode-status-label"
          >
            {getStatusLabel()}
          </Text>

          {/* Animated Orb */}
          <AnimatedOrb
            state={voiceState}
            onPress={handleOrbPress}
            disabled={orbDisabled}
            accessibilityLabel={orbA11y()}
            testID="animated-orb"
          />

          {/* Swipe hint */}
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
      </RNAnimated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    paddingLeft: 40, // offset for close button width
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
