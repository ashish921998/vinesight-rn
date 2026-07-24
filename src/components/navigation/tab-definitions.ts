import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

type IonName = ComponentProps<typeof Ionicons>['name'];

/** Android vector-drawable icon key (maps to filled/outlined Material XML). */
export type TabIconKey = 'home' | 'tractor' | 'workers' | 'tools';

export type Tab = {
  name: string;
  /** Single label in both Simple and Detailed mode. */
  titleKey: string;
  androidIconKey: TabIconKey;
  /** iOS SF Symbols: [default, selected]. */
  sf: readonly [string, string];
  /** iOS vector icon (Ionicons): [default, selected]. */
  ion: readonly [IonName, IonName];
};

// The two base destinations keep ONE label + icon across Simple and Detailed
// mode, so the same routes present identical chrome on every platform/mode —
// index is Home (house); explore is Farms (agriculture). Both renderers (iOS
// NativeTabs and Android Compose) read from this single source of truth.
export const BASE_TABS: readonly Tab[] = [
  {
    name: 'index',
    titleKey: 'tabs.home',
    androidIconKey: 'home',
    sf: ['house', 'house.fill'],
    ion: ['home-outline', 'home'],
  },
  {
    name: 'explore',
    titleKey: 'tabs.explore',
    androidIconKey: 'tractor',
    sf: ['leaf', 'leaf.fill'],
    ion: ['leaf-outline', 'leaf'],
  },
];

export const DETAILED_TABS: readonly Tab[] = [
  {
    name: 'workers',
    titleKey: 'tabs.workers',
    androidIconKey: 'workers',
    sf: ['person.2', 'person.2.fill'],
    ion: ['people-outline', 'people'],
  },
  {
    name: 'tools',
    titleKey: 'tabs.tools',
    androidIconKey: 'tools',
    sf: ['wrench.and.screwdriver', 'wrench.and.screwdriver.fill'],
    ion: ['build-outline', 'build'],
  },
];
