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
  hintText?: string;
}

export function LogTypeSelector({
  selectedLogType,
  onSelect,
  hasPendingDrafts = false,
  hintText,
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
        borderRadius: 20,
        padding: 18,
        marginBottom: 16,
        borderWidth: showInlineGuidance ? 2 : 1,
        borderColor: showInlineGuidance
          ? colorWithOpacity(m3.colorScheme.primary, 0.7)
          : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
      }}
    >
      <View style={{ marginBottom: 14 }}>
        <Text
          selectable
          style={{
            fontSize: 20,
            fontWeight: '700',
            color: m3.colorScheme.onSurface,
          }}
        >
          {t('entryForm.activityType')}
        </Text>
        <Text
          selectable
          style={{
            marginTop: 6,
            fontSize: 14,
            lineHeight: 20,
            color: m3.colorScheme.onSurfaceVariant,
          }}
        >
          {hintText ?? t('entryForm.selectActivityTypeHint')}
        </Text>
      </View>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          rowGap: 8,
        }}
      >
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
                width: '31%',
                minHeight: 72,
                paddingHorizontal: 8,
                paddingVertical: 8,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 12,
                borderWidth: emphasizeSelectedGuidedCard ? 2 : 1,
                // Cellar Ledger spec: active chip uses category color bg with white text
                backgroundColor: isSelected
                  ? logType.color
                  : emphasizeAllGuidedCards
                    ? colorWithOpacity(m3.colorScheme.primary, 0.03)
                    : colors.surface[50],
                borderColor: isSelected
                  ? logType.color
                  : emphasizeAllGuidedCards
                    ? colorWithOpacity(m3.colorScheme.primary, 0.25)
                    : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
                opacity: emphasizeAllGuidedCards ? 1 : undefined,
              }}
            >
              {isSelected ? (
                <View
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#FFFFFF',
                  }}
                >
                  <AppIcon name="checkmark-circle" size={14} color={logType.color} />
                </View>
              ) : null}
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 999,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 6,
                  backgroundColor: isSelected ? '#FFFFFF30' : `${logType.color}12`,
                }}
              >
                <AppIcon
                  name={logType.icon}
                  size={16}
                  color={isSelected ? '#FFFFFF' : logType.color}
                />
              </View>
              <Text
                selectable
                style={[
                  { fontSize: 12, fontWeight: '700', textAlign: 'center', lineHeight: 16 },
                  // Cellar Ledger spec: active uses white text, inactive uses onSurface
                  { color: isSelected ? '#FFFFFF' : m3.colorScheme.onSurface },
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
