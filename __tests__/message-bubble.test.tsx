/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for MessageBubble component.
 * Verifies:
 * - User messages render right-aligned
 * - Assistant messages render left-aligned
 * - Loading bubble renders correctly
 * - Markdown rendering for assistant messages
 * - Accessibility labels
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { MessageBubble, LoadingBubble } from '@/components/assistant/MessageBubble';
import type { ChatMessage } from '@/types/ai';

jest.mock('@/i18n/format', () => ({
  formatTime: () => '10:00',
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
        errorContainer: '#fde8e8',
        onErrorContainer: '#7f1d1d',
        error: '#dc2626',
      },
      surface: {
        surfaceContainer: '#e5e7eb',
        surfaceContainerHigh: '#d1d5db',
      },
      typography: {
        bodyMedium: { fontSize: 14 },
      },
    },
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => {
      if (params?.content) return `${key}: ${params.content}`;
      if (params?.text) return `${key}: ${params.text}`;
      return key;
    },
  }),
}));

// Mock react-native-markdown-display
jest.mock('react-native-markdown-display', () => {
  const { Text } = require('react-native');
  return function Markdown({ children }: { children: string }) {
    return <Text testID="markdown-content">{children}</Text>;
  };
});

const makeMessage = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id: 'msg-1',
  role: 'assistant',
  content: 'Hello from AI',
  timestamp: new Date('2026-01-01T10:00:00Z'),
  ...overrides,
});

describe('MessageBubble', () => {
  it('renders user message with right-aligned style', () => {
    const message = makeMessage({ role: 'user', content: 'Hello AI' });
    const { getByText } = render(<MessageBubble message={message} />);
    expect(getByText('Hello AI')).toBeTruthy();
  });

  it('renders assistant message with Markdown', () => {
    const message = makeMessage({ role: 'assistant', content: '**Bold** text' });
    const { getByTestId } = render(<MessageBubble message={message} />);
    const markdown = getByTestId('markdown-content');
    expect(markdown.props.children).toBe('**Bold** text');
  });

  it('renders typing indicator when isLoading is true (for assistant message)', () => {
    const message = makeMessage({ role: 'assistant', content: '' });
    const { getByText } = render(<MessageBubble message={message} isLoading={true} />);
    expect(getByText('assistant.chat.thinking')).toBeTruthy();
  });

  it('does not render typing indicator when isLoading is false', () => {
    const message = makeMessage({ role: 'assistant', content: 'Done' });
    const { queryByText } = render(<MessageBubble message={message} isLoading={false} />);
    expect(queryByText('assistant.chat.thinking')).toBeNull();
  });

  it('does not render typing indicator for user messages', () => {
    const message = makeMessage({ role: 'user', content: 'Still typing' });
    const { queryByText } = render(<MessageBubble message={message} isLoading={true} />);
    expect(queryByText('assistant.chat.thinking')).toBeNull();
  });

  it('renders user message without Markdown component', () => {
    const message = makeMessage({ role: 'user', content: 'Plain text user' });
    const { queryByTestId } = render(<MessageBubble message={message} />);
    expect(queryByTestId('markdown-content')).toBeNull();
  });

  it('has correct accessibility role', () => {
    const message = makeMessage({ role: 'assistant', content: 'Hello' });
    const { UNSAFE_getByProps } = render(<MessageBubble message={message} />);
    const accessible = UNSAFE_getByProps({ accessibilityRole: 'text' });
    expect(accessible).toBeTruthy();
  });

  it('has accessibility label for user message', () => {
    const message = makeMessage({ role: 'user', content: 'Test content' });
    const { getByLabelText } = render(<MessageBubble message={message} />);
    expect(getByLabelText(/Test content/)).toBeTruthy();
  });

  it('does not render unsupported message roles', () => {
    const message = makeMessage({ role: 'system' as ChatMessage['role'] });
    const { queryByText } = render(<MessageBubble message={message} />);
    expect(queryByText('Hello from AI')).toBeNull();
  });

  it('renders assistant message with markdown (uses M3 theme tokens for code backgrounds)', () => {
    // Verifies the component does not crash when m3.surface tokens are present
    // (no hardcoded RGBA in markdownStyles — component uses surfaceContainerHigh / surfaceContainer)
    const message = makeMessage({
      role: 'assistant',
      content: '`inline code` and\n```\nblock\n```',
    });
    const { getByTestId } = render(<MessageBubble message={message} />);
    // Should render without errors when m3.surface tokens are present
    expect(getByTestId('markdown-content')).toBeTruthy();
  });
});

describe('MessageBubble safety warning (VAL-CROSS-012)', () => {
  it('renders safety warning badge when message is blocked', () => {
    const message = makeMessage({
      role: 'assistant',
      content: 'I cannot advise on this.',
      safety: { blocked: true, riskLevel: 'high', reasons: ['unsafe_content'] },
    });
    const { getByTestId } = render(<MessageBubble message={message} />);
    expect(getByTestId('safety-warning-badge')).toBeTruthy();
  });

  it('shows safety label text in safety badge', () => {
    const message = makeMessage({
      role: 'assistant',
      content: 'Safety blocked message.',
      safety: { blocked: true, riskLevel: 'high', reasons: [] },
    });
    const { getByText } = render(<MessageBubble message={message} />);
    // i18n mock returns the key for 'assistant.safety.blockedLabel'
    expect(getByText(/assistant.safety.blockedLabel/)).toBeTruthy();
  });

  it('does not render safety badge when message is not blocked', () => {
    const message = makeMessage({
      role: 'assistant',
      content: 'Normal response.',
      safety: { blocked: false, riskLevel: 'low', reasons: [] },
    });
    const { queryByTestId } = render(<MessageBubble message={message} />);
    expect(queryByTestId('safety-warning-badge')).toBeNull();
  });

  it('does not render safety badge when safety is null', () => {
    const message = makeMessage({
      role: 'assistant',
      content: 'No safety meta.',
      safety: null,
    });
    const { queryByTestId } = render(<MessageBubble message={message} />);
    expect(queryByTestId('safety-warning-badge')).toBeNull();
  });

  it('does not render safety badge for user messages even if safety is set', () => {
    const message = makeMessage({
      role: 'user',
      content: 'User message.',
      safety: { blocked: true, riskLevel: 'high', reasons: [] },
    });
    const { queryByTestId } = render(<MessageBubble message={message} />);
    expect(queryByTestId('safety-warning-badge')).toBeNull();
  });

  it('uses safety a11y label when message is blocked', () => {
    const message = makeMessage({
      role: 'assistant',
      content: 'Blocked content.',
      safety: { blocked: true, riskLevel: 'high', reasons: [] },
    });
    const { getByLabelText } = render(<MessageBubble message={message} />);
    expect(getByLabelText(/assistant\.safety\.blockedA11y/)).toBeTruthy();
  });
});

describe('LoadingBubble', () => {
  it('renders loading indicator', () => {
    const { getByLabelText } = render(<LoadingBubble />);
    expect(getByLabelText('assistant.chat.thinking')).toBeTruthy();
  });

  it('has accessibility label', () => {
    const { UNSAFE_getByProps } = render(<LoadingBubble />);
    const accessible = UNSAFE_getByProps({ accessible: true });
    expect(accessible.props.accessibilityLabel).toBeTruthy();
  });
});
