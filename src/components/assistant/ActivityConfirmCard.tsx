/**
 * ActivityConfirmCard Component
 * Shows a voice log confirmation card with:
 * - Activity type header (irrigation/spray/harvest/expense/fertigation)
 * - Type-specific extracted fields:
 *   - irrigation: duration
 *   - spray: chemicals list, water volume
 *   - harvest: quantity, grade
 *   - expense: cost, expense type
 *   - fertigation: fertilizers list, water volume
 * - Farm and date info
 * - Confirm and Cancel buttons
 * M3 themed — no hardcoded colors.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useM3 } from '@/styles/use-theme';
import { radius, spacing } from '@/styles/theme';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import type { AssistantVoiceLogAction } from '@/types/ai';
import type { VoiceLogActivityType } from '@/types/voice-log';

interface ActivityConfirmCardProps {
  voiceLogAction: AssistantVoiceLogAction;
  onConfirm: () => void;
  onCancel: () => void;
}

const ACTIVITY_ICONS: Record<VoiceLogActivityType, string> = {
  irrigation: 'drop.fill',
  spray: 'wind',
  harvest: 'leaf.fill',
  expense: 'creditcard.fill',
  fertigation: 'flask.fill',
};

export function ActivityConfirmCard({
  voiceLogAction,
  onConfirm,
  onCancel,
}: ActivityConfirmCardProps) {
  const m3 = useM3();
  const { t, i18n } = useTranslation();

  const { draft } = voiceLogAction;
  if (!draft) return null;

  const iconName = ACTIVITY_ICONS[draft.type] ?? 'checkmark.circle.fill';
  const typeLabel = getTypeLabel(draft.type, t);
  const formattedDate = formatDraftDate(draft.date, i18n.language);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: m3.colorScheme.surfaceVariant,
          borderColor: m3.colorScheme.outlineVariant,
        },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <SymbolIcon name={iconName} size={20} color={m3.colorScheme.primary} />
        <Text
          style={[
            styles.title,
            {
              color: m3.colorScheme.onSurface,
              ...m3.typography.labelLarge,
            },
          ]}
        >
          {t('assistant.activityConfirm.titleWithType', { type: typeLabel })}
        </Text>
      </View>

      {/* Type-specific fields */}
      <View style={styles.fields}>
        <ActivityFields draft={draft} />

        {/* Farm and Date */}
        {draft.farmName != null && (
          <FieldRow label={t('assistant.activityConfirm.farmLabel')} value={draft.farmName} />
        )}
        {formattedDate && (
          <FieldRow label={t('assistant.activityConfirm.dateLabel')} value={formattedDate} />
        )}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[
            styles.cancelButton,
            {
              borderColor: m3.colorScheme.outline,
            },
          ]}
          onPress={onCancel}
          accessibilityLabel={t('assistant.activityConfirm.a11y.cancelButton')}
          accessibilityRole="button"
          testID="activity-confirm-cancel"
        >
          <Text
            style={[
              styles.cancelButtonText,
              {
                color: m3.colorScheme.onSurfaceVariant,
                ...m3.typography.labelLarge,
              },
            ]}
          >
            {t('assistant.activityConfirm.cancelButton')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.confirmButton,
            {
              backgroundColor: m3.colorScheme.primary,
            },
          ]}
          onPress={onConfirm}
          accessibilityLabel={t('assistant.activityConfirm.a11y.confirmButton')}
          accessibilityRole="button"
          testID="activity-confirm-confirm"
        >
          <Text
            style={[
              styles.confirmButtonText,
              {
                color: m3.colorScheme.onPrimary,
                ...m3.typography.labelLarge,
              },
            ]}
          >
            {t('assistant.activityConfirm.confirmButton')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Type-specific field renderer ──────────────────────────────

interface ActivityFieldsProps {
  draft: NonNullable<AssistantVoiceLogAction['draft']>;
}

function ActivityFields({ draft }: ActivityFieldsProps) {
  const { t } = useTranslation();

  switch (draft.type) {
    case 'irrigation':
      return (
        <>
          {draft.irrigation?.durationHours != null && (
            <FieldRow
              label={t('assistant.activityConfirm.durationLabel')}
              value={t('assistant.activityConfirm.durationValue', {
                value: draft.irrigation.durationHours,
              })}
            />
          )}
        </>
      );

    case 'spray':
      return (
        <>
          {Array.isArray(draft.spray?.chemicals) && draft.spray.chemicals.length > 0 && (
            <FieldRow
              label={t('assistant.activityConfirm.chemicalsLabel')}
              value={draft.spray.chemicals.map((c) => c.name).join(', ')}
            />
          )}
          {draft.spray?.waterVolume != null && (
            <FieldRow
              label={t('assistant.activityConfirm.waterVolumeLabel')}
              value={t('assistant.activityConfirm.waterVolumeValue', {
                value: draft.spray.waterVolume,
              })}
            />
          )}
        </>
      );

    case 'harvest':
      return (
        <>
          {draft.harvest?.quantity != null && (
            <FieldRow
              label={t('assistant.activityConfirm.quantityLabel')}
              value={t('assistant.activityConfirm.quantityValue', {
                value: draft.harvest.quantity,
              })}
            />
          )}
          {draft.harvest?.grade != null && (
            <FieldRow
              label={t('assistant.activityConfirm.gradeLabel')}
              value={draft.harvest.grade}
            />
          )}
        </>
      );

    case 'expense':
      return (
        <>
          {draft.expense?.cost != null && (
            <FieldRow
              label={t('assistant.activityConfirm.costLabel')}
              value={t('assistant.activityConfirm.costValue', {
                currency: '₹',
                value: draft.expense.cost,
              })}
            />
          )}
          {draft.expense?.expenseType != null && (
            <FieldRow
              label={t('assistant.activityConfirm.expenseTypeLabel')}
              value={draft.expense.expenseType}
            />
          )}
        </>
      );

    case 'fertigation':
      return (
        <>
          {Array.isArray(draft.fertigation?.fertilizers) &&
            draft.fertigation.fertilizers.length > 0 && (
              <FieldRow
                label={t('assistant.activityConfirm.fertilizersLabel')}
                value={draft.fertigation.fertilizers.map((f) => f.name).join(', ')}
              />
            )}
        </>
      );

    default:
      return null;
  }
}

// ── Helper components ──────────────────────────────────────────

interface FieldRowProps {
  label: string;
  value: string;
}

function FieldRow({ label, value }: FieldRowProps) {
  const m3 = useM3();

  return (
    <View style={styles.fieldRow}>
      <Text
        style={[
          styles.fieldLabel,
          {
            color: m3.colorScheme.onSurfaceVariant,
            ...m3.typography.labelSmall,
          },
        ]}
      >
        {label}:
      </Text>
      <Text
        style={[
          styles.fieldValue,
          {
            color: m3.colorScheme.onSurface,
            ...m3.typography.bodyMedium,
          },
        ]}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

// ── Helper functions ───────────────────────────────────────────

function getTypeLabel(type: VoiceLogActivityType, t: (key: string) => string): string {
  switch (type) {
    case 'irrigation':
      return t('assistant.activityConfirm.typeIrrigation');
    case 'spray':
      return t('assistant.activityConfirm.typeSpray');
    case 'harvest':
      return t('assistant.activityConfirm.typeHarvest');
    case 'expense':
      return t('assistant.activityConfirm.typeExpense');
    case 'fertigation':
      return t('assistant.activityConfirm.typeFertigation');
    default:
      return type;
  }
}

function formatDraftDate(date: string | null | undefined, locale: string): string | null {
  if (!date) return null;
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const parsedDate = dateOnlyMatch
    ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]))
    : new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return date;
  return parsedDate.toLocaleDateString(locale);
}

// ── Styles ─────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing[4],
    marginHorizontal: spacing[4],
    marginVertical: spacing[2],
    gap: spacing[3],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  title: {
    flex: 1,
  },
  fields: {
    gap: spacing[2],
  },
  fieldRow: {
    flexDirection: 'row',
    gap: spacing[2],
    alignItems: 'flex-start',
  },
  fieldLabel: {
    minWidth: 80,
  },
  fieldValue: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing[3],
    justifyContent: 'flex-end',
  },
  cancelButton: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {},
  confirmButton: {
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[2],
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {},
});
