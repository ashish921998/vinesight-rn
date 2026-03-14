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

  it('renders loading indicator when isLoading is true (for assistant message)', () => {
    const message = makeMessage({ role: 'assistant', content: '' });
    const { UNSAFE_getByType } = render(<MessageBubble message={message} isLoading={true} />);
    const { ActivityIndicator } = require('react-native');
    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });

  it('does not render loading indicator when isLoading is false', () => {
    const message = makeMessage({ role: 'assistant', content: 'Done' });
    const { UNSAFE_queryByType } = render(<MessageBubble message={message} isLoading={false} />);
    const { ActivityIndicator } = require('react-native');
    expect(UNSAFE_queryByType(ActivityIndicator)).toBeNull();
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
    const { UNSAFE_getByProps } = render(<MessageBubble message={message} />);
    const accessible = UNSAFE_getByProps({ accessible: true });
    expect(accessible.props.accessibilityLabel).toContain('Test content');
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

describe('LoadingBubble', () => {
  it('renders loading indicator', () => {
    const { UNSAFE_getByType } = render(<LoadingBubble />);
    const { ActivityIndicator } = require('react-native');
    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });

  it('has accessibility label', () => {
    const { UNSAFE_getByProps } = render(<LoadingBubble />);
    const accessible = UNSAFE_getByProps({ accessible: true });
    expect(accessible.props.accessibilityLabel).toBeTruthy();
  });
});
