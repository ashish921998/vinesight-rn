import { radius } from '@/styles/theme';
import type { ExpenseFormData, FertigationFormData, NoteFormData } from '@/components/forms';
import { ExpenseForm, FertigationForm, NoteForm } from '@/components/forms';
import type { LogTypeId } from '@/constants/calculator-models';
import type { TextInputProps } from 'react-native';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { AppIcon } from '@/components/ui/app-icon';
import { GuidedTourTarget } from '@/features/guided-tour/targets';
import { GUIDED_TOUR_TARGET_IDS } from '@/features/guided-tour/constants';
import { useGuidedTourStore } from '@/features/guided-tour/store';
import { View, Pressable, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { MasterCatalogProduct } from '@/types/catalog';
import type { RecentInputItem } from '@/hooks/use-records';
import type { FertilizerPlanItem } from '@/types/fertilizer-plan';

const EMPTY_RECENT_INPUT_ITEMS: RecentInputItem[] = [];
const EMPTY_FERTILIZER_PLAN_ITEMS: FertilizerPlanItem[] = [];
const EMPTY_CATALOG_PRODUCTS: MasterCatalogProduct[] = [];

/**
 * The inline log composer — hosts only the log types the shared QuickLogSheet
 * does NOT cover: fertigation and note (sheet has no form for them) and
 * expense when logging across all farms (the sheet takes a single farm). The
 * four quick types (irrigation/spray/harvest/expense) log through the
 * dashboard's QuickLogSheet, opened in draft mode.
 */
interface LogFormProps {
  selectedLogType: LogTypeId | null;
  expenseData: ExpenseFormData;
  fertigationData: FertigationFormData;
  noteData: NoteFormData;
  onExpenseChange: (data: ExpenseFormData) => void;
  onFertigationChange: (data: FertigationFormData) => void;
  onNoteChange: (data: NoteFormData) => void;
  onInputFocus?: TextInputProps['onFocus'];
  onAdd: () => void;
  isValid: boolean;
  hasFarm: boolean;
  fertigationHistoryItems?: RecentInputItem[];
  fertigationPlanItems?: FertilizerPlanItem[];
  fertigationCatalogProducts?: MasterCatalogProduct[];
  /** Farm area in acres — fertigation per-acre ↔ total echo. */
  areaAcres?: number | null;
  showSaveButton?: boolean;
}

export function LogForm({
  selectedLogType,
  expenseData,
  fertigationData,
  noteData,
  onExpenseChange,
  onFertigationChange,
  onNoteChange,
  onInputFocus,
  onAdd,
  isValid,
  hasFarm,
  fertigationHistoryItems = EMPTY_RECENT_INPUT_ITEMS,
  fertigationPlanItems = EMPTY_FERTILIZER_PLAN_ITEMS,
  fertigationCatalogProducts = EMPTY_CATALOG_PRODUCTS,
  areaAcres = null,
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
          marginTop: 20,
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
