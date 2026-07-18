import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

export const BASE_TABS = [
  { name: 'index', titleKey: 'tabs.dashboard' },
  { name: 'explore', titleKey: 'tabs.explore' },
] as const;

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
  {
    name: 'assistant',
    titleKey: 'tabs.aiAssistant',
    sf: ['brain', 'brain.fill'] as const,
    ion: ['sparkles-outline', 'sparkles'] as const satisfies readonly ComponentProps<
      typeof Ionicons
    >['name'][],
  },
] as const;
