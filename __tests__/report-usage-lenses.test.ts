/**
 * Golden vectors from plan §5, encoded THROUGH the report pipeline
 * (ReportService.generateReportData → usage lenses), plus the lens hard
 * rules from issue #198: measures never merge, per-acre hides without a real
 * area, per-liter is water-volume-weighted, concentration-only / rate-only /
 * Other buckets stay visible, and the compliance delta separates verified
 * (plan_item_id-stamped) from approximate (name-matched) — never conflated.
 *
 * Display note: §5 renders single-source figures like "10 kg" and per-acre
 * rates like "250 ml" without the ≈ prefix. The report pipeline folds and
 * divides every figure (they are all derived aggregates, not values the
 * farmer typed), so per the kernel's format() contract every lens display
 * here carries "≈ " — a deliberate, flagged deviation from the §5 rendering.
 */

import { ReportService } from '@/services/report-service';
import type { DateRange, ReportPlanItemInput } from '@/types/report';
import type { Farm, FertigationRecord, SprayRecord } from '@/types/database';

jest.mock('expo-print', () => ({
  printToFileAsync: jest.fn(),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn(),
}));

jest.mock(
  'expo-file-system/legacy',
  () => ({
    cacheDirectory: '/tmp/',
    documentDirectory: '/tmp/',
    writeAsStringAsync: jest.fn(),
    copyAsync: jest.fn(),
    getInfoAsync: jest.fn().mockResolvedValue({ exists: true, isDirectory: true }),
    makeDirectoryAsync: jest.fn(),
  }),
  { virtual: true },
);

const DATE_RANGE: DateRange = { from: '2026-01-01', to: '2026-12-31' };

function farmWithArea(area: number): Farm {
  return {
    id: 1,
    name: 'Vector Farm',
    area,
    region: 'Nashik',
    crop: 'Grape',
    crop_variety: 'Thompson',
    planting_date: '2020-01-01',
  };
}

function spray(
  items: NonNullable<SprayRecord['chemical_items']>,
  waterLiters: number | null,
  overrides: Partial<SprayRecord> = {},
): SprayRecord {
  return {
    id: 1,
    farm_id: 1,
    date: '2026-02-01',
    chemical: '',
    chemical_items: items,
    dose: waterLiters != null ? `Water: ${waterLiters}L` : '',
    area: 0,
    weather: '',
    operator: '',
    ...overrides,
  };
}

function fertigation(
  fertilizers: NonNullable<FertigationRecord['fertilizers']>,
  overrides: Partial<FertigationRecord> = {},
): FertigationRecord {
  return {
    id: 1,
    farm_id: 1,
    date: '2026-03-01',
    area: 0,
    fertilizers,
    ...overrides,
  };
}

function usageFor(params: {
  farm: Farm;
  sprays?: SprayRecord[];
  fertigations?: FertigationRecord[];
  planItems?: ReportPlanItemInput[];
  areaUnit?: 'acres' | 'hectares';
}) {
  const usage = ReportService.generateReportData(
    params.farm,
    [],
    params.sprays ?? [],
    params.fertigations ?? [],
    [],
    [],
    DATE_RANGE,
    [],
    { planItems: params.planItems, areaUnit: params.areaUnit },
  ).usage;
  expect(usage).toBeDefined();
  return usage!;
}

describe('§5 vector: 250 ml/acre liquid on a 3.5 acre plot', () => {
  const usage = () =>
    usageFor({
      farm: farmWithArea(3.5),
      fertigations: [fertigation([{ name: 'Liquid', quantity: 250, unit: 'ml/acre' }])],
    });

  it('per plot: exactly 0.875 L, rendered ≈ 875 ml', () => {
    const row = usage().perPlot.rows[0];
    expect(row.totals).toEqual([{ measure: 'volume', value: 0.875, display: '≈ 875 ml' }]);
  });

  it('per acre: the rate itself, 0.25 L/acre, rendered ≈ 250 ml/acre', () => {
    const row = usage().perAcre.rows[0];
    expect(row.perAcre).toEqual([{ measure: 'volume', value: 0.25, display: '≈ 250 ml/acre' }]);
  });

  it('per liter: not applicable — no spray event, nothing guessed', () => {
    expect(usage().perLiter.rows).toEqual([]);
  });
});

