/**
 * Calculator Models
 * TypeScript enums and types for vineyard calculations
 * Ported from iOS CalculatorModels.swift
 */

import { ICON_REGISTRY } from './icon-registry';

// ============================================================
// MARK: - Water Growth Stages with Kc Values (FAO-56 Standard)
// ============================================================

export type WaterGrowthStageId =
  | 'beginningBudbreak'
  | 'shoot30cm'
  | 'shoot50cm'
  | 'shoot80cm'
  | 'beginningBloom'
  | 'fruitSet'
  | 'berry6to8mm'
  | 'berry12mm'
  | 'closingBunches'
  | 'beginningVeraison'
  | 'beginningHarvest'
  | 'endHarvest'
  | 'afterHarvest';

export interface WaterGrowthStage {
  id: WaterGrowthStageId;
  label: string;
  kc: number;
}

export const WATER_GROWTH_STAGES: WaterGrowthStage[] = [
  { id: 'beginningBudbreak', label: 'Beginning Budbreak', kc: 0.25 },
  { id: 'shoot30cm', label: 'Shoot 30cm', kc: 0.3 },
  { id: 'shoot50cm', label: 'Shoot 50cm', kc: 0.4 },
  { id: 'shoot80cm', label: 'Shoot 80cm', kc: 0.5 },
  { id: 'beginningBloom', label: 'Beginning Bloom', kc: 0.6 },
  { id: 'fruitSet', label: 'Fruit Set', kc: 0.7 },
  { id: 'berry6to8mm', label: 'Berry 6-8mm', kc: 0.8 },
  { id: 'berry12mm', label: 'Berry 12mm', kc: 0.85 },
  { id: 'closingBunches', label: 'Closing Bunches', kc: 1.0 },
  { id: 'beginningVeraison', label: 'Beginning Veraison', kc: 1.0 },
  { id: 'beginningHarvest', label: 'Beginning Harvest', kc: 0.8 },
  { id: 'endHarvest', label: 'End Harvest', kc: 0.6 },
  { id: 'afterHarvest', label: 'After Harvest', kc: 0.5 },
];

export function getGrowthStageDisplayText(stage: WaterGrowthStage): string {
  return `${stage.label} (Kc: ${stage.kc.toFixed(2)})`;
}

// ============================================================
// MARK: - Water Status Classification
// ============================================================

export type WaterStatusLevel = 'critical' | 'low' | 'medium' | 'good';

export interface WaterStatus {
  level: WaterStatusLevel;
  label: string;
  message: string;
  icon: string;
  color: string;
}

export function getWaterStatus(waterLevel: number): WaterStatus {
  if (waterLevel < 6) {
    return {
      level: 'critical',
      label: 'Critical',
      message: 'IRRIGATION NEEDED - Water level critical!',
      icon: ICON_REGISTRY.alertCircle,
      color: '#db4437',
    };
  } else if (waterLevel < 10) {
    return {
      level: 'low',
      label: 'Low',
      message: 'Low water level - consider irrigation soon',
      icon: ICON_REGISTRY.alertCircleOutline,
      color: '#ea8600',
    };
  } else if (waterLevel < 25) {
    return {
      level: 'medium',
      label: 'Medium',
      message: 'Medium water level - monitor closely',
      icon: ICON_REGISTRY.waterOutline,
      color: '#f9a825',
    };
  } else {
    return {
      level: 'good',
      label: 'Good',
      message: 'Good water level',
      icon: ICON_REGISTRY.checkmarkCircle,
      color: '#0b8d32',
    };
  }
}

// ============================================================
// MARK: - Grape Growth Stages (for nutrients)
// ============================================================

export type GrapeGrowthStageId =
  | 'dormant'
  | 'budbreak'
  | 'flowering'
  | 'fruitSet'
  | 'veraison'
  | 'harvest'
  | 'postHarvest';

export interface GrapeGrowthStage {
  id: GrapeGrowthStageId;
  label: string;
  kc: number;
  seasonalFactor: number;
  nitrogenFactor: number;
  phosphorusFactor: number;
  potassiumFactor: number;
}

