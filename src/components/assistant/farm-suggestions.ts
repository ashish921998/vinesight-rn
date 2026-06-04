/**
 * Builds the example questions shown on the assistant's empty home, tailored to
 * the active farm's current state. Low water surfaces an irrigation question
 * first; a farm inside its harvest window surfaces a harvest question; otherwise
 * a sensible general set is used. Falls back gracefully when no farm is active.
 */
import type { Farm } from '@/types';
import { isLowWater } from '@/types';

export interface AssistantSuggestion {
  id: 'today' | 'water' | 'spray' | 'harvest' | 'weather';
  icon: string;
  text: string;
}

type TranslateFn = (key: string) => string;

const DAY_MS = 24 * 60 * 60 * 1000;
// Grapevine harvest typically falls ~90–150 days after pruning.
const HARVEST_WINDOW_MIN_DAYS = 90;
const HARVEST_WINDOW_MAX_DAYS = 150;

function daysSince(dateStr: string | null | undefined, now: Date): number | null {
  if (!dateStr) return null;
  const ms = new Date(dateStr).getTime();
  if (Number.isNaN(ms)) return null;
  return Math.floor((now.getTime() - ms) / DAY_MS);
}

export function buildFarmSuggestions(
  farm: Farm | null | undefined,
  t: TranslateFn,
  now: Date = new Date(),
): AssistantSuggestion[] {
  const today: AssistantSuggestion = {
    id: 'today',
    icon: 'sun.max.fill',
    text: t('assistant.home.suggestions.today'),
  };
  const water: AssistantSuggestion = {
    id: 'water',
    icon: 'drop.fill',
    text: t('assistant.home.suggestions.water'),
  };
  const spray: AssistantSuggestion = {
    id: 'spray',
    icon: 'leaf.fill',
    text: t('assistant.home.suggestions.spray'),
  };
  const harvest: AssistantSuggestion = {
    id: 'harvest',
    icon: 'basket.fill',
    text: t('assistant.home.suggestions.harvest'),
  };
  const weather: AssistantSuggestion = {
    id: 'weather',
    icon: 'cloud.sun.fill',
    text: t('assistant.home.suggestions.weather'),
  };

  const waterLow = farm ? isLowWater(farm) : false;
  const daysSincePruning = daysSince(farm?.date_of_pruning, now);
  const nearHarvest =
    daysSincePruning != null &&
    daysSincePruning >= HARVEST_WINDOW_MIN_DAYS &&
    daysSincePruning <= HARVEST_WINDOW_MAX_DAYS;

  // Priority order: state-driven prompts first, then dependable defaults.
  const ordered: AssistantSuggestion[] = [];
  if (waterLow) ordered.push(water);
  if (nearHarvest) ordered.push(harvest);
  ordered.push(today);
  ordered.push(spray);
  if (!waterLow) ordered.push(water);
  ordered.push(weather);

  const seen = new Set<string>();
  const result: AssistantSuggestion[] = [];
  for (const suggestion of ordered) {
    if (seen.has(suggestion.id)) continue;
    seen.add(suggestion.id);
    result.push(suggestion);
    if (result.length === 3) break;
  }
  return result;
}
