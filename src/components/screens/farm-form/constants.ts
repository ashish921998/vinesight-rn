/**
 * Farm Form – static constants
 */

import type { KnownCrop } from '@/utils/farm-crop-visuals';
import { CROPS } from '@/constants/crop-varieties';

export const SOIL_TEXTURE_OPTIONS = [
  { value: 'Sand', labelKey: 'farmForm.soilTexture.options.sand' },
  { value: 'Loamy sand', labelKey: 'farmForm.soilTexture.options.loamySand' },
  { value: 'Sandy loam', labelKey: 'farmForm.soilTexture.options.sandyLoam' },
  { value: 'Loam', labelKey: 'farmForm.soilTexture.options.loam' },
  { value: 'Silt loam', labelKey: 'farmForm.soilTexture.options.siltLoam' },
  { value: 'Silt', labelKey: 'farmForm.soilTexture.options.silt' },
  { value: 'Sandy clay loam', labelKey: 'farmForm.soilTexture.options.sandyClayLoam' },
  { value: 'Clay loam', labelKey: 'farmForm.soilTexture.options.clayLoam' },
  { value: 'Silty clay loam', labelKey: 'farmForm.soilTexture.options.siltyClayLoam' },
  { value: 'Sandy clay', labelKey: 'farmForm.soilTexture.options.sandyClay' },
  { value: 'Silty clay', labelKey: 'farmForm.soilTexture.options.siltyClay' },
  { value: 'Clay', labelKey: 'farmForm.soilTexture.options.clay' },
] as const;

export const KNOWN_CROPS = CROPS.filter((crop): crop is KnownCrop => crop !== 'Other');

export const POPULAR_CROPS: KnownCrop[] = [
  'Grapes',
  'Pomegranate',
  'Mango',
  'Banana',
  'Tomato',
  'Sugarcane',
  'Guava',
  'Citrus',
];

export const CROP_I18N_KEY_MAP: Partial<
  Record<KnownCrop, { labelKey: string; sublabelKey: string }>
> = {
  Grapes: {
    labelKey: 'farmForm.cropOptions.grapes.label',
    sublabelKey: 'farmForm.cropOptions.grapes.sublabel',
  },
  Mango: {
    labelKey: 'farmForm.cropOptions.mango.label',
    sublabelKey: 'farmForm.cropOptions.mango.sublabel',
  },
  Pomegranate: {
    labelKey: 'farmForm.cropOptions.pomegranate.label',
    sublabelKey: 'farmForm.cropOptions.pomegranate.sublabel',
  },
  Citrus: {
    labelKey: 'farmForm.cropOptions.citrus.label',
    sublabelKey: 'farmForm.cropOptions.citrus.sublabel',
  },
  Banana: {
    labelKey: 'farmForm.cropOptions.banana.label',
    sublabelKey: 'farmForm.cropOptions.banana.sublabel',
  },
  Tomato: {
    labelKey: 'farmForm.cropOptions.tomato.label',
    sublabelKey: 'farmForm.cropOptions.tomato.sublabel',
  },
  Sugarcane: {
    labelKey: 'farmForm.cropOptions.sugarcane.label',
    sublabelKey: 'farmForm.cropOptions.sugarcane.sublabel',
  },
  Guava: {
    labelKey: 'farmForm.cropOptions.guava.label',
    sublabelKey: 'farmForm.cropOptions.guava.sublabel',
  },
};
