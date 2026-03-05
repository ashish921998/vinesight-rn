/**
 * Farm Form – pure utility functions
 */

import type { Farm } from '@/types';
import type { CropType } from '@/constants/crop-varieties';
import { KNOWN_CROPS } from './constants';
import type { KnownCrop } from '@/utils/farm-crop-visuals';

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
    const month = Number(dateOnlyMatch[2]);
    const day = Number(dateOnlyMatch[3]);
    return new Date(year, month - 1, day);
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
  const digitsAndDotOnly = value.replace(/[^0-9.]/g, '');
  const parts = digitsAndDotOnly.split('.');
  if (parts.length <= 1) return parts[0] || '';
  return `${parts[0]}.${parts.slice(1).join('')}`;
};

export const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
};

// ---------------------------------------------------------------------------
// Form state builder
// ---------------------------------------------------------------------------

export const buildFormStateFromFarm = (farm?: Farm | null) => ({
  ...resolveCropSelection(farm?.crop),
  name: farm?.name ?? '',
  region: farm?.region ?? '',
  area: farm?.area?.toString() ?? '',
  cropVariety: farm?.crop_variety ?? '',
  customVariety: '',
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
  showTexturePicker: false,
  showMapPicker: false,
  plantingDateChanged: false,
});
