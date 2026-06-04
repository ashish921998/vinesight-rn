import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '@/components/ui/app-icon';
import { useFarm, useDailyNoteByDate, useUpsertDailyNote } from '@/hooks';
import { useM3, useThemeColors } from '@/styles/use-theme';
import { borderRadius, fontSize, spacing } from '@/styles/theme';
import { formatDate } from '@/i18n/format';
import { formatLocalDate } from '@/utils/date';
import { colorWithOpacity } from '@/utils/color';
import {
  markOnboardingFirstActionCompleted,
  parseOnboardingActionType,
  parseOnboardingFlag,
} from '@/features/onboarding/activation';

export default function AddNoteRoute() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const m3 = useM3();
  const colors = useThemeColors();
  const { t } = useTranslation();

  const params = useLocalSearchParams<{
    farmId?: string;
    date?: string;
    onboarding?: string;
    onboardingActionType?: string;
  }>();
  const farmId =
    params.farmId && !isNaN(Number(params.farmId)) ? parseInt(params.farmId, 10) : null;
  const isOnboardingActionFlow = parseOnboardingFlag(params.onboarding);
  const onboardingActionType = parseOnboardingActionType(params.onboardingActionType) ?? 'note';

  const { data: farm } = useFarm(farmId ?? undefined);

  const initialDate = useMemo(() => {
    const rawDate = Array.isArray(params.date) ? params.date[0] : params.date;
    if (!rawDate || !/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) return new Date();
    const [year, month, day] = rawDate.split('-').map(Number);
    const parsedDate = new Date(year, month - 1, day);
    if (
      parsedDate.getFullYear() !== year ||
      parsedDate.getMonth() !== month - 1 ||
      parsedDate.getDate() !== day
    ) {
      return new Date();
    }
    return parsedDate;
  }, [params.date]);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [draftNotesByDate, setDraftNotesByDate] = useState<Record<string, string>>({});

  const dateStr = useMemo(() => formatLocalDate(selectedDate), [selectedDate]);
  const { data: existingNote, isLoading: isLoadingNote } = useDailyNoteByDate(
    farmId ?? undefined,
    dateStr,
  );
  const upsertDailyNote = useUpsertDailyNote();

  const notes = draftNotesByDate[dateStr] ?? existingNote?.notes ?? '';

  const isSaving = upsertDailyNote.isPending;
  const hasUnsavedChanges = useMemo(() => {
    const currentDraft = draftNotesByDate[dateStr];
    const trimmedDraft = currentDraft === undefined ? null : currentDraft.trim();
    if (trimmedDraft === null) return false;
    return trimmedDraft !== (existingNote?.notes ?? '').trim();
  }, [dateStr, draftNotesByDate, existingNote?.notes]);
  const canSave = Boolean(farmId && !isSaving && hasUnsavedChanges);

  const handleClose = () => {
    if (hasUnsavedChanges) {
      Alert.alert(t('dailyNoteForm.discard.title'), t('dailyNoteForm.discard.body'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('dailyNoteForm.discard.confirm'),
          style: 'destructive',
          onPress: () => router.back(),
        },
      ]);
      return;
    }
    router.back();
  };

  const handleSave = async () => {
    if (!farmId) {
      Alert.alert(t('common.error'), t('common.errors.selectFarm'));
      return;
    }
    if (!notes.trim()) {
      Alert.alert(t('common.error'), t('dailyNoteForm.errors.missingNote'));
      return;
    }

    try {
      await upsertDailyNote.mutateAsync({
        farm_id: farmId,
        date: dateStr,
        notes: notes.trim(),
      });
      if (isOnboardingActionFlow) {
        markOnboardingFirstActionCompleted({
          actionType: onboardingActionType,
          farmId,
        });
      }
      router.back();
    } catch {
      Alert.alert(t('common.error'), t('dailyNoteForm.errors.failedToSave'));
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: m3.colorScheme.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View
          style={{
            paddingTop: insets.top + spacing[2],
            paddingHorizontal: spacing[4],
            paddingBottom: spacing[3],
            backgroundColor: colors.white,
            borderBottomWidth: 1,
            borderBottomColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.12),
          }}
        >
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Pressable onPress={handleClose} disabled={isSaving}>
              <Text style={{ color: m3.colorScheme.primary }}>{t('common.cancel')}</Text>
            </Pressable>
            <Text style={{ ...m3.typography.titleMedium, color: m3.colorScheme.onSurface }}>
              {existingNote?.id ? t('dailyNoteForm.editTitle') : t('dailyNoteForm.addTitle')}
            </Text>
            <Pressable onPress={handleSave} disabled={!canSave}>
              <Text
                style={{
                  color: canSave
                    ? m3.colorScheme.primary
                    : colorWithOpacity(m3.colorScheme.onSurface, 0.3),
                }}
              >
                {isSaving ? t('tasks.form.saving') : t('common.save')}
              </Text>
            </Pressable>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing[4], gap: spacing[4] }}>
          <View
            style={{
              backgroundColor: colors.surface[100],
              borderRadius: borderRadius.xl,
              padding: spacing[4],
              borderWidth: 1,
              borderColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.12),
            }}
          >
            <Text
              style={{
                ...m3.typography.labelLarge,
                color: m3.colorScheme.onSurfaceVariant,
                marginBottom: spacing[2],
              }}
            >
              {t('entryForm.farmLabel')}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <AppIcon name="leaf" size={18} color={m3.colorScheme.primary} />
              <Text
                style={{
                  ...m3.typography.bodyMedium,
                  color: m3.colorScheme.onSurface,
                  marginLeft: spacing[2],
                }}
              >
                {farm?.name ?? t('common.loading')}
              </Text>
            </View>
          </View>

          <View
            style={{
              backgroundColor: colors.surface[100],
              borderRadius: borderRadius.xl,
              padding: spacing[4],
              borderWidth: 1,
              borderColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.12),
            }}
          >
            <Text
              style={{
                ...m3.typography.labelLarge,
                color: m3.colorScheme.onSurfaceVariant,
                marginBottom: spacing[2],
              }}
            >
              {t('entryForm.dateLabel')}
            </Text>
            <Pressable
              onPress={() => setShowDatePicker(true)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: spacing[3],
                paddingHorizontal: spacing[3],
                borderRadius: borderRadius.lg,
                borderWidth: 1,
                borderColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
                backgroundColor: colors.surface[50],
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <AppIcon name="calendar" size={18} color={m3.colorScheme.primary} />
                <Text
                  style={{
                    ...m3.typography.bodyMedium,
                    color: m3.colorScheme.onSurface,
                    marginLeft: spacing[2],
                  }}
                >
                  {formatDate(selectedDate, { weekday: 'short', month: 'short', day: 'numeric' })}
                </Text>
              </View>
              <AppIcon name="chevron-down" size={16} color={m3.colorScheme.onSurfaceVariant} />
            </Pressable>
            {showDatePicker && Platform.OS !== 'ios' && (
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display="default"
                onChange={(_event, date) => {
                  setShowDatePicker(false);
                  if (date) {
                    setSelectedDate(date);
                  }
                }}
              />
            )}
            {showDatePicker && Platform.OS === 'ios' && (
              <Modal
                transparent
                visible={showDatePicker}
                animationType="fade"
                onRequestClose={() => setShowDatePicker(false)}
              >
                <Pressable
                  onPress={() => setShowDatePicker(false)}
                  style={{
                    flex: 1,
                    backgroundColor: colorWithOpacity(m3.colorScheme.shadow, 0.5),
                    justifyContent: 'flex-end',
                  }}
                >
                  <View
                    style={{
                      backgroundColor: colors.surface[100],
                      borderTopLeftRadius: borderRadius['2xl'],
                      borderTopRightRadius: borderRadius['2xl'],
                      padding: spacing[4],
                    }}
                    onStartShouldSetResponder={() => true}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: spacing[4],
                      }}
                    >
                      <Text
                        style={{
                          fontSize: fontSize.lg,
                          fontWeight: '700',
                          color: m3.colorScheme.onSurface,
                        }}
                      >
                        {t('entryForm.selectDate')}
                      </Text>
                      <Pressable onPress={() => setShowDatePicker(false)}>
                        <AppIcon
                          name="close"
                          size={24}
                          color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)}
                        />
                      </Pressable>
                    </View>
                    <DateTimePicker
                      value={selectedDate}
                      mode="date"
                      display="spinner"
                      onChange={(_event, date) => {
                        if (date) {
                          setSelectedDate(date);
                        }
                      }}
                    />
                    <Pressable
                      onPress={() => setShowDatePicker(false)}
                      style={{
                        marginTop: spacing[4],
                        paddingVertical: spacing[3],
                        borderRadius: borderRadius.lg,
                        alignItems: 'center',
                        backgroundColor: m3.colorScheme.primary,
                      }}
                    >
                      <Text
                        style={{
                          fontWeight: '600',
                          color: m3.colorScheme.onPrimary,
                        }}
                      >
                        {t('entryForm.done')}
                      </Text>
                    </Pressable>
                  </View>
                </Pressable>
              </Modal>
            )}
          </View>

          <View
            style={{
              backgroundColor: colors.surface[100],
              borderRadius: borderRadius.xl,
              padding: spacing[4],
              borderWidth: 1,
              borderColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.12),
            }}
          >
            <Text
              style={{
                ...m3.typography.labelLarge,
                color: m3.colorScheme.onSurfaceVariant,
                marginBottom: spacing[2],
              }}
            >
              {t('dailyNoteForm.fields.note')}
            </Text>
            <TextInput
              value={notes}
              onChangeText={(value) => {
                setDraftNotesByDate((prev) => ({
                  ...prev,
                  [dateStr]: value,
                }));
              }}
              placeholder={t('dailyNoteForm.placeholders.note')}
              placeholderTextColor={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)}
              multiline
              textAlignVertical="top"
              style={{
                minHeight: 160,
                borderWidth: 1,
                borderColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
                borderRadius: borderRadius.lg,
                paddingVertical: spacing[3],
                paddingHorizontal: spacing[3],
                color: m3.colorScheme.onSurface,
                backgroundColor: colors.surface[50],
              }}
            />
            {!isLoadingNote && existingNote?.updated_at ? (
              <Text
                style={{
                  ...m3.typography.labelSmall,
                  color: m3.colorScheme.onSurfaceVariant,
                  marginTop: spacing[2],
                }}
              >
                {t('dailyNoteForm.lastUpdated', {
                  date: formatDate(new Date(existingNote.updated_at), {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  }),
                })}
              </Text>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
