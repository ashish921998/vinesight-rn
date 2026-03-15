/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for ActivityConfirmCard component.
 * Verifies:
 * - Renders type-specific fields for all 5 activity types
 * - Confirm button calls onConfirm
 * - Cancel button calls onCancel
 * - Shows farm name and date when provided
 * - Returns null when draft is missing
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ActivityConfirmCard } from '@/components/assistant/ActivityConfirmCard';
import type { AssistantVoiceLogAction } from '@/types/ai';
import type { VoiceLogDraft } from '@/types/voice-log';

jest.mock('@/styles/use-theme', () => ({
  useThemeTokens: () => ({
    m3: {
      colorScheme: {
        primary: '#408059',
        onPrimary: '#ffffff',
        onSurface: '#111827',
        onSurfaceVariant: '#6b7280',
        surfaceVariant: '#f3f4f6',
        outlineVariant: '#e5e7eb',
        outline: '#9ca3af',
        error: '#dc2626',
        onError: '#ffffff',
      },
      typography: {
        titleSmall: { fontSize: 14, fontWeight: '600' },
        labelLarge: { fontSize: 14 },
        labelMedium: { fontSize: 12 },
        bodyMedium: { fontSize: 14 },
      },
    },
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en-US' },
    t: (key: string, params?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        'assistant.activityConfirm.title': 'Log Activity',
        'assistant.activityConfirm.titleWithType': `Log Activity — ${String(params?.type ?? '')}`,
        'assistant.activityConfirm.typeIrrigation': 'Irrigation',
        'assistant.activityConfirm.typeSpray': 'Spray',
        'assistant.activityConfirm.typeHarvest': 'Harvest',
        'assistant.activityConfirm.typeExpense': 'Expense',
        'assistant.activityConfirm.typeFertigation': 'Fertigation',
        'assistant.activityConfirm.durationLabel': 'Duration',
        'assistant.activityConfirm.chemicalsLabel': 'Chemicals',
        'assistant.activityConfirm.waterVolumeLabel': 'Water',
        'assistant.activityConfirm.quantityLabel': 'Quantity',
        'assistant.activityConfirm.gradeLabel': 'Grade',
        'assistant.activityConfirm.costLabel': 'Cost',
        'assistant.activityConfirm.expenseTypeLabel': 'Type',
        'assistant.activityConfirm.fertilizersLabel': 'Fertilizers',
        'assistant.activityConfirm.farmLabel': 'Farm',
        'assistant.activityConfirm.dateLabel': 'Date',
        'assistant.activityConfirm.confirmButton': 'Confirm',
        'assistant.activityConfirm.cancelButton': 'Cancel',
        'assistant.activityConfirm.a11y.confirmButton': 'Confirm activity log',
        'assistant.activityConfirm.a11y.cancelButton': 'Cancel activity log',
      };
      if (key === 'assistant.activityConfirm.durationValue' && params?.value)
        return `${params.value} hrs`;
      if (key === 'assistant.activityConfirm.waterVolumeValue' && params?.value)
        return `${params.value} L`;
      if (key === 'assistant.activityConfirm.quantityValue' && params?.value)
        return `${params.value} kg`;
      if (key === 'assistant.activityConfirm.costValue' && params?.value) return `₹${params.value}`;
      return translations[key] ?? key;
    },
  }),
}));

jest.mock('@/components/ui/symbol', () => ({
  Symbol: ({ name }: { name: string }) => {
    const { Text } = require('react-native');
    return <Text testID={`symbol-${name}`}>{name}</Text>;
  },
}));

const makeBaseDraft = (): VoiceLogDraft => ({
  type: 'irrigation',
  farmId: 1,
  farmName: 'Test Farm',
  date: '2026-03-15',
  irrigation: { durationHours: 3 },
  spray: { waterVolume: null, chemicals: [] },
  harvest: { quantity: null, grade: null, price: null, buyer: null },
  expense: { cost: null, expenseType: null, remarks: null },
  fertigation: { waterVolume: null, fertilizers: [] },
});

const makeAction = (overrides: Partial<VoiceLogDraft> = {}): AssistantVoiceLogAction => ({
  kind: 'ready',
  draft: { ...makeBaseDraft(), ...overrides },
});

