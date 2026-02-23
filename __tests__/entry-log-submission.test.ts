import { PHI_CALC_VERSION } from '@/services/phi-service';
import { submitEntryPendingLog, type EntryLogSubmitters } from '@/utils/entry-log-submission';

jest.mock('@/services/nutrient-flow-service', () => ({
  calculateNutrientTotalsForLog: jest.fn(() => ({
    nutrientTotalsElemental: { N: 1.2 },
    nutrientTotalsElementalPerAcre: { N: 0.12 },
    coveragePercent: 100,
  })),
}));

const baseFarm = {
  id: 7,
  area: 10,
  total_tank_capacity: 1000,
  system_discharge: 50,
  remaining_water: 100,
  date_of_pruning: '2026-01-01',
};

function createSubmitters(): jest.Mocked<EntryLogSubmitters> {
  return {
    createIrrigation: jest.fn().mockResolvedValue({ id: 11 }),
    createSpray: jest.fn().mockResolvedValue({ id: 12 }),
    createHarvest: jest.fn().mockResolvedValue({ id: 13 }),
    createExpense: jest.fn().mockResolvedValue({ id: 14 }),
    createFertigation: jest.fn().mockResolvedValue({ id: 15 }),
    updateWaterLevel: jest.fn().mockResolvedValue({}),
  };
}

