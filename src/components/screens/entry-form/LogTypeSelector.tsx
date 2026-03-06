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
          rowGap: 10,
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
                width: '31.5%',
                minHeight: 108,
                paddingHorizontal: 10,
                paddingVertical: 12,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 16,
                borderWidth: emphasizeSelectedGuidedCard ? 2 : 1,
                backgroundColor: isSelected
                  ? colorWithOpacity(m3.colorScheme.primary, 0.1)
                  : emphasizeAllGuidedCards
                    ? colorWithOpacity(m3.colorScheme.primary, 0.03)
                    : colors.surface[50],
                borderColor: isSelected
                  ? colorWithOpacity(m3.colorScheme.primary, 0.28)
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
                    backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.14),
                  }}
                >
                  <AppIcon name="checkmark-circle" size={14} color={m3.colorScheme.primary} />
                </View>
              ) : null}
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 999,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 10,
                  backgroundColor: isSelected ? `${logType.color}20` : `${logType.color}12`,
                }}
              >
                <AppIcon name={logType.icon} size={20} color={logType.color} />
              </View>
              <Text
                selectable
                style={[
                  { fontSize: 12, fontWeight: '700', textAlign: 'center', lineHeight: 16 },
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
