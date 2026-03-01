export type GuidedTourStatus = 'not_started' | 'in_progress' | 'complete' | 'skipped' | 'expired';

export type GuidedTourStep = 'welcome' | 'add_farm' | 'add_log' | 'complete_card';

export type GuidedTourRenderableStep = 'welcome' | 'add_farm' | 'add_log' | 'complete_card' | null;

export interface GuidedTourServerState {
  tour_status: GuidedTourStatus;
  current_step: GuidedTourStep;
  skipped_at_step: GuidedTourStep | null;
  reminders_sent: 0 | 1 | 2;
  tour_started_at: string | null;
  tour_completed_at: string | null;
  tour_expired_at: string | null;
  last_active_at: string | null;
  active_farm_id: number | null;
  locale: 'en' | 'hi' | 'mr';
  tour_version: number;
  updated_at?: string | null;
}

export interface GuidedTourState {
  status: GuidedTourStatus;
  currentStep: GuidedTourStep;
  skippedAtStep: GuidedTourStep | null;
  remindersSent: 0 | 1 | 2;
  startedAt: string | null;
  completedAt: string | null;
  expiredAt: string | null;
  lastActiveAt: string | null;
  stepShownAt: string | null;
  activeFarmId: number | null;
  hasSeenWelcomeThisSession: boolean;
  hasHydrated: boolean;
  version: 1;
}

export interface GuidedTourPatchPayload {
  tour_status?: GuidedTourStatus;
  current_step?: GuidedTourStep;
  skipped_at_step?: GuidedTourStep | null;
  reminders_sent?: 0 | 1 | 2;
  tour_started_at?: string | null;
  tour_completed_at?: string | null;
  tour_expired_at?: string | null;
  last_active_at?: string | null;
  active_farm_id?: number | null;
  locale?: 'en' | 'hi' | 'mr';
  tour_version?: number;
  clear_nullable_fields?: boolean;
}

export interface GuidedTourStepMeta {
  farmId?: number | null;
}
