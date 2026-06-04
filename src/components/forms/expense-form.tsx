import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, TextInput, type TextInputProps } from 'react-native';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import { ICON_REGISTRY, resolveSymbolIconName } from '@/constants/icon-registry';
import { NumericInput, type NumericInputHandle } from './form-field';
import { EXPENSE_TYPES, type ExpenseTypeId } from '../../constants/calculator-models';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { formatCurrency } from '@/i18n/format';
import { useCurrency } from '@/hooks/use-currency';
import { useM3, useThemeColors } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { EXPENSE_TYPE_ICONS } from '@/utils/expense-icons';
import { GuidedTourTarget } from '@/features/guided-tour/targets';
import { GUIDED_TOUR_TARGET_IDS } from '@/features/guided-tour/constants';
import { useGuidedTourStore } from '@/features/guided-tour/store';
import { guidedTourOn } from '@/features/guided-tour/events';
import { useTranslation } from 'react-i18next';

export interface ExpenseFormData {
  type: ExpenseTypeId | '';
  cost: number | undefined;
  remarks?: string;
  notes?: string;
}

interface ExpenseFormProps {
  data: ExpenseFormData;
  onChange: (data: ExpenseFormData) => void;
  onInputFocus?: TextInputProps['onFocus'];
  preferredCurrency?: string;
  /** Hide the decorative header + summary/validation chrome (inline log composer). */
  compact?: boolean;
}

