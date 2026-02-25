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
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
      }}
    >
      <Text
        selectable
        style={{
          fontSize: 16,
          fontWeight: '600',
          color: m3.colorScheme.onSurface,
          marginBottom: 12,
        }}
      >
        {t('entryForm.pendingLogs', { count: pendingLogs.length })}
      </Text>
      <ScrollView
        nestedScrollEnabled
        style={{ maxHeight: 280 }}
        contentContainerStyle={{ paddingBottom: 4 }}
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
                  padding: 12,
                  borderRadius: 12,
                  marginBottom: 8,
                },
                { backgroundColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.1) },
              ]}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
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
                  style={{ fontSize: 14, fontWeight: '600', color: m3.colorScheme.onSurface }}
                >
                  {logType ? t(logType.labelKey) : t('entryForm.addLog')}
                </Text>
                <Text selectable style={{ fontSize: 12, color: m3.colorScheme.onSurfaceVariant }}>
                  {log.displayDescription}
                </Text>
              </View>
              <Pressable onPress={() => onRemove(log.id)}>
                <AppIcon name="trash-outline" size={20} color={m3.colorScheme.error} />
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
