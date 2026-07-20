/**
 * Farm Form – Variety Picker Sheet
 */

import React from 'react';
import { BottomSheet, RNHostView } from '@expo/ui';
import { View, Text, Pressable, ScrollView, TextInput, KeyboardAvoidingView } from 'react-native';
import { Symbol as UISymbol } from '@/components/ui/symbol';
import { useM3 } from '@/styles/use-theme';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { isIOS } from '@/hooks';
import { useTranslation } from 'react-i18next';
import { GuidedTourTarget } from '@/features/guided-tour/targets';
import { GUIDED_TOUR_TARGET_IDS } from '@/features/guided-tour/constants';

interface VarietyPickerSheetProps {
  visible: boolean;
  cropVariety: string;
  varietySearchQuery: string;
  varietySearchQueryTrimmed: string;
  filteredVarieties: string[];
  canCreateCustomVariety: boolean;
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
  varietySearchQueryTrimmed,
  filteredVarieties,
  canCreateCustomVariety,
  varietySheetHeight,
  androidKeyboardLift,
  onClose,
  onSelectVariety,
  onSearchChange,
  getVarietyLabel,
}: VarietyPickerSheetProps) {
  const { t } = useTranslation();
  const m3 = useM3();

  if (!visible) return null;

  return (
    <BottomSheet isPresented onDismiss={onClose} snapPoints={['half', 'full']}>
      <RNHostView>
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
            targetId={GUIDED_TOUR_TARGET_IDS.ADD_FARM_VARIETY_SHEET}
            onStartShouldSetResponder={() => true}
            style={{
              backgroundColor: m3.surface.s100,
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
                {t('farmForm.variety.modalTitle')}
              </Text>
              <Pressable
                onPress={onClose}
                accessible
                accessibilityRole="button"
                accessibilityLabel="Close variety picker"
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
                    value={varietySearchQuery}
                    onChangeText={onSearchChange}
                    placeholder={t('farmForm.variety.searchPlaceholder')}
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

              {/* List */}
              <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
                {canCreateCustomVariety && (
                  <Pressable
                    style={{
                      paddingHorizontal: spacing[6],
                      paddingVertical: spacing[4],
                      borderBottomWidth: 1,
                      borderBottomColor: m3.surface.s100,
                      backgroundColor: m3.surface.s50,
                    }}
                    onPress={() => onSelectVariety(varietySearchQueryTrimmed)}
                  >
                    <Text
                      style={{
                        fontSize: fontSize.base,
                        color: m3.primary.p600,
                        fontWeight: fontWeight.semibold,
                      }}
                    >
                      {t('farmForm.variety.useCustom', {
                        variety: varietySearchQueryTrimmed,
                        defaultValue: 'Use "{{variety}}"',
                      })}
                    </Text>
                  </Pressable>
                )}
                {filteredVarieties.map((variety) => {
                  const isSelected = cropVariety === variety;
                  return (
                    <Pressable
                      key={variety}
                      style={{
                        paddingHorizontal: spacing[6],
                        paddingVertical: spacing[4],
                        borderBottomWidth: 1,
                        borderBottomColor: m3.surface.s100,
                        backgroundColor: isSelected ? m3.surface.s50 : m3.surface.s100,
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
                            color: isSelected ? m3.surface.s900 : m3.surface.s700,
                            fontWeight: isSelected ? fontWeight.semibold : fontWeight.normal,
                          }}
                        >
                          {getVarietyLabel(variety)}
                        </Text>
                        {isSelected && (
                          <UISymbol name="checkmark" size={20} color={m3.primary.p500} />
                        )}
                      </View>
                    </Pressable>
                  );
                })}
                {filteredVarieties.length === 0 && !canCreateCustomVariety && (
                  <View style={{ paddingHorizontal: spacing[6], paddingVertical: spacing[5] }}>
                    <Text style={{ fontSize: fontSize.sm, color: m3.surface.s500 }}>
                      {t('common.noResultsFound')}
                    </Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </GuidedTourTarget>
        </KeyboardAvoidingView>
      </RNHostView>
    </BottomSheet>
  );
}
