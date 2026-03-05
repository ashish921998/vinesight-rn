/**
 * Farm Form – Crop Picker Sheet
 */

import React from 'react';
import { View, Text, Pressable, ScrollView, TextInput, KeyboardAvoidingView } from 'react-native';
import { ModalBackdrop } from '@/components/ui';
import { Symbol as UISymbol } from '@/components/ui/symbol';
import { useM3, useThemeColors } from '@/styles/use-theme';
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
  const colors = useThemeColors();
  const m3 = useM3();

  if (!visible) return null;

  return (
    <ModalBackdrop visible onDismiss={onClose} alignment="flex-end" opacity={0.5}>
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
              {t('farmForm.cropPicker.modalTitle')}
            </Text>
            <Pressable
              onPress={onClose}
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
                  value={cropSearchQuery}
                  onChangeText={onSearchChange}
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

            {/* Crop list */}
            <GuidedTourTarget
              targetId={GUIDED_TOUR_TARGET_IDS.ADD_FARM_CROP_SHEET}
              style={{ flex: 1 }}
            >
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
                        borderBottomColor: colors.surface[100],
                        backgroundColor: isSelected ? colors.surface[50] : colors.surface[100],
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
                                ? colorWithOpacity(colors.primary[500], 0.16)
                                : colorWithOpacity(colors.surface[600], 0.1),
                            }}
                          >
                            {renderCropVisual(cropOption.value, 22, isSelected)}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text
                              style={{
                                fontSize: fontSize.base,
                                color: isSelected ? colors.surface[900] : colors.surface[700],
                                fontWeight: isSelected ? fontWeight.semibold : fontWeight.medium,
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
                        {isSelected && (
                          <UISymbol name="checkmark" size={20} color={colors.primary[500]} />
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
                      borderBottomColor: colors.surface[100],
                      backgroundColor:
                        selectedCrop === 'Other' &&
                        customCropName.trim().toLowerCase() === cropSearchQueryLower
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
                    <Text style={{ fontSize: fontSize.sm, color: colors.surface[500] }}>
                      {t('farmForm.cropPicker.noResults')}
                    </Text>
                  </View>
                )}
              </ScrollView>
            </GuidedTourTarget>
          </View>
        </View>
      </KeyboardAvoidingView>
    </ModalBackdrop>
  );
}
