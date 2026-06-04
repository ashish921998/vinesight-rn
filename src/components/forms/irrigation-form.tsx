import React from 'react';
import { View, Text, type TextInputProps } from 'react-native';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import { ICON_REGISTRY, resolveSymbolIconName } from '@/constants/icon-registry';
import { NumericInput } from './form-field';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
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
  showHeader?: boolean;
}

export function IrrigationForm({
  data,
  onChange,
  farmArea,
  systemDischarge,
  onInputFocus,
  showHeader = true,
}: IrrigationFormProps) {
  const { t } = useTranslation();
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
      {showHeader ? (
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
                color: m3.surface.s900,
              }}
            >
              {t('irrigationForm.title')}
            </Text>
            <Text style={{ fontSize: fontSize.sm, color: m3.surface.s500 }}>
              {t('irrigationForm.subtitle')}
            </Text>
          </View>
        </View>
      ) : null}

      <GuidedTourTarget targetId={GUIDED_TOUR_TARGET_IDS.ADD_LOG_IRRIGATION_DURATION}>
        <View>
          <NumericInput
            label={t('irrigationForm.durationLabel')}
            icon="time-outline"
            iconColor={m3.colorScheme.primary}
            placeholder={t('irrigationForm.durationPlaceholder')}
            value={data.duration}
            onValueChange={(duration) => onChange({ ...data, duration })}
            unit={t('irrigationForm.durationUnit')}
            required
            decimals={1}
            hint={t('irrigationForm.durationHint')}
            onFocus={onInputFocus}
          />
          {showDurationGuidance && !isValid ? (
            <Text
              style={{
                fontSize: fontSize.xs,
                fontWeight: fontWeight.semibold,
                color: m3.colorScheme.primary,
                marginTop: -spacing[2],
                marginBottom: spacing[3],
              }}
            >
              {t('irrigationForm.enterHoursGuidance')}
            </Text>
          ) : null}
        </View>
      </GuidedTourTarget>

      {(farmArea || estimatedWater) && (
        <View
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3], marginTop: spacing[1] }}
        >
          {farmArea && (
            <View
              style={{
                flex: 1,
                minWidth: 140,
                backgroundColor: m3.surface.s50,
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
                  color={m3.surface.s600}
                />
                <Text
                  style={{
                    fontSize: fontSize.xs,
                    color: m3.surface.s500,
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
                  color: m3.surface.s900,
                }}
              >
                {farmArea.toFixed(2)} {t('units.acres')}
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
                {estimatedWater} {t('units.millimeter')}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

export function validateIrrigationForm(data: IrrigationFormData): boolean {
  return (data.duration ?? 0) > 0;
}
