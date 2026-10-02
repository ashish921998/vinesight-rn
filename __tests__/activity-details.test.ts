import { getDelegatedAttribution, getSecondaryDetail } from '@/utils/activity-details';
import { getDescriptionFromData } from '@/utils/log-description';
import type {
  ExpenseRecord,
  FertigationRecord,
  HarvestRecord,
  IrrigationRecord,
  SprayRecord,
} from '@/types';

const translations: Record<string, string> = {
  'farmDetails.header.areaAcres': '{{value}} acres',
  'professional.attribution': '{{member}} · {{organization}}',
  'professional.organizationMember': 'Organization member',
  'professional.organization': 'Organization',
};

const t = (key: string, options?: Record<string, unknown>) => {
  const value = translations[key] ?? key;
  return value
    .replace('{{value}}', String(options?.value ?? ''))
    .replace('{{member}}', String(options?.member ?? ''))
    .replace('{{organization}}', String(options?.organization ?? ''));
};

describe('activity details', () => {
  it('formats delegated professional attribution', () => {
    const spray: SprayRecord = {
      farm_id: 1,
      date: '2026-03-15',
      chemical: 'Copper',
      dose: '1 kg',
      area: 2,
      weather: 'Calm',
      operator: 'Farmer',
      professional_creator_id: 'professional-1',
      professional_creator_name: 'Asha',
      acting_organization_name: 'Vine Co.',
    };

    expect(getDelegatedAttribution(t, spray)).toBe('Asha · Vine Co.');
  });

  it('uses attribution fallbacks when delegated names are unavailable', () => {
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

    expect(getDelegatedAttribution(t, spray)).toBe('Organization member · Organization');
  });

  it('renders localized acreage and irrigation moisture status', () => {
    const irrigation: IrrigationRecord = {
      farm_id: 1,
      date: '2026-03-15',
      duration: 2,
      area: 2,
      growth_stage: 'fruiting',
      moisture_status: 'Good',
      system_discharge: 10,
    };
    const hindi = (key: string, options?: Record<string, unknown>) =>
      key === 'farmDetails.header.areaAcres' ? `${String(options?.value)} एकड़` : key;

    expect(getSecondaryDetail({ type: 'irrigation', data: irrigation }, hindi)).toBe(
      '2 एकड़ • Good',
    );
  });

  it('hides acreage while preserving irrigation and spray details', () => {
    const irrigation: IrrigationRecord = {
      farm_id: 1,
      date: '2026-03-15',
      duration: 2,
      area: 2,
      growth_stage: 'fruiting',
      moisture_status: 'Good',
      system_discharge: 10,
    };
    const spray: SprayRecord = {
      farm_id: 1,
      date: '2026-03-15',
      chemical: 'Copper',
      dose: '1 kg',
      area: 2,
      weather: 'Calm',
      operator: 'Farmer',
    };

    expect(
      getSecondaryDetail({ type: 'irrigation', data: irrigation }, t, { showArea: false }),
    ).toBe('Good');
    expect(getSecondaryDetail({ type: 'spray', data: spray }, t, { showArea: false })).toBe('Calm');
  });

  it('renders acreage for fertigation activity cards', () => {
    const fertigation: FertigationRecord = {
      farm_id: 1,
      date: '2026-03-15',
      area: 2,
    };

    expect(getSecondaryDetail({ type: 'fertigation', data: fertigation }, t)).toBe('2 acres');
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

    expect(getSecondaryDetail({ type: 'harvest', data: harvest }, t, { showArea: false })).toBe(
      'Fresh Foods',
    );
    expect(getSecondaryDetail({ type: 'expense', data: expense }, t, { showArea: false })).toBe(
      'Tractor fuel',
    );
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

    expect(getSecondaryDetail({ type: 'spray', data: spray }, t, { showArea: false })).toBe(
      '2 acres • Calm',
    );
  });

  it('trims user-entered descriptions and uses fallbacks for whitespace-only values', () => {
    const describe = (key: string) =>
      ({
        'logs.sprayApplication': 'Spray application',
        'logs.types.note': 'Note',
      })[key] ?? key;

    expect(
      getDescriptionFromData({ type: 'spray', data: { chemical: '  Copper  ' } }, describe),
    ).toBe('Copper');
    expect(getDescriptionFromData({ type: 'spray', data: { chemical: '   ' } }, describe)).toBe(
      'Spray application',
    );
    expect(getDescriptionFromData({ type: 'note', data: { notes: '   ' } }, describe)).toBe('Note');
  });

  it('trims secondary details and ignores whitespace-only values', () => {
    expect(
      getSecondaryDetail(
        { type: 'harvest', data: { buyer: '   ', notes: '  Packed at dawn  ' } },
        t,
      ),
    ).toBe('Packed at dawn');
    expect(
      getSecondaryDetail({ type: 'irrigation', data: { moisture_status: '   ' } }, t, {
        showArea: false,
      }),
    ).toBeNull();
  });
});
