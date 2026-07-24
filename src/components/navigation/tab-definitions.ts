import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

export const BASE_TABS = [
  { name: 'index', titleKey: 'tabs.dashboard' },
  { name: 'explore', titleKey: 'tabs.explore' },
] as const;

// The two base destinations keep ONE label + icon in both Simple and Detailed
// mode. (They previously swapped Home/Farms ↔ Dashboard/Farming per mode, which
// made the tab bar read differently between modes — same routes, different
// chrome.) index is Home (house); explore is Farming (tractor). Routes unchanged.
export function baseTabLabelKey(name: string, fallbackKey: string): string {
  if (name === 'index') return 'tabs.home';
  if (name === 'explore') return 'tabs.explore';
  return fallbackKey;
}

// Base-destination Android vector icon matches the label above:
// index → home (house), explore → tractor. DETAILED_TABS use their own icons.
export function baseTabIconKey(name: string): 'home' | 'tractor' {
  if (name === 'explore') return 'tractor';
  return 'home';
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
