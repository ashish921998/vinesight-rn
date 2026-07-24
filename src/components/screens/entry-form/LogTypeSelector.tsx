import {
  LOG_TYPES,
  PICKER_HIDDEN_LOG_TYPE_IDS,
  type LogTypeId,
  type LogType,
} from '@/constants/calculator-models';
import { resolveSymbolIconName } from '@/constants/icon-registry';
import { fontSize, radius } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { useM3 } from '@/styles/use-theme';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
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
  /** Restrict the chip grid to a subset of log types (e.g. delegated logging has no expense). */
  allowedTypes?: LogTypeId[];
}

const EMPTY_PENDING_LOG_TYPES: LogTypeId[] = [];

// The two everyday activities get large hero tiles; the rest share a compact
// row. Fertigation is logged inside the irrigation flow, so it never appears
// as its own tile — the irrigation tile names it instead.
const HERO_LOG_TYPE_IDS: readonly LogTypeId[] = ['irrigation', 'spray'];

export function LogTypeSelector({
  selectedLogType,
  onSelect,
  hasPendingDrafts = false,
  pendingLogTypes = EMPTY_PENDING_LOG_TYPES,
  hintText,
  allowedTypes,
}: LogTypeSelectorProps) {
  const m3 = useM3();
  const { t } = useTranslation();
  const guidedTourStatus = useGuidedTourStore((s) => s.status);
  const guidedTourStep = useGuidedTourStore((s) => s.currentStep);
  const isGuidedAddLogStep = guidedTourStatus === 'in_progress' && guidedTourStep === 'add_log';
  const showInlineGuidance = isGuidedAddLogStep && selectedLogType === null && !hasPendingDrafts;

  const visibleTypes = allowedTypes
    ? LOG_TYPES.filter((logType) => allowedTypes.includes(logType.id as LogTypeId))
    : LOG_TYPES.filter((logType) => !PICKER_HIDDEN_LOG_TYPE_IDS.has(logType.id));
  const heroTypes = visibleTypes.filter((logType) =>
    HERO_LOG_TYPE_IDS.includes(logType.id as LogTypeId),
  );
  const secondaryTypes = visibleTypes.filter(
    (logType) => !HERO_LOG_TYPE_IDS.includes(logType.id as LogTypeId),
  );

  const pendingCountByType = pendingLogTypes.reduce<Partial<Record<LogTypeId, number>>>(
    (acc, type) => {
      acc[type] = (acc[type] ?? 0) + 1;
      return acc;
    },
    {},
  );

  const renderTile = (logType: LogType, variant: 'hero' | 'compact') => {
    const isHero = variant === 'hero';
    const typeId = logType.id as LogTypeId;
    const isSelected = selectedLogType === logType.id;
    const addedCount = pendingCountByType[typeId] ?? 0;
    const isAdded = addedCount > 0;
    const iconBoxSize = isHero ? 42 : 34;
    const showFertilizerHint = isHero && typeId === 'irrigation';

    return (
      <Pressable
        key={logType.id}
        onPress={() => {
          guidedTourEmit('guidedTour.logTypeSelected', { recordType: typeId });
          onSelect(typeId);
        }}
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected }}
        style={{
          flex: 1,
          flexDirection: isHero ? 'row' : 'column',
          alignItems: 'center',
          justifyContent: isHero ? 'flex-start' : 'center',
          gap: isHero ? 10 : 6,
          paddingVertical: isHero ? 14 : 11,
          paddingHorizontal: isHero ? 12 : 6,
          borderRadius: radius.lg,
          borderWidth: isSelected || (showInlineGuidance && isHero) ? 1.5 : 1,
          backgroundColor: isAdded
            ? colorWithOpacity(m3.colorScheme.primary, 0.08)
            : m3.surface.s50,
          borderColor: isSelected
            ? logType.color
            : isAdded
              ? colorWithOpacity(m3.colorScheme.primary, 0.4)
              : showInlineGuidance
                ? colorWithOpacity(m3.colorScheme.primary, 0.25)
                : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
        }}
      >
        <View style={{ position: 'relative' }}>
          <View
            style={{
              width: iconBoxSize,
              height: iconBoxSize,
              borderRadius: radius.md,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colorWithOpacity(logType.color, 0.14),
            }}
          >
            <UiSymbol
              name={resolveSymbolIconName(logType.icon)}
              size={isHero ? 20 : 16}
              color={logType.color}
            />
          </View>
          {isAdded && (
            <View
              style={{
                position: 'absolute',
                top: -6,
                right: -6,
                minWidth: 20,
                height: 20,
                borderRadius: radius.full,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 5,
                backgroundColor: m3.colorScheme.primary,
                borderWidth: 2,
                borderColor: m3.surface.s100,
              }}
            >
              <Text style={{ fontSize: fontSize['2xs'], fontWeight: '800', color: '#FFFFFF' }}>
                {addedCount}
              </Text>
            </View>
          )}
        </View>
        <View style={isHero ? { flex: 1 } : { alignItems: 'center' }}>
          <Text
            selectable
            numberOfLines={1}
            style={{
              fontSize: isHero ? fontSize.base : fontSize.xs,
              fontWeight: '700',
              color: m3.colorScheme.onSurface,
            }}
          >
            {t(logType.labelKey)}
          </Text>
          {showFertilizerHint && (
            <Text
              selectable
              numberOfLines={1}
              style={{
                marginTop: 1,
                fontSize: fontSize.xs,
                color: m3.colorScheme.onSurfaceVariant,
              }}
            >
              {t('entryForm.irrigationFertilizerHint', { defaultValue: '+ fertilizers' })}
            </Text>
          )}
        </View>
      </Pressable>
    );
  };

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
      <Text
        selectable
        style={{
          fontSize: fontSize.lg,
          fontWeight: '800',
          color: m3.colorScheme.onSurface,
          marginBottom: 12,
        }}
      >
        {t('entryForm.whatDidYouDoToday', { defaultValue: 'What did you do today?' })}
      </Text>

      {showInlineGuidance && hintText && (
        <Text
          selectable
          style={{
            marginTop: -6,
            marginBottom: 12,
            fontSize: fontSize.sm,
            lineHeight: 20,
            color: m3.colorScheme.onSurfaceVariant,
          }}
        >
          {hintText}
        </Text>
      )}

      {heroTypes.length > 0 && (
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: secondaryTypes.length ? 8 : 0 }}>
          {heroTypes.map((logType) => renderTile(logType, 'hero'))}
        </View>
      )}

      {secondaryTypes.length > 0 && (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {secondaryTypes.map((logType) => renderTile(logType, 'compact'))}
        </View>
      )}
    </GuidedTourTarget>
  );
}
