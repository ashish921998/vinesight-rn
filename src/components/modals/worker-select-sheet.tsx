import React from 'react';
import { View, Text, Pressable, Modal, FlatList } from 'react-native';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import type { Worker } from '@/types';

const UI = {
  surface: '#FFFFFF',
  surfaceSoft: 'rgba(255, 255, 255, 0.9)',
  border: 'rgba(15, 23, 42, 0.08)',
  primary: '#2F6B4F',
  primarySoft: 'rgba(47, 107, 79, 0.12)',
  text: '#0F172A',
  muted: '#6B7280',
};

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
                  {title}
                </Text>
                <Text style={{ color: UI.muted, fontSize: fontSize.sm, marginTop: spacing[1] }}>
                  {subtitle}
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
                <UiSymbol name="xmark" size={18} color={UI.primary} />
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
                      {item.daily_rate ? (
                        <Text
                          style={{
                            color: UI.muted,
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
                      color={isSelected ? UI.primary : '#D1D5DB'}
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
                borderColor: UI.border,
              }}
            >
              <Text style={{ color: UI.text, fontSize: fontSize.sm, fontWeight: fontWeight.bold }}>
                Cancel
              </Text>
            </Pressable>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}
