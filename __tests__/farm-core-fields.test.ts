import {
  buildFarmInsertFromCoreFields,
  isFarmCoreFieldsValid,
  resolveFarmCoreSelection,
} from '@/components/screens/farm-form/utils';

describe('farm core field helpers', () => {
  it('validates the minimum required farm fields', () => {
    expect(
      isFarmCoreFieldsValid({
        name: 'Block A',
        region: 'Nashik',
        area: '12.5',
        selectedCrop: 'Grapes',
        customCropName: '',
        cropVariety: 'Thompson Seedless',
        customVariety: '',
      }),
    ).toBe(true);

    expect(
      isFarmCoreFieldsValid({
        name: '',
        region: 'Nashik',
        area: '12.5',
        selectedCrop: 'Grapes',
        customCropName: '',
        cropVariety: 'Thompson Seedless',
        customVariety: '',
      }),
    ).toBe(false);
  });

  it('resolves custom crop and variety values', () => {
    expect(
      resolveFarmCoreSelection({
        selectedCrop: 'Other',
        customCropName: 'Dragon Fruit',
        cropVariety: 'Custom',
        customVariety: 'Purple Star',
      }),
    ).toEqual({
      crop: 'Dragon Fruit',
      variety: 'Purple Star',
    });
  });

  it('builds a farm insert payload from the minimum onboarding fields', () => {
    expect(
      buildFarmInsertFromCoreFields(
        {
          name: 'Block A',
          region: 'Nashik',
          area: '12.5',
          selectedCrop: 'Grapes',
          customCropName: '',
          cropVariety: 'Thompson Seedless',
          customVariety: '',
        },
        new Date('2026-03-07T00:00:00.000Z'),
      ),
    ).toMatchObject({
      name: 'Block A',
      region: 'Nashik',
      area: 12.5,
      crop: 'Grapes',
      crop_variety: 'Thompson Seedless',
      planting_date: '2026-03-07',
    });
  });
});
