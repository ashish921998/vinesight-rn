import React from 'react';
import { View, Text, Pressable, FlatList } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from '@expo/ui/community/bottom-sheet';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
import { SheetHeader } from '@/components/ui/sheet-header';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import type { Farm } from '@/types';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';

interface FarmSelectModalProps {
  visible: boolean;
  title: string;
  farms: Farm[];
  selectedFarmId: number | null;
  onSelect: (farmId: number) => void;
  onClose: () => void;
}

export function FarmSelectModal({
  visible,
  title,
  farms,
  selectedFarmId,
  onSelect,
  onClose,
}: FarmSelectModalProps) {
  const insets = useSafeAreaInsets();
  const m3 = useM3();
  const { t } = useTranslation();

  const ui = {
    surface: m3.surface.s100,
    surfaceSoft: colorWithOpacity(m3.surface.s100, 0.9),
    border: m3.surface.s200,
    primary: m3.colorScheme.primary,
    primarySoft: colorWithOpacity(m3.colorScheme.primary, 0.12),
    text: m3.surface.s900,
    muted: m3.surface.s500,
  };

  return (
    <BottomSheet
      index={visible ? 0 : -1}
      snapPoints={['55%', '90%']}
      enablePanDownToClose
      onClose={onClose}
      backgroundStyle={{ backgroundColor: ui.surface }}
    >
      <View
        style={{
          flex: 1,
          paddingBottom: Math.max(insets.bottom, spacing[4]),
        }}
      >
        <SheetHeader title={title} />

        <View style={{ paddingHorizontal: spacing[5], flex: 1 }}>
          <FlatList
            data={farms.filter((f) => f.id != null)}
            keyExtractor={(item) => item.id?.toString() ?? item.name}
            showsVerticalScrollIndicator={false}
            style={{ maxHeight: 360 }}
            renderItem={({ item }) => {
              const isSelected = item.id === selectedFarmId;
              return (
                <Pressable
                  onPress={() => item.id != null && onSelect(item.id)}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.name}${item.region ? `, ${item.region}` : ''}${isSelected ? ` (${t('common.selected')})` : ''}`}
                  accessibilityState={{ selected: isSelected }}
                  style={{
                    backgroundColor: isSelected ? m3.colorScheme.primaryContainer : m3.surface.s50,
                    borderColor: isSelected
                      ? colorWithOpacity(m3.colorScheme.primary, 0.35)
                      : ui.border,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingHorizontal: spacing[4],
                    paddingVertical: spacing[3],
                    borderRadius: borderRadius['2xl'],
                    marginBottom: spacing[2],
                    borderWidth: 1,
                  }}
                >
                  <View>
                    <Text
                      style={{
                        color: ui.text,
                        fontSize: fontSize.base,
                        fontWeight: fontWeight.semibold,
                      }}
                    >
                      {item.name}
                    </Text>
                    {item.region ? (
                      <Text
                        style={{
                          color: ui.muted,
                          fontSize: fontSize.xs,
                          marginTop: spacing[1],
                        }}
                      >
                        {item.region}
                      </Text>
                    ) : null}
                  </View>
                  <UiSymbol
                    name={isSelected ? 'checkmark.circle.fill' : 'circle'}
                    size={20}
                    color={isSelected ? ui.primary : m3.surface.s500}
                  />
                </Pressable>
              );
            }}
          />
        </View>
      </View>
    </BottomSheet>
  );
}
