import React, { useState, useMemo } from 'react';
import { View, Text, FlatList, Pressable, RefreshControl, Alert, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
import { useWorkers, useDeleteWorker, useFabBottomPosition } from '@/hooks';
import { useModalStore } from '@/stores';
import { AttendanceView } from '@/components/screens';
import { Button, SegmentedControl } from '@/components/ui';
import type { Worker } from '@/types';
import { WorkerCard } from '@/components/cards';
import { m3, spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';

type WorkersTab = 'workers' | 'attendance' | 'analytics';

const TAB_DATA: { id: WorkersTab; labelKey: string }[] = [
  { id: 'workers', labelKey: 'workers.tabs.workers' },
  { id: 'attendance', labelKey: 'workers.tabs.attendance' },
  { id: 'analytics', labelKey: 'workers.tabs.analytics' },
];

export default function WorkersScreen() {
  const { t } = useTranslation();

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const fabBottom = useFabBottomPosition();
  const { setAddWorker } = useModalStore();
  const { data: workers, isLoading, refetch } = useWorkers();
  const deleteWorker = useDeleteWorker();

  const [selectedTab, setSelectedTab] = useState<WorkersTab>('workers');

  const activeWorkers = useMemo(() => workers?.filter((w) => w.is_active) || [], [workers]);

  const inactiveWorkers = useMemo(() => workers?.filter((w) => !w.is_active) || [], [workers]);

  const handleDeleteWorker = (worker: Worker) => {
    Alert.alert(
      t('workers.alerts.deleteWorkerTitle'),
      t('workers.alerts.deleteWorkerBody', { name: worker.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            if (worker.id) {
              try {
                await deleteWorker.mutateAsync(worker.id);
              } catch (error: unknown) {
                const errorMessage =
                  error instanceof Error ? error.message : t('common.errors.failedToDeleteWorker');
                Alert.alert(t('common.error'), errorMessage);
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
        paddingBottom: fabBottom + 56 + spacing[8],
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
            {t('workers.lists.activeTitle', { count: activeWorkers.length })}
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
              {t('workers.lists.inactiveTitle', { count: inactiveWorkers.length })}
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
              {t('workers.empty.title')}
            </Text>
            <Text
              style={{
                fontSize: fontSize.sm,
                color: m3.colorScheme.onSurfaceVariant,
                textAlign: 'center',
                marginTop: spacing[2],
              }}
            >
              {t('workers.empty.subtitle')}
            </Text>
            <View style={{ marginTop: spacing[4], width: '100%', maxWidth: 360 }}>
              <Button
                title={t('workers.form.saveAdd')}
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
        {t('workers.analyticsTab.title')}
      </Text>
      <Text
        style={{
          fontSize: fontSize.sm,
          color: m3.colorScheme.onSurfaceVariant,
          textAlign: 'center',
          marginTop: spacing[2],
        }}
      >
        {t('workers.analyticsTab.subtitle')}
      </Text>
      <Text
        style={{
          fontSize: fontSize.xs,
          color: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7),
          marginTop: spacing[4],
        }}
      >
        {t('workers.analyticsTab.comingSoon')}
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
            options={TAB_DATA.map((tab) => ({ value: tab.id, label: t(tab.labelKey) }))}
            selectedValue={selectedTab}
            onSelect={(value) => setSelectedTab(value as WorkersTab)}
          />
        </View>

        {/* Tab Content */}
        {selectedTab === 'workers' && renderWorkersTab()}
        {selectedTab === 'attendance' && renderAttendanceTab()}
        {selectedTab === 'analytics' && renderAnalyticsTab()}

        {/* Primary action */}
        {selectedTab === 'workers' && (workers?.length || 0) > 0 && (
          <Pressable
            onPress={() => {
              setAddWorker({ worker: null });
              router.push('/add-worker');
            }}
            style={{
              position: 'absolute',
              bottom: fabBottom,
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
            accessibilityLabel={t('workers.form.saveAdd')}
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
      </View>

      {/* Add/Edit Worker handled via route */}
    </>
  );
}
