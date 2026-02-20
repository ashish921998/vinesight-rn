/**
 * Farm Form
 * Shared add/edit form for farms.
 */

import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
  Keyboard,
  KeyboardAvoidingView,
} from 'react-native';
import { Symbol as UISymbol } from '@/components/ui/symbol';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import {
  useCreateFarm,
  useFarm,
  useUpdateFarm,
  isIOS,
  useResponsiveHeight,
  useAndroidKeyboardLift,
} from '@/hooks';
import { CROP_VARIETIES, CROPS, type CropType } from '@/constants/crop-varieties';
import type { Farm, FarmInsert, FarmUpdate } from '@/types';
import { useTranslation } from 'react-i18next';
import {
  FullScreenForm,
  SectionHeader,
  FormInput,
  InfoCard,
  Button,
  CropIcon,
  ModalBackdrop,
} from '@/components/ui';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { useM3, useThemeColors } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import LocationPicker from './location-picker';
import { formatDate } from '@/i18n/format';
import { telemetry } from '@/services/telemetry';
import * as Sentry from '@sentry/react-native';
import { getFarmErrorMeta, shouldCaptureFarmErrorInSentry } from '@/utils/farm-error-utils';
import { triggerHapticSuccess } from '@/utils/haptics';
import {
  NUMERIC_6_4_MAX_ABS,
  validateAndParseOptionalFarmNumbers,
} from '@/utils/farm-form-submit-validation';
import { getCropVisual, type KnownCrop } from '@/utils/farm-crop-visuals';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SOIL_TEXTURE_OPTIONS = [
  { value: 'Sand', labelKey: 'farmForm.soilTexture.options.sand' },
  { value: 'Loamy sand', labelKey: 'farmForm.soilTexture.options.loamySand' },
  { value: 'Sandy loam', labelKey: 'farmForm.soilTexture.options.sandyLoam' },
  { value: 'Loam', labelKey: 'farmForm.soilTexture.options.loam' },
  { value: 'Silt loam', labelKey: 'farmForm.soilTexture.options.siltLoam' },
  { value: 'Silt', labelKey: 'farmForm.soilTexture.options.silt' },
  { value: 'Sandy clay loam', labelKey: 'farmForm.soilTexture.options.sandyClayLoam' },
  { value: 'Clay loam', labelKey: 'farmForm.soilTexture.options.clayLoam' },
  { value: 'Silty clay loam', labelKey: 'farmForm.soilTexture.options.siltyClayLoam' },
  { value: 'Sandy clay', labelKey: 'farmForm.soilTexture.options.sandyClay' },
  { value: 'Silty clay', labelKey: 'farmForm.soilTexture.options.siltyClay' },
  { value: 'Clay', labelKey: 'farmForm.soilTexture.options.clay' },
] as const;

type FarmFormMode = 'add' | 'edit';

interface FarmFormProps {
  mode: FarmFormMode;
  farmId?: number;
  onClose: () => void;
}

const KNOWN_CROPS = CROPS.filter((crop): crop is KnownCrop => crop !== 'Other');
const POPULAR_CROPS: KnownCrop[] = [
  'Grapes',
  'Mango',
  'Banana',
  'Tomato',
  'Sugarcane',
  'Guava',
  'Pomegranate',
  'Citrus',
];

const CROP_I18N_KEY_MAP: Partial<Record<KnownCrop, { labelKey: string; sublabelKey: string }>> = {
  Grapes: {
    labelKey: 'farmForm.cropOptions.grapes.label',
    sublabelKey: 'farmForm.cropOptions.grapes.sublabel',
  },
  Mango: {
    labelKey: 'farmForm.cropOptions.mango.label',
    sublabelKey: 'farmForm.cropOptions.mango.sublabel',
  },
  Pomegranate: {
    labelKey: 'farmForm.cropOptions.pomegranate.label',
    sublabelKey: 'farmForm.cropOptions.pomegranate.sublabel',
  },
  Citrus: {
    labelKey: 'farmForm.cropOptions.citrus.label',
    sublabelKey: 'farmForm.cropOptions.citrus.sublabel',
  },
  Banana: {
    labelKey: 'farmForm.cropOptions.banana.label',
    sublabelKey: 'farmForm.cropOptions.banana.sublabel',
  },
};

