import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

export const BASE_TABS = [
  { name: 'index', titleKey: 'tabs.dashboard' },
  { name: 'explore', titleKey: 'tabs.explore' },
] as const;

// The two base destinations are relabelled in Simplified mode (Home / Farms)
// without changing their routes; Detailed mode keeps Dashboard / Farming.
export function baseTabLabelKey(name: string, detailedMode: boolean, fallbackKey: string): string {
  if (name === 'index') return detailedMode ? 'tabs.dashboard' : 'tabs.home';
  if (name === 'explore') return detailedMode ? 'tabs.explore' : 'tabs.farms';
  return fallbackKey;
}

// The two base destinations also swap their Android vector icon to match the
// mode label: Simplified shows Home (house) + Farms (barn); Detailed shows
// Dashboard (grid) + Farming (tractor). DETAILED_TABS always use the same icon.
export function baseTabIconKey(
  name: string,
  detailedMode: boolean,
): 'home' | 'dashboard' | 'barn' | 'tractor' {
  if (name === 'index') return detailedMode ? 'dashboard' : 'home';
  if (name === 'explore') return detailedMode ? 'tractor' : 'barn';
  return 'dashboard';
}

export const DETAILED_TABS = [
  {
    name: 'workers',
    titleKey: 'tabs.workers',
    sf: ['person.2', 'person.2.fill'] as const,
    ion: ['people-outline', 'people'] as const satisfies readonly ComponentProps<
      typeof Ionicons
    >['name'][],
  },
  {
    name: 'tools',
    titleKey: 'tabs.tools',
    sf: ['wrench.and.screwdriver', 'wrench.and.screwdriver.fill'] as const,
    ion: ['build-outline', 'build'] as const satisfies readonly ComponentProps<
      typeof Ionicons
    >['name'][],
  },
] as const;
