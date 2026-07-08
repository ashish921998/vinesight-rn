import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Symbol as Icon } from '@/components/ui/symbol';
import { borderRadius, fontSize, fontWeight, spacing } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';

type NoActiveSeasonBannerProps = {
  /**
   * When provided, renders a "Start season" action link. Omit on entry points
   * that can't start a season inline (the banner then stays purely
   * informational rather than dead-ending the tap).
   */
  onStartSeason?: () => void;
  /** Optional override copy — e.g. the delegated/consultant path may name the farm. */
  message?: string;
};

/**
 * Non-blocking notice shown inside logging forms when the target farm has no
 * active season. Records still save (the DB trigger leaves season_id null
 * permissively); this just tells the user those records will stay unassigned
 * until a season is started. Modeled on the soft note already used in the
 * reports filter panel — never a blocking dialog.
 */
export function NoActiveSeasonBanner({ onStartSeason, message }: NoActiveSeasonBannerProps) {
  const { t } = useTranslation();
  const m3 = useM3();

  return (
    <View
      accessibilityRole="alert"
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing[2],
        backgroundColor: m3.surface.s100,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.12),
        padding: spacing[3],
        marginBottom: spacing[3],
      }}
    >
      <Icon
        name="info.circle"
        size={16}
        color={m3.colorScheme.onSurfaceVariant}
        style={{ marginTop: 1 }}
      />
      <View style={{ flex: 1, gap: spacing[1] }}>
        <Text
          style={{
            fontSize: fontSize.sm,
            color: m3.colorScheme.onSurfaceVariant,
            flex: 1,
          }}
        >
          {message ?? t('farmDetails.seasons.banner.noActiveSeason')}
        </Text>
        {onStartSeason ? (
          <Pressable
            onPress={onStartSeason}
            accessibilityRole="button"
            accessibilityLabel={t('farmDetails.seasons.banner.startSeason')}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Text
              style={{
                fontSize: fontSize.sm,
                color: m3.colorScheme.primary,
                fontWeight: fontWeight.medium,
              }}
            >
              {t('farmDetails.seasons.banner.startSeason')}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
