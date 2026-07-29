import React from 'react';
import { Pressable, Text } from 'react-native';
import { fontSize, fontWeight, radius, spacing } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { Symbol } from '@/components/ui/symbol';

interface ReportOutlineChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Icon shown when not selected — or always, when no selectedIcon is set. */
  icon?: string;
  /** Icon shown instead of `icon` when selected (e.g. a checkmark). */
  selectedIcon?: string;
}

/**
 * The outline selection chip shared across the reports screen — the filter
 * sheet's farm/season pickers and the register's Simple/Detailed preset.
 *
 * Selected = a translucent primary fill with a primary border; unselected =
 * transparent with an outline. This is deliberately distinct from `ChipRow`
 * (explore-primitives), which is a filled, horizontally scrolling filter and a
 * different visual — keeping two chip styles rather than letting the outline
 * variant be written inline twice and drift.
 */
export function ReportOutlineChip({
  label,
  selected,
  onPress,
  icon,
  selectedIcon,
}: ReportOutlineChipProps) {
  const m3 = useM3();
  const shownIcon = selected && selectedIcon ? selectedIcon : icon;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[2],
        minHeight: 36,
        paddingHorizontal: spacing[3],
        borderRadius: radius.full,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: selected ? m3.colorScheme.primary : m3.colorScheme.outlineVariant,
        backgroundColor: selected
          ? colorWithOpacity(m3.colorScheme.primary, 0.1)
          : pressed
            ? m3.surface.s200
            : 'transparent',
      })}
    >
      {shownIcon ? (
        <Symbol
          name={shownIcon}
          size={13}
          color={selected ? m3.colorScheme.primary : m3.colorScheme.onSurfaceVariant}
        />
      ) : null}
      <Text
        numberOfLines={1}
        style={{
          fontSize: fontSize.xs,
          fontWeight: selected ? fontWeight.semibold : fontWeight.medium,
          color: selected ? m3.colorScheme.primary : m3.colorScheme.onSurfaceVariant,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