const resolveCropSelection = (
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

const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDbDateToLocalDate = (value: string): Date => {
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

const ensureValidDate = (value: Date | undefined | null): Date => {
  if (!value) return new Date();
  return Number.isNaN(value.getTime()) ? new Date() : value;
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
};

const buildFormStateFromFarm = (farm?: Farm | null) => ({
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

type FormState = ReturnType<typeof buildFormStateFromFarm>;

export function FarmForm({ mode, farmId, onClose }: FarmFormProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const m3 = useM3();
  const insets = useSafeAreaInsets();
  const { windowHeight } = useResponsiveHeight();

  const isEdit = mode === 'edit';
  const createFarm = useCreateFarm();
  const updateFarm = useUpdateFarm();
  const { data: farm, isLoading: farmLoading } = useFarm(isEdit ? farmId : undefined);
  const initializedFarmIdRef = useRef<number | null>(null);

  const [formState, setFormState] = useState<FormState>(() =>
    isEdit && farm ? buildFormStateFromFarm(farm) : buildFormStateFromFarm(undefined),
  );
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [iosPlantingDateDraft, setIosPlantingDateDraft] = useState<Date>(() => new Date());
  const [iosPruningDateDraft, setIosPruningDateDraft] = useState<Date>(() => new Date());
  const nameInputRef = useRef<TextInput>(null);
  const regionInputRef = useRef<TextInput>(null);
  const areaInputRef = useRef<TextInput>(null);
  const customCropInputRef = useRef<TextInput>(null);
  const customVarietyInputRef = useRef<TextInput>(null);
  const vineSpacingInputRef = useRef<TextInput>(null);
  const rowSpacingInputRef = useRef<TextInput>(null);
  const tankCapacityInputRef = useRef<TextInput>(null);
  const systemDischargeInputRef = useRef<TextInput>(null);
  const locationNameInputRef = useRef<TextInput>(null);
  const latitudeInputRef = useRef<TextInput>(null);
  const longitudeInputRef = useRef<TextInput>(null);
  const elevationInputRef = useRef<TextInput>(null);
  const bulkDensityInputRef = useRef<TextInput>(null);
  const cecInputRef = useRef<TextInput>(null);
  const soilWaterRetentionInputRef = useRef<TextInput>(null);
  const sandInputRef = useRef<TextInput>(null);
  const siltInputRef = useRef<TextInput>(null);
  const clayInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!isEdit) {
      initializedFarmIdRef.current = null;
      return;
    }
    if (!farmId || !farm) return;
    if (initializedFarmIdRef.current === farmId) return;

    initializedFarmIdRef.current = farmId;
    const timer = setTimeout(() => {
      setFormState(buildFormStateFromFarm(farm));
    }, 0);
    return () => clearTimeout(timer);
  }, [farm, farmId, isEdit]);

  useEffect(() => {
    const showEvent = isIOS ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = isIOS ? 'keyboardWillHide' : 'keyboardDidHide';

    const keyboardShowListener = Keyboard.addListener(showEvent, (event) => {
      const keyboardInset = isIOS ? insets.bottom : 0;
      const nextHeight = Math.max(0, event.endCoordinates.height - keyboardInset);
      setKeyboardHeight(nextHeight);
    });

    const keyboardHideListener = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      keyboardShowListener.remove();
      keyboardHideListener.remove();
    };
  }, [insets.bottom]);

  const varieties = useMemo(
    () =>
      formState.selectedCrop === 'Other'
        ? ['Custom']
        : (CROP_VARIETIES[formState.selectedCrop] ?? ['Custom']),
    [formState.selectedCrop],
  );

  interface KnownCropOption {
    value: KnownCrop;
    label: string;
    sublabel: string;
  }

  const knownCropOptions: KnownCropOption[] = useMemo(
    () =>
      KNOWN_CROPS.map((crop) => {
        const keys = CROP_I18N_KEY_MAP[crop];
        return {
          value: crop,
          label: keys ? t(keys.labelKey) : crop,
          sublabel: keys ? t(keys.sublabelKey) : t('farmForm.cropPicker.defaultSublabel'),
        };
      }),
    [t],
  );

  const popularCropOptions = useMemo(
    () => knownCropOptions.filter((option) => POPULAR_CROPS.includes(option.value)),
    [knownCropOptions],
  );

  const cropSearchQueryTrimmed = formState.cropSearchQuery.trim();
  const cropSearchQueryLower = cropSearchQueryTrimmed.toLowerCase();
  const varietySearchQueryTrimmed = formState.varietySearchQuery.trim();
  const varietySearchQueryLower = varietySearchQueryTrimmed.toLowerCase();

  const filteredCropOptions = useMemo(() => {
    if (!cropSearchQueryLower) return knownCropOptions;
    return knownCropOptions.filter(
      (option) =>
        option.label.toLowerCase().includes(cropSearchQueryLower) ||
        option.value.toLowerCase().includes(cropSearchQueryLower),
    );
  }, [cropSearchQueryLower, knownCropOptions]);

  const canCreateCustomCrop = useMemo(() => {
    if (!cropSearchQueryTrimmed) return false;
    return !knownCropOptions.some(
      (option) =>
        option.value.toLowerCase() === cropSearchQueryLower ||
        option.label.toLowerCase() === cropSearchQueryLower,
    );
  }, [cropSearchQueryLower, cropSearchQueryTrimmed, knownCropOptions]);

  const filteredVarieties = useMemo(() => {
    if (!varietySearchQueryLower) return varieties;
    return varieties.filter((variety) => variety.toLowerCase().includes(varietySearchQueryLower));
  }, [varieties, varietySearchQueryLower]);

  const canCreateCustomVariety = useMemo(() => {
    if (!varietySearchQueryTrimmed) return false;
    return !varieties.some((variety) => variety.toLowerCase() === varietySearchQueryLower);
  }, [varietySearchQueryLower, varietySearchQueryTrimmed, varieties]);

  const popularVarieties = useMemo(() => {
    const nonCustom = varieties.filter((v) => v !== 'Custom');
    return nonCustom.slice(0, 5);
  }, [varieties]);

  const selectedCropLabel = useMemo(() => {
    if (formState.selectedCrop === 'Other') {
      return formState.customCropName.trim() || t('farmForm.cropPicker.customCropLabel');
    }
    const selected = knownCropOptions.find((option) => option.value === formState.selectedCrop);
    return selected?.label ?? formState.selectedCrop;
  }, [formState.customCropName, formState.selectedCrop, knownCropOptions, t]);

  const renderCropVisual = useCallback(
    (crop: KnownCrop, size: number, selected = true) => {
      const cropVisual = getCropVisual(crop);
      if (cropVisual.iconName) {
        return <CropIcon name={cropVisual.iconName} size={size} muted={!selected} />;
      }
      return (
        <UISymbol
          name={cropVisual.symbolName}
          size={size}
          color={
            selected
              ? m3.colorScheme.primary
              : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.8)
          }
        />
      );
    },
    [m3.colorScheme.onSurfaceVariant, m3.colorScheme.primary],
  );

  const soilCompositionWarning = useMemo(() => {
    const sandRaw = formState.sandPercentage.trim();
    const siltRaw = formState.siltPercentage.trim();
    const clayRaw = formState.clayPercentage.trim();
    const anyProvided = sandRaw !== '' || siltRaw !== '' || clayRaw !== '';
    if (!anyProvided) return null;
    if (sandRaw === '' || siltRaw === '' || clayRaw === '') return null;

    const sand = Number(sandRaw);
    const silt = Number(siltRaw);
    const clay = Number(clayRaw);
    if (!Number.isFinite(sand) || !Number.isFinite(silt) || !Number.isFinite(clay)) {
      return null;
    }
    const total = sand + silt + clay;
    if (Math.abs(total - 100) > 1) {
      return t('farmForm.soilCompositionWarning', { total: total.toFixed(1) });
    }
    return null;
  }, [formState.sandPercentage, formState.siltPercentage, formState.clayPercentage, t]);

  const pickerAvailableHeight = useMemo(() => {
    const baseViewportHeight = windowHeight - insets.top - spacing[2];
    const keyboardAdjustedHeight = isIOS
      ? keyboardHeight > 0
        ? baseViewportHeight - keyboardHeight + insets.bottom
        : baseViewportHeight
      : keyboardHeight > 0
        ? baseViewportHeight - keyboardHeight
        : baseViewportHeight;
    return Math.max(220, keyboardAdjustedHeight);
  }, [windowHeight, insets.top, insets.bottom, keyboardHeight]);

  const androidKeyboardLift = useAndroidKeyboardLift(keyboardHeight, insets.bottom);

  const varietySheetHeight = useMemo(
    () => Math.min(Math.round(windowHeight * 0.7), pickerAvailableHeight),
    [windowHeight, pickerAvailableHeight],
  );

  const cropSheetHeight = useMemo(
    () => Math.min(Math.round(windowHeight * 0.78), pickerAvailableHeight),
    [windowHeight, pickerAvailableHeight],
  );

  const textureSheetHeight = useMemo(
    () => Math.min(Math.round(windowHeight * 0.7), pickerAvailableHeight),
    [windowHeight, pickerAvailableHeight],
  );

  const handleOpenMapPicker = () => {
    setFormState((prev) => ({ ...prev, showMapPicker: true }));
  };

  const openPlantingDatePicker = () => {
    const safeDate = ensureValidDate(formState.plantingDate);
    setIosPlantingDateDraft(safeDate);
    setFormState((prev) => ({ ...prev, showDatePicker: true }));
  };

  const commitPlantingDateFromDraft = () => {
    const safeDate = ensureValidDate(iosPlantingDateDraft);
    setFormState((prev) => ({
      ...prev,
      plantingDate: safeDate,
      plantingDateChanged: true,
      showDatePicker: false,
    }));
  };

  const openPruningDatePicker = () => {
    const safeDate = ensureValidDate(formState.dateOfPruning);
    setIosPruningDateDraft(safeDate);
    setFormState((prev) => ({ ...prev, showPruningDatePicker: true }));
  };

  const commitPruningDateFromDraft = () => {
    const safeDate = ensureValidDate(iosPruningDateDraft);
    setFormState((prev) => ({
      ...prev,
      dateOfPruning: safeDate,
      showPruningDatePicker: false,
    }));
  };

  const handleLocationSelected = (latitude: number, longitude: number, locationName?: string) => {
    setFormState((prev) => ({
      ...prev,
      latitude: latitude.toFixed(6),
      longitude: longitude.toFixed(6),
      locationName: locationName || prev.locationName,
    }));
  };

  const isValid = useMemo(() => {
    if (!formState.name.trim()) return false;
    if (!formState.region.trim()) return false;
    const areaValue = Number(formState.area);
    if (!Number.isFinite(areaValue) || areaValue <= 0) return false;
    if (formState.selectedCrop === 'Other' && !formState.customCropName.trim()) return false;
    if (formState.cropVariety === 'Custom' && !formState.customVariety.trim()) return false;
    if (!formState.cropVariety && !formState.customVariety.trim()) return false;
    return true;
  }, [
    formState.name,
    formState.region,
    formState.area,
    formState.selectedCrop,
    formState.customCropName,
    formState.cropVariety,
    formState.customVariety,
  ]);

  const handleSelectCrop = (crop: CropType, customCropName = '') => {
    setFormState((prev) => ({
      ...prev,
      selectedCrop: crop,
      customCropName,
      cropVariety: '',
      customVariety: '',
      showCropPicker: false,
      cropSearchQuery: '',
    }));
  };

  const handleSelectVariety = (variety: string) => {
    setFormState((prev) => ({
      ...prev,
      cropVariety: variety,
      showVarietyPicker: false,
      varietySearchQuery: '',
      customVariety: variety === 'Custom' ? '' : prev.customVariety,
    }));
  };

  const handleUseCustomVariety = (varietyName: string) => {
    setFormState((prev) => ({
      ...prev,
      cropVariety: 'Custom',
      customVariety: varietyName,
      showVarietyPicker: false,
      varietySearchQuery: '',
    }));
  };

  const handleReset = () => {
    const initialState = isEdit ? buildFormStateFromFarm(farm) : buildFormStateFromFarm(undefined);
    setFormState(initialState);
  };

  const handleSave = async () => {
    if (!isValid) {
      Alert.alert(
        t('common.alerts.missingInformationTitle'),
        t('common.alerts.fillAllRequiredFields'),
      );
      return;
    }

    const sandRaw = formState.sandPercentage.trim();
    const siltRaw = formState.siltPercentage.trim();
    const clayRaw = formState.clayPercentage.trim();
    const hasAnySoilPercentage = sandRaw !== '' || siltRaw !== '' || clayRaw !== '';
    const hasAllSoilPercentages = sandRaw !== '' && siltRaw !== '' && clayRaw !== '';

    if (hasAnySoilPercentage && !hasAllSoilPercentages) {
      Alert.alert(t('common.alerts.missingInformationTitle'), t('farmForm.soilCompositionHint'));
      return;
    }

    const parsedSand = hasAllSoilPercentages ? Number(sandRaw) : undefined;
    const parsedSilt = hasAllSoilPercentages ? Number(siltRaw) : undefined;
    const parsedClay = hasAllSoilPercentages ? Number(clayRaw) : undefined;

    if (
      hasAllSoilPercentages &&
      (!Number.isFinite(parsedSand) || !Number.isFinite(parsedSilt) || !Number.isFinite(parsedClay))
    ) {
      Alert.alert(t('common.error'), t('farmForm.soilCompositionHint'));
      return;
    }

    if (hasAllSoilPercentages) {
      const sand = parsedSand as number;
      const silt = parsedSilt as number;
      const clay = parsedClay as number;
      if (sand < 0 || sand > 100 || silt < 0 || silt > 100 || clay < 0 || clay > 100) {
        Alert.alert(t('common.error'), t('farmForm.soilCompositionHint'));
        return;
      }
    }

    if (hasAllSoilPercentages && soilCompositionWarning) {
      Alert.alert(t('common.error'), soilCompositionWarning);
      return;
    }

    const parseOptionalNumber = (raw: string): number | undefined | null => {
      const trimmed = raw.trim();
      if (!trimmed) return undefined;
      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed)) {
        // Non-empty but non-numeric input - return null to signal invalid input
        return null;
      }
      return parsed;
    };

    const parseRequiredNumber = (raw: string): number | null => {
      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) return null;
      return parsed;
    };

    const areaValue = parseRequiredNumber(formState.area);
    if (areaValue === null || areaValue <= 0 || areaValue > 1_000_000) {
      Alert.alert(t('common.error'), t('common.errors.invalidFarmNumericInput'));
      return;
    }

    const latitudeValue = parseOptionalNumber(formState.latitude);
    const longitudeValue = parseOptionalNumber(formState.longitude);
    if (
      latitudeValue === null ||
      longitudeValue === null ||
      (latitudeValue !== undefined && (latitudeValue < -90 || latitudeValue > 90)) ||
      (longitudeValue !== undefined && (longitudeValue < -180 || longitudeValue > 180))
    ) {
      Alert.alert(t('common.error'), t('locationPicker.invalidCoordinates'));
      return;
    }

    const elevationValue = parseOptionalNumber(formState.elevation);
    if (
      elevationValue === null ||
      (elevationValue !== undefined &&
        (!Number.isInteger(elevationValue) || elevationValue < -500 || elevationValue > 12000))
    ) {
      Alert.alert(t('common.error'), t('common.errors.invalidFarmNumericInput'));
      return;
    }

    const optionalNumberValidation = validateAndParseOptionalFarmNumbers(
      {
        vineSpacing: formState.vineSpacing,
        rowSpacing: formState.rowSpacing,
        totalTankCapacity: formState.totalTankCapacity,
        systemDischarge: formState.systemDischarge,
        bulkDensity: formState.bulkDensity,
        cationExchangeCapacity: formState.cationExchangeCapacity,
        soilWaterRetention: formState.soilWaterRetention,
      },
      {
        bulkDensity: t('farmForm.fields.bulkDensity.label'),
        cationExchangeCapacity: t('farmForm.fields.cationExchangeCapacity.label'),
        soilWaterRetention: t('farmForm.fields.soilWaterRetention.label'),
      },
    );

    if (optionalNumberValidation.error) {
      if (
        optionalNumberValidation.error.code === 'invalid_numeric' ||
        optionalNumberValidation.error.code === 'out_of_bounds'
      ) {
        Alert.alert(t('common.error'), t('common.errors.invalidFarmNumericInput'));
        return;
      }

      const overflowFields = optionalNumberValidation.error.fields.join(', ');
      Alert.alert(
        t('common.error'),
        t('farmForm.overflowError', {
          fields: overflowFields,
          max: NUMERIC_6_4_MAX_ABS,
          defaultValue: `${overflowFields} must be less than or equal to ${NUMERIC_6_4_MAX_ABS}.`,
        }),
      );
      return;
    }

    const {
      vineSpacing: vineSpacingValue,
      rowSpacing: rowSpacingValue,
      totalTankCapacity: totalTankCapacityValue,
      systemDischarge: systemDischargeValue,
      bulkDensity: bulkDensityValue,
      cationExchangeCapacity: cationExchangeCapacityValue,
      soilWaterRetention: soilWaterRetentionValue,
    } = optionalNumberValidation.parsed;

    const finalCrop =
      formState.selectedCrop === 'Other' ? formState.customCropName.trim() : formState.selectedCrop;
    const finalVariety =
      formState.cropVariety === 'Custom' ? formState.customVariety : formState.cropVariety;

    if (isEdit) {
      if (!farmId) {
        Alert.alert(t('common.error'), t('common.errors.missingFarmIdForUpdate'));
        return;
      }
      const updates: FarmUpdate = {
        name: formState.name.trim(),
        region: formState.region.trim(),
        area: areaValue,
        crop: finalCrop,
        crop_variety: finalVariety,
        ...(formState.plantingDateChanged && {
          planting_date: formatLocalDate(formState.plantingDate as Date),
        }),
        vine_spacing: vineSpacingValue,
        row_spacing: rowSpacingValue,
        total_tank_capacity: totalTankCapacityValue,
        system_discharge: systemDischargeValue,
        date_of_pruning: formState.dateOfPruning
          ? formatLocalDate(formState.dateOfPruning)
          : undefined,
        location_name: formState.locationName.trim() || undefined,
        latitude: latitudeValue,
        longitude: longitudeValue,
        elevation: elevationValue,
        bulk_density: bulkDensityValue,
        cation_exchange_capacity: cationExchangeCapacityValue,
        soil_water_retention: soilWaterRetentionValue,
        soil_texture_class: formState.soilTextureClass || undefined,
        sand_percentage: parsedSand,
        silt_percentage: parsedSilt,
        clay_percentage: parsedClay,
      };
      try {
        await updateFarm.mutateAsync({ id: farmId, updates });
        telemetry.capture('farm_updated', {
          farm_id: farmId,
          crop: finalCrop,
          variety: finalVariety,
          region: formState.region,
          area_acres: areaValue,
        });
        onClose();
      } catch (_error: unknown) {
        const errorMessage = getErrorMessage(_error, t('common.errors.failedToUpdateFarm'));
        const errorMeta = getFarmErrorMeta(_error);
        console.error('Failed to update farm:', _error, { farmId, updates, errorMeta });
        telemetry.capture('farm_update_failed', {
          farm_id: farmId,
          code: errorMeta.code ?? null,
          message: errorMeta.message ?? errorMessage,
          details: errorMeta.details ?? null,
          hint: errorMeta.hint ?? null,
        });
        if (shouldCaptureFarmErrorInSentry(errorMeta)) {
          Sentry.withScope((scope) => {
            scope.setTag('domain', 'farm');
            scope.setTag('operation', 'update');
            if (errorMeta.code) scope.setTag('db_code', errorMeta.code);
            scope.setExtra('farm_id', farmId);
            scope.setExtra('payload', updates);
            scope.setExtra('db_error', errorMeta);
            Sentry.captureException(_error instanceof Error ? _error : new Error(errorMessage));
          });
        }
        Alert.alert(t('common.error'), errorMessage);
      }
      return;
    }

    const farmData: FarmInsert = {
      name: formState.name.trim(),
      region: formState.region.trim(),
      area: areaValue,
      crop: finalCrop,
      crop_variety: finalVariety,
      planting_date: formatLocalDate(formState.plantingDate),
      vine_spacing: vineSpacingValue,
      row_spacing: rowSpacingValue,
      total_tank_capacity: totalTankCapacityValue,
      system_discharge: systemDischargeValue,
      date_of_pruning: formState.dateOfPruning
        ? formatLocalDate(formState.dateOfPruning)
        : undefined,
      location_name: formState.locationName.trim() || undefined,
      latitude: latitudeValue,
      longitude: longitudeValue,
      elevation: elevationValue,
      bulk_density: bulkDensityValue,
      cation_exchange_capacity: cationExchangeCapacityValue,
      soil_water_retention: soilWaterRetentionValue,
      soil_texture_class: formState.soilTextureClass || undefined,
      sand_percentage: parsedSand,
      silt_percentage: parsedSilt,
      clay_percentage: parsedClay,
    };

    try {
      const result = await createFarm.mutateAsync(farmData);
      telemetry.capture('farm_created', {
        farm_id: result?.id ?? null,
        crop: finalCrop,
        variety: finalVariety,
        region: formState.region,
        area_acres: areaValue,
      });
      triggerHapticSuccess();
      onClose();
    } catch (_error: unknown) {
      const errorMessage = getErrorMessage(_error, t('common.errors.failedToCreateFarm'));
      const errorMeta = getFarmErrorMeta(_error);
      console.error('Failed to create farm:', _error, { farmData, errorMeta });
      telemetry.capture('farm_create_failed', {
        code: errorMeta.code ?? null,
        message: errorMeta.message ?? errorMessage,
        details: errorMeta.details ?? null,
        hint: errorMeta.hint ?? null,
      });
      if (shouldCaptureFarmErrorInSentry(errorMeta)) {
        Sentry.withScope((scope) => {
          scope.setTag('domain', 'farm');
          scope.setTag('operation', 'create');
          if (errorMeta.code) scope.setTag('db_code', errorMeta.code);
          scope.setExtra('payload', farmData);
          scope.setExtra('db_error', errorMeta);
          Sentry.captureException(_error instanceof Error ? _error : new Error(errorMessage));
        });
      }
      Alert.alert(t('common.error'), errorMessage);
    }
  };

  const getSoilTextureLabel = useCallback(
    (value?: string) => {
      if (!value) return '';
      const match = SOIL_TEXTURE_OPTIONS.find((o) => o.value === value);
      return match ? t(match.labelKey) : value;
    },
    [t],
  );

  const getVarietyLabel = useCallback(
    (value?: string) => {
      if (!value) return '';
      if (value === 'Custom') return t('farmForm.variety.custom');
      return value;
    },
    [t],
  );

  if (isEdit && farmLoading) {
    return (
      <View
        style={{ flex: 1, backgroundColor: m3.colorScheme.background, justifyContent: 'center' }}
      >
        <ActivityIndicator size="large" color={colors.primary[500]} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: m3.colorScheme.background }}>
      <FullScreenForm
        title={isEdit ? t('farmForm.title.edit') : t('farmForm.title.add')}
        onClose={onClose}
        onSave={handleSave}
        saveLabel={isEdit ? t('common.saveChanges') : t('farmForm.saveLabel.createFarm')}
        isLoading={createFarm.isPending || updateFarm.isPending}
        isSaveDisabled={!isValid}
        showResetButton={!isEdit}
        onReset={handleReset}
      >
        <SectionHeader title={t('farmForm.sections.details')} style={{ marginBottom: 16 }} />

        <FormInput
          label={t('farmForm.fields.name.label')}
          inputRef={nameInputRef}
          value={formState.name}
          onChangeText={(v) => setFormState((prev) => ({ ...prev, name: v }))}
          placeholder={t('farmForm.fields.name.placeholder')}
          required
          autoFocus={!isEdit}
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => regionInputRef.current?.focus()}
          style={{ marginBottom: 12 }}
        />

        <FormInput
          label={t('farmForm.fields.region.label')}
          inputRef={regionInputRef}
          value={formState.region}
          onChangeText={(v) => setFormState((prev) => ({ ...prev, region: v }))}
          placeholder={t('farmForm.fields.region.placeholder')}
          required
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => areaInputRef.current?.focus()}
          style={{ marginBottom: 12 }}
        />

        <FormInput
          label={t('farmForm.fields.area.label')}
          inputRef={areaInputRef}
          value={formState.area}
          onChangeText={(v) => setFormState((prev) => ({ ...prev, area: v }))}
          placeholder={t('farmForm.fields.area.placeholder')}
          keyboardType="decimal-pad"
          suffix={t('units.acres')}
          required
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => {
            if (formState.selectedCrop === 'Other') {
              customCropInputRef.current?.focus();
              return;
            }
            if (formState.cropVariety === 'Custom') {
              customVarietyInputRef.current?.focus();
              return;
            }
            vineSpacingInputRef.current?.focus();
          }}
          style={{ marginBottom: 20 }}
        />

        <SectionHeader title={t('farmForm.sections.cropType')} style={{ marginBottom: 16 }} />

        <Pressable
          style={{
            backgroundColor: colors.surface[100],
            borderWidth: 2,
            borderColor: colors.surface[200],
            borderRadius: borderRadius.xl,
            paddingHorizontal: spacing[4],
            paddingVertical: spacing[4],
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: spacing[3],
          }}
          onPress={() => setFormState((prev) => ({ ...prev, showCropPicker: true }))}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: borderRadius.full,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
              }}
            >
              {formState.selectedCrop === 'Other' ? (
                <UISymbol name="leaf.fill" size={16} color={m3.colorScheme.primary} />
              ) : (
                renderCropVisual(formState.selectedCrop, 18)
              )}
            </View>
            <Text
              style={{
                fontSize: fontSize.base,
                color: colors.surface[900],
                fontWeight: fontWeight.medium,
                marginLeft: spacing[3],
              }}
              numberOfLines={1}
            >
              {selectedCropLabel}
            </Text>
          </View>
          <UISymbol name="chevron.down" size={20} color={m3.colorScheme.onSurfaceVariant} />
        </Pressable>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginBottom: 20 }}>
          {popularCropOptions.map((cropOption) => {
            const isSelected =
              formState.selectedCrop !== 'Other' && formState.selectedCrop === cropOption.value;
            return (
              <Pressable
                key={cropOption.value}
                onPress={() => handleSelectCrop(cropOption.value)}
                style={{
                  paddingLeft: spacing[2],
                  paddingRight: spacing[3],
                  paddingVertical: spacing[2],
                  borderRadius: borderRadius.full,
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: isSelected
                    ? colorWithOpacity(colors.primary[500], 0.14)
                    : colors.surface[100],
                  borderWidth: 1,
                  borderColor: isSelected
                    ? colorWithOpacity(colors.primary[500], 0.4)
                    : colors.surface[200],
                }}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: borderRadius.full,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: spacing[2],
                    backgroundColor: isSelected
                      ? colorWithOpacity(colors.primary[500], 0.15)
                      : colorWithOpacity(colors.surface[600], 0.12),
                  }}
                >
                  {renderCropVisual(cropOption.value, 14, isSelected)}
                </View>
                <Text
                  style={{
                    color: isSelected ? colors.primary[700] : colors.surface[700],
                    fontWeight: isSelected ? fontWeight.semibold : fontWeight.medium,
                    fontSize: fontSize.sm,
                  }}
                >
                  {cropOption.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {formState.selectedCrop === 'Other' && (
          <FormInput
            label={t('farmForm.cropPicker.customCropInputLabel')}
            inputRef={customCropInputRef}
            value={formState.customCropName}
            onChangeText={(v) => setFormState((prev) => ({ ...prev, customCropName: v }))}
            placeholder={t('farmForm.cropPicker.customCropInputPlaceholder')}
            required
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => {
              if (formState.cropVariety === 'Custom') {
                customVarietyInputRef.current?.focus();
                return;
              }
              vineSpacingInputRef.current?.focus();
            }}
            style={{ marginBottom: 20 }}
          />
        )}

        <SectionHeader title={t('farmForm.sections.variety')} style={{ marginBottom: 16 }} />

        <Pressable
          style={{
            backgroundColor: colors.surface[100],
            borderWidth: 2,
            borderColor: colors.surface[200],
            borderRadius: borderRadius.xl,
            paddingHorizontal: spacing[4],
            paddingVertical: spacing[4],
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: spacing[3],
          }}
          onPress={() =>
            setFormState((prev) => ({ ...prev, showVarietyPicker: true, varietySearchQuery: '' }))
          }
        >
          <Text
            style={{
              fontSize: fontSize.base,
              color: formState.cropVariety ? colors.surface[900] : colors.surface[400],
              fontWeight: formState.cropVariety ? fontWeight.medium : fontWeight.normal,
            }}
          >
            {formState.cropVariety
              ? getVarietyLabel(formState.cropVariety)
              : t('farmForm.variety.selectPlaceholder')}
          </Text>
          <UISymbol name="chevron.down" size={20} color={m3.colorScheme.onSurfaceVariant} />
        </Pressable>

        {popularVarieties.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginBottom: 20 }}>
            {popularVarieties.map((variety) => {
              const isSelected = formState.cropVariety === variety;
              return (
                <Pressable
                  key={variety}
                  onPress={() => handleSelectVariety(variety)}
                  style={{
                    paddingHorizontal: spacing[3],
                    paddingVertical: spacing[2],
                    borderRadius: borderRadius.full,
                    backgroundColor: isSelected
                      ? colorWithOpacity(colors.primary[500], 0.14)
                      : colors.surface[100],
                    borderWidth: 1,
                    borderColor: isSelected
                      ? colorWithOpacity(colors.primary[500], 0.4)
                      : colors.surface[200],
                  }}
                >
                  <Text
                    style={{
                      color: isSelected ? colors.primary[700] : colors.surface[700],
                      fontWeight: isSelected ? fontWeight.semibold : fontWeight.medium,
                      fontSize: fontSize.sm,
                    }}
                  >
                    {variety}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {formState.cropVariety === 'Custom' && (
          <FormInput
            label={t('farmForm.variety.customNameLabel')}
            inputRef={customVarietyInputRef}
            value={formState.customVariety}
            onChangeText={(v) => setFormState((prev) => ({ ...prev, customVariety: v }))}
            placeholder={t('farmForm.variety.customNamePlaceholder')}
            required
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => vineSpacingInputRef.current?.focus()}
            style={{ marginBottom: 20 }}
          />
        )}

        <SectionHeader title={t('farmForm.sections.plantingDate')} style={{ marginBottom: 16 }} />

        <Pressable
          style={{
            backgroundColor: colors.surface[100],
            borderWidth: 2,
            borderColor: colors.surface[200],
            borderRadius: borderRadius.xl,
            paddingHorizontal: spacing[4],
            paddingVertical: spacing[4],
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: spacing[5],
          }}
          onPress={openPlantingDatePicker}
        >
          <UISymbol name="calendar" size={24} color={m3.colorScheme.onSurfaceVariant} />
          <Text
            style={{
              fontSize: fontSize.base,
              color: colors.surface[900],
              fontWeight: fontWeight.medium,
              marginLeft: spacing[3],
            }}
          >
            {formState.plantingDate
              ? formatDate(ensureValidDate(formState.plantingDate), {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })
              : t('farmForm.plantingDate.selectPlaceholder')}
          </Text>
        </Pressable>

        <SectionHeader
          title={t('farmForm.sections.plantSpacingOptional')}
          style={{ marginBottom: 16 }}
        />

        <View style={{ flexDirection: 'row', gap: spacing[3], marginBottom: spacing[5] }}>
          <View style={{ flex: 1 }}>
            <FormInput
              label={t('farmForm.fields.vineSpacing.label')}
              inputRef={vineSpacingInputRef}
              value={formState.vineSpacing}
              onChangeText={(v) => setFormState((prev) => ({ ...prev, vineSpacing: v }))}
              placeholder="1.8"
              keyboardType="decimal-pad"
              suffix={t('units.meter')}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => rowSpacingInputRef.current?.focus()}
              style={{ marginBottom: 0 }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <FormInput
              label={t('farmForm.fields.rowSpacing.label')}
              inputRef={rowSpacingInputRef}
              value={formState.rowSpacing}
              onChangeText={(v) => setFormState((prev) => ({ ...prev, rowSpacing: v }))}
              placeholder="3.0"
              keyboardType="decimal-pad"
              suffix={t('units.meter')}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => tankCapacityInputRef.current?.focus()}
              style={{ marginBottom: 0 }}
            />
          </View>
        </View>

        <SectionHeader
          title={t('farmForm.sections.irrigationDetailsOptional')}
          style={{ marginBottom: 16 }}
        />

        <FormInput
          label={t('farmForm.fields.tankCapacity.label')}
          inputRef={tankCapacityInputRef}
          value={formState.totalTankCapacity}
          onChangeText={(v) => setFormState((prev) => ({ ...prev, totalTankCapacity: v }))}
          placeholder="1000"
          keyboardType="decimal-pad"
          suffix={t('units.millimeter')}
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => systemDischargeInputRef.current?.focus()}
          style={{ marginBottom: 12 }}
        />

        <FormInput
          label={t('farmForm.fields.systemDischarge.label')}
          inputRef={systemDischargeInputRef}
          value={formState.systemDischarge}
          onChangeText={(v) => setFormState((prev) => ({ ...prev, systemDischarge: v }))}
          placeholder="10"
          keyboardType="decimal-pad"
          suffix={t('units.mmPerHour')}
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => locationNameInputRef.current?.focus()}
          style={{ marginBottom: 20 }}
        />

        <SectionHeader
          title={t('farmForm.sections.pruningDateOptional')}
          style={{ marginBottom: 16 }}
        />

        <Pressable
          style={{
            backgroundColor: colors.surface[100],
            borderWidth: 2,
            borderColor: colors.surface[200],
            borderRadius: borderRadius.xl,
            paddingHorizontal: spacing[4],
            paddingVertical: spacing[4],
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: spacing[5],
          }}
          onPress={openPruningDatePicker}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <UISymbol name="cut-outline" size={24} color={m3.colorScheme.onSurfaceVariant} />
            <View style={{ marginLeft: spacing[3], flex: 1 }}>
              <Text style={{ fontSize: fontSize.sm, color: colors.surface[500] }}>
                {t('farmForm.fields.pruningDate.label')}
              </Text>
              <Text
                style={{
                  fontSize: fontSize.base,
                  color: colors.surface[900],
                  fontWeight: fontWeight.medium,
                  marginTop: 2,
                }}
              >
                {formState.dateOfPruning
                  ? formatDate(formState.dateOfPruning, {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : t('farmForm.fields.pruningDate.notSet')}
              </Text>
            </View>
          </View>
          {formState.dateOfPruning && (
            <Pressable
              onPress={() => setFormState((prev) => ({ ...prev, dateOfPruning: null }))}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <UISymbol
                name="xmark.circle.fill"
                size={24}
                color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)}
              />
            </Pressable>
          )}
        </Pressable>

        <SectionHeader
          title={t('farmForm.sections.locationOptional')}
          style={{ marginBottom: 16 }}
        />

        <FormInput
          label={t('farmForm.fields.locationName.label')}
          inputRef={locationNameInputRef}
          value={formState.locationName}
          onChangeText={(v) => setFormState((prev) => ({ ...prev, locationName: v }))}
          placeholder={t('farmForm.fields.locationName.placeholder')}
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => latitudeInputRef.current?.focus()}
          style={{ marginBottom: 12 }}
        />

        <Button
          title={t('farmForm.location.selectOnMap')}
          variant="outline"
          size="sm"
          leftIcon={<UISymbol name="location.fill" size={20} color={colors.primary[500]} />}
          onPress={handleOpenMapPicker}
          style={{ marginBottom: 12 }}
        />

        <View style={{ flexDirection: 'row', gap: spacing[3], marginBottom: spacing[3] }}>
          <View style={{ flex: 1 }}>
            <FormInput
              label={t('farmForm.fields.latitude.label')}
              inputRef={latitudeInputRef}
              value={formState.latitude}
              onChangeText={(v) => setFormState((prev) => ({ ...prev, latitude: v }))}
              placeholder="0.000000"
              keyboardType="decimal-pad"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => longitudeInputRef.current?.focus()}
              style={{ marginBottom: 0 }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <FormInput
              label={t('farmForm.fields.longitude.label')}
              inputRef={longitudeInputRef}
              value={formState.longitude}
              onChangeText={(v) => setFormState((prev) => ({ ...prev, longitude: v }))}
              placeholder="0.000000"
              keyboardType="decimal-pad"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => elevationInputRef.current?.focus()}
              style={{ marginBottom: 0 }}
            />
          </View>
        </View>

        <FormInput
          label={t('farmForm.fields.elevation.label')}
          inputRef={elevationInputRef}
          value={formState.elevation}
          onChangeText={(v) => setFormState((prev) => ({ ...prev, elevation: v }))}
          placeholder="0"
          keyboardType="decimal-pad"
          suffix={t('units.feet')}
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => bulkDensityInputRef.current?.focus()}
          style={{ marginBottom: 20 }}
        />

        <SectionHeader
          title={t('farmForm.sections.soilPropertiesOptional')}
          style={{ marginBottom: 16 }}
        />

        <FormInput
          label={t('farmForm.fields.bulkDensity.label')}
          inputRef={bulkDensityInputRef}
          value={formState.bulkDensity}
          onChangeText={(v) => setFormState((prev) => ({ ...prev, bulkDensity: v }))}
          placeholder="1200"
          keyboardType="decimal-pad"
          suffix={t('units.kilogramPerMeterCubed')}
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => cecInputRef.current?.focus()}
          style={{ marginBottom: 12 }}
        />

        <FormInput
          label={t('farmForm.fields.cationExchangeCapacity.label')}
          inputRef={cecInputRef}
          value={formState.cationExchangeCapacity}
          onChangeText={(v) => setFormState((prev) => ({ ...prev, cationExchangeCapacity: v }))}
          placeholder="15"
          keyboardType="decimal-pad"
          suffix="cmol/kg"
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => soilWaterRetentionInputRef.current?.focus()}
          style={{ marginBottom: 12 }}
        />

        <FormInput
          label={t('farmForm.fields.soilWaterRetention.label')}
          inputRef={soilWaterRetentionInputRef}
          value={formState.soilWaterRetention}
          onChangeText={(v) => setFormState((prev) => ({ ...prev, soilWaterRetention: v }))}
          placeholder="25"
          keyboardType="decimal-pad"
          suffix="%"
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => sandInputRef.current?.focus()}
          style={{ marginBottom: 20 }}
        />

        <SectionHeader title={t('farmForm.sections.soilTexture')} style={{ marginBottom: 16 }} />

        <Pressable
          style={{
            backgroundColor: colors.surface[100],
            borderWidth: 2,
            borderColor: colors.surface[200],
            borderRadius: borderRadius.xl,
            paddingHorizontal: spacing[4],
            paddingVertical: spacing[4],
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: spacing[5],
          }}
          onPress={() => setFormState((prev) => ({ ...prev, showTexturePicker: true }))}
        >
          <Text
            style={{
              fontSize: fontSize.base,
              color: formState.soilTextureClass ? colors.surface[900] : colors.surface[400],
              fontWeight: formState.soilTextureClass ? fontWeight.medium : fontWeight.normal,
            }}
          >
            {formState.soilTextureClass
              ? getSoilTextureLabel(formState.soilTextureClass)
              : t('farmForm.soilTexture.selectPlaceholder')}
          </Text>
          <UISymbol name="chevron.down" size={20} color={m3.colorScheme.onSurfaceVariant} />
        </Pressable>

        <View style={{ flexDirection: 'row', gap: spacing[3], marginBottom: spacing[5] }}>
          <View style={{ flex: 1 }}>
            <FormInput
              label={t('farmForm.fields.sandPercentage.label')}
              inputRef={sandInputRef}
              value={formState.sandPercentage}
              onChangeText={(v) => setFormState((prev) => ({ ...prev, sandPercentage: v }))}
              placeholder="40"
              keyboardType="decimal-pad"
              suffix="%"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => siltInputRef.current?.focus()}
              style={{ marginBottom: 0 }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <FormInput
              label={t('farmForm.fields.siltPercentage.label')}
              inputRef={siltInputRef}
              value={formState.siltPercentage}
              onChangeText={(v) => setFormState((prev) => ({ ...prev, siltPercentage: v }))}
              placeholder="40"
              keyboardType="decimal-pad"
              suffix="%"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => clayInputRef.current?.focus()}
              style={{ marginBottom: 0 }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <FormInput
              label={t('farmForm.fields.clayPercentage.label')}
              inputRef={clayInputRef}
              value={formState.clayPercentage}
              onChangeText={(v) => setFormState((prev) => ({ ...prev, clayPercentage: v }))}
              placeholder="20"
              keyboardType="decimal-pad"
              suffix="%"
              returnKeyType="done"
              blurOnSubmit
              style={{ marginBottom: 0 }}
            />
          </View>
        </View>

        {soilCompositionWarning && (
          <InfoCard
            icon="exclamationmark.triangle.fill"
            iconColor={colors.warning}
            backgroundColor={colorWithOpacity(colors.warning, 0.2)}
            message={soilCompositionWarning}
            style={{ marginBottom: 20 }}
          />
        )}

        <InfoCard
          icon="information-circle"
          iconColor={colors.success}
          backgroundColor={colorWithOpacity(colors.success, 0.2)}
          message={t('farmForm.infoCardMessage')}
        />
      </FullScreenForm>
      {formState.showDatePicker && isIOS && (
        <ModalBackdrop
          visible
          onDismiss={() => setFormState((prev) => ({ ...prev, showDatePicker: false }))}
          opacity={0.5}
          zIndex={50}
        >
          <View
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: colors.surface[100],
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 16,
            }}
            onStartShouldSetResponder={() => true}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
              }}
            >
              <Text
                selectable
                style={{ fontSize: 18, fontWeight: '700', color: m3.colorScheme.onSurface }}
              >
                {t('farmForm.sections.plantingDate')}
              </Text>
              <Pressable
                onPress={() => setFormState((prev) => ({ ...prev, showDatePicker: false }))}
              >
                <UISymbol
                  name="xmark.circle.fill"
                  size={24}
                  color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)}
                />
              </Pressable>
            </View>
            <DateTimePicker
              value={ensureValidDate(iosPlantingDateDraft)}
              mode="date"
              display="spinner"
              onChange={(event, date) => {
                if (event.type === 'dismissed') return;
                const nextDate =
                  date ??
                  (typeof event.nativeEvent?.timestamp === 'number'
                    ? new Date(event.nativeEvent.timestamp)
                    : undefined);
                if (nextDate) {
                  setIosPlantingDateDraft(ensureValidDate(nextDate));
                }
              }}
            />
            <Pressable
              onPress={commitPlantingDateFromDraft}
              style={[
                { marginTop: 16, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
                { backgroundColor: m3.colorScheme.primary },
              ]}
            >
              <Text selectable style={{ fontWeight: '600', color: m3.colorScheme.onPrimary }}>
                {t('entryForm.done')}
              </Text>
            </Pressable>
          </View>
        </ModalBackdrop>
      )}
      {formState.showDatePicker && !isIOS && (
        <DateTimePicker
          value={ensureValidDate(formState.plantingDate)}
          mode="date"
          onChange={(event: DateTimePickerEvent, date?: Date) => {
            if (event.type === 'dismissed') {
              setFormState((prev) => ({ ...prev, showDatePicker: false }));
              return;
            }
            if (date) {
              setFormState((prev) => ({
                ...prev,
                plantingDate: date,
                plantingDateChanged: true,
              }));
            }
            setFormState((prev) => ({ ...prev, showDatePicker: false }));
          }}
        />
      )}
      {formState.showPruningDatePicker && isIOS && (
        <ModalBackdrop
          visible
          onDismiss={() => setFormState((prev) => ({ ...prev, showPruningDatePicker: false }))}
          opacity={0.5}
          zIndex={50}
        >
          <View
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: colors.surface[100],
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 16,
            }}
            onStartShouldSetResponder={() => true}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
              }}
            >
              <Text
                selectable
                style={{ fontSize: 18, fontWeight: '700', color: m3.colorScheme.onSurface }}
              >
                {t('farmForm.fields.pruningDate.label')}
              </Text>
              <Pressable
                onPress={() => setFormState((prev) => ({ ...prev, showPruningDatePicker: false }))}
              >
                <UISymbol
                  name="xmark.circle.fill"
                  size={24}
                  color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)}
                />
              </Pressable>
            </View>
            <DateTimePicker
              value={ensureValidDate(iosPruningDateDraft)}
              mode="date"
              display="spinner"
              onChange={(_, date) => {
                if (date) setIosPruningDateDraft(date);
              }}
            />
            <Pressable
              onPress={commitPruningDateFromDraft}
              style={[
                { marginTop: 16, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
                { backgroundColor: m3.colorScheme.primary },
              ]}
            >
              <Text selectable style={{ fontWeight: '600', color: m3.colorScheme.onPrimary }}>
                {t('entryForm.done')}
              </Text>
            </Pressable>
          </View>
        </ModalBackdrop>
      )}
      {formState.showPruningDatePicker && !isIOS && (
        <DateTimePicker
          value={formState.dateOfPruning ?? new Date()}
          mode="date"
          onChange={(event: DateTimePickerEvent, date?: Date) => {
            if (event.type === 'dismissed') {
              setFormState((prev) => ({ ...prev, showPruningDatePicker: false }));
              return;
            }
            if (date) setFormState((prev) => ({ ...prev, dateOfPruning: date }));
            setFormState((prev) => ({ ...prev, showPruningDatePicker: false }));
          }}
        />
      )}

      {formState.showVarietyPicker && (
        <ModalBackdrop
          visible
          onDismiss={() =>
            setFormState((prev) => ({ ...prev, showVarietyPicker: false, varietySearchQuery: '' }))
          }
          alignment="flex-end"
          opacity={0.5}
        >
          <KeyboardAvoidingView
            behavior={isIOS ? 'padding' : undefined}
            keyboardVerticalOffset={0}
            style={{ justifyContent: 'flex-end', paddingBottom: androidKeyboardLift }}
          >
            <Pressable
              onPress={() => {}}
              style={{
                backgroundColor: colors.surface[100],
                borderTopLeftRadius: borderRadius['3xl'],
                borderTopRightRadius: borderRadius['3xl'],
                height: varietySheetHeight,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: spacing[6],
                  paddingVertical: spacing[4],
                  borderBottomWidth: 1,
                  borderBottomColor: colors.surface[100],
                }}
              >
                <View style={{ width: 40 }} />
                <Text
                  style={{
                    fontSize: fontSize.lg,
                    fontWeight: fontWeight.semibold,
                    color: colors.surface[900],
                  }}
                >
                  {t('farmForm.variety.modalTitle')}
                </Text>
                <Pressable
                  onPress={() =>
                    setFormState((prev) => ({
                      ...prev,
                      showVarietyPicker: false,
                      varietySearchQuery: '',
                    }))
                  }
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: borderRadius.full,
                    backgroundColor: colors.surface[100],
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <UISymbol name="xmark" size={20} color={m3.colorScheme.onSurface} />
                </Pressable>
              </View>

              <View
                style={{
                  paddingHorizontal: spacing[6],
                  paddingTop: spacing[4],
                  paddingBottom: spacing[2],
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: colors.surface[200],
                    borderRadius: borderRadius.xl,
                    backgroundColor: colors.surface[50],
                    paddingHorizontal: spacing[3],
                    minHeight: 48,
                  }}
                >
                  <UISymbol
                    name="magnifyingglass"
                    size={18}
                    color={m3.colorScheme.onSurfaceVariant}
                  />
                  <TextInput
                    value={formState.varietySearchQuery}
                    onChangeText={(v) =>
                      setFormState((prev) => ({ ...prev, varietySearchQuery: v }))
                    }
                    placeholder={t('farmForm.variety.searchPlaceholder')}
                    placeholderTextColor={colors.surface[400]}
                    style={{
                      flex: 1,
                      marginLeft: spacing[2],
                      color: colors.surface[900],
                      fontSize: fontSize.base,
                    }}
                    autoCapitalize="words"
                    autoCorrect={false}
                  />
                </View>
              </View>

              <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
                {filteredVarieties.map((variety) => (
                  <Pressable
                    key={variety}
                    style={{
                      paddingHorizontal: spacing[6],
                      paddingVertical: spacing[4],
                      borderBottomWidth: 1,
                      borderBottomColor: colors.surface[100],
                      backgroundColor:
                        formState.cropVariety === variety
                          ? colors.surface[50]
                          : colors.surface[100],
                    }}
                    onPress={() => handleSelectVariety(variety)}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: fontSize.base,
                          color:
                            formState.cropVariety === variety
                              ? colors.surface[900]
                              : colors.surface[700],
                          fontWeight:
                            formState.cropVariety === variety
                              ? fontWeight.semibold
                              : fontWeight.normal,
                        }}
                      >
                        {getVarietyLabel(variety)}
                      </Text>
                      {formState.cropVariety === variety && (
                        <UISymbol name="checkmark" size={20} color={colors.primary[500]} />
                      )}
                    </View>
                  </Pressable>
                ))}
                {canCreateCustomVariety && (
                  <Pressable
                    onPress={() => handleUseCustomVariety(varietySearchQueryTrimmed)}
                    style={{
                      paddingHorizontal: spacing[6],
                      paddingVertical: spacing[4],
                      borderBottomWidth: 1,
                      borderBottomColor: colors.surface[100],
                      backgroundColor:
                        formState.cropVariety === 'Custom' &&
                        formState.customVariety.trim().toLowerCase() === varietySearchQueryLower
                          ? colors.surface[50]
                          : colors.surface[100],
                    }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <UISymbol name="plus.circle.fill" size={20} color={colors.primary[500]} />
                        <Text
                          style={{
                            marginLeft: spacing[2],
                            fontSize: fontSize.base,
                            color: colors.surface[900],
                            fontWeight: fontWeight.semibold,
                          }}
                        >
                          {t('farmForm.variety.useCustomVariety', {
                            variety: varietySearchQueryTrimmed,
                          })}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                )}
                {filteredVarieties.length === 0 && !canCreateCustomVariety && (
                  <View style={{ paddingHorizontal: spacing[6], paddingVertical: spacing[5] }}>
                    <Text style={{ fontSize: fontSize.sm, color: colors.surface[500] }}>
                      {t('common.noResultsFound')}
                    </Text>
                  </View>
                )}
              </ScrollView>
            </Pressable>
          </KeyboardAvoidingView>
        </ModalBackdrop>
      )}

      {formState.showCropPicker && (
        <ModalBackdrop
          visible
          onDismiss={() => setFormState((prev) => ({ ...prev, showCropPicker: false }))}
          alignment="flex-end"
          opacity={0.5}
        >
          <KeyboardAvoidingView
            behavior={isIOS ? 'padding' : undefined}
            keyboardVerticalOffset={0}
            style={{ justifyContent: 'flex-end', paddingBottom: androidKeyboardLift }}
          >
            <View
              onStartShouldSetResponder={() => true}
              style={{
                backgroundColor: colors.surface[100],
                borderTopLeftRadius: borderRadius['3xl'],
                borderTopRightRadius: borderRadius['3xl'],
                height: cropSheetHeight,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: spacing[6],
                  paddingVertical: spacing[4],
                  borderBottomWidth: 1,
                  borderBottomColor: colors.surface[100],
                }}
              >
                <View style={{ width: 40 }} />
                <Text
                  style={{
                    fontSize: fontSize.lg,
                    fontWeight: fontWeight.semibold,
                    color: colors.surface[900],
                  }}
                >
                  {t('farmForm.cropPicker.modalTitle')}
                </Text>
                <Pressable
                  onPress={() =>
                    setFormState((prev) => ({
                      ...prev,
                      showCropPicker: false,
                      cropSearchQuery: '',
                    }))
                  }
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: borderRadius.full,
                    backgroundColor: colors.surface[100],
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <UISymbol name="xmark" size={20} color={m3.colorScheme.onSurface} />
                </Pressable>
              </View>

              <View
                style={{
                  paddingHorizontal: spacing[6],
                  paddingTop: spacing[4],
                  paddingBottom: spacing[2],
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: colors.surface[200],
                    borderRadius: borderRadius.xl,
                    backgroundColor: colors.surface[50],
                    paddingHorizontal: spacing[3],
                    minHeight: 48,
                  }}
                >
                  <UISymbol
                    name="magnifyingglass"
                    size={18}
                    color={m3.colorScheme.onSurfaceVariant}
                  />
                  <TextInput
                    value={formState.cropSearchQuery}
                    onChangeText={(v) => setFormState((prev) => ({ ...prev, cropSearchQuery: v }))}
                    placeholder={t('farmForm.cropPicker.searchPlaceholder')}
                    placeholderTextColor={colors.surface[400]}
                    style={{
                      flex: 1,
                      marginLeft: spacing[2],
                      color: colors.surface[900],
                      fontSize: fontSize.base,
                    }}
                    autoCapitalize="words"
                    autoCorrect={false}
                  />
                </View>
              </View>

              <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
                {filteredCropOptions.map((cropOption) => {
                  const selected =
                    formState.selectedCrop !== 'Other' &&
                    formState.selectedCrop === cropOption.value;
                  return (
                    <Pressable
                      key={cropOption.value}
                      style={{
                        paddingHorizontal: spacing[6],
                        paddingVertical: spacing[4],
                        borderBottomWidth: 1,
                        borderBottomColor: colors.surface[100],
                        backgroundColor: selected ? colors.surface[50] : colors.surface[100],
                      }}
                      onPress={() => handleSelectCrop(cropOption.value)}
                    >
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                          <View
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: borderRadius.lg,
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginRight: spacing[3],
                              backgroundColor: selected
                                ? colorWithOpacity(colors.primary[500], 0.16)
                                : colorWithOpacity(colors.surface[600], 0.1),
                            }}
                          >
                            {renderCropVisual(cropOption.value, 22, selected)}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text
                              style={{
                                fontSize: fontSize.base,
                                color: selected ? colors.surface[900] : colors.surface[700],
                                fontWeight: selected ? fontWeight.semibold : fontWeight.medium,
                              }}
                            >
                              {cropOption.label}
                            </Text>
                            <Text
                              style={{
                                marginTop: 2,
                                fontSize: fontSize.sm,
                                color: colors.surface[500],
                              }}
                            >
                              {cropOption.sublabel}
                            </Text>
                          </View>
                        </View>
                        {selected && (
                          <UISymbol name="checkmark" size={20} color={colors.primary[500]} />
                        )}
                      </View>
                    </Pressable>
                  );
                })}

                {canCreateCustomCrop && (
                  <Pressable
                    onPress={() => handleSelectCrop('Other', cropSearchQueryTrimmed)}
                    style={{
                      paddingHorizontal: spacing[6],
                      paddingVertical: spacing[4],
                      borderBottomWidth: 1,
                      borderBottomColor: colors.surface[100],
                      backgroundColor:
                        formState.selectedCrop === 'Other' &&
                        formState.customCropName.trim().toLowerCase() === cropSearchQueryLower
                          ? colors.surface[50]
                          : colors.surface[100],
                    }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <UISymbol name="plus.circle.fill" size={20} color={colors.primary[500]} />
                        <Text
                          style={{
                            marginLeft: spacing[2],
                            fontSize: fontSize.base,
                            color: colors.surface[900],
                            fontWeight: fontWeight.semibold,
                          }}
                        >
                          {t('farmForm.cropPicker.useCustomCrop', { crop: cropSearchQueryTrimmed })}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                )}

                {filteredCropOptions.length === 0 && !canCreateCustomCrop && (
                  <View style={{ paddingHorizontal: spacing[6], paddingVertical: spacing[5] }}>
                    <Text style={{ fontSize: fontSize.sm, color: colors.surface[500] }}>
                      {t('farmForm.cropPicker.noResults')}
                    </Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </ModalBackdrop>
      )}

      {formState.showTexturePicker && (
        <ModalBackdrop
          visible
          onDismiss={() => setFormState((prev) => ({ ...prev, showTexturePicker: false }))}
          alignment="flex-end"
          opacity={0.5}
        >
          <KeyboardAvoidingView
            behavior={isIOS ? 'padding' : undefined}
            keyboardVerticalOffset={0}
            style={{ justifyContent: 'flex-end', paddingBottom: androidKeyboardLift }}
          >
            <Pressable
              onPress={() => {}}
              style={{
                backgroundColor: colors.surface[100],
                borderTopLeftRadius: borderRadius['3xl'],
                borderTopRightRadius: borderRadius['3xl'],
                height: textureSheetHeight,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: spacing[6],
                  paddingVertical: spacing[4],
                  borderBottomWidth: 1,
                  borderBottomColor: colors.surface[100],
                }}
              >
                <View style={{ width: 40 }} />
                <Text
                  style={{
                    fontSize: fontSize.lg,
                    fontWeight: fontWeight.semibold,
                    color: colors.surface[900],
                  }}
                >
                  {t('farmForm.soilTexture.modalTitle')}
                </Text>
                <Pressable
                  onPress={() => setFormState((prev) => ({ ...prev, showTexturePicker: false }))}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: borderRadius.full,
                    backgroundColor: colors.surface[100],
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <UISymbol name="xmark" size={20} color={m3.colorScheme.onSurface} />
                </Pressable>
              </View>

              <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
                {SOIL_TEXTURE_OPTIONS.map((texture) => (
                  <Pressable
                    key={texture.value}
                    style={{
                      paddingHorizontal: spacing[6],
                      paddingVertical: spacing[4],
                      borderBottomWidth: 1,
                      borderBottomColor: colors.surface[100],
                      backgroundColor:
                        formState.soilTextureClass === texture.value
                          ? colors.surface[50]
                          : colors.surface[100],
                    }}
                    onPress={() => {
                      setFormState((prev) => ({
                        ...prev,
                        soilTextureClass: texture.value,
                        showTexturePicker: false,
                      }));
                    }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: fontSize.base,
                          color:
                            formState.soilTextureClass === texture.value
                              ? colors.surface[900]
                              : colors.surface[700],
                          fontWeight:
                            formState.soilTextureClass === texture.value
                              ? fontWeight.semibold
                              : fontWeight.normal,
                        }}
                      >
                        {t(texture.labelKey)}
                      </Text>
                      {formState.soilTextureClass === texture.value && (
                        <UISymbol name="checkmark" size={20} color={colors.primary[500]} />
                      )}
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            </Pressable>
          </KeyboardAvoidingView>
        </ModalBackdrop>
      )}

      <LocationPicker
        visible={formState.showMapPicker}
        onClose={() => setFormState((prev) => ({ ...prev, showMapPicker: false }))}
        onLocationSelect={handleLocationSelected}
        initialLatitude={formState.latitude ? parseFloat(formState.latitude) : undefined}
        initialLongitude={formState.longitude ? parseFloat(formState.longitude) : undefined}
      />
    </View>
  );
}
