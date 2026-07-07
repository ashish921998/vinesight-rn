/**
 * RepeatLastLog — empty-stack suggestion card.
 * Shows the most recent logged day's activities for the selected farm and
 * enqueues copies of them as editable drafts in one tap.
 */

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LOG_TYPES, type LogTypeId } from '@/constants/calculator-models';
import { resolveSymbolIconName } from '@/constants/icon-registry';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
import { AppIcon } from '@/components/ui/app-icon';
import { formatDate } from '@/i18n/format';
import { fontSize, radius } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';

export interface RepeatLastLogItem {
  key: string;
  type: LogTypeId;
  description: string;
}

interface RepeatLastLogProps {
  date: Date;
  items: RepeatLastLogItem[];
  onAdd: () => void;
}

export function RepeatLastLog({ date, items, onAdd }: RepeatLastLogProps) {
  const m3 = useM3();
  const { t } = useTranslation();

  return (
    <View
      style={{
        backgroundColor: m3.surface.s100,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.25),
        padding: 14,
        marginBottom: 16,
      }}
    >
      <Text
        selectable
        style={{
          fontSize: fontSize.xs,
          fontWeight: '700',
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          color: m3.colorScheme.tertiary,
        }}
      >
        {t('entryForm.repeatLastLogTitle', { defaultValue: 'Repeat last log?' })}
      </Text>
      <View style={{ marginTop: 10, gap: 8 }}>
        {items.map((item) => {
          const logType = LOG_TYPES.find((lt) => lt.id === item.type);
          return (
            <View key={item.key} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: radius.sm,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colorWithOpacity(logType?.color ?? m3.colorScheme.primary, 0.14),
                }}
              >
                <UiSymbol
                  name={resolveSymbolIconName(logType?.icon)}
                  size={14}
                  color={logType?.color ?? m3.colorScheme.primary}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text
                  selectable
                  numberOfLines={1}
                  style={{
                    fontSize: fontSize.sm,
                    fontWeight: '700',
                    color: m3.colorScheme.onSurface,
                  }}
                >
                  {logType ? t(logType.labelKey) : item.type}
                </Text>
                {!!item.description && (
                  <Text
                    selectable
                    numberOfLines={1}
                    style={{
                      marginTop: 1,
                      fontSize: fontSize.xs,
                      color: m3.colorScheme.onSurfaceVariant,
                    }}
                  >
                    {item.description}
                  </Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
      <View
        style={{
          marginTop: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text
          selectable
          style={{ fontSize: fontSize.xs, color: m3.colorScheme.onSurfaceVariant, flex: 1 }}
        >
          {t('entryForm.repeatLastLogLoggedOn', {
            defaultValue: 'Logged {{date}}',
            date: formatDate(date, { weekday: 'short', month: 'short', day: 'numeric' }),
          })}
        </Text>
        <Pressable
          onPress={onAdd}
          accessibilityRole="button"
          accessibilityLabel={t('entryForm.repeatLastLogAdd', {
            count: items.length,
            defaultValue: 'Add {{count}} drafts',
          })}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: radius.full,
            backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
          }}
        >
          <AppIcon name="add" size={14} color={m3.colorScheme.primary} />
          <Text
            style={{
              marginLeft: 4,
              fontSize: fontSize.xs,
              fontWeight: '700',
              color: m3.colorScheme.primary,
            }}
          >
            {t('entryForm.repeatLastLogAdd', {
              count: items.length,
              defaultValue: 'Add {{count}} drafts',
            })}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
