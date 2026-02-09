export interface SeasonTemplateOption {
  key: string;
  label: string;
  description: string;
  suggestedStartMonth: number; // 0-based JS month
}

const DEFAULT_TEMPLATES: SeasonTemplateOption[] = [
  {
    key: 'default_annual',
    label: 'Annual',
    description: 'General annual season cycle',
    suggestedStartMonth: 0,
  },
  {
    key: 'default_crop_cycle',
    label: 'Crop Cycle',
    description: 'Start when new crop cycle begins',
    suggestedStartMonth: 5,
  },
];

const CROP_TEMPLATE_MAP: Record<string, SeasonTemplateOption[]> = {
  grape: [
    {
      key: 'grape_post_pruning',
      label: 'Post-Pruning Cycle',
      description: 'Start with pruning and end at harvest close',
      suggestedStartMonth: 5,
    },
    {
      key: 'grape_fiscal',
      label: 'Vineyard Fiscal',
      description: 'Season aligned to financial planning',
      suggestedStartMonth: 3,
    },
  ],
  grapes: [
    {
      key: 'grape_post_pruning',
      label: 'Post-Pruning Cycle',
      description: 'Start with pruning and end at harvest close',
      suggestedStartMonth: 5,
    },
    {
      key: 'grape_fiscal',
      label: 'Vineyard Fiscal',
      description: 'Season aligned to financial planning',
      suggestedStartMonth: 3,
    },
  ],
  mango: [
    {
      key: 'mango_flowering',
      label: 'Flowering Cycle',
      description: 'Season aligned from flowering to post-harvest',
      suggestedStartMonth: 10,
    },
  ],
  pomegranate: [
    {
      key: 'pomegranate_bahar',
      label: 'Bahar Cycle',
      description: 'Track season by selected bahar window',
      suggestedStartMonth: 5,
    },
  ],
  citrus: [
    {
      key: 'citrus_flush',
      label: 'Flush Cycle',
      description: 'Start at vegetative flush, end post-harvest',
      suggestedStartMonth: 6,
    },
  ],
  banana: [
    {
      key: 'banana_planting',
      label: 'Planting Cycle',
      description: 'Planting to bunch completion cycle',
      suggestedStartMonth: 5,
    },
  ],
};

export function getSeasonTemplatesForCrop(crop?: string | null): SeasonTemplateOption[] {
  if (!crop) return DEFAULT_TEMPLATES;
  const key = crop.trim().toLowerCase();
  return CROP_TEMPLATE_MAP[key] ?? DEFAULT_TEMPLATES;
}
