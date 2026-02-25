import type {
  IrrigationFormData,
  SprayFormData,
  HarvestFormData,
  ExpenseFormData,
  FertigationFormData,
  SprayQuickAddItem,
  FertigationQuickAddItem,
} from '@/components/forms';
import {
  IrrigationForm,
  SprayForm,
  HarvestForm,
  ExpenseForm,
  FertigationForm,
} from '@/components/forms';
import type { LogTypeId } from '@/constants/calculator-models';
import type { TextInputProps } from 'react-native';
import { useM3, useThemeColors } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { AppIcon } from '@/components/ui/app-icon';
import { View, Pressable, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { ChemicalMix } from '@/types/phi';

interface LogFormProps {
  selectedLogType: LogTypeId | null;
  irrigationData: IrrigationFormData;
  sprayData: SprayFormData;
  harvestData: HarvestFormData;
  expenseData: ExpenseFormData;
  fertigationData: FertigationFormData;
  onIrrigationChange: (data: IrrigationFormData) => void;
  onSprayChange: (data: SprayFormData) => void;
  onHarvestChange: (data: HarvestFormData) => void;
  onExpenseChange: (data: ExpenseFormData) => void;
  onFertigationChange: (data: FertigationFormData) => void;
  onInputFocus?: TextInputProps['onFocus'];
  onAdd: () => void;
  isValid: boolean;
  hasFarm: boolean;
  sprayQuickAddItems: SprayQuickAddItem[];
  fertigationQuickAddItems: FertigationQuickAddItem[];
  sprayCatalogOnly?: boolean;
  sprayCatalogMixes?: ChemicalMix[];
}

export function LogForm({
  selectedLogType,
  irrigationData,
  sprayData,
  harvestData,
  expenseData,
  fertigationData,
  onIrrigationChange,
  onSprayChange,
  onHarvestChange,
  onExpenseChange,
  onFertigationChange,
  onInputFocus,
  onAdd,
  isValid,
  hasFarm,
  sprayQuickAddItems,
  fertigationQuickAddItems,
  sprayCatalogOnly = false,
  sprayCatalogMixes = [],
}: LogFormProps) {
  const m3 = useM3();
  const colors = useThemeColors();
  const { t } = useTranslation();

  if (!selectedLogType) return null;

  return (
    <View style={{ backgroundColor: colors.surface[100], borderRadius: 16, padding: 16 }}>
      {selectedLogType === 'irrigation' && (
        <IrrigationForm
          data={irrigationData}
          onChange={onIrrigationChange}
          onInputFocus={onInputFocus}
        />
      )}
      {selectedLogType === 'spray' && (
        <SprayForm
          data={sprayData}
          onChange={onSprayChange}
          onInputFocus={onInputFocus}
          quickAddItems={sprayQuickAddItems}
          catalogOnly={sprayCatalogOnly}
          catalogMixes={sprayCatalogMixes}
        />
      )}
      {selectedLogType === 'harvest' && (
        <HarvestForm data={harvestData} onChange={onHarvestChange} onInputFocus={onInputFocus} />
      )}
      {selectedLogType === 'expense' && (
        <ExpenseForm data={expenseData} onChange={onExpenseChange} onInputFocus={onInputFocus} />
      )}
      {selectedLogType === 'fertigation' && (
        <FertigationForm
          data={fertigationData}
          onChange={onFertigationChange}
          onInputFocus={onInputFocus}
          quickAddItems={fertigationQuickAddItems}
        />
      )}

      <Pressable
        onPress={onAdd}
        disabled={!isValid || !hasFarm}
        style={[
          {
            marginTop: 16,
            paddingVertical: 12,
            borderRadius: 12,
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
          },
          {
            backgroundColor:
              isValid && hasFarm
                ? m3.colorScheme.primary
                : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
          },
        ]}
      >
        <AppIcon
          name="add-circle"
          size={20}
          color={
            isValid && hasFarm
              ? m3.colorScheme.onPrimary
              : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)
          }
        />
        <Text
          selectable
          style={[
            { marginLeft: 8, fontWeight: '600' },
            {
              color:
                isValid && hasFarm
                  ? m3.colorScheme.onPrimary
                  : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6),
            },
          ]}
        >
          {t('entryForm.addEntry')}
        </Text>
      </Pressable>
    </View>
  );
}
