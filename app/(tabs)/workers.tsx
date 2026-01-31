import React, { useState, useMemo } from 'react';
import { View, Text, FlatList, Pressable, RefreshControl, Alert, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
import { useWorkers, useDeleteWorker } from '@/hooks';
import { useFabBottomInset } from '@/hooks/use-fab-bottom-inset';
import { useTabBarInset } from '@/hooks/use-tab-bar-inset';
import { useModalStore } from '@/stores';
import { AttendanceView } from '@/components/screens';
import { Button, SegmentedControl } from '@/components/ui';
import type { Worker } from '@/types';
import { WorkerCard } from '@/components/cards';
import { m3, spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';

type WorkersTab = 'workers' | 'attendance' | 'analytics';

const TAB_DATA: { id: WorkersTab; label: string }[] = [
  { id: 'workers', label: 'Workers' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'analytics', label: 'Analytics' },
];

export default function WorkersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const fabBottomInset = useFabBottomInset();
  const tabBarInset = useTabBarInset();
  const { setAddWorker } = useModalStore();
  const { data: workers, isLoading, refetch } = useWorkers();
  const deleteWorker = useDeleteWorker();
  const isAndroid = process.env.EXPO_OS === 'android';
  const iosBottomActionBarHeight = 72;

  const [selectedTab, setSelectedTab] = useState<WorkersTab>('workers');

  const activeWorkers = useMemo(() => workers?.filter((w) => w.is_active) || [], [workers]);

  const inactiveWorkers = useMemo(() => workers?.filter((w) => !w.is_active) || [], [workers]);

  const handleDeleteWorker = (worker: Worker) => {
    Alert.alert(
      'Delete Worker?',
      `This will permanently delete ${worker.name} and all their associated records.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (worker.id) {
              try {
                await deleteWorker.mutateAsync(worker.id);
              } catch (error: unknown) {
                const errorMessage =
                  error instanceof Error ? error.message : 'Failed to delete worker';
                Alert.alert('Error', errorMessage);
              }
            }
          },
        },
      ],
    );
  };

  const handleEditWorker = (worker: Worker) => {
    setAddWorker({ worker });
    router.push('/add-worker');
  };

  const renderWorker = ({ item }: { item: Worker }) => (
    <View style={{ marginHorizontal: spacing[4], marginBottom: spacing[3] }}>
      <WorkerCard
        worker={item}
        onPress={() => handleEditWorker(item)}
        onEdit={() => handleEditWorker(item)}
        onDelete={() => handleDeleteWorker(item)}
      />
    </View>
  );

  const renderWorkersTab = () => (
    <FlatList
      data={activeWorkers}
      renderItem={renderWorker}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={{
        paddingTop: spacing[4],
        paddingBottom: isAndroid
          ? spacing[16] + fabBottomInset + spacing[10]
          : iosBottomActionBarHeight + tabBarInset + spacing[6],
        flexGrow: 1,
      }}
      ListHeaderComponent={
        activeWorkers.length > 0 ? (
          <Text
            style={{
              fontSize: fontSize.xs,
              fontWeight: fontWeight.bold,
              color: m3.colorScheme.onSurfaceVariant,
              letterSpacing: 0.5,
              marginHorizontal: spacing[4],
              marginBottom: spacing[2],
            }}
          >
            ACTIVE WORKERS ({activeWorkers.length})
          </Text>
        ) : null
      }
      ListFooterComponent={
        inactiveWorkers.length > 0 ? (
          <View style={{ marginTop: spacing[4] }}>
            <Text
              style={{
                fontSize: fontSize.xs,
                fontWeight: fontWeight.bold,
                color: m3.colorScheme.onSurfaceVariant,
                letterSpacing: 0.5,
                marginHorizontal: spacing[4],
                marginBottom: spacing[2],
              }}
            >
              INACTIVE WORKERS ({inactiveWorkers.length})
            </Text>
            {inactiveWorkers.map((worker) => (
              <View key={String(worker.id)} style={{ opacity: 0.6 }}>
                {renderWorker({ item: worker })}
              </View>
            ))}
          </View>
        ) : null
      }
      ListEmptyComponent={
        !isLoading ? (
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              padding: spacing[8],
            }}
          >
            <View
              style={{
                width: 80,
                height: 80,
                backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
                borderRadius: borderRadius.full,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: spacing[4],
              }}
            >
              <UiSymbol name="person.2" size={40} color={m3.colorScheme.primary} />
            </View>
            <Text
              style={{
                fontSize: fontSize.lg,
                fontWeight: fontWeight.semibold,
                color: m3.colorScheme.onSurface,
                textAlign: 'center',
              }}
            >
              No Workers Yet
            </Text>
            <Text
              style={{
                fontSize: fontSize.sm,
                color: m3.colorScheme.onSurfaceVariant,
                textAlign: 'center',
                marginTop: spacing[2],
              }}
            >
              Add workers to track attendance,{`\n`}payments, and settlements.
            </Text>
            <View style={{ marginTop: spacing[4], width: '100%', maxWidth: 360 }}>
              <Button
                title="Add Worker"
                onPress={() => {
                  setAddWorker({ worker: null });
                  router.push('/add-worker');
                }}
              />
            </View>
          </View>
        ) : null
      }
      refreshControl={
        <RefreshControl
          refreshing={isLoading}
          onRefresh={refetch}
          tintColor={m3.colorScheme.primary}
        />
      }
    />
  );

  const renderAttendanceTab = () => (
    <AttendanceView workers={activeWorkers} onSaveSuccess={refetch} />
  );

  const renderAnalyticsTab = () => (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing[8],
      }}
    >
      <View
        style={{
          width: 80,
          height: 80,
          backgroundColor: colorWithOpacity(m3.colorScheme.tertiary, 0.12),
          borderRadius: borderRadius.full,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing[4],
        }}
      >
        <UiSymbol name="chart.bar" size={40} color={m3.colorScheme.tertiary} />
      </View>
      <Text
        style={{
          fontSize: fontSize.lg,
          fontWeight: fontWeight.semibold,
          color: m3.colorScheme.onSurface,
          textAlign: 'center',
        }}
      >
        Labor Analytics
      </Text>
      <Text
        style={{
          fontSize: fontSize.sm,
          color: m3.colorScheme.onSurfaceVariant,
          textAlign: 'center',
          marginTop: spacing[2],
        }}
      >
        View labor costs, productivity,{`\n`}and attendance patterns.
      </Text>
      <Text
        style={{
          fontSize: fontSize.xs,
          color: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7),
          marginTop: spacing[4],
        }}
      >
        Coming soon in a future update
      </Text>
    </View>
  );

  return (
    <>
      <View
        style={{
          flex: 1,
          backgroundColor: m3.colorScheme.surface,
          paddingTop: insets.top + spacing[2],
        }}
      >
        {/* Tab Selector */}
        <View
          style={{
            backgroundColor: m3.colorScheme.surface,
            paddingHorizontal: spacing[4],
            paddingTop: spacing[3],
            paddingBottom: spacing[2],
          }}
        >
          <SegmentedControl
            options={TAB_DATA.map((tab) => ({ value: tab.id, label: tab.label }))}
            selectedValue={selectedTab}
            onSelect={(value) => setSelectedTab(value as WorkersTab)}
          />
        </View>

        {/* Tab Content */}
        {selectedTab === 'workers' && renderWorkersTab()}
        {selectedTab === 'attendance' && renderAttendanceTab()}
        {selectedTab === 'analytics' && renderAnalyticsTab()}

        {/* Primary action */}
        {selectedTab === 'workers' && (workers?.length || 0) > 0 && isAndroid && (
          <Pressable
            onPress={() => {
              setAddWorker({ worker: null });
              router.push('/add-worker');
            }}
            style={{
              position: 'absolute',
              bottom: spacing[14] + fabBottomInset,
              right: spacing[6],
              width: 56,
              height: 56,
              backgroundColor: m3.colorScheme.primary,
              borderRadius: borderRadius.full,
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
            accessibilityRole="button"
            accessibilityLabel="Add worker"
          >
            {({ pressed }) => (
              <>
                <UiSymbol name="plus" size={28} color={m3.colorScheme.onPrimary} />
                <View
                  pointerEvents="none"
                  style={[
                    StyleSheet.absoluteFillObject,
                    {
                      backgroundColor: pressed
                        ? colorWithOpacity(m3.colorScheme.onPrimary, m3.stateLayerOpacity.pressed)
                        : 'transparent',
                    },
                  ]}
                />
              </>
            )}
          </Pressable>
        )}

        {selectedTab === 'workers' && (workers?.length || 0) > 0 && !isAndroid && (
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: tabBarInset,
              paddingHorizontal: spacing[4],
              paddingTop: spacing[3],
              paddingBottom: spacing[3],
              backgroundColor: m3.surface.surfaceContainerLow,
              borderTopWidth: 1,
              borderTopColor: m3.colorScheme.outlineVariant,
            }}
          >
            <Button
              title="Add Worker"
              onPress={() => {
                setAddWorker({ worker: null });
                router.push('/add-worker');
              }}
            />
          </View>
        )}
      </View>

      {/* Add/Edit Worker handled via route */}
    </>
  );
}
