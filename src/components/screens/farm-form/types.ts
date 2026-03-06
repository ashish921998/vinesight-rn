/**
 * Farm Form – shared types
 */

export type FarmFormMode = 'add' | 'edit';

export interface FarmFormProps {
  mode: FarmFormMode;
  farmId?: number;
  onClose: () => void;
}

export type AddFarmFocusField = 'name' | 'region' | 'area';

// Derived from buildFormStateFromFarm return shape – kept in sync manually.
// Using a lazy import type avoids circular deps between types.ts <-> utils.ts.
export type FormState = {
  selectedCrop: import('@/constants/crop-varieties').CropType;
  customCropName: string;
  name: string;
  region: string;
  area: string;
  cropVariety: string;
  customVariety: string;
  cropSearchQuery: string;
  varietySearchQuery: string;
  plantingDate: Date;
  vineSpacing: string;
  rowSpacing: string;
  totalTankCapacity: string;
  systemDischarge: string;
  dateOfPruning: Date | null;
  locationName: string;
  latitude: string;
  longitude: string;
  elevation: string;
  bulkDensity: string;
  cationExchangeCapacity: string;
  soilWaterRetention: string;
  soilTextureClass: string;
  sandPercentage: string;
  siltPercentage: string;
  clayPercentage: string;
  showDatePicker: boolean;
  showPruningDatePicker: boolean;
  showVarietyPicker: boolean;
  showCropPicker: boolean;
  showTexturePicker: boolean;
  showMapPicker: boolean;
  plantingDateChanged: boolean;
};
