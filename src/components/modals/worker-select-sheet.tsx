import React, { useMemo } from 'react';
import { View, Text, Pressable, FlatList } from 'react-native';
import { BottomSheet } from '@expo/ui/community/bottom-sheet';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
import { SheetHeader } from '@/components/ui/sheet-header';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import type { Worker } from '@/types';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';

interface WorkerSelectSheetProps {
  visible: boolean;
  title: string;
  subtitle: string;
  workers: Worker[];
  selectedWorkerId: number | null;
  onSelect: (workerId: number) => void;
  onClose: () => void;
}

export function WorkerSelectSheet({
  visible,
  title,
  subtitle,
  workers,
  selectedWorkerId,
  onSelect,
  onClose,
}: WorkerSelectSheetProps) {
  const insets = useSafeAreaInsets();
  const m3 = useM3();
  const ui = useMemo(
    () => ({
      surface: m3.surface.s100,
      surfaceSoft: colorWithOpacity(m3.surface.s100, 0.9),
      border: m3.surface.s200,
      primary: m3.colorScheme.primary,
      primarySoft: colorWithOpacity(m3.colorScheme.primary, 0.12),
      text: m3.surface.s900,
      muted: m3.surface.s500,
    }),
    [m3],
  );

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
          paddingBottom: Math.max(insets.bottom, 16),
        }}
      >
        <SheetHeader title={title} subtitle={subtitle} />

        <View style={{ paddingHorizontal: spacing[5], flex: 1 }}>
          <FlatList
            data={workers}
            keyExtractor={(item) => item.id?.toString() ?? item.name}
            showsVerticalScrollIndicator={false}
            style={{ maxHeight: 360 }}
            renderItem={({ item }) => {
              const isSelected = item.id === selectedWorkerId;
              return (
                <Pressable
                  onPress={() => item.id != null && onSelect(item.id)}
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
                    {item.daily_rate ? (
                      <Text
                        style={{
                          color: ui.muted,
                          fontSize: fontSize.xs,
                          marginTop: spacing[1],
                        }}
                      >
                        ₹{item.daily_rate}/day
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
