/**
 * Farm Log Form
 * Shared add/edit wrapper for farm logs.
 */

import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { EntryForm } from '@/components/screens/entry-form';
import { ActivityEditForm } from '@/components/screens/activity-edit-form';
import { useModalStore } from '@/stores';
import { useFarm } from '@/hooks';
import { useM3 } from '@/styles/use-theme';

type FarmLogMode = 'add' | 'edit';

interface FarmLogFormProps {
  mode: FarmLogMode;
  farmId?: number | null;
  onClose: () => void;
}

export function FarmLogForm({ mode, farmId, onClose }: FarmLogFormProps) {
  const { t } = useTranslation();
  const m3 = useM3();
  const { editActivity } = useModalStore();
  const { data: farm } = useFarm(farmId ?? undefined);

  useEffect(() => {
    if (mode === 'edit' && !editActivity) {
      if (__DEV__) {
        console.warn('[FarmLogForm] Missing editActivity for edit mode.');
      }
      onClose();
    }
  }, [mode, editActivity, onClose]);

  if (mode === 'edit') {
    if (!editActivity) {
      return (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: '600',
              textAlign: 'center',
              color: m3.colorScheme.onSurfaceVariant,
            }}
          >
            {t('activityEdit.loadErrorTitle')}
          </Text>
          <Text
            style={{
              marginTop: 8,
              textAlign: 'center',
              color: m3.colorScheme.onSurfaceVariant,
            }}
          >
            {t('activityEdit.loadErrorBody')}
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
      tabs={['log', 'task']}
      initialTab="log"
      farm={farm ?? undefined}
      initialFarmId={farmId ?? null}
    />
  );
}