export const GRAPE_GROWTH_STAGES: GrapeGrowthStage[] = [
  {
    id: 'dormant',
    label: 'Dormant',
    kc: 0.15,
    seasonalFactor: 0.2,
    nitrogenFactor: 0.2,
    phosphorusFactor: 0.1,
    potassiumFactor: 0.3,
  },
  {
    id: 'budbreak',
    label: 'Bud Break',
    kc: 0.3,
    seasonalFactor: 0.5,
    nitrogenFactor: 2.5,
    phosphorusFactor: 0.8,
    potassiumFactor: 3.5,
  },
  {
    id: 'flowering',
    label: 'Flowering',
    kc: 0.7,
    seasonalFactor: 0.7,
    nitrogenFactor: 4.5,
    phosphorusFactor: 1.2,
    potassiumFactor: 5.5,
  },
  {
    id: 'fruitSet',
    label: 'Fruit Set',
    kc: 0.95,
    seasonalFactor: 0.85,
    nitrogenFactor: 6.0,
    phosphorusFactor: 1.8,
    potassiumFactor: 8.0,
  },
  {
    id: 'veraison',
    label: 'Veraison',
    kc: 0.85,
    seasonalFactor: 1.0,
    nitrogenFactor: 3.5,
    phosphorusFactor: 1.0,
    potassiumFactor: 6.5,
  },
  {
    id: 'harvest',
    label: 'Harvest',
    kc: 0.45,
    seasonalFactor: 0.9,
    nitrogenFactor: 1.5,
    phosphorusFactor: 0.5,
    potassiumFactor: 2.5,
  },
  {
    id: 'postHarvest',
    label: 'Post Harvest',
    kc: 0.6,
    seasonalFactor: 0.6,
    nitrogenFactor: 2.0,
    phosphorusFactor: 0.6,
    potassiumFactor: 3.0,
  },
];

// ============================================================
// MARK: - Irrigation Methods
// ============================================================

export type IrrigationMethodId = 'drip' | 'sprinkler' | 'surface';

export interface IrrigationMethod {
  id: IrrigationMethodId;
  label: string;
  efficiencyFactor: number;
}

export const IRRIGATION_METHODS: IrrigationMethod[] = [
  { id: 'drip', label: 'Drip Irrigation', efficiencyFactor: 0.5 },
  { id: 'sprinkler', label: 'Sprinkler', efficiencyFactor: 0.7 },
  { id: 'surface', label: 'Surface/Flood', efficiencyFactor: 1.2 },
];

// ============================================================
// MARK: - Soil Types
// ============================================================

export type SoilTypeId = 'sandy' | 'loamy' | 'clay';

export interface SoilType {
  id: SoilTypeId;
  label: string;
  durationMultiplier: number;
  waterRetentionMin: number;
  waterRetentionMax: number;
}

export const SOIL_TYPES: SoilType[] = [
  {
    id: 'sandy',
    label: 'Sandy',
    durationMultiplier: 1.2,
    waterRetentionMin: 10,
    waterRetentionMax: 15,
  },
  {
    id: 'loamy',
    label: 'Loamy',
    durationMultiplier: 1.0,
    waterRetentionMin: 15,
    waterRetentionMax: 20,
  },
  {
    id: 'clay',
    label: 'Clay',
    durationMultiplier: 0.8,
    waterRetentionMin: 20,
    waterRetentionMax: 25,
  },
];

// ============================================================
// MARK: - Refill Span Options (MAD Calculator)
// ============================================================

export type RefillSpanId = 'heavyGrowth' | 'normalGrowth' | 'controlledStress';

export interface RefillSpan {
  id: RefillSpanId;
  label: string;
  value: number;
}

export const REFILL_SPANS: RefillSpan[] = [
  { id: 'heavyGrowth', label: 'Heavy Growth Period 50% (0.2)', value: 0.2 },
  { id: 'normalGrowth', label: 'Growth Period 40% (0.3)', value: 0.3 },
  { id: 'controlledStress', label: 'Controlled Stress 30% (0.4)', value: 0.4 },
];

