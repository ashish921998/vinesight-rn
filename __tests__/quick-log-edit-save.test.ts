import type {
  ExpenseFormData,
  FertigationFormData,
  HarvestFormData,
  IrrigationFormData,
  SprayFormData,
} from '@/components/forms';
import type {
  ExpenseRecord,
  Farm,
  FertigationRecord,
  HarvestRecord,
  IrrigationRecord,
  SprayRecord,
} from '@/types';
import { saveQuickLogEdit, type QuickLogEditMutations } from '@/utils/quick-log-edit-save';

const DATE = '2026-08-01';
const farm: Farm = { id: 7, name: 'Test Farm', area: 2 } as Farm;

function mutations(overrides: Partial<QuickLogEditMutations> = {}): QuickLogEditMutations {
  return {
    updateIrrigation: jest.fn().mockResolvedValue(undefined),
    updateSpray: jest.fn().mockResolvedValue(undefined),
    updateHarvest: jest.fn().mockResolvedValue(undefined),
    updateExpense: jest.fn().mockResolvedValue(undefined),
    updateFertigation: jest.fn().mockResolvedValue(undefined),
    deleteFertigation: jest.fn().mockResolvedValue(undefined),
    saveLinkedFertigation: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const emptyDrafts = {
  irrigation: { duration: 2 } satisfies IrrigationFormData,
  spray: {
    waterVolume: 100,
    chemicals: [{ id: 'c1', name: 'Captan', quantity: 1, unit: 'gm/L' as const }],
    catalogMixId: null,
  } satisfies SprayFormData,
  harvest: { quantity: 10, grade: 'A', price: 0, buyer: '' } satisfies HarvestFormData,
  expense: { type: 'Fuel' as const, cost: 50, remarks: '' } satisfies ExpenseFormData,
  fertigation: { fertilizers: [] } satisfies FertigationFormData,
};

describe('saveQuickLogEdit', () => {
  it('updates irrigation and creates linked fertigation when rows were added', async () => {
    const m = mutations();
    const record = { id: 11, date: DATE } as IrrigationRecord;
    const drafts = {
      ...emptyDrafts,
      fertigation: {
        fertilizers: [
          {
            id: 'f1',
            name: 'Urea',
            quantity: 5,
            unit: 'kg',
            quantityBasis: 'total' as const,
          },
        ],
      },
    };

    await saveQuickLogEdit({
      target: { type: 'irrigation', record },
      drafts,
      dateStr: DATE,
      farm,
      farmAreaAcres: 2,
      preferredAreaUnit: 'acres',
      isGrapeFarm: true,
      isFertigationSettled: true,
      mutations: m,
    });

    expect(m.updateIrrigation).toHaveBeenCalledWith({
      id: 11,
      updates: { duration: 2, date: DATE },
    });
    expect(m.saveLinkedFertigation).toHaveBeenCalledWith(
      expect.objectContaining({
        linkedIrrigationRecordId: 11,
        dateStr: DATE,
        farm,
      }),
    );
    expect(m.updateFertigation).not.toHaveBeenCalled();
    expect(m.deleteFertigation).not.toHaveBeenCalled();
  });

  it('deletes linked fertigation when irrigation fertilizer rows are cleared', async () => {
    const m = mutations();
    const linked = {
      id: 99,
      client_uuid: 'cu-1',
      farm_id: 7,
    } as FertigationRecord;

    await saveQuickLogEdit({
      target: { type: 'irrigation', record: { id: 11, date: DATE } as IrrigationRecord },
      drafts: emptyDrafts,
      dateStr: DATE,
      farm,
      farmAreaAcres: 2,
      preferredAreaUnit: 'acres',
      isGrapeFarm: false,
      linkedFertigationRecord: linked,
      isFertigationSettled: true,
      mutations: m,
    });

    expect(m.deleteFertigation).toHaveBeenCalledWith({
      id: 99,
      clientUuid: 'cu-1',
      farmId: 7,
    });
    expect(m.saveLinkedFertigation).not.toHaveBeenCalled();
  });

  it('does not create linked fertigation when its lookup failed', async () => {
    const m = mutations();
    const drafts = {
      ...emptyDrafts,
      fertigation: {
        fertilizers: [
          {
            id: 'f1',
            name: 'Urea',
            quantity: 5,
            unit: 'kg',
            quantityBasis: 'total' as const,
          },
        ],
      },
    };

    await saveQuickLogEdit({
      target: { type: 'irrigation', record: { id: 11, date: DATE } as IrrigationRecord },
      drafts,
      dateStr: DATE,
      farm,
      farmAreaAcres: 2,
      preferredAreaUnit: 'acres',
      isGrapeFarm: true,
      isFertigationSettled: false,
      mutations: m,
    });

    expect(m.updateIrrigation).toHaveBeenCalled();
    expect(m.saveLinkedFertigation).not.toHaveBeenCalled();
  });

  it('updates spray via shared builder fields', async () => {
    const m = mutations();
    await saveQuickLogEdit({
      target: { type: 'spray', record: { id: 3, date: DATE } as SprayRecord },
      drafts: emptyDrafts,
      dateStr: DATE,
      farm,
      farmAreaAcres: 2,
      preferredAreaUnit: 'acres',
      isGrapeFarm: true,
      isFertigationSettled: false,
      mutations: m,
    });

    expect(m.updateSpray).toHaveBeenCalledWith({
      id: 3,
      updates: expect.objectContaining({
        dose: 'Water: 100L',
        date: DATE,
        chemical_items: [expect.objectContaining({ name: 'Captan', quantity: 1, unit: 'gm/L' })],
      }),
    });
  });

  it('updates harvest and expense', async () => {
    const m = mutations();
    await saveQuickLogEdit({
      target: { type: 'harvest', record: { id: 4, date: DATE } as HarvestRecord },
      drafts: emptyDrafts,
      dateStr: DATE,
      farm,
      farmAreaAcres: 1,
      preferredAreaUnit: 'acres',
      isGrapeFarm: false,
      isFertigationSettled: false,
      mutations: m,
    });
    expect(m.updateHarvest).toHaveBeenCalledWith({
      id: 4,
      updates: expect.objectContaining({ quantity: 10, grade: 'A', date: DATE }),
    });

    await saveQuickLogEdit({
      target: { type: 'expense', record: { id: 5, date: DATE } as ExpenseRecord },
      drafts: emptyDrafts,
      dateStr: DATE,
      farm,
      farmAreaAcres: 1,
      preferredAreaUnit: 'acres',
      isGrapeFarm: false,
      isFertigationSettled: false,
      mutations: m,
    });
    expect(m.updateExpense).toHaveBeenCalledWith({
      id: 5,
      updates: expect.objectContaining({ type: 'fuel', cost: 50, date: DATE }),
    });
  });

  it('throws when record id is missing', async () => {
    await expect(
      saveQuickLogEdit({
        target: { type: 'harvest', record: { date: DATE } as HarvestRecord },
        drafts: emptyDrafts,
        dateStr: DATE,
        farm,
        farmAreaAcres: 1,
        preferredAreaUnit: 'acres',
        isGrapeFarm: false,
        isFertigationSettled: false,
        mutations: mutations(),
      }),
    ).rejects.toThrow('Record ID is missing');
  });
});
