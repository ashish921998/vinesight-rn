/**
 * Tests for CitationFooter component.
 * Verifies:
 * - Renders nothing when no citations
 * - Renders citations with title
 * - Shows confidence percentage
 * - Shows multiple citations when expanded
 * - Expand/collapse toggle shown when > 1 citation
 * - Only 1st citation shown by default
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { CitationFooter } from '@/components/assistant/CitationFooter';
import type { AssistantCitation } from '@/types/ai';

jest.mock('@/styles/use-theme', () => ({
  useThemeTokens: () => ({
    m3: {
      colorScheme: {
        primary: '#408059',
        onSurface: '#111827',
        onSurfaceVariant: '#6b7280',
        outlineVariant: '#e5e7eb',
      },
      typography: {
        labelSmall: { fontSize: 11 },
      },
    },
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (key === 'assistant.citations.sourcesLabel') return 'Sources';
      if (key === 'assistant.citations.confidencePct' && params?.value !== undefined)
        return `${params.value}%`;
      return key;
    },
  }),
}));

const makeCitation = (overrides: Partial<AssistantCitation> = {}): AssistantCitation => ({
  id: 'c-1',
  title: 'Agronomy Handbook 2024',
  sourceType: 'kb_doc',
  ...overrides,
});

describe('CitationFooter', () => {
  it('renders nothing when citations array is empty', () => {
    const { toJSON } = render(<CitationFooter citations={[]} />);
    expect(toJSON()).toBeNull();
  });

  it('renders nothing when all citations have no title', () => {
    const { toJSON } = render(
      <CitationFooter citations={[{ id: 'c-1', title: '', sourceType: 'kb_doc' }]} />,
    );
    expect(toJSON()).toBeNull();
  });

  it('renders Sources label', () => {
    const { getByText } = render(<CitationFooter citations={[makeCitation()]} />);
    expect(getByText('Sources')).toBeTruthy();
  });

  it('renders citation title', () => {
    const { getByText } = render(
      <CitationFooter citations={[makeCitation({ title: 'Grape Growing Guide' })]} />,
    );
    expect(getByText(/Grape Growing Guide/)).toBeTruthy();
  });

  it('shows confidence percentage when confidence is set', () => {
    const { getByText } = render(
      <CitationFooter citations={[makeCitation({ confidence: 0.92 })]} />,
    );
    expect(getByText(/92%/)).toBeTruthy();
  });

  it('does not show confidence when confidence is null', () => {
    const { getByText, queryByText } = render(
      <CitationFooter citations={[makeCitation({ title: 'My Source', confidence: null })]} />,
    );
    expect(getByText(/My Source/)).toBeTruthy();
    expect(queryByText(/%/)).toBeNull();
  });

  it('shows only first citation by default when multiple present', () => {
    const citations = [
      makeCitation({ id: 'c-1', title: 'First Source' }),
      makeCitation({ id: 'c-2', title: 'Second Source' }),
      makeCitation({ id: 'c-3', title: 'Third Source' }),
    ];
    const { getByText, queryByText } = render(<CitationFooter citations={citations} />);
    expect(getByText(/First Source/)).toBeTruthy();
    expect(queryByText(/Second Source/)).toBeNull();
    expect(queryByText(/Third Source/)).toBeNull();
  });

  it('shows toggle button when multiple citations', () => {
    const citations = [
      makeCitation({ id: 'c-1', title: 'First Source' }),
      makeCitation({ id: 'c-2', title: 'Second Source' }),
    ];
    const { UNSAFE_getByProps } = render(<CitationFooter citations={citations} />);
    const button = UNSAFE_getByProps({ accessibilityRole: 'button' });
    expect(button).toBeTruthy();
  });

  it('does not show toggle button when only one citation', () => {
    const { UNSAFE_queryByProps } = render(<CitationFooter citations={[makeCitation()]} />);
    const button = UNSAFE_queryByProps({ accessibilityRole: 'button' });
    expect(button).toBeNull();
  });

  it('expands to show more citations when toggle is pressed', () => {
    const citations = [
      makeCitation({ id: 'c-1', title: 'First Source' }),
      makeCitation({ id: 'c-2', title: 'Second Source' }),
      makeCitation({ id: 'c-3', title: 'Third Source' }),
    ];
    const { UNSAFE_getByProps, getByText } = render(<CitationFooter citations={citations} />);

    const button = UNSAFE_getByProps({ accessibilityRole: 'button' });
    fireEvent.press(button);

    expect(getByText(/Second Source/)).toBeTruthy();
  });

  it('shows citation number prefix', () => {
    const { getByText } = render(<CitationFooter citations={[makeCitation()]} />);
    expect(getByText('1.')).toBeTruthy();
  });
});
