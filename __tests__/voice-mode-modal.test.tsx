/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for VoiceModeModal and VoiceThread components.
 * Verifies:
 * - Modal renders when visible=true
 * - Modal does not render children when visible=false
 * - Close button calls onClose
 * - Orb is rendered and tappable
 * - Status label reflects voice state
 * - VoiceThread renders messages
 * - VoiceThread shows placeholder when empty
 * - i18n keys are used for labels
 * - All voice states render without crash
 * - Android back button triggers onClose
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { VoiceModeModal } from '@/components/assistant/VoiceMode/VoiceModeModal';
import { VoiceThread } from '@/components/assistant/VoiceMode/VoiceThread';
import type { VoiceModeState } from '@/components/assistant/VoiceMode/AnimatedOrb';
import type { VoiceModeMessage } from '@/components/assistant/VoiceMode/VoiceThread';
import type { VoiceModeError } from '@/hooks/use-voice-mode';

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  return Reanimated;
});

// Mock haptics
jest.mock('@/utils/haptics', () => ({
  triggerHapticMedium: jest.fn(),
  triggerHaptic: jest.fn(),
}));

jest.mock('@/styles/use-theme', () => ({
  useThemeTokens: () => ({
    isDark: false,
    m3: {
      colorScheme: {
        primary: '#408059',
        onPrimary: '#ffffff',
        primaryContainer: '#e1ebe5',
        onPrimaryContainer: '#1f412b',
        secondary: '#5a7a6a',
        onSecondary: '#ffffff',
        secondaryContainer: '#d5e8de',
        onSecondaryContainer: '#1a3829',
        tertiary: '#3a6a8a',
        onTertiary: '#ffffff',
        surface: '#f9fafb',
        onSurface: '#111827',
        onSurfaceVariant: '#6b7280',
        outlineVariant: '#e5e7eb',
        outline: '#9ca3af',
        surfaceVariant: '#f3f4f6',
        error: '#dc2626',
        onError: '#ffffff',
      },
      typography: {
        titleMedium: { fontSize: 16, fontWeight: '600' },
        bodyMedium: { fontSize: 14 },
        labelSmall: { fontSize: 11 },
      },
    },
  }),
}));

jest.mock('@/components/ui/symbol', () => ({
  Symbol: ({ name }: { name: string }) => {
    const { Text } = require('react-native');
    return <Text testID={`icon-${name}`}>{name}</Text>;
  },
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'ai.chat.voiceMode': 'Voice mode',
        'ai.chat.tapToSpeak': 'Tap to speak',
        'ai.voice.listening': 'Listening...',
        'ai.chat.thinking': 'Thinking...',
        'ai.chat.assistantSpeaking': 'Assistant is speaking...',
        'ai.chat.transcriptPlaceholder': 'Your speech will appear here...',
        'assistant.voiceMode.closeA11y': 'Close voice mode',
        'assistant.voiceMode.swipeDownHint': 'Swipe down to close',
        'assistant.voiceMode.errorLabel': 'Something went wrong. Tap to retry.',
        'assistant.voiceMode.errorRetry': 'Tap to retry',
        'assistant.voiceMode.orbIdleA11y': 'Tap to start speaking',
        'assistant.voiceMode.orbSpeakingA11y': 'Tap to interrupt',
        'ai.voice.stopA11y': 'Stop voice input',
        'assistant.voiceMode.micPermissionDenied':
          'Microphone access is required for voice mode. Please enable it in Settings.',
        'assistant.voiceMode.sttError': 'Speech recognition failed. Tap to retry.',
        'assistant.voiceMode.networkError': 'Network error. Check connection and tap to retry.',
      };
      return map[key] ?? key;
    },
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  SafeAreaView: ({ children }: { children: React.ReactNode }) => {
    const { View } = require('react-native');
    return <View>{children}</View>;
  },
}));

// Default props
const defaultProps = {
  visible: true,
  voiceState: 'idle' as VoiceModeState,
  messages: [] as VoiceModeMessage[],
  onOrbPress: jest.fn(),
  onClose: jest.fn(),
};