export function ExpenseForm({
  data,
  onChange,
  onInputFocus,
  preferredCurrency,
  compact = false,
}: ExpenseFormProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const m3 = useM3();
  const guidedTourStatus = useGuidedTourStore((s) => s.status);
  const guidedTourStep = useGuidedTourStore((s) => s.currentStep);
  const resolvedCurrency = useCurrency();
  const isValidCurrency = (code: string | null | undefined): boolean => {
    if (!code || typeof code !== 'string') return false;
    if (!/^[A-Z]{3}$/.test(code)) return false;
    try {
      new Intl.NumberFormat(undefined, { style: 'currency', currency: code });
      return true;
    } catch {
      return false;
    }
  };
  const candidateCurrency = preferredCurrency || resolvedCurrency;
  const currency = isValidCurrency(candidateCurrency)
    ? (candidateCurrency ?? resolvedCurrency)
    : resolvedCurrency;
  const currencySymbol = (0)
    .toLocaleString('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
    .replace(/[\d.,\s]/g, '');
  const isValid = data.cost !== undefined && data.cost > 0 && data.type !== '';
  const showDetailsGuidance =
    guidedTourStatus === 'in_progress' && guidedTourStep === 'add_log' && !isValid;
  const amountRef = useRef<NumericInputHandle>(null);

  useEffect(() => {
    const unsubscribe = guidedTourOn('guidedTour.focusLogActivityInput', ({ recordType }) => {
      if (recordType !== 'expense') return;
      amountRef.current?.focus();
    });
    return unsubscribe;
  }, []);

  return (
    <View>
      {/* Header with icon */}
      {!compact && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing[4] }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: borderRadius.full,
              backgroundColor: colorWithOpacity(colors.error, 0.12),
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: spacing[3],
            }}
          >
            <SymbolIcon
              name={resolveSymbolIconName(ICON_REGISTRY.expense)}
              size={20}
              color={m3.colorScheme.error}
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
              {t('expenseForm.title')}
            </Text>
            <Text style={{ fontSize: fontSize.sm, color: colors.surface[500] }}>
              {t('expenseForm.subtitle')}
            </Text>
          </View>
        </View>
      )}

      <GuidedTourTarget targetId={GUIDED_TOUR_TARGET_IDS.ADD_LOG_EXPENSE_DETAILS}>
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
          {/* Category Selection */}
          <View style={{ marginBottom: spacing[4] }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing[2] }}>
              <View style={{ marginRight: spacing[2] }}>
                <SymbolIcon name="list.bullet" size={16} color={colors.primary[600]} />
              </View>
              <Text
                style={{
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.semibold,
                  color: colors.surface[800],
                }}
              >
                {t('expenseForm.category')} <Text style={{ color: colors.error }}>*</Text>
              </Text>
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
              {EXPENSE_TYPES.map((type) => (
                <Pressable
                  key={type}
                  onPress={() => onChange({ ...data, type })}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: spacing[3],
                    paddingVertical: spacing[3],
                    borderRadius: borderRadius.xl,
                    borderWidth: 1,
                    backgroundColor:
                      data.type === type
                        ? colorWithOpacity(m3.colorScheme.error, 0.12)
                        : colors.surface[100],
                    borderColor: data.type === type ? m3.colorScheme.error : colors.surface[200],
                  }}
                >
                  <SymbolIcon
                    name={EXPENSE_TYPE_ICONS[type]}
                    size={16}
                    color={data.type === type ? m3.colorScheme.error : colors.surface[500]}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={{
                      fontSize: fontSize.sm,
                      fontWeight: fontWeight.medium,
                      color: data.type === type ? m3.colorScheme.error : colors.surface[700],
                    }}
                  >
                    {t(`expenseForm.types.${type}`)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Amount Input */}
          <NumericInput
            ref={amountRef}
            label={t('expenseForm.amount')}
            placeholder={t('expenseForm.amountPlaceholder')}
            value={data.cost}
            onValueChange={(cost) => onChange({ ...data, cost })}
            unit={currencySymbol}
            required
            decimals={0}
            hint={t('expenseForm.amountHint')}
            onFocus={onInputFocus}
          />
        </View>
      </GuidedTourTarget>

      {/* Remarks Input (Optional) */}
      <View style={{ marginBottom: spacing[4] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
          <View style={{ marginRight: 6 }}>
            <SymbolIcon name="doc.text" size={16} color={colors.primary[600]} />
          </View>
          <Text
            style={{
              fontSize: fontSize.sm,
              fontWeight: fontWeight.semibold,
              color: colors.surface[800],
            }}
          >
            {t('expenseForm.remarks.label')}
          </Text>
        </View>

        <View
          style={{
            paddingHorizontal: spacing[4],
            paddingVertical: spacing[3],
            borderRadius: borderRadius.xl,
            borderWidth: 1,
            borderColor: colors.surface[200],
            backgroundColor: colors.surface[100],
          }}
        >
          <TextInput
            style={{ fontSize: fontSize.base, color: colors.surface[900] }}
            placeholder={t('expenseForm.remarks.placeholder')}
            placeholderTextColor={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)}
            value={data.remarks || ''}
            onChangeText={(remarks) => onChange({ ...data, remarks: remarks || undefined })}
            multiline
            numberOfLines={2}
            textAlignVertical="top"
            onFocus={onInputFocus}
          />
        </View>
        <Text style={{ fontSize: fontSize.xs, color: colors.surface[500], marginTop: spacing[1] }}>
          {t('expenseForm.remarks.hint')}
        </Text>
      </View>

      {/* Summary */}
      {!compact && data.type && data.cost !== undefined && data.cost > 0 && (
        <View
          style={{
            backgroundColor: colorWithOpacity(m3.colorScheme.error, 0.12),
            borderRadius: borderRadius.xl,
            padding: spacing[4],
            marginBottom: spacing[4],
          }}
        >
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <SymbolIcon
                name={data.type ? EXPENSE_TYPE_ICONS[data.type] : 'dollarsign.circle.fill'}
                size={20}
                color={m3.colorScheme.error}
              />
              <Text
                style={{
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.medium,
                  color: m3.colorScheme.error,
                  marginLeft: spacing[2],
                }}
              >
                {t(`expenseForm.types.${data.type}`)}
              </Text>
            </View>
            <Text
              style={{
                fontSize: fontSize.lg,
                fontWeight: fontWeight.bold,
                color: m3.colorScheme.error,
              }}
            >
              {formatCurrency(data.cost!, currency)}
            </Text>
          </View>
        </View>
      )}

      {/* Validation indicator */}
      {!compact && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingTop: spacing[4],
            borderTopWidth: 1,
            borderTopColor: colors.surface[100],
          }}
        >
          <SymbolIcon
            name={isValid ? 'checkmark.circle.fill' : 'exclamationmark.circle'}
            size={16}
            color={
              isValid ? colors.success : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)
            }
          />
          <Text
            style={{
              fontSize: fontSize.sm,
              marginLeft: spacing[2],
              color: isValid ? colors.success : colors.surface[500],
            }}
          >
            {isValid
              ? t('common.labels.readyToAdd')
              : t('expenseForm.validation.selectCategoryAndEnterAmount')}
          </Text>
        </View>
      )}
    </View>
  );
}

export function validateExpenseForm(data: ExpenseFormData): boolean {
  return (data.cost ?? 0) > 0 && data.type !== '';
}

// Create empty expense form data
export function createEmptyExpenseFormData(): ExpenseFormData {
  return {
    type: '',
    cost: undefined,
  };
}
