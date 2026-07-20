/**
 * Farm Form – Crop Picker Sheet
 */

import React from 'react';
import { View, Text, Pressable, ScrollView, TextInput, KeyboardAvoidingView } from 'react-native';
import { ModalBackdrop } from '@/components/ui';
import { Symbol as UISymbol } from '@/components/ui/symbol';
import { useM3 } from '@/styles/use-theme';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { isIOS } from '@/hooks';
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
  cropSheetHeight: number;
  androidKeyboardLift: number;
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
  cropSheetHeight,
  androidKeyboardLift,
  onClose,
  onSelectCrop,
  onSearchChange,
  renderCropVisual,
}: CropPickerSheetProps) {
  const { t } = useTranslation();
  const m3 = useM3();

  if (!visible) return null;

  return (
    <ModalBackdrop visible onDismiss={onClose} alignment="flex-end">
      <KeyboardAvoidingView
        behavior={isIOS ? 'padding' : undefined}
        keyboardVerticalOffset={0}
        style={{
          flex: 1,
          width: '100%',
          justifyContent: 'flex-end',
          paddingBottom: androidKeyboardLift,
        }}
      >
        <GuidedTourTarget
          targetId={GUIDED_TOUR_TARGET_IDS.ADD_FARM_CROP_SHEET}
          onStartShouldSetResponder={() => true}
          style={{
            backgroundColor: m3.surface.s100,
            borderTopLeftRadius: borderRadius['3xl'],
            borderTopRightRadius: borderRadius['3xl'],
            height: cropSheetHeight,
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
              borderBottomColor: m3.surface.s100,
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
              {t('farmForm.cropPicker.modalTitle')}
            </Text>
            <Pressable
              onPress={onClose}
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
      </KeyboardAvoidingView>
    </ModalBackdrop>
  );
}
