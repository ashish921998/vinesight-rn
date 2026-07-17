import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Alert,
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useCreateWarehouseItem,
  useUpdateWarehouseItem,
  useWarehouseItems,
  useMasterProducts,
  isIOS,
  useResponsiveHeight,
  useAndroidKeyboardLift,
} from '../../hooks';
import {
  CatalogInputType,
  CatalogMappingSource,
  CatalogMappingStatus,
  MasterCatalogProduct,
  NutrientCompositionItem,
  WarehouseItem,
  WarehouseItemType,
  WarehouseUnit,
} from '../../types';
import i18n from '@/i18n';
import { formatCurrency } from '@/i18n/format';
import { useCurrency } from '@/hooks/use-currency';
import {
  FormModal,
  SectionHeader,
  FormInput,
  PreviewCard,
  SegmentedControl,
} from '../ui/form-components';
import { ModalBackdrop } from '../ui/modal-backdrop';
import { useM3 } from '@/styles/use-theme';
import { borderRadius, componentRadius, fontSize, fontWeight, spacing } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { ICON_REGISTRY } from '@/constants/icon-registry';
import { NUTRIENT_CODES } from '@/constants/nutrient-definitions';
import { Symbol as UISymbol } from '@/components/ui/symbol';
import {
  isValidExpiryDate,
  listExistingManufacturers,
  resolveCatalogBulkDensityValue,
} from '@/features/purchase/product-form-data';

interface WarehouseItemFormProps {
  visible?: boolean;
  onClose: () => void;
  editingItem: WarehouseItem | null;
  presentation?: 'modal' | 'screen';
}

interface CompositionRow {
  id: string;
  nutrient_code: string;
  percent: string;
}

interface ManualCatalogueDraft {
  name: string;
  type: WarehouseItemType;
  unit: WarehouseUnit;
  manufacturer: string;
  densityKgPerL: string;
  compositionRows: CompositionRow[];
}

const VALID_WAREHOUSE_UNITS: WarehouseUnit[] = ['kg', 'liter', 'gram', 'ml'];

const UNIT_OPTIONS = VALID_WAREHOUSE_UNITS.map((u) => ({ value: u, label: u }));

const PRIMARY_NUTRIENTS = [
  { code: 'N', label: 'N (%)', accessibilityLabel: 'Nitrogen percentage' },
  { code: 'P2O5', label: 'P₂O₅ (%)', accessibilityLabel: 'Phosphate percentage' },
  { code: 'K2O', label: 'K₂O (%)', accessibilityLabel: 'Potash percentage' },
] as const;

const PRIMARY_NUTRIENT_CODES = new Set<string>(PRIMARY_NUTRIENTS.map(({ code }) => code));
const NON_STANDARD_GUARANTEED_ANALYSIS_CODES = new Set(['P', 'K']);

const NUTRIENT_LABELS: Record<string, string> = {
  Ca: 'Calcium (Ca)',
  CaO: 'Calcium oxide (CaO)',
  Mg: 'Magnesium (Mg)',
  MgO: 'Magnesium oxide (MgO)',
  S: 'Sulfur (S)',
  SO3: 'Sulfur trioxide (SO₃)',
  Fe: 'Iron (Fe)',
  Mn: 'Manganese (Mn)',
  Zn: 'Zinc (Zn)',
  Cu: 'Copper (Cu)',
  B: 'Boron (B)',
  Mo: 'Molybdenum (Mo)',
  Na: 'Sodium (Na)',
  Cl: 'Chloride (Cl)',
};

const OTHER_NUTRIENT_OPTIONS = NUTRIENT_CODES.filter(
  (code) => !PRIMARY_NUTRIENT_CODES.has(code) && !NON_STANDARD_GUARANTEED_ANALYSIS_CODES.has(code),
).map((code) => ({ code, label: NUTRIENT_LABELS[code] ?? code }));

const ITEM_TYPES = [
  {
    value: 'fertilizer' as WarehouseItemType,
    label: 'Fertilizer',
    icon: ICON_REGISTRY.fertigation,
  },
  { value: 'spray' as WarehouseItemType, label: 'Spray', icon: 'spraycan' as const },
];

function mapCatalogInputTypeToWarehouseType(inputType: CatalogInputType): WarehouseItemType {
  return inputType === 'fertilizer' ? 'fertilizer' : 'spray';
}

function mapWarehouseTypeToCatalogInputTypes(type: WarehouseItemType): CatalogInputType[] {
  if (type === 'fertilizer') {
    return ['fertilizer', 'biostimulant', 'other'];
  }
  return ['spray', 'adjuvant', 'biostimulant', 'other'];
}

function resolveDefaultWarehouseUnitForProduct(product: MasterCatalogProduct): WarehouseUnit {
  if (product.input_type === 'fertilizer') return 'kg';
  const formulation = (product.formulation ?? '').toUpperCase();
  const liquidTokens = ['EC', 'SL', 'SC', 'AS', 'EW', 'UL', 'CS'];
  if (liquidTokens.some((token) => formulation.includes(token))) return 'liter';
  return 'kg';
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getManufacturerBrandCandidates(manufacturer?: string | null): string[] {
  const value = manufacturer?.trim();
  if (!value) return [];

  const candidates = new Set<string>();
  const addCandidate = (candidate?: string | null) => {
    const normalized = candidate?.trim().replace(/\s+/g, ' ');
    if (!normalized || normalized.length < 2) return;
    candidates.add(normalized);
  };

  addCandidate(value);

  for (const match of value.matchAll(/\(([^)]+)\)/g)) {
    addCandidate(match[1]);
  }

  for (const part of value.split(/[/,-]/g)) {
    addCandidate(part);
  }

  return [...candidates].sort((a, b) => b.length - a.length);
}

function formatCatalogueProductDisplayName(product: MasterCatalogProduct): string {
  const sourceName = product.name?.trim() || '';
  if (!sourceName) return '';
  if (product.input_type !== 'fertilizer') return sourceName;

  let strippedName = sourceName;
  for (const candidate of getManufacturerBrandCandidates(product.manufacturer)) {
    const prefixPattern = new RegExp(`^${escapeRegExp(candidate)}(?=\\b|\\s|[\\-/:|.,])`, 'i');
    if (!prefixPattern.test(strippedName)) continue;

    strippedName = strippedName
      .replace(prefixPattern, '')
      .replace(/^[\s\-/:|.,]+/, '')
      .trim();
    break;
  }

  return strippedName.length >= 3 ? strippedName : sourceName;
}

