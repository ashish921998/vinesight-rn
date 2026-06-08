import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, Pressable, Modal, FlatList } from 'react-native';
import { Symbol } from '@/components/ui/symbol';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import type { Farm } from '@/types';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';

interface FarmSelectSheetProps {
  visible: boolean;
  farms: Farm[];
  selectedFarmIds: number[];
  onApply: (farmIds: number[]) => void;
  onClose: () => void;
}

export function FarmSelectSheet({
  visible,
  farms,
  selectedFarmIds,
  onApply,
  onClose,
}: FarmSelectSheetProps) {
  const insets = useSafeAreaInsets();
  const m3 = useM3();
  const [draftIds, setDraftIds] = useState<number[]>(() => selectedFarmIds || []);
  const ui = useMemo(
    () => ({
      surface: m3.surface.s100,
      surfaceSoft: colorWithOpacity(m3.surface.s100, 0.9),
      border: m3.surface.s200,
      primary: m3.colorScheme.primary,
      primarySoft: colorWithOpacity(m3.colorScheme.primary, 0.12),
      text: m3.surface.s900,
      muted: m3.surface.s500,
      overlay: colorWithOpacity('#000000', 0.35),
    }),
    [m3],
  );

  useEffect(() => {
    setDraftIds(selectedFarmIds);
  }, [selectedFarmIds]);

  const toggleFarm = (farmId: number) => {
    setDraftIds((prev) =>
      prev.includes(farmId) ? prev.filter((id) => id !== farmId) : [...prev, farmId],
    );
  };

  const handleApply = () => {
    const nextIds =
      draftIds.length > 0
        ? draftIds
        : farms.map((f) => f.id).filter((id): id is number => id !== undefined && id !== null);
    onApply(nextIds);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: ui.overlay }}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable
            onPress={() => undefined}
            style={{
              backgroundColor: ui.surface,
              borderTopLeftRadius: borderRadius['3xl'],
              borderTopRightRadius: borderRadius['3xl'],
              paddingHorizontal: spacing[5],
              paddingTop: spacing[5],
              paddingBottom: Math.max(insets.bottom, 16),
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: spacing[3],
              }}
            >
              <View style={{ flex: 1, paddingRight: spacing[3] }}>
                <Text
                  style={{
                    color: ui.text,
                    fontSize: fontSize.lg,
                    fontWeight: fontWeight.bold,
                  }}
                >
                  Select Farms
                </Text>
                <Text style={{ color: ui.muted, fontSize: fontSize.sm, marginTop: spacing[1] }}>
                  Choose farms to apply attendance
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                style={{
                  backgroundColor: ui.primarySoft,
                  width: 36,
                  height: 36,
                  borderRadius: borderRadius.full,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Symbol name="xmark" size={18} color={ui.primary} />
              </Pressable>
            </View>

            <FlatList
              data={farms}
              keyExtractor={(item) => item.id?.toString() ?? item.name}
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: 360 }}
              renderItem={({ item }) => {
                const farmId = item.id ?? 0;
                const isSelected = draftIds.includes(farmId);
                return (
                  <Pressable
                    onPress={() => item.id && toggleFarm(item.id)}
                    style={{
                      backgroundColor: isSelected
                        ? m3.colorScheme.primaryContainer
                        : m3.surface.s50,
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
                      <Text
                        style={{
                          color: ui.muted,
                          fontSize: fontSize.xs,
                          marginTop: spacing[1],
                        }}
                      >
                        {item.region}
                      </Text>
                    </View>
                    <Symbol
                      name={isSelected ? 'checkmark.circle.fill' : 'circle'}
                      size={20}
                      color={isSelected ? ui.primary : m3.surface.s500}
                    />
                  </Pressable>
                );
              }}
            />

            <View style={{ flexDirection: 'row', gap: spacing[3], marginTop: spacing[3] }}>
              <Pressable
                onPress={() => {
                  setDraftIds(
                    farms
                      .map((f) => f.id)
                      .filter((id): id is number => id !== undefined && id !== null),
                  );
                }}
                style={{
                  flex: 1,
                  paddingVertical: spacing[3],
                  borderRadius: borderRadius['2xl'],
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: colorWithOpacity(m3.colorScheme.primary, 0.25),
                }}
              >
                <Text
                  style={{ color: ui.primary, fontSize: fontSize.sm, fontWeight: fontWeight.bold }}
                >
                  Select All
                </Text>
              </Pressable>
              <Pressable
                onPress={handleApply}
                style={{
                  flex: 1,
                  paddingVertical: spacing[3],
                  borderRadius: borderRadius['2xl'],
                  alignItems: 'center',
                  backgroundColor: ui.primary,
                }}
              >
                <Text
                  style={{
                    color: m3.colorScheme.onPrimary,
                    fontSize: fontSize.sm,
                    fontWeight: fontWeight.bold,
                  }}
                >
                  Apply
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}
