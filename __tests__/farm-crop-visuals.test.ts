import { CROPS } from '@/constants/crop-varieties';
import { CROP_VISUALS, type KnownCrop } from '@/utils/farm-crop-visuals';

describe('farm crop visuals', () => {
  it('defines an explicit icon for every non-Other crop', () => {
    const knownCrops = CROPS.filter((crop): crop is KnownCrop => crop !== 'Other');

    for (const crop of knownCrops) {
      const visual = CROP_VISUALS[crop];
      expect(visual).toBeDefined();
      expect('iconName' in visual).toBe(true);
      expect(visual.iconName).toBeTruthy();
    }
  });

  it('does not fall back to symbol placeholders for non-Other crops', () => {
    const knownCrops = CROPS.filter((crop): crop is KnownCrop => crop !== 'Other');

    for (const crop of knownCrops) {
      const visual = CROP_VISUALS[crop];
      expect('symbolName' in visual).toBe(false);
    }
  });
});
