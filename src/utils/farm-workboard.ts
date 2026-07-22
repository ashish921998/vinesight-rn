/**
 * Farm-detail workboard action model + pure builder.
 *
 * Extracted from `app/farm/[id].tsx` so the Simplified/Detailed gating decision
 * is testable without mounting the (large) farm-detail screen. The screen
 * supplies the resolved theme colors; this module owns *which* actions appear.
 *
 * Gating:
 *  - Simplified (`detailedMode === false`) → `['reports']` only.
 *  - Detailed → `ai + lab + reports + soil` (+ `fertilizer-plans` when the farm
 *    has a linked consultant).
 */
export type WorkboardActionId = 'ai' | 'lab' | 'reports' | 'soil' | 'fertilizer-plans';

export interface WorkboardAction {
  id: WorkboardActionId;
  titleKey: string;
  icon: string;
  color: string;
  route?: string;
}

export interface WorkboardActionColors {
  ai: string;
  lab: string;
  reports: string;
  soil: string;
  fertilizerPlans: string;
}

export function buildWorkboardActions({
  detailedMode,
  hasConsultant,
  colors,
}: {
  detailedMode: boolean;
  hasConsultant: boolean;
  colors: WorkboardActionColors;
}): WorkboardAction[] {
  const actions: WorkboardAction[] = [];

  if (detailedMode) {
    actions.push({
      id: 'ai',
      titleKey: 'farmDetails.workboard.actions.ai',
      // Match the bottom navbar AI assistant icon.
      icon: 'brain',
      color: colors.ai,
    });
    actions.push({
      id: 'lab',
      titleKey: 'farmDetails.workboard.actions.lab',
      icon: 'flask.fill',
      color: colors.lab,
    });
  }

  // Reports stays available in Simplified mode.
  actions.push({
    id: 'reports',
    titleKey: 'farmDetails.workboard.actions.reports',
    icon: 'receipt',
    color: colors.reports,
  });

  if (detailedMode) {
    actions.push({
      id: 'soil',
      titleKey: 'farmDetails.workboard.actions.soilMoisture',
      icon: 'square.stack.3d.up.fill',
      color: colors.soil,
    });
    if (hasConsultant) {
      actions.push({
        id: 'fertilizer-plans',
        titleKey: 'farmDetails.fertilizerPlan.title',
        icon: 'leaf.fill',
        color: colors.fertilizerPlans,
      });
    }
  }

  return actions;
}
