/**
 * Edge coverage for computeUsageLenses (issue #198) beyond the §5 golden
 * vectors: invalid item filtering, verbatim-bucket aggregation across events,
 * water counted once per event in the per-liter lens, and compliance rows
 * skipping plan items the kernel cannot parse.
 */

import { computeUsageLenses, type UsageEvent } from '@/services/report-usage-lenses';
import type { ReportPlanItemInput } from '@/types/report';

function sprayEvent(items: UsageEvent['items'], waterLiters: number | null): UsageEvent {
  return { type: 'spray', waterLiters, items };
}

function fertEvent(items: UsageEvent['items']): UsageEvent {
  return { type: 'fertilizer', waterLiters: null, items };
}

describe('invalid items are dropped before any bucket', () => {
  it('skips blank names and non-positive/non-finite quantities entirely', () => {
    const lenses = computeUsageLenses({
      events: [
        fertEvent([
          { name: '   ', quantity: 5, unit: 'kg' },
          { name: 'Zero', quantity: 0, unit: 'kg' },
          { name: 'Negative', quantity: -3, unit: 'kg' },
          { name: 'NaN', quantity: Number.NaN, unit: 'kg' },
          { name: 'Ghost', quantity: Number.POSITIVE_INFINITY, unit: 'tola' },
        ]),
      ],
      areaAcres: 2,
    });
    expect(lenses.perPlot.rows).toEqual([]);
    expect(lenses.perPlot.other).toEqual([]);
    expect(lenses.perPlot.concentrationOnly).toEqual([]);
    expect(lenses.perPlot.rateOnly).toEqual([]);
    expect(lenses.perAcre.rows).toEqual([]);
    expect(lenses.perLiter.rows).toEqual([]);
  });
});

describe('verbatim buckets aggregate across events', () => {
  it('verbatim buckets never sum: distinct logged values stay separate rows', () => {
    // "As logged" means exactly what was typed — and the value may be
    // intensive (a rate or concentration), where 5 + 3 is meaningless.
    const lenses = computeUsageLenses({
      events: [
        fertEvent([{ name: 'Jeevamrut', quantity: 5, unit: 'tola' }]),
        fertEvent([{ name: '  jeevamrut ', quantity: 3, unit: 'Tola' }]),
      ],
      areaAcres: 2,
    });
    expect(lenses.perPlot.other).toEqual([
      {
        key: 'fertilizer::jeevamrut::tola::3',
        name: 'jeevamrut',
        type: 'fertilizer',
        unit: 'Tola',
        quantity: 3,
        usageCount: 1,
      },
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

  it('verbatim buckets: the same logged value repeated counts uses, never doubles', () => {
    const lenses = computeUsageLenses({
      events: [
        sprayEvent([{ name: 'GA3', quantity: 30, unit: 'gm/L' }], null),
        sprayEvent([{ name: 'GA3', quantity: 30, unit: 'gm/L' }], null),
        sprayEvent([{ name: 'GA3', quantity: 40, unit: 'gm/L' }], null),
      ],
      areaAcres: 2,
    });
    // 30 gm/L twice + 40 gm/L once must NEVER render "70 gm/L" or "100 gm/L".
    expect(lenses.perPlot.concentrationOnly).toEqual([
      expect.objectContaining({ quantity: 30, unit: 'gm/L', usageCount: 2 }),
      expect.objectContaining({ quantity: 40, unit: 'gm/L', usageCount: 1 }),
    ]);
  });

  it('same name but a different verbatim unit stays a separate row — never merged', () => {
    const lenses = computeUsageLenses({
      events: [
        fertEvent([
          { name: 'Jeevamrut', quantity: 5, unit: 'tola' },
          { name: 'Jeevamrut', quantity: 2, unit: 'handful' },
        ]),
      ],
      areaAcres: 2,
    });
    expect(lenses.perPlot.other.map((row) => [row.unit, row.quantity])).toEqual([
      ['handful', 2],
      ['tola', 5],
    ]);
  });
});

describe('per-liter water is counted once per event per product', () => {
  it('a product logged twice in one tank does not double the water denominator', () => {
    // Two line items of the same product in a single 400 L event:
    // 10 g/L → 4 kg each, so 8 kg in 400 L = 20 g/L. Double-counting the
    // water would incorrectly halve it to 10 g/L.
    const lenses = computeUsageLenses({
      events: [
        sprayEvent(
          [
            { name: 'Fungicide', quantity: 10, unit: 'gm/L' },
            { name: 'Fungicide', quantity: 10, unit: 'gm/L' },
          ],
          400,
        ),
      ],
      areaAcres: 2,
    });
    const row = lenses.perLiter.rows[0];
    expect(row.concentration).toBeCloseTo(0.02, 12);
    expect(row.display).toBe('≈ 20 g/L');
    expect(row.eventCount).toBe(1);
  });

  it('count-measure items never enter the per-liter lens', () => {
    const lenses = computeUsageLenses({
      events: [sprayEvent([{ name: 'Tablets', quantity: 4, unit: 'bags' }], 400)],
      areaAcres: 2,
    });
    expect(lenses.perLiter.rows).toEqual([]);
    expect(lenses.perLiter.sprayEventsWithWater).toBe(1);
  });
});

describe('compliance skips plan items the kernel cannot price per acre', () => {
  it('drops rows with missing quantity, missing unit, or an unrecognized unit', () => {
    const planItems: ReportPlanItemInput[] = [
      { id: 'pi-no-qty', name: 'NoQty', quantity: null, unit: 'kg/acre' },
      { id: 'pi-zero', name: 'Zero', quantity: 0, unit: 'kg/acre' },
      { id: 'pi-no-unit', name: 'NoUnit', quantity: 5, unit: null },
      { id: 'pi-verbatim', name: 'Verbatim', quantity: 5, unit: 'tola' },
      { id: 'pi-ok', name: 'Urea', quantity: 5, unit: 'kg/acre' },
    ];
    const lenses = computeUsageLenses({
      events: [fertEvent([{ name: 'Urea', quantity: 4, unit: 'kg' }])],
      areaAcres: 2,
      planItems,
    });
    expect(lenses.perAcre.compliance.map((row) => row.planItemId)).toEqual(['pi-ok']);
    expect(lenses.perAcre.compliance[0]).toMatchObject({
      prescribedPerAcre: 5,
      appliedPerAcre: 2,
      matchLevel: 'approximate',
    });
  });
});
