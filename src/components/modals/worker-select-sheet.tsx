import React, { useMemo } from 'react';
import { View, Text, Pressable, Modal, FlatList } from 'react-native';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import type { Worker } from '@/types';
import { useM3, useThemeColors } from '@/styles/use-theme';
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
  const colors = useThemeColors();
  const m3 = useM3();
  const ui = useMemo(
    () => ({
      surface: colors.surface[100],
      surfaceSoft: colorWithOpacity(colors.surface[100], 0.9),
      border: colors.surface[200],
      primary: m3.colorScheme.primary,
      primarySoft: colorWithOpacity(m3.colorScheme.primary, 0.12),
      text: colors.surface[900],
      muted: colors.surface[500],
      overlay: colorWithOpacity(colors.black, 0.35),
    }),
    [colors, m3],
  );

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
                  {title}
                </Text>
                <Text style={{ color: ui.muted, fontSize: fontSize.sm, marginTop: spacing[1] }}>
                  {subtitle}
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
                <UiSymbol name="xmark" size={18} color={ui.primary} />
              </Pressable>
            </View>

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
                      backgroundColor: isSelected
                        ? m3.colorScheme.primaryContainer
                        : colors.surface[50],
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
                      color={isSelected ? ui.primary : colors.surface[300]}
                    />
                  </Pressable>
                );
              }}
            />

            <Pressable
              onPress={onClose}
              style={{
                marginTop: spacing[3],
                paddingVertical: spacing[3],
                borderRadius: borderRadius['2xl'],
                alignItems: 'center',
                borderWidth: 1,
                borderColor: ui.border,
              }}
            >
              <Text style={{ color: ui.text, fontSize: fontSize.sm, fontWeight: fontWeight.bold }}>
                Cancel
              </Text>
            </Pressable>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}
