/**
 * Farm Log Form
 * Shared edit wrapper for farm logs.
 */

import React, { useEffect } from 'react';
import { fontSize } from '@/styles/theme';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ActivityEditForm } from '@/components/screens/activity-edit-form';
import { useModalStore } from '@/stores';
import { useM3 } from '@/styles/use-theme';

interface FarmLogFormProps {
  onClose: () => void;
}

export function FarmLogForm({ onClose }: FarmLogFormProps) {
  const { t } = useTranslation();
  const m3 = useM3();
  const { editActivity } = useModalStore();

  useEffect(() => {
    if (!editActivity) {
      console.warn('[FarmLogForm] Missing editActivity for edit mode.');
      onClose();
    }
  }, [editActivity, onClose]);

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
            fontSize: fontSize.base,
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
