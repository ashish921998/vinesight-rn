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

export interface PendingLogFailure {
  message: string;
  code?: string;
  failedCount?: number;
  hasRollbackFailure?: boolean;
}

interface PendingLogsProps {
  pendingLogs: PendingLog[];
  failures?: Record<string, PendingLogFailure>;
  onRemove: (id: string) => void;
}

export function PendingLogs({ pendingLogs, failures = {}, onRemove }: PendingLogsProps) {
  const m3 = useM3();
  const colors = useThemeColors();
  const { t } = useTranslation();
  const failedDraftCount = pendingLogs.filter((log) => failures[log.id]).length;

  if (pendingLogs.length === 0) return null;

  return (
    <View
      style={{
        backgroundColor: colors.surface[100],
        borderRadius: 18,
        padding: 16,
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
              fontSize: 11,
              fontWeight: '700',
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              color: m3.colorScheme.onSurfaceVariant,
            }}
          >
            {t('entryForm.activityStack', { defaultValue: 'Activity stack' })}
          </Text>
          <Text
            selectable
            style={{
              marginTop: 6,
              fontSize: 19,
              lineHeight: 24,
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
      {failedDraftCount > 0 && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 10,
            marginBottom: 12,
            padding: 12,
            borderRadius: 14,
            backgroundColor: colorWithOpacity(m3.colorScheme.error, 0.1),
            borderWidth: 1,
            borderColor: colorWithOpacity(m3.colorScheme.error, 0.22),
          }}
        >
          <AppIcon name="alert-circle-outline" size={18} color={m3.colorScheme.error} />
          <View style={{ flex: 1 }}>
            <Text
              selectable
              style={{
                fontSize: 13,
                lineHeight: 18,
                fontWeight: '700',
                color: m3.colorScheme.error,
              }}
            >
              {t('entryForm.saveFailed.inlineTitle', {
                count: failedDraftCount,
                defaultValue:
                  failedDraftCount === 1
                    ? '1 draft needs attention'
                    : `${failedDraftCount} drafts need attention`,
              })}
            </Text>
            <Text
              selectable
              style={{
                marginTop: 2,
                fontSize: 12,
                lineHeight: 17,
                color: m3.colorScheme.onSurfaceVariant,
              }}
            >
              {t('entryForm.saveFailed.inlineBody', {
                defaultValue: 'Nothing was saved. Review the highlighted drafts and retry.',
              })}
            </Text>
          </View>
        </View>
      )}
      <ScrollView
        nestedScrollEnabled
        style={{ maxHeight: 280 }}
        contentContainerStyle={{ paddingBottom: 2 }}
        showsVerticalScrollIndicator={pendingLogs.length > 3}
      >
        {pendingLogs.map((log, index) => {
          const logType = LOG_TYPES.find((lt) => lt.id === log.type);
          const failure = failures[log.id];
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
                  borderRadius: 14,
                  marginBottom: 10,
                  borderWidth: 1,
                  borderColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.1),
                },
                {
                  backgroundColor: failure
                    ? colorWithOpacity(m3.colorScheme.error, 0.08)
                    : colors.surface[50],
                  borderColor: failure
                    ? colorWithOpacity(m3.colorScheme.error, 0.42)
                    : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.1),
                },
              ]}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
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
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text
                  selectable
                  style={{ fontSize: 14, fontWeight: '700', color: m3.colorScheme.onSurface }}
                >
                  {logType ? t(logType.labelKey) : t('entryForm.addLog')}
                </Text>
                <Text
                  selectable
                  style={{
                    marginTop: 2,
                    fontSize: 12,
                    lineHeight: 17,
                    color: m3.colorScheme.onSurfaceVariant,
                  }}
                  numberOfLines={2}
                >
                  {log.displayDescription}
                </Text>
                {failure && (
                  <View style={{ marginTop: 8 }}>
                    <Text
                      selectable
                      style={{
                        fontSize: 12,
                        lineHeight: 17,
                        fontWeight: '700',
                        color: m3.colorScheme.error,
                      }}
                    >
                      {t('entryForm.saveFailed.draftFailed', {
                        count: failure.failedCount ?? 1,
                        defaultValue:
                          failure.failedCount && failure.failedCount > 1
                            ? `${failure.failedCount} saves failed`
                            : 'Save failed',
                      })}
                    </Text>
                    <Text
                      selectable
                      style={{
                        marginTop: 2,
                        fontSize: 12,
                        lineHeight: 17,
                        color: m3.colorScheme.onSurfaceVariant,
                      }}
                    >
                      {failure.code ? `${failure.message} [${failure.code}]` : failure.message}
                    </Text>
                    {failure.hasRollbackFailure && (
                      <Text
                        selectable
                        style={{
                          marginTop: 2,
                          fontSize: 12,
                          lineHeight: 17,
                          color: m3.colorScheme.error,
                        }}
                      >
                        {t('entryForm.saveFailed.rollbackInlineWarning', {
                          defaultValue:
                            'Some saved records could not be rolled back. Verify records before retrying.',
                        })}
                      </Text>
                    )}
                  </View>
                )}
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
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: failure
                    ? colorWithOpacity(m3.colorScheme.error, 0.12)
                    : colors.surface[100],
                  borderWidth: failure ? 0 : 1,
                  borderColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.1),
                }}
              >
                <AppIcon
                  name="close"
                  size={18}
                  color={
                    failure
                      ? m3.colorScheme.error
                      : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7)
                  }
                />
              </Pressable>
              {pendingLogs.length > 1 && (
                <View
                  style={{
                    position: 'absolute',
                    left: 27,
                    top: 2,
                    minWidth: 18,
                    height: 18,
                    borderRadius: 999,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.surface[100],
                    borderWidth: 1,
                    borderColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.12),
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: '700',
                      color: m3.colorScheme.onSurfaceVariant,
                    }}
                  >
                    {index + 1}
                  </Text>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
