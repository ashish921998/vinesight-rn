/**
 * RichMessageContent Component
 * Renders structured data cards inside AI message bubbles.
 * Supports: data_table, worker_list, phi_conflict, alert_list, key_value
 * M3 themed — no hardcoded colors.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useM3 } from '@/styles/use-theme';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
// import { colorWithOpacity } from '@/utils/color';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import type {
  AssistantMessageCard,
  DataTableRow,
  WorkerListRow,
  PhiConflictRow,
  AlertListRow,
} from '@/types/ai';

interface RichMessageContentProps {
  cards: AssistantMessageCard[];
}

export function RichMessageContent({ cards }: RichMessageContentProps) {
  const m3 = useM3();

  return (
    <View style={styles.container}>
      {cards.map((card, cardIndex) => (
        <View
          key={`${card.type}-${card.title ?? ''}`}
          style={[
            styles.card,
            {
              backgroundColor: m3.surface.surfaceContainerHigh,
              borderColor: m3.colorScheme.outline,
            },
          ]}
        >
          {card.title && (
            <Text style={[styles.cardTitle, { color: m3.colorScheme.onSurfaceVariant }]}>
              {card.title}
            </Text>
          )}
          {renderCardContent(card, cardIndex)}
        </View>
      ))}
    </View>
  );
}

function renderCardContent(card: AssistantMessageCard, _cardIndex: number) {
  switch (card.type) {
    case 'data_table':
      return <DataTableCard rows={card.rows as unknown as DataTableRow[]} />;
    case 'worker_list':
      return <WorkerListCard rows={card.rows as unknown as WorkerListRow[]} />;
    case 'phi_conflict':
      return <PhiConflictCard rows={card.rows as unknown as PhiConflictRow[]} />;
    case 'alert_list':
      return <AlertListCard rows={card.rows as unknown as AlertListRow[]} />;
    case 'key_value':
      return <DataTableCard rows={card.rows as unknown as DataTableRow[]} />;
    default:
      return null;
  }
}

// ── Data Table / Key-Value ────────────────────────────────────
function DataTableCard({ rows }: { rows: DataTableRow[] }) {
  const m3 = useM3();
  return (
    <View style={styles.rowsContainer}>
      {rows.map((row, i) => (
        <View
          key={`row-${row.label}`}
          style={[
            styles.row,
            i < rows.length - 1 && {
              borderBottomWidth: 1,
              borderBottomColor: m3.colorScheme.outlineVariant,
              paddingBottom: spacing[2],
            },
          ]}
        >
          <Text style={[styles.rowLabel, { color: m3.colorScheme.onSurfaceVariant }]}>
            {row.label}
          </Text>
          <Text
            style={[
              styles.rowValue,
              {
                color: row.valueColor ?? m3.colorScheme.onSurface,
                fontWeight: row.bold ? fontWeight.bold : fontWeight.semibold,
              },
            ]}
          >
            {row.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ── Worker List ───────────────────────────────────────────────
function WorkerListCard({ rows }: { rows: WorkerListRow[] }) {
  const m3 = useM3();
  return (
    <View style={styles.rowsContainer}>
      {rows.map((row, i) => (
        <View
          key={`worker-${row.name}`}
          style={[
            styles.workerRow,
            i < rows.length - 1 && {
              borderBottomWidth: 1,
              borderBottomColor: m3.colorScheme.outlineVariant,
            },
          ]}
        >
          <View style={styles.workerInfo}>
            <Text style={[styles.workerName, { color: m3.colorScheme.onSurface }]}>{row.name}</Text>
            <Text style={[styles.workerRole, { color: m3.colorScheme.onSurfaceVariant }]}>
              {row.role}
            </Text>
          </View>
          <View style={styles.workerAmountRow}>
            <Text style={[styles.workerAmount, { color: m3.colorScheme.onSurface }]}>
              {row.amount}
            </Text>
            <SymbolIcon name="chevron.right" size={12} color={m3.colorScheme.onSurfaceVariant} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ── PHI Conflict ──────────────────────────────────────────────
function PhiConflictCard({ rows }: { rows: PhiConflictRow[] }) {
  const m3 = useM3();
  return (
    <View style={styles.rowsContainer}>
      {rows.map((row, i) => (
        <View
          key={`phi-${row.label}`}
          style={[
            styles.row,
            i < rows.length - 1 && {
              borderBottomWidth: 1,
              borderBottomColor: m3.colorScheme.outlineVariant,
              paddingBottom: spacing[2],
            },
          ]}
        >
          <Text style={[styles.rowLabel, { color: m3.colorScheme.onSurfaceVariant }]}>
            {row.label}
          </Text>
          <Text
            style={[
              styles.rowValue,
              {
                color: row.color ?? m3.colorScheme.onSurface,
                fontWeight: row.bold ? fontWeight.bold : fontWeight.semibold,
              },
            ]}
          >
            {row.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ── Alert List ────────────────────────────────────────────────
function AlertListCard({ rows }: { rows: AlertListRow[] }) {
  const m3 = useM3();
  return (
    <View style={styles.rowsContainer}>
      {rows.map((row) => {
        const iconColor = row.color ?? m3.colorScheme.primary;
        return (
          <View key={`alert-${row.text}`} style={styles.alertRow}>
            {row.icon && (
              <SymbolIcon name={row.icon} size={14} color={iconColor} style={styles.alertIcon} />
            )}
            <Text style={[styles.alertText, { color: m3.colorScheme.onSurfaceVariant }]}>
              {row.text}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[2],
    marginTop: spacing[2],
  },
  card: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing[3],
  },
  cardTitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing[2],
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  rowsContainer: {
    gap: spacing[2],
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowLabel: {
    fontSize: fontSize.sm,
  },
  rowValue: {
    fontSize: fontSize.sm,
    fontVariant: ['tabular-nums'],
  },
  workerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[2],
  },
  workerInfo: {
    flex: 1,
  },
  workerName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  workerRole: {
    fontSize: fontSize.xs,
    marginTop: 1,
  },
  workerAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  workerAmount: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    fontVariant: ['tabular-nums'],
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
  },
  alertIcon: {
    marginTop: 2,
  },
  alertText: {
    fontSize: fontSize.sm,
    lineHeight: 20,
    flex: 1,
  },
});