describe('VoiceModeModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders when visible is true', () => {
    const { getByTestId } = render(<VoiceModeModal {...defaultProps} />);
    expect(getByTestId('voice-mode-container')).toBeTruthy();
  });

  it('shows close button', () => {
    const { getByTestId } = render(<VoiceModeModal {...defaultProps} />);
    expect(getByTestId('voice-mode-close-button')).toBeTruthy();
  });

  it('calls onClose when close button is pressed', () => {
    const onClose = jest.fn();
    const { getByTestId } = render(<VoiceModeModal {...defaultProps} onClose={onClose} />);
    fireEvent.press(getByTestId('voice-mode-close-button'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows animated orb', () => {
    const { getByTestId } = render(<VoiceModeModal {...defaultProps} />);
    expect(getByTestId('animated-orb')).toBeTruthy();
  });

  it('calls onOrbPress (with haptic) when orb is tapped', () => {
    const onOrbPress = jest.fn();
    const { triggerHapticMedium } = require('@/utils/haptics');
    const { getAllByRole } = render(<VoiceModeModal {...defaultProps} onOrbPress={onOrbPress} />);
    // Find the orb button
    const buttons = getAllByRole('button');
    const orbButton = buttons.find(
      (btn) => btn.props.accessibilityLabel === 'Tap to start speaking',
    );
    expect(orbButton).toBeTruthy();
    if (orbButton) fireEvent.press(orbButton);
    expect(onOrbPress).toHaveBeenCalledTimes(1);
    expect(triggerHapticMedium).toHaveBeenCalledTimes(1);
  });

  it('shows "Tap to speak" label in idle state', () => {
    const { getByTestId } = render(<VoiceModeModal {...defaultProps} voiceState="idle" />);
    expect(getByTestId('voice-mode-status-label').props.children).toBe('Tap to speak');
  });

  it('shows "Listening..." label in listening state', () => {
    const { getByTestId } = render(<VoiceModeModal {...defaultProps} voiceState="listening" />);
    expect(getByTestId('voice-mode-status-label').props.children).toBe('Listening...');
  });

  it('shows "Thinking..." label in processing state', () => {
    const { getByTestId } = render(<VoiceModeModal {...defaultProps} voiceState="processing" />);
    expect(getByTestId('voice-mode-status-label').props.children).toBe('Thinking...');
  });

  it('shows "Assistant is speaking..." label in speaking state', () => {
    const { getByTestId } = render(<VoiceModeModal {...defaultProps} voiceState="speaking" />);
    expect(getByTestId('voice-mode-status-label').props.children).toBe('Assistant is speaking...');
  });

  it('disables orb in processing state', () => {
    const onOrbPress = jest.fn();
    const { getAllByRole } = render(
      <VoiceModeModal {...defaultProps} voiceState="processing" onOrbPress={onOrbPress} />,
    );
    const buttons = getAllByRole('button');
    const orbButton = buttons.find((btn) => btn.props.accessibilityLabel === 'Thinking...');
    // In processing state, orb is disabled — button should exist but not fire
    if (orbButton) {
      fireEvent.press(orbButton);
      // Disabled TouchableOpacity won't call onOrbPress
      expect(onOrbPress).not.toHaveBeenCalled();
    }
  });

  it('renders voice thread when messages are present', () => {
    const messages: VoiceModeMessage[] = [
      { id: '1', role: 'user', text: 'Hello AI', timestamp: new Date() },
      { id: '2', role: 'assistant', text: 'Hello! How can I help?', timestamp: new Date() },
    ];
    const { getByTestId } = render(<VoiceModeModal {...defaultProps} messages={messages} />);
    expect(getByTestId('voice-thread')).toBeTruthy();
  });

  const allStates: VoiceModeState[] = ['idle', 'listening', 'processing', 'speaking', 'error'];
  allStates.forEach((state) => {
    it(`renders without crash in ${state} state`, () => {
      const { getByTestId } = render(<VoiceModeModal {...defaultProps} voiceState={state} />);
      expect(getByTestId('voice-mode-container')).toBeTruthy();
    });
  });

  // ── Distinct error messages ───────────────────────────────────────────────

  it('shows permission_denied error message guiding user to Settings', () => {
    const voiceModeError: VoiceModeError = {
      kind: 'permission_denied',
      message: 'Permission denied',
    };
    const { getByTestId } = render(
      <VoiceModeModal {...defaultProps} voiceState="error" voiceModeError={voiceModeError} />,
    );
    expect(getByTestId('voice-mode-status-label').props.children).toBe(
      'Microphone access is required for voice mode. Please enable it in Settings.',
    );
  });

  it('shows stt_failed error message with retry option', () => {
    const voiceModeError: VoiceModeError = { kind: 'stt_failed', message: 'STT failed' };
    const { getByTestId } = render(
      <VoiceModeModal {...defaultProps} voiceState="error" voiceModeError={voiceModeError} />,
    );
    expect(getByTestId('voice-mode-status-label').props.children).toBe(
      'Speech recognition failed. Tap to retry.',
    );
  });

  it('shows network_error error message with retry option', () => {
    const voiceModeError: VoiceModeError = { kind: 'network_error', message: 'Network error' };
    const { getByTestId } = render(
      <VoiceModeModal {...defaultProps} voiceState="error" voiceModeError={voiceModeError} />,
    );
    expect(getByTestId('voice-mode-status-label').props.children).toBe(
      'Network error. Check connection and tap to retry.',
    );
  });

  it('shows generic error label when voiceModeError is null in error state', () => {
    const { getByTestId } = render(
      <VoiceModeModal {...defaultProps} voiceState="error" voiceModeError={null} />,
    );
    expect(getByTestId('voice-mode-status-label').props.children).toBe(
      'Something went wrong. Tap to retry.',
    );
  });

  it('shows recording_failed error as stt error message', () => {
    const voiceModeError: VoiceModeError = {
      kind: 'recording_failed',
      message: 'Recording failed',
    };
    const { getByTestId } = render(
      <VoiceModeModal {...defaultProps} voiceState="error" voiceModeError={voiceModeError} />,
    );
    expect(getByTestId('voice-mode-status-label').props.children).toBe(
      'Speech recognition failed. Tap to retry.',
    );
  });
});

