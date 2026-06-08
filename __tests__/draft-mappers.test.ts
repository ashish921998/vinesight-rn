import {
  getLogDescription,
  buildSprayPendingData,
} from '@/components/screens/entry-form/draft-mappers';
import type { SprayFormData } from '@/components/forms';

describe('draft-mappers', () => {
  describe('getLogDescription', () => {
    it('summarizes irrigation by duration', () => {
      expect(getLogDescription('irrigation', { duration: 5 })).toBe('5 hours');
    });

    it('prefers the catalog mix name for spray when present', () => {
      expect(getLogDescription('spray', { catalogMixName: '  Bordeaux  ', waterVolume: 200 })).toBe(
        'Bordeaux • 200L',
      );
    });

    it('falls back to chemical count for spray (pluralization)', () => {
      expect(getLogDescription('spray', { waterVolume: 200, chemicals: [{}] })).toBe(
        '200L water, 1 chemical',
      );
      expect(getLogDescription('spray', { waterVolume: 200, chemicals: [{}, {}] })).toBe(
        '200L water, 2 chemicals',
      );
    });

    it('summarizes harvest, expense, fertigation and note', () => {
      expect(getLogDescription('harvest', { quantity: 10, grade: 'A' })).toBe('10 kg, Grade A');
      expect(getLogDescription('expense', { cost: 500, type: 'Fuel' })).toBe('₹500 - Fuel');
      expect(
        getLogDescription('fertigation', { waterVolume: 100, fertilizers: [{}, {}, {}] }),
      ).toBe('100L water, 3 fertilizers');
      expect(getLogDescription('fertigation', { waterVolume: 0, fertilizers: [{}] })).toBe(
        '1 fertilizer',
      );
      expect(getLogDescription('note', { notes: '  hello  ' })).toBe('hello');
      expect(getLogDescription('note', {})).toBe('');
    });

    it('returns empty string for unknown types', () => {
      expect(getLogDescription('unknown' as never, {})).toBe('');
    });
  });

  describe('buildSprayPendingData', () => {
    const resolved = {
      catalogMixId: 7,
      safeHarvestDate: '2026-07-01',
      governingPhiDays: 14,
      phiBlockingComponent: 'mancozeb',
      phiStatus: 'verified',
      waterVolume: 200,
      chemicals: [],
    } as unknown as SprayFormData;

    it('preserves resolved PHI metadata on a grape farm', () => {
      const out = buildSprayPendingData(resolved, { isGrapeFarm: true });
      expect(out.governingPhiDays).toBe(14);
      expect(out.safeHarvestDate).toBe('2026-07-01');
      expect(out.phiBlockingComponent).toBe('mancozeb');
      expect(out.phiStatus).toBe('verified');
      expect(out).not.toBe(resolved); // returns a copy
    });

    it('clears the PHI date/days/component on a non-grape farm but preserves a caller-set status', () => {
      const out = buildSprayPendingData(resolved, { isGrapeFarm: false });
      expect(out.governingPhiDays).toBeNull();
      expect(out.safeHarvestDate).toBeNull();
      expect(out.phiBlockingComponent).toBeNull();
      expect(out.phiStatus).toBe('verified'); // `??` keeps the caller's existing status
    });

    it('infers legacy_unverified on a non-grape farm when a mix exists and no status is set', () => {
      const mixNoStatus = { catalogMixId: 7, chemicals: [] } as unknown as SprayFormData;
      const out = buildSprayPendingData(mixNoStatus, { isGrapeFarm: false });
      expect(out.phiStatus).toBe('legacy_unverified');
    });

    it('clears PHI metadata when a grape spray has an unresolved mix', () => {
      const unresolved = {
        catalogMixId: 7,
        safeHarvestDate: null,
        governingPhiDays: null,
        chemicals: [],
      } as unknown as SprayFormData;
      const out = buildSprayPendingData(unresolved, { isGrapeFarm: true });
      expect(out.safeHarvestDate).toBeNull();
      expect(out.phiStatus).toBe('legacy_unverified');
    });

    it('infers unknown status when there is no catalog mix and no caller status', () => {
      const noMix = { chemicals: [] } as unknown as SprayFormData;
      const out = buildSprayPendingData(noMix, { isGrapeFarm: true });
      expect(out.phiStatus).toBe('unknown');
    });

    it('keeps a caller-provided status when clearing an unmapped spray', () => {
      const withStatus = {
        phiStatus: 'legacy_unverified',
        chemicals: [],
      } as unknown as SprayFormData;
      const out = buildSprayPendingData(withStatus, { isGrapeFarm: false });
      expect(out.phiStatus).toBe('legacy_unverified');
    });
  });
});
