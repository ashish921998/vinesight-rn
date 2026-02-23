import fs from 'node:fs';
import path from 'node:path';
import type { DoseBasis, DoseUnit } from '@/types/phi';

interface ProductFile {
  products: Array<{
    key: string;
    inputType: string;
    verificationTier: string;
  }>;
}

interface CompositionFile {
  rows: Array<{
    productKey: string;
    componentCode: string;
    percent: number;
  }>;
}

interface PhiFile {
  rows: Array<{
    productKey: string;
    phiDays: number;
    verified: boolean;
    evidenceLevel?: string | null;
    sourceNote?: string | null;
  }>;
}

interface MixFile {
  mixes: Array<{
    components: Array<{
      productKey: string;
      doseUnit: DoseUnit;
      doseBasis: DoseBasis;
      doseValue: number;
      baseTankLiters?: number | null;
    }>;
  }>;
}

function loadJson<T>(fileName: string): T {
  const absolutePath = path.resolve(process.cwd(), 'assets/data/master', fileName);
  const raw = fs.readFileSync(absolutePath, 'utf8');
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Expected object JSON root in ${fileName}`);
  }
  return parsed as T;
}

describe('master catalog validation', () => {
  it('accepts only valid dose units and basis values', () => {
    const mixes = loadJson<MixFile>('maharashtra_mixes_v1.json');
    const validUnits = new Set<DoseUnit>(['gm', 'ml']);
    const validBasis = new Set<DoseBasis>(['per_liter', 'per_100_liter', 'fixed_per_tank']);

    for (const mix of mixes.mixes) {
      for (const component of mix.components) {
        expect(validUnits.has(component.doseUnit)).toBe(true);
        expect(validBasis.has(component.doseBasis)).toBe(true);
        expect(component.doseValue).toBeGreaterThan(0);
        if (component.doseBasis === 'fixed_per_tank') {
          expect(component.baseTankLiters).toBeDefined();
          expect((component.baseTankLiters ?? 0) > 0).toBe(true);
        }
      }
    }
  });

  it('references valid products across compositions and mixes', () => {
    const products = loadJson<ProductFile>('maharashtra_products_v1.json');
    const compositions = loadJson<CompositionFile>('maharashtra_compositions_v1.json');
    const mixes = loadJson<MixFile>('maharashtra_mixes_v1.json');

    const productKeys = new Set(products.products.map((product) => product.key));

    for (const row of compositions.rows) {
      expect(productKeys.has(row.productKey)).toBe(true);
      expect(row.componentCode.trim().length).toBeGreaterThan(0);
      expect(row.percent).toBeGreaterThanOrEqual(0);
      expect(row.percent).toBeLessThanOrEqual(100);
    }

    for (const mix of mixes.mixes) {
      for (const component of mix.components) {
        expect(productKeys.has(component.productKey)).toBe(true);
      }
    }
  });

  it('has verified PHI metadata for verified spray products', () => {
    const products = loadJson<ProductFile>('maharashtra_products_v1.json');
    const phi = loadJson<PhiFile>('maharashtra_phi_rules_v1.json');
    const verifiedPhiByProduct = new Map(
      phi.rows.filter((row) => row.verified).map((row) => [row.productKey, row]),
    );

    const verifiedSprays = products.products.filter(
      (product) => product.inputType === 'spray' && product.verificationTier === 'verified',
    );

    for (const product of verifiedSprays) {
      const rule = verifiedPhiByProduct.get(product.key);
      expect(rule).toBeDefined();
      expect(Number.isInteger(rule?.phiDays)).toBe(true);
      expect((rule?.phiDays ?? -1) >= 0).toBe(true);
      expect((rule?.evidenceLevel ?? '').trim().length).toBeGreaterThan(0);
      expect((rule?.sourceNote ?? '').trim().length).toBeGreaterThan(0);
    }
  });
});