describe('§5 vector: 30 g/L fungicide in 400 L water on a 3.5 acre farm', () => {
  const usage = () =>
    usageFor({
      farm: farmWithArea(3.5),
      sprays: [spray([{ name: 'Fungicide', quantity: 30, unit: 'gm/L' }], 400)],
    });

  it('per plot: exactly 12 kg, rendered ≈ 12 kg', () => {
    const row = usage().perPlot.rows[0];
    expect(row.totals).toEqual([{ measure: 'mass', value: 12, display: '≈ 12 kg' }]);
  });

  it('per acre: 12 ÷ 3.5 kg, rendered ≈ 3.43 kg/acre', () => {
    const figure = usage().perAcre.rows[0].perAcre[0];
    expect(figure.value).toBeCloseTo(3.4285714285714284, 12);
    expect(figure.display).toBe('≈ 3.43 kg/acre');
  });

  it('per liter: the entered concentration, ≈ 30 g/L', () => {
    const row = usage().perLiter.rows[0];
    expect(row.concentration).toBeCloseTo(0.03, 12);
    expect(row.display).toBe('≈ 30 g/L');
  });
});

describe('§5 vector: 100 ppm GA3 in 400 L water on a 3.5 acre farm', () => {
  const usage = () =>
    usageFor({
      farm: farmWithArea(3.5),
      sprays: [spray([{ name: 'GA3', quantity: 100, unit: 'ppm' }], 400)],
    });

  it('per plot: 0.04 kg, rendered ≈ 40 g', () => {
    const figure = usage().perPlot.rows[0].totals[0];
    expect(figure.measure).toBe('mass');
    expect(figure.value).toBeCloseTo(0.04, 12);
    expect(figure.display).toBe('≈ 40 g');
  });

  it('per acre: rendered ≈ 11.4 g/acre', () => {
    expect(usage().perAcre.rows[0].perAcre[0].display).toBe('≈ 11.4 g/acre');
  });

  it('per liter: ppm folds natively as mg/L — ≈ 100 mg/L', () => {
    const row = usage().perLiter.rows[0];
    expect(row.concentration).toBeCloseTo(0.0001, 15);
    expect(row.display).toBe('≈ 100 mg/L');
  });

  it('without water the item lands in the concentration-only bucket, never guessed', () => {
    const lens = usageFor({
      farm: farmWithArea(3.5),
      sprays: [spray([{ name: 'GA3', quantity: 100, unit: 'ppm' }], null)],
    });
    expect(lens.perPlot.rows).toEqual([]);
    expect(lens.perPlot.concentrationOnly).toEqual([
      {
        key: 'spray::ga3::ppm::100',
        name: 'GA3',
        type: 'spray',
        unit: 'ppm',
        quantity: 100,
        usageCount: 1,
      },
    ]);
    expect(lens.perLiter.rows).toEqual([]);
    expect(lens.perLiter.sprayEventsWithWater).toBe(0);
    expect(lens.perLiter.sprayEventsTotal).toBe(1);
  });
});

describe("§5 vector: legacy row 500 'g/acre' on a 1.5 acre plot", () => {
  const usage = () =>
    usageFor({
      farm: farmWithArea(1.5),
      fertigations: [fertigation([{ name: 'Legacy', quantity: 500, unit: 'g/acre' }])],
    });

  it('per plot: exactly 0.75 kg, rendered ≈ 750 g', () => {
    expect(usage().perPlot.rows[0].totals).toEqual([
      { measure: 'mass', value: 0.75, display: '≈ 750 g' },
    ]);
  });

  it('per acre: the rate itself, 0.5 kg/acre, rendered ≈ 500 g/acre', () => {
    expect(usage().perAcre.rows[0].perAcre).toEqual([
      { measure: 'mass', value: 0.5, display: '≈ 500 g/acre' },
    ]);
  });
});