describe('ActivityConfirmCard', () => {
  it('returns null when draft is missing', () => {
    const action: AssistantVoiceLogAction = { kind: 'ready', draft: null };
    const { toJSON } = render(
      <ActivityConfirmCard voiceLogAction={action} onConfirm={jest.fn()} onCancel={jest.fn()} />,
    );
    expect(toJSON()).toBeNull();
  });

  it('calls onConfirm when Confirm button pressed', () => {
    const onConfirm = jest.fn();
    const { getByTestId } = render(
      <ActivityConfirmCard
        voiceLogAction={makeAction()}
        onConfirm={onConfirm}
        onCancel={jest.fn()}
      />,
    );
    fireEvent.press(getByTestId('activity-confirm-confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when Cancel button pressed', () => {
    const onCancel = jest.fn();
    const { getByTestId } = render(
      <ActivityConfirmCard
        voiceLogAction={makeAction()}
        onConfirm={jest.fn()}
        onCancel={onCancel}
      />,
    );
    fireEvent.press(getByTestId('activity-confirm-cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('renders title with activity type', () => {
    const { getByText } = render(
      <ActivityConfirmCard
        voiceLogAction={makeAction()}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(getByText(/Log Activity/)).toBeTruthy();
    expect(getByText(/Irrigation/)).toBeTruthy();
  });

  it('renders farm name and date', () => {
    const { getByText } = render(
      <ActivityConfirmCard
        voiceLogAction={makeAction()}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(getByText('Test Farm')).toBeTruthy();
    expect(getByText(new Date(2026, 2, 15).toLocaleDateString('en-US'))).toBeTruthy();
  });

  // ── Irrigation type ──────────────────────────────────────────
  describe('irrigation type', () => {
    it('shows duration field', () => {
      const { getByText } = render(
        <ActivityConfirmCard
          voiceLogAction={makeAction({ type: 'irrigation', irrigation: { durationHours: 2.5 } })}
          onConfirm={jest.fn()}
          onCancel={jest.fn()}
        />,
      );
      expect(getByText('Duration:')).toBeTruthy();
      expect(getByText('2.5 hrs')).toBeTruthy();
    });
  });

  // ── Spray type ───────────────────────────────────────────────
  describe('spray type', () => {
    it('shows chemicals and water volume fields', () => {
      const { getByText } = render(
        <ActivityConfirmCard
          voiceLogAction={makeAction({
            type: 'spray',
            spray: {
              waterVolume: 200,
              chemicals: [{ name: 'Mancozeb', quantity: 2, unit: 'kg', quantityBasis: null }],
            },
          })}
          onConfirm={jest.fn()}
          onCancel={jest.fn()}
        />,
      );
      expect(getByText('Chemicals:')).toBeTruthy();
      expect(getByText('Mancozeb')).toBeTruthy();
      expect(getByText('Water:')).toBeTruthy();
      expect(getByText('200 L')).toBeTruthy();
    });
  });

  // ── Harvest type ─────────────────────────────────────────────
  describe('harvest type', () => {
    it('shows quantity and grade fields', () => {
      const { getByText } = render(
        <ActivityConfirmCard
          voiceLogAction={makeAction({
            type: 'harvest',
            harvest: { quantity: 500, grade: 'A', price: null, buyer: null },
          })}
          onConfirm={jest.fn()}
          onCancel={jest.fn()}
        />,
      );
      expect(getByText('Quantity:')).toBeTruthy();
      expect(getByText('500 kg')).toBeTruthy();
      expect(getByText('Grade:')).toBeTruthy();
      expect(getByText('A')).toBeTruthy();
    });
  });

  // ── Expense type ─────────────────────────────────────────────
  describe('expense type', () => {
    it('shows cost and expense type fields', () => {
      const { getByText } = render(
        <ActivityConfirmCard
          voiceLogAction={makeAction({
            type: 'expense',
            expense: { cost: 1500, expenseType: 'Labor', remarks: null },
          })}
          onConfirm={jest.fn()}
          onCancel={jest.fn()}
        />,
      );
      expect(getByText('Cost:')).toBeTruthy();
      expect(getByText('₹1500')).toBeTruthy();
      expect(getByText('Type:')).toBeTruthy();
      expect(getByText('Labor')).toBeTruthy();
    });
  });

  // ── Fertigation type ─────────────────────────────────────────
  describe('fertigation type', () => {
    it('shows fertilizers and water volume fields', () => {
      const { getByText } = render(
        <ActivityConfirmCard
          voiceLogAction={makeAction({
            type: 'fertigation',
            fertigation: {
              waterVolume: 300,
              fertilizers: [{ name: 'Urea', quantity: 5, unit: 'kg', quantityBasis: null }],
            },
          })}
          onConfirm={jest.fn()}
          onCancel={jest.fn()}
        />,
      );
      expect(getByText('Fertilizers:')).toBeTruthy();
      expect(getByText('Urea')).toBeTruthy();
      expect(getByText('Water:')).toBeTruthy();
      expect(getByText('300 L')).toBeTruthy();
    });
  });

  it('shows Confirm button label', () => {
    const { getByText } = render(
      <ActivityConfirmCard
        voiceLogAction={makeAction()}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(getByText('Confirm')).toBeTruthy();
  });

  it('shows Cancel button label', () => {
    const { getByText } = render(
      <ActivityConfirmCard
        voiceLogAction={makeAction()}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(getByText('Cancel')).toBeTruthy();
  });
});