describe('submitEntryPendingLog', () => {
  it('submits irrigation log and updates water level', async () => {
    const submitters = createSubmitters();
    const result = await submitEntryPendingLog({
      log: {
        id: 'log-irrigation',
        type: 'irrigation',
        data: { duration: 2 },
      },
      dateStr: '2026-02-11',
      farm: baseFarm,
      submitters,
    });

    expect(submitters.createIrrigation).toHaveBeenCalledWith({
      farm_id: 7,
      date: '2026-02-11',
      duration: 2,
      area: 10,
      growth_stage: '',
      moisture_status: '',
      system_discharge: 50,
      date_of_pruning: '2026-01-01',
    });
    expect(submitters.updateWaterLevel).toHaveBeenCalledWith({
      farmId: 7,
      remainingWater: 200,
    });
    expect(result).toEqual({
      pendingLogId: 'log-irrigation',
      type: 'irrigation',
      recordId: 11,
    });
  });

  it('submits spray log', async () => {
    const submitters = createSubmitters();
    const result = await submitEntryPendingLog({
      log: {
        id: 'log-spray',
        type: 'spray',
        data: {
          waterVolume: 200,
          chemicals: [
            {
              id: 'c1',
              name: 'Copper Oxychloride',
              quantity: 2,
              unit: 'gm/L',
              quantityBasis: 'total',
            },
          ],
        },
      },
      dateStr: '2026-02-11',
      farm: baseFarm,
      submitters,
    });

    expect(submitters.createSpray).toHaveBeenCalledWith(
      expect.objectContaining({
        farm_id: 7,
        date: '2026-02-11',
        chemical: 'Copper Oxychloride (2 gm/L)',
        dose: 'Water: 200L',
        area: 10,
        nutrient_totals_elemental: { N: 1.2 },
        nutrient_totals_elemental_per_acre: { N: 0.12 },
        nutrient_calc_coverage: 100,
      }),
    );
    expect(result.recordId).toBe(12);
  });

  it('writes PHI snapshot fields for catalog spray log', async () => {
    const submitters = createSubmitters();
    await submitEntryPendingLog({
      log: {
        id: 'log-spray-phi',
        type: 'spray',
        data: {
          waterVolume: 200,
          catalogMixId: 991,
          safeHarvestDate: '2026-02-20',
          governingPhiDays: 20,
          phiBlockingComponent: 'Lannate',
          phiStatus: 'verified',
          chemicals: [
            {
              id: 'c1',
              name: 'Lannate',
              quantity: 1,
              unit: 'gm/L',
              quantityBasis: 'total',
            },
          ],
        },
      },
      dateStr: '2026-02-01',
      farm: baseFarm,
      submitters,
    });

    expect(submitters.createSpray).toHaveBeenCalledWith(
      expect.objectContaining({
        catalog_mix_id: 991,
        governing_phi_days: 20,
        safe_harvest_date: '2026-02-20',
        phi_calc_version: PHI_CALC_VERSION,
        phi_blocking_component: 'Lannate',
        phi_status: 'verified',
      }),
    );
  });

  it('submits harvest log', async () => {
    const submitters = createSubmitters();
    const result = await submitEntryPendingLog({
      log: {
        id: 'log-harvest',
        type: 'harvest',
        data: {
          quantity: 500,
          grade: 'A',
          price: 30,
          buyer: 'Trader',
        },
      },
      dateStr: '2026-02-11',
      farm: baseFarm,
      submitters,
    });

    expect(submitters.createHarvest).toHaveBeenCalledWith({
      farm_id: 7,
      date: '2026-02-11',
      quantity: 500,
      grade: 'A',
      price: 30,
      buyer: 'Trader',
      date_of_pruning: '2026-01-01',
    });
    expect(result.recordId).toBe(13);
  });

  it('submits expense log with normalized expense type', async () => {
    const submitters = createSubmitters();
    const result = await submitEntryPendingLog({
      log: {
        id: 'log-expense',
        type: 'expense',
        data: {
          type: 'Other',
          cost: 300,
          remarks: 'misc',
        },
      },
      dateStr: '2026-02-11',
      farm: baseFarm,
      submitters,
    });

    expect(submitters.createExpense).toHaveBeenCalledWith({
      farm_id: 7,
      date: '2026-02-11',
      type: 'other',
      cost: 300,
      date_of_pruning: '2026-01-01',
      remarks: 'misc',
    });
    expect(result.recordId).toBe(14);
  });

  it('submits fertigation log', async () => {
    const submitters = createSubmitters();
    const result = await submitEntryPendingLog({
      log: {
        id: 'log-fertigation',
        type: 'fertigation',
        data: {
          waterVolume: 500,
          fertilizers: [
            {
              name: 'Urea',
              quantity: 20,
              unit: 'kg',
              quantityBasis: 'total',
            },
          ],
        },
      },
      dateStr: '2026-02-11',
      farm: baseFarm,
      submitters,
    });

    expect(submitters.createFertigation).toHaveBeenCalledWith(
      expect.objectContaining({
        farm_id: 7,
        date: '2026-02-11',
        water_volume: 500,
        area: 10,
        nutrient_totals_elemental: { N: 1.2 },
        nutrient_totals_elemental_per_acre: { N: 0.12 },
        nutrient_calc_coverage: 100,
      }),
    );
    expect(result.recordId).toBe(15);
  });

  it('normalizes per-area fertigation quantity from hectares to acres', async () => {
    const submitters = createSubmitters();

    await submitEntryPendingLog({
      log: {
        id: 'log-fertigation-hectare',
        type: 'fertigation',
        data: {
          waterVolume: 500,
          fertilizers: [
            {
              name: 'Urea',
              quantity: 10,
              unit: 'kg',
              quantityBasis: 'per_acre',
            },
          ],
        },
      },
      dateStr: '2026-02-11',
      farm: { ...baseFarm, areaUnit: 'hectares' },
      submitters,
    });

    expect(submitters.createFertigation).toHaveBeenCalledWith(
      expect.objectContaining({
        fertilizers: [
          expect.objectContaining({
            name: 'Urea',
            unit: 'kg',
            quantity_basis: 'per_acre',
            quantity: 4.04686,
          }),
        ],
      }),
    );
  });

  it('normalizes per-area spray quantity from hectares to acres', async () => {
    const submitters = createSubmitters();

    await submitEntryPendingLog({
      log: {
        id: 'log-spray-hectare',
        type: 'spray',
        data: {
          waterVolume: 300,
          chemicals: [
            {
              id: 'c1',
              name: 'Sulphur',
              quantity: 10,
              unit: 'kg',
              quantityBasis: 'per_acre',
            },
          ],
        },
      },
      dateStr: '2026-02-11',
      farm: { ...baseFarm, areaUnit: 'hectares' },
      submitters,
    });

    expect(submitters.createSpray).toHaveBeenCalledWith(
      expect.objectContaining({
        chemical_items: [
          expect.objectContaining({
            name: 'Sulphur',
            unit: 'kg',
            quantity_basis: 'per_acre',
            quantity: 4.04686,
          }),
        ],
      }),
    );
  });
});
