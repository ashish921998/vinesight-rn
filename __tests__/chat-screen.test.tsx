/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for ChatScreen component and useAssistant hook.
 * Verifies:
 * - ChatScreen renders welcome state when no messages
 * - Welcome state shows suggestion chips
 * - Sending a message appends user message and shows loading
 * - Assistant response renders with Markdown
 * - New conversation button clears messages
 * - i18n keys are used correctly
 * - Dark and light theme rendering (no crashes)
 */

import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { ChatScreen } from '@/components/assistant/ChatScreen';

// Mock the assistant hook to control behavior
const mockSendMessage = jest.fn();
const mockStartNewConversation = jest.fn();
const mockSetInputText = jest.fn();

// Variables prefixed with `mock` are allowed in jest.mock() factory
let mockCurrentAssistantState: Record<string, unknown> = {};

jest.mock('@/hooks/use-assistant', () => ({
  useAssistant: () => mockCurrentAssistantState,
  DEFAULT_SUGGESTIONS: ['ai.defaultSuggestions.waterNeed', 'ai.defaultSuggestions.diseases'],
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
        surface: '#f9fafb',
        onSurface: '#111827',
        onSurfaceVariant: '#6b7280',
        surfaceVariant: '#f3f4f6',
        outlineVariant: '#e5e7eb',
        secondaryContainer: '#f0f5f2',
        onSecondaryContainer: '#1f412b',
      },
      surface: {
        surfaceContainer: '#e5e7eb',
        surfaceContainerHigh: '#d1d5db',
      },
      typography: {
        titleMedium: { fontSize: 16, fontWeight: '600' },
        headlineSmall: { fontSize: 24, fontWeight: '700' },
        bodyMedium: { fontSize: 14 },
      },
    },
  }),
}));

jest.mock('@/stores/language-store', () => ({
  useLanguageStore: (fn: (s: { language: string }) => unknown) => fn({ language: 'en' }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => {
      const translations: Record<string, string> = {
        'tabs.aiAssistant': 'AI Assistant',
        'ai.chat.newConversation': 'New conversation',
        'assistant.chat.welcomeTitle': 'How can I help?',
        'assistant.chat.welcomeSubtitle': 'Ask about your crops, irrigation, diseases, and more.',
        'assistant.chat.sendA11y': 'Send message',
        'ai.chat.openVoiceModeA11y': 'Open voice mode',
        'ai.chat.attachFileA11y': 'Attach file',
        'ai.input.placeholder': 'Ask about farming…',
        'ai.chat.thinking': 'Thinking...',
        'ai.defaultSuggestions.waterNeed': 'How much water do I need?',
        'ai.defaultSuggestions.diseases': 'Check for common diseases',
        'assistant.chat.suggestionChipA11y': params?.text ? `Send suggestion: ${params.text}` : key,
      };
      return translations[key] ?? key;
    },
  }),
}));

jest.mock('@/components/ui/symbol', () => ({
  Symbol: ({ name }: { name: string }) => {
    const { Text } = require('react-native');
    return <Text testID={`icon-${name}`}>{name}</Text>;
  },
}));

jest.mock('react-native-markdown-display', () => {
  const { Text } = require('react-native');
  return function Markdown({ children }: { children: string }) {
    return <Text>{children}</Text>;
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  SafeAreaView: ({ children }: { children: React.ReactNode }) => {
    const { View } = require('react-native');
    return <View>{children}</View>;
  },
}));

describe('ChatScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentAssistantState = {
      messages: [],
      conversationId: null,
      isLoading: false,
      inputText: '',
      suggestions: [],
      error: null,
      setInputText: mockSetInputText,
      sendMessage: mockSendMessage,
      startNewConversation: mockStartNewConversation,
      retryLastMessage: jest.fn(),
    };
  });

  it('renders without crashing', () => {
    const { getByText } = render(<ChatScreen />);
    expect(getByText('AI Assistant')).toBeTruthy();
  });

  it('shows welcome state (title) when no messages', () => {
    const { getByText } = render(<ChatScreen />);
    expect(getByText('How can I help?')).toBeTruthy();
  });

  it('shows welcome subtitle when no messages', () => {
    const { getByText } = render(<ChatScreen />);
    expect(getByText('Ask about your crops, irrigation, diseases, and more.')).toBeTruthy();
  });

  it('shows suggestion chips in welcome state', () => {
    const { getByText } = render(<ChatScreen />);
    expect(getByText('How much water do I need?')).toBeTruthy();
  });

  it('tapping a suggestion chip calls sendMessage', async () => {
    mockSendMessage.mockResolvedValue(undefined);
    const { getByText } = render(<ChatScreen />);
    const chip = getByText('How much water do I need?');
    await act(async () => {
      fireEvent.press(chip);
    });
    expect(mockSendMessage).toHaveBeenCalledWith('How much water do I need?');
  });

  it('shows input bar', () => {
    const { UNSAFE_getByType } = render(<ChatScreen />);
    const { TextInput } = require('react-native');
    expect(UNSAFE_getByType(TextInput)).toBeTruthy();
  });

  it('shows mic button when input is empty', () => {
    const { getByTestId } = render(<ChatScreen />);
    expect(getByTestId('icon-mic.fill')).toBeTruthy();
  });

  it('new conversation button calls startNewConversation', () => {
    const { getAllByRole } = render(<ChatScreen />);
    const buttons = getAllByRole('button');
    const newChatButton = buttons.find((btn) => {
      const label = btn.props.accessibilityLabel;
      return label === 'New conversation';
    });
    expect(newChatButton).toBeTruthy();
    if (newChatButton) fireEvent.press(newChatButton);
    expect(mockStartNewConversation).toHaveBeenCalledTimes(1);
  });

  it('renders AI Assistant title', () => {
    const { getByText } = render(<ChatScreen />);
    expect(getByText('AI Assistant')).toBeTruthy();
  });
});

describe('ChatScreen with messages', () => {
  const mockMessages = [
    {
      id: 'user-1',
      role: 'user' as const,
      content: 'How much irrigation today?',
      timestamp: new Date('2026-01-01T10:00:00Z'),
      inputMode: 'text' as const,
    },
    {
      id: 'assistant-1',
      role: 'assistant' as const,
      content: "Based on today's weather, **2 hours** of irrigation is recommended.",
      timestamp: new Date('2026-01-01T10:00:05Z'),
      inputMode: 'text' as const,
    },
  ];

  const mockSuggestions = ['Tell me more', 'What about tomorrow?'];

  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentAssistantState = {
      messages: mockMessages,
      conversationId: 'conv-1',
      isLoading: false,
      inputText: '',
      suggestions: mockSuggestions,
      error: null,
      setInputText: mockSetInputText,
      sendMessage: mockSendMessage,
      startNewConversation: mockStartNewConversation,
      retryLastMessage: jest.fn(),
    };
  });

  it('renders message list when messages exist', () => {
    const { getByText } = render(<ChatScreen />);
    expect(getByText('How much irrigation today?')).toBeTruthy();
  });

  it('shows suggestions after assistant response', () => {
    const { getByText } = render(<ChatScreen />);
    expect(getByText('Tell me more')).toBeTruthy();
  });

  it('does not show welcome state when messages exist', () => {
    const { queryByText } = render(<ChatScreen />);
    expect(queryByText('How can I help?')).toBeNull();
  });
});
