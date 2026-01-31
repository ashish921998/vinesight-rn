import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, Modal, FlatList } from 'react-native';
import { Symbol } from '@/components/ui/symbol';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import type { Farm } from '@/types';

const UI = {
  surface: '#FFFFFF',
  surfaceSoft: 'rgba(255, 255, 255, 0.9)',
  border: 'rgba(15, 23, 42, 0.08)',
  primary: '#2F6B4F',
  primarySoft: 'rgba(47, 107, 79, 0.12)',
  text: '#0F172A',
  muted: '#6B7280',
};

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
  const [draftIds, setDraftIds] = useState<number[]>(() => selectedFarmIds || []);

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
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.35)' }}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable
            onPress={() => undefined}
            style={{
              backgroundColor: UI.surface,
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
                    color: UI.text,
                    fontSize: fontSize.lg,
                    fontWeight: fontWeight.bold,
                  }}
                >
                  Select Farms
                </Text>
                <Text style={{ color: UI.muted, fontSize: fontSize.sm, marginTop: spacing[1] }}>
                  Choose farms to apply attendance
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                style={{
                  backgroundColor: UI.primarySoft,
                  width: 36,
                  height: 36,
                  borderRadius: borderRadius.full,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Symbol name="xmark" size={18} color={UI.primary} />
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
                      backgroundColor: isSelected ? UI.primarySoft : '#F9FAFB',
                      borderColor: isSelected ? 'rgba(47, 107, 79, 0.35)' : UI.border,
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
                          color: UI.text,
                          fontSize: fontSize.base,
                          fontWeight: fontWeight.semibold,
                        }}
                      >
                        {item.name}
                      </Text>
                      <Text
                        style={{
                          color: UI.muted,
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
                      color={isSelected ? UI.primary : '#D1D5DB'}
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
                  borderColor: 'rgba(47, 107, 79, 0.25)',
                }}
              >
                <Text
                  style={{ color: UI.primary, fontSize: fontSize.sm, fontWeight: fontWeight.bold }}
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
                  backgroundColor: UI.primary,
                }}
              >
                <Text
                  style={{ color: '#FFFFFF', fontSize: fontSize.sm, fontWeight: fontWeight.bold }}
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
