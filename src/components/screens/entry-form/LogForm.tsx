import { useEffect, useRef } from 'react';
import { fontSize, radius } from '@/styles/theme';
import type {
  IrrigationFormData,
  SprayFormData,
  HarvestFormData,
  ExpenseFormData,
  FertigationFormData,
  NoteFormData,
} from '@/components/forms';
import { SprayForm, HarvestForm, ExpenseForm, FertigationForm, NoteForm } from '@/components/forms';
import { NumericInput, type NumericInputHandle } from '@/components/forms/form-field';
import type { LogTypeId } from '@/constants/calculator-models';
import type { TextInputProps } from 'react-native';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { AppIcon } from '@/components/ui/app-icon';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
import { ICON_REGISTRY, resolveSymbolIconName } from '@/constants/icon-registry';
import { GuidedTourTarget } from '@/features/guided-tour/targets';
import { GUIDED_TOUR_TARGET_IDS } from '@/features/guided-tour/constants';
import { useGuidedTourStore } from '@/features/guided-tour/store';
import { guidedTourOn } from '@/features/guided-tour/events';
import { View, Pressable, Text, Switch } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { ChemicalMix } from '@/types/phi';
import type { MasterCatalogProduct } from '@/types/catalog';
import type { RecentInputItem } from '@/hooks/use-records';
import type { FertilizerPlanItem } from '@/types/fertilizer-plan';

const EMPTY_SPRAY_CATALOG_MIXES: ChemicalMix[] = [];
const EMPTY_RECENT_INPUT_ITEMS: RecentInputItem[] = [];
const EMPTY_FERTILIZER_PLAN_ITEMS: FertilizerPlanItem[] = [];
const EMPTY_CATALOG_PRODUCTS: MasterCatalogProduct[] = [];

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
  sprayCatalogOnly?: boolean;
  sprayCatalogMixes?: ChemicalMix[];
  sprayHistoryItems?: RecentInputItem[];
  sprayPlanItems?: FertilizerPlanItem[];
  fertigationHistoryItems?: RecentInputItem[];
  fertigationPlanItems?: FertilizerPlanItem[];
  fertigationCatalogProducts?: MasterCatalogProduct[];
  /** Farm area in acres — spray tank echo + fertigation per-acre ↔ total echo. */
  areaAcres?: number | null;
  showSaveButton?: boolean;
  /** Whether the irrigation entry includes an attached fertilizer (fertigation) log. */
  includeFertilizersWithIrrigation?: boolean;
  onIncludeFertilizersWithIrrigationChange?: (value: boolean) => void;
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
  sprayCatalogOnly = false,
  sprayCatalogMixes = EMPTY_SPRAY_CATALOG_MIXES,
  sprayHistoryItems = EMPTY_RECENT_INPUT_ITEMS,
  sprayPlanItems = EMPTY_FERTILIZER_PLAN_ITEMS,
  fertigationHistoryItems = EMPTY_RECENT_INPUT_ITEMS,
  fertigationPlanItems = EMPTY_FERTILIZER_PLAN_ITEMS,
  fertigationCatalogProducts = EMPTY_CATALOG_PRODUCTS,
  areaAcres = null,
  showSaveButton = true,
  includeFertilizersWithIrrigation = false,
  onIncludeFertilizersWithIrrigationChange,
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

        <View
          style={{
            backgroundColor: m3.surface.s100,
            borderRadius: radius.xl,
            borderWidth: 1,
            borderColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.12),
            overflow: 'hidden',
          }}
        >
          <Pressable
            onPress={() =>
              onIncludeFertilizersWithIrrigationChange?.(!includeFertilizersWithIrrigation)
            }
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: 16,
              gap: 12,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: radius.md,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
              }}
            >
              <UiSymbol
                name={resolveSymbolIconName(ICON_REGISTRY.fertigation)}
                size={20}
                color={m3.colorScheme.primary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '600', color: m3.colorScheme.onSurface }}>
                {t('irrigationForm.addFertilizers.title')}
              </Text>
              <Text
                style={{
                  marginTop: 2,
                  fontSize: fontSize.xs,
                  color: m3.colorScheme.onSurfaceVariant,
                }}
              >
                {t('irrigationForm.addFertilizers.subtitle')}
              </Text>
            </View>
            <Switch
              value={includeFertilizersWithIrrigation}
              onValueChange={onIncludeFertilizersWithIrrigationChange}
              trackColor={{
                false: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.24),
                true: m3.colorScheme.primary,
              }}
            />
          </Pressable>
          {includeFertilizersWithIrrigation && (
            <View
              style={{
                paddingHorizontal: 16,
                paddingBottom: 16,
                borderTopWidth: 1,
                borderTopColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.12),
                paddingTop: 16,
              }}
            >
              <FertigationForm
                data={fertigationData}
                onChange={onFertigationChange}
                onInputFocus={onInputFocus}
                historyItems={fertigationHistoryItems}
                planItems={fertigationPlanItems}
                catalogProducts={fertigationCatalogProducts}
                areaAcres={areaAcres}
                compact
              />
            </View>
          )}
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
          catalogOnly={sprayCatalogOnly}
          catalogMixes={sprayCatalogMixes}
          historyItems={sprayHistoryItems}
          planItems={sprayPlanItems}
          areaAcres={areaAcres}
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
          historyItems={fertigationHistoryItems}
          planItems={fertigationPlanItems}
          catalogProducts={fertigationCatalogProducts}
          areaAcres={areaAcres}
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