describe('§5 vector: 500 mL/ha (annexure spelling) on a 3.5 acre plot', () => {
  const usage = () =>
    usageFor({
      farm: farmWithArea(3.5),
      fertigations: [fertigation([{ name: 'Label Claim', quantity: 500, unit: 'mL/ha' }])],
    });

  it('per plot: ≈ 708 ml (÷2.47105 × 3.5)', () => {
    const figure = usage().perPlot.rows[0].totals[0];
    expect(figure.value).toBeCloseTo(0.7082009672001781, 12);
    expect(figure.display).toBe('≈ 708 ml');
  });

  it('per acre: ≈ 202 ml/acre (÷2.47105)', () => {
    const figure = usage().perAcre.rows[0].perAcre[0];
    expect(figure.value * 1000).toBeCloseTo(202.34313348576518, 9);
    expect(figure.display).toBe('≈ 202 ml/acre');
  });
});

describe('§5 vector: 10 kg (total, tank) with 400 L water on a 3.5 acre farm', () => {
  const usage = () =>
    usageFor({
      farm: farmWithArea(3.5),
      sprays: [spray([{ name: 'Tank Product', quantity: 10, unit: 'kg' }], 400)],
    });

  it('per plot: exactly 10 kg (≈-prefixed: report figures are folded aggregates)', () => {
    expect(usage().perPlot.rows[0].totals).toEqual([
      { measure: 'mass', value: 10, display: '≈ 10 kg' },
    ]);
  });

  it('per acre: ÷ area — ≈ 2.86 kg/acre', () => {
    const figure = usage().perAcre.rows[0].perAcre[0];
    expect(figure.value).toBeCloseTo(2.857142857142857, 12);
    expect(figure.display).toBe('≈ 2.86 kg/acre');
  });

  it('per liter: ÷ water since it was logged — exactly 0.025 kg/L, ≈ 25 g/L', () => {
    const row = usage().perLiter.rows[0];
    expect(row.concentration).toBe(0.025);
    expect(row.display).toBe('≈ 25 g/L');
  });
});

