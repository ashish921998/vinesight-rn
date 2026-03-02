import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type InputType = 'spray' | 'fertilizer' | 'biostimulant' | 'adjuvant' | 'other';
type VerificationTier = 'verified' | 'provisional';
type AliasKind = 'trade' | 'ocr' | 'common' | 'legacy';
type ComponentType = 'nutrient' | 'active_ingredient' | 'other';
type DoseUnit = 'gm' | 'ml';
type DoseBasis = 'per_liter' | 'per_100_liter' | 'fixed_per_tank';

type AppMode = 'preventive' | 'curative' | 'both' | 'unspecified';

interface ProductAliasInput {
  alias: string;
  locale?: string;
  aliasKind?: AliasKind;
  source?: string | null;
}

interface ProductInput {
  key: string;
  name: string;
  manufacturer?: string | null;
  activeIngredient?: string | null;
  inputType: InputType;
  verificationTier: VerificationTier;
  formulation?: string | null;
  stateCode?: string;
  sourceReference?: string | null;
  isActive?: boolean;
  packagingSize?: string | null;
  pricePerPackage?: number | null;
  priceCurrency?: string | null;
  aliases?: ProductAliasInput[];
}

interface ProductFile {
  version: string;
  stateCode: string;
  sourceReference?: string;
  products: ProductInput[];
}

interface CompositionRow {
  productKey: string;
  componentCode: string;
  componentType: ComponentType;
  percent: number;
  basis?: string;
  verified?: boolean;
  sourceNote?: string | null;
}

interface CompositionFile {
  version: string;
  stateCode: string;
  rows: CompositionRow[];
}

interface PhiRow {
  productKey: string;
  crop: string;
  phiDays: number;
  evidenceLevel?: string | null;
  sourceNote?: string | null;
  sourceUrl?: string | null;
  verified?: boolean;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
}

interface PhiFile {
  version: string;
  stateCode: string;
  rows: PhiRow[];
}

interface MixComponent {
  productKey: string;
  doseValue: number;
  doseUnit: DoseUnit;
  doseBasis: DoseBasis;
  baseTankLiters?: number | null;
  notes?: string | null;
}

interface MixRow {
  name: string;
  targetProblem?: string | null;
  applicationMode?: AppMode;
  sourcePage?: number | null;
  sourceDocument?: string | null;
  crop?: string;
  isActive?: boolean;
  estimatedCostPer200L?: number | null;
  components: MixComponent[];
}

interface MixFile {
  version: string;
  crop: string;
  sourceDocument?: string | null;
  mixes: MixRow[];
}

interface ValidationResult {
  generatedAt: string;
  files: {
    products: string;
    compositions: string;
    phiRules: string;
    mixes: string;
  };
  productCount: number;
  compositionCount: number;
  phiRuleCount: number;
  mixCount: number;
  warningCount: number;
  errorCount: number;
  warnings: string[];
  errors: string[];
  isValid: boolean;
}

