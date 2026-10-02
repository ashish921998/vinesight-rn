import {
  isFarmCoreFieldsValid,
  getFarmCoreFieldError,
  buildFarmInsertFromCoreFields,
  resolveFarmCoreSelection,
  sanitizeDecimalInput,
} from '../farm-form/utils';
import type { FarmCoreFields } from '../farm-form/utils';

const baseCoreFields = {
  region: '',
  customCropName: '',
  cropVariety: '',
  customVariety: '',
} satisfies Partial<FarmCoreFields>;

describe('isFarmCoreFieldsValid — quick-create (name + crop + area only)', () => {
  it('is valid with only name, area, and a selected crop', () => {
    expect(
      isFarmCoreFieldsValid({
        ...baseCoreFields,
        name: 'Sunset Vineyards',
        area: '5',
        selectedCrop: 'Grapes',
      }),
    ).toBe(true);
  });

  it('remains valid when region is blank (deferred to optional section)', () => {
    expect(
      isFarmCoreFieldsValid({
        ...baseCoreFields,
        name: 'Sunset Vineyards',
        region: '',
        area: '5',
        selectedCrop: 'Grapes',
      }),
    ).toBe(true);
  });

  it('remains valid when variety is blank', () => {
    expect(
      isFarmCoreFieldsValid({
        ...baseCoreFields,
        name: 'Sunset Vineyards',
        area: '5',
        selectedCrop: 'Grapes',
        cropVariety: '',
        customVariety: '',
      }),
    ).toBe(true);
  });

  it('is invalid without a name', () => {
    expect(
      isFarmCoreFieldsValid({ ...baseCoreFields, name: '', area: '5', selectedCrop: 'Grapes' }),
    ).toBe(false);
  });

  it('is invalid without a positive area', () => {
    expect(
      isFarmCoreFieldsValid({
        ...baseCoreFields,
        name: 'Farm',
        area: '0',
        selectedCrop: 'Grapes',
      }),
    ).toBe(false);
    expect(
      isFarmCoreFieldsValid({
        ...baseCoreFields,
        name: 'Farm',
        area: '',
        selectedCrop: 'Grapes',
      }),
    ).toBe(false);
  });

  it('requires a custom crop name when crop is "Other"', () => {
    expect(
      isFarmCoreFieldsValid({
        ...baseCoreFields,
        name: 'Farm',
        area: '5',
        selectedCrop: 'Other',
        customCropName: '',
      }),
    ).toBe(false);
    expect(
      isFarmCoreFieldsValid({
        ...baseCoreFields,
        name: 'Farm',
        area: '5',
        selectedCrop: 'Other',
        customCropName: 'Dragonfruit',
      }),
    ).toBe(true);
  });
});

describe('sanitizeDecimalInput — comma-locale decimal separator', () => {
  it('converts a comma decimal separator to a period', () => {
    expect(sanitizeDecimalInput('1,5')).toBe('1.5');
  });

  it('keeps a period decimal separator', () => {
    expect(sanitizeDecimalInput('1.5')).toBe('1.5');
  });

  it('collapses extra separators into a single decimal point', () => {
    expect(sanitizeDecimalInput('1,5,2')).toBe('1.52');
  });

  it('strips letters and other symbols', () => {
    expect(sanitizeDecimalInput('12a.5')).toBe('12.5');
  });
});

describe('getFarmCoreFieldError — first missing required field', () => {
  it('returns null when the core fields are valid', () => {
    expect(
      getFarmCoreFieldError({
        ...baseCoreFields,
        name: 'Farm',
        area: '5',
        selectedCrop: 'Grapes',
      }),
    ).toBeNull();
  });

  it('reports name first, then area, then custom crop', () => {
    expect(
      getFarmCoreFieldError({ ...baseCoreFields, name: '', area: '', selectedCrop: 'Other' }),
    ).toBe('name');
    expect(
      getFarmCoreFieldError({ ...baseCoreFields, name: 'Farm', area: '0', selectedCrop: 'Grapes' }),
    ).toBe('area');
    expect(
      getFarmCoreFieldError({
        ...baseCoreFields,
        name: 'Farm',
        area: '5',
        selectedCrop: 'Other',
        customCropName: '',
      }),
    ).toBe('customCrop');
  });
});

describe('buildFarmInsertFromCoreFields — safe empty-string defaults', () => {
  it('returns a non-null insert with empty-string region & crop_variety when blank', () => {
    const insert = buildFarmInsertFromCoreFields(
      {
        ...baseCoreFields,
        name: 'Sunset Vineyards',
        region: '',
        area: '5',
        selectedCrop: 'Grapes',
        cropVariety: '',
        customVariety: '',
      },
      new Date(2026, 0, 15),
    );
    expect(insert).not.toBeNull();
    expect(insert).toMatchObject({
      name: 'Sunset Vineyards',
      region: '',
      area: 5,
      crop: 'Grapes',
      crop_variety: '',
      planting_date: '2026-01-15',
    });
  });

  it('preserves region and variety when provided', () => {
    const insert = buildFarmInsertFromCoreFields({
      ...baseCoreFields,
      name: 'Sunset Vineyards',
      region: 'Napa Valley',
      area: '5',
      selectedCrop: 'Grapes',
      cropVariety: 'Cabernet',
      customVariety: '',
    });
    expect(insert).toMatchObject({ region: 'Napa Valley', crop_variety: 'Cabernet' });
  });

  it('returns null when core fields are invalid', () => {
    expect(
      buildFarmInsertFromCoreFields({
        ...baseCoreFields,
        name: '',
        area: '5',
        selectedCrop: 'Grapes',
      }),
    ).toBeNull();
  });
});

describe('resolveFarmCoreSelection — blank variety resolves to empty string', () => {
  it('resolves to an empty variety when nothing is chosen', () => {
    expect(
      resolveFarmCoreSelection({
        selectedCrop: 'Grapes',
        customCropName: '',
        cropVariety: '',
        customVariety: '',
      }),
    ).toEqual({ crop: 'Grapes', variety: '' });
  });
});
