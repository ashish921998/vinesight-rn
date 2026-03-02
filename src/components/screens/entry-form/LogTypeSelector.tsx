import { ACTIVITY_TYPES, type LogTypeId, type LogType } from '@/constants/calculator-models';
import { colorWithOpacity } from '@/utils/color';
import { useM3, useThemeColors } from '@/styles/use-theme';
import { AppIcon } from '@/components/ui/app-icon';
import { GuidedTourTarget } from '@/features/guided-tour/targets';
import { GUIDED_TOUR_TARGET_IDS } from '@/features/guided-tour/constants';
import { guidedTourEmit } from '@/features/guided-tour/events';
import { useGuidedTourStore } from '@/features/guided-tour/store';
import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';

interface LogTypeSelectorProps {
  selectedLogType: LogTypeId | null;
  onSelect: (type: LogTypeId) => void;
  hasPendingDrafts?: boolean;
}

export function LogTypeSelector({
  selectedLogType,
  onSelect,
  hasPendingDrafts = false,
}: LogTypeSelectorProps) {
  const m3 = useM3();
  const colors = useThemeColors();
  const { t } = useTranslation();
  const guidedTourStatus = useGuidedTourStore((s) => s.status);
  const guidedTourStep = useGuidedTourStore((s) => s.currentStep);
  const isGuidedAddLogStep = guidedTourStatus === 'in_progress' && guidedTourStep === 'add_log';
  const showInlineGuidance = isGuidedAddLogStep && selectedLogType === null && !hasPendingDrafts;

  return (
    <GuidedTourTarget
      targetId={GUIDED_TOUR_TARGET_IDS.ADD_LOG_TYPE_SELECTOR}
      style={{
        backgroundColor: colors.surface[100],
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: showInlineGuidance ? 2 : 0,
        borderColor: showInlineGuidance
          ? colorWithOpacity(m3.colorScheme.primary, 0.7)
          : 'transparent',
        shadowColor: showInlineGuidance ? m3.colorScheme.primary : 'transparent',
        shadowOpacity: showInlineGuidance ? 0.24 : 0,
        shadowRadius: showInlineGuidance ? 12 : 0,
        shadowOffset: { width: 0, height: 4 },
        elevation: showInlineGuidance ? 4 : 0,
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
        {t('entryForm.activityType')}
      </Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {ACTIVITY_TYPES.map((logType: LogType) => {
          const isSelected = selectedLogType === logType.id;
          const emphasizeSelectedGuidedCard = isGuidedAddLogStep && isSelected;
          const emphasizeAllGuidedCards = showInlineGuidance;
          return (
            <Pressable
              key={logType.id}
              onPress={() => {
                const selectedType = logType.id as LogTypeId;
                guidedTourEmit('guidedTour.logTypeSelected', { recordType: selectedType });
                onSelect(selectedType);
              }}
              style={{
                width: '18%',
                paddingVertical: 10,
                alignItems: 'center',
                borderRadius: 12,
                borderWidth: emphasizeSelectedGuidedCard ? 2 : 1,
                backgroundColor: isSelected
                  ? colorWithOpacity(m3.colorScheme.primary, 0.08)
                  : emphasizeAllGuidedCards
                    ? colorWithOpacity(m3.colorScheme.primary, 0.03)
                    : colors.surface[50],
                borderColor: isSelected
                  ? colorWithOpacity(m3.colorScheme.primary, 0.25)
                  : emphasizeAllGuidedCards
                    ? colorWithOpacity(m3.colorScheme.primary, 0.25)
                    : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
                opacity: emphasizeAllGuidedCards ? 1 : undefined,
                shadowColor: emphasizeSelectedGuidedCard ? m3.colorScheme.primary : 'transparent',
                shadowOpacity: emphasizeSelectedGuidedCard ? 0.3 : 0,
                shadowRadius: emphasizeSelectedGuidedCard ? 10 : 0,
                shadowOffset: { width: 0, height: 3 },
                elevation: emphasizeSelectedGuidedCard ? 5 : 0,
              }}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 999,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 6,
                  backgroundColor: isSelected ? `${logType.color}20` : `${logType.color}12`,
                }}
              >
                <AppIcon name={logType.icon} size={16} color={logType.color} />
              </View>
              <Text
                selectable
                style={[
                  { fontSize: 10, fontWeight: '600', textAlign: 'center', lineHeight: 12 },
                  { color: isSelected ? m3.colorScheme.primary : m3.colorScheme.onSurface },
                ]}
                numberOfLines={2}
              >
                {t(logType.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </GuidedTourTarget>
  );
}