describe('lens hard rules', () => {
  it('mass and volume never merge: one product logged in kg and L shows two figures', () => {
    const lens = usageFor({
      farm: farmWithArea(2),
      fertigations: [
        fertigation([
          { name: 'Duo', quantity: 3, unit: 'kg' },
          { name: 'Duo', quantity: 2, unit: 'liter' },
        ]),
      ],
    });
    expect(lens.perPlot.rows).toHaveLength(1);
    expect(lens.perPlot.rows[0].totals).toEqual([
      { measure: 'mass', value: 3, display: '≈ 3 kg' },
      { measure: 'volume', value: 2, display: '≈ 2 L' },
    ]);
  });

  it('count keeps its own bucket and never converts', () => {
    const lens = usageFor({
      farm: farmWithArea(2),
      fertigations: [fertigation([{ name: 'Neem Cake', quantity: 3, unit: 'bags' }])],
    });
    expect(lens.perPlot.rows[0].totals).toEqual([{ measure: 'count', value: 3, display: '≈ 3' }]);
  });

  it('unrecognized units go to the Other bucket verbatim — no conversion, no ≈', () => {
    const lens = usageFor({
      farm: farmWithArea(2),
      fertigations: [
        fertigation([{ name: 'Jeevamrut', quantity: 5, unit: 'tola', unit_unrecognized: true }]),
      ],
    });
    expect(lens.perPlot.rows).toEqual([]);
    expect(lens.perPlot.other).toEqual([
      {
        key: 'fertilizer::jeevamrut::tola::5',
        name: 'Jeevamrut',
        type: 'fertilizer',
        unit: 'tola',
        quantity: 5,
        usageCount: 1,
      },
    ]);
  });

  it('per-acre lens is hidden (never guessed) when farm area is missing/zero', () => {
    const lens = usageFor({
      farm: farmWithArea(0),
      fertigations: [
        fertigation([
          { name: 'Urea', quantity: 5, unit: 'kg/acre' },
          { name: 'DAP', quantity: 10, unit: 'kg' },
        ]),
      ],
    });
    expect(lens.perAcre.available).toBe(false);
    expect(lens.perAcre.areaAcres).toBeNull();
    expect(lens.perAcre.rows).toEqual([]);
    expect(lens.perAcre.compliance).toEqual([]);
    // The total-basis item still folds per plot; the per-acre rate lands in
    // the visible rate-only bucket instead of being multiplied by a guess.
    expect(lens.perPlot.rows.map((row) => row.name)).toEqual(['DAP']);
    expect(lens.perPlot.rateOnly).toEqual([
      {
        key: 'fertilizer::urea::kg/acre::5',
        name: 'Urea',
        type: 'fertilizer',
        unit: 'kg/acre',
        quantity: 5,
        usageCount: 1,
      },
    ]);
  });

  it('quantity_basis column applies to basis-neutral units (bare kg + per_acre)', () => {
    const lens = usageFor({
      farm: farmWithArea(2),
      fertigations: [
        fertigation([{ name: 'SOP', quantity: 20, unit: 'kg', quantity_basis: 'per_acre' }]),
      ],
    });
    expect(lens.perPlot.rows[0].totals).toEqual([
      { measure: 'mass', value: 40, display: '≈ 40 kg' },
    ]);
  });

  it('unit-string basis wins over the stored basis column (gm/L + per_acre)', () => {
    const lens = usageFor({
      farm: farmWithArea(2),
      fertigations: [
        fertigation(
          [{ name: 'Mix', quantity: 10, unit: 'gm/L', quantity_basis: 'per_acre' }],
          { water_volume: 200 },
        ),
      ],
    });
    // 10 g/L × 200 L = 2 kg — never additionally multiplied by area.
    expect(lens.perPlot.rows[0].totals).toEqual([
      { measure: 'mass', value: 2, display: '≈ 2 kg' },
    ]);
  });

  it('per liter is weighted by water volume, never a plain average of event concentrations', () => {
    const lens = usageFor({
      farm: farmWithArea(2),
      sprays: [
        // Event A: 30 g/L in 400 L → 12 kg. Event B: 10 kg total in 100 L
        // (100 g/L). Plain average would be 65 g/L; weighted is
        // (12 + 10) kg ÷ (400 + 100) L = 44 g/L.
        spray([{ name: 'Fungicide', quantity: 30, unit: 'gm/L' }], 400, { id: 1 }),
        spray([{ name: 'Fungicide', quantity: 10, unit: 'kg' }], 100, {
          id: 2,
          date: '2026-02-05',
        }),
      ],
    });
    const row = lens.perLiter.rows[0];
    expect(row.concentration).toBeCloseTo(0.044, 12);
    expect(row.display).toBe('≈ 44 g/L');
    expect(row.eventCount).toBe(2);
    expect(lens.perLiter.sprayEventsWithWater).toBe(2);
  });
});

