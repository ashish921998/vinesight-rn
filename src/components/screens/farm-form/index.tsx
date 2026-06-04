/**
 * Farm Form
 * Shared add/edit form for farms.
 *
 * This file is intentionally kept as pure render logic.
 * All state, effects and handlers live in `use-farm-form.ts`.
 */

import React from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { Symbol as UISymbol } from '@/components/ui/symbol';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { isIOS } from '@/hooks';
import { FullScreenForm, SectionHeader, FormInput, InfoCard, Button } from '@/components/ui';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import LocationPicker from '../location-picker';
import { formatDate } from '@/i18n/format';
import { GuidedTourTarget } from '@/features/guided-tour/targets';
import { GUIDED_TOUR_TARGET_IDS } from '@/features/guided-tour/constants';

import type { FarmFormProps } from './types';
import { useFarmForm } from './use-farm-form';
import { DatePickerModal } from './date-picker-modal';
import { CropPickerSheet } from './crop-picker-sheet';
import { VarietyPickerSheet } from './variety-picker-sheet';
import { TexturePickerSheet } from './texture-picker-sheet';
import { ensureValidDate } from './utils';
import { guidedTourEmit } from '@/features/guided-tour';

export function FarmForm({ mode, farmId, onClose }: FarmFormProps) {
  const form = useFarmForm(mode, farmId, onClose);
  const { t, m3 } = form;

  if (form.isEdit && form.farmLoading) {
    return (
      <View
        style={{ flex: 1, backgroundColor: m3.colorScheme.background, justifyContent: 'center' }}
      >
        <ActivityIndicator size="large" color={m3.primary.p500} />
      </View>
    );
  }

  // ── Crop trigger button ──────────────────────────────────────────────────
  const cropTrigger = (
    <Pressable
      style={{
        backgroundColor: m3.surface.s100,
        borderWidth: 2,
        borderColor: m3.surface.s200,
        borderRadius: borderRadius.xl,
        paddingHorizontal: spacing[4],
        paddingVertical: spacing[4],
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
      onPress={form.openCropPicker}
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
          {form.formState.selectedCrop === 'Other' ? (
            <UISymbol name="leaf.fill" size={16} color={m3.colorScheme.primary} />
          ) : (
            form.renderCropVisual(form.formState.selectedCrop, 18)
          )}
        </View>
        <Text
          style={{
            fontSize: fontSize.base,
            color: m3.surface.s900,
            fontWeight: fontWeight.medium,
            marginLeft: spacing[3],
          }}
          numberOfLines={1}
        >
          {form.selectedCropLabel}
        </Text>
      </View>
      <UISymbol name="chevron.down" size={20} color={m3.colorScheme.onSurfaceVariant} />
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: m3.colorScheme.background }}>
      {/* ── Main scroll form ──────────────────────────────────────────────── */}
      <FullScreenForm
        title={form.isEdit ? t('farmForm.title.edit') : t('farmForm.title.add')}
        onClose={onClose}
        onSave={form.handleSave}
        saveLabel={form.isEdit ? t('common.saveChanges') : t('farmForm.saveLabel.createFarm')}
        isLoading={form.isLoading}
        isSaveDisabled={!form.isValid}
        showResetButton={!form.isEdit}
        onReset={form.handleReset}
        saveButtonTargetId={!form.isEdit ? GUIDED_TOUR_TARGET_IDS.ADD_FARM_SUBMIT : undefined}
        scrollViewRef={form.formScrollViewRef}
        scrollViewProps={{
          scrollEnabled: !form.isGuidedTourScrollLocked,
          bounces: !form.isGuidedTourScrollLocked,
          alwaysBounceVertical: !form.isGuidedTourScrollLocked,
          nestedScrollEnabled: !form.isGuidedTourScrollLocked,
          automaticallyAdjustKeyboardInsets: !form.isGuidedTourScrollLocked,
          overScrollMode: form.isGuidedTourScrollLocked ? 'never' : 'always',
          keyboardDismissMode: form.isGuidedTourScrollLocked ? 'none' : 'on-drag',
          onScroll: (event) => {
            form.handleFormScrollY(event.nativeEvent.contentOffset.y);
          },
          scrollEventThrottle: 16,
        }}
      >
        {/* — Details section — */}
        <SectionHeader title={t('farmForm.sections.details')} style={{ marginBottom: 16 }} />

        <View style={{ marginBottom: 12 }}>
          <GuidedTourTarget targetId={GUIDED_TOUR_TARGET_IDS.ADD_FARM_NAME}>
            <FormInput
              label={t('farmForm.fields.name.label')}
              inputRef={form.nameInputRef}
              value={form.formState.name}
              onChangeText={(v) => {
                form.setName(v);
                if (form.getIsGuidedAddFarm()) {
                  guidedTourEmit('guidedTour.addFarmNameEntered', {
                    isFilled: v.trim().length > 0,
                  });
                }
              }}
              placeholder={t('farmForm.fields.name.placeholder')}
              required
              autoFocus={!form.isEdit}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => {
                if (form.formState.name.trim().length === 0) return;
                form.regionInputRef.current?.focus();
              }}
              style={{ marginBottom: 0 }}
            />
          </GuidedTourTarget>
        </View>

        <View style={{ marginBottom: 12 }}>
          <GuidedTourTarget targetId={GUIDED_TOUR_TARGET_IDS.ADD_FARM_REGION}>
            <FormInput
              label={t('farmForm.fields.region.label')}
              inputRef={form.regionInputRef}
              value={form.formState.region}
              onChangeText={(v) => {
                form.setRegion(v);
                if (form.getIsGuidedAddFarm()) {
                  guidedTourEmit('guidedTour.addFarmRegionEntered', {
                    isFilled: v.trim().length > 0,
                  });
                }
              }}
              placeholder={t('farmForm.fields.region.placeholder')}
              required
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => {
                if (form.formState.region.trim().length === 0) return;
                form.areaInputRef.current?.focus();
              }}
              style={{ marginBottom: 0 }}
            />
          </GuidedTourTarget>
        </View>

        <View style={{ marginBottom: 20 }}>
          <GuidedTourTarget targetId={GUIDED_TOUR_TARGET_IDS.ADD_FARM_AREA}>
            <FormInput
              label={t('farmForm.fields.area.label')}
              inputRef={form.areaInputRef}
              value={form.formState.area}
              onChangeText={(v) => {
                const sanitized = form.setArea(v);
                if (form.getIsGuidedAddFarm()) {
                  const isValidNumber =
                    sanitized.trim() !== '' && Number.isFinite(Number(sanitized.trim()));
                  guidedTourEmit('guidedTour.addFarmAreaEntered', { isFilled: isValidNumber });
                }
              }}
              placeholder={t('farmForm.fields.area.placeholder')}
              keyboardType="decimal-pad"
              suffix={t('units.acres')}
              required
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => {
                if (form.formState.area.trim().length === 0) return;
                if (form.formState.selectedCrop === 'Other') {
                  form.customCropInputRef.current?.focus();
                  return;
                }
                if (form.formState.cropVariety === 'Custom') {
                  form.customVarietyInputRef.current?.focus();
                  return;
                }
                form.vineSpacingInputRef.current?.focus();
              }}
              style={{ marginBottom: 0 }}
            />
          </GuidedTourTarget>
        </View>

        {/* — Crop type section — */}
        <SectionHeader title={t('farmForm.sections.cropType')} style={{ marginBottom: 16 }} />

        <View style={{ marginBottom: spacing[3] }}>
          {!form.formState.showCropPicker ? (
            <GuidedTourTarget targetId={GUIDED_TOUR_TARGET_IDS.ADD_FARM_CROP}>
              {cropTrigger}
            </GuidedTourTarget>
          ) : (
            cropTrigger
          )}
        </View>

        {/* Popular crops horizontal scroll */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            flexDirection: 'row',
            gap: spacing[2],
            paddingRight: spacing[1],
          }}
          style={{ marginBottom: 20 }}
        >
          {form.popularCropOptions.map((cropOption) => {
            const isSelected =
              form.formState.selectedCrop !== 'Other' &&
              form.formState.selectedCrop === cropOption.value;
            return (
              <Pressable
                key={cropOption.value}
                onPress={() => form.handleSelectCrop(cropOption.value)}
                style={{
                  paddingLeft: spacing[2],
                  paddingRight: spacing[3],
                  paddingVertical: spacing[2],
                  borderRadius: borderRadius.full,
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: isSelected
                    ? colorWithOpacity(m3.primary.p500, 0.14)
                    : m3.surface.s100,
                  borderWidth: 1,
                  borderColor: isSelected
                    ? colorWithOpacity(m3.primary.p500, 0.4)
                    : m3.surface.s200,
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
                      ? colorWithOpacity(m3.primary.p500, 0.15)
                      : colorWithOpacity(m3.surface.s600, 0.12),
                  }}
                >
                  {form.renderCropVisual(cropOption.value, 14, isSelected)}
                </View>
                <Text
                  style={{
                    color: isSelected ? m3.primary.p700 : m3.surface.s700,
                    fontWeight: isSelected ? fontWeight.semibold : fontWeight.medium,
                    fontSize: fontSize.sm,
                  }}
                >
                  {cropOption.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {form.formState.selectedCrop === 'Other' && (
          <FormInput
            label={t('farmForm.cropPicker.customCropInputLabel')}
            inputRef={form.customCropInputRef}
            value={form.formState.customCropName}
            onChangeText={form.setCustomCropName}
            placeholder={t('farmForm.cropPicker.customCropInputPlaceholder')}
            required
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => {
              if (form.formState.cropVariety === 'Custom') {
                form.customVarietyInputRef.current?.focus();
                return;
              }
              form.vineSpacingInputRef.current?.focus();
            }}
            style={{ marginBottom: 20 }}
          />
        )}

        {/* — Variety section — */}
        <SectionHeader title={t('farmForm.sections.variety')} style={{ marginBottom: 16 }} />

        <View style={{ marginBottom: spacing[5] }}>
          <GuidedTourTarget targetId={GUIDED_TOUR_TARGET_IDS.ADD_FARM_VARIETY}>
            <Pressable
              style={{
                backgroundColor: m3.surface.s100,
                borderWidth: 2,
                borderColor: m3.surface.s200,
                borderRadius: borderRadius.xl,
                paddingHorizontal: spacing[4],
                paddingVertical: spacing[4],
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
              onPress={() => form.setShowVarietyPicker(true)}
              onPressIn={() => {
                if (form.getIsGuidedAddFarm()) {
                  guidedTourEmit('guidedTour.addFarmVarietyPickerOpened', {});
                }
              }}
            >
              <Text
                style={{
                  fontSize: fontSize.base,
                  color: form.formState.cropVariety ? m3.surface.s900 : m3.surface.s400,
                  fontWeight: form.formState.cropVariety ? fontWeight.medium : fontWeight.normal,
                }}
              >
                {form.formState.cropVariety
                  ? form.getVarietyLabel(form.formState.cropVariety)
                  : t('farmForm.variety.selectPlaceholder')}
              </Text>
              <UISymbol name="chevron.down" size={20} color={m3.colorScheme.onSurfaceVariant} />
            </Pressable>
          </GuidedTourTarget>
        </View>

        {form.formState.cropVariety === 'Custom' && (
          <GuidedTourTarget targetId={GUIDED_TOUR_TARGET_IDS.ADD_FARM_CUSTOM_VARIETY}>
            <FormInput
              label={t('farmForm.variety.customNameLabel')}
              inputRef={form.customVarietyInputRef}
              value={form.formState.customVariety}
              onChangeText={(v) => {
                form.setCustomVariety(v);
                if (form.getIsGuidedAddFarm() && v.trim().length > 0) {
                  guidedTourEmit('guidedTour.addFarmCustomVarietyEntered', {});
                }
              }}
              placeholder={t('farmForm.variety.customNamePlaceholder')}
              required
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => form.vineSpacingInputRef.current?.focus()}
              style={{ marginBottom: 20 }}
            />
          </GuidedTourTarget>
        )}

        {/* — Planting date section — */}
        <SectionHeader title={t('farmForm.sections.plantingDate')} style={{ marginBottom: 16 }} />

        <Pressable
          style={{
            backgroundColor: m3.surface.s100,
            borderWidth: 2,
            borderColor: m3.surface.s200,
            borderRadius: borderRadius.xl,
            paddingHorizontal: spacing[4],
            paddingVertical: spacing[4],
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: spacing[5],
          }}
          onPress={form.openPlantingDatePicker}
        >
          <UISymbol name="calendar" size={24} color={m3.colorScheme.onSurfaceVariant} />
          <Text
            style={{
              fontSize: fontSize.base,
              color: m3.surface.s900,
              fontWeight: fontWeight.medium,
              marginLeft: spacing[3],
            }}
          >
            {form.formState.plantingDate
              ? formatDate(ensureValidDate(form.formState.plantingDate), {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })
              : t('farmForm.plantingDate.selectPlaceholder')}
          </Text>
        </Pressable>

        {/* — Plant spacing section — */}
        <SectionHeader
          title={t('farmForm.sections.plantSpacingOptional')}
          style={{ marginBottom: 16 }}
        />

        <View style={{ flexDirection: 'row', gap: spacing[3], marginBottom: spacing[5] }}>
          <View style={{ flex: 1 }}>
            <FormInput
              label={t('farmForm.fields.vineSpacing.label')}
              inputRef={form.vineSpacingInputRef}
              value={form.formState.vineSpacing}
              onChangeText={form.setVineSpacing}
              placeholder="1.8"
              keyboardType="decimal-pad"
              suffix={t('units.meter')}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => form.rowSpacingInputRef.current?.focus()}
              style={{ marginBottom: 0 }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <FormInput
              label={t('farmForm.fields.rowSpacing.label')}
              inputRef={form.rowSpacingInputRef}
              value={form.formState.rowSpacing}
              onChangeText={form.setRowSpacing}
              placeholder="3.0"
              keyboardType="decimal-pad"
              suffix={t('units.meter')}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => form.tankCapacityInputRef.current?.focus()}
              style={{ marginBottom: 0 }}
            />
          </View>
        </View>

        {/* — Irrigation section — */}
        <SectionHeader
          title={t('farmForm.sections.irrigationDetailsOptional')}
          style={{ marginBottom: 16 }}
        />

        <FormInput
          label={t('farmForm.fields.tankCapacity.label')}
          inputRef={form.tankCapacityInputRef}
          value={form.formState.totalTankCapacity}
          onChangeText={form.setTotalTankCapacity}
          placeholder="1000"
          keyboardType="decimal-pad"
          suffix={t('units.millimeter')}
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => form.systemDischargeInputRef.current?.focus()}
          style={{ marginBottom: 12 }}
        />

        <FormInput
          label={t('farmForm.fields.systemDischarge.label')}
          inputRef={form.systemDischargeInputRef}
          value={form.formState.systemDischarge}
          onChangeText={form.setSystemDischarge}
          placeholder="10"
          keyboardType="decimal-pad"
          suffix={t('units.mmPerHour')}
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => form.locationNameInputRef.current?.focus()}
          style={{ marginBottom: 20 }}
        />

        {/* — Pruning date section — */}
        <SectionHeader
          title={t('farmForm.sections.pruningDateOptional')}
          style={{ marginBottom: 16 }}
        />

        <Pressable
          style={{
            backgroundColor: m3.surface.s100,
            borderWidth: 2,
            borderColor: m3.surface.s200,
            borderRadius: borderRadius.xl,
            paddingHorizontal: spacing[4],
            paddingVertical: spacing[4],
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: spacing[5],
          }}
          onPress={form.openPruningDatePicker}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <UISymbol name="cut-outline" size={24} color={m3.colorScheme.onSurfaceVariant} />
            <View style={{ marginLeft: spacing[3], flex: 1 }}>
              <Text style={{ fontSize: fontSize.sm, color: m3.surface.s500 }}>
                {t('farmForm.fields.pruningDate.label')}
              </Text>
              <Text
                style={{
                  fontSize: fontSize.base,
                  color: m3.surface.s900,
                  fontWeight: fontWeight.medium,
                  marginTop: 2,
                }}
              >
                {form.formState.dateOfPruning
                  ? formatDate(form.formState.dateOfPruning, {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : t('farmForm.fields.pruningDate.notSet')}
              </Text>
            </View>
          </View>
          {form.formState.dateOfPruning && (
            <Pressable
              onPress={form.clearPruningDate}
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

        {/* — Location section — */}
        <SectionHeader
          title={t('farmForm.sections.locationOptional')}
          style={{ marginBottom: 16 }}
        />

        <FormInput
          label={t('farmForm.fields.locationName.label')}
          inputRef={form.locationNameInputRef}
          value={form.formState.locationName}
          onChangeText={form.setLocationName}
          placeholder={t('farmForm.fields.locationName.placeholder')}
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => form.latitudeInputRef.current?.focus()}
          style={{ marginBottom: 12 }}
        />

        <Button
          title={t('farmForm.location.selectOnMap')}
          variant="outline"
          size="sm"
          leftIcon={<UISymbol name="location.fill" size={20} color={m3.primary.p500} />}
          onPress={form.handleOpenMapPicker}
          style={{ marginBottom: 12 }}
        />

        <View style={{ flexDirection: 'row', gap: spacing[3], marginBottom: spacing[3] }}>
          <View style={{ flex: 1 }}>
            <FormInput
              label={t('farmForm.fields.latitude.label')}
              inputRef={form.latitudeInputRef}
              value={form.formState.latitude}
              onChangeText={form.setLatitude}
              placeholder="0.000000"
              keyboardType="decimal-pad"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => form.longitudeInputRef.current?.focus()}
              style={{ marginBottom: 0 }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <FormInput
              label={t('farmForm.fields.longitude.label')}
              inputRef={form.longitudeInputRef}
              value={form.formState.longitude}
              onChangeText={form.setLongitude}
              placeholder="0.000000"
              keyboardType="decimal-pad"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => form.elevationInputRef.current?.focus()}
              style={{ marginBottom: 0 }}
            />
          </View>
        </View>

        <FormInput
          label={t('farmForm.fields.elevation.label')}
          inputRef={form.elevationInputRef}
          value={form.formState.elevation}
          onChangeText={form.setElevation}
          placeholder="0"
          keyboardType="decimal-pad"
          suffix={t('units.feet')}
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => form.bulkDensityInputRef.current?.focus()}
          style={{ marginBottom: 20 }}
        />

        {/* — Soil properties section — */}
        <SectionHeader
          title={t('farmForm.sections.soilPropertiesOptional')}
          style={{ marginBottom: 16 }}
        />

        <FormInput
          label={t('farmForm.fields.bulkDensity.label')}
          inputRef={form.bulkDensityInputRef}
          value={form.formState.bulkDensity}
          onChangeText={form.setBulkDensity}
          placeholder="1200"
          keyboardType="decimal-pad"
          suffix={t('units.kilogramPerMeterCubed')}
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => form.cecInputRef.current?.focus()}
          style={{ marginBottom: 12 }}
        />

        <FormInput
          label={t('farmForm.fields.cationExchangeCapacity.label')}
          inputRef={form.cecInputRef}
          value={form.formState.cationExchangeCapacity}
          onChangeText={form.setCationExchangeCapacity}
          placeholder="15"
          keyboardType="decimal-pad"
          suffix="cmol/kg"
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => form.soilWaterRetentionInputRef.current?.focus()}
          style={{ marginBottom: 12 }}
        />

        <FormInput
          label={t('farmForm.fields.soilWaterRetention.label')}
          inputRef={form.soilWaterRetentionInputRef}
          value={form.formState.soilWaterRetention}
          onChangeText={form.setSoilWaterRetention}
          placeholder="25"
          keyboardType="decimal-pad"
          suffix="%"
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => form.sandInputRef.current?.focus()}
          style={{ marginBottom: 20 }}
        />

        {/* — Soil texture section — */}
        <SectionHeader title={t('farmForm.sections.soilTexture')} style={{ marginBottom: 16 }} />

        <Pressable
          style={{
            backgroundColor: m3.surface.s100,
            borderWidth: 2,
            borderColor: m3.surface.s200,
            borderRadius: borderRadius.xl,
            paddingHorizontal: spacing[4],
            paddingVertical: spacing[4],
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: spacing[5],
          }}
          onPress={() => form.setShowTexturePicker(true)}
        >
          <Text
            style={{
              fontSize: fontSize.base,
              color: form.formState.soilTextureClass ? m3.surface.s900 : m3.surface.s400,
              fontWeight: form.formState.soilTextureClass ? fontWeight.medium : fontWeight.normal,
            }}
          >
            {form.formState.soilTextureClass
              ? form.getSoilTextureLabel(form.formState.soilTextureClass)
              : t('farmForm.soilTexture.selectPlaceholder')}
          </Text>
          <UISymbol name="chevron.down" size={20} color={m3.colorScheme.onSurfaceVariant} />
        </Pressable>

        {/* Sand / Silt / Clay */}
        <View style={{ flexDirection: 'row', gap: spacing[3], marginBottom: spacing[5] }}>
          <View style={{ flex: 1 }}>
            <FormInput
              label={t('farmForm.fields.sandPercentage.label')}
              inputRef={form.sandInputRef}
              value={form.formState.sandPercentage}
              onChangeText={form.setSandPercentage}
              placeholder="40"
              keyboardType="decimal-pad"
              suffix="%"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => form.siltInputRef.current?.focus()}
              style={{ marginBottom: 0 }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <FormInput
              label={t('farmForm.fields.siltPercentage.label')}
              inputRef={form.siltInputRef}
              value={form.formState.siltPercentage}
              onChangeText={form.setSiltPercentage}
              placeholder="40"
              keyboardType="decimal-pad"
              suffix="%"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => form.clayInputRef.current?.focus()}
              style={{ marginBottom: 0 }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <FormInput
              label={t('farmForm.fields.clayPercentage.label')}
              inputRef={form.clayInputRef}
              value={form.formState.clayPercentage}
              onChangeText={form.setClayPercentage}
              placeholder="20"
              keyboardType="decimal-pad"
              suffix="%"
              returnKeyType="done"
              blurOnSubmit
              style={{ marginBottom: 0 }}
            />
          </View>
        </View>

        {form.soilCompositionWarning && (
          <InfoCard
            icon="exclamationmark.triangle.fill"
            iconColor={m3.colorScheme.warning}
            backgroundColor={colorWithOpacity(m3.colorScheme.warning, 0.2)}
            message={form.soilCompositionWarning}
            style={{ marginBottom: 20 }}
          />
        )}

        <InfoCard
          icon="information-circle"
          iconColor={m3.colorScheme.success}
          backgroundColor={colorWithOpacity(m3.colorScheme.success, 0.2)}
          message={t('farmForm.infoCardMessage')}
        />
      </FullScreenForm>

      {/* ── iOS planting date picker ──────────────────────────────────────── */}
      {form.formState.showDatePicker && isIOS && (
        <DatePickerModal
          visible
          title={t('farmForm.sections.plantingDate')}
          value={form.iosPlantingDateDraft}
          onClose={form.closeDatePicker}
          onChange={form.setIosPlantingDateDraft}
          onConfirm={form.commitPlantingDateFromDraft}
        />
      )}

      {/* ── Android planting date picker ─────────────────────────────────── */}
      {form.formState.showDatePicker && !isIOS && (
        <DateTimePicker
          value={ensureValidDate(form.formState.plantingDate)}
          mode="date"
          onChange={(event: DateTimePickerEvent, date?: Date) => {
            if (event.type === 'dismissed') {
              form.closeDatePicker();
              return;
            }
            if (date) form.commitAndroidPlantingDate(date);
            form.closeDatePicker();
          }}
        />
      )}

      {/* ── iOS pruning date picker ───────────────────────────────────────── */}
      {form.formState.showPruningDatePicker && isIOS && (
        <DatePickerModal
          visible
          title={t('farmForm.fields.pruningDate.label')}
          value={form.iosPruningDateDraft}
          onClose={form.closePruningDatePicker}
          onChange={form.setIosPruningDateDraft}
          onConfirm={form.commitPruningDateFromDraft}
        />
      )}

      {/* ── Android pruning date picker ───────────────────────────────────── */}
      {form.formState.showPruningDatePicker && !isIOS && (
        <DateTimePicker
          value={form.formState.dateOfPruning ?? new Date()}
          mode="date"
          onChange={(event: DateTimePickerEvent, date?: Date) => {
            if (event.type === 'dismissed') {
              form.closePruningDatePicker();
              return;
            }
            if (date) form.commitAndroidPruningDate(date);
            form.closePruningDatePicker();
          }}
        />
      )}

      {/* ── Variety picker sheet ─────────────────────────────────────────── */}
      <VarietyPickerSheet
        visible={form.formState.showVarietyPicker}
        cropVariety={form.formState.cropVariety}
        varietySearchQuery={form.formState.varietySearchQuery}
        varietySearchQueryTrimmed={form.varietySearchQueryTrimmed}
        filteredVarieties={form.filteredVarieties}
        canCreateCustomVariety={form.canCreateCustomVariety}
        varietySheetHeight={form.varietySheetHeight}
        androidKeyboardLift={form.androidKeyboardLift}
        onClose={() => form.setShowVarietyPicker(false)}
        onSelectVariety={form.handleSelectVariety}
        onSearchChange={form.setVarietySearchQuery}
        getVarietyLabel={form.getVarietyLabel}
      />

      {/* ── Crop picker sheet ────────────────────────────────────────────── */}
      <CropPickerSheet
        visible={form.formState.showCropPicker}
        selectedCrop={form.formState.selectedCrop}
        customCropName={form.formState.customCropName}
        cropSearchQuery={form.formState.cropSearchQuery}
        cropSearchQueryTrimmed={form.cropSearchQueryTrimmed}
        cropSearchQueryLower={form.cropSearchQueryLower}
        filteredCropOptions={form.filteredCropOptions}
        canCreateCustomCrop={form.canCreateCustomCrop}
        cropSheetHeight={form.cropSheetHeight}
        androidKeyboardLift={form.androidKeyboardLift}
        onClose={form.closeCropPicker}
        onSelectCrop={form.handleSelectCrop}
        onSearchChange={form.setCropSearchQuery}
        renderCropVisual={form.renderCropVisual}
      />

      {/* ── Texture picker sheet ─────────────────────────────────────────── */}
      <TexturePickerSheet
        visible={form.formState.showTexturePicker}
        selectedTexture={form.formState.soilTextureClass}
        textureSheetHeight={form.textureSheetHeight}
        androidKeyboardLift={form.androidKeyboardLift}
        onClose={() => form.setShowTexturePicker(false)}
        onSelectTexture={form.setSoilTextureClass}
      />

      {/* ── Location picker ──────────────────────────────────────────────── */}
      <LocationPicker
        visible={form.formState.showMapPicker}
        onClose={form.closeMapPicker}
        onLocationSelect={form.handleLocationSelected}
        initialLatitude={form.formState.latitude ? parseFloat(form.formState.latitude) : undefined}
        initialLongitude={
          form.formState.longitude ? parseFloat(form.formState.longitude) : undefined
        }
      />
    </View>
  );
}
