import type { QuantityBasis } from './database';
export type VoiceLogActivityType = 'irrigation' | 'spray' | 'harvest' | 'expense' | 'fertigation';

export type VoiceLogOriginContext = 'dashboard' | 'farm';

export type VoiceLogMissingField =
  | 'farm'
  | 'duration'
  | 'waterVolume'
  | 'chemicals'
  | 'quantity'
  | 'grade'
  | 'cost'
  | 'expenseType'
  | 'fertilizers';

export interface VoiceLogChemicalItem {
  name: string;
  quantity: number | null;
  unit: string | null;
  quantityBasis?: QuantityBasis | null;
}

export interface VoiceLogFertilizerItem {
  name: string;
  quantity: number | null;
  unit: string | null;
  quantityBasis?: QuantityBasis | null;
}

export interface IrrigationData {
  durationHours: number | null;
}

export interface SprayData {
  waterVolume: number | null;
  chemicals: VoiceLogChemicalItem[];
}

export interface HarvestData {
  quantity: number | null;
  grade: string | null;
  price: number | null;
  buyer: string | null;
}

export interface ExpenseData {
  cost: number | null;
  expenseType: string | null;
  remarks: string | null;
}

export interface FertigationData {
  waterVolume: number | null;
  fertilizers: VoiceLogFertilizerItem[];
}

export interface VoiceLogDraft {
  type: VoiceLogActivityType;
  farmId: number | null;
  farmName: string | null;
  date: string;
  irrigation: IrrigationData;
  spray: SprayData;
  harvest: HarvestData;
  expense: ExpenseData;
  fertigation: FertigationData;
}

export interface ActivityLogExtractionResult {
  intent: 'log_activity' | 'query_history' | 'advisory' | 'none';
  intentConfidence: number;
  activityType: VoiceLogActivityType | null;
  cancel: boolean;
  farmName: string | null;
  dateIso: string | null;
  dateRelative: 'today' | 'yesterday' | null;
  confidence: number;
  irrigation: IrrigationData;
  spray: SprayData;
  harvest: HarvestData;
  expense: ExpenseData;
  fertigation: FertigationData;
}

export interface VoiceLogFormPrefill {
  type: VoiceLogActivityType;
  date: string;
  irrigation?: IrrigationData;
  spray?: SprayData;
  harvest?: HarvestData;
  expense?: ExpenseData;
  fertigation?: FertigationData;
}
