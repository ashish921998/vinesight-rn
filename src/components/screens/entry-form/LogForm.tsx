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
import { GuidedTourTarget } from '@/features/guided-tour/targets';
import { GUIDED_TOUR_TARGET_IDS } from '@/features/guided-tour/constants';
import { useGuidedTourStore } from '@/features/guided-tour/store';
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
  const guidedTourStatus = useGuidedTourStore((s) => s.status);
  const guidedTourStep = useGuidedTourStore((s) => s.currentStep);
  const showAddEntryGuidance =
    guidedTourStatus === 'in_progress' &&
    guidedTourStep === 'add_log' &&
    isValid &&
    hasFarm &&
    selectedLogType !== null;

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

      {showAddEntryGuidance ? (
        <View
          style={{
            alignItems: 'center',
            marginTop: 12,
            marginBottom: 4,
          }}
        >
          <View
            style={{
              backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.1),
              borderWidth: 1,
              borderColor: colorWithOpacity(m3.colorScheme.primary, 0.3),
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 4,
            }}
          >
            <Text
              style={{
                color: m3.colorScheme.primary,
                fontSize: 12,
                fontWeight: '600',
              }}
            >
              {t('guidedTour.step2.tapAddEntryCoach', {
                defaultValue: 'Tap Add entry to log your activity.',
              })}
            </Text>
          </View>
        </View>
      ) : null}

      <GuidedTourTarget targetId={GUIDED_TOUR_TARGET_IDS.ADD_LOG_ADD_ENTRY}>
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
              borderWidth: showAddEntryGuidance ? 2 : 0,
              borderColor: showAddEntryGuidance
                ? colorWithOpacity(m3.colorScheme.primary, 0.7)
                : 'transparent',
              shadowColor: showAddEntryGuidance ? m3.colorScheme.primary : 'transparent',
              shadowOpacity: showAddEntryGuidance ? 0.25 : 0,
              shadowRadius: showAddEntryGuidance ? 10 : 0,
              shadowOffset: { width: 0, height: 4 },
              elevation: showAddEntryGuidance ? 5 : 0,
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
      </GuidedTourTarget>
    </View>
  );
}
