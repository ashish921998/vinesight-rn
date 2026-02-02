import React from 'react';
import { View, Text, Pressable, TextInput, type TextInputProps } from 'react-native';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import { NumericInput } from './form-field';
import { EXPENSE_TYPES, type ExpenseTypeId } from '../../constants/calculator-models';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { formatCurrency } from '@/i18n/format';
import { useProfile } from '../../hooks';

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
  const { data: profile } = useProfile();
  const currency = preferredCurrency || profile?.preferred_currency || 'INR';
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
            backgroundColor: '#FEE2E2',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: spacing[3],
          }}
        >
          <SymbolIcon name="dollarsign.circle.fill" size={20} color="#EF4444" />
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
            <SymbolIcon name="list.bullet" size={16} color="#408059" />
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
                backgroundColor: data.type === type ? '#EF4444' : colors.white,
                borderColor: data.type === type ? '#EF4444' : colors.surface[200],
              }}
            >
              <SymbolIcon
                name={EXPENSE_ICONS[type]}
                size={16}
                color={data.type === type ? colors.white : colors.surface[500]}
                style={{ marginRight: 6 }}
              />
              <Text
                style={{
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.medium,
                  color: data.type === type ? colors.white : colors.surface[700],
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
        iconColor="#EF4444"
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
            <SymbolIcon name="doc.text" size={16} color="#408059" />
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
            backgroundColor: colors.white,
          }}
        >
          <TextInput
            style={{ fontSize: fontSize.base, color: colors.surface[900] }}
            placeholder="Add notes about this expense (optional)"
            placeholderTextColor="#9CA3AF"
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
            backgroundColor: '#FEF2F2',
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
                color="#DC2626"
              />
              <Text
                style={{
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.medium,
                  color: '#B91C1C',
                  marginLeft: spacing[2],
                }}
              >
                {data.type}
              </Text>
            </View>
            <Text style={{ fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: '#B91C1C' }}>
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
          color={isValid ? '#22C55E' : '#9CA3AF'}
        />
        <Text
          style={{
            fontSize: fontSize.sm,
            marginLeft: spacing[2],
            color: isValid ? '#16A34A' : colors.surface[500],
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
