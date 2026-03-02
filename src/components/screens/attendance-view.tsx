import React, { useState, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Symbol } from '@/components/ui/symbol';
import { useFarms } from '@/hooks';
import type { Worker } from '@/types';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { useM3, useThemeColors } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { MarkAttendanceTab, CalendarAttendanceTab } from './attendance-subcomponents';
import { useWorkersTourStore } from '@/features/guided-tour/workers-tour-store';

interface AttendanceViewProps {
  workers: Worker[];
  onSaveSuccess: () => void;
}

type AttendanceTab = 'mark' | 'calendar';

export function AttendanceView({ workers, onSaveSuccess }: AttendanceViewProps) {
  const { data: farms } = useFarms();
  const colors = useThemeColors();
  const m3 = useM3();
  const UI = useMemo(
    () => ({
      bg: m3.colorScheme.background,
      surface: colors.surface[100],
      surfaceSoft: colorWithOpacity(colors.surface[100], 0.9),
      border: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
      primary: m3.colorScheme.primary,
      primarySoft: colorWithOpacity(m3.colorScheme.primary, 0.12),
      text: m3.colorScheme.onSurface,
      muted: m3.colorScheme.onSurfaceVariant,
      accent: m3.colorScheme.secondary,
    }),
    [colors, m3],
  );
  const [activeTab, setActiveTab] = useState<AttendanceTab>('mark');
  const [selectedWorkerIndex, setSelectedWorkerIndex] = useState(0);
  const isTourActive = useWorkersTourStore((s) => s.isActive);

  const activeWorkers = useMemo(() => workers.filter((w) => w.is_active), [workers]);

  if (activeWorkers.length === 0) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing[8],
          backgroundColor: UI.bg,
        }}
      >
        <View
          style={{
            width: 96,
            height: 96,
            borderRadius: borderRadius['3xl'],
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: spacing[4],
            backgroundColor: UI.primarySoft,
          }}
        >
          <Symbol name="person.2" size={48} color={UI.primary} />
        </View>
        <Text
          style={{
            fontSize: fontSize.lg,
            fontWeight: fontWeight.bold,
            textAlign: 'center',
            color: UI.text,
          }}
        >
          No Active Workers
        </Text>
        <Text
          style={{
            fontSize: fontSize.sm,
            textAlign: 'center',
            marginTop: spacing[2],
            color: UI.muted,
          }}
        >
          Add workers in the Workers tab to start tracking attendance.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: UI.bg }}>
      <View style={{ marginHorizontal: spacing[4], marginTop: spacing[2] }}>
        <View
          style={{
            borderRadius: borderRadius.xl,
            padding: 4,
            backgroundColor: 'transparent',
            borderColor: UI.border,
            borderWidth: 1,
          }}
        >
          <View style={{ flexDirection: 'row', overflow: 'hidden', borderRadius: borderRadius.lg }}>
            <Pressable
              onPress={() => setActiveTab('mark')}
              accessibilityRole="button"
              accessibilityLabel="Mark tab"
              accessibilityState={{ selected: activeTab === 'mark' }}
              style={({ pressed }) => ({
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: spacing[2],
                borderRadius: borderRadius.lg,
                backgroundColor: activeTab === 'mark' ? UI.primarySoft : 'transparent',
                ...(pressed ? { opacity: 0.8 } : null),
              })}
            >
              <Symbol
                name="pencil"
                size={16}
                color={activeTab === 'mark' ? UI.primary : UI.muted}
              />
              <Text
                style={{
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.semibold,
                  marginLeft: spacing[2],
                  color: activeTab === 'mark' ? UI.primary : UI.muted,
                }}
              >
                Mark
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab('calendar')}
              accessibilityRole="button"
              accessibilityLabel="Calendar tab"
              accessibilityState={{ selected: activeTab === 'calendar' }}
              style={({ pressed }) => ({
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: spacing[2],
                borderRadius: borderRadius.lg,
                backgroundColor: activeTab === 'calendar' ? UI.primarySoft : 'transparent',
                ...(pressed ? { opacity: 0.8 } : null),
              })}
            >
              <Symbol
                name="calendar"
                size={16}
                color={activeTab === 'calendar' ? UI.primary : UI.muted}
              />
              <Text
                style={{
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.semibold,
                  marginLeft: spacing[2],
                  color: activeTab === 'calendar' ? UI.primary : UI.muted,
                }}
              >
                Calendar
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      <View style={{ flex: 1 }}>
        {activeTab === 'mark' && farms && (
          <MarkAttendanceTab
            workers={activeWorkers}
            farms={farms}
            selectedWorkerIndex={selectedWorkerIndex}
            onWorkerIndexChange={setSelectedWorkerIndex}
            onSaveSuccess={onSaveSuccess}
            isTourActive={isTourActive}
          />
        )}
        {activeTab === 'calendar' && <CalendarAttendanceTab workers={activeWorkers} />}
      </View>
    </View>
  );
}
