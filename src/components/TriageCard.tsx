import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { PetioleTriage } from '@/types/petiole-triage';
import { getClassificationBadge } from '@/services/petiole-triage';
import { useTranslation } from 'react-i18next';

interface Props {
  triage: PetioleTriage;
}

export function TriageCard({ triage }: Props) {
  const { t } = useTranslation();
  const badge = getClassificationBadge(triage.classification);

  const getLabel = () => {
    switch (triage.classification) {
      case 'red':
        return t('farmDetails.fertilizerPlan.triageUrgent', 'Urgent');
      case 'yellow':
        return t('farmDetails.fertilizerPlan.triageWatch', 'Watch');
      case 'green':
        return t('farmDetails.fertilizerPlan.triageNormal', 'Normal');
      default:
        return 'Unknown';
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.badge, { backgroundColor: badge.color + '20' }]}>
        <Text style={styles.badgeEmoji}>{badge.emoji}</Text>
        <Text style={[styles.badgeText, { color: badge.color }]}>{getLabel()}</Text>
      </View>

      {triage.classification_reason && (
        <Text style={styles.reason}>{triage.classification_reason}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  badgeEmoji: {
    fontSize: 16,
    marginRight: 6,
  },
  badgeText: {
    fontWeight: '600',
    fontSize: 14,
  },
  reason: {
    marginTop: 12,
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
  },
});