function formatCatalogueProductSubtitle(product: MasterCatalogProduct): string {
  const parts = [product.manufacturer, product.active_ingredient, product.formulation]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  if (parts.length > 0) {
    return parts.join(' • ');
  }

  return product.input_type === 'fertilizer' ? 'Fertilizer' : 'Spray';
}

function mapCatalogCompositionsToRows(product: MasterCatalogProduct): CompositionRow[] {
  const rows = (product.compositions ?? []).map((composition) =>
    createCompositionRow({
      nutrient_code: composition.component_code,
      percent: composition.percent,
    }),
  );
  return rows;
}

function createCompositionRow(item?: Partial<NutrientCompositionItem>): CompositionRow {
  return {
    id: `comp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    nutrient_code: item?.nutrient_code ?? '',
    percent: item?.percent !== undefined ? String(item.percent) : '',
  };
}

function parseComposition(rows: CompositionRow[]): NutrientCompositionItem[] {
  return rows.reduce<NutrientCompositionItem[]>((result, row) => {
    const nutrientCode = row.nutrient_code.trim().toUpperCase();
    const rawPercent = row.percent?.trim() ?? '';
    if (!rawPercent) {
      return result;
    }

    const parsedPercent = Number(rawPercent);
    if (
      nutrientCode.length > 0 &&
      Number.isFinite(parsedPercent) &&
      parsedPercent >= 0 &&
      parsedPercent <= 100
    ) {
      result.push({
        nutrient_code: nutrientCode,
        percent: parsedPercent,
        basis: 'declared',
        notes: null,
      });
    }
    return result;
  }, []);
}

function normalizeNutrientCode(code: string): string {
  return code.trim().toUpperCase();
}

function isPrimaryNutrientCode(code: string): boolean {
  return PRIMARY_NUTRIENT_CODES.has(normalizeNutrientCode(code));
}

function formatNutrientLabel(code: string): string {
  const normalized = normalizeNutrientCode(code);
  const option = OTHER_NUTRIENT_OPTIONS.find(
    (candidate) => normalizeNutrientCode(candidate.code) === normalized,
  );
  return option?.label ?? code;
}

export default function WarehouseItemForm({
  visible,
  onClose,
  editingItem,
  presentation = 'modal',
}: WarehouseItemFormProps) {
  const m3 = useM3();
  const { windowHeight } = useResponsiveHeight();
  const insets = useSafeAreaInsets();
  const isVisible = visible ?? true;
  const createMutation = useCreateWarehouseItem();
  const updateMutation = useUpdateWarehouseItem();
  const { data: accountProducts } = useWarehouseItems();

  const [name, setName] = useState('');
  const [type, setType] = useState<WarehouseItemType>('fertilizer');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState<WarehouseUnit>('kg');
  const [unitPrice, setUnitPrice] = useState('');
  const [reorderQuantity, setReorderQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [densityKgPerL, setDensityKgPerL] = useState('');
  const [isCatalogDensityApplied, setIsCatalogDensityApplied] = useState(false);
  const [expiryDate, setExpiryDate] = useState('');
  const [compositionRows, setCompositionRows] = useState<CompositionRow[]>([]);
  const [compositionSource, setCompositionSource] = useState<'manual' | 'preset'>('manual');
  const [nutrientPickerRowId, setNutrientPickerRowId] = useState<string | null>(null);
  const [showSprayComposition, setShowSprayComposition] = useState(false);
  const [selectedCatalogProductId, setSelectedCatalogProductId] = useState<number | null>(null);
  const [catalogSelectionTouched, setCatalogSelectionTouched] = useState(false);
  const [catalogueSearchQuery, setCatalogueSearchQuery] = useState('');
  const [showCataloguePicker, setShowCataloguePicker] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [manualCatalogueDraft, setManualCatalogueDraft] = useState<ManualCatalogueDraft | null>(
    null,
  );

  const currency = useCurrency();
  const isEditing = !!editingItem;

  const catalogInputTypes = useMemo(() => mapWarehouseTypeToCatalogInputTypes(type), [type]);
  const {
    data: catalogProducts = [],
    isLoading: catalogProductsLoading,
    error: catalogProductsError,
  } = useMasterProducts({
    inputTypes: catalogInputTypes,
    stateCode: null,
  });
  const selectedCatalogProduct = useMemo(
    () => catalogProducts.find((product) => product.id === selectedCatalogProductId) ?? null,
    [catalogProducts, selectedCatalogProductId],
  );
  const existingManufacturers = useMemo(
    () => listExistingManufacturers(accountProducts),
    [accountProducts],
  );
  const manufacturerSuggestions = useMemo(() => {
    const query = manufacturer.trim().toLocaleLowerCase();
    if (!query) return existingManufacturers;
    return existingManufacturers.filter((name) => name.toLocaleLowerCase().includes(query));
  }, [existingManufacturers, manufacturer]);
  const [manufacturerFocused, setManufacturerFocused] = useState(false);
  const densitySourceUrl = selectedCatalogProduct?.density_source_url ?? null;
  const selectedCatalogHasDensity = selectedCatalogProduct?.density_kg_per_l != null;
  const densityRequired = unit === 'liter' || unit === 'ml';
  const primaryCompositionRows = useMemo(
    () =>
      new Map(
        compositionRows
          .filter((row) => isPrimaryNutrientCode(row.nutrient_code))
          .map((row) => [normalizeNutrientCode(row.nutrient_code), row]),
      ),
    [compositionRows],
  );
  const otherCompositionRows = useMemo(
    () => compositionRows.filter((row) => !isPrimaryNutrientCode(row.nutrient_code)),
    [compositionRows],
  );
  const nutrientPickerRow = useMemo(
    () => otherCompositionRows.find((row) => row.id === nutrientPickerRowId) ?? null,
    [otherCompositionRows, nutrientPickerRowId],
  );
  const selectedOtherNutrientCodes = useMemo(
    () =>
      new Set(
        otherCompositionRows
          .filter((row) => row.id !== nutrientPickerRowId)
          .map((row) => normalizeNutrientCode(row.nutrient_code))
          .filter(Boolean),
      ),
    [otherCompositionRows, nutrientPickerRowId],
  );

  // Track previous state to prevent unnecessary updates
  const prevVisibleRef = useRef(false);
  const prevEditingItemIdRef = useRef<number | undefined>(undefined);
  const filteredCatalogueItems = useMemo(() => {
    const query = catalogueSearchQuery.trim().toLowerCase();
    if (!query) return catalogProducts;
    return catalogProducts.filter((product) =>
      [
        product.name,
        product.manufacturer ?? '',
        product.active_ingredient ?? '',
        ...(product.aliases ?? []).map((alias) => alias.alias),
      ]
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [catalogProducts, catalogueSearchQuery]);
  const visibleCatalogueItems = useMemo(() => {
    if (!selectedCatalogProductId) return filteredCatalogueItems;
    if (filteredCatalogueItems.some((product) => product.id === selectedCatalogProductId))
      return filteredCatalogueItems;
    const selected = catalogProducts.find((product) => product.id === selectedCatalogProductId);
    return selected ? [selected, ...filteredCatalogueItems] : filteredCatalogueItems;
  }, [catalogProducts, filteredCatalogueItems, selectedCatalogProductId]);

  useEffect(() => {
    if (!showCataloguePicker) return;
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      setShowCataloguePicker(false);
      return true;
    });
    return () => backHandler.remove();
  }, [showCataloguePicker]);

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

  const catalogueSheetHeight = useMemo(
    () => Math.min(Math.round(windowHeight * 0.7), pickerAvailableHeight),
    [windowHeight, pickerAvailableHeight],
  );
  const nutrientSheetHeight = useMemo(
    () => Math.min(440, pickerAvailableHeight),
    [pickerAvailableHeight],
  );

  const androidKeyboardLift = useAndroidKeyboardLift(keyboardHeight, insets.bottom);

  const resetForm = () => {
    setName('');
    setType('fertilizer');
    setQuantity('');
    setUnit('kg');
    setUnitPrice('');
    setReorderQuantity('');
    setNotes('');
    setManufacturer('');
    setDensityKgPerL('');
    setIsCatalogDensityApplied(false);
    setExpiryDate('');
    setCompositionRows([]);
    setCompositionSource('manual');
    setNutrientPickerRowId(null);
    setShowSprayComposition(false);
    setSelectedCatalogProductId(null);
    setCatalogSelectionTouched(false);
    setCatalogueSearchQuery('');
    setShowCataloguePicker(false);
    setKeyboardHeight(0);
    setManualCatalogueDraft(null);
  };

  const handleReset = () => {
    const hasEnteredValues = Boolean(
      name.trim() ||
      quantity.trim() ||
      unitPrice.trim() ||
      reorderQuantity.trim() ||
      notes.trim() ||
      manufacturer.trim() ||
      densityKgPerL.trim() ||
      expiryDate.trim() ||
      selectedCatalogProductId ||
      compositionRows.some((row) => row.nutrient_code.trim() || row.percent.trim()),
    );
    if (!hasEnteredValues) {
      resetForm();
      return;
    }

    Alert.alert('Reset product?', 'This will clear all entered product details.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: resetForm },
    ]);
  };

  const applyCatalogProduct = (product: MasterCatalogProduct) => {
    setManualCatalogueDraft(
      (prev) =>
        prev ?? {
          name,
          type,
          unit,
          manufacturer,
          densityKgPerL,
          compositionRows: compositionRows.map((row) => ({ ...row })),
        },
    );
    const nextType = mapCatalogInputTypeToWarehouseType(product.input_type);
    setName(product.name);
    setType(nextType);
    setUnit(resolveDefaultWarehouseUnitForProduct(product));
    setManufacturer(product.manufacturer ?? '');
    const densityResolution = resolveCatalogBulkDensityValue({
      currentValue: densityKgPerL,
      isCurrentValueCatalogApplied: isCatalogDensityApplied,
      nextDensityKgPerL: product.density_kg_per_l,
    });
    setDensityKgPerL(densityResolution.value);
    setIsCatalogDensityApplied(densityResolution.isCatalogApplied);
    const catalogComposition = mapCatalogCompositionsToRows(product);
    setCompositionRows(catalogComposition);
    setCompositionSource('preset');
    setShowSprayComposition(nextType === 'spray' && catalogComposition.length > 0);
    setSelectedCatalogProductId(product.id);
    setCatalogSelectionTouched(true);
  };

  const clearCatalogSelection = () => {
    if (!selectedCatalogProductId) {
      setShowCataloguePicker(false);
      return;
    }
    if (manualCatalogueDraft) {
      setName(manualCatalogueDraft.name);
      setType(manualCatalogueDraft.type);
      setUnit(manualCatalogueDraft.unit);
      setManufacturer(manualCatalogueDraft.manufacturer);
      setDensityKgPerL(manualCatalogueDraft.densityKgPerL);
      setIsCatalogDensityApplied(false);
      setCompositionRows(
        manualCatalogueDraft.compositionRows.length > 0
          ? manualCatalogueDraft.compositionRows.map((row) => ({ ...row }))
          : [],
      );
      setShowSprayComposition(
        manualCatalogueDraft.type === 'spray' && manualCatalogueDraft.compositionRows.length > 0,
      );
    }

    setCompositionSource('manual');
    setSelectedCatalogProductId(null);
    setCatalogSelectionTouched(true);
    setShowCataloguePicker(false);
    setManualCatalogueDraft(null);
  };

  const markCompositionManual = () => {
    setCompositionSource('manual');
    setSelectedCatalogProductId(null);
    setCatalogSelectionTouched(true);
    setManualCatalogueDraft(null);
  };

  const closeNutrientPicker = () => {
    if (nutrientPickerRow && !nutrientPickerRow.nutrient_code && !nutrientPickerRow.percent) {
      setCompositionRows((prev) => prev.filter((row) => row.id !== nutrientPickerRow.id));
    }
    setNutrientPickerRowId(null);
  };

  const updateCompositionRow = (id: string, updates: Partial<CompositionRow>) => {
    setCompositionRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...updates } : row)));
    markCompositionManual();
  };

  const updatePrimaryNutrient = (code: string, percent: string) => {
    setCompositionRows((prev) => {
      const existingRow = prev.find((row) => normalizeNutrientCode(row.nutrient_code) === code);
      if (existingRow) {
        return prev.map((row) => (row.id === existingRow.id ? { ...row, percent } : row));
      }
      return [...prev, { ...createCompositionRow({ nutrient_code: code }), percent }];
    });
    markCompositionManual();
  };

  const addCompositionRow = () => {
    if (compositionRows.length >= 12) return;
    const row = createCompositionRow();
    setCompositionRows((prev) => [...prev, row]);
    markCompositionManual();
    setNutrientPickerRowId(row.id);
  };

  const removeCompositionRow = (id: string) => {
    setCompositionRows((prev) => {
      return prev.filter((row) => row.id !== id);
    });
    markCompositionManual();
    setNutrientPickerRowId((current) => (current === id ? null : current));
  };
  const handleTypeSelect = (nextType: WarehouseItemType) => {
    if (nextType === type) return;
    if (isCatalogDensityApplied) setDensityKgPerL('');
    if (compositionSource === 'preset') setCompositionRows([]);
    setIsCatalogDensityApplied(false);
    setType(nextType);
    setShowSprayComposition(false);
    setCompositionSource('manual');
    setSelectedCatalogProductId(null);
    setCatalogSelectionTouched(true);
    setManualCatalogueDraft(null);
  };

  // Reset form when modal opens/closes or editing item changes
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    // Only update when modal becomes visible or editingItem changes
    if (isVisible) {
      const shouldUpdate =
        !prevVisibleRef.current || editingItem?.id !== prevEditingItemIdRef.current;

      if (shouldUpdate) {
        if (editingItem) {
          setShowCataloguePicker(false);
          setKeyboardHeight(0);
          setManualCatalogueDraft(null);
          setName(editingItem.name);
          setType(editingItem.type as WarehouseItemType);
          setQuantity(editingItem.quantity.toString());
          setUnit(editingItem.unit as WarehouseUnit);
          setUnitPrice(editingItem.unit_price.toString());
          setReorderQuantity(editingItem.reorder_quantity?.toString() || '');
          setNotes(editingItem.notes || '');
          setManufacturer(editingItem.manufacturer || '');
          setDensityKgPerL(
            editingItem.density_kg_per_l ? String(editingItem.density_kg_per_l) : '',
          );
          setIsCatalogDensityApplied(false);
          setExpiryDate(editingItem.expiry_date ?? '');
          const existingComposition = editingItem.composition ?? [];
          setCompositionRows(
            existingComposition.length > 0
              ? existingComposition.map((entry) => createCompositionRow(entry))
              : [],
          );
          setNutrientPickerRowId(null);
          setShowSprayComposition(editingItem.type === 'spray' && existingComposition.length > 0);
          setCompositionSource(editingItem.composition_source === 'preset' ? 'preset' : 'manual');
          setSelectedCatalogProductId(editingItem.catalog_product_id ?? null);
          setCatalogSelectionTouched(false);
          setCatalogueSearchQuery('');
        } else {
          resetForm();
        }
      }
    }
    prevVisibleRef.current = isVisible;
    prevEditingItemIdRef.current = editingItem?.id;
  }, [isVisible, editingItem]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleSubmit = async () => {
    // Validation
    if (!name.trim()) {
      Alert.alert(i18n.t('common.error'), i18n.t('common.errors.enterItemName'));
      return;
    }
    const quantityValue = Number(quantity);
    if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
      Alert.alert(i18n.t('common.error'), i18n.t('common.errors.enterValidQuantity'));
      return;
    }
    const unitPriceValue = Number(unitPrice);
    if (!Number.isFinite(unitPriceValue) || unitPriceValue <= 0) {
      Alert.alert(i18n.t('common.error'), i18n.t('common.errors.enterValidUnitPrice'));
      return;
    }
    if (!isValidExpiryDate(expiryDate)) {
      Alert.alert(i18n.t('common.error'), 'Enter expiry date as YYYY-MM-DD.');
      return;
    }

    const composition = parseComposition(compositionRows);
    if (type === 'fertilizer' && composition.length === 0) {
      Alert.alert(
        i18n.t('common.error'),
        'Add at least one valid nutrient composition row for fertilizer.',
      );
      return;
    }

    const densityValue = Number(densityKgPerL);
    const parsedDensity =
      densityKgPerL.trim().length > 0 && Number.isFinite(densityValue) && densityValue > 0
        ? densityValue
        : null;
    if (densityRequired && parsedDensity == null) {
      Alert.alert(i18n.t('common.error'), 'Enter bulk density for products stored by volume.');
      return;
    }
    const previousCatalogProductId = editingItem?.catalog_product_id ?? null;
    const previousCatalogMappingStatus = editingItem?.catalog_mapping_status ?? 'unmapped';
    const previousCatalogMappingSource = editingItem?.catalog_mapping_source ?? 'manual';
    const previousCatalogMappedAt = editingItem?.catalog_mapped_at ?? null;
    const preservePreviousCatalogMapping =
      selectedCatalogProductId != null &&
      !selectedCatalogProduct &&
      previousCatalogProductId != null &&
      previousCatalogProductId === selectedCatalogProductId;
    const resolvedCatalogProductId =
      selectedCatalogProduct?.id ??
      (catalogSelectionTouched
        ? selectedCatalogProductId
        : (selectedCatalogProductId ?? previousCatalogProductId));

    const itemData = {
      name: name.trim(),
      type,
      quantity: quantityValue,
      unit,
      unit_price: unitPriceValue,
      reorder_quantity: reorderQuantity ? parseFloat(reorderQuantity) : null,
      notes: notes.trim() || null,
      manufacturer: manufacturer.trim() || null,
      density_kg_per_l: parsedDensity,
      expiry_date: expiryDate.trim() || null,
      composition,
      composition_source: compositionSource,
      composition_updated_at: new Date().toISOString(),
      catalog_product_id: resolvedCatalogProductId,
      catalog_mapping_status: (selectedCatalogProduct
        ? selectedCatalogProduct.verification_tier === 'verified'
          ? 'mapped_verified'
          : 'mapped_provisional'
        : preservePreviousCatalogMapping
          ? previousCatalogMappingStatus
          : 'unmapped') as CatalogMappingStatus,
      catalog_mapping_source: (selectedCatalogProduct
        ? 'preset'
        : preservePreviousCatalogMapping
          ? previousCatalogMappingSource
          : 'manual') as CatalogMappingSource,
      catalog_mapped_at: selectedCatalogProduct
        ? new Date().toISOString()
        : preservePreviousCatalogMapping
          ? previousCatalogMappedAt
          : null,
    };

    try {
      if (isEditing && editingItem?.id) {
        await updateMutation.mutateAsync({
          id: editingItem.id,
          updates: itemData,
        });
      } else {
        await createMutation.mutateAsync(itemData);
      }
      onClose();
    } catch (error) {
      const details =
        typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message?: unknown }).message ?? '')
          : '';
      const needsMigration =
        details.includes('column') ||
        details.includes('composition') ||
        details.includes('schema cache');
      Alert.alert(
        i18n.t('common.error'),
        needsMigration
          ? `${i18n.t('common.errors.failedToSaveItem')}\n\nDB schema may be missing catalog/mapping columns. Please apply the latest Supabase migration and retry.\n\n${details}`
          : i18n.t('common.errors.failedToSaveItem'),
      );
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;
  const validComposition = parseComposition(compositionRows);
  const compositionRequiredSatisfied = type === 'spray' || validComposition.length > 0;
  const isValid =
    name.trim() &&
    quantity &&
    Number.isFinite(Number(quantity)) &&
    Number(quantity) > 0 &&
    unitPrice &&
    Number.isFinite(Number(unitPrice)) &&
    Number(unitPrice) > 0 &&
    (!densityRequired ||
      (densityKgPerL.trim().length > 0 &&
        Number.isFinite(Number(densityKgPerL)) &&
        Number(densityKgPerL) > 0)) &&
    isValidExpiryDate(expiryDate) &&
    compositionRequiredSatisfied;

  const totalValue =
    quantity && unitPrice ? (parseFloat(quantity) * parseFloat(unitPrice)).toFixed(2) : '0.00';

  useEffect(() => {
    if (__DEV__ && !catalogProductsLoading && catalogProductsError) {
      console.debug('Catalog products error: PHI catalog migration/seed data issue');
    }
  }, [catalogProductsLoading, catalogProductsError]);

  return (
    <View style={{ flex: 1 }}>
      <FormModal
        visible={isVisible}
        onClose={onClose}
        title={isEditing ? 'Edit Product' : 'Add Product'}
        onSave={handleSubmit}
        saveLabel={isEditing ? 'Save Changes' : 'Add Product'}
        isLoading={isLoading}
        isSaveDisabled={!isValid}
        showResetButton={!isEditing}
        onReset={handleReset}
        presentation={presentation}
        headerTopInsetCap={28}
        contentContainerStyle={{ paddingBottom: 128 }}
      >
        <SectionHeader
          title="Item Type"
          subtitle="Select fertilizer or spray."
          style={{ marginBottom: spacing[3] }}
        />

        <View style={{ marginBottom: spacing[5] }}>
          <SegmentedControl
            options={ITEM_TYPES}
            selectedValue={type}
            onSelect={(value) => handleTypeSelect(value as WarehouseItemType)}
            accessibilityLabel="Item type"
          />
        </View>

        <SectionHeader
          title="Catalogue"
          subtitle="Optional. Select a product or enter it manually."
          style={{ marginBottom: 12 }}
        />

        <Pressable
          style={{
            backgroundColor: m3.surface.s100,
            borderWidth: 2,
            borderColor: m3.surface.s200,
            borderRadius: componentRadius.input,
            paddingHorizontal: spacing[4],
            paddingVertical: spacing[4],
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: spacing[2],
          }}
          onPress={() => {
            setCatalogueSearchQuery('');
            setShowCataloguePicker(true);
          }}
        >
          <Text
            style={{
              fontSize: fontSize.base,
              color: selectedCatalogProductId ? m3.surface.s900 : m3.surface.s400,
              fontWeight: selectedCatalogProductId ? fontWeight.medium : fontWeight.normal,
              flex: 1,
            }}
            numberOfLines={1}
          >
            {selectedCatalogProduct
              ? formatCatalogueProductDisplayName(selectedCatalogProduct)
              : 'Select from catalogue (or skip)'}
          </Text>
          <UISymbol name="chevron.down" size={20} color={m3.colorScheme.onSurfaceVariant} />
        </Pressable>

        {selectedCatalogProduct ? (
          <Text
            style={{
              marginBottom: spacing[4],
              color: m3.colorScheme.onSurfaceVariant,
              fontSize: fontSize.xs,
            }}
          >
            Catalogue defaults applied. You can edit the item details below.
          </Text>
        ) : null}

        <SectionHeader title="Product" style={{ marginBottom: 16 }} />

        <FormInput
          label="Item Name"
          value={name}
          onChangeText={setName}
          placeholder="e.g., NPK 19:19:19"
          required
          style={{ marginBottom: 12 }}
        />

        <SectionHeader title="Quantity & Unit" style={{ marginBottom: 12 }} />

        <FormInput
          label="Quantity"
          value={quantity}
          onChangeText={setQuantity}
          placeholder="0"
          keyboardType="decimal-pad"
          required
          style={{ marginBottom: spacing[3] }}
        />
        <Text
          style={{
            fontSize: fontSize.xs,
            fontWeight: fontWeight.medium,
            color: m3.surface.s500,
            marginBottom: spacing[2],
          }}
        >
          Unit
        </Text>
        <View style={{ marginBottom: densityRequired ? spacing[3] : 20 }}>
          <SegmentedControl
            options={UNIT_OPTIONS}
            selectedValue={unit}
            onSelect={(value) => setUnit(value as WarehouseUnit)}
            accessibilityLabel="Quantity unit"
          />
        </View>

        {densityRequired ? (
          <View>
            <FormInput
              label="Bulk Density (kg/L)"
              value={densityKgPerL}
              onChangeText={(value) => {
                setDensityKgPerL(value);
                setIsCatalogDensityApplied(false);
              }}
              placeholder={selectedCatalogProduct ? 'Enter from package label' : 'e.g. 1.00'}
              keyboardType="decimal-pad"
              required
              style={{ marginBottom: densitySourceUrl ? 4 : 16 }}
            />

            <View
              style={{
                marginBottom: 20,
                flexDirection: 'row',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: spacing[1],
              }}
            >
              <Text style={{ color: m3.colorScheme.onSurfaceVariant, fontSize: fontSize.xs }}>
                {isCatalogDensityApplied
                  ? 'Filled from catalogue data. Verify against the package label.'
                  : selectedCatalogHasDensity
                    ? 'Your entered value was kept. Verify against the package label or compare with the catalogue.'
                    : selectedCatalogProduct
                      ? 'Not available in the catalogue. Enter the value printed on the package label.'
                      : 'Enter the value printed on the package label.'}
              </Text>
              {densitySourceUrl ? (
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel="View bulk density source"
                  onPress={() => void Linking.openURL(densitySourceUrl)}
                  hitSlop={8}
                >
                  <Text
                    style={{
                      color: m3.primary.p600,
                      fontSize: fontSize.xs,
                      fontWeight: fontWeight.semibold,
                    }}
                  >
                    View source
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}

        <SectionHeader title="Purchase Price" style={{ marginBottom: 12 }} />

        <FormInput
          label={`Unit Price (${currency})`}
          value={unitPrice}
          onChangeText={setUnitPrice}
          placeholder="0.00"
          keyboardType="decimal-pad"
          prefix={currency === 'INR' ? '₹' : '$'}
          suffix={`per ${unit}`}
          required
          style={{ marginBottom: quantity && unitPrice ? 12 : 20 }}
        />

        {quantity && unitPrice ? (
          <PreviewCard
            title="TOTAL VALUE"
            items={[
              {
                label: `${quantity} ${unit} × ${currency === 'INR' ? '₹' : '$'}${unitPrice}`,
                value: formatCurrency(parseFloat(totalValue), currency),
              },
            ]}
            backgroundColor={colorWithOpacity(m3.colorScheme.success, 0.12)}
          />
        ) : null}

        <SectionHeader title="Product Details" style={{ marginBottom: 16 }} />

        <View style={{ marginBottom: 12 }}>
          <Text
            style={{
              fontSize: fontSize.xs,
              fontWeight: fontWeight.medium,
              color: m3.surface.s500,
              marginBottom: spacing[2],
            }}
          >
            Manufacturer (Optional)
          </Text>
          <View
            style={{
              backgroundColor: m3.surface.s100,
              borderWidth: 1,
              borderColor: m3.surface.s300,
              borderRadius: borderRadius.sm,
              minHeight: 48,
              overflow: 'hidden',
            }}
          >
            <TextInput
              value={manufacturer}
              onChangeText={setManufacturer}
              placeholder="e.g., Vanita Agro"
              placeholderTextColor={m3.neutral.n400}
              onFocus={() => setManufacturerFocused(true)}
              onBlur={() => setManufacturerFocused(false)}
              autoCorrect={false}
              style={{
                paddingHorizontal: spacing[4],
                paddingVertical: spacing[3],
                fontSize: fontSize.base,
                color: m3.surface.s900,
              }}
            />
          </View>
          {manufacturerFocused &&
          manufacturer.trim().length > 0 &&
          manufacturerSuggestions.length > 0 ? (
            <View
              style={{
                marginTop: 4,
                borderRadius: borderRadius.sm,
                borderWidth: 1,
                borderColor: m3.surface.s200,
                backgroundColor: m3.colorScheme.surface,
                maxHeight: 200,
                overflow: 'hidden',
              }}
            >
              {manufacturerSuggestions.slice(0, 8).map((suggestion, index) => (
                <Pressable
                  key={suggestion}
                  onPressIn={() => setManufacturer(suggestion)}
                  style={{
                    paddingHorizontal: spacing[4],
                    paddingVertical: spacing[3],
                    borderTopWidth: index === 0 ? 0 : 1,
                    borderTopColor: m3.surface.s100,
                  }}
                >
                  <Text style={{ fontSize: fontSize.sm, color: m3.surface.s900 }}>
                    {suggestion}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        <FormInput
          label="Expiry Date (Optional)"
          value={expiryDate}
          onChangeText={setExpiryDate}
          placeholder="YYYY-MM-DD"
          style={{ marginBottom: 12 }}
        />

        <FormInput
          label="Notes (Optional)"
          value={notes}
          onChangeText={setNotes}
          placeholder="Any additional details..."
          multiline
          numberOfLines={2}
          style={{ marginBottom: 16 }}
        />

        {type === 'spray' && !showSprayComposition && validComposition.length === 0 ? (
          <Pressable
            onPress={() => setShowSprayComposition(true)}
            accessibilityRole="button"
            accessibilityLabel="Add nutrient analysis"
            style={{ alignSelf: 'flex-start', marginBottom: 20, paddingVertical: spacing[2] }}
          >
            <Text style={{ color: m3.primary.p600, fontWeight: fontWeight.semibold }}>
              + Add nutrient analysis
            </Text>
          </Pressable>
        ) : (
          <>
            <SectionHeader
              title="Guaranteed Analysis"
              subtitle={
                type === 'fertilizer'
                  ? 'Required. Copy the percentages printed on the package label.'
                  : 'Optional. Copy the percentages printed on the package label.'
              }
              style={{ marginBottom: 12 }}
            />

            {compositionSource === 'preset' ? (
              <View
                style={{
                  marginBottom: spacing[3],
                  padding: spacing[3],
                  borderRadius: borderRadius.sm,
                  backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.08),
                }}
              >
                <Text style={{ color: m3.surface.s800, fontSize: fontSize.xs }}>
                  Catalogue analysis applied. Editing a value uses a manual analysis.
                </Text>
              </View>
            ) : null}

            <View style={{ flexDirection: 'row', gap: spacing[2], marginBottom: spacing[4] }}>
              {PRIMARY_NUTRIENTS.map(({ code, label, accessibilityLabel }) => (
                <View key={code} style={{ flex: 1 }}>
                  <FormInput
                    label={label}
                    accessibilityLabel={accessibilityLabel}
                    value={primaryCompositionRows.get(code)?.percent ?? ''}
                    onChangeText={(percent) => updatePrimaryNutrient(code, percent)}
                    placeholder="0"
                    keyboardType="decimal-pad"
                    style={{ marginBottom: 0 }}
                  />
                </View>
              ))}
            </View>

            <Text
              style={{
                marginBottom: spacing[2],
                color: m3.surface.s500,
                fontSize: fontSize.xs,
                fontWeight: fontWeight.medium,
              }}
            >
              Other guaranteed nutrients
            </Text>

            {otherCompositionRows.length > 0 ? (
              <View style={{ flexDirection: 'row', gap: spacing[2], marginBottom: spacing[2] }}>
                <Text
                  style={{
                    flex: 1,
                    color: m3.surface.s500,
                    fontSize: fontSize.xs,
                    fontWeight: fontWeight.medium,
                  }}
                >
                  Nutrient
                </Text>
                <Text
                  style={{
                    width: 96,
                    color: m3.surface.s500,
                    fontSize: fontSize.xs,
                    fontWeight: fontWeight.medium,
                  }}
                >
                  Percent
                </Text>
                <View style={{ width: 32 }} />
              </View>
            ) : null}

            {otherCompositionRows.map((row) => (
              <View key={row.id} style={{ flexDirection: 'row', gap: spacing[2], marginBottom: 8 }}>
                <Pressable
                  onPress={() => setNutrientPickerRowId(row.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Select nutrient, currently ${formatNutrientLabel(row.nutrient_code)}`}
                  style={{
                    flex: 1,
                    minHeight: 48,
                    paddingHorizontal: spacing[3],
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderWidth: 1,
                    borderColor: m3.surface.s300,
                    borderRadius: borderRadius.sm,
                    backgroundColor: m3.surface.s100,
                  }}
                >
                  <Text
                    style={{
                      color: row.nutrient_code ? m3.surface.s900 : m3.neutral.n400,
                      fontSize: fontSize.sm,
                    }}
                    numberOfLines={1}
                  >
                    {row.nutrient_code ? formatNutrientLabel(row.nutrient_code) : 'Select nutrient'}
                  </Text>
                  <UISymbol name="chevron.down" size={16} color={m3.colorScheme.onSurfaceVariant} />
                </Pressable>
                <View style={{ width: 96 }}>
                  <FormInput
                    label=""
                    accessibilityLabel={`${formatNutrientLabel(row.nutrient_code || 'nutrient')} percentage`}
                    value={row.percent}
                    onChangeText={(percent) => updateCompositionRow(row.id, { percent })}
                    placeholder="0"
                    keyboardType="decimal-pad"
                    style={{ marginBottom: 0 }}
                  />
                </View>
                <Pressable
                  onPress={() => removeCompositionRow(row.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${formatNutrientLabel(row.nutrient_code || 'nutrient')}`}
                  hitSlop={8}
                  style={{ width: 32, alignItems: 'center', justifyContent: 'center' }}
                >
                  <UISymbol name="minus.circle" size={20} color={m3.colorScheme.error} />
                </Pressable>
              </View>
            ))}

            <Pressable
              onPress={addCompositionRow}
              accessibilityRole="button"
              accessibilityLabel="Add another guaranteed nutrient"
              style={{ alignSelf: 'flex-start', marginBottom: 20, paddingVertical: spacing[2] }}
            >
              <Text style={{ color: m3.primary.p600, fontWeight: fontWeight.semibold }}>
                + Add nutrient
              </Text>
            </Pressable>
          </>
        )}

        <SectionHeader title="Stock Preference" style={{ marginBottom: 16 }} />

        <FormInput
          label="Low Stock Alert (Optional)"
          value={reorderQuantity}
          onChangeText={setReorderQuantity}
          placeholder="Leave empty to disable"
          keyboardType="decimal-pad"
          suffix={unit}
          style={{ marginBottom: 12 }}
        />
      </FormModal>

      {nutrientPickerRow && (
        <ModalBackdrop
          visible
          onDismiss={closeNutrientPicker}
          alignment="flex-end"
          opacity={0.5}
          zIndex={2}
        >
          <Pressable
            onPress={() => {}}
            style={{
              height: nutrientSheetHeight,
              backgroundColor: m3.surface.s100,
              borderTopLeftRadius: borderRadius['3xl'],
              borderTopRightRadius: borderRadius['3xl'],
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
                borderBottomColor: m3.surface.s200,
              }}
            >
              <View style={{ width: 40 }} />
              <Text
                style={{
                  fontSize: fontSize.lg,
                  fontWeight: fontWeight.semibold,
                  color: m3.surface.s900,
                }}
              >
                Select nutrient
              </Text>
              <Pressable
                onPress={closeNutrientPicker}
                accessibilityRole="button"
                accessibilityLabel="Close nutrient picker"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: borderRadius.full,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <UISymbol name="xmark" size={20} color={m3.colorScheme.onSurface} />
              </Pressable>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled">
              {OTHER_NUTRIENT_OPTIONS.map((option) => {
                const isSelected =
                  normalizeNutrientCode(nutrientPickerRow.nutrient_code) ===
                  normalizeNutrientCode(option.code);
                const isUnavailable = selectedOtherNutrientCodes.has(
                  normalizeNutrientCode(option.code),
                );

                return (
                  <Pressable
                    key={option.code}
                    disabled={isUnavailable}
                    onPress={() => {
                      updateCompositionRow(nutrientPickerRow.id, { nutrient_code: option.code });
                      setNutrientPickerRowId(null);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={option.label}
                    accessibilityState={{ disabled: isUnavailable, selected: isSelected }}
                    style={{
                      paddingHorizontal: spacing[6],
                      paddingVertical: spacing[4],
                      borderBottomWidth: 1,
                      borderBottomColor: m3.surface.s100,
                      backgroundColor: isSelected ? m3.surface.s50 : m3.surface.s100,
                      opacity: isUnavailable ? 0.45 : 1,
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
                          color: m3.surface.s900,
                          fontSize: fontSize.base,
                          fontWeight: isSelected ? fontWeight.semibold : fontWeight.normal,
                        }}
                      >
                        {option.label}
                      </Text>
                      {isSelected ? (
                        <UISymbol name="checkmark" size={20} color={m3.primary.p500} />
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </ModalBackdrop>
      )}

      {/* Catalogue Picker Bottom Sheet */}
      {showCataloguePicker && (
        <ModalBackdrop
          visible
          onDismiss={() => setShowCataloguePicker(false)}
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
                backgroundColor: m3.surface.s100,
                borderTopLeftRadius: borderRadius['3xl'],
                borderTopRightRadius: borderRadius['3xl'],
                height: catalogueSheetHeight,
              }}
            >
              {/* Header */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: spacing[6],
                  paddingVertical: spacing[4],
                  borderBottomWidth: 1,
                  borderBottomColor: m3.surface.s200,
                }}
              >
                <View style={{ width: 40 }} />
                <Text
                  style={{
                    fontSize: fontSize.lg,
                    fontWeight: fontWeight.semibold,
                    color: m3.surface.s900,
                  }}
                >
                  Select from Catalogue
                </Text>
                <Pressable
                  onPress={() => setShowCataloguePicker(false)}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: borderRadius.full,
                    backgroundColor: m3.surface.s100,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <UISymbol name="xmark" size={20} color={m3.colorScheme.onSurface} />
                </Pressable>
              </View>

              {/* Search */}
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
                    borderColor: m3.surface.s200,
                    borderRadius: borderRadius.xl,
                    backgroundColor: m3.surface.s50,
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
                    value={catalogueSearchQuery}
                    onChangeText={setCatalogueSearchQuery}
                    placeholder="Search by product, grade, or manufacturer"
                    placeholderTextColor={m3.surface.s400}
                    style={{
                      flex: 1,
                      marginLeft: spacing[2],
                      color: m3.surface.s900,
                      fontSize: fontSize.base,
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>

              {/* "Skip / No selection" option */}
              <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
                <Pressable
                  style={{
                    paddingVertical: spacing[4],
                    paddingLeft: spacing[8],
                    paddingRight: spacing[6],
                    borderBottomWidth: 1,
                    borderBottomColor: m3.surface.s100,
                    backgroundColor: !selectedCatalogProductId ? m3.surface.s50 : m3.surface.s100,
                  }}
                  onPress={() => {
                    clearCatalogSelection();
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
                        color: m3.surface.s900,
                        fontWeight: !selectedCatalogProductId
                          ? fontWeight.semibold
                          : fontWeight.medium,
                        fontStyle: 'italic',
                      }}
                    >
                      Skip (manual entry)
                    </Text>
                    {!selectedCatalogProductId && (
                      <UISymbol name="checkmark" size={20} color={m3.primary.p500} />
                    )}
                  </View>
                </Pressable>

                {/* Catalogue items */}
                {visibleCatalogueItems.map((product) => (
                  <Pressable
                    key={product.id}
                    style={{
                      paddingVertical: spacing[4],
                      paddingLeft: spacing[8],
                      paddingRight: spacing[6],
                      borderBottomWidth: 1,
                      borderBottomColor: m3.surface.s100,
                      backgroundColor:
                        selectedCatalogProductId === product.id ? m3.surface.s50 : m3.surface.s100,
                    }}
                    onPress={() => {
                      applyCatalogProduct(product);
                      setShowCataloguePicker(false);
                    }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <View style={{ flex: 1, marginRight: spacing[3] }}>
                        <Text
                          style={{
                            fontSize: fontSize.base,
                            color: m3.surface.s900,
                            fontWeight:
                              selectedCatalogProductId === product.id
                                ? fontWeight.semibold
                                : fontWeight.medium,
                          }}
                          numberOfLines={1}
                        >
                          {formatCatalogueProductDisplayName(product)}
                        </Text>
                        <Text
                          style={{
                            fontSize: fontSize.xs,
                            color: m3.surface.s600,
                            marginTop: 2,
                          }}
                          numberOfLines={1}
                        >
                          {formatCatalogueProductSubtitle(product)}
                        </Text>
                      </View>
                      {selectedCatalogProductId === product.id && (
                        <UISymbol name="checkmark" size={20} color={m3.primary.p500} />
                      )}
                    </View>
                  </Pressable>
                ))}

                {catalogProductsLoading && (
                  <View style={{ paddingHorizontal: spacing[6], paddingVertical: spacing[5] }}>
                    <Text style={{ fontSize: fontSize.sm, color: m3.surface.s500 }}>
                      Loading catalogue items...
                    </Text>
                  </View>
                )}

                {!catalogProductsLoading && catalogProductsError && (
                  <View style={{ paddingHorizontal: spacing[6], paddingVertical: spacing[5] }}>
                    <Text style={{ fontSize: fontSize.sm, color: m3.colorScheme.error }}>
                      Could not load catalogue items. Please try again later.
                    </Text>
                  </View>
                )}

                {!catalogProductsLoading &&
                  !catalogProductsError &&
                  visibleCatalogueItems.length === 0 && (
                    <View style={{ paddingHorizontal: spacing[6], paddingVertical: spacing[5] }}>
                      <Text style={{ fontSize: fontSize.sm, color: m3.surface.s500 }}>
                        {catalogProducts.length === 0
                          ? 'No catalogue items available yet. PHI catalog may not be seeded in this environment.'
                          : 'No catalogue matches found.'}
                      </Text>
                    </View>
                  )}
              </ScrollView>
            </Pressable>
          </KeyboardAvoidingView>
        </ModalBackdrop>
      )}
    </View>
  );
}
