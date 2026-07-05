/**
 * NutrientLedgerSection — farmer/consultant-facing nutrient ledger card.
 *
 * Displays kg of N, P, K (+ secondary/micros where present) per plot and per
 * acre, for a given date-range period. Coverage is always displayed honestly:
 * "nutrients from N% of applied quantity". Zero coverage shows a clear
 * explanatory state, never zeros presented as truth.
 *
 * Dual-basis display (issue #200, plan §5):
 *   - Elemental (primary): what petiole/soil labs report — N, P, K, Ca, Mg, S
 *   - Bag-grade (secondary): what bags/consultants speak — N-P₂O₅-K₂O
 *
 * Follows the same left-accent-bar card pattern as the other sections in
 * report-document-body.tsx. No new dependencies.
 */

import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Symbol } from '@/components/ui/symbol';
import { componentRadius, fontSize, fontWeight, spacing } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { formatNumber } from '@/i18n/format';
import type { NutrientLedger, NutrientLedgerRow } from '@/types/report';

const LEDGER_ACCENT_COLOR = '#2e7d4f'; // same green family as other report sections

interface NutrientLedgerSectionProps {
  ledger: NutrientLedger;
  panelStyle: object;
}

function formatKg(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return formatNumber(value, { minimumFractionDigits: 2, maximumFractionDigits: 3 });
}

function CoverageChip({
  coveragePercent,
  m3,
}: {
  coveragePercent: number;
  m3: ReturnType<typeof useM3>;
}) {
  const { t } = useTranslation();
  const isZero = coveragePercent === 0;
  const chipColor = isZero ? m3.colorScheme.error : coveragePercent < 100 ? '#c97c14' : '#2e7d4f';
  const bgColor = colorWithOpacity(chipColor, 0.1);
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[1],
        backgroundColor: bgColor,
        paddingHorizontal: spacing[2],
        paddingVertical: spacing[1],
        borderRadius: componentRadius.badge,
        alignSelf: 'flex-start',
      }}
    >
      <Symbol
        name={isZero ? 'exclamationmark.circle.fill' : 'checkmark.shield.fill'}
        size={12}
        color={chipColor}
      />
      <Text
        selectable
        style={{
          fontSize: fontSize.xs,
          fontWeight: fontWeight.semibold,
          color: chipColor,
        }}
      >
        {isZero
          ? t('reports.nutrientLedger.coverageZero')
          : t('reports.nutrientLedger.coverageLabel', {
              value: String(coveragePercent),
            })}
      </Text>
    </View>
  );
}

interface LedgerTableProps {
  rows: NutrientLedgerRow[];
  showPerAcre: boolean;
  m3: ReturnType<typeof useM3>;
}