// ============================================================
// MARK: - Log Types
// ============================================================

export type LogTypeId = 'irrigation' | 'spray' | 'harvest' | 'expense' | 'fertigation' | 'note';

export interface LogType {
  id: LogTypeId;
  labelKey: string;
  icon: string;
  color: string;
}

export const LOG_TYPES: LogType[] = [
  {
    id: 'irrigation',
    labelKey: 'logs.types.irrigation',
    icon: ICON_REGISTRY.irrigation,
    color: '#4d8573',
  },
  { id: 'spray', labelKey: 'logs.types.spray', icon: ICON_REGISTRY.spray, color: '#598d6b' },
  { id: 'harvest', labelKey: 'logs.types.harvest', icon: ICON_REGISTRY.harvest, color: '#669475' },
  { id: 'expense', labelKey: 'logs.types.expense', icon: ICON_REGISTRY.expense, color: '#598066' },
  {
    id: 'fertigation',
    labelKey: 'logs.types.fertigation',
    icon: ICON_REGISTRY.fertigation,
    color: '#408059',
  },
  { id: 'note', labelKey: 'logs.types.note', icon: ICON_REGISTRY.note, color: '#738c7a' },
];

export function getLogType(id: LogTypeId): LogType {
  return LOG_TYPES.find((lt) => lt.id === id) ?? LOG_TYPES[0];
}

// ============================================================
// MARK: - Expense Types
// ============================================================

export const EXPENSE_TYPES = [
  'Equipment',
  'Fuel',
  'Seeds/Plants',
  'Packaging',
  'Transport',
  'Maintenance',
  'Other',
] as const;

export type ExpenseTypeId = (typeof EXPENSE_TYPES)[number];

// ============================================================
// MARK: - Harvest Grades
// ============================================================

export const HARVEST_GRADES = [
  'A',
  'B',
  'C',
  'Export Quality',
  'Premium',
  'Standard',
  'Reject',
] as const;

export type HarvestGrade = (typeof HARVEST_GRADES)[number];

// ============================================================
// MARK: - Chemical Units
// ============================================================

export const CHEMICAL_UNITS = ['gm/L', 'ml/L', 'gm/acre', 'ml/acre', 'ppm'] as const;
export type ChemicalUnit = (typeof CHEMICAL_UNITS)[number];

// ============================================================
// MARK: - Fertilizer Units
// ============================================================

export const FERTILIZER_UNITS = ['kg/acre', 'liter/acre'] as const;
export type FertilizerUnit = (typeof FERTILIZER_UNITS)[number];

// ============================================================
// MARK: - Soil Texture Classes
// ============================================================

export const SOIL_TEXTURE_CLASSES = [
  'Sand',
  'Loamy sand',
  'Sandy loam',
  'Loam',
  'Silt loam',
  'Silt',
  'Sandy clay loam',
  'Clay loam',
  'Silty clay loam',
  'Sandy clay',
  'Silty clay',
  'Clay',
] as const;

export type SoilTextureClass = (typeof SOIL_TEXTURE_CLASSES)[number];

// ============================================================
// MARK: - Currency Options
// ============================================================

export interface CurrencyOption {
  code: string;
  symbol: string;
  label: string;
}

export const CURRENCIES: CurrencyOption[] = [
  { code: 'INR', symbol: '₹', label: 'INR (₹)' },
  { code: 'USD', symbol: '$', label: 'USD ($)' },
  { code: 'EUR', symbol: '€', label: 'EUR (€)' },
  { code: 'GBP', symbol: '£', label: 'GBP (£)' },
  { code: 'AUD', symbol: '$', label: 'AUD ($)' },
  { code: 'CAD', symbol: '$', label: 'CAD ($)' },
];

// ============================================================
// MARK: - Area Units
// ============================================================

export interface AreaUnit {
  id: string;
  label: string;
  conversionToHectares: number;
}

export const AREA_UNITS: AreaUnit[] = [
  { id: 'acres', label: 'Acres', conversionToHectares: 0.404686 },
  { id: 'hectares', label: 'Hectares', conversionToHectares: 1 },
];
