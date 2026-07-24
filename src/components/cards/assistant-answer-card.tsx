import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { formatDate } from '@/i18n/format';
import type { AssistantAnswer, IntentCategory } from '@/types/voice-assistant';

interface AssistantAnswerCardProps {
  answer: AssistantAnswer;
  onAskAnother: () => void;
}

const CATEGORY_ICONS: Record<string, string> = {
  spray: 'drop.fill',
  irrigation: 'water.waves',
  fertigation: 'leaf.fill',
  expense: 'indianrupeesign.circle.fill',
};

const CATEGORY_LABEL_KEYS: Record<IntentCategory, string> = {
  spray: 'farmAssistant.categories.spray',
  irrigation: 'farmAssistant.categories.irrigation',
  fertigation: 'farmAssistant.categories.fertigation',
  expense: 'farmAssistant.categories.expense',
};

export function AssistantAnswerCard({ answer, onAskAnother }: AssistantAnswerCardProps) {
  const { t } = useTranslation();
  const m3 = useM3();
  const iconName = CATEGORY_ICONS[answer.category] ?? 'questionmark.circle';
  const categoryLabel = t(CATEGORY_LABEL_KEYS[answer.category]);

  const formatRowDate = (dateStr: string): string =>
    formatDate(dateStr, { day: 'numeric', month: 'short', year: '2-digit' });

  const formatTimeRange = (): string => {
    const start = formatDate(answer.timeRange.start, {
      day: 'numeric',
      month: 'short',
    });
    const end = formatDate(answer.timeRange.end, {
      day: 'numeric',
      month: 'short',
    });
    return start && end ? `${start} – ${end}` : '';
  };

  const formattedSummaryValue =
    answer.summary.unit && answer.summary.unit.startsWith('₹')
      ? `₹${Number(answer.summary.value).toLocaleString('en-IN')}`
      : `${answer.summary.value}${answer.summary.unit ? ` ${answer.summary.unit}` : ''}`;

  return (
    <View
      style={{
        backgroundColor: m3.surface.surfaceContainerLow,
        borderRadius: borderRadius['2xl'],
        padding: spacing[4],
        gap: spacing[3],
      }}
    >
      {/* Header: category icon + label + badges */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: borderRadius.full,
            backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <SymbolIcon name={iconName} size={18} color={m3.colorScheme.primary} />
        </View>
        <Text
          style={{
            fontSize: fontSize.base,
            fontWeight: fontWeight.semibold,
            color: m3.colorScheme.onSurface,
            flex: 1,
          }}
        >
          {categoryLabel}
        </Text>

        <View
          style={{
            backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.08),
            paddingHorizontal: spacing[2],
            paddingVertical: spacing[1],
            borderRadius: borderRadius.md,
          }}
        >
          <Text
            style={{
              fontSize: fontSize.xs,
              color: m3.colorScheme.primary,
              fontWeight: fontWeight.medium,
            }}
          >
            {formatTimeRange()}
          </Text>
        </View>
      </View>

      {answer.farmFilter && (
        <View
          style={{
            alignSelf: 'flex-start',
            backgroundColor: colorWithOpacity(m3.colorScheme.secondary, 0.08),
            paddingHorizontal: spacing[2],
            paddingVertical: spacing[1],
            borderRadius: borderRadius.md,
          }}
        >
          <Text
            style={{
              fontSize: fontSize.xs,
              color: m3.colorScheme.secondary,
              fontWeight: fontWeight.medium,
            }}
          >
            {answer.farmFilter}
          </Text>
        </View>
      )}

      {answer.verbalizedText && (
        <Text
          style={{
            fontSize: fontSize.sm,
            color: m3.colorScheme.onSurface,
            lineHeight: 20,
          }}
        >
          {answer.verbalizedText}
        </Text>
      )}

      <View
        accessibilityRole="summary"
        style={{
          backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.06),
          borderRadius: borderRadius.lg,
          padding: spacing[3],
        }}
      >
        <Text
          style={{
            fontSize: fontSize.xs,
            color: m3.colorScheme.onSurfaceVariant,
            fontWeight: fontWeight.medium,
          }}
        >
          {answer.summary.label}
        </Text>
        <Text
          accessibilityLabel={`${answer.summary.label}: ${formattedSummaryValue}`}
          style={{
            fontSize: fontSize['2xl'],
            fontWeight: fontWeight.bold,
            color: m3.colorScheme.primary,
            marginTop: spacing[1],
          }}
        >
          {formattedSummaryValue}
        </Text>
      </View>

      {answer.rows.length > 0 && (
        <View style={{ gap: spacing[1] }}>
          {answer.rows.map((row, index) => (
            <View
              key={`${row.date}-${row.farmName}-${row.primary}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: spacing[2],
                borderBottomWidth: index < answer.rows.length - 1 ? 1 : 0,
                borderBottomColor: m3.colorScheme.outlineVariant,
              }}
            >
              <Text
                style={{
                  fontSize: fontSize.xs,
                  color: m3.colorScheme.onSurfaceVariant,
                  width: 70,
                  fontWeight: fontWeight.medium,
                }}
              >
                {formatRowDate(row.date)}
              </Text>
              <View style={{ flex: 1, marginLeft: spacing[2] }}>
                <Text
                  style={{
                    fontSize: fontSize.sm,
                    color: m3.colorScheme.onSurface,
                    fontWeight: fontWeight.medium,
                  }}
                  numberOfLines={1}
                >
                  {row.primary}
                </Text>
                {row.secondary && (
                  <Text
                    style={{
                      fontSize: fontSize.xs,
                      color: m3.colorScheme.onSurfaceVariant,
                      marginTop: 2,
                    }}
                    numberOfLines={1}
                  >
                    {row.secondary}
                  </Text>
                )}
              </View>
              <Text
                style={{
                  fontSize: fontSize.xs,
                  color: m3.colorScheme.onSurfaceVariant,
                  marginLeft: spacing[2],
                }}
                numberOfLines={1}
              >
                {row.farmName}
              </Text>
            </View>
          ))}

          {answer.totalRecordCount > answer.rows.length && (
            <Text
              style={{
                fontSize: fontSize.xs,
                color: m3.colorScheme.onSurfaceVariant,
                textAlign: 'center',
                marginTop: spacing[1],
              }}
            >
              {t('farmAssistant.showingRecords', {
                shown: answer.rows.length,
                total: answer.totalRecordCount,
              })}
            </Text>
          )}
        </View>
      )}

      <Pressable
        onPress={onAskAnother}
        accessibilityLabel={t('farmAssistant.askAnotherQuestion')}
        accessibilityRole="button"
        style={{
          paddingVertical: spacing[3],
          borderRadius: borderRadius.xl,
          alignItems: 'center',
          borderWidth: 1,
          borderColor: colorWithOpacity(m3.colorScheme.primary, 0.25),
        }}
      >
        <Text
          style={{
            color: m3.colorScheme.primary,
            fontSize: fontSize.sm,
            fontWeight: fontWeight.semibold,
          }}
        >
          {t('farmAssistant.askAnotherQuestion')}
        </Text>
      </Pressable>
    </View>
  );
}
