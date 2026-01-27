import React, { useState, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { Symbol } from '@/components/ui/Symbol';
import { useWorkers, useDeleteWorker } from '@/hooks';
import { AddWorkerModal } from '@/components/screens';
import { AttendanceView } from '@/components/screens';
import type { Worker } from '@/types';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';

type WorkersTab = 'workers' | 'attendance' | 'analytics';

const TAB_DATA: { id: WorkersTab; label: string; icon: string }[] = [
  { id: 'workers', label: 'Workers', icon: 'person.2.fill' },
  { id: 'attendance', label: 'Attendance', icon: 'calendar' },
  { id: 'analytics', label: 'Analytics', icon: 'chart.bar.fill' },
];

export default function WorkersScreen() {
  const { data: workers, isLoading, refetch } = useWorkers();
  const deleteWorker = useDeleteWorker();

  const [selectedTab, setSelectedTab] = useState<WorkersTab>('workers');
  const [showAddModal, setShowAddModal] = useState(false);
  const [workerToEdit, setWorkerToEdit] = useState<Worker | undefined>(undefined);

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
              await deleteWorker.mutateAsync(worker.id);
            }
          },
        },
      ],
    );
  };

  const handleEditWorker = (worker: Worker) => {
    setWorkerToEdit(worker);
    setShowAddModal(true);
  };

  const handleAddModalClose = () => {
    setShowAddModal(false);
    setWorkerToEdit(undefined);
  };

  const renderWorker = ({ item }: { item: Worker }) => (
    <TouchableOpacity
      style={{
        backgroundColor: colors.white,
        marginHorizontal: spacing[4],
        marginBottom: spacing[3],
        borderRadius: borderRadius['2xl'],
        overflow: 'hidden',
      }}
      activeOpacity={0.7}
      onPress={() => handleEditWorker(item)}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: spacing[4],
        }}
      >
        {/* Avatar */}
        <View
          style={{
            width: 48,
            height: 48,
            backgroundColor: 'rgba(64, 128, 89, 0.1)',
            borderRadius: borderRadius.full,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              fontSize: fontSize.lg,
              fontWeight: fontWeight.bold,
              color: colors.primary[500],
            }}
          >
            {item.name.charAt(0).toUpperCase()}
          </Text>
        </View>

        {/* Info */}
        <View
          style={{
            flex: 1,
            marginLeft: spacing[3],
          }}
        >
          <Text
            style={{
              fontSize: fontSize.base,
              fontWeight: fontWeight.semibold,
              color: colors.black,
            }}
          >
            {item.name}
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginTop: spacing[1],
            }}
          >
            <Symbol name="indianrupeesign.circle" size={12} color={colors.gray[400]} />
            <Text
              style={{
                fontSize: fontSize.sm,
                color: colors.gray[400],
                marginLeft: spacing[1],
              }}
            >
              ₹{item.daily_rate}/day
            </Text>
          </View>
        </View>

        {/* Advance Balance */}
        {item.advance_balance > 0 && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: 'rgba(251, 146, 60, 0.1)',
              paddingHorizontal: spacing[2],
              paddingVertical: spacing[1],
              borderRadius: borderRadius.full,
              marginRight: spacing[2],
            }}
          >
            <Symbol name="arrow.up.circle.fill" size={12} color="#F59E0B" />
            <Text
              style={{
                fontSize: fontSize.xs,
                fontWeight: fontWeight.semibold,
                color: '#EA580C',
                marginLeft: spacing[1],
              }}
            >
              ₹{item.advance_balance}
            </Text>
          </View>
        )}

        {/* Actions */}
        <TouchableOpacity onPress={() => handleDeleteWorker(item)} style={{ padding: spacing[2] }}>
          <Symbol name="trash" size={18} color={colors.error} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderWorkersTab = () => (
    <FlatList
      data={activeWorkers}
      renderItem={renderWorker}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={{
        paddingTop: spacing[4],
        paddingBottom: 100,
        flexGrow: 1,
      }}
      ListHeaderComponent={
        activeWorkers.length > 0 ? (
          <Text
            style={{
              fontSize: fontSize.xs,
              fontWeight: fontWeight.bold,
              color: colors.gray[400],
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
                color: colors.gray[400],
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
                backgroundColor: 'rgba(64, 128, 89, 0.1)',
                borderRadius: borderRadius.full,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: spacing[4],
              }}
            >
              <Symbol name="person.2" size={40} color={colors.primary[500]} />
            </View>
            <Text
              style={{
                fontSize: fontSize.lg,
                fontWeight: fontWeight.semibold,
                color: colors.black,
                textAlign: 'center',
              }}
            >
              No Workers Yet
            </Text>
            <Text
              style={{
                fontSize: fontSize.sm,
                color: colors.gray[400],
                textAlign: 'center',
                marginTop: spacing[2],
              }}
            >
              Add workers to track attendance,{`\n`}payments, and settlements.
            </Text>
            <TouchableOpacity
              onPress={() => setShowAddModal(true)}
              style={{
                backgroundColor: colors.primary[500],
                paddingHorizontal: spacing[6],
                paddingVertical: spacing[3],
                borderRadius: borderRadius.xl,
                marginTop: spacing[4],
              }}
            >
              <Text
                style={{
                  color: colors.white,
                  fontWeight: fontWeight.semibold,
                }}
              >
                Add Worker
              </Text>
            </TouchableOpacity>
          </View>
        ) : null
      }
      refreshControl={
        <RefreshControl
          refreshing={isLoading}
          onRefresh={refetch}
          tintColor={colors.primary[500]}
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
          backgroundColor: 'rgba(139, 92, 246, 0.1)',
          borderRadius: borderRadius.full,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing[4],
        }}
      >
        <Symbol name="chart.bar" size={40} color="#8B5CF6" />
      </View>
      <Text
        style={{
          fontSize: fontSize.lg,
          fontWeight: fontWeight.semibold,
          color: colors.black,
          textAlign: 'center',
        }}
      >
        Labor Analytics
      </Text>
      <Text
        style={{
          fontSize: fontSize.sm,
          color: colors.gray[400],
          textAlign: 'center',
          marginTop: spacing[2],
        }}
      >
        View labor costs, productivity,{`\n`}and attendance patterns.
      </Text>
      <Text
        style={{
          fontSize: fontSize.xs,
          color: colors.gray[300],
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
          backgroundColor: colors.gray[100],
        }}
      >
        {/* Tab Selector */}
        <View
          style={{
            backgroundColor: colors.white,
            paddingHorizontal: spacing[4],
            paddingTop: spacing[2],
            paddingBottom: spacing[3],
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: colors.gray[100],
              borderRadius: borderRadius.xl,
              padding: spacing[1],
            }}
          >
            {TAB_DATA.map((tab) => {
              const isSelected = selectedTab === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => setSelectedTab(tab.id)}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingVertical: 10,
                    borderRadius: borderRadius.lg,
                    backgroundColor: isSelected ? colors.white : 'transparent',
                    borderWidth: isSelected ? 1 : 0,
                    borderColor: isSelected ? colors.gray[200] : 'transparent',
                  }}
                >
                  <Symbol
                    name={tab.icon}
                    size={16}
                    color={isSelected ? colors.primary[500] : colors.gray[400]}
                  />
                  <Text
                    style={{
                      fontSize: fontSize.sm,
                      fontWeight: fontWeight.medium,
                      marginLeft: 6,
                      color: isSelected ? colors.primary[500] : colors.gray[400],
                    }}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Tab Content */}
        {selectedTab === 'workers' && renderWorkersTab()}
        {selectedTab === 'attendance' && renderAttendanceTab()}
        {selectedTab === 'analytics' && renderAnalyticsTab()}

        {/* FAB */}
        {selectedTab === 'workers' && (workers?.length || 0) > 0 && (
          <TouchableOpacity
            onPress={() => setShowAddModal(true)}
            style={{
              position: 'absolute',
              bottom: spacing[6],
              right: spacing[6],
              width: 56,
              height: 56,
              backgroundColor: colors.primary[500],
              borderRadius: borderRadius.full,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            activeOpacity={0.8}
          >
            <Symbol name="plus" size={28} color={colors.white} />
          </TouchableOpacity>
        )}
      </View>

      {/* Add/Edit Worker Modal */}
      <AddWorkerModal
        visible={showAddModal}
        onClose={handleAddModalClose}
        worker={workerToEdit}
        onSaveSuccess={refetch}
      />
    </>
  );
}
