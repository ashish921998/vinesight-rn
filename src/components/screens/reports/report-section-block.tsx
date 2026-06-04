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

interface ReportSectionBlockProps {
  title: string;
  rows: ReportSectionRow[];
  hiddenCount?: number;
  variant?: 'default' | 'compact-two-col' | 'compact-inline';
  /** SF Symbol name displayed next to the section title. */
  icon?: string;
  /** Accent color for the icon and decorative elements. */
  accentColor?: string;
}

const INITIAL_ROWS_TO_RENDER = 6;

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

export function ReportSectionBlock({
  title,
  rows,
  hiddenCount = 0,
  variant = 'default',
  icon,
  accentColor,
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

  /* ── Compact two-col header ── */
  const renderTwoColHeader = useCallback(() => {
    if (rows.length === 0) return null;
    const dateLine = rows[0]?.lines[0];
    const durationLine = rows[0]?.lines[1];
    return (
      <View
        style={{
          flexDirection: 'row',
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[2],
          backgroundColor: m3.surface.s200,
          borderBottomWidth: 1,
          borderBottomColor: separatorColor,
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
          {dateLine?.label ?? ''}
        </Text>
        <Text
          style={{
            width: 92,
            fontSize: fontSize.xs,
            fontWeight: fontWeight.bold,
            color: m3.colorScheme.onSurfaceVariant,
            textAlign: 'right',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          {durationLine?.label ?? ''}
        </Text>
      </View>
    );
  }, [rows, m3, separatorColor]);

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

  const renderTwoColRow = useCallback(
    ({ item: row }: ListRenderItemInfo<ReportSectionRow>) => {
      const dateLine = row.lines[0];
      const durationLine = row.lines[1];
      return (
        <View
          style={{
            flexDirection: 'row',
            paddingHorizontal: spacing[4],
            paddingVertical: spacing[3],
          }}
        >
          <Text
            selectable
            style={{
              flex: 1,
              color: m3.colorScheme.onSurface,
              fontSize: fontSize.base,
              fontVariant: dateLine?.monospace ? ['tabular-nums'] : undefined,
            }}
          >
            {dateLine?.value ?? '-'}
          </Text>
          <Text
            selectable
            style={{
              width: 92,
              color: m3.colorScheme.onSurface,
              fontSize: fontSize.base,
              fontWeight: fontWeight.medium,
              textAlign: 'right',
              fontVariant: ['tabular-nums'],
            }}
          >
            {durationLine?.value ?? '-'}
          </Text>
        </View>
      );
    },
    [m3],
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
              {secondaryParts.map((line, idx) => (
                <View
                  key={`${row.id}-detail-${idx}`}
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

  const renderDefaultRow = useCallback(
    ({ item: row }: ListRenderItemInfo<ReportSectionRow>) => {
      const primaryLine = row.lines[0] ?? null;
      const detailLines = row.lines.slice(1);
      return (
        <View
          style={{
            backgroundColor: m3.surface.s100,
            borderRadius: borderRadius.lg,
            borderCurve: 'continuous',
            paddingHorizontal: spacing[4],
            paddingVertical: spacing[3],
            gap: spacing[2],
            borderWidth: 1,
            borderColor: m3.surface.s300,
          }}
        >
          {primaryLine ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: spacing[2],
                borderBottomWidth: detailLines.length > 0 ? 1 : 0,
                borderBottomColor: m3.surface.s200,
                paddingBottom: detailLines.length > 0 ? spacing[2] : 0,
              }}
            >
              <Text
                selectable
                style={{
                  color: m3.colorScheme.onSurfaceVariant,
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.medium,
                }}
              >
                {primaryLine.label}
              </Text>
              <Text
                selectable
                style={{
                  color: m3.colorScheme.onSurface,
                  fontSize: fontSize.lg,
                  fontWeight: fontWeight.bold,
                  fontVariant: primaryLine.monospace ? ['tabular-nums'] : undefined,
                }}
              >
                {primaryLine.value}
              </Text>
            </View>
          ) : null}

          {detailLines.map((line, index) => (
            <View
              key={`${row.id}-${line.label}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: spacing[2],
                borderTopWidth: index === 0 ? 0 : 1,
                borderTopColor: m3.surface.s200,
                paddingTop: index === 0 ? 0 : spacing[1],
              }}
            >
              <Text
                selectable
                numberOfLines={1}
                style={{
                  flex: 0.45,
                  color: m3.colorScheme.onSurfaceVariant,
                  fontSize: fontSize.base,
                }}
              >
                {line.label}
              </Text>
              <Text
                selectable
                numberOfLines={1}
                style={{
                  flex: 0.55,
                  color: m3.colorScheme.onSurface,
                  fontSize: fontSize.lg,
                  fontWeight: fontWeight.semibold,
                  textAlign: 'right',
                  fontVariant: line.monospace ? ['tabular-nums'] : undefined,
                }}
              >
                {line.value}
              </Text>
            </View>
          ))}
        </View>
      );
    },
    [m3],
  );

  const keyExtractor = useCallback((item: ReportSectionRow) => item.id, []);

  const twoColSeparator = useCallback(
    () => <InsetSeparator color={separatorColor} />,
    [separatorColor],
  );

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

      {rows.length === 0 ? (
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
            {t('reports.formal.emptySection')}
          </Text>
        </View>
      ) : variant === 'compact-two-col' ? (
        /* ── Compact two-col ── */
        <View style={insetGroupedContainer}>
          {renderTwoColHeader()}
          <FlatList
            data={rows}
            keyExtractor={keyExtractor}
            scrollEnabled={false}
            initialNumToRender={Math.min(rows.length, INITIAL_ROWS_TO_RENDER)}
            maxToRenderPerBatch={INITIAL_ROWS_TO_RENDER}
            windowSize={5}
            ItemSeparatorComponent={twoColSeparator}
            renderItem={renderTwoColRow}
          />
        </View>
      ) : variant === 'compact-inline' ? (
        /* ── Compact inline ── */
        <View style={insetGroupedContainer}>
          {renderInlineHeader()}
          <FlatList
            data={rows}
            keyExtractor={keyExtractor}
            scrollEnabled={false}
            initialNumToRender={Math.min(rows.length, INITIAL_ROWS_TO_RENDER)}
            maxToRenderPerBatch={INITIAL_ROWS_TO_RENDER}
            windowSize={5}
            ItemSeparatorComponent={twoColSeparator}
            renderItem={renderInlineRow}
          />
        </View>
      ) : (
        /* ── Default cards ── */
        <FlatList
          data={rows}
          keyExtractor={keyExtractor}
          scrollEnabled={false}
          initialNumToRender={Math.min(rows.length, INITIAL_ROWS_TO_RENDER)}
          maxToRenderPerBatch={INITIAL_ROWS_TO_RENDER}
          windowSize={5}
          contentContainerStyle={{ gap: spacing[2] }}
          renderItem={renderDefaultRow}
        />
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