describe('compliance delta (prescribed vs applied, per acre)', () => {
  const PLAN_ITEMS: ReportPlanItemInput[] = [
    { id: 'pi-urea', name: 'Urea', quantity: 5, unit: 'kg/acre' },
  ];

  it('plan_item_id-stamped records produce a verified delta', () => {
    const lens = usageFor({
      farm: farmWithArea(2),
      planItems: PLAN_ITEMS,
      fertigations: [
        fertigation([{ name: 'Urea', quantity: 8.4, unit: 'kg', plan_item_id: 'pi-urea' }]),
      ],
    });
    expect(lens.perAcre.compliance).toEqual([
      {
        planItemId: 'pi-urea',
        name: 'Urea',
        measure: 'mass',
        prescribedPerAcre: 5,
        prescribedDisplay: '≈ 5 kg/acre',
        appliedPerAcre: 4.2,
        appliedDisplay: '≈ 4.2 kg/acre',
        matchLevel: 'verified',
      },
    ]);
  });

  it('name-only matches are approximate — never presented as verified', () => {
    const lens = usageFor({
      farm: farmWithArea(2),
      planItems: PLAN_ITEMS,
      fertigations: [fertigation([{ name: '  urea ', quantity: 8.4, unit: 'kg' }])],
    });
    expect(lens.perAcre.compliance[0]).toMatchObject({
      appliedPerAcre: 4.2,
      matchLevel: 'approximate',
    });
  });

  it('mixed stamped + name-matched contributions stay approximate', () => {
    const lens = usageFor({
      farm: farmWithArea(2),
      planItems: PLAN_ITEMS,
      fertigations: [
        fertigation([{ name: 'Urea', quantity: 4, unit: 'kg', plan_item_id: 'pi-urea' }], {
          id: 1,
        }),
        fertigation([{ name: 'Urea', quantity: 4.4, unit: 'kg' }], { id: 2, date: '2026-03-05' }),
      ],
    });
    expect(lens.perAcre.compliance[0]).toMatchObject({
      appliedPerAcre: 4.2,
      matchLevel: 'approximate',
    });
  });

  it('a plan item with nothing applied reports null applied and no match level', () => {
    const lens = usageFor({
      farm: farmWithArea(2),
      planItems: PLAN_ITEMS,
      fertigations: [fertigation([{ name: 'DAP', quantity: 3, unit: 'kg' }])],
    });
    expect(lens.perAcre.compliance[0]).toMatchObject({
      appliedPerAcre: null,
      appliedDisplay: null,
      matchLevel: null,
    });
  });

  it('measure mismatches never join: a plan in kg does not absorb liters applied', () => {
    const lens = usageFor({
      farm: farmWithArea(2),
      planItems: PLAN_ITEMS,
      fertigations: [fertigation([{ name: 'Urea', quantity: 8.4, unit: 'liter' }])],
    });
    // The join still refuses (applied stays null) — but the liters ARE
    // logged evidence, so the row reads 'unresolved', never 'not logged'.
    expect(lens.perAcre.compliance[0]).toMatchObject({
      appliedPerAcre: null,
      matchLevel: 'unresolved',
    });
  });

  it('total-basis prescriptions divide by the plan area snapshot, not the current farm area', () => {
    // Plan says "10 kg" written for a 2-acre farm (snapshot stamped by the
    // DB trigger); the farmer applied exactly 10 kg over those 2 acres, then
    // the farm was edited to 3.5 acres. Prescribed must stay 5 kg/acre —
    // reading it against 3.5 (≈ 2.86) would call an exactly-followed plan an
    // over-application, since applied rates stay pinned to record areas.
    const usage = usageFor({
      farm: farmWithArea(3.5),
      planItems: [{ id: 'pi-dap', name: 'DAP', quantity: 10, unit: 'kg', areaAcres: 2 }],
      fertigations: [
        fertigation([{ name: 'DAP', quantity: 10, unit: 'kg', plan_item_id: 'pi-dap' }], {
          area: 2,
        }),
      ],
    });
    expect(usage.perAcre.compliance[0]).toMatchObject({
      prescribedPerAcre: 5,
      appliedPerAcre: 5,
      matchLevel: 'verified',
    });
  });

  it('total-basis plan items divide by area; concentration prescriptions are excluded', () => {
    const lens = usageFor({
      farm: farmWithArea(2),
      planItems: [
        { id: 'pi-total', name: 'DAP', quantity: 10, unit: 'kg' },
        { id: 'pi-ppm', name: 'GA3', quantity: 100, unit: 'ppm' },
      ],
      fertigations: [fertigation([{ name: 'DAP', quantity: 9, unit: 'kg' }])],
    });
    expect(lens.perAcre.compliance).toHaveLength(1);
    expect(lens.perAcre.compliance[0]).toMatchObject({
      planItemId: 'pi-total',
      prescribedPerAcre: 5,
      prescribedDisplay: '≈ 5 kg/acre',
      appliedPerAcre: 4.5,
      matchLevel: 'approximate',
    });
  });
});

