import type { CropType } from '@/constants/crop-varieties';
import type { CropIconName } from '@/components/ui/crop-icon';

export type KnownCrop = Exclude<CropType, 'Other'>;

type CropVisual =
  | {
      iconName: CropIconName;
      symbolName?: never;
    }
  | {
      iconName?: never;
      symbolName: 'basket.fill' | 'flask.fill' | 'bolt.fill';
    };

export const CROP_VISUALS: Record<KnownCrop, CropVisual> = {
  Grapes: { iconName: 'grapes' },
  Mango: { iconName: 'mango' },
  Pomegranate: { iconName: 'pomegranate' },
  Citrus: { iconName: 'citrus' },
  Banana: { iconName: 'banana' },
  Tomato: { iconName: 'tomato' },
  Sugarcane: { iconName: 'sugarcane' },
  Guava: { iconName: 'guava' },
  Apple: { iconName: 'apple' },
  Pear: { iconName: 'pear' },
  Peach: { iconName: 'peach' },
  Plum: { iconName: 'plum' },
  Cherry: { iconName: 'cherry' },
  Strawberry: { iconName: 'strawberry' },
  Blueberry: { iconName: 'blueberry' },
  Raspberry: { iconName: 'raspberry' },
  Blackberry: { iconName: 'blackberry' },
  Papaya: { iconName: 'papaya' },
  Pineapple: { iconName: 'pineapple' },
  Coconut: { iconName: 'coconut' },
  Arecanut: { iconName: 'arecanut' },
  Cashew: { iconName: 'cashew' },
  Coffee: { iconName: 'coffee' },
  Tea: { iconName: 'tea' },
  Cocoa: { iconName: 'cocoa' },
  Cotton: { iconName: 'cotton' },
  Rice: { iconName: 'rice' },
  Wheat: { iconName: 'wheat' },
  Maize: { iconName: 'maize' },
  Soybean: { iconName: 'soybean' },
  Groundnut: { iconName: 'groundnut' },
  Chili: { iconName: 'chili' },
  Onion: { iconName: 'onion' },
  Potato: { iconName: 'potato' },
};

export const getCropVisual = (
  crop: CropType,
): CropVisual | { symbolName: 'leaf.fill'; iconName?: never } => {
  if (crop === 'Other') return { symbolName: 'leaf.fill' };
  return CROP_VISUALS[crop];
};
