import React from 'react';
import { View, Text, Pressable, TextInput, type TextInputProps } from 'react-native';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import { ICON_REGISTRY, resolveSymbolIconName } from '@/constants/icon-registry';
import { NumericInput } from './form-field';
import { EXPENSE_TYPES, type ExpenseTypeId } from '../../constants/calculator-models';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { formatCurrency } from '@/i18n/format';
import { useCurrency } from '@/hooks/use-currency';
import { useM3, useThemeColors } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';

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
}

// Icon mapping for expense types
const EXPENSE_ICONS: Record<ExpenseTypeId, string> = {
  Equipment: 'wrench.and.screwdriver',
  Fuel: 'car',
  'Seeds/Plants': 'leaf',
  Packaging: 'cube',
  Transport: 'bus',
  Maintenance: 'hammer',
  Other: 'ellipsis',
};

export function ExpenseForm({ data, onChange, onInputFocus, preferredCurrency }: ExpenseFormProps) {
  const colors = useThemeColors();
  const m3 = useM3();
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
  const isValid = data.cost !== undefined && data.cost > 0 && data.type !== '';

  return (
    <View>
      {/* Header with icon */}
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
            Expense
          </Text>
          <Text style={{ fontSize: fontSize.sm, color: colors.surface[500] }}>
            Log farm expense
          </Text>
        </View>
      </View>

      {/* Category Selection */}
      <View style={{ marginBottom: spacing[4] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing[2] }}>
          <View style={{ marginRight: 6 }}>
            <SymbolIcon name="list.bullet" size={16} color={colors.primary[600]} />
          </View>
          <Text
            style={{
              fontSize: fontSize.sm,
              fontWeight: fontWeight.semibold,
              color: colors.surface[800],
            }}
          >
            Category <Text style={{ color: colors.error }}>*</Text>
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
                paddingVertical: 10,
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
                name={EXPENSE_ICONS[type]}
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
                {type}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Amount Input */}
      <NumericInput
        label="Amount"
        icon="cash-outline"
        iconColor={m3.colorScheme.error}
        placeholder="Enter amount"
        value={data.cost}
        onValueChange={(cost) => onChange({ ...data, cost })}
        unit="₹"
        required
        decimals={0}
        hint="Total expense amount"
        onFocus={onInputFocus}
      />

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
            Remarks
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
            placeholder="Add notes about this expense (optional)"
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
          Optional - describe the expense
        </Text>
      </View>

      {/* Summary */}
      {data.type && data.cost !== undefined && data.cost > 0 && (
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
                name={data.type ? EXPENSE_ICONS[data.type] : 'dollarsign.circle.fill'}
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
                {data.type}
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
          color={isValid ? colors.success : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)}
        />
        <Text
          style={{
            fontSize: fontSize.sm,
            marginLeft: spacing[2],
            color: isValid ? colors.success : colors.surface[500],
          }}
        >
          {isValid ? 'Ready to add' : 'Select category and enter amount'}
        </Text>
      </View>
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
