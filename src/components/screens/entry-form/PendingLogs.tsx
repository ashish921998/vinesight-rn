import { LOG_TYPES, type LogTypeId } from '@/constants/calculator-models';
import { getExpenseIconName } from '@/utils/expense-icons';
import { resolveSymbolIconName } from '@/constants/icon-registry';
import type {
  ExpenseFormData,
  IrrigationFormData,
  SprayFormData,
  HarvestFormData,
  FertigationFormData,
} from '@/components/forms';
import { useM3, useThemeColors } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { AppIcon } from '@/components/ui/app-icon';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';

export interface PendingLog {
  id: string;
  type: LogTypeId;
  scope: 'single_farm' | 'all_farms';
  farmId: number | null;
  data:
    | IrrigationFormData
    | SprayFormData
    | HarvestFormData
    | ExpenseFormData
    | FertigationFormData;
  displayDescription: string;
  isSourceTaskLog?: boolean;
}

interface PendingLogsProps {
  pendingLogs: PendingLog[];
  onRemove: (id: string) => void;
}

export function PendingLogs({ pendingLogs, onRemove }: PendingLogsProps) {
  const m3 = useM3();
  const colors = useThemeColors();
  const { t } = useTranslation();

  if (pendingLogs.length === 0) return null;

  return (
    <View
      style={{
        backgroundColor: colors.surface[100],
        borderRadius: 20,
        padding: 18,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.12),
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}
      >
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text
            selectable
            style={{
              fontSize: 20,
              fontWeight: '700',
              color: m3.colorScheme.onSurface,
            }}
          >
            {t('entryForm.pendingLogs', { count: pendingLogs.length })}
          </Text>
          <Text
            selectable
            style={{
              marginTop: 4,
              fontSize: 13,
              lineHeight: 18,
              color: m3.colorScheme.onSurfaceVariant,
            }}
          >
            {t('entryForm.pendingLogsHint', {
              defaultValue: 'Review drafts here before saving them together.',
            })}
          </Text>
        </View>
        <View
          style={{
            backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
            borderRadius: 999,
            paddingHorizontal: 10,
            paddingVertical: 6,
          }}
        >
          <Text
            selectable
            style={{
              fontSize: 12,
              fontWeight: '700',
              color: m3.colorScheme.primary,
            }}
          >
            {t('entryForm.drafts', { count: pendingLogs.length })}
          </Text>
        </View>
      </View>
      <ScrollView
        nestedScrollEnabled
        style={{ maxHeight: 280 }}
        contentContainerStyle={{ paddingBottom: 2 }}
        showsVerticalScrollIndicator={pendingLogs.length > 3}
      >
        {pendingLogs.map((log) => {
          const logType = LOG_TYPES.find((lt) => lt.id === log.type);
          const iconName =
            log.type === 'expense'
              ? getExpenseIconName(
                  (log.data as ExpenseFormData | undefined)?.type,
                  resolveSymbolIconName(logType?.icon),
                )
              : resolveSymbolIconName(logType?.icon);
          return (
            <View
              key={log.id}
              style={[
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 14,
                  borderRadius: 16,
                  marginBottom: 10,
                  borderWidth: 1,
                  borderColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.1),
                },
                { backgroundColor: colors.surface[50] },
              ]}
            >
              <View
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 999,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: `${logType?.color ?? m3.colorScheme.primary}15`,
                }}
              >
                <UiSymbol
                  name={iconName}
                  size={18}
                  color={logType?.color ?? m3.colorScheme.primary}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text
                  selectable
                  style={{ fontSize: 16, fontWeight: '700', color: m3.colorScheme.onSurface }}
                >
                  {logType ? t(logType.labelKey) : t('entryForm.addLog')}
                </Text>
                <Text
                  selectable
                  style={{
                    marginTop: 2,
                    fontSize: 13,
                    lineHeight: 18,
                    color: m3.colorScheme.onSurfaceVariant,
                  }}
                >
                  {log.displayDescription}
                </Text>
              </View>
              <Pressable
                onPress={() => onRemove(log.id)}
                accessibilityRole="button"
                accessibilityLabel={t('entryForm.removeDraftAccessibilityLabel', {
                  defaultValue: `Remove ${logType ? t(logType.labelKey) : t('entryForm.addLog')} draft`,
                })}
                accessibilityHint={t('entryForm.removeDraftAccessibilityHint', {
                  defaultValue: 'Removes this draft from the pending logs list.',
                })}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 999,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colorWithOpacity(m3.colorScheme.error, 0.1),
                }}
              >
                <AppIcon name="trash-outline" size={18} color={m3.colorScheme.error} />
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