describe('area provenance: hectares-preference farms convert before per-acre math', () => {
  // farm.area holds the raw number the user typed under their preference
  // (entry-log-submission.ts treats it the same way). 2 "areas" on a
  // hectares farm = 2 ha = 4.94211... acres, NOT 2 acres — without the
  // conversion every per-acre rate reads 2.47× too high.
  const HECTARES_TO_ACRES = 1 / 0.404686;

  it('divides by area × 2.47105 when areaUnit is hectares', () => {
    const usage = usageFor({
      farm: farmWithArea(2),
      areaUnit: 'hectares',
      fertigations: [fertigation([{ name: 'Urea', quantity: 10, unit: 'kg' }])],
    });
    expect(usage.perAcre.available).toBe(true);
    expect(usage.perAcre.areaAcres).toBeCloseTo(2 * HECTARES_TO_ACRES, 10);
    expect(usage.perAcre.rows[0].perAcre[0].value).toBeCloseTo(10 / (2 * HECTARES_TO_ACRES), 10);
  });

  it('acres preference (and unset) keeps the raw area — no behavior change', () => {
    const asAcres = usageFor({
      farm: farmWithArea(2),
      areaUnit: 'acres',
      fertigations: [fertigation([{ name: 'Urea', quantity: 10, unit: 'kg' }])],
    });
    const unset = usageFor({
      farm: farmWithArea(2),
      fertigations: [fertigation([{ name: 'Urea', quantity: 10, unit: 'kg' }])],
    });
    expect(asAcres.perAcre.areaAcres).toBe(2);
    expect(unset.perAcre.areaAcres).toBe(2);
    expect(asAcres.perAcre.rows[0].perAcre[0].value).toBe(5);
  });

  it('compliance delta prescribed-vs-applied also uses converted acres', () => {
    const usage = usageFor({
      farm: farmWithArea(2),
      areaUnit: 'hectares',
      planItems: [{ id: 'plan-7', name: 'Urea', quantity: 2, unit: 'kg/acre' }],
      fertigations: [
        fertigation([{ name: 'Urea', quantity: 10, unit: 'kg', plan_item_id: 'plan-7' }]),
      ],
    });
    const row = usage.perAcre.compliance[0];
    expect(row.prescribedPerAcre).toBe(2);
    expect(row.appliedPerAcre).toBeCloseTo(10 / (2 * HECTARES_TO_ACRES), 10);
  });
});

describe('compliance: records stamped from a superseded plan degrade to approximate', () => {
  // Consultants replace plans mid-season. A record carrying an old plan's
  // item id must NOT vanish into a verified map nothing joins against —
  // that would render the same-named current item as "not logged" and
  // accuse the farmer of skipping applications they made.
  it('routes a stale plan_item_id through name matching', () => {
    const usage = usageFor({
      farm: farmWithArea(2),
      planItems: [{ id: 'new-plan-item', name: 'Urea', quantity: 2, unit: 'kg/acre' }],
      fertigations: [
        fertigation([{ name: 'Urea', quantity: 10, unit: 'kg', plan_item_id: 'old-plan-item' }]),
      ],
    });
    const row = usage.perAcre.compliance[0];
    expect(row.appliedPerAcre).toBeCloseTo(5, 12);
    expect(row.matchLevel).toBe('approximate');
  });
});

