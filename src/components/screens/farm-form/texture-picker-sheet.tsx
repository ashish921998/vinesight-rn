/**
 * Farm Form – Soil Texture Picker Sheet
 */

import React from 'react';
import { View, Text, Pressable, ScrollView, KeyboardAvoidingView } from 'react-native';
import { ModalBackdrop } from '@/components/ui';
import { Symbol as UISymbol } from '@/components/ui/symbol';
import { useM3, useThemeColors } from '@/styles/use-theme';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { isIOS } from '@/hooks';
import { useTranslation } from 'react-i18next';
import { SOIL_TEXTURE_OPTIONS } from './constants';

interface TexturePickerSheetProps {
  visible: boolean;
  selectedTexture: string;
  textureSheetHeight: number;
  androidKeyboardLift: number;
  onClose: () => void;
  onSelectTexture: (value: string) => void;
}

export function TexturePickerSheet({
  visible,
  selectedTexture,
  textureSheetHeight,
  androidKeyboardLift,
  onClose,
  onSelectTexture,
}: TexturePickerSheetProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const m3 = useM3();

  if (!visible) return null;

  return (
    <ModalBackdrop visible onDismiss={onClose} alignment="flex-end" opacity={0.5}>
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
        <View
          onStartShouldSetResponder={() => true}
          style={{
            backgroundColor: colors.surface[100],
            borderTopLeftRadius: borderRadius['3xl'],
            borderTopRightRadius: borderRadius['3xl'],
            height: textureSheetHeight,
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
              {t('farmForm.soilTexture.modalTitle')}
            </Text>
            <Pressable
              onPress={onClose}
              accessible
              accessibilityRole="button"
              accessibilityLabel="Close"
              accessibilityHint="Closes the texture picker"
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

          {/* List */}
          <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
            {SOIL_TEXTURE_OPTIONS.map((texture) => {
              const isSelected = selectedTexture === texture.value;
              return (
                <Pressable
                  key={texture.value}
                  style={{
                    paddingHorizontal: spacing[6],
                    paddingVertical: spacing[4],
                    borderBottomWidth: 1,
                    borderBottomColor: colors.surface[100],
                    backgroundColor: isSelected ? colors.surface[50] : colors.surface[100],
                  }}
                  onPress={() => onSelectTexture(texture.value)}
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
                      {t(texture.labelKey)}
                    </Text>
                    {isSelected && (
                      <UISymbol name="checkmark" size={20} color={colors.primary[500]} />
                    )}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </ModalBackdrop>
  );
}
