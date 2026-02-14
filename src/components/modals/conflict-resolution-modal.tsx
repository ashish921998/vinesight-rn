/**
 * Conflict Resolution Modal
 *
 * A full-screen modal that shows the user conflicting field values
 * between their local offline edit and the server version. The user
 * can choose to keep the local version, the server version, or pick
 * field-by-field.
 *
 * Phase 4: Conflict Resolution
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useConflictStore } from '@/stores/conflict-store';
import { applyConflictResolution } from '@/services/conflict-resolution-service';
import { useM3 } from '@/styles/use-theme';
import { fontSize, fontWeight, borderRadius, spacing } from '@/styles/theme';
import type { FieldConflict, ConflictResolution } from '@/types/conflict';

// ============================================================
// MARK: - Field Choice Selector
// ============================================================

type FieldChoice = 'local' | 'server';

interface FieldConflictRowProps {
  conflict: FieldConflict;
  choice: FieldChoice;
  onChoose: (field: string, choice: FieldChoice) => void;
}

/**
 * A single row showing a conflicting field with local vs server values.
 * The user taps to select which version to keep.
 */
function FieldConflictRow({ conflict, choice, onChoose }: FieldConflictRowProps) {
  const m3 = useM3();

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '(empty)';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };

  return (
    <View style={[styles.fieldRow, { borderColor: m3.colorScheme.outlineVariant }]}>
      <Text style={[styles.fieldName, { color: m3.colorScheme.onSurface }]}>
        {conflict.field.replace(/_/g, ' ')}
      </Text>

      <View style={styles.choicesContainer}>
        {/* Local version */}
        <TouchableOpacity
          style={[
            styles.choiceCard,
            {
              backgroundColor:
                choice === 'local'
                  ? m3.colorScheme.primaryContainer
                  : m3.surface.surfaceContainerLow,
              borderColor:
                choice === 'local'
                  ? m3.colorScheme.primary
                  : m3.colorScheme.outlineVariant,
            },
          ]}
          onPress={() => onChoose(conflict.field, 'local')}
          accessibilityRole="radio"
          accessibilityState={{ selected: choice === 'local' }}
          accessibilityLabel={`Keep local value for ${conflict.field}`}
        >
          <Text
            style={[
              styles.choiceLabel,
              {
                color:
                  choice === 'local'
                    ? m3.colorScheme.onPrimaryContainer
                    : m3.colorScheme.onSurfaceVariant,
              },
            ]}
          >
            Your Edit
          </Text>
          <Text
            style={[
              styles.choiceValue,
              {
                color:
                  choice === 'local'
                    ? m3.colorScheme.onPrimaryContainer
                    : m3.colorScheme.onSurface,
              },
            ]}
            numberOfLines={3}
          >
            {formatValue(conflict.localValue)}
          </Text>
        </TouchableOpacity>

        {/* Server version */}
        <TouchableOpacity
          style={[
            styles.choiceCard,
            {
              backgroundColor:
                choice === 'server'
                  ? m3.colorScheme.secondaryContainer
                  : m3.surface.surfaceContainerLow,
              borderColor:
                choice === 'server'
                  ? m3.colorScheme.secondary
                  : m3.colorScheme.outlineVariant,
            },
          ]}
          onPress={() => onChoose(conflict.field, 'server')}
          accessibilityRole="radio"
          accessibilityState={{ selected: choice === 'server' }}
          accessibilityLabel={`Keep server value for ${conflict.field}`}
        >
          <Text
            style={[
              styles.choiceLabel,
              {
                color:
                  choice === 'server'
                    ? m3.colorScheme.onSecondaryContainer
                    : m3.colorScheme.onSurfaceVariant,
              },
            ]}
          >
            Server
          </Text>
          <Text
            style={[
              styles.choiceValue,
              {
                color:
                  choice === 'server'
                    ? m3.colorScheme.onSecondaryContainer
                    : m3.colorScheme.onSurface,
              },
            ]}
            numberOfLines={3}
          >
            {formatValue(conflict.serverValue)}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ============================================================
// MARK: - Main Modal Component
// ============================================================

/**
 * Conflict Resolution Modal.
 *
 * Reads the active conflict from the conflict store and presents
 * a field-by-field comparison. The user can:
 * - Keep all local values
 * - Keep all server values
 * - Pick field-by-field
 *
 * On submit, the resolved record is written to Supabase via
 * `applyConflictResolution`.
 */
export function ConflictResolutionModal() {
  const m3 = useM3();
  const { activeConflict, isModalVisible, hideConflictModal } = useConflictStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Track per-field choices: default to 'local' (user's edit)
  const [fieldChoices, setFieldChoices] = useState<Record<string, FieldChoice>>({});

  // Initialize field choices when a new conflict is shown
  const effectiveChoices = useMemo(() => {
    if (!activeConflict) return {};
    const defaults: Record<string, FieldChoice> = {};
    for (const fc of activeConflict.conflictingFields) {
      defaults[fc.field] = fieldChoices[fc.field] ?? 'local';
    }
    return defaults;
  }, [activeConflict, fieldChoices]);

  const handleFieldChoose = useCallback((field: string, choice: FieldChoice) => {
    setFieldChoices((prev) => ({ ...prev, [field]: choice }));
  }, []);

  /**
   * Set all fields to the same choice (local or server).
   */
  const handleChooseAll = useCallback(
    (choice: FieldChoice) => {
      if (!activeConflict) return;
      const all: Record<string, FieldChoice> = {};
      for (const fc of activeConflict.conflictingFields) {
        all[fc.field] = choice;
      }
      setFieldChoices(all);
    },
    [activeConflict],
  );

  /**
   * Build the resolved record from the user's field-by-field choices
   * and apply it to Supabase.
   */
  const handleSubmit = useCallback(async () => {
    if (!activeConflict) return;

    setIsSubmitting(true);
    try {
      // Start with the server record as the base, then overlay chosen fields
      const resolvedRecord: Record<string, unknown> = {
        ...activeConflict.serverRecord,
      };

      for (const fc of activeConflict.conflictingFields) {
        const choice = effectiveChoices[fc.field] ?? 'local';
        resolvedRecord[fc.field] =
          choice === 'local' ? fc.localValue : fc.serverValue;
      }

      const resolution: ConflictResolution = {
        conflictId: activeConflict.id,
        resolvedRecord,
        strategy: 'user',
      };

      const success = await applyConflictResolution(resolution);

      if (success) {
        setFieldChoices({});
        // Modal is automatically hidden by the store when conflict is resolved
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [activeConflict, effectiveChoices]);

  /**
   * Dismiss the modal without resolving — the conflict stays in the queue.
   */
  const handleDismiss = useCallback(() => {
    setFieldChoices({});
    hideConflictModal();
  }, [hideConflictModal]);

  if (!activeConflict) return null;

  const tableName = activeConflict.table.replace(/_/g, ' ');

  return (
    <Modal
      visible={isModalVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleDismiss}
    >
      <SafeAreaView
        style={[styles.container, { backgroundColor: m3.colorScheme.background }]}
      >
        {/* Header */}
        <View
          style={[
            styles.header,
            { borderBottomColor: m3.colorScheme.outlineVariant },
          ]}
        >
          <TouchableOpacity onPress={handleDismiss} disabled={isSubmitting}>
            <Text style={[styles.headerButton, { color: m3.colorScheme.primary }]}>
              Later
            </Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: m3.colorScheme.onSurface }]}>
              Sync Conflict
            </Text>
            <Text
              style={[
                styles.headerSubtitle,
                { color: m3.colorScheme.onSurfaceVariant },
              ]}
            >
              {tableName} record was edited elsewhere
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            <Text
              style={[
                styles.headerButton,
                {
                  color: isSubmitting
                    ? m3.colorScheme.onSurfaceVariant
                    : m3.colorScheme.primary,
                  fontWeight: fontWeight.bold,
                },
              ]}
            >
              {isSubmitting ? 'Saving…' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Quick actions: Keep All Local / Keep All Server */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={[
              styles.quickActionButton,
              { backgroundColor: m3.colorScheme.primaryContainer },
            ]}
            onPress={() => handleChooseAll('local')}
            disabled={isSubmitting}
          >
            <Text
              style={[
                styles.quickActionText,
                { color: m3.colorScheme.onPrimaryContainer },
              ]}
            >
              Keep All My Edits
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.quickActionButton,
              { backgroundColor: m3.colorScheme.secondaryContainer },
            ]}
            onPress={() => handleChooseAll('server')}
            disabled={isSubmitting}
          >
            <Text
              style={[
                styles.quickActionText,
                { color: m3.colorScheme.onSecondaryContainer },
              ]}
            >
              Keep All Server
            </Text>
          </TouchableOpacity>
        </View>

        {/* Info banner */}
        <View
          style={[
            styles.infoBanner,
            { backgroundColor: m3.surface.surfaceContainerLow },
          ]}
        >
          <Text
            style={[styles.infoText, { color: m3.colorScheme.onSurfaceVariant }]}
          >
            This record was modified on another device while you were offline.
            Choose which version to keep for each field, or use the buttons above
            to keep all from one side.
          </Text>
        </View>

        {/* Field-by-field conflict list */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {activeConflict.conflictingFields.map((fc) => (
            <FieldConflictRow
              key={fc.field}
              conflict={fc}
              choice={effectiveChoices[fc.field] ?? 'local'}
              onChoose={handleFieldChoose}
            />
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ============================================================
// MARK: - Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerCenter: {
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },
  headerSubtitle: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  headerButton: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
  },
  quickActions: {
    flexDirection: 'row',
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  quickActionButton: {
    flex: 1,
    paddingVertical: spacing[2],
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  quickActionText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  infoBanner: {
    marginHorizontal: spacing[4],
    padding: spacing[3],
    borderRadius: borderRadius.md,
  },
  infoText: {
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing[4],
    gap: spacing[4],
    paddingBottom: spacing[8],
  },
  fieldRow: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing[3],
  },
  fieldName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    textTransform: 'capitalize',
    marginBottom: spacing[2],
  },
  choicesContainer: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  choiceCard: {
    flex: 1,
    padding: spacing[3],
    borderRadius: borderRadius.md,
    borderWidth: 2,
  },
  choiceLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing[1],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  choiceValue: {
    fontSize: fontSize.sm,
  },
});
