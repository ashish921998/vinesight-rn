import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

type IonName = ComponentProps<typeof Ionicons>['name'];

export type Tab = {
  name: string;
  /** Single label in both Simple and Detailed mode. */
  titleKey: string;
  /** Cross-platform Ionicons: [default, selected]. */
  ion: readonly [IonName, IonName];
};

// The two base destinations keep ONE label + icon across Simple and Detailed
// mode, so the same routes present identical chrome on every platform/mode —
// index is Home (house); explore is Farms (agriculture).
export const BASE_TABS: readonly Tab[] = [
  {
    name: 'index',
    titleKey: 'tabs.home',
    ion: ['home-outline', 'home'],
  },
  {
    name: 'explore',
    titleKey: 'tabs.explore',
    ion: ['leaf-outline', 'leaf'],
  },
];

export const DETAILED_TABS: readonly Tab[] = [
  {
    name: 'workers',
    titleKey: 'tabs.workers',
    ion: ['people-outline', 'people'],
  },
  {
    name: 'tools',
    titleKey: 'tabs.tools',
    ion: ['build-outline', 'build'],
  },
];