function LedgerTable({ rows, showPerAcre, m3 }: LedgerTableProps) {
  const { t } = useTranslation();
  const separatorColor = colorWithOpacity(m3.colorScheme.outline, 0.15);

  const colWidths = {
    element: 52,
    elemental: 88,
    oxide: 88,
    perAcre: 80,
  };

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View>
        {/* Header row */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.08),
            borderBottomWidth: 1,
            borderBottomColor: separatorColor,
            paddingVertical: spacing[2],
            paddingHorizontal: spacing[3],
          }}
        >
          <Text
            selectable
            style={{
              width: colWidths.element,
              fontSize: fontSize.xs,
              fontWeight: fontWeight.bold,
              color: m3.colorScheme.onSurfaceVariant,
              textTransform: 'uppercase',
              letterSpacing: 0.4,
            }}
          >
            {t('reports.nutrientLedger.elementHeader')}
          </Text>
          <Text
            selectable
            style={{
              width: colWidths.elemental,
              fontSize: fontSize.xs,
              fontWeight: fontWeight.bold,
              color: m3.colorScheme.onSurfaceVariant,
              textTransform: 'uppercase',
              letterSpacing: 0.4,
              textAlign: 'right',
            }}
          >
            {t('reports.nutrientLedger.elementalHeader')}
          </Text>
          <Text
            selectable
            style={{
              width: colWidths.oxide,
              fontSize: fontSize.xs,
              fontWeight: fontWeight.bold,
              color: m3.colorScheme.onSurfaceVariant,
              textTransform: 'uppercase',
              letterSpacing: 0.4,
              textAlign: 'right',
            }}
          >
            {t('reports.nutrientLedger.oxideHeader')}
          </Text>
          {showPerAcre ? (
            <Text
              selectable
              style={{
                width: colWidths.perAcre,
                fontSize: fontSize.xs,
                fontWeight: fontWeight.bold,
                color: m3.colorScheme.onSurfaceVariant,
                textTransform: 'uppercase',
                letterSpacing: 0.4,
                textAlign: 'right',
              }}
            >
              {t('reports.nutrientLedger.perAcreHeader')}
            </Text>
          ) : null}
        </View>

        {/* Data rows */}
        {rows.map((row, index) => (
          <View
            key={row.element}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: spacing[2],
              paddingHorizontal: spacing[3],
              borderBottomWidth: index < rows.length - 1 ? 1 : 0,
              borderBottomColor: separatorColor,
              backgroundColor: index % 2 === 0 ? 'transparent' : colorWithOpacity(m3.surface.s200, 0.5),
            }}
          >
            {/* Element symbol */}
            <View style={{ width: colWidths.element }}>
              <Text
                selectable
                style={{
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.bold,
                  color: m3.colorScheme.onSurface,
                }}
              >
                {row.element}
              </Text>
              {row.oxideSymbol ? (
                <Text
                  selectable
                  style={{
                    fontSize: fontSize.xs,
                    color: m3.colorScheme.onSurfaceVariant,
                    marginTop: 1,
                  }}
                >
                  {row.oxideSymbol}
                </Text>
              ) : null}
            </View>

            {/* Elemental kg (primary) */}
            <View style={{ width: colWidths.elemental, alignItems: 'flex-end' }}>
              <Text
                selectable
                style={{
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.semibold,
                  color: m3.colorScheme.onSurface,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {formatKg(row.elementalKg)} kg
              </Text>
            </View>

            {/* Oxide kg (bag-grade, secondary) */}
            <View style={{ width: colWidths.oxide, alignItems: 'flex-end' }}>
              {row.oxideKg != null ? (
                <Text
                  selectable
                  style={{
                    fontSize: fontSize.sm,
                    color: colorWithOpacity(m3.colorScheme.onSurface, 0.7),
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {formatKg(row.oxideKg)} kg
                </Text>
              ) : (
                <Text
                  selectable
                  style={{
                    fontSize: fontSize.sm,
                    color: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.5),
                  }}
                >
                  {'—'}
                </Text>
              )}
            </View>

            {/* Per-acre */}
            {showPerAcre ? (
              <View style={{ width: colWidths.perAcre, alignItems: 'flex-end' }}>
                <Text
                  selectable
                  style={{
                    fontSize: fontSize.xs,
                    color: colorWithOpacity(m3.colorScheme.onSurface, 0.75),
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {formatKg(row.elementalKgPerAcre)}/ac
                </Text>
                {row.oxideKgPerAcre != null ? (
                  <Text
                    selectable
                    style={{
                      fontSize: fontSize.xs,
                      color: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6),
                      fontVariant: ['tabular-nums'],
                    }}
                  >
                    {formatKg(row.oxideKgPerAcre)}/ac
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

export function NutrientLedgerSection({ ledger, panelStyle }: NutrientLedgerSectionProps) {
  const { t } = useTranslation();
  const m3 = useM3();

  const hasRows = ledger.rows.length > 0;
  const showPerAcre = ledger.areaAcres != null && ledger.areaAcres > 0;

  return (
    <View
      style={[
        panelStyle,
        {
          flexDirection: 'row',
          overflow: 'hidden',
          borderCurve: 'continuous',
        },
      ]}
    >
      {/* Left accent bar */}
      <View
        style={{
          width: 4,
          backgroundColor: LEDGER_ACCENT_COLOR,
          borderTopLeftRadius: 4,
          borderBottomLeftRadius: 4,
        }}
      />

      <View style={{ flex: 1, paddingLeft: spacing[3] }}>
        {/* Section header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing[2],
            paddingTop: spacing[1],
            paddingBottom: spacing[2],
          }}
        >
          <Symbol name="leaf.fill" size={16} color={LEDGER_ACCENT_COLOR} />
          <Text
            selectable
            style={{
              fontSize: fontSize.base,
              fontWeight: fontWeight.semibold,
              color: m3.colorScheme.onSurface,
              letterSpacing: -0.2,
              flex: 1,
            }}
          >
            {t('reports.nutrientLedger.title')}
          </Text>
        </View>

        {/* Coverage chip */}
        <View style={{ paddingBottom: spacing[2] }}>
          <CoverageChip coveragePercent={ledger.coveragePercent} m3={m3} />
        </View>

        {!hasRows || ledger.coveragePercent === 0 ? (
          /* Zero-coverage / empty state — never show zeros as truth */
          <View
            style={{
              paddingVertical: spacing[3],
              paddingRight: spacing[3],
            }}
          >
            <Text
              selectable
              style={{
                fontSize: fontSize.sm,
                color: m3.colorScheme.onSurfaceVariant,
                fontStyle: 'italic',
              }}
            >
              {/* Distinguish "no applications at all" from "applications
                  exist but none had composition" — rows is empty in BOTH, so
                  key off itemCount, not hasRows, or the excluded-item case is
                  mislabeled as "no logs" and contradicts the coverage chip. */}
              {ledger.itemCount === 0
                ? t('reports.nutrientLedger.emptyTitle')
                : t('reports.nutrientLedger.coverageZero')}
            </Text>
          </View>
        ) : (
          <>
            {/* Nutrient table */}
            <LedgerTable rows={ledger.rows} showPerAcre={showPerAcre} m3={m3} />

            {/* Per-acre unavailable note */}
            {!showPerAcre ? (
              <Text
                selectable
                style={{
                  fontSize: fontSize.xs,
                  color: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7),
                  paddingTop: spacing[2],
                  paddingRight: spacing[3],
                }}
              >
                {t('reports.nutrientLedger.perAcreUnavailable')}
              </Text>
            ) : null}

            {/* Dual-basis explanatory note */}
            <Text
              selectable
              style={{
                fontSize: fontSize.xs,
                color: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.8),
                paddingTop: spacing[2],
                paddingBottom: spacing[1],
                paddingRight: spacing[3],
              }}
            >
              {t('reports.nutrientLedger.dualBasisNote')}
            </Text>
          </>
        )}
      </View>
    </View>
  );
}
