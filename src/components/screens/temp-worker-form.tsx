import React, { useState } from 'react';
import { Platform, View, Text, Pressable, Alert } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTranslation } from 'react-i18next';
import { useCreateTemporaryWorkerEntry, useFarms, useCurrency } from '@/hooks';
import { FormModal, SectionHeader, FormInput, PreviewCard, Button } from '@/components/ui';
import { NoActiveSeasonBanner } from '@/components/ui/no-active-season-banner';
import { useFarmSeasonStatus } from '@/hooks/use-farm-seasons';
import { createStartSeasonHref } from '@/utils/add-log-navigation';
import { useRouter } from 'expo-router';
import { FarmSelectModal } from '@/components/modals/farm-select-modal';
import { useM3 } from '@/styles/use-theme';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { formatDate, formatCurrency } from '@/i18n/format';
import { formatLocalDate } from '@/utils/date';
import { triggerHapticSuccess } from '@/utils/haptics';
import { Symbol as IconSymbol } from '@/components/ui/symbol';
import { colorWithOpacity } from '@/utils/color';

interface TempWorkerFormProps {
  visible?: boolean;
  onClose: () => void;
  farmId?: number;
  onSaveSuccess?: () => void;
  presentation?: 'modal' | 'screen';
}

export function TempWorkerForm({
  visible,
  onClose,
  farmId: externalFarmId,
  onSaveSuccess,
  presentation = 'modal',
}: TempWorkerFormProps) {
  const { t } = useTranslation();
  const m3 = useM3();
  const { data: farms } = useFarms();
  const currency = useCurrency();

  const isVisible = visible ?? true;
  const [name, setName] = useState('');
  const [date, setDate] = useState(new Date());
  const [hoursWorked, setHoursWorked] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedFarmId, setSelectedFarmId] = useState<number | null>(externalFarmId ?? null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showFarmModal, setShowFarmModal] = useState(false);

  const createTemporaryWorkerEntry = useCreateTemporaryWorkerEntry();

  const resolvedFarmId = externalFarmId ?? selectedFarmId;
  const { activeSeason } = useFarmSeasonStatus(resolvedFarmId ?? undefined);
  // Block save until the resolved farm has an active season.
  const isBlockedByNoSeason = resolvedFarmId != null && !activeSeason;
  const router = useRouter();
  const goStartSeason = () => {
    if (resolvedFarmId == null) return;
    onClose();
    router.push(createStartSeasonHref(resolvedFarmId));
  };
  const parsedHours = parseFloat(hoursWorked);
  const parsedAmount = parseFloat(amountPaid);
  const isHoursValid =
    hoursWorked.trim().length === 0 || (Number.isFinite(parsedHours) && parsedHours >= 0);
  const isValid =
    name.trim().length > 0 && parsedAmount > 0 && resolvedFarmId != null && isHoursValid;

  const handleReset = () => {
    setName('');
    setDate(new Date());
    setHoursWorked('');
    setAmountPaid('');
    setNotes('');
    if (!externalFarmId) setSelectedFarmId(null);
  };

  const handleSave = async () => {
    if (isSubmitting) {
      return;
    }

    if (!isValid) {
      Alert.alert(
        t('common.alerts.missingInformationTitle'),
        t('workers.tempWorkers.form.validation'),
      );
      return;
    }

    setIsSubmitting(true);

    try {
      await createTemporaryWorkerEntry.mutateAsync({
        farm_id: resolvedFarmId!,
        date: formatLocalDate(date),
        name: name.trim(),
        hours_worked: parsedHours || 0,
        amount_paid: parsedAmount,
        notes: notes.trim() || null,
      });

      setIsSubmitting(false);
      triggerHapticSuccess();
      handleReset();
      onSaveSuccess?.();
      onClose();
    } catch (error) {
      setIsSubmitting(false);
      if (__DEV__) {
        console.error('Error saving temporary worker entry:', error);
      }
      const msg = error instanceof Error ? error.message : t('workers.tempWorkers.form.error');
      Alert.alert(t('common.error'), msg);
    }
  };

  const showHourlyRate = parsedHours > 0 && parsedAmount > 0;

  return (
    <FormModal
      visible={isVisible}
      onClose={onClose}
      title={t('workers.tempWorkers.form.title')}
      onSave={handleSave}
      saveLabel={t('workers.tempWorkers.form.save')}
      isLoading={isSubmitting}
      isSaveDisabled={!isValid || isBlockedByNoSeason}
      showResetButton
      onReset={handleReset}
      presentation={presentation}
    >
      {isBlockedByNoSeason ? <NoActiveSeasonBanner onStartSeason={goStartSeason} /> : null}
      <SectionHeader
        title={t('workers.tempWorkers.form.sections.workerDetails')}
        style={{ marginBottom: spacing[4] }}
      />

      <FormInput
        label={t('workers.tempWorkers.form.fields.name.label')}
        value={name}
        onChangeText={setName}
        placeholder={t('workers.tempWorkers.form.fields.name.placeholder')}
        required
        autoFocus
        style={{ marginBottom: spacing[3] }}
      />

      <Text
        style={{
          fontSize: fontSize.sm,
          fontWeight: fontWeight.medium,
          color: m3.surface.s700,
          marginBottom: spacing[2],
        }}
      >
        {t('workers.tempWorkers.form.fields.date.label')}
      </Text>
      <Pressable
        onPress={() => setShowDatePicker(true)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: m3.surface.s100,
          borderRadius: borderRadius.xl,
          borderWidth: 2,
          borderColor: m3.surface.s200,
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[3],
          marginBottom: spacing[3],
        }}
      >
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: borderRadius.full,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
            marginRight: spacing[3],
          }}
        >
          <IconSymbol name="calendar" size={16} color={m3.colorScheme.primary} />
        </View>
        <Text
          style={{
            fontSize: fontSize.base,
            fontWeight: fontWeight.medium,
            color: m3.colorScheme.onSurface,
          }}
        >
          {formatDate(date, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
        </Text>
      </Pressable>

      <SectionHeader
        title={t('workers.tempWorkers.form.sections.workDetails')}
        style={{ marginBottom: spacing[4] }}
      />

      {!externalFarmId && (
        <>
          <Text
            style={{
              fontSize: fontSize.sm,
              color: m3.surface.s600,
              marginBottom: spacing[2],
            }}
          >
            {t('workers.tempWorkers.form.fields.farm.label')}
          </Text>
          <Pressable
            onPress={() => setShowFarmModal(true)}
            style={{
              backgroundColor: m3.surface.s100,
              borderRadius: borderRadius.xl,
              borderWidth: 2,
              borderColor: selectedFarmId ? m3.colorScheme.primary : m3.surface.s200,
              paddingVertical: spacing[3] + 2,
              paddingHorizontal: spacing[4],
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: spacing[3],
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <IconSymbol
                name="leaf.fill"
                size={18}
                color={selectedFarmId ? m3.colorScheme.primary : m3.surface.s500}
              />
              <Text
                style={{
                  fontSize: fontSize.base,
                  color: selectedFarmId ? m3.surface.s900 : m3.surface.s500,
                  marginLeft: spacing[2],
                }}
              >
                {selectedFarmId
                  ? (farms?.find((f) => f.id === selectedFarmId)?.name ??
                    t('workers.tempWorkers.form.fields.farm.label'))
                  : t('workers.tempWorkers.form.fields.farm.placeholder')}
              </Text>
            </View>
            <IconSymbol name="chevron.right" size={18} color={m3.surface.s500} />
          </Pressable>
        </>
      )}

      <FormInput
        label={t('workers.tempWorkers.form.fields.hoursWorked.label')}
        value={hoursWorked}
        onChangeText={setHoursWorked}
        placeholder="0"
        keyboardType="decimal-pad"
        suffix={t('workers.tempWorkers.form.fields.hoursWorked.suffix')}
        style={{ marginBottom: spacing[3] }}
      />

      <FormInput
        label={t('workers.tempWorkers.form.fields.amountPaid.label')}
        value={amountPaid}
        onChangeText={setAmountPaid}
        placeholder="0"
        keyboardType="decimal-pad"
        prefix={currency}
        required
        style={{ marginBottom: spacing[3] }}
      />

      <FormInput
        label={t('workers.tempWorkers.form.fields.notes.label')}
        value={notes}
        onChangeText={setNotes}
        placeholder={t('workers.tempWorkers.form.fields.notes.placeholder')}
        multiline
        numberOfLines={3}
        style={{ marginBottom: spacing[3] }}
      />

      {showHourlyRate && (
        <PreviewCard
          title={t('workers.tempWorkers.form.hourlyRate').toUpperCase()}
          items={[
            {
              label: t('workers.tempWorkers.form.hourlyRate'),
              value: `${formatCurrency(parsedAmount / parsedHours, currency)}${t('workers.tempWorkers.form.perHour')}`,
            },
          ]}
        />
      )}

      {showDatePicker && Platform.OS === 'ios' && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            zIndex: 50,
          }}
        >
          <Pressable
            onPress={() => setShowDatePicker(false)}
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              backgroundColor: colorWithOpacity(m3.colorScheme.shadow, 0.5),
            }}
          />
          <View
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: m3.surface.s100,
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
                marginBottom: spacing[4],
              }}
            >
              <Text
                style={{
                  fontSize: fontSize.lg,
                  fontWeight: fontWeight.semibold,
                  color: m3.colorScheme.onSurface,
                }}
              >
                {t('common.selectDate')}
              </Text>
              <Pressable
                onPress={() => setShowDatePicker(false)}
                accessibilityRole="button"
                accessibilityLabel="Close date picker"
                accessible={true}
              >
                <IconSymbol name="xmark.circle.fill" size={24} color={m3.surface.s500} />
              </Pressable>
            </View>
            <DateTimePicker
              value={date}
              mode="date"
              display="spinner"
              onChange={(_, selectedDate) => {
                if (selectedDate) setDate(selectedDate);
              }}
            />
            <Button
              title={t('common.done')}
              onPress={() => setShowDatePicker(false)}
              style={{ marginTop: spacing[4] }}
            />
          </View>
        </View>
      )}

      {showDatePicker && Platform.OS !== 'ios' && (
        <DateTimePicker
          value={date}
          mode="date"
          display="default"
          onChange={(_, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) setDate(selectedDate);
          }}
        />
      )}

      <FarmSelectModal
        visible={showFarmModal}
        title={t('workers.tempWorkers.form.fields.farm.label')}
        farms={farms ?? []}
        selectedFarmId={selectedFarmId}
        onSelect={(farmId) => {
          setSelectedFarmId(farmId);
          setShowFarmModal(false);
        }}
        onClose={() => setShowFarmModal(false)}
      />
    </FormModal>
  );
}
