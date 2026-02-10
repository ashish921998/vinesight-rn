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
}

export interface VoiceLogFertilizerItem {
  name: string;
  quantity: number | null;
  unit: string | null;
}

export interface VoiceLogDraft {
  type: VoiceLogActivityType;
  farmId: number | null;
  farmName: string | null;
  date: string;
  irrigation: {
    durationHours: number | null;
  };
  spray: {
    waterVolume: number | null;
    chemicals: VoiceLogChemicalItem[];
  };
  harvest: {
    quantity: number | null;
    grade: string | null;
    price: number | null;
    buyer: string | null;
  };
  expense: {
    cost: number | null;
    expenseType: string | null;
    remarks: string | null;
  };
  fertigation: {
    waterVolume: number | null;
    fertilizers: VoiceLogFertilizerItem[];
  };
}

export interface ActivityLogExtractionResult {
  intent: 'log_activity' | 'none';
  activityType: VoiceLogActivityType | null;
  cancel: boolean;
  farmName: string | null;
  dateIso: string | null;
  dateRelative: 'today' | 'yesterday' | null;
  confidence: number;
  irrigation: {
    durationHours: number | null;
  };
  spray: {
    waterVolume: number | null;
    chemicals: VoiceLogChemicalItem[];
  };
  harvest: {
    quantity: number | null;
    grade: string | null;
    price: number | null;
    buyer: string | null;
  };
  expense: {
    cost: number | null;
    expenseType: string | null;
    remarks: string | null;
  };
  fertigation: {
    waterVolume: number | null;
    fertilizers: VoiceLogFertilizerItem[];
  };
}

export interface VoiceLogFormPrefill {
  type: VoiceLogActivityType;
  date: string;
  irrigation?: {
    durationHours: number | null;
  };
  spray?: {
    waterVolume: number | null;
    chemicals: VoiceLogChemicalItem[];
  };
  harvest?: {
    quantity: number | null;
    grade: string | null;
    price: number | null;
    buyer: string | null;
  };
  expense?: {
    cost: number | null;
    expenseType: string | null;
    remarks: string | null;
  };
  fertigation?: {
    waterVolume: number | null;
    fertilizers: VoiceLogFertilizerItem[];
  };
}
