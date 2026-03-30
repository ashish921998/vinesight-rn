import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import { useM3 } from '@/styles/use-theme';
import { borderRadius, fontSize, fontWeight, spacing } from '@/styles/theme';
import type { OnboardingActionType } from '@/types/onboarding';
import { colorWithOpacity } from '@/utils/color';
import { OnboardingButton } from '../components/onboarding-button';

interface FirstActionSlideProps {
  isActive: boolean;
  isCompleted: boolean;
  canStartAction: boolean;
  selectedActionType: OnboardingActionType | null;
  onSelectAction: (actionType: OnboardingActionType) => void;
  onContinue: () => void;
}

const ACTIONS: Array<{
  type: OnboardingActionType;
  icon: string;
  titleKey: string;
  descriptionKey: string;
}> = [
  {
    type: 'log',
    icon: 'square.and.pencil',
    titleKey: 'onboarding.firstAction.actions.log.title',
    descriptionKey: 'onboarding.firstAction.actions.log.description',
  },
  {
    type: 'note',
    icon: 'doc.text.fill',
    titleKey: 'onboarding.firstAction.actions.note.title',
    descriptionKey: 'onboarding.firstAction.actions.note.description',
  },
  {
    type: 'task',
    icon: 'checklist',
    titleKey: 'onboarding.firstAction.actions.task.title',
    descriptionKey: 'onboarding.firstAction.actions.task.description',
  },
];

export function FirstActionSlide({
  isActive,
  isCompleted,
  canStartAction,
  selectedActionType,
  onSelectAction,
  onContinue,
}: FirstActionSlideProps) {
  const { t } = useTranslation();
  const m3 = useM3();

  return (
    <View style={[styles.container, { backgroundColor: m3.colorScheme.background }]}>
      <View
        style={[
          styles.panel,
          {
            backgroundColor: colorWithOpacity(m3.surface.surfaceContainerHigh, 0.68),
            borderColor: colorWithOpacity(m3.colorScheme.outline, 0.12),
          },
        ]}
      >
        <Animated.View
          entering={isActive ? FadeInDown.duration(450) : undefined}
          style={styles.header}
        >
          <View
            style={[
              styles.badge,
              { backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12) },
            ]}
          >
            <Text style={[styles.badgeText, { color: m3.colorScheme.primary }]}>
              {t('onboarding.firstAction.badge')}
            </Text>
          </View>
          <Text style={[styles.title, { color: m3.colorScheme.onSurface }]}>
            {t('onboarding.firstAction.title')}
          </Text>
          <Text style={[styles.subtitle, { color: m3.colorScheme.onSurfaceVariant }]}>
            {t('onboarding.firstAction.subtitle')}
          </Text>
        </Animated.View>

        <View style={styles.actionsContainer}>
          {ACTIONS.map((action, index) => {
            const isSelected = selectedActionType === action.type;
            return (
              <Animated.View
                key={action.type}
                entering={isActive ? FadeInDown.delay(90 + index * 80).duration(420) : undefined}
              >
                <Pressable
                  onPress={() => {
                    if (canStartAction) {
                      onSelectAction(action.type);
                    }
                  }}
                  disabled={!canStartAction}
                  style={({ pressed }) => [
                    styles.actionCard,
                    {
                      backgroundColor: isSelected
                        ? colorWithOpacity(m3.colorScheme.primary, 0.12)
                        : colorWithOpacity(m3.colorScheme.surface, 0.84),
                      borderColor: isSelected
                        ? colorWithOpacity(m3.colorScheme.primary, 0.3)
                        : colorWithOpacity(m3.colorScheme.outline, 0.1),
                      opacity: !canStartAction ? 0.55 : pressed ? 0.88 : 1,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.actionIcon,
                      {
                        backgroundColor: isSelected
                          ? colorWithOpacity(m3.colorScheme.primary, 0.16)
                          : colorWithOpacity(m3.colorScheme.secondary, 0.12),
                      },
                    ]}
                  >
                    <SymbolIcon
                      name={action.icon}
                      size={20}
                      color={isSelected ? m3.colorScheme.primary : m3.colorScheme.secondary}
                    />
                  </View>
                  <View style={styles.actionText}>
                    <Text style={[styles.actionTitle, { color: m3.colorScheme.onSurface }]}>
                      {t(action.titleKey)}
                    </Text>
                    <Text
                      style={[styles.actionDescription, { color: m3.colorScheme.onSurfaceVariant }]}
                    >
                      {t(action.descriptionKey)}
                    </Text>
                  </View>
                  {isSelected && (
                    <SymbolIcon
                      name="checkmark.circle.fill"
                      size={18}
                      color={m3.colorScheme.primary}
                    />
                  )}
                </Pressable>
              </Animated.View>
            );
          })}
        </View>

        <View
          style={[
            styles.completionHint,
            {
              backgroundColor: colorWithOpacity(
                isCompleted ? m3.colorScheme.primary : m3.colorScheme.tertiary,
                isCompleted ? 0.12 : 0.1,
              ),
            },
          ]}
        >
          <SymbolIcon
            name={isCompleted ? 'checkmark.seal.fill' : 'sparkles'}
            size={18}
            color={isCompleted ? m3.colorScheme.primary : m3.colorScheme.tertiary}
          />
          <Text style={[styles.completionText, { color: m3.colorScheme.onSurface }]}>
            {isCompleted
              ? t('onboarding.firstAction.completedHint')
              : t('onboarding.firstAction.pendingHint')}
          </Text>
        </View>

        <OnboardingButton
          label={t('onboarding.firstAction.continue')}
          onPress={onContinue}
          disabled={!isCompleted}
          variant="primary"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    paddingBottom: spacing[2],
  },
  panel: {
    flex: 1,
    borderWidth: 1,
    borderRadius: borderRadius['4xl'],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    gap: spacing[4],
  },
  header: {
    gap: spacing[1],
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
  },
  badgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  title: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    lineHeight: 30,
  },
  subtitle: {
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  actionsContainer: {
    gap: spacing[2],
  },
  actionCard: {
    borderWidth: 1,
    borderRadius: borderRadius['2xl'],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    flex: 1,
    gap: spacing[1],
  },
  actionTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  actionDescription: {
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  completionHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  completionText: {
    flex: 1,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
});
