import { LOG_TYPES, type LogTypeId, type LogType } from '@/constants/calculator-models';
import { fontSize, radius } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { useM3 } from '@/styles/use-theme';
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
  pendingLogTypes?: LogTypeId[];
  hintText?: string;
}

export function LogTypeSelector({
  selectedLogType,
  onSelect,
  hasPendingDrafts = false,
  pendingLogTypes = [],
  hintText,
}: LogTypeSelectorProps) {
  const m3 = useM3();
  const { t } = useTranslation();
  const guidedTourStatus = useGuidedTourStore((s) => s.status);
  const guidedTourStep = useGuidedTourStore((s) => s.currentStep);
  const isGuidedAddLogStep = guidedTourStatus === 'in_progress' && guidedTourStep === 'add_log';
  const showInlineGuidance = isGuidedAddLogStep && selectedLogType === null && !hasPendingDrafts;

  return (
    <GuidedTourTarget
      targetId={GUIDED_TOUR_TARGET_IDS.ADD_LOG_TYPE_SELECTOR}
      style={{
        backgroundColor: m3.surface.s100,
        borderRadius: radius.lg,
        padding: 16,
        marginBottom: 16,
        borderWidth: showInlineGuidance ? 2 : 1,
        borderColor: showInlineGuidance
          ? colorWithOpacity(m3.colorScheme.primary, 0.7)
          : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
      }}
    >
      <View style={{ marginBottom: 12 }}>
        <Text
          selectable
          style={{
            fontSize: fontSize.xs,
            fontWeight: '700',
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            color: m3.colorScheme.onSurfaceVariant,
          }}
        >
          {t('entryForm.whatDidYouDoToday', { defaultValue: 'What did you do today?' })}
        </Text>
        <Text
          selectable
          style={{
            marginTop: 6,
            fontSize: fontSize.xl,
            lineHeight: 24,
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
            fontSize: fontSize.sm,
            lineHeight: 20,
            color: m3.colorScheme.onSurfaceVariant,
          }}
        >
          {hintText ??
            t('entryForm.selectActivityTypeHint', {
              defaultValue: 'Tap a chip to add it to today, then save the stack together.',
            })}
        </Text>
      </View>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        {LOG_TYPES.map((logType: LogType) => {
          const isSelected = selectedLogType === logType.id;
          const isAdded = pendingLogTypes.includes(logType.id as LogTypeId);
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
                minHeight: 42,
                paddingLeft: 8,
                paddingRight: 12,
                paddingVertical: 8,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                borderRadius: radius.full,
                borderWidth: emphasizeSelectedGuidedCard ? 2 : 1,
                backgroundColor: isSelected
                  ? logType.color
                  : isAdded
                    ? colorWithOpacity(m3.colorScheme.primary, 0.08)
                    : emphasizeAllGuidedCards
                      ? colorWithOpacity(m3.colorScheme.primary, 0.03)
                      : m3.surface.s50,
                borderColor: isSelected
                  ? logType.color
                  : isAdded
                    ? colorWithOpacity(m3.colorScheme.primary, 0.35)
                    : emphasizeAllGuidedCards
                      ? colorWithOpacity(m3.colorScheme.primary, 0.25)
                      : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
                opacity: emphasizeAllGuidedCards ? 1 : undefined,
              }}
            >
              <View
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: radius.full,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 7,
                  backgroundColor: isSelected
                    ? '#FFFFFF30'
                    : isAdded
                      ? colorWithOpacity(m3.colorScheme.primary, 0.14)
                      : `${logType.color}12`,
                }}
              >
                <AppIcon
                  name={isAdded ? 'checkmark-circle' : 'add-circle'}
                  size={14}
                  color={isSelected ? '#FFFFFF' : isAdded ? m3.colorScheme.primary : logType.color}
                />
              </View>
              <Text
                selectable
                style={[
                  { fontSize: fontSize.xs, fontWeight: '700', lineHeight: 16 },
                  {
                    color: isSelected
                      ? '#FFFFFF'
                      : isAdded
                        ? m3.colorScheme.primary
                        : m3.colorScheme.onSurface,
                  },
                ]}
                numberOfLines={1}
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
