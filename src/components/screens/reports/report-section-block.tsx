import React, { useCallback, useMemo } from 'react';
import { View, Text, FlatList, type ListRenderItemInfo, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { borderRadius, fontSize, fontWeight, spacing } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { Symbol as Icon } from '@/components/ui/symbol';

export interface ReportSectionLine {
  label: string;
  value: string;
  monospace?: boolean;
}

export interface ReportSectionRow {
  id: string;
  lines: ReportSectionLine[];
}

/**
 * A single dated activity. The log TYPE is the row title — a bare "4 h" or a
 * chemical name tells a farmer nothing on its own — with the amount/detail as
 * the supporting line, matching the home screen's recent-activity rows.
 */
export interface ReportSectionRecord {
  id: string;
  title: string;
  /** Amount / product / cost. Omitted when the row has nothing to add. */
  detail?: string;
  /** Already display-formatted upstream by report-compute. */
  date: string;
}

interface ReportSectionBlockProps {
  title: string;
  rows?: ReportSectionRow[];
  /**
   * Dated activity rows. When provided these replace `rows` and render as a
   * record list rather than a label/value table — the aggregate lenses and the
   * buyer's register have no dates and stay tabular.
   */
  records?: ReportSectionRecord[];
  hiddenCount?: number;
  /** SF Symbol name displayed next to the section title. */
  icon?: string;
  /** Accent color for the icon and decorative elements. */
  accentColor?: string;
  /** Overrides the generic empty-state text when rows is empty. */
  emptyMessage?: string;
}

const INITIAL_ROWS_TO_RENDER = 6;

/** Shared empty default so `rows` can be optional without an inline array literal. */
const EMPTY_ROWS: ReportSectionRow[] = [];

/* ─────────────────────── Separator ─────────────────────── */

function InsetSeparator({ color }: { color: string }) {
  return (
    <View
      style={{
        height: 1,
        backgroundColor: color,
        marginLeft: spacing[4],
      }}
    />
  );
}

/* ─────────────────────── Component ─────────────────────── */

function ReportSectionBlockComponent({
  title,
  rows = EMPTY_ROWS,
  records,
  hiddenCount = 0,
  icon,
  accentColor,
  emptyMessage,
}: ReportSectionBlockProps) {
  const m3 = useM3();
  const { t } = useTranslation();

  /* ── Shared inset-grouped container style ── */
  const insetGroupedContainer = useMemo<ViewStyle>(
    () => ({
      backgroundColor: m3.surface.s100,
      borderRadius: borderRadius.xl,
      borderCurve: 'continuous',
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: m3.surface.s300,
    }),
    [m3],
  );

  const separatorColor = m3.surface.s300;

  /* ── Compact inline header ── */
  const renderInlineHeader = useCallback(() => {
    if (rows.length === 0) return null;
    const primaryLine = rows[0]?.lines[0];
    return (
      <View
        style={{
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[2],
          backgroundColor: m3.surface.s200,
          borderBottomWidth: 1,
          borderBottomColor: separatorColor,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing[2],
          }}
        >
          <Text
            style={{
              flex: 1,
              fontSize: fontSize.xs,
              fontWeight: fontWeight.bold,
              color: m3.colorScheme.onSurfaceVariant,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            {primaryLine?.label ?? ''}
          </Text>
          <Text
            style={{
              fontSize: fontSize.xs,
              fontWeight: fontWeight.bold,
              color: m3.colorScheme.onSurfaceVariant,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            {t('reports.formal.details', 'DETAILS')}
          </Text>
        </View>
      </View>
    );
  }, [rows, m3, separatorColor, t]);

  /* ── Render items ── */

  /* ── Dated activity row ── */
  const renderRecord = useCallback(
    ({ item: record }: ListRenderItemInfo<ReportSectionRecord>) => (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing[3],
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[3],
        }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: borderRadius.sm,
            borderCurve: 'continuous',
            backgroundColor: colorWithOpacity(accentColor ?? m3.colorScheme.onSurfaceVariant, 0.12),
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon
            name={icon ?? 'list.bullet'}
            size={17}
            color={accentColor ?? m3.colorScheme.onSurfaceVariant}
          />
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
            <Text
              selectable
              numberOfLines={1}
              style={{
                flex: 1,
                minWidth: 0,
                color: m3.colorScheme.onSurface,
                fontSize: fontSize.base,
                fontWeight: fontWeight.semibold,
              }}
            >
              {record.title}
            </Text>
            <Text
              selectable
              numberOfLines={1}
              style={{
                color: m3.colorScheme.onSurfaceVariant,
                fontSize: fontSize.xs,
                fontVariant: ['tabular-nums'],
                flexShrink: 0,
              }}
            >
              {record.date}
            </Text>
          </View>
          {record.detail ? (
            <Text
              selectable
              numberOfLines={1}
              style={{
                marginTop: 1,
                color: m3.colorScheme.onSurfaceVariant,
                fontSize: fontSize.sm,
              }}
            >
              {record.detail}
            </Text>
          ) : null}
        </View>
      </View>
    ),
    [m3, icon, accentColor],
  );

  const renderInlineRow = useCallback(
    ({ item: row }: ListRenderItemInfo<ReportSectionRow>) => {
      const primaryLine = row.lines[0];
      const secondaryParts = row.lines.slice(1);
      return (
        <View
          style={{
            paddingHorizontal: spacing[4],
            paddingVertical: spacing[3],
            gap: spacing[1],
          }}
        >
          <Text
            selectable
            numberOfLines={1}
            style={{
              color: m3.colorScheme.onSurface,
              fontSize: fontSize.base,
              fontWeight: fontWeight.semibold,
              fontVariant: primaryLine?.monospace ? ['tabular-nums'] : undefined,
            }}
          >
            {primaryLine?.value ?? '-'}
          </Text>
          {secondaryParts.length > 0 ? (
            <View style={{ gap: 2 }}>
              {secondaryParts.map((line) => (
                <View
                  key={`${row.id}-${line.label}`}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    gap: spacing[2],
                  }}
                >
                  <Text
                    selectable
                    numberOfLines={1}
                    style={{
                      color: m3.colorScheme.onSurfaceVariant,
                      fontSize: fontSize.xs,
                      fontWeight: fontWeight.medium,
                      textTransform: 'uppercase',
                      letterSpacing: 0.3,
                      flexShrink: 0,
                    }}
                  >
                    {line.label}
                  </Text>
                  <Text
                    selectable
                    numberOfLines={1}
                    style={{
                      color: m3.colorScheme.onSurface,
                      fontSize: fontSize.sm,
                      fontWeight: fontWeight.normal,
                      fontVariant: line.monospace ? ['tabular-nums'] : undefined,
                      textAlign: 'right',
                      flexShrink: 1,
                    }}
                  >
                    {line.value}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      );
    },
    [m3],
  );

  const keyExtractor = useCallback((item: ReportSectionRow | ReportSectionRecord) => item.id, []);

  const rowSeparator = useCallback(
    () => <InsetSeparator color={separatorColor} />,
    [separatorColor],
  );

  const isEmpty = records ? records.length === 0 : rows.length === 0;

  /* ─────────────────────── Render ─────────────────────── */

  return (
    <View style={{ gap: spacing[3] }}>
      {/* Section title */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
        <Icon
          name={icon ?? 'list.bullet'}
          size={16}
          color={accentColor ?? m3.colorScheme.onSurfaceVariant}
        />
        <Text
          selectable
          style={{
            fontSize: fontSize.base,
            fontWeight: fontWeight.semibold,
            color: m3.colorScheme.onSurface,
            letterSpacing: -0.2,
          }}
        >
          {title}
        </Text>
      </View>

      {isEmpty ? (
        /* ── Empty state ── */
        <View
          style={{
            ...insetGroupedContainer,
            paddingHorizontal: spacing[4],
            paddingVertical: spacing[4],
            alignItems: 'center',
          }}
        >
          <Text
            selectable
            style={{
              color: m3.colorScheme.onSurfaceVariant,
              fontSize: fontSize.sm,
            }}
          >
            {emptyMessage ?? t('reports.formal.emptySection')}
          </Text>
        </View>
      ) : records ? (
        /* ── Dated activity rows ── */
        <View style={insetGroupedContainer}>
          <FlatList
            data={records}
            keyExtractor={keyExtractor}
            scrollEnabled={false}
            initialNumToRender={Math.min(records.length, INITIAL_ROWS_TO_RENDER)}
            maxToRenderPerBatch={INITIAL_ROWS_TO_RENDER}
            windowSize={5}
            ItemSeparatorComponent={rowSeparator}
            renderItem={renderRecord}
          />
        </View>
      ) : (
        /* ── Tabular rows ── */
        <View style={insetGroupedContainer}>
          {renderInlineHeader()}
          <FlatList
            data={rows}
            keyExtractor={keyExtractor}
            scrollEnabled={false}
            initialNumToRender={Math.min(rows.length, INITIAL_ROWS_TO_RENDER)}
            maxToRenderPerBatch={INITIAL_ROWS_TO_RENDER}
            windowSize={5}
            ItemSeparatorComponent={rowSeparator}
            renderItem={renderInlineRow}
          />
        </View>
      )}

      {/* Hidden count message */}
      {hiddenCount > 0 ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing[2],
            backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.08),
            paddingHorizontal: spacing[3],
            paddingVertical: spacing[2],
            borderRadius: borderRadius.lg,
            borderCurve: 'continuous',
          }}
        >
          <Icon name="info.circle" size={14} color={m3.colorScheme.primary} />
          <Text
            selectable
            style={{
              flex: 1,
              color: m3.colorScheme.primary,
              fontSize: fontSize.sm,
              fontWeight: fontWeight.medium,
            }}
          >
            {t('reports.export.moreRecords', { count: hiddenCount })}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export const ReportSectionBlock = React.memo(ReportSectionBlockComponent);
