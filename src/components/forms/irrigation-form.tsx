import React from 'react';
import { View, Text, type TextInputProps } from 'react-native';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import { NumericInput } from './form-field';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { useThemeColors } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';

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
  const colors = useThemeColors();
  const isValid = data.duration !== undefined && data.duration > 0;

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
            backgroundColor: colorWithOpacity('#3B82F6', 0.16),
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: spacing[3],
          }}
        >
          <SymbolIcon name="drop.fill" size={20} color="#3B82F6" />
        </View>
        <View>
          <Text
            style={{
              fontSize: fontSize.lg,
              fontWeight: fontWeight.semibold,
              color: colors.surface[900],
            }}
          >
            Irrigation
          </Text>
          <Text style={{ fontSize: fontSize.sm, color: colors.surface[500] }}>
            Log irrigation duration
          </Text>
        </View>
      </View>

      {/* Duration Input */}
      <NumericInput
        label="Duration"
        icon="time-outline"
        iconColor="#3B82F6"
        placeholder="Enter duration"
        value={data.duration}
        onValueChange={(duration) => onChange({ ...data, duration })}
        unit="hours"
        required
        decimals={1}
        hint="How long was the irrigation cycle?"
        onFocus={onInputFocus}
      />

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
                  Area
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
                backgroundColor: '#EFF6FF',
                borderRadius: borderRadius.xl,
                padding: spacing[3],
              }}
            >
              <View
                style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing[1] }}
              >
                <SymbolIcon name="drop" size={14} color="#3B82F6" />
                <Text style={{ fontSize: fontSize.xs, color: '#2563EB', marginLeft: spacing[1] }}>
                  Est. Water
                </Text>
              </View>
              <Text
                style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: '#1D4ED8' }}
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
          color={isValid ? colors.success : colors.gray[400]}
        />
        <Text
          style={{
            fontSize: fontSize.sm,
            marginLeft: spacing[2],
            color: isValid ? '#16A34A' : colors.surface[500],
          }}
        >
          {isValid ? 'Ready to add' : 'Enter duration to continue'}
        </Text>
      </View>
    </View>
  );
}

export function validateIrrigationForm(data: IrrigationFormData): boolean {
  return (data.duration ?? 0) > 0;
}
