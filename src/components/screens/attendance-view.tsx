import React, { useState, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Symbol } from '@/components/ui/symbol';
import { useFarms } from '@/hooks';
import type { Worker } from '@/types';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { MarkAttendanceTab, CalendarAttendanceTab } from './attendance-subcomponents';

interface AttendanceViewProps {
  workers: Worker[];
  onSaveSuccess: () => void;
}

const UI = {
  bg: '#F4F6F8',
  surface: '#FFFFFF',
  surfaceSoft: 'rgba(255, 255, 255, 0.9)',
  border: 'rgba(15, 23, 42, 0.08)',
  primary: '#2F6B4F',
  primarySoft: 'rgba(47, 107, 79, 0.12)',
  text: '#0F172A',
  muted: '#6B7280',
  accent: '#2563EB',
};

type AttendanceTab = 'mark' | 'calendar';

export function AttendanceView({ workers, onSaveSuccess }: AttendanceViewProps) {
  const { data: farms } = useFarms();
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
      <LinearGradient
        colors={['rgba(47, 107, 79, 0.12)', 'transparent']}
        style={{ height: 200, position: 'absolute', top: 0, left: 0, right: 0 }}
      />

      <View style={{ marginHorizontal: spacing[4], marginTop: spacing[4] }}>
        <View
          style={{
            borderRadius: borderRadius['2xl'],
            padding: 6,
            backgroundColor: UI.surfaceSoft,
            borderColor: UI.border,
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
                backgroundColor: activeTab === 'mark' ? UI.primary : 'transparent',
              }}
            >
              <Symbol name="pencil" size={18} color={activeTab === 'mark' ? '#FFFFFF' : UI.muted} />
              <Text
                style={{
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.semibold,
                  marginLeft: spacing[2],
                  color: activeTab === 'mark' ? '#FFFFFF' : UI.muted,
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
                backgroundColor: activeTab === 'calendar' ? UI.primary : 'transparent',
              }}
            >
              <Symbol
                name="calendar"
                size={18}
                color={activeTab === 'calendar' ? '#FFFFFF' : UI.muted}
              />
              <Text
                style={{
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.semibold,
                  marginLeft: spacing[2],
                  color: activeTab === 'calendar' ? '#FFFFFF' : UI.muted,
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
