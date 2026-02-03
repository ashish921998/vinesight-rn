import React, { useState, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Symbol } from '@/components/ui/symbol';
import { useFarms } from '@/hooks';
import type { Worker } from '@/types';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { MarkAttendanceTab, CalendarAttendanceTab } from './attendance-subcomponents';
import { useM3, useThemeColors } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';

interface AttendanceViewProps {
  workers: Worker[];
  onSaveSuccess: () => void;
}

type AttendanceTab = 'mark' | 'calendar';

export function AttendanceView({ workers, onSaveSuccess }: AttendanceViewProps) {
  const { data: farms } = useFarms();
  const colors = useThemeColors();
  const m3 = useM3();
  const ui = useMemo(
    () => ({
      bg: colors.surface[50],
      surface: colors.surface[100],
      surfaceSoft: colorWithOpacity(colors.surface[100], 0.9),
      border: colors.surface[200],
      primary: m3.colorScheme.primary,
      primarySoft: colorWithOpacity(m3.colorScheme.primary, 0.12),
      text: colors.surface[900],
      muted: colors.surface[500],
    }),
    [colors, m3],
  );
  const [activeTab, setActiveTab] = useState<AttendanceTab>('mark');
  const [selectedWorkerIndex, setSelectedWorkerIndex] = useState(0);

  const activeWorkers = useMemo(() => workers.filter((w) => w.is_active), [workers]);

  if (activeWorkers.length === 0) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing[8],
          backgroundColor: ui.bg,
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
            backgroundColor: ui.primarySoft,
          }}
        >
          <Symbol name="person.2" size={48} color={ui.primary} />
        </View>
        <Text
          style={{
            fontSize: fontSize.lg,
            fontWeight: fontWeight.bold,
            textAlign: 'center',
            color: ui.text,
          }}
        >
          No Active Workers
        </Text>
        <Text
          style={{
            fontSize: fontSize.sm,
            textAlign: 'center',
            marginTop: spacing[2],
            color: ui.muted,
          }}
        >
          Add workers in the Workers tab to start tracking attendance.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: ui.bg }}>
      <LinearGradient
        colors={[colorWithOpacity(m3.colorScheme.primary, 0.12), 'transparent']}
        style={{ height: 200, position: 'absolute', top: 0, left: 0, right: 0 }}
      />

      <View style={{ marginHorizontal: spacing[4], marginTop: spacing[4] }}>
        <View
          style={{
            borderRadius: borderRadius['2xl'],
            padding: 6,
            backgroundColor: ui.surfaceSoft,
            borderColor: ui.border,
            borderWidth: 1,
          }}
        >
          <View style={{ flexDirection: 'row', overflow: 'hidden', borderRadius: borderRadius.xl }}>
            <Pressable
              onPress={() => setActiveTab('mark')}
              accessibilityRole="button"
              accessibilityLabel="Mark tab"
              accessibilityState={{ selected: activeTab === 'mark' }}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: spacing[3],
                backgroundColor: activeTab === 'mark' ? ui.primary : 'transparent',
              }}
            >
              <Symbol
                name="pencil"
                size={18}
                color={activeTab === 'mark' ? m3.colorScheme.onPrimary : ui.muted}
              />
              <Text
                style={{
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.semibold,
                  marginLeft: spacing[2],
                  color: activeTab === 'mark' ? m3.colorScheme.onPrimary : ui.muted,
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
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: spacing[3],
                backgroundColor: activeTab === 'calendar' ? ui.primary : 'transparent',
              }}
            >
              <Symbol
                name="calendar"
                size={18}
                color={activeTab === 'calendar' ? m3.colorScheme.onPrimary : ui.muted}
              />
              <Text
                style={{
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.semibold,
                  marginLeft: spacing[2],
                  color: activeTab === 'calendar' ? m3.colorScheme.onPrimary : ui.muted,
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
          />
        )}
        {activeTab === 'calendar' && <CalendarAttendanceTab workers={activeWorkers} />}
      </View>
    </View>
  );
}
