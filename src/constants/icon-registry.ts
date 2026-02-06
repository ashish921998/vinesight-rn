export const ICON_REGISTRY = {
  irrigation: 'water',
  spray: 'spraycan',
  harvest: 'basket',
  expense: 'cash',
  fertigation: 'fertigation',
  note: 'document-text',
  soilTest: 'layers',
  petioleTest: 'analytics',
} as const;

export type RegistryIconName = (typeof ICON_REGISTRY)[keyof typeof ICON_REGISTRY];

const APP_ICON_TO_SYMBOL_ICON: Record<string, string> = {
  water: 'drop.fill',
  spraycan: 'spraycan.fill',
  basket: 'basket.fill',
  cash: 'dollarsign.circle.fill',
  leaf: 'leaf.fill',
  fertigation: 'drop.fill',
  analytics: 'chart.bar.fill',
  layers: 'square.stack.3d.up.fill',
  'document-text': 'doc.text.fill',
};

export function resolveSymbolIconName(iconName: string | undefined): string {
  if (!iconName) return 'doc.fill';
  return APP_ICON_TO_SYMBOL_ICON[iconName] ?? 'doc.fill';
}