const VALID_INPUT_TYPES = new Set<InputType>([
  'spray',
  'fertilizer',
  'biostimulant',
  'adjuvant',
  'other',
]);
const VALID_TIERS = new Set<VerificationTier>(['verified', 'provisional']);
const VALID_ALIAS_KINDS = new Set<AliasKind>(['trade', 'ocr', 'common', 'legacy']);
const VALID_COMPONENT_TYPES = new Set<ComponentType>(['nutrient', 'active_ingredient', 'other']);
const VALID_DOSE_UNITS = new Set<DoseUnit>(['gm', 'ml']);
const VALID_DOSE_BASIS = new Set<DoseBasis>(['per_liter', 'per_100_liter', 'fixed_per_tank']);

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function readJson<T>(absolutePath: string): T {
  const raw = fs.readFileSync(absolutePath, 'utf8');
  return JSON.parse(raw) as T;
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function validateMasterCatalog(files: {
  products: ProductFile;
  compositions: CompositionFile;
  phi: PhiFile;
  mixes: MixFile;
}): { warnings: string[]; errors: string[] } {
  const warnings: string[] = [];
  const errors: string[] = [];
  const productKeySet = new Set<string>();
  const productStateNameSet = new Set<string>();

  files.products.products.forEach((product, index) => {
    const prefix = `products[${index}]`;
    if (!product.key?.trim()) {
      errors.push(`${prefix}.key is required`);
      return;
    }

    if (productKeySet.has(product.key)) {
      errors.push(`${prefix}.key duplicate: ${product.key}`);
    }
    productKeySet.add(product.key);

    if (!product.name?.trim()) errors.push(`${prefix}.name is required`);

    if (!VALID_INPUT_TYPES.has(product.inputType)) {
      errors.push(`${prefix}.inputType invalid: ${String(product.inputType)}`);
    }

    if (!VALID_TIERS.has(product.verificationTier)) {
      errors.push(`${prefix}.verificationTier invalid: ${String(product.verificationTier)}`);
    }

    const stateCode = (product.stateCode ?? files.products.stateCode).trim();
    if (!stateCode) {
      errors.push(`${prefix}.stateCode is required`);
    } else if (product.name?.trim()) {
      const stateNameKey = `${stateCode.toUpperCase()}::${normalize(product.name)}`;
      if (productStateNameSet.has(stateNameKey)) {
        errors.push(`${prefix}.name duplicates state/name pair: ${stateCode} ${product.name}`);
      }
      productStateNameSet.add(stateNameKey);
    }

    const aliasSet = new Set<string>();
    for (const [aliasIndex, alias] of (product.aliases ?? []).entries()) {
      if (!alias.alias?.trim()) {
        errors.push(`${prefix}.aliases[${aliasIndex}].alias is required`);
        continue;
      }

      const aliasKind = alias.aliasKind ?? 'trade';
      if (!VALID_ALIAS_KINDS.has(aliasKind)) {
        errors.push(`${prefix}.aliases[${aliasIndex}].aliasKind invalid: ${aliasKind}`);
      }

      const locale = (alias.locale ?? 'en').trim() || 'en';
      const aliasKey = `${locale.toLowerCase()}::${normalize(alias.alias)}`;
      if (aliasSet.has(aliasKey)) {
        errors.push(`${prefix}.aliases[${aliasIndex}] duplicates locale+alias pair`);
      }
      aliasSet.add(aliasKey);
    }

    if (product.pricePerPackage != null) {
      if (!Number.isFinite(product.pricePerPackage) || product.pricePerPackage < 0) {
        errors.push(`${prefix}.pricePerPackage must be a non-negative number when provided`);
      }
    }
    if (
      product.priceCurrency != null &&
      !['INR', 'USD', 'EUR', 'GBP'].includes(product.priceCurrency)
    ) {
      errors.push(`${prefix}.priceCurrency invalid: ${product.priceCurrency}`);
    }
  });

  const sprayVerifiedProducts = new Set<string>(
    files.products.products
      .filter((product) => product.inputType === 'spray' && product.verificationTier === 'verified')
      .map((product) => product.key),
  );

  files.compositions.rows.forEach((row, index) => {
    const prefix = `compositions[${index}]`;
    if (!productKeySet.has(row.productKey)) {
      errors.push(`${prefix}.productKey not found: ${row.productKey}`);
    }
    if (!row.componentCode?.trim()) errors.push(`${prefix}.componentCode is required`);
    if (!VALID_COMPONENT_TYPES.has(row.componentType)) {
      errors.push(`${prefix}.componentType invalid: ${String(row.componentType)}`);
    }
    if (!Number.isFinite(row.percent) || row.percent < 0 || row.percent > 100) {
      errors.push(`${prefix}.percent must be between 0 and 100`);
    }
    if (!row.basis || !row.basis.trim()) {
      errors.push(`${prefix}.basis is required`);
    }
  });

  const verifiedPhiKeys = new Set<string>();

  files.phi.rows.forEach((row, index) => {
    const prefix = `phiRules[${index}]`;
    if (!productKeySet.has(row.productKey)) {
      errors.push(`${prefix}.productKey not found: ${row.productKey}`);
    }
    if (!row.crop?.trim()) errors.push(`${prefix}.crop is required`);
    if (!Number.isInteger(row.phiDays) || row.phiDays < 0) {
      errors.push(`${prefix}.phiDays must be a non-negative integer`);
    }

    const verified = row.verified !== false;
    if (verified) {
      verifiedPhiKeys.add(row.productKey);
      if (!row.evidenceLevel?.trim()) {
        errors.push(`${prefix}.evidenceLevel required for verified PHI rule`);
      }
      if (!row.sourceNote?.trim()) {
        errors.push(`${prefix}.sourceNote required for verified PHI rule`);
      }
      if (row.sourceUrl && !/^https?:\/\//i.test(row.sourceUrl)) {
        errors.push(`${prefix}.sourceUrl must be an http(s) URL when provided`);
      }
    }

    if (row.effectiveFrom && !isIsoDate(row.effectiveFrom)) {
      errors.push(`${prefix}.effectiveFrom must be YYYY-MM-DD`);
    }
    if (row.effectiveTo && !isIsoDate(row.effectiveTo)) {
      errors.push(`${prefix}.effectiveTo must be YYYY-MM-DD`);
    }
  });

  for (const key of sprayVerifiedProducts) {
    if (!verifiedPhiKeys.has(key)) {
      errors.push(`verified spray product missing verified PHI rule: ${key}`);
    }
  }

  const mixNameSet = new Set<string>();
  files.mixes.mixes.forEach((mix, index) => {
    const prefix = `mixes[${index}]`;
    if (!mix.name?.trim()) {
      errors.push(`${prefix}.name is required`);
      return;
    }

    const crop = (mix.crop ?? files.mixes.crop).trim().toLowerCase();
    const mixNameKey = `${crop}::${normalize(mix.name)}`;
    if (mixNameSet.has(mixNameKey)) {
      errors.push(`${prefix}.duplicate crop+name: ${mix.crop ?? files.mixes.crop} / ${mix.name}`);
    }
    mixNameSet.add(mixNameKey);

    if (!Array.isArray(mix.components) || mix.components.length === 0) {
      errors.push(`${prefix}.components must contain at least one row`);
      return;
    }

    mix.components.forEach((component, componentIndex) => {
      const componentPrefix = `${prefix}.components[${componentIndex}]`;
      if (!productKeySet.has(component.productKey)) {
        errors.push(`${componentPrefix}.productKey not found: ${component.productKey}`);
      }
      if (!Number.isFinite(component.doseValue) || component.doseValue <= 0) {
        errors.push(`${componentPrefix}.doseValue must be > 0`);
      }
      if (!VALID_DOSE_UNITS.has(component.doseUnit)) {
        errors.push(`${componentPrefix}.doseUnit invalid: ${String(component.doseUnit)}`);
      }
      if (!VALID_DOSE_BASIS.has(component.doseBasis)) {
        errors.push(`${componentPrefix}.doseBasis invalid: ${String(component.doseBasis)}`);
      }
      if (component.doseBasis === 'fixed_per_tank') {
        if (
          component.baseTankLiters == null ||
          !Number.isFinite(component.baseTankLiters) ||
          component.baseTankLiters <= 0
        ) {
          errors.push(`${componentPrefix}.baseTankLiters required for fixed_per_tank`);
        }
      }
    });

    if (mix.estimatedCostPer200L != null) {
      if (!Number.isFinite(mix.estimatedCostPer200L) || mix.estimatedCostPer200L < 0) {
        errors.push(`${prefix}.estimatedCostPer200L must be a non-negative number when provided`);
      }
    }
  });

  if (files.products.products.length === 0) {
    warnings.push('No products found in master catalog');
  }

  if (files.mixes.mixes.length === 0) {
    warnings.push('No mixes found in master catalog');
  }

  return { warnings, errors };
}

function main() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const rootDir = path.resolve(__dirname, '..');
  const baseDir = path.join(rootDir, 'assets', 'data', 'master');
  const reportPath = path.join(rootDir, 'targets', 'master-catalog-validation.json');

  const productsPath = path.join(baseDir, 'maharashtra_products_v1.json');
  const compositionsPath = path.join(baseDir, 'maharashtra_compositions_v1.json');
  const phiPath = path.join(baseDir, 'maharashtra_phi_rules_v1.json');
  const mixesPath = path.join(baseDir, 'maharashtra_mixes_v1.json');

  const products = readJson<ProductFile>(productsPath);
  const compositions = readJson<CompositionFile>(compositionsPath);
  const phi = readJson<PhiFile>(phiPath);
  const mixes = readJson<MixFile>(mixesPath);

  assert(products.version.trim().length > 0, 'products.version is required');
  assert(compositions.version.trim().length > 0, 'compositions.version is required');
  assert(phi.version.trim().length > 0, 'phi.version is required');
  assert(mixes.version.trim().length > 0, 'mixes.version is required');

  const validated = validateMasterCatalog({ products, compositions, phi, mixes });

  const report: ValidationResult = {
    generatedAt: new Date().toISOString(),
    files: {
      products: productsPath,
      compositions: compositionsPath,
      phiRules: phiPath,
      mixes: mixesPath,
    },
    productCount: products.products.length,
    compositionCount: compositions.rows.length,
    phiRuleCount: phi.rows.length,
    mixCount: mixes.mixes.length,
    warningCount: validated.warnings.length,
    errorCount: validated.errors.length,
    warnings: validated.warnings,
    errors: validated.errors,
    isValid: validated.errors.length === 0,
  };

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  if (!report.isValid) {
    console.error(`Master catalog validation failed. See ${reportPath}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Master catalog validation passed: ${reportPath}`);
}

main();
