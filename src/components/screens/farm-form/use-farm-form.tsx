/**
 * Farm Form – custom hook
 * Encapsulates all state, effects, derived values, and handlers.
 */

import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Alert, Keyboard, ScrollView, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  useCreateFarm,
  useFarm,
  useUpdateFarm,
  isIOS,
  useResponsiveHeight,
  useAndroidKeyboardLift,
} from '@/hooks';
import type { FarmInsert, FarmUpdate } from '@/types';
import type { CropType } from '@/constants/crop-varieties';
import { CROP_VARIETIES } from '@/constants/crop-varieties';
import { useM3, useThemeColors } from '@/styles/use-theme';
import { spacing } from '@/styles/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { telemetry } from '@/services/telemetry';
import * as Sentry from '@sentry/react-native';
import { formatNumber } from '@/i18n/format';
import { getFarmErrorMeta, shouldCaptureFarmErrorInSentry } from '@/utils/farm-error-utils';
import { triggerHapticSuccess } from '@/utils/haptics';
import { validateAndParseOptionalFarmNumbers } from '@/utils/farm-form-submit-validation';
import { getCropVisual, type KnownCrop } from '@/utils/farm-crop-visuals';
import { colorWithOpacity } from '@/utils/color';
import { CropIcon } from '@/components/ui';
import { Symbol as UISymbol } from '@/components/ui/symbol';

import { guidedTourEmit, guidedTourOn } from '@/features/guided-tour';
import { useGuidedTourStore } from '@/features/guided-tour/store';
import { GUIDED_TOUR_TARGET_IDS } from '@/features/guided-tour/constants';
import { notifyGuidedTourTargetChanged } from '@/features/guided-tour/targets';

import type { FarmFormMode, AddFarmFocusField, FormState } from './types';
import { KNOWN_CROPS, POPULAR_CROPS, CROP_I18N_KEY_MAP, SOIL_TEXTURE_OPTIONS } from './constants';
import {
  buildFormStateFromFarm,
  buildFarmInsertFromCoreFields,
  ensureValidDate,
  formatLocalDate,
  getErrorMessage,
  isFarmCoreFieldsValid,
  resolveFarmCoreSelection,
  sanitizeDecimalInput,
} from './utils';

interface KnownCropOption {
  value: KnownCrop;
  label: string;
  sublabel: string;
}

function hasDefinedValue(value: unknown) {
  return value !== null && value !== undefined;
}

function getFarmPayloadMetadata(payload: Record<string, unknown>) {
  return {
    fields: Object.keys(payload),
    fieldCount: Object.keys(payload).length,
    hasLocation: ['location_name', 'latitude', 'longitude'].some((key) =>
      hasDefinedValue(payload[key]),
    ),
    hasAddress:
      (typeof payload.address === 'string' && payload.address.trim().length > 0) ||
      Object.entries(payload).some(
        ([key, value]) => /^address(_|$)/.test(key) && hasDefinedValue(value),
      ),
  };
}

