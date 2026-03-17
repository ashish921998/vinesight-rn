/**
 * Tests for SuggestionChips component.
 * Verifies:
 * - Renders chips for each suggestion
 * - Tapping a chip calls onSendSuggestion with the chip text
 * - Resolves i18n keys for ai.* suggestions
 * - Disabled state prevents sending
 * - Empty suggestions renders nothing
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SuggestionChips } from '@/components/assistant/SuggestionChips';

jest.mock('@/styles/use-theme', () => ({
  useThemeTokens: () => ({
    m3: {
      colorScheme: {
        primary: '#408059',
        onPrimary: '#ffffff',
        secondaryContainer: '#e1ebe5',
        onSecondaryContainer: '#1f412b',
        onSurfaceVariant: '#6b7280',
        outlineVariant: '#e5e7eb',
      },
    },
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => {
      // Simulate i18n translation
      const translations: Record<string, string> = {
        'ai.defaultSuggestions.waterNeed': 'How much water do I need?',
        'ai.defaultSuggestions.diseases': 'Check for common diseases',
        'assistant.chat.suggestionChipA11y': params?.text ? `Send suggestion: ${params.text}` : key,
      };
      return translations[key] ?? key;
    },
  }),
}));

describe('SuggestionChips', () => {
  const onSendSuggestion = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when suggestions is empty', () => {
    const { toJSON } = render(
      <SuggestionChips suggestions={[]} onSendSuggestion={onSendSuggestion} />,
    );
    expect(toJSON()).toBeNull();
  });

  it('renders a chip for each suggestion', () => {
    const { getAllByRole } = render(
      <SuggestionChips
        suggestions={['First suggestion', 'Second suggestion', 'Third suggestion']}
        onSendSuggestion={onSendSuggestion}
      />,
    );
    const buttons = getAllByRole('button');
    expect(buttons).toHaveLength(3);
  });

  it('calls onSendSuggestion with plain text when chip is tapped', () => {
    const { getByText } = render(
      <SuggestionChips suggestions={['Hello world']} onSendSuggestion={onSendSuggestion} />,
    );
    fireEvent.press(getByText('Hello world'));
    expect(onSendSuggestion).toHaveBeenCalledWith('Hello world');
  });

  it('resolves i18n key for ai.* suggestions', () => {
    const { getByText } = render(
      <SuggestionChips
        suggestions={['ai.defaultSuggestions.waterNeed']}
        onSendSuggestion={onSendSuggestion}
      />,
    );
    const chip = getByText('How much water do I need?');
    expect(chip).toBeTruthy();
    fireEvent.press(chip);
    expect(onSendSuggestion).toHaveBeenCalledWith('How much water do I need?');
  });

  it('resolves multiple i18n keys', () => {
    const { getByText } = render(
      <SuggestionChips
        suggestions={['ai.defaultSuggestions.waterNeed', 'ai.defaultSuggestions.diseases']}
        onSendSuggestion={onSendSuggestion}
      />,
    );
    expect(getByText('How much water do I need?')).toBeTruthy();
    expect(getByText('Check for common diseases')).toBeTruthy();
  });

  it('does not call onSendSuggestion when disabled', () => {
    const { getByText } = render(
      <SuggestionChips
        suggestions={['Tap me']}
        onSendSuggestion={onSendSuggestion}
        disabled={true}
      />,
    );
    fireEvent.press(getByText('Tap me'));
    expect(onSendSuggestion).not.toHaveBeenCalled();
  });

  it('has accessibility labels on chips', () => {
    const { getAllByRole } = render(
      <SuggestionChips suggestions={['Test chip']} onSendSuggestion={onSendSuggestion} />,
    );
    const buttons = getAllByRole('button');
    expect(buttons[0].props.accessibilityLabel).toContain('Test chip');
  });
});
