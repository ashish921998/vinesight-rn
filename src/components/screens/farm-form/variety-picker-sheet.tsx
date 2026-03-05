/**
 * Farm Form – Variety Picker Sheet
 */

import React from 'react';
import { View, Text, Pressable, ScrollView, TextInput, KeyboardAvoidingView } from 'react-native';
import { ModalBackdrop } from '@/components/ui';
import { Symbol as UISymbol } from '@/components/ui/symbol';
import { useM3, useThemeColors } from '@/styles/use-theme';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { isIOS } from '@/hooks';
import { useTranslation } from 'react-i18next';
import { GuidedTourTarget } from '@/features/guided-tour/targets';
import { GUIDED_TOUR_TARGET_IDS } from '@/features/guided-tour/constants';

interface VarietyPickerSheetProps {
  visible: boolean;
  cropVariety: string;
  varietySearchQuery: string;
  filteredVarieties: string[];
  varietySheetHeight: number;
  androidKeyboardLift: number;
  onClose: () => void;
  onSelectVariety: (variety: string) => void;
  onSearchChange: (query: string) => void;
  getVarietyLabel: (value?: string) => string;
}

export function VarietyPickerSheet({
  visible,
  cropVariety,
  varietySearchQuery,
  filteredVarieties,
  varietySheetHeight,
  androidKeyboardLift,
  onClose,
  onSelectVariety,
  onSearchChange,
  getVarietyLabel,
}: VarietyPickerSheetProps) {
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
        <GuidedTourTarget
          targetId={GUIDED_TOUR_TARGET_IDS.ADD_FARM_VARIETY_SHEET}
          onStartShouldSetResponder={() => true}
          style={{
            backgroundColor: colors.surface[100],
            borderTopLeftRadius: borderRadius['3xl'],
            borderTopRightRadius: borderRadius['3xl'],
            height: varietySheetHeight,
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
              {t('farmForm.variety.modalTitle')}
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
                  value={varietySearchQuery}
                  onChangeText={onSearchChange}
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

            {/* List */}
            <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
              {filteredVarieties.map((variety) => {
                const isSelected = cropVariety === variety;
                return (
                  <Pressable
                    key={variety}
                    style={{
                      paddingHorizontal: spacing[6],
                      paddingVertical: spacing[4],
                      borderBottomWidth: 1,
                      borderBottomColor: colors.surface[100],
                      backgroundColor: isSelected ? colors.surface[50] : colors.surface[100],
                    }}
                    onPress={() => onSelectVariety(variety)}
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
                          color: isSelected ? colors.surface[900] : colors.surface[700],
                          fontWeight: isSelected ? fontWeight.semibold : fontWeight.normal,
                        }}
                      >
                        {getVarietyLabel(variety)}
                      </Text>
                      {isSelected && (
                        <UISymbol name="checkmark" size={20} color={colors.primary[500]} />
                      )}
                    </View>
                  </Pressable>
                );
              })}
              {filteredVarieties.length === 0 && (
                <View style={{ paddingHorizontal: spacing[6], paddingVertical: spacing[5] }}>
                  <Text style={{ fontSize: fontSize.sm, color: colors.surface[500] }}>
                    {t('common.noResultsFound')}
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