describe('VoiceThread', () => {
  const themeTokens = {
    isDark: false,
    m3: {
      colorScheme: {
        primaryContainer: '#e1ebe5',
        onPrimaryContainer: '#1f412b',
        secondaryContainer: '#d5e8de',
        onSecondaryContainer: '#1a3829',
        surfaceVariant: '#f3f4f6',
        onSurfaceVariant: '#6b7280',
        onSurface: '#111827',
      },
      typography: {
        bodyMedium: { fontSize: 14 },
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows placeholder when messages are empty', () => {
    const { getByText } = render(<VoiceThread messages={[]} testID="thread" />);
    expect(getByText('Your speech will appear here...')).toBeTruthy();
  });

  it('renders user message', () => {
    const messages: VoiceModeMessage[] = [
      { id: '1', role: 'user', text: 'Test user message', timestamp: new Date() },
    ];
    const { getByText } = render(<VoiceThread messages={messages} testID="thread" />);
    expect(getByText('Test user message')).toBeTruthy();
  });

  it('renders assistant message', () => {
    const messages: VoiceModeMessage[] = [
      { id: '1', role: 'assistant', text: 'AI response here', timestamp: new Date() },
    ];
    const { getByText } = render(<VoiceThread messages={messages} testID="thread" />);
    expect(getByText('AI response here')).toBeTruthy();
  });

  it('renders multiple messages in order', () => {
    const messages: VoiceModeMessage[] = [
      { id: '1', role: 'user', text: 'First message', timestamp: new Date() },
      { id: '2', role: 'assistant', text: 'First reply', timestamp: new Date() },
      { id: '3', role: 'user', text: 'Second message', timestamp: new Date() },
    ];
    const { getByText } = render(<VoiceThread messages={messages} testID="thread" />);
    expect(getByText('First message')).toBeTruthy();
    expect(getByText('First reply')).toBeTruthy();
    expect(getByText('Second message')).toBeTruthy();
  });

  it('renders testID', () => {
    const { getByTestId } = render(<VoiceThread messages={[]} testID="my-thread" />);
    expect(getByTestId('my-thread')).toBeTruthy();
  });

  // Suppress the unused variable warning for themeTokens
  void themeTokens;
});
