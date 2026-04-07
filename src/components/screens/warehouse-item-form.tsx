import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Alert,
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
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
  PillSelector,
  FormInput,
  PreviewCard,
} from '../ui/form-components';
import { ModalBackdrop } from '../ui/modal-backdrop';
import { useM3, useThemeColors } from '@/styles/use-theme';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { ICON_REGISTRY } from '@/constants/icon-registry';
import { Symbol as UISymbol } from '@/components/ui/symbol';

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
  compositionRows: CompositionRow[];
}

const VALID_WAREHOUSE_UNITS: WarehouseUnit[] = ['kg', 'liter', 'gram', 'ml'];

const UNIT_OPTIONS = VALID_WAREHOUSE_UNITS.map((u) => ({ value: u, label: u }));

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
  return rows.length > 0 ? rows : [createCompositionRow()];
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

export default function WarehouseItemForm({
  visible,
  onClose,
  editingItem,
  presentation = 'modal',
}: WarehouseItemFormProps) {
  const colors = useThemeColors();
  const m3 = useM3();
  const { windowHeight } = useResponsiveHeight();
  const insets = useSafeAreaInsets();
  const isVisible = visible ?? true;
  const createMutation = useCreateWarehouseItem();
  const updateMutation = useUpdateWarehouseItem();

  const [name, setName] = useState('');
  const [type, setType] = useState<WarehouseItemType>('fertilizer');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState<WarehouseUnit>('kg');
  const [unitPrice, setUnitPrice] = useState('');
  const [reorderQuantity, setReorderQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [densityKgPerL, setDensityKgPerL] = useState('');
  const [compositionRows, setCompositionRows] = useState<CompositionRow[]>([
    createCompositionRow(),
  ]);
  const [compositionSource, setCompositionSource] = useState<'manual' | 'preset'>('manual');
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

  // Track previous state to prevent unnecessary updates
  const prevVisibleRef = useRef(isVisible);
  const prevEditingItemIdRef = useRef(editingItem?.id);
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
    setCompositionRows([createCompositionRow()]);
    setCompositionSource('manual');
    setSelectedCatalogProductId(null);
    setCatalogSelectionTouched(false);
    setCatalogueSearchQuery('');
    setShowCataloguePicker(false);
    setKeyboardHeight(0);
    setManualCatalogueDraft(null);
  };

  const handleReset = () => {
    resetForm();
  };

  const applyCatalogProduct = (product: MasterCatalogProduct) => {
    setManualCatalogueDraft(
      (prev) =>
        prev ?? {
          name,
          type,
          unit,
          manufacturer,
          compositionRows: compositionRows.map((row) => ({ ...row })),
        },
    );
    const nextType = mapCatalogInputTypeToWarehouseType(product.input_type);
    setName(product.name);
    setType(nextType);
    setUnit(resolveDefaultWarehouseUnitForProduct(product));
    setManufacturer(product.manufacturer ?? '');
    setCompositionRows(mapCatalogCompositionsToRows(product));
    setCompositionSource('preset');
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
      setCompositionRows(
        manualCatalogueDraft.compositionRows.length > 0
          ? manualCatalogueDraft.compositionRows.map((row) => ({ ...row }))
          : [createCompositionRow()],
      );
    }

    setCompositionSource('manual');
    setSelectedCatalogProductId(null);
    setCatalogSelectionTouched(true);
    setShowCataloguePicker(false);
    setManualCatalogueDraft(null);
  };

  const updateCompositionRow = (id: string, updates: Partial<CompositionRow>) => {
    setCompositionRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...updates } : row)));
    setCompositionSource('manual');
    setSelectedCatalogProductId(null);
    setCatalogSelectionTouched(true);
    setManualCatalogueDraft(null);
  };

  const addCompositionRow = () => {
    if (compositionRows.length >= 12) return;
    setCompositionRows((prev) => [...prev, createCompositionRow()]);
    setSelectedCatalogProductId(null);
    setCatalogSelectionTouched(true);
    setManualCatalogueDraft(null);
  };

  const removeCompositionRow = (id: string) => {
    setCompositionRows((prev) => {
      const next = prev.filter((row) => row.id !== id);
      return next.length > 0 ? next : [createCompositionRow()];
    });
    setCompositionSource('manual');
    setSelectedCatalogProductId(null);
    setCatalogSelectionTouched(true);
    setManualCatalogueDraft(null);
  };
  const handleTypeSelect = (nextType: WarehouseItemType) => {
    setType(nextType);
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
          const existingComposition = editingItem.composition ?? [];
          setCompositionRows(
            existingComposition.length > 0
              ? existingComposition.map((entry) => createCompositionRow(entry))
              : [createCompositionRow()],
          );
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
        title={isEditing ? 'Edit Item' : 'Add Item'}
        onSave={handleSubmit}
        saveLabel={isEditing ? 'Save Changes' : 'Add Item'}
        isLoading={isLoading}
        isSaveDisabled={!isValid}
        showResetButton={!isEditing}
        onReset={handleReset}
        presentation={presentation}
      >
        <SectionHeader
          title="Item Type"
          subtitle="Choose fertilizer or spray before searching the catalogue."
          style={{ marginBottom: spacing[3] }}
        />

        <PillSelector
          options={ITEM_TYPES}
          selectedValue={type}
          onSelect={(value) => handleTypeSelect(value as WarehouseItemType)}
          style={{ marginBottom: spacing[5] }}
        />

        <SectionHeader
          title="Catalogue"
          subtitle="Optional. Search and select if available, or continue with manual item entry."
          style={{ marginBottom: 12 }}
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
              color: selectedCatalogProductId ? colors.surface[900] : colors.surface[400],
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

        <Text
          style={{
            marginBottom: 18,
            color: m3.colorScheme.onSurfaceVariant,
            fontSize: fontSize.xs,
          }}
        >
          Product not listed in catalogue? Leave it unselected and enter item details + composition
          manually.
        </Text>

        {/* Item Details */}
        <SectionHeader title="Item Details" style={{ marginBottom: 16 }} />

        <FormInput
          label="Item Name"
          value={name}
          onChangeText={setName}
          placeholder="e.g., NPK 19:19:19"
          required
          style={{ marginBottom: 12 }}
        />

        <FormInput
          label="Manufacturer (Optional)"
          value={manufacturer}
          onChangeText={setManufacturer}
          placeholder="e.g., Vanita Agro"
          style={{ marginBottom: 12 }}
        />

        <FormInput
          label="Density (kg/L, Optional)"
          value={densityKgPerL}
          onChangeText={setDensityKgPerL}
          placeholder="Defaults to 1.00"
          keyboardType="decimal-pad"
          style={{ marginBottom: 16 }}
        />

        {/* Composition */}
        <SectionHeader
          title="Nutrient Composition"
          subtitle={
            type === 'fertilizer'
              ? 'Required for fertilizers. Enter guaranteed nutrient percentages.'
              : 'Optional for sprays (required only if nutrient-bearing).'
          }
          style={{ marginBottom: 12 }}
        />

        {compositionRows.map((row, index) => (
          <View key={row.id} style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
            <View style={{ flex: 1.1 }}>
              <FormInput
                label={index === 0 ? 'Nutrient' : 'Nutrient'}
                value={row.nutrient_code}
                onChangeText={(nutrient_code) => updateCompositionRow(row.id, { nutrient_code })}
                placeholder="N, P2O5, K2O, Ca..."
              />
            </View>
            <View style={{ flex: 1 }}>
              <FormInput
                label={index === 0 ? 'Percent (%)' : 'Percent (%)'}
                value={row.percent}
                onChangeText={(percent) => updateCompositionRow(row.id, { percent })}
                placeholder="0 - 100"
                keyboardType="decimal-pad"
              />
            </View>
            <Pressable
              onPress={() => removeCompositionRow(row.id)}
              style={{ alignSelf: 'center', paddingHorizontal: 10, paddingVertical: 10 }}
            >
              <Text style={{ color: m3.colorScheme.error, fontWeight: '700' }}>Remove</Text>
            </Pressable>
          </View>
        ))}

        <Pressable
          onPress={addCompositionRow}
          style={{
            alignSelf: 'flex-start',
            marginBottom: 20,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 999,
            backgroundColor: colorWithOpacity(m3.colorScheme.tertiary, 0.14),
          }}
        >
          <Text style={{ color: m3.colorScheme.tertiary, fontWeight: '600' }}>+ Add Nutrient</Text>
        </Pressable>

        {/* Quantity & Unit - Cellar Ledger spec: side-by-side */}
        <SectionHeader title="Quantity & Unit" style={{ marginBottom: 16 }} />

        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
          <View style={{ flex: 1 }}>
            <FormInput
              label="Quantity"
              value={quantity}
              onChangeText={setQuantity}
              placeholder="0"
              keyboardType="decimal-pad"
              required
              style={{ marginBottom: 0 }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: fontSize.xs,
                fontWeight: fontWeight.medium,
                color: colors.surface[500],
                marginBottom: 6,
              }}
            >
              Unit
            </Text>
            <PillSelector
              options={UNIT_OPTIONS}
              selectedValue={unit}
              onSelect={(v) => setUnit(v as WarehouseUnit)}
              style={{ marginBottom: 0 }}
            />
          </View>
        </View>

        {/* Pricing & Alert */}
        <SectionHeader title="Pricing & Alerts" style={{ marginBottom: 16 }} />

        <FormInput
          label={`Unit Price (${currency})`}
          value={unitPrice}
          onChangeText={setUnitPrice}
          placeholder="0.00"
          keyboardType="decimal-pad"
          prefix={currency === 'INR' ? '₹' : '$'}
          suffix={`per ${unit}`}
          required
          style={{ marginBottom: 12 }}
        />

        <FormInput
          label="Low Stock Alert (Optional)"
          value={reorderQuantity}
          onChangeText={setReorderQuantity}
          placeholder="Leave empty to disable"
          keyboardType="decimal-pad"
          suffix={unit}
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

        {/* Total Value Preview */}
        {quantity && unitPrice && (
          <PreviewCard
            title="TOTAL VALUE"
            items={[
              {
                label: `${quantity} ${unit} × ${currency === 'INR' ? '₹' : '$'}${unitPrice}`,
                value: formatCurrency(parseFloat(totalValue), currency),
              },
              {
                label: 'Valid nutrient lines',
                value: String(validComposition.length),
              },
            ]}
            backgroundColor={colorWithOpacity(colors.success, 0.12)}
          />
        )}
      </FormModal>

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
                backgroundColor: colors.surface[100],
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
                  borderBottomColor: colors.surface[200],
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
                  Select from Catalogue
                </Text>
                <Pressable
                  onPress={() => setShowCataloguePicker(false)}
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
                    value={catalogueSearchQuery}
                    onChangeText={setCatalogueSearchQuery}
                    placeholder="Search by product, grade, or manufacturer"
                    placeholderTextColor={colors.surface[400]}
                    style={{
                      flex: 1,
                      marginLeft: spacing[2],
                      color: colors.surface[900],
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
                    borderBottomColor: colors.surface[100],
                    backgroundColor: !selectedCatalogProductId
                      ? colors.surface[50]
                      : colors.surface[100],
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
                        color: colors.surface[900],
                        fontWeight: !selectedCatalogProductId
                          ? fontWeight.semibold
                          : fontWeight.medium,
                        fontStyle: 'italic',
                      }}
                    >
                      Skip (manual entry)
                    </Text>
                    {!selectedCatalogProductId && (
                      <UISymbol name="checkmark" size={20} color={colors.primary[500]} />
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
                      borderBottomColor: colors.surface[100],
                      backgroundColor:
                        selectedCatalogProductId === product.id
                          ? colors.surface[50]
                          : colors.surface[100],
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
                            color: colors.surface[900],
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
                            color: colors.surface[600],
                            marginTop: 2,
                          }}
                          numberOfLines={1}
                        >
                          {formatCatalogueProductSubtitle(product)}
                        </Text>
                      </View>
                      {selectedCatalogProductId === product.id && (
                        <UISymbol name="checkmark" size={20} color={colors.primary[500]} />
                      )}
                    </View>
                  </Pressable>
                ))}

                {catalogProductsLoading && (
                  <View style={{ paddingHorizontal: spacing[6], paddingVertical: spacing[5] }}>
                    <Text style={{ fontSize: fontSize.sm, color: colors.surface[500] }}>
                      Loading catalogue items...
                    </Text>
                  </View>
                )}

                {!catalogProductsLoading && catalogProductsError && (
                  <View style={{ paddingHorizontal: spacing[6], paddingVertical: spacing[5] }}>
                    <Text style={{ fontSize: fontSize.sm, color: colors.error[500] }}>
                      Could not load catalogue items. Please try again later.
                    </Text>
                  </View>
                )}

                {!catalogProductsLoading &&
                  !catalogProductsError &&
                  visibleCatalogueItems.length === 0 && (
                    <View style={{ paddingHorizontal: spacing[6], paddingVertical: spacing[5] }}>
                      <Text style={{ fontSize: fontSize.sm, color: colors.surface[500] }}>
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
