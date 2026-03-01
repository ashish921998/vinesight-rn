import React from 'react';
import { View, Text, type TextInputProps } from 'react-native';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import { ICON_REGISTRY, resolveSymbolIconName } from '@/constants/icon-registry';
import { NumericInput } from './form-field';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { useM3, useThemeColors } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { GuidedTourTarget } from '@/features/guided-tour/targets';
import { GUIDED_TOUR_TARGET_IDS } from '@/features/guided-tour/constants';
import { useGuidedTourStore } from '@/features/guided-tour/store';
import { useTranslation } from 'react-i18next';

export interface IrrigationFormData {
  duration: number | undefined;
  notes?: string;
}

interface IrrigationFormProps {
  data: IrrigationFormData;
  onChange: (data: IrrigationFormData) => void;
  farmArea?: number;
  systemDischarge?: number;
  onInputFocus?: TextInputProps['onFocus'];
}

export function IrrigationForm({
  data,
  onChange,
  farmArea,
  systemDischarge,
  onInputFocus,
}: IrrigationFormProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const m3 = useM3();
  const isValid = data.duration !== undefined && data.duration > 0;
  const guidedTourStatus = useGuidedTourStore((s) => s.status);
  const guidedTourStep = useGuidedTourStore((s) => s.currentStep);
  const showDurationGuidance =
    guidedTourStatus === 'in_progress' && guidedTourStep === 'add_log' && !isValid;

  // Calculate estimated water applied
  const estimatedWater =
    systemDischarge && data.duration !== undefined && data.duration > 0
      ? (data.duration * systemDischarge).toFixed(1)
      : null;

  return (
    <View>
      {/* Header with icon */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing[4] }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: borderRadius.full,
            backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.16),
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: spacing[3],
          }}
        >
          <SymbolIcon
            name={resolveSymbolIconName(ICON_REGISTRY.irrigation)}
            size={20}
            color={m3.colorScheme.primary}
          />
        </View>
        <View>
          <Text
            style={{
              fontSize: fontSize.lg,
              fontWeight: fontWeight.semibold,
              color: colors.surface[900],
            }}
          >
            {t('irrigationForm.title')}
          </Text>
          <Text style={{ fontSize: fontSize.sm, color: colors.surface[500] }}>
            {t('irrigationForm.subtitle')}
          </Text>
        </View>
      </View>

      {/* Duration Input */}
      <GuidedTourTarget targetId={GUIDED_TOUR_TARGET_IDS.ADD_LOG_IRRIGATION_DURATION}>
        <View
          style={{
            borderRadius: borderRadius.xl,
            borderWidth: showDurationGuidance ? 2 : 0,
            borderColor: showDurationGuidance
              ? colorWithOpacity(m3.colorScheme.primary, 0.7)
              : 'transparent',
            backgroundColor: showDurationGuidance
              ? colorWithOpacity(m3.colorScheme.primary, 0.03)
              : 'transparent',
            paddingHorizontal: showDurationGuidance ? spacing[2] : 0,
            paddingTop: showDurationGuidance ? spacing[2] : 0,
          }}
        >
          <NumericInput
            label={t('irrigationForm.durationLabel')}
            icon="time-outline"
            iconColor={m3.colorScheme.primary}
            placeholder={t('irrigationForm.durationPlaceholder')}
            value={data.duration}
            onValueChange={(duration) => onChange({ ...data, duration })}
            unit="hours"
            required
            decimals={1}
            hint={t('irrigationForm.durationHint')}
            onFocus={onInputFocus}
          />
          {showDurationGuidance ? (
            <Text
              style={{
                marginBottom: spacing[2],
                marginTop: -spacing[1],
                fontSize: fontSize.xs,
                fontWeight: fontWeight.semibold,
                color: m3.colorScheme.primary,
              }}
            >
              {t('irrigationForm.enterHoursGuidance')}
            </Text>
          ) : null}
        </View>
      </GuidedTourTarget>

      {/* Info cards */}
      {(farmArea || estimatedWater) && (
        <View
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3], marginTop: spacing[2] }}
        >
          {farmArea && (
            <View
              style={{
                flex: 1,
                minWidth: 140,
                backgroundColor: colors.surface[50],
                borderRadius: borderRadius.xl,
                padding: spacing[3],
              }}
            >
              <View
                style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing[1] }}
              >
                <SymbolIcon
                  name="arrow.up.left.and.arrow.down.right"
                  size={14}
                  color={colors.surface[600]}
                />
                <Text
                  style={{
                    fontSize: fontSize.xs,
                    color: colors.surface[500],
                    marginLeft: spacing[1],
                  }}
                >
                  {t('irrigationForm.areaLabel')}
                </Text>
              </View>
              <Text
                style={{
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.semibold,
                  color: colors.surface[900],
                }}
              >
                {farmArea.toFixed(2)} acres
              </Text>
            </View>
          )}

          {estimatedWater && (
            <View
              style={{
                flex: 1,
                minWidth: 140,
                backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.1),
                borderRadius: borderRadius.xl,
                padding: spacing[3],
              }}
            >
              <View
                style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing[1] }}
              >
                <SymbolIcon name="drop" size={14} color={m3.colorScheme.primary} />
                <Text
                  style={{
                    fontSize: fontSize.xs,
                    color: m3.colorScheme.primary,
                    marginLeft: spacing[1],
                  }}
                >
                  {t('irrigationForm.estimatedWaterLabel')}
                </Text>
              </View>
              <Text
                style={{
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.semibold,
                  color: m3.colorScheme.onSurface,
                }}
              >
                {estimatedWater} mm
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Validation indicator */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginTop: spacing[4],
          paddingTop: spacing[4],
          borderTopWidth: 1,
          borderTopColor: colors.surface[100],
        }}
      >
        <SymbolIcon
          name={isValid ? 'checkmark.circle.fill' : 'exclamationmark.circle'}
          size={16}
          color={isValid ? colors.success : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)}
        />
        <Text
          style={{
            fontSize: fontSize.sm,
            marginLeft: spacing[2],
            color: isValid ? colors.success : colors.surface[500],
          }}
        >
          {isValid
            ? t('irrigationForm.validation.ready')
            : t('irrigationForm.validation.incomplete')}
        </Text>
      </View>
    </View>
  );
}

export function validateIrrigationForm(data: IrrigationFormData): boolean {
  return (data.duration ?? 0) > 0;
}
