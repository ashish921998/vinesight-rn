import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { spacing } from '@/styles/theme';
import {
  type FpcColumnOptions,
  FPC_FULL_COLUMNS,
  FPC_LEAN_COLUMNS,
  fpcColumnsEqualPreset,
} from '@/types/report';
import { ReportOutlineChip } from './report-outline-chip';

interface ReportFpcColumnTogglesProps {
  columns: FpcColumnOptions;
  onChange: (columns: FpcColumnOptions) => void;
}

/**
 * Column-detail preset for the buyer's register. Two chips rather than a card
 * of description blocks: this lives inside the register disclosure, directly
 * above the rows it reshapes, so the effect is visible and the prose is
 * redundant. A partial toggle (neither preset) falls back to Simple.
 */
export function ReportFpcColumnToggles({ columns, onChange }: ReportFpcColumnTogglesProps) {
  const { t } = useTranslation();
  const selectedPreset = fpcColumnsEqualPreset(columns, FPC_FULL_COLUMNS) ? 'detailed' : 'simple';

  const options = [
    { key: 'simple' as const, columns: FPC_LEAN_COLUMNS, icon: 'doc.text.fill' },
    { key: 'detailed' as const, columns: FPC_FULL_COLUMNS, icon: 'list.bullet' },
  ];

  return (
    <View
      accessibilityRole="radiogroup"
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}
    >
      {options.map((option) => (
        <ReportOutlineChip
          key={option.key}
          label={t(`reports.fpc.detail.${option.key}.title`)}
          selected={selectedPreset === option.key}
          onPress={() => onChange(option.columns)}
          icon={option.icon}
        />
      ))}
    </View>
  );
}
