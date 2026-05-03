import { en } from '@/i18n/locales/en';
import { hi } from '@/i18n/locales/hi';
import { mr } from '@/i18n/locales/mr';

const locales = [
  ['en', en],
  ['hi', hi],
  ['mr', mr],
] as const;

describe('farm form translation coverage', () => {
  it.each(locales)('has required submit error keys for %s locale', (_code, locale) => {
    expect(locale.farmForm.soilCompositionHint).toBeTruthy();
    expect(locale.farmForm.overflowError).toContain('{{fields}}');
    expect(locale.farmForm.overflowError).toContain('{{max}}');
    expect(locale.common.errors.invalidFarmNumericInput).toBeTruthy();
    expect(locale.locationPicker.invalidCoordinates).toBeTruthy();
  });

  it.each(locales)('has required crop picker keys for %s locale', (_code, locale) => {
    expect(locale.farmForm.cropPicker.modalTitle).toBeTruthy();
    expect(locale.farmForm.cropPicker.searchPlaceholder).toBeTruthy();
    expect(locale.farmForm.cropPicker.defaultSublabel).toBeTruthy();
    expect(locale.farmForm.cropPicker.customCropLabel).toBeTruthy();
    expect(locale.farmForm.cropPicker.customCropInputLabel).toBeTruthy();
    expect(locale.farmForm.cropPicker.customCropInputPlaceholder).toBeTruthy();
    expect(locale.farmForm.cropPicker.useCustomCrop).toContain('{{crop}}');
    expect(locale.farmForm.cropPicker.noResults).toBeTruthy();
  });

  it.each(locales)('has farmCard season timeline keys for %s locale', (_code, locale) => {
    expect(locale.farmCard.season.pruning).toBeTruthy();
    expect(locale.farmCard.season.bloom).toBeTruthy();
    expect(locale.farmCard.season.veraison).toBeTruthy();
    expect(locale.farmCard.season.harvest).toBeTruthy();
    expect(locale.farmCard.season.sincePruning).toBeTruthy();
  });

  it.each(locales)('has farms summary attention keys for %s locale', (_code, locale) => {
    expect(locale.farms.summary.needsAttention_one).toContain('{{count}}');
    expect(locale.farms.summary.needsAttention_other).toContain('{{count}}');
    expect(locale.farms.summary.count_one).toContain('{{count}}');
    expect(locale.farms.summary.count_other).toContain('{{count}}');
    expect(locale.farms.summary.area).toContain('{{value}}');
  });
});
