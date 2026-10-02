/**
 * Farm Form – pure utility functions
 */

import type { Farm, FarmInsert } from '@/types';
import type { CropType } from '@/constants/crop-varieties';
import { CROP_VARIETIES } from '@/constants/crop-varieties';
import { KNOWN_CROPS } from './constants';
import type { KnownCrop } from '@/utils/farm-crop-visuals';

export interface FarmCoreFields {
  name: string;
  region: string;
  area: string;
  selectedCrop: CropType;
  customCropName: string;
  cropVariety: string;
  customVariety: string;
}

// ---------------------------------------------------------------------------
// Crop selection helpers
// ---------------------------------------------------------------------------

export const resolveCropSelection = (
  crop?: string | null,
): { selectedCrop: CropType; customCropName: string } => {
  const normalized = crop?.trim();
  if (!normalized) {
    return { selectedCrop: 'Grapes', customCropName: '' };
  }
  // Special case: existing records that store the sentinel string 'Other'
  if (normalized === 'Other') {
    return { selectedCrop: 'Other', customCropName: '' };
  }
  if (KNOWN_CROPS.includes(normalized as KnownCrop)) {
    return { selectedCrop: normalized as KnownCrop, customCropName: '' };
  }
  return { selectedCrop: 'Other', customCropName: normalized };
};

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

export const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseDbDateToLocalDate = (value: string): Date => {
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]) - 1;
    const day = Number(dateOnlyMatch[3]);
    const date = new Date(year, month, day);
    if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
      return new Date();
    }
    return date;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

export const ensureValidDate = (value: Date | undefined | null): Date => {
  if (!value) return new Date();
  return Number.isNaN(value.getTime()) ? new Date() : value;
};

// ---------------------------------------------------------------------------
// Input helpers
// ---------------------------------------------------------------------------

export const sanitizeDecimalInput = (value: string): string => {
  // Convert a comma to a period first. A comma-locale keypad (for example an
  // Android decimal-pad on an en-ZA device) sends "," as the decimal separator.
  // Stripping it would silently delete the decimal point.
  const normalized = value.replace(/,/g, '.');
  const digitsAndDotOnly = normalized.replace(/[^0-9.]/g, '');
  const firstDotIndex = digitsAndDotOnly.indexOf('.');
  if (firstDotIndex === -1) return digitsAndDotOnly;
  const whole = digitsAndDotOnly.substring(0, firstDotIndex);
  const decimal = digitsAndDotOnly.substring(firstDotIndex + 1).replace(/\./g, '');
  return `${whole}.${decimal}`;
};

export const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
};

export const resolveFarmCoreSelection = ({
  selectedCrop,
  customCropName,
  cropVariety,
  customVariety,
}: Pick<FarmCoreFields, 'selectedCrop' | 'customCropName' | 'cropVariety' | 'customVariety'>) => ({
  crop: selectedCrop === 'Other' ? customCropName.trim() : selectedCrop,
  variety: cropVariety === 'Custom' ? customVariety.trim() : cropVariety.trim(),
});

// Quick-create core: a first-time farmer needs only a name, crop, and area to
// create a farm. Region and variety are optional and deferred behind the
// collapsible "Add agronomy details" section — they send safe empty-string
// defaults on insert (see buildFarmInsertFromCoreFields) rather than blocking
// the Save button.
export type FarmCoreFieldError = 'name' | 'area' | 'customCrop';

// Returns the first required field that fails validation, or null when the core
// fields are valid. The view uses this to show an inline error and focus the
// field instead of leaving the Create Farm button silently disabled.
export const getFarmCoreFieldError = ({
  name,
  area,
  selectedCrop,
  customCropName,
}: FarmCoreFields): FarmCoreFieldError | null => {
  if (!name.trim()) return 'name';
  const areaValue = Number(area);
  if (!Number.isFinite(areaValue) || areaValue <= 0) return 'area';
  if (selectedCrop === 'Other' && !customCropName.trim()) return 'customCrop';
  return null;
};

export const isFarmCoreFieldsValid = (fields: FarmCoreFields): boolean =>
  getFarmCoreFieldError(fields) === null;

export const buildFarmInsertFromCoreFields = (
  fields: FarmCoreFields,
  plantingDate: Date = new Date(),
): FarmInsert | null => {
  if (!isFarmCoreFieldsValid(fields)) return null;

  const areaValue = Number(fields.area);
  if (!Number.isFinite(areaValue) || areaValue <= 0) return null;

  const { crop, variety } = resolveFarmCoreSelection(fields);
  // crop is guaranteed non-empty by validation; variety/region may be blank for
  // a quick-create farm. They are NOT nullable in the Farm type, so send safe
  // empty-string defaults rather than undefined (the live DB nullability is
  // unknown — there is no CREATE TABLE farms migration in the repo).
  if (!crop) return null;

  return {
    name: fields.name.trim(),
    region: fields.region.trim() || '',
    area: areaValue,
    crop,
    crop_variety: variety || '',
    planting_date: formatLocalDate(ensureValidDate(plantingDate)),
  };
};

// ---------------------------------------------------------------------------
// Form state builder
// ---------------------------------------------------------------------------

export const buildFormStateFromFarm = (farm?: Farm | null) => {
  const { selectedCrop, customCropName } = resolveCropSelection(farm?.crop);
  const predefinedVarieties = CROP_VARIETIES[selectedCrop] ?? [];
  const farmVariety = farm?.crop_variety;
  const isCustomVariety = farmVariety && !predefinedVarieties.includes(farmVariety);

  return {
    selectedCrop,
    customCropName,
    name: farm?.name ?? '',
    region: farm?.region ?? '',
    area: farm?.area?.toString() ?? '',
    // Preserve saved custom varieties as the selected value so the picker can
    // restore and highlight them on edit.
    cropVariety: farmVariety ?? '',
    customVariety: isCustomVariety ? farmVariety : '',
    cropSearchQuery: '',
    varietySearchQuery: '',
    plantingDate: farm?.planting_date ? parseDbDateToLocalDate(farm.planting_date) : new Date(),
    vineSpacing: farm?.vine_spacing?.toString() ?? '',
    rowSpacing: farm?.row_spacing?.toString() ?? '',
    totalTankCapacity: farm?.total_tank_capacity?.toString() ?? '',
    systemDischarge: farm?.system_discharge?.toString() ?? '',
    dateOfPruning: farm?.date_of_pruning ? parseDbDateToLocalDate(farm.date_of_pruning) : null,
    locationName: farm?.location_name ?? '',
    latitude: farm?.latitude?.toString() ?? '',
    longitude: farm?.longitude?.toString() ?? '',
    elevation: farm?.elevation?.toString() ?? '',
    bulkDensity: farm?.bulk_density?.toString() ?? '',
    cationExchangeCapacity: farm?.cation_exchange_capacity?.toString() ?? '',
    soilWaterRetention: farm?.soil_water_retention?.toString() ?? '',
    soilTextureClass: farm?.soil_texture_class ?? '',
    sandPercentage: farm?.sand_percentage?.toString() ?? '',
    siltPercentage: farm?.silt_percentage?.toString() ?? '',
    clayPercentage: farm?.clay_percentage?.toString() ?? '',
    showDatePicker: false,
    showPruningDatePicker: false,
    showVarietyPicker: false,
    showCropPicker: false,
    showMapPicker: false,
    plantingDateChanged: false,
  };
};