describe('compliance: adversarial-review regressions', () => {
  it('a name match counts ONCE against same-named plan items, prescriptions summed', () => {
    // Plans repeat a product across application dates by design. One
    // unstamped 10 kg log must not appear as 10 kg applied on EACH row.
    const usage = usageFor({
      farm: farmWithArea(2),
      planItems: [
        { id: 'p1', name: 'Urea', quantity: 2, unit: 'kg/acre' },
        { id: 'p2', name: 'Urea', quantity: 3, unit: 'kg/acre' },
      ],
      fertigations: [fertigation([{ name: 'Urea', quantity: 10, unit: 'kg' }])],
    });
    expect(usage.perAcre.compliance).toHaveLength(1);
    const row = usage.perAcre.compliance[0];
    expect(row.prescribedPerAcre).toBe(5);
    expect(row.appliedPerAcre).toBeCloseTo(5, 12);
    expect(row.matchLevel).toBe('approximate');
  });

  it('spray chemicals never name-match into fertilizer-plan compliance', () => {
    const usage = usageFor({
      farm: farmWithArea(2),
      planItems: [{ id: 'p1', name: 'Sulphur', quantity: 2, unit: 'kg/acre' }],
      sprays: [spray([{ name: 'Sulphur', quantity: 4, unit: 'kg' }], 200)],
    });
    const row = usage.perAcre.compliance[0];
    expect(row.appliedPerAcre).toBeNull();
    expect(row.matchLevel).toBeNull();
  });

  it('compliance applied rate divides by the record snapshot area, not the current farm area', () => {
    // 250 ml/acre logged over 2 acres, farm since resized to 3.5 acres. The
    // applied rate must still read 250 ml/acre (0.25 L/acre) — dividing the
    // 0.5 L plot total by 3.5 would fabricate ≈143 ml/acre and contradict
    // the logged rate.
    const usage = usageFor({
      farm: farmWithArea(3.5),
      planItems: [{ id: 'pi-liquid', name: 'Liquid', quantity: 250, unit: 'ml/acre' }],
      fertigations: [
        fertigation([{ name: 'Liquid', quantity: 250, unit: 'ml/acre', plan_item_id: 'pi-liquid' }], {
          area: 2,
        }),
      ],
    });
    const row = usage.perAcre.compliance[0];
    expect(row.prescribedPerAcre).toBeCloseTo(0.25, 12);
    expect(row.appliedPerAcre).toBeCloseTo(0.25, 12);
    expect(row.matchLevel).toBe('verified');
  });

  it('each application contributes its own per-acre rate, summed like prescriptions', () => {
    // Application 1: 12 kg over 2 acres = 6 kg/acre. Application 2: 21 kg over
    // 3 acres = 7 kg/acre. The cumulative applied rate is 6 + 7 = 13 kg/acre —
    // computed from each record's own area, never the farm's current 4 acres.
    const usage = usageFor({
      farm: farmWithArea(4),
      planItems: [{ id: 'pi-urea', name: 'Urea', quantity: 5, unit: 'kg/acre' }],
      fertigations: [
        fertigation([{ name: 'Urea', quantity: 12, unit: 'kg', plan_item_id: 'pi-urea' }], {
          id: 1,
          area: 2,
        }),
        fertigation([{ name: 'Urea', quantity: 21, unit: 'kg' }], {
          id: 2,
          date: '2026-03-05',
          area: 3,
        }),
      ],
    });
    const row = usage.perAcre.compliance[0];
    expect(row.appliedPerAcre).toBeCloseTo(13, 12);
    expect(row.matchLevel).toBe('approximate');
  });

  it('per-acre rates resolve against the RECORD area snapshot, not the current farm area', () => {
    // Logged over 2 acres, farm later edited to 3.5 — the plot total must
    // still describe what was applied (250 ml/acre × 2 acres = 0.5 L), and the
    // per-acre row must read the logged 250 ml/acre, not 0.5 L ÷ 3.5 ≈ 143.
    const usage = usageFor({
      farm: farmWithArea(3.5),
      fertigations: [
        fertigation([{ name: 'Liquid', quantity: 250, unit: 'ml/acre' }], { area: 2 }),
      ],
    });
    expect(usage.perPlot.rows[0].totals).toEqual([
      { measure: 'volume', value: 0.5, display: '≈ 500 ml' },
    ]);
    expect(usage.perAcre.rows[0].perAcre).toEqual([
      { measure: 'volume', value: 0.25, display: '≈ 250 ml/acre' },
    ]);
  });

  it('per-acre rows sum each application rate over its own area', () => {
    // 12 kg over 2 acres (6 kg/acre) + 21 kg over 3 acres (7 kg/acre) reads a
    // cumulative 13 kg/acre — independent of the farm's current 4-acre size.
    const usage = usageFor({
      farm: farmWithArea(4),
      fertigations: [
        fertigation([{ name: 'Urea', quantity: 12, unit: 'kg' }], { id: 1, area: 2 }),
        fertigation([{ name: 'Urea', quantity: 21, unit: 'kg' }], {
          id: 2,
          date: '2026-03-05',
          area: 3,
        }),
      ],
    });
    expect(usage.perAcre.rows[0].perAcre[0].value).toBeCloseTo(13, 12);
  });
});
