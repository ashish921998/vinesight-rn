/**
 * Add Worker Modal
 * Modal for adding/editing workers
 * Redesigned with Airbnb-style UI
 */

import React, { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCreateWorker, useUpdateWorker } from '@/hooks';
import type { Worker } from '@/types';
import { FormModal, SectionHeader, FormInput, Toggle, InfoCard } from '@/components/ui';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { triggerHapticSuccess } from '@/utils/haptics';
import { GuidedTourTarget, GUIDED_TOUR_TARGET_IDS } from '@/features/guided-tour';
import { WorkerFormTourCoachmark } from '@/features/guided-tour/worker-form-tour-coachmark';
import { useWorkersTourStore } from '@/features/guided-tour/workers-tour-store';

interface WorkerFormProps {
  visible?: boolean;
  onClose: () => void;
  worker?: Worker; // If provided, edit mode
  onSaveSuccess?: () => void;
  presentation?: 'modal' | 'screen';
}

export function WorkerForm({
  visible,
  onClose,
  worker,
  onSaveSuccess,
  presentation = 'modal',
}: WorkerFormProps) {
  const { t } = useTranslation();
  const m3 = useM3();

  const isVisible = visible ?? true;
  const [name, setName] = useState('');
  const [dailyRate, setDailyRate] = useState('');
  const [advanceBalance, setAdvanceBalance] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createWorker = useCreateWorker();
  const updateWorker = useUpdateWorker();
  const isEditMode = !!worker;

  // Fire the Add Worker tour once on first add (not on edit)
  const { _hydrated, hasSeenAddWorkerTour, startAddWorkerTour } = useWorkersTourStore();
  useEffect(() => {
    if (!_hydrated) return;
    if (isVisible && !isEditMode && !hasSeenAddWorkerTour) {
      const timer = setTimeout(startAddWorkerTour, 500);
      return () => clearTimeout(timer);
    }
  }, [_hydrated, isVisible, isEditMode, hasSeenAddWorkerTour, startAddWorkerTour]);

  useEffect(() => {
    if (worker) {
      setName(worker.name);
      setDailyRate(worker.daily_rate?.toString() || '');
      setAdvanceBalance(worker.advance_balance?.toString() || '0');
      setIsActive(worker.is_active);
    } else {
      // Reset form for add mode
      setName('');
      setDailyRate('');
      setAdvanceBalance('');
      setIsActive(true);
    }
  }, [worker, isVisible]);

  const isValid = name.trim().length > 0 && parseFloat(dailyRate) > 0;

  const handleReset = () => {
    setName('');
    setDailyRate('');
    setAdvanceBalance('');
    setIsActive(true);
  };

  const handleSave = async () => {
    if (isSubmitting) {
      return;
    }

    if (!isValid) {
      Alert.alert(
        t('common.alerts.missingInformationTitle'),
        t('common.alerts.enterWorkerNameAndDailyRate'),
      );
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditMode && worker?.id) {
        await updateWorker.mutateAsync({
          id: worker.id,
          updates: {
            name: name.trim(),
            daily_rate: parseFloat(dailyRate),
            advance_balance: parseFloat(advanceBalance) || 0,
            is_active: isActive,
          },
        });
      } else {
        await createWorker.mutateAsync({
          name: name.trim(),
          daily_rate: parseFloat(dailyRate),
          advance_balance: parseFloat(advanceBalance) || 0,
          is_active: isActive,
        });
      }

      triggerHapticSuccess();
      onSaveSuccess?.();
      onClose();
    } catch (error) {
      if (__DEV__) {
        console.error('Error saving worker:', error);
      }
      Alert.alert(t('common.error'), t('common.errors.failedToSaveWorker'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <FormModal
        visible={isVisible}
        onClose={onClose}
        title={isEditMode ? t('workers.form.editTitle') : t('workers.form.addTitle')}
        onSave={handleSave}
        saveLabel={isEditMode ? t('common.saveChanges') : t('workers.form.saveAdd')}
        isLoading={isSubmitting}
        isSaveDisabled={!isValid}
        showResetButton={!isEditMode}
        onReset={handleReset}
        presentation={presentation}
        saveButtonTargetId={!isEditMode ? GUIDED_TOUR_TARGET_IDS.WORKER_FORM_SAVE : undefined}
      >
        {/* Worker Details */}
        <SectionHeader title={t('workers.form.sections.details')} style={{ marginBottom: 16 }} />

        <GuidedTourTarget
          targetId={GUIDED_TOUR_TARGET_IDS.WORKER_FORM_NAME}
          enabled={!isEditMode}
          style={{ marginBottom: 12 }}
        >
          <FormInput
            label={t('workers.form.fields.name.label')}
            value={name}
            onChangeText={setName}
            placeholder={t('workers.form.fields.name.placeholder')}
            required
            autoFocus
          />
        </GuidedTourTarget>

        <GuidedTourTarget
          targetId={GUIDED_TOUR_TARGET_IDS.WORKER_FORM_DAILY_RATE}
          enabled={!isEditMode}
          style={{ marginBottom: 12 }}
        >
          <FormInput
            label={t('workers.form.fields.dailyRate.label')}
            value={dailyRate}
            onChangeText={setDailyRate}
            placeholder="400"
            keyboardType="decimal-pad"
            prefix="₹"
            suffix={t('workers.form.fields.dailyRate.perDayShort')}
            required
          />
        </GuidedTourTarget>

        <FormInput
          label={t('workers.form.fields.advanceAmountOptional.label')}
          value={advanceBalance}
          onChangeText={setAdvanceBalance}
          placeholder="0"
          keyboardType="decimal-pad"
          prefix="₹"
          style={{ marginBottom: 20 }}
        />

        {/* Active Status */}
        <SectionHeader title={t('workers.form.sections.status')} style={{ marginBottom: 16 }} />

        <Toggle
          label={t('workers.form.toggles.activeWorker')}
          description={t('workers.form.toggles.activeWorkerDescription')}
          value={isActive}
          onValueChange={setIsActive}
          style={{ marginBottom: 16 }}
        />

        {/* Info Card */}
        <InfoCard
          icon="information-circle"
          iconColor={m3.colorScheme.primary}
          backgroundColor={colorWithOpacity(m3.colorScheme.primary, 0.12)}
          message={t('workers.form.infoCardMessage')}
        />
      </FormModal>

      {/* Add Worker guided tour overlay */}
      {!isEditMode && <WorkerFormTourCoachmark />}
    </>
  );
}
