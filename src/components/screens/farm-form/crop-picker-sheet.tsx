/**
 * Farm Form – Crop Picker Sheet
 */

import React from 'react';
import { BottomSheet, BottomSheetView } from '@expo/ui/community/bottom-sheet';
import { View, Text, Pressable, ScrollView, TextInput } from 'react-native';
import { Symbol as UISymbol } from '@/components/ui/symbol';
import { SheetHeader } from '@/components/ui/sheet-header';
import { useM3 } from '@/styles/use-theme';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { useTranslation } from 'react-i18next';
import type { CropType } from '@/constants/crop-varieties';
import type { KnownCrop } from '@/utils/farm-crop-visuals';
import { GuidedTourTarget } from '@/features/guided-tour/targets';
import { GUIDED_TOUR_TARGET_IDS } from '@/features/guided-tour/constants';

interface KnownCropOption {
  value: KnownCrop;
  label: string;
  sublabel: string;
}

interface CropPickerSheetProps {
  visible: boolean;
  selectedCrop: CropType;
  customCropName: string;
  cropSearchQuery: string;
  cropSearchQueryTrimmed: string;
  cropSearchQueryLower: string;
  filteredCropOptions: KnownCropOption[];
  canCreateCustomCrop: boolean;
  onClose: () => void;
  onSelectCrop: (crop: CropType, customCropName?: string) => void;
  onSearchChange: (query: string) => void;
  renderCropVisual: (crop: KnownCrop, size: number, selected?: boolean) => React.ReactNode;
}

export function CropPickerSheet({
  visible,
  selectedCrop,
  customCropName,
  cropSearchQuery,
  cropSearchQueryTrimmed,
  cropSearchQueryLower,
  filteredCropOptions,
  canCreateCustomCrop,
  onClose,
  onSelectCrop,
  onSearchChange,
  renderCropVisual,
}: CropPickerSheetProps) {
  const { t } = useTranslation();
  const m3 = useM3();

  return (
    <BottomSheet
      index={visible ? 0 : -1}
      snapPoints={['72%', '95%']}
      enablePanDownToClose
      onClose={onClose}
      backgroundStyle={{ backgroundColor: m3.surface.s100 }}
    >
      <BottomSheetView style={{ flex: 1 }}>
        <GuidedTourTarget
          targetId={GUIDED_TOUR_TARGET_IDS.ADD_FARM_CROP_SHEET}
          onStartShouldSetResponder={() => true}
          style={{
            flex: 1,
            backgroundColor: m3.surface.s100,
          }}
        >
          {/* Header */}
          <SheetHeader title={t('farmForm.cropPicker.modalTitle')} />

          {/* Content */}
          <View style={{ flex: 1 }}>
            {/* Search bar */}
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
                  value={cropSearchQuery}
                  onChangeText={onSearchChange}
                  placeholder={t('farmForm.cropPicker.searchPlaceholder')}
                  placeholderTextColor={m3.surface.s400}
                  style={{
                    flex: 1,
                    marginLeft: spacing[2],
                    color: m3.surface.s900,
                    fontSize: fontSize.base,
                  }}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Crop list */}
            <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
              {filteredCropOptions.map((cropOption) => {
                const isSelected = selectedCrop !== 'Other' && selectedCrop === cropOption.value;
                return (
                  <Pressable
                    key={cropOption.value}
                    style={{
                      paddingHorizontal: spacing[6],
                      paddingVertical: spacing[4],
                      borderBottomWidth: 1,
                      borderBottomColor: m3.surface.s100,
                      backgroundColor: isSelected ? m3.surface.s50 : m3.surface.s100,
                    }}
                    onPress={() => onSelectCrop(cropOption.value)}
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
                            backgroundColor: isSelected
                              ? colorWithOpacity(m3.primary.p500, 0.16)
                              : colorWithOpacity(m3.surface.s600, 0.1),
                          }}
                        >
                          {renderCropVisual(cropOption.value, 22, isSelected)}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              fontSize: fontSize.base,
                              color: isSelected ? m3.surface.s900 : m3.surface.s700,
                              fontWeight: isSelected ? fontWeight.semibold : fontWeight.medium,
                            }}
                          >
                            {cropOption.label}
                          </Text>
                          <Text
                            style={{
                              marginTop: 2,
                              fontSize: fontSize.sm,
                              color: m3.surface.s500,
                            }}
                          >
                            {cropOption.sublabel}
                          </Text>
                        </View>
                      </View>
                      {isSelected && (
                        <UISymbol name="checkmark" size={20} color={m3.primary.p500} />
                      )}
                    </View>
                  </Pressable>
                );
              })}

              {/* "Use as custom crop" option */}
              {canCreateCustomCrop && (
                <Pressable
                  onPress={() => onSelectCrop('Other', cropSearchQueryTrimmed)}
                  style={{
                    paddingHorizontal: spacing[6],
                    paddingVertical: spacing[4],
                    borderBottomWidth: 1,
                    borderBottomColor: m3.surface.s100,
                    backgroundColor:
                      selectedCrop === 'Other' &&
                      customCropName.trim().toLowerCase() === cropSearchQueryLower
                        ? m3.surface.s50
                        : m3.surface.s100,
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
                      <UISymbol name="plus.circle.fill" size={20} color={m3.primary.p500} />
                      <Text
                        style={{
                          marginLeft: spacing[2],
                          fontSize: fontSize.base,
                          color: m3.surface.s900,
                          fontWeight: fontWeight.semibold,
                        }}
                      >
                        {t('farmForm.cropPicker.useCustomCrop', {
                          crop: cropSearchQueryTrimmed,
                        })}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              )}

              {filteredCropOptions.length === 0 && !canCreateCustomCrop && (
                <View style={{ paddingHorizontal: spacing[6], paddingVertical: spacing[5] }}>
                  <Text style={{ fontSize: fontSize.sm, color: m3.surface.s500 }}>
                    {t('farmForm.cropPicker.noResults')}
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </GuidedTourTarget>
      </BottomSheetView>
    </BottomSheet>
  );
}
