import { useEffect, useRef } from 'react';
import { radius } from '@/styles/theme';
import type {
  IrrigationFormData,
  SprayFormData,
  HarvestFormData,
  ExpenseFormData,
  FertigationFormData,
  NoteFormData,
  SprayQuickAddItem,
  FertigationQuickAddItem,
} from '@/components/forms';
import { SprayForm, HarvestForm, ExpenseForm, FertigationForm, NoteForm } from '@/components/forms';
import { NumericInput, type NumericInputHandle } from '@/components/forms/form-field';
import type { LogTypeId } from '@/constants/calculator-models';
import type { TextInputProps } from 'react-native';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { AppIcon } from '@/components/ui/app-icon';
import { GuidedTourTarget } from '@/features/guided-tour/targets';
import { GUIDED_TOUR_TARGET_IDS } from '@/features/guided-tour/constants';
import { useGuidedTourStore } from '@/features/guided-tour/store';
import { guidedTourOn } from '@/features/guided-tour/events';
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
  noteData: NoteFormData;
  onIrrigationChange: (data: IrrigationFormData) => void;
  onSprayChange: (data: SprayFormData) => void;
  onHarvestChange: (data: HarvestFormData) => void;
  onExpenseChange: (data: ExpenseFormData) => void;
  onFertigationChange: (data: FertigationFormData) => void;
  onNoteChange: (data: NoteFormData) => void;
  onInputFocus?: TextInputProps['onFocus'];
  onAdd: () => void;
  isValid: boolean;
  hasFarm: boolean;
  sprayQuickAddItems: SprayQuickAddItem[];
  fertigationQuickAddItems: FertigationQuickAddItem[];
  sprayCatalogOnly?: boolean;
  sprayCatalogMixes?: ChemicalMix[];
  showSaveButton?: boolean;
}

export function LogForm({
  selectedLogType,
  irrigationData,
  sprayData,
  harvestData,
  expenseData,
  fertigationData,
  noteData,
  onIrrigationChange,
  onSprayChange,
  onHarvestChange,
  onExpenseChange,
  onFertigationChange,
  onNoteChange,
  onInputFocus,
  onAdd,
  isValid,
  hasFarm,
  sprayQuickAddItems,
  fertigationQuickAddItems,
  sprayCatalogOnly = false,
  sprayCatalogMixes = [],
  showSaveButton = true,
}: LogFormProps) {
  const m3 = useM3();
  const { t } = useTranslation();
  const guidedTourStatus = useGuidedTourStore((s) => s.status);
  const guidedTourStep = useGuidedTourStore((s) => s.currentStep);
  const showAddEntryGuidance =
    guidedTourStatus === 'in_progress' &&
    guidedTourStep === 'add_log' &&
    isValid &&
    hasFarm &&
    selectedLogType !== null;
  const isIrrigationEntry = selectedLogType === 'irrigation';
  const irrigationDurationRef = useRef<NumericInputHandle>(null);

  useEffect(() => {
    const unsubscribe = guidedTourOn('guidedTour.focusLogActivityInput', ({ recordType }) => {
      if (recordType !== 'irrigation') return;
      irrigationDurationRef.current?.focus();
    });
    return unsubscribe;
  }, []);

  if (!selectedLogType) return null;

  const addEntryButton = (
    <GuidedTourTarget
      targetId={GUIDED_TOUR_TARGET_IDS.ADD_LOG_ADD_ENTRY}
      style={{ alignSelf: 'stretch' }}
    >
      <Pressable
        onPress={onAdd}
        disabled={!isValid || !hasFarm}
        style={{
          marginTop: isIrrigationEntry ? 0 : 20,
          paddingVertical: 14,
          borderRadius: radius.lg,
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'center',
          backgroundColor: isValid && hasFarm ? m3.colorScheme.primary : m3.surface.s50,
          borderColor: showAddEntryGuidance
            ? colorWithOpacity(m3.colorScheme.primary, 0.7)
            : isValid && hasFarm
              ? 'transparent'
              : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.16),
          borderWidth: showAddEntryGuidance ? 2 : isValid && hasFarm ? 0 : 1,
        }}
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
          style={{
            marginLeft: 8,
            fontWeight: '600',
            color:
              isValid && hasFarm
                ? m3.colorScheme.onPrimary
                : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6),
          }}
        >
          {t('entryForm.addEntry')}
        </Text>
      </Pressable>
    </GuidedTourTarget>
  );

  if (isIrrigationEntry) {
    return (
      <View style={{ gap: 16 }}>
        <View
          style={{
            backgroundColor: m3.surface.s100,
            borderRadius: radius.xl,
            padding: 20,
            borderWidth: 1,
            borderColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.12),
          }}
        >
          <GuidedTourTarget targetId={GUIDED_TOUR_TARGET_IDS.ADD_LOG_IRRIGATION_DURATION}>
            <NumericInput
              ref={irrigationDurationRef}
              label={t('irrigationForm.durationLabel')}
              placeholder={t('irrigationForm.durationPlaceholder')}
              value={irrigationData.duration}
              onValueChange={(duration) => onIrrigationChange({ ...irrigationData, duration })}
              unit={t('irrigationForm.durationUnit')}
              required
              decimals={1}
              hint={
                isValid
                  ? t('irrigationForm.validation.ready')
                  : t('irrigationForm.validation.incomplete')
              }
              onFocus={onInputFocus}
            />
          </GuidedTourTarget>
        </View>
        {showSaveButton && addEntryButton}
      </View>
    );
  }

  return (
    <View
      style={{
        backgroundColor: m3.surface.s100,
        borderRadius: radius.xl,
        padding: 20,
        borderWidth: 1,
        borderColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.12),
      }}
    >
      {selectedLogType === 'spray' && (
        <SprayForm
          data={sprayData}
          onChange={onSprayChange}
          onInputFocus={onInputFocus}
          quickAddItems={sprayQuickAddItems}
          catalogOnly={sprayCatalogOnly}
          catalogMixes={sprayCatalogMixes}
          compact
        />
      )}
      {selectedLogType === 'harvest' && (
        <HarvestForm
          data={harvestData}
          onChange={onHarvestChange}
          onInputFocus={onInputFocus}
          compact
        />
      )}
      {selectedLogType === 'expense' && (
        <ExpenseForm
          data={expenseData}
          onChange={onExpenseChange}
          onInputFocus={onInputFocus}
          compact
        />
      )}
      {selectedLogType === 'fertigation' && (
        <FertigationForm
          data={fertigationData}
          onChange={onFertigationChange}
          onInputFocus={onInputFocus}
          quickAddItems={fertigationQuickAddItems}
          compact
        />
      )}
      {selectedLogType === 'note' && (
        <NoteForm data={noteData} onChange={onNoteChange} onInputFocus={onInputFocus} />
      )}
      {showSaveButton && addEntryButton}
    </View>
  );
}
