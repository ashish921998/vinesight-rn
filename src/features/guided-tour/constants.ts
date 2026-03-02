import type { GuidedTourStep } from './types';

export const GUIDED_TOUR_STORAGE_KEY = 'vinesight-guided-tour-v1';
export const GUIDED_TOUR_VERSION = 1 as const;
export const GUIDED_TOUR_TARGET_TIMEOUT_MS = 5000;
export const GUIDED_TOUR_TARGET_RETRY_MS = 250;
export const MAX_GUIDED_TOUR_TARGET_RETRIES = 20;

export const GUIDED_TOUR_TARGET_IDS = {
  ADD_FARM_PRIMARY: 'guided_tour:add_farm_primary',
  ADD_FARM_NAME: 'guided_tour:add_farm_name',
  ADD_FARM_REGION: 'guided_tour:add_farm_region',
  ADD_FARM_AREA: 'guided_tour:add_farm_area',
  ADD_FARM_CROP: 'guided_tour:add_farm_crop',
  ADD_FARM_CROP_SHEET: 'guided_tour:add_farm_crop_sheet',
  ADD_FARM_VARIETY: 'guided_tour:add_farm_variety',
  ADD_FARM_VARIETY_SHEET: 'guided_tour:add_farm_variety_sheet',
  ADD_FARM_VARIETY_OPTION: 'guided_tour:add_farm_variety_option',
  ADD_FARM_CUSTOM_VARIETY: 'guided_tour:add_farm_custom_variety',
  ADD_FARM_SUBMIT: 'guided_tour:add_farm_submit',
  ADD_LOG_PRIMARY: 'guided_tour:add_log_primary',
  ADD_LOG_TYPE_SELECTOR: 'guided_tour:add_log_type_selector',
  ADD_LOG_IRRIGATION_DURATION: 'guided_tour:add_log_irrigation_duration',
  ADD_LOG_SPRAY_DETAILS: 'guided_tour:add_log_spray_details',
  ADD_LOG_HARVEST_DETAILS: 'guided_tour:add_log_harvest_details',
  ADD_LOG_EXPENSE_DETAILS: 'guided_tour:add_log_expense_details',
  ADD_LOG_FERTIGATION_DETAILS: 'guided_tour:add_log_fertigation_details',
  ADD_LOG_ADD_ENTRY: 'guided_tour:add_log_add_entry',
  ADD_LOG_SAVE: 'guided_tour:add_log_save',
  INACTIVE_TASK_TARGET: 'guided_tour:inactive_task_target',
  START_SEASON_SHEET: 'guided_tour:start_season_sheet',
  START_SEASON_PRIMARY: 'guided_tour:start_season_primary',
  // Workers module mini-tour (overview)
  WORKERS_TAB_SELECTOR: 'workers_tour:tab_selector',
  WORKERS_FAB: 'workers_tour:fab',
  WORKERS_ATTENDANCE_TAB: 'workers_tour:attendance_tab',
  WORKERS_MARK_DAY_CELL: 'workers_tour:mark_day_cell',
  // Add Worker form sub-tour
  WORKER_FORM_NAME: 'workers_tour:form_name',
  WORKER_FORM_DAILY_RATE: 'workers_tour:form_daily_rate',
  WORKER_FORM_SAVE: 'workers_tour:form_save',
  // Settlement sub-tour
  SETTLEMENT_WORKER_PICKER: 'workers_tour:settlement_worker_picker',
  SETTLEMENT_PERIOD_SELECTOR: 'workers_tour:settlement_period_selector',
  SETTLEMENT_CALCULATE_BTN: 'workers_tour:settlement_calculate_btn',
} as const;

export type GuidedTourTargetId =
  (typeof GUIDED_TOUR_TARGET_IDS)[keyof typeof GUIDED_TOUR_TARGET_IDS];

export const GUIDED_TOUR_STEP_ORDER: GuidedTourStep[] = [
  'welcome',
  'add_farm',
  'add_log',
  'complete_card',
];

export const GUIDED_TOUR_SUPPORTED_LOCALES = ['en', 'hi', 'mr'] as const;
