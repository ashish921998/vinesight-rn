import { getSecondaryDetail } from '@/utils/activity-details';
import type {
  ExpenseRecord,
  HarvestRecord,
  IrrigationRecord,
  SprayRecord,
  FertigationRecord,
} from '@/types';

describe('TimelineLogCard secondary details', () => {
  it('keeps acreage and other details for professional activity cards', () => {
    const spray: SprayRecord = {
      farm_id: 1,
      date: '2026-03-15',
      chemical: 'Copper',
      dose: '1 kg',
      area: 2,
      weather: 'Calm',
      operator: 'Farmer',
    };

    expect(getSecondaryDetail('spray', spray)).toBe('2 acres • Calm');
  });

  it('renders irrigation moisture status alongside acreage', () => {
    const irrigation: IrrigationRecord = {
      farm_id: 1,
      date: '2026-03-15',
      duration: 2,
      area: 2,
      growth_stage: 'fruiting',
      moisture_status: 'Good',
      system_discharge: 10,
    };

    expect(getSecondaryDetail('irrigation', irrigation)).toBe('2 acres • Good');
  });

  it('hides acreage while preserving irrigation moisture status', () => {
    const irrigation: IrrigationRecord = {
      farm_id: 1,
      date: '2026-03-15',
      duration: 2,
      area: 2,
      growth_stage: 'fruiting',
      moisture_status: 'Good',
      system_discharge: 10,
    };

    expect(getSecondaryDetail('irrigation', irrigation, { showArea: false })).toBe('Good');
  });

  it('hides spray acreage while preserving weather details', () => {
    const spray: SprayRecord = {
      farm_id: 1,
      date: '2026-03-15',
      chemical: 'Copper',
      dose: '1 kg',
      area: 2,
      weather: 'Calm',
      operator: 'Farmer',
    };

    expect(getSecondaryDetail('spray', spray, { showArea: false })).toBe('Calm');
  });

  it('renders acreage for fertigation activity cards', () => {
    const fertigation: FertigationRecord = {
      farm_id: 1,
      date: '2026-03-15',
      area: 2,
    };

    expect(getSecondaryDetail('fertigation', fertigation)).toBe('2 acres');
  });

  it('preserves harvest buyer and expense remarks', () => {
    const harvest: HarvestRecord = {
      farm_id: 1,
      date: '2026-03-15',
      quantity: 100,
      grade: 'A',
      buyer: 'Fresh Foods',
    };
    const expense: ExpenseRecord = {
      farm_id: 1,
      date: '2026-03-15',
      type: 'fuel',
      cost: 500,
      remarks: 'Tractor fuel',
    };

    expect(getSecondaryDetail('harvest', harvest, { showArea: false })).toBe('Fresh Foods');
    expect(getSecondaryDetail('expense', expense, { showArea: false })).toBe('Tractor fuel');
  });

  it('keeps acreage for delegated professional activity', () => {
    const spray: SprayRecord = {
      farm_id: 1,
      date: '2026-03-15',
      chemical: 'Copper',
      dose: '1 kg',
      area: 2,
      weather: 'Calm',
      operator: 'Farmer',
      professional_creator_id: 'professional-1',
    };

    expect(getSecondaryDetail('spray', spray, { showArea: false })).toBe('2 acres • Calm');
  });
});
