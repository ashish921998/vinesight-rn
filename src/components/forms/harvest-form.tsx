import React from 'react';
import { View, Text, Pressable, TextInput, type TextInputProps } from 'react-native';
import { Symbol as Icon } from '@/components/ui/symbol';
import { ICON_REGISTRY, resolveSymbolIconName } from '@/constants/icon-registry';
import { NumericInput } from './form-field';
import { HARVEST_GRADES, type HarvestGrade } from '../../constants/calculator-models';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { useM3, useThemeColors } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { GuidedTourTarget } from '@/features/guided-tour/targets';
import { GUIDED_TOUR_TARGET_IDS } from '@/features/guided-tour/constants';
import { useGuidedTourStore } from '@/features/guided-tour/store';
import { useTranslation } from 'react-i18next';

export interface HarvestFormData {
  quantity: number | undefined;
  grade: HarvestGrade | '';
  price?: number;
  buyer?: string;
  notes?: string;
}

interface HarvestFormProps {
  data: HarvestFormData;
  onChange: (data: HarvestFormData) => void;
  onInputFocus?: TextInputProps['onFocus'];
}

export function HarvestForm({ data, onChange, onInputFocus }: HarvestFormProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const m3 = useM3();
  const isValid = data.quantity !== undefined && data.quantity > 0 && data.grade !== '';
  const guidedTourStatus = useGuidedTourStore((s) => s.status);
  const guidedTourStep = useGuidedTourStore((s) => s.currentStep);
  const showDetailsGuidance =
    guidedTourStatus === 'in_progress' && guidedTourStep === 'add_log' && !isValid;

  // Calculate total value if price is set
  const totalValue =
    data.price && data.quantity !== undefined && data.quantity > 0
      ? (data.quantity * data.price).toFixed(0)
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
            backgroundColor: colorWithOpacity(colors.warning, 0.2),
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: spacing[3],
          }}
        >
          <Icon
            name={resolveSymbolIconName(ICON_REGISTRY.harvest)}
            size={20}
            color={colors.warning}
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
            {t('harvestForm.title')}
          </Text>
          <Text style={{ fontSize: fontSize.sm, color: colors.surface[500] }}>
            {t('harvestForm.subtitle')}
          </Text>
        </View>
      </View>

      <GuidedTourTarget targetId={GUIDED_TOUR_TARGET_IDS.ADD_LOG_HARVEST_DETAILS}>
        <View
          style={{
            borderRadius: borderRadius.xl,
            borderWidth: showDetailsGuidance ? 2 : 0,
            borderColor: showDetailsGuidance
              ? colorWithOpacity(m3.colorScheme.primary, 0.7)
              : 'transparent',
            backgroundColor: showDetailsGuidance
              ? colorWithOpacity(m3.colorScheme.primary, 0.03)
              : 'transparent',
            paddingHorizontal: showDetailsGuidance ? spacing[2] : 0,
            paddingTop: showDetailsGuidance ? spacing[2] : 0,
          }}
        >
          {/* Quantity Input */}
          <NumericInput
            label={t('harvestForm.quantityLabel')}
            icon="scale-outline"
            iconColor={colors.warning}
            placeholder={t('harvestForm.quantityPlaceholder')}
            value={data.quantity}
            onValueChange={(quantity) => onChange({ ...data, quantity })}
            unit={t('harvestForm.unitKg')}
            required
            decimals={1}
            hint={t('harvestForm.quantityHint')}
            onFocus={onInputFocus}
          />

          {/* Grade Selection */}
          <View style={{ marginBottom: spacing[4] }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing[2] }}>
              <View style={{ marginRight: 6 }}>
                <Icon name="star" size={16} color={colors.primary[600]} />
              </View>
              <Text
                style={{
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.semibold,
                  color: colors.surface[800],
                }}
              >
                Grade <Text style={{ color: colors.error }}>*</Text>
              </Text>
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
              {HARVEST_GRADES.map((grade) => (
                <Pressable
                  key={grade}
                  onPress={() => onChange({ ...data, grade })}
                  style={{
                    paddingHorizontal: spacing[4],
                    paddingVertical: 10,
                    borderRadius: borderRadius.xl,
                    borderWidth: 1,
                    backgroundColor:
                      data.grade === grade
                        ? colorWithOpacity(colors.warning, 0.9)
                        : colors.surface[100],
                    borderColor: data.grade === grade ? colors.warning : colors.surface[200],
                  }}
                >
                  <Text
                    style={{
                      fontSize: fontSize.sm,
                      fontWeight: fontWeight.medium,
                      color: data.grade === grade ? m3.colorScheme.onWarning : colors.surface[700],
                    }}
                  >
                    {grade}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </GuidedTourTarget>

      {/* Price Input (Optional) */}
      <NumericInput
        label={t('harvestForm.pricePerKgLabel')}
        icon="cash-outline"
        iconColor={colors.success}
        placeholder={t('harvestForm.pricePerKgPlaceholder')}
        value={data.price}
        onValueChange={(price) => onChange({ ...data, price })}
        unit="₹"
        decimals={0}
        hint={t('harvestForm.pricePerKgHint')}
        onFocus={onInputFocus}
      />

      {/* Buyer Input (Optional) */}
      <View style={{ marginBottom: spacing[4] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
          <View style={{ marginRight: 6 }}>
            <Icon name="person" size={16} color={colors.primary[600]} />
          </View>
          <Text
            style={{
              fontSize: fontSize.sm,
              fontWeight: fontWeight.semibold,
              color: colors.surface[800],
            }}
          >
            {t('harvestForm.buyerLabel')}
          </Text>
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: spacing[4],
            paddingVertical: spacing[3],
            borderRadius: borderRadius.xl,
            borderWidth: 1,
            borderColor: colors.surface[200],
            backgroundColor: colors.surface[100],
          }}
        >
          <View style={{ marginRight: 10 }}>
            <Icon name="person" size={20} color={colors.surface[600]} />
          </View>
          <TextInput
            style={{ flex: 1, fontSize: fontSize.base, color: colors.surface[900] }}
            placeholder={t('harvestForm.buyerPlaceholder')}
            placeholderTextColor={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)}
            value={data.buyer || ''}
            onChangeText={(buyer) => onChange({ ...data, buyer: buyer || undefined })}
            onFocus={onInputFocus}
          />
        </View>
        <Text style={{ fontSize: fontSize.xs, color: colors.surface[500], marginTop: spacing[1] }}>
          {t('harvestForm.buyerHint')}
        </Text>
      </View>

      {/* Summary Card */}
      {(totalValue || data.grade) && (
        <View
          style={{
            backgroundColor: colorWithOpacity(colors.warning, 0.12),
            borderRadius: borderRadius.xl,
            padding: spacing[4],
            marginBottom: spacing[4],
          }}
        >
          <Text
            style={{
              fontSize: fontSize.sm,
              fontWeight: fontWeight.semibold,
              color: colors.warning,
              marginBottom: spacing[2],
            }}
          >
            Summary
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[4] }}>
            {data.quantity !== undefined && data.quantity > 0 && (
              <View>
                <Text
                  style={{
                    fontSize: fontSize.xs,
                    color: colorWithOpacity(colors.warning, 0.9),
                  }}
                >
                  Quantity
                </Text>
                <Text
                  style={{
                    fontSize: fontSize.base,
                    fontWeight: fontWeight.semibold,
                    color: m3.colorScheme.onSurface,
                  }}
                >
                  {data.quantity!.toFixed(1)} kg
                </Text>
              </View>
            )}
            {data.grade && (
              <View>
                <Text
                  style={{
                    fontSize: fontSize.xs,
                    color: colorWithOpacity(colors.warning, 0.9),
                  }}
                >
                  Grade
                </Text>
                <Text
                  style={{
                    fontSize: fontSize.base,
                    fontWeight: fontWeight.semibold,
                    color: m3.colorScheme.onSurface,
                  }}
                >
                  {data.grade}
                </Text>
              </View>
            )}
            {totalValue && (
              <View>
                <Text
                  style={{
                    fontSize: fontSize.xs,
                    color: colorWithOpacity(colors.warning, 0.9),
                  }}
                >
                  Total Value
                </Text>
                <Text
                  style={{
                    fontSize: fontSize.base,
                    fontWeight: fontWeight.semibold,
                    color: m3.colorScheme.onSurface,
                  }}
                >
                  ₹{totalValue}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Validation indicator */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingTop: spacing[4],
          borderTopWidth: 1,
          borderTopColor: colors.surface[100],
        }}
      >
        <Icon
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
          {isValid ? 'Ready to add' : 'Enter quantity and select grade'}
        </Text>
      </View>
    </View>
  );
}

export function validateHarvestForm(data: HarvestFormData): boolean {
  return (data.quantity ?? 0) > 0 && data.grade !== '';
}

// Create empty harvest form data
export function createEmptyHarvestFormData(): HarvestFormData {
  return {
    quantity: undefined,
    grade: '',
  };
}
