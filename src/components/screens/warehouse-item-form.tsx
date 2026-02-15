import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useCreateWarehouseItem, useUpdateWarehouseItem } from '../../hooks';
import {
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
  CardSelector,
  FormInput,
  PreviewCard,
} from '../ui/form-components';
import { useM3, useThemeColors } from '@/styles/use-theme';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { ICON_REGISTRY } from '@/constants/icon-registry';
import { WAREHOUSE_PRESETS, type WarehouseNutrientPreset } from '@/constants/nutrient-presets';
import { Symbol as UISymbol } from '@/components/ui/symbol';

interface Props {
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

const ITEM_TYPES = [
  {
    value: 'fertilizer' as WarehouseItemType,
    label: 'Fertilizer',
    icon: ICON_REGISTRY.fertigation,
  },
  { value: 'spray' as WarehouseItemType, label: 'Spray', icon: 'spraycan' as const },
];

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
}: Props) {
  const colors = useThemeColors();
  const m3 = useM3();
  const { height: windowHeight } = useWindowDimensions();
  const isIOS = Platform.OS === 'ios';
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
  const [selectedCatalogueId, setSelectedCatalogueId] = useState('');
  const [catalogueSearchQuery, setCatalogueSearchQuery] = useState('');
  const [showCataloguePicker, setShowCataloguePicker] = useState(false);

  const currency = useCurrency();
  const isEditing = !!editingItem;

  const unitOptions = useMemo(
    () => [
      {
        value: 'kg' as WarehouseUnit,
        label: 'kg',
        sublabel: 'Kilograms',
        icon: 'scale-outline' as const,
        iconColor: colorWithOpacity(colors.warning, 0.25),
      },
      {
        value: 'gram' as WarehouseUnit,
        label: 'g',
        sublabel: 'Grams',
        icon: 'scale-outline' as const,
        iconColor: colorWithOpacity(colors.warning, 0.25),
      },
      {
        value: 'liter' as WarehouseUnit,
        label: 'L',
        sublabel: 'Liters',
        icon: 'water-outline' as const,
        iconColor: colorWithOpacity(m3.colorScheme.primary, 0.18),
      },
      {
        value: 'ml' as WarehouseUnit,
        label: 'ml',
        sublabel: 'Milliliters',
        icon: 'water-outline' as const,
        iconColor: colorWithOpacity(m3.colorScheme.primary, 0.18),
      },
    ],
    [colors.warning, m3.colorScheme.primary],
  );

  // Track previous state to prevent unnecessary updates
  const prevVisibleRef = useRef(isVisible);
  const prevEditingItemIdRef = useRef(editingItem?.id);
  const filteredCatalogueItems = useMemo(() => {
    const query = catalogueSearchQuery.trim().toLowerCase();
    if (!query) return WAREHOUSE_PRESETS;
    return WAREHOUSE_PRESETS.filter((preset) =>
      `${preset.label} ${preset.name} ${preset.manufacturer}`.toLowerCase().includes(query),
    );
  }, [catalogueSearchQuery]);
  const visibleCatalogueItems = useMemo(() => {
    if (!selectedCatalogueId) return filteredCatalogueItems;
    if (filteredCatalogueItems.some((preset) => preset.id === selectedCatalogueId))
      return filteredCatalogueItems;
    const selected = WAREHOUSE_PRESETS.find((preset) => preset.id === selectedCatalogueId);
    return selected ? [selected, ...filteredCatalogueItems] : filteredCatalogueItems;
  }, [filteredCatalogueItems, selectedCatalogueId]);

  const catalogueSheetHeight = useMemo(
    () => Math.min(Math.round(windowHeight * 0.7), windowHeight - 80),
    [windowHeight],
  );

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
    setSelectedCatalogueId('');
    setCatalogueSearchQuery('');
  };

  const handleReset = () => {
    resetForm();
  };

  const applyPreset = (preset: WarehouseNutrientPreset) => {
    setName(preset.name);
    setType(preset.type);
    setUnit(preset.unit);
    setManufacturer(preset.manufacturer);
    setCompositionRows(preset.composition.map((item) => createCompositionRow(item)));
    setCompositionSource('preset');
    setSelectedCatalogueId(preset.id);
  };

  const updateCompositionRow = (id: string, updates: Partial<CompositionRow>) => {
    setCompositionRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...updates } : row)));
    setCompositionSource('manual');
    setSelectedCatalogueId('');
  };

  const addCompositionRow = () => {
    if (compositionRows.length >= 12) return;
    setCompositionRows((prev) => [...prev, createCompositionRow()]);
    setSelectedCatalogueId('');
  };

  const removeCompositionRow = (id: string) => {
    setCompositionRows((prev) => {
      const next = prev.filter((row) => row.id !== id);
      return next.length > 0 ? next : [createCompositionRow()];
    });
    setCompositionSource('manual');
    setSelectedCatalogueId('');
  };
  const handleTypeSelect = (nextType: WarehouseItemType) => {
    setType(nextType);
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
          const matchedPreset = WAREHOUSE_PRESETS.find(
            (preset) => preset.name === editingItem.name,
          );
          setSelectedCatalogueId(matchedPreset?.id ?? '');
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
          ? `${i18n.t('common.errors.failedToSaveItem')}\n\nDB schema may be missing nutrient columns. Please run the SQL in docs/sql/2026-02-11-nutrient-composition-tracking.sql.\n\n${details}`
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
            color: selectedCatalogueId ? colors.surface[900] : colors.surface[400],
            fontWeight: selectedCatalogueId ? fontWeight.medium : fontWeight.normal,
            flex: 1,
          }}
          numberOfLines={1}
        >
          {selectedCatalogueId
            ? (() => {
                const preset = WAREHOUSE_PRESETS.find((p) => p.id === selectedCatalogueId);
                return preset ? `${preset.label} - ${preset.manufacturer}` : 'Select from catalogue (or skip)';
              })()
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

      <PillSelector
        options={ITEM_TYPES}
        selectedValue={type}
        onSelect={(value) => handleTypeSelect(value as WarehouseItemType)}
        style={{ marginBottom: 20 }}
      />

      <FormInput
        label="Manufacturer (Optional)"
        value={manufacturer}
        onChangeText={setManufacturer}
        placeholder="e.g., Mahadhan / Vanita Agro"
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

      {/* Quantity & Unit */}
      <SectionHeader title="Quantity & Unit" style={{ marginBottom: 16 }} />

      <FormInput
        label="Quantity"
        value={quantity}
        onChangeText={setQuantity}
        placeholder="0"
        keyboardType="decimal-pad"
        required
        style={{ marginBottom: 12 }}
      />

      <CardSelector
        options={unitOptions}
        selectedValue={unit}
        onSelect={(value) => setUnit(value as WarehouseUnit)}
        columns={2}
        style={{ marginBottom: 20 }}
      />

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

    {/* Catalogue Picker Bottom Sheet — matches variety picker pattern in farm-form */}
    {showCataloguePicker && (
      <View
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          backgroundColor: colorWithOpacity(m3.colorScheme.shadow, 0.5),
          justifyContent: 'flex-end',
        }}
      >
        <Pressable style={{ flex: 1 }} onPress={() => setShowCataloguePicker(false)} />
        <KeyboardAvoidingView
          behavior={isIOS ? 'padding' : undefined}
          keyboardVerticalOffset={0}
          style={{ justifyContent: 'flex-end' }}
        >
          <View
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
                  paddingHorizontal: spacing[6],
                  paddingVertical: spacing[4],
                  borderBottomWidth: 1,
                  borderBottomColor: colors.surface[100],
                  backgroundColor: !selectedCatalogueId
                    ? colors.surface[50]
                    : colors.surface[100],
                }}
                onPress={() => {
                  setSelectedCatalogueId('');
                  setCompositionSource('manual');
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
                  <Text
                    style={{
                      fontSize: fontSize.base,
                      color: !selectedCatalogueId ? colors.surface[900] : colors.surface[700],
                      fontWeight: !selectedCatalogueId ? fontWeight.semibold : fontWeight.normal,
                      fontStyle: 'italic',
                    }}
                  >
                    Skip (manual entry)
                  </Text>
                  {!selectedCatalogueId && (
                    <UISymbol name="checkmark" size={20} color={colors.primary[500]} />
                  )}
                </View>
              </Pressable>

              {/* Catalogue items */}
              {visibleCatalogueItems.map((preset) => (
                <Pressable
                  key={preset.id}
                  style={{
                    paddingHorizontal: spacing[6],
                    paddingVertical: spacing[4],
                    borderBottomWidth: 1,
                    borderBottomColor: colors.surface[100],
                    backgroundColor:
                      selectedCatalogueId === preset.id
                        ? colors.surface[50]
                        : colors.surface[100],
                  }}
                  onPress={() => {
                    applyPreset(preset);
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
                          color:
                            selectedCatalogueId === preset.id
                              ? colors.surface[900]
                              : colors.surface[700],
                          fontWeight:
                            selectedCatalogueId === preset.id
                              ? fontWeight.semibold
                              : fontWeight.normal,
                        }}
                        numberOfLines={1}
                      >
                        {preset.label}
                      </Text>
                      <Text
                        style={{
                          fontSize: fontSize.xs,
                          color: colors.surface[500],
                          marginTop: 2,
                        }}
                        numberOfLines={1}
                      >
                        {preset.manufacturer}
                      </Text>
                    </View>
                    {selectedCatalogueId === preset.id && (
                      <UISymbol name="checkmark" size={20} color={colors.primary[500]} />
                    )}
                  </View>
                </Pressable>
              ))}

              {visibleCatalogueItems.length === 0 && (
                <View style={{ paddingHorizontal: spacing[6], paddingVertical: spacing[5] }}>
                  <Text style={{ fontSize: fontSize.sm, color: colors.surface[500] }}>
                    No catalogue matches found.
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    )}
    </View>
  );
}