export function useFarmForm(mode: FarmFormMode, farmId: number | undefined, onClose: () => void) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const m3 = useM3();
  const insets = useSafeAreaInsets();
  const { windowHeight } = useResponsiveHeight();
  const guidedTourStatus = useGuidedTourStore((s) => s.status);
  const guidedTourStep = useGuidedTourStore((s) => s.currentStep);

  const isEdit = mode === 'edit';
  const createFarm = useCreateFarm();
  const updateFarm = useUpdateFarm();
  const { data: farm, isLoading: farmLoading } = useFarm(isEdit ? farmId : undefined);
  const initializedFarmIdRef = useRef<number | null>(null);

  const [formState, setFormState] = useState<FormState>(() =>
    isEdit && farm ? buildFormStateFromFarm(farm) : buildFormStateFromFarm(undefined),
  );
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isGuidedTourScrollLocked, setIsGuidedTourScrollLocked] = useState(false);
  const [iosPlantingDateDraft, setIosPlantingDateDraft] = useState<Date>(() => new Date());
  const [iosPruningDateDraft, setIosPruningDateDraft] = useState<Date>(() => new Date());

  const formScrollViewRef = useRef<ScrollView>(null);
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
  const previousSelectedCropRef = useRef<CropType | null>(null);
  const guidedTourScrollLockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const guidedFocusPrimaryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const guidedFocusSettleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const guidedAreaAnchorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formScrollYRef = useRef(0);
  const setFormScrollY = useCallback((y: number) => {
    formScrollYRef.current = y;
  }, []);
  const guidedTourLastFocusFieldRef = useRef<AddFarmFocusField | null>(null);
  const pendingGuidedScrollRef = useRef<React.RefObject<TextInput | null> | null>(null);
  const guidedTopLockFrameRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  const guidedLockedScrollYRef = useRef(0);
  const dismissFarmKeyboard = useCallback(() => {
    nameInputRef.current?.blur();
    regionInputRef.current?.blur();
    areaInputRef.current?.blur();
    customCropInputRef.current?.blur();
    customVarietyInputRef.current?.blur();
    Keyboard.dismiss();
  }, []);

  // ---------------------------------------------------------------------------
  // Scroll helpers
  // ---------------------------------------------------------------------------

  const getGuidedFieldRef = useCallback(
    (field: AddFarmFocusField) =>
      field === 'name' ? nameInputRef : field === 'region' ? regionInputRef : areaInputRef,
    [],
  );

  const forceGuidedScrollLock = useCallback((targetY: number) => {
    if (guidedTopLockFrameRef.current !== null) {
      cancelAnimationFrame(guidedTopLockFrameRef.current);
    }
    guidedTopLockFrameRef.current = requestAnimationFrame(() => {
      guidedTopLockFrameRef.current = null;
      const nextY = Math.max(0, targetY);
      formScrollViewRef.current?.scrollTo({ y: nextY, animated: false });
      formScrollYRef.current = nextY;
      guidedLockedScrollYRef.current = nextY;
    });
  }, []);

  const handleFormScrollY = useCallback(
    (y: number) => {
      setFormScrollY(y);
      if (!isGuidedTourScrollLocked) return;
      if (Math.abs(y - guidedLockedScrollYRef.current) < 1) return;
      forceGuidedScrollLock(guidedLockedScrollYRef.current);
    },
    [forceGuidedScrollLock, isGuidedTourScrollLocked, setFormScrollY],
  );

  const scrollGuidedFieldToAnchor = useCallback(
    (ref: React.RefObject<TextInput | null>, animated: boolean) => {
      const input = ref.current;
      const scrollView = formScrollViewRef.current;
      if (!input || !scrollView) return;
      if (keyboardHeight <= 0) {
        pendingGuidedScrollRef.current = ref;
      } else {
        pendingGuidedScrollRef.current = null;
      }
      const measurableScrollView = scrollView as unknown as {
        measureInWindow?: (
          callback: (x: number, y: number, width: number, height: number) => void,
        ) => void;
        scrollTo: (options: { y: number; animated: boolean }) => void;
      };
      if (!measurableScrollView.measureInWindow) return;
      input.measureInWindow((_, inputY) => {
        measurableScrollView.measureInWindow?.((_x, scrollY) => {
          const GUIDED_FIELD_TOP_OFFSET = 132;
          const targetY = Math.max(
            0,
            formScrollYRef.current + (inputY - scrollY) - GUIDED_FIELD_TOP_OFFSET,
          );
          measurableScrollView.scrollTo({ y: targetY, animated });
          formScrollYRef.current = targetY;
          guidedLockedScrollYRef.current = targetY;
        });
      });
    },
    [keyboardHeight],
  );

  useEffect(() => {
    if (keyboardHeight <= 0) return;
    const pendingRef = pendingGuidedScrollRef.current;
    if (!pendingRef) return;
    pendingGuidedScrollRef.current = null;
    const id = setTimeout(() => {
      scrollGuidedFieldToAnchor(pendingRef, false);
    }, 0);
    return () => clearTimeout(id);
  }, [keyboardHeight, scrollGuidedFieldToAnchor]);

  const focusGuidedField = useCallback(
    (field: AddFarmFocusField) => {
      const ref = getGuidedFieldRef(field);
      const waitForKeyboardSettle = field === 'area' && keyboardHeight > 0;
      const targetId =
        field === 'name'
          ? GUIDED_TOUR_TARGET_IDS.ADD_FARM_NAME
          : field === 'region'
            ? GUIDED_TOUR_TARGET_IDS.ADD_FARM_REGION
            : GUIDED_TOUR_TARGET_IDS.ADD_FARM_AREA;
      if (guidedFocusPrimaryTimerRef.current) {
        clearTimeout(guidedFocusPrimaryTimerRef.current);
      }
      if (guidedFocusSettleTimerRef.current) {
        clearTimeout(guidedFocusSettleTimerRef.current);
      }
      if (guidedAreaAnchorTimerRef.current) {
        clearTimeout(guidedAreaAnchorTimerRef.current);
        guidedAreaAnchorTimerRef.current = null;
      }
      guidedFocusPrimaryTimerRef.current = setTimeout(() => {
        guidedFocusPrimaryTimerRef.current = null;
        notifyGuidedTourTargetChanged(targetId);
        ref.current?.focus();
        if (waitForKeyboardSettle) {
          pendingGuidedScrollRef.current = ref;
          guidedFocusSettleTimerRef.current = setTimeout(
            () => {
              guidedFocusSettleTimerRef.current = null;
              scrollGuidedFieldToAnchor(ref, false);
            },
            isIOS ? 160 : 120,
          );
          guidedAreaAnchorTimerRef.current = setTimeout(
            () => {
              guidedAreaAnchorTimerRef.current = null;
              notifyGuidedTourTargetChanged(targetId);
              scrollGuidedFieldToAnchor(ref, false);
            },
            isIOS ? 320 : 280,
          );
          return;
        }
        scrollGuidedFieldToAnchor(ref, false);
      }, 80);
      if (!isIOS && !waitForKeyboardSettle) {
        guidedFocusSettleTimerRef.current = setTimeout(() => {
          guidedFocusSettleTimerRef.current = null;
          notifyGuidedTourTargetChanged(targetId);
        }, 400);
      }
    },
    [getGuidedFieldRef, keyboardHeight, scrollGuidedFieldToAnchor],
  );

  // ---------------------------------------------------------------------------
  // Guided Tour event listeners
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const unsubFocus = guidedTourOn('guidedTour.addFarmFocusField', ({ field }) => {
      if (mode !== 'add') return;
      focusGuidedField(field);
    });
    const unsubDismissKeyboard = guidedTourOn('guidedTour.addFarmDismissKeyboard', () => {
      if (mode !== 'add') return;
      dismissFarmKeyboard();
    });

    const unsubPhaseChanged = guidedTourOn('guidedTour.addFarmPhaseChanged', (payload) => {
      if (mode !== 'add') return;
      if (guidedTourScrollLockTimeoutRef.current) {
        clearTimeout(guidedTourScrollLockTimeoutRef.current);
        guidedTourScrollLockTimeoutRef.current = null;
      }
      if (payload.focusField) {
        guidedTourLastFocusFieldRef.current = payload.focusField;
        focusGuidedField(payload.focusField);
      } else if (payload.phase !== 'cta') {
        dismissFarmKeyboard();
      }
      if (!payload.lockScroll) {
        setIsGuidedTourScrollLocked(false);
        return;
      }
      // Lock scroll immediately to prevent user from scrolling during tour
      setIsGuidedTourScrollLocked(true);
      if (payload.focusField) {
        return;
      }
      guidedTourScrollLockTimeoutRef.current = setTimeout(() => {
        if (guidedTourLastFocusFieldRef.current) {
          focusGuidedField(guidedTourLastFocusFieldRef.current);
        }
        guidedTourScrollLockTimeoutRef.current = null;
      }, 120);
    });
    return () => {
      if (guidedTourScrollLockTimeoutRef.current) {
        clearTimeout(guidedTourScrollLockTimeoutRef.current);
        guidedTourScrollLockTimeoutRef.current = null;
      }
      if (guidedFocusPrimaryTimerRef.current) {
        clearTimeout(guidedFocusPrimaryTimerRef.current);
        guidedFocusPrimaryTimerRef.current = null;
      }
      if (guidedFocusSettleTimerRef.current) {
        clearTimeout(guidedFocusSettleTimerRef.current);
        guidedFocusSettleTimerRef.current = null;
      }
      if (guidedAreaAnchorTimerRef.current) {
        clearTimeout(guidedAreaAnchorTimerRef.current);
        guidedAreaAnchorTimerRef.current = null;
      }
      unsubFocus();
      unsubDismissKeyboard();
      unsubPhaseChanged();
    };
  }, [dismissFarmKeyboard, focusGuidedField, mode]);

  const prevScrollLockedRef = useRef(false);
  useEffect(() => {
    if (mode !== 'add') return;
    if (
      guidedTourStatus !== 'in_progress' ||
      guidedTourStep !== 'add_farm' ||
      formState.showCropPicker ||
      formState.showVarietyPicker
    ) {
      if (guidedTourScrollLockTimeoutRef.current) {
        clearTimeout(guidedTourScrollLockTimeoutRef.current);
        guidedTourScrollLockTimeoutRef.current = null;
      }
      prevScrollLockedRef.current = false;
      guidedLockedScrollYRef.current = 0;
      setIsGuidedTourScrollLocked(false);
    } else {
      // Tour is active on add_farm step — lock scroll
      setIsGuidedTourScrollLocked(true);
      if (!prevScrollLockedRef.current) {
        prevScrollLockedRef.current = true;
        const activeField = guidedTourLastFocusFieldRef.current;
        if (activeField) {
          scrollGuidedFieldToAnchor(getGuidedFieldRef(activeField), false);
        }
      }
    }
  }, [
    formState.showCropPicker,
    formState.showVarietyPicker,
    getGuidedFieldRef,
    guidedTourStatus,
    guidedTourStep,
    mode,
    scrollGuidedFieldToAnchor,
  ]);

  useEffect(() => {
    if (!isGuidedTourScrollLocked) return;
    const activeField = guidedTourLastFocusFieldRef.current;
    if (!activeField) return;
    const id = setTimeout(
      () => {
        scrollGuidedFieldToAnchor(getGuidedFieldRef(activeField), false);
      },
      keyboardHeight > 0 ? 40 : 0,
    );
    return () => clearTimeout(id);
  }, [getGuidedFieldRef, isGuidedTourScrollLocked, keyboardHeight, scrollGuidedFieldToAnchor]);

  // ---------------------------------------------------------------------------
  // Load farm data into form when editing
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Keyboard height tracking
  // ---------------------------------------------------------------------------

  useEffect(() => {
    return () => {
      if (guidedTopLockFrameRef.current !== null) {
        cancelAnimationFrame(guidedTopLockFrameRef.current);
        guidedTopLockFrameRef.current = null;
      }
    };
  }, []);

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

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

  const varieties = useMemo(() => {
    const baseVarieties =
      formState.selectedCrop === 'Other'
        ? ['Custom']
        : (CROP_VARIETIES[formState.selectedCrop] ?? ['Custom']);
    const selectedCustomVariety =
      formState.cropVariety &&
      formState.cropVariety !== 'Custom' &&
      !baseVarieties.includes(formState.cropVariety)
        ? [formState.cropVariety]
        : [];

    return [...selectedCustomVariety, ...baseVarieties];
  }, [formState.cropVariety, formState.selectedCrop]);

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
    () =>
      POPULAR_CROPS.map((crop) => knownCropOptions.find((option) => option.value === crop)).filter(
        (option): option is KnownCropOption => Boolean(option),
      ),
    [knownCropOptions],
  );

  const cropSearchQueryTrimmed = formState.cropSearchQuery.trim();
  const cropSearchQueryLower = cropSearchQueryTrimmed.toLowerCase();
  const varietySearchQueryTrimmed = formState.varietySearchQuery.trim();
  const varietySearchQueryLower = formState.varietySearchQuery.trim().toLowerCase();

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
  }, [varieties, varietySearchQueryLower, varietySearchQueryTrimmed]);

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
    () => Math.min(Math.round(windowHeight * 0.72), pickerAvailableHeight),
    [windowHeight, pickerAvailableHeight],
  );

  const textureSheetHeight = useMemo(
    () => Math.min(Math.round(windowHeight * 0.7), pickerAvailableHeight),
    [windowHeight, pickerAvailableHeight],
  );

  const isValid = useMemo(
    () =>
      isFarmCoreFieldsValid({
        name: formState.name,
        region: formState.region,
        area: formState.area,
        selectedCrop: formState.selectedCrop,
        customCropName: formState.customCropName,
        cropVariety: formState.cropVariety,
        customVariety: formState.customVariety,
      }),
    [
      formState.name,
      formState.region,
      formState.area,
      formState.selectedCrop,
      formState.customCropName,
      formState.cropVariety,
      formState.customVariety,
    ],
  );

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

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

  const getIsGuidedAddFarm = () => {
    const guidedTourState = useGuidedTourStore.getState();
    return (
      mode === 'add' &&
      guidedTourState.status === 'in_progress' &&
      guidedTourState.currentStep === 'add_farm'
    );
  };

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

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
    if (getIsGuidedAddFarm()) {
      guidedTourEmit('guidedTour.addFarmCropSelected', {
        crop: crop === 'Other' ? customCropName : crop,
        shouldAdvance: true,
      });
    }
  };

  const openCropPicker = () => {
    dismissFarmKeyboard();
    setFormState((prev) => ({ ...prev, showCropPicker: true }));
    if (getIsGuidedAddFarm()) {
      guidedTourEmit('guidedTour.addFarmCropPickerToggled', { open: true });
    }
  };

  const closeCropPicker = () => {
    setFormState((prev) => ({ ...prev, showCropPicker: false, cropSearchQuery: '' }));
    if (getIsGuidedAddFarm()) {
      guidedTourEmit('guidedTour.addFarmCropPickerToggled', { open: false });
    }
  };

  // Emit crop selection to guided tour when crop changes
  useEffect(() => {
    const guidedTourState = useGuidedTourStore.getState();
    if (
      mode !== 'add' ||
      guidedTourState.status !== 'in_progress' ||
      guidedTourState.currentStep !== 'add_farm'
    ) {
      return;
    }
    const emitCropSelection = () => {
      guidedTourEmit('guidedTour.addFarmCropSelected', {
        crop:
          formState.selectedCrop === 'Other' ? formState.customCropName : formState.selectedCrop,
        shouldAdvance: false,
      });
    };

    const selectedCropChanged = previousSelectedCropRef.current !== formState.selectedCrop;
    previousSelectedCropRef.current = formState.selectedCrop;

    if (selectedCropChanged || formState.selectedCrop !== 'Other') {
      emitCropSelection();
      return;
    }

    const timeout = setTimeout(() => {
      emitCropSelection();
    }, 300);

    return () => clearTimeout(timeout);
  }, [formState.customCropName, formState.selectedCrop, mode]);

  const handleSelectVariety = (variety: string) => {
    setFormState((prev) => ({
      ...prev,
      cropVariety: variety,
      showVarietyPicker: false,
      varietySearchQuery: '',
      customVariety: variety === 'Custom' ? '' : prev.customVariety,
    }));
    if (getIsGuidedAddFarm()) {
      guidedTourEmit('guidedTour.addFarmVarietySelected', { isCustom: variety === 'Custom' });
    }
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
      if (!Number.isFinite(parsed)) return null;
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

      const overflowMessage = optionalNumberValidation.error.limits
        .map(({ label, max }) => {
          const formattedMax = formatNumber(max);
          return t('farmForm.overflowError', {
            fields: label,
            max: formattedMax,
            defaultValue: `${label} must be less than or equal to ${formattedMax}.`,
          });
        })
        .join(' ');
      Alert.alert(t('common.error'), overflowMessage);
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

    const { crop: finalCrop, variety: finalVariety } = resolveFarmCoreSelection({
      selectedCrop: formState.selectedCrop,
      customCropName: formState.customCropName,
      cropVariety: formState.cropVariety,
      customVariety: formState.customVariety,
    });

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
        const sanitizedUpdates = getFarmPayloadMetadata(updates as Record<string, unknown>);
        console.error('Failed to update farm:', _error, {
          farmId,
          updates: sanitizedUpdates,
          errorMeta,
        });
        telemetry.capture('farm_update_failed', {
          farm_id: farmId,
          code: errorMeta.code ?? null,
          message: errorMeta.message ?? errorMessage,
          details: errorMeta.details ?? null,
          hint: errorMeta.hint ?? null,
          update_field_count: sanitizedUpdates.fieldCount,
        });
        if (shouldCaptureFarmErrorInSentry(errorMeta)) {
          Sentry.withScope((scope) => {
            scope.setTag('domain', 'farm');
            scope.setTag('operation', 'update');
            if (errorMeta.code) scope.setTag('db_code', errorMeta.code);
            scope.setExtra('farm_id', farmId);
            scope.setExtra('payload', sanitizedUpdates);
            scope.setExtra('db_error', errorMeta);
            Sentry.captureException(_error instanceof Error ? _error : new Error(errorMessage));
          });
        }
        Alert.alert(t('common.error'), errorMessage);
      }
      return;
    }

    const baseFarmData = buildFarmInsertFromCoreFields(
      {
        name: formState.name,
        region: formState.region,
        area: formState.area,
        selectedCrop: formState.selectedCrop,
        customCropName: formState.customCropName,
        cropVariety: formState.cropVariety,
        customVariety: formState.customVariety,
      },
      formState.plantingDate,
    );

    if (!baseFarmData) {
      Alert.alert(
        t('common.alerts.missingInformationTitle'),
        t('common.alerts.fillAllRequiredFields'),
      );
      return;
    }

    const farmData: FarmInsert = {
      ...baseFarmData,
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
      const createdFarm = await createFarm.mutateAsync(farmData);
      telemetry.capture('farm_created', {
        farm_id: createdFarm?.id ?? null,
        region: formState.region.trim(),
        area_acres: areaValue,
        crop: finalCrop,
        variety: finalVariety,
        soil_texture: formState.soilTextureClass || null,
      });
      triggerHapticSuccess();
      const guidedTourState = useGuidedTourStore.getState();
      if (guidedTourState.status === 'in_progress' && guidedTourState.currentStep === 'add_farm') {
        if (typeof createdFarm?.id === 'number') {
          guidedTourEmit('guidedTour.farmCreated', { farmId: createdFarm.id });
          return;
        }
      }
      onClose();
    } catch (_error: unknown) {
      const errorMessage = getErrorMessage(_error, t('common.errors.failedToCreateFarm'));
      const errorMeta = getFarmErrorMeta(_error);
      const sanitizedFarmData = getFarmPayloadMetadata(farmData as Record<string, unknown>);
      console.error('Failed to create farm:', _error, {
        farmData: sanitizedFarmData,
        errorMeta,
      });
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
          scope.setExtra('payload', sanitizedFarmData);
          scope.setExtra('db_error', errorMeta);
          Sentry.captureException(_error instanceof Error ? _error : new Error(errorMessage));
        });
      }
      Alert.alert(t('common.error'), errorMessage);
    }
  };

  // ---------------------------------------------------------------------------
  // Inline state setters exposed to the view
  // ---------------------------------------------------------------------------

  const setName = (v: string) => setFormState((prev) => ({ ...prev, name: v }));
  const setRegion = (v: string) => setFormState((prev) => ({ ...prev, region: v }));
  const setArea = (v: string) => {
    const sanitized = sanitizeDecimalInput(v);
    setFormState((prev) => ({ ...prev, area: sanitized }));
    return sanitized;
  };
  const setCustomCropName = (v: string) => setFormState((prev) => ({ ...prev, customCropName: v }));
  const setCustomVariety = (v: string) => setFormState((prev) => ({ ...prev, customVariety: v }));
  const setVineSpacing = (v: string) => setFormState((prev) => ({ ...prev, vineSpacing: v }));
  const setRowSpacing = (v: string) => setFormState((prev) => ({ ...prev, rowSpacing: v }));
  const setTotalTankCapacity = (v: string) =>
    setFormState((prev) => ({ ...prev, totalTankCapacity: v }));
  const setSystemDischarge = (v: string) =>
    setFormState((prev) => ({ ...prev, systemDischarge: v }));
  const setLocationName = (v: string) => setFormState((prev) => ({ ...prev, locationName: v }));
  const setLatitude = (v: string) => setFormState((prev) => ({ ...prev, latitude: v }));
  const setLongitude = (v: string) => setFormState((prev) => ({ ...prev, longitude: v }));
  const setElevation = (v: string) => setFormState((prev) => ({ ...prev, elevation: v }));
  const setBulkDensity = (v: string) => setFormState((prev) => ({ ...prev, bulkDensity: v }));
  const setCationExchangeCapacity = (v: string) =>
    setFormState((prev) => ({ ...prev, cationExchangeCapacity: v }));
  const setSoilWaterRetention = (v: string) =>
    setFormState((prev) => ({ ...prev, soilWaterRetention: v }));
  const setSandPercentage = (v: string) => setFormState((prev) => ({ ...prev, sandPercentage: v }));
  const setSiltPercentage = (v: string) => setFormState((prev) => ({ ...prev, siltPercentage: v }));
  const setClayPercentage = (v: string) => setFormState((prev) => ({ ...prev, clayPercentage: v }));
  const setShowVarietyPicker = (open: boolean) =>
    setFormState((prev) => ({ ...prev, showVarietyPicker: open, varietySearchQuery: '' }));
  const setShowTexturePicker = (open: boolean) =>
    setFormState((prev) => ({ ...prev, showTexturePicker: open }));
  const setSoilTextureClass = (value: string) =>
    setFormState((prev) => ({ ...prev, soilTextureClass: value, showTexturePicker: false }));
  const closeDatePicker = () => setFormState((prev) => ({ ...prev, showDatePicker: false }));
  const closePruningDatePicker = () =>
    setFormState((prev) => ({ ...prev, showPruningDatePicker: false }));
  const closeMapPicker = () => setFormState((prev) => ({ ...prev, showMapPicker: false }));

  // Android date-picker changes (committed immediately)
  const commitAndroidPlantingDate = (date: Date) => {
    setFormState((prev) => ({
      ...prev,
      plantingDate: date,
      plantingDateChanged: true,
      showDatePicker: false,
    }));
  };
  const commitAndroidPruningDate = (date: Date) => {
    setFormState((prev) => ({ ...prev, dateOfPruning: date, showPruningDatePicker: false }));
  };
  const clearPruningDate = () => setFormState((prev) => ({ ...prev, dateOfPruning: null }));
  const setCropSearchQuery = (v: string) =>
    setFormState((prev) => ({ ...prev, cropSearchQuery: v }));
  const setVarietySearchQuery = (v: string) =>
    setFormState((prev) => ({ ...prev, varietySearchQuery: v }));

  return {
    // Theme
    t,
    colors,
    m3,

    // Loading state
    farmLoading,
    isEdit,
    isValid,
    isLoading: createFarm.isPending || updateFarm.isPending,

    // Form state (read-only surface)
    formState,

    // Guided tour
    isGuidedTourScrollLocked,
    getIsGuidedAddFarm,

    // Derived values
    popularCropOptions,
    filteredCropOptions,
    filteredVarieties,
    canCreateCustomCrop,
    canCreateCustomVariety,
    selectedCropLabel,
    cropSearchQueryTrimmed,
    cropSearchQueryLower,
    varietySearchQueryTrimmed,
    soilCompositionWarning,
    varieties,
    androidKeyboardLift,
    cropSheetHeight,
    varietySheetHeight,
    textureSheetHeight,

    // Draft dates (iOS)
    iosPlantingDateDraft,
    setIosPlantingDateDraft,
    iosPruningDateDraft,
    setIosPruningDateDraft,

    // Refs
    formScrollViewRef,
    formScrollYRef,
    setFormScrollY,
    handleFormScrollY,
    nameInputRef,
    regionInputRef,
    areaInputRef,
    customCropInputRef,
    customVarietyInputRef,
    vineSpacingInputRef,
    rowSpacingInputRef,
    tankCapacityInputRef,
    systemDischargeInputRef,
    locationNameInputRef,
    latitudeInputRef,
    longitudeInputRef,
    elevationInputRef,
    bulkDensityInputRef,
    cecInputRef,
    soilWaterRetentionInputRef,
    sandInputRef,
    siltInputRef,
    clayInputRef,

    // Render helpers
    renderCropVisual,
    getSoilTextureLabel,
    getVarietyLabel,
    ensureValidDate,

    // Handlers
    handleSave,
    handleReset,
    handleSelectCrop,
    handleSelectVariety,
    handleOpenMapPicker,
    handleLocationSelected,
    openCropPicker,
    closeCropPicker,
    openPlantingDatePicker,
    commitPlantingDateFromDraft,
    closeDatePicker,
    openPruningDatePicker,
    commitPruningDateFromDraft,
    closePruningDatePicker,
    commitAndroidPlantingDate,
    commitAndroidPruningDate,
    clearPruningDate,
    closeMapPicker,
    setShowVarietyPicker,
    setShowTexturePicker,
    setSoilTextureClass,

    // Simple field setters
    setName,
    setRegion,
    setArea,
    setCustomCropName,
    setCustomVariety,
    setVineSpacing,
    setRowSpacing,
    setTotalTankCapacity,
    setSystemDischarge,
    setLocationName,
    setLatitude,
    setLongitude,
    setElevation,
    setBulkDensity,
    setCationExchangeCapacity,
    setSoilWaterRetention,
    setSandPercentage,
    setSiltPercentage,
    setClayPercentage,
    setCropSearchQuery,
    setVarietySearchQuery,
  };
}
