/**
 * Farm Log Form
 * Shared add/edit wrapper for farm logs.
 */

import React from 'react';
import { View, Text } from 'react-native';
import { EntryForm } from '@/components/screens/entry-form';
import { ActivityEditForm } from '@/components/screens/activity-edit-form';
import { useModalStore } from '@/stores';

type FarmLogMode = 'add' | 'edit';

interface FarmLogFormProps {
  mode: FarmLogMode;
  farmId?: number | null;
  onClose: () => void;
}

export function FarmLogForm({ mode, farmId, onClose }: FarmLogFormProps) {
  const { editActivity } = useModalStore();

  if (mode === 'edit') {
    if (!editActivity) {
      console.warn('[FarmLogForm] Missing editActivity for edit mode.');
      onClose();
      return (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '600', textAlign: 'center' }}>
            Unable to load activity details.
          </Text>
          <Text style={{ marginTop: 8, textAlign: 'center', color: '#6B7280' }}>
            Please try again from the activity list.
          </Text>
        </View>
      );
    }
    return (
      <ActivityEditForm
        onClose={onClose}
        presentation="screen"
        farm={editActivity.farm}
        logType={editActivity.logType}
        record={editActivity.record}
      />
    );
  }

  return (
    <EntryForm
      onClose={onClose}
      presentation="screen"
      tabs={['log']}
      initialTab="log"
      initialFarmId={farmId ?? null}
    />
  );
}
