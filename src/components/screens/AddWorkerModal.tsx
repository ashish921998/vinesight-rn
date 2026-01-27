/**
 * Add Worker Modal
 * Modal for adding/editing workers
 * Redesigned with Airbnb-style UI
 */

import React, { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { useCreateWorker, useUpdateWorker } from '@/hooks';
import type { Worker } from '@/types';
import { FormModal, SectionHeader, FormInput, Toggle, InfoCard } from '@/components/ui';

interface AddWorkerModalProps {
  visible?: boolean;
  onClose: () => void;
  worker?: Worker; // If provided, edit mode
  onSaveSuccess?: () => void;
  presentation?: 'modal' | 'screen';
}

export function AddWorkerModal({
  visible,
  onClose,
  worker,
  onSaveSuccess,
  presentation = 'modal',
}: AddWorkerModalProps) {
  const isVisible = visible ?? true;
  const [name, setName] = useState('');
  const [dailyRate, setDailyRate] = useState('');
  const [advanceBalance, setAdvanceBalance] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createWorker = useCreateWorker();
  const updateWorker = useUpdateWorker();
  const isEditMode = !!worker;

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
      setAdvanceBalance('0');
      setIsActive(true);
    }
  }, [worker, isVisible]);

  const isValid = name.trim().length > 0 && parseFloat(dailyRate) > 0;

  const handleReset = () => {
    setName('');
    setDailyRate('');
    setAdvanceBalance('0');
    setIsActive(true);
  };

  const handleSave = async () => {
    if (!isValid) {
      Alert.alert('Missing Information', 'Please enter worker name and daily rate.');
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

      onSaveSuccess?.();
      onClose();
    } catch (error) {
      console.error('Error saving worker:', error);
      Alert.alert('Error', 'Failed to save worker. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FormModal
      visible={isVisible}
      onClose={onClose}
      title={isEditMode ? 'Edit Worker' : 'Add Worker'}
      onSave={handleSave}
      saveLabel={isEditMode ? 'Save Changes' : 'Add Worker'}
      isLoading={isSubmitting}
      isSaveDisabled={!isValid}
      showResetButton={!isEditMode}
      onReset={handleReset}
      presentation={presentation}
    >
      {/* Worker Details */}
      <SectionHeader title="Worker Details" style={{ marginBottom: 16 }} />

      <FormInput
        label="Worker Name"
        value={name}
        onChangeText={setName}
        placeholder="e.g., Rajesh Kumar"
        required
        autoFocus
        style={{ marginBottom: 12 }}
      />

      <FormInput
        label="Daily Rate"
        value={dailyRate}
        onChangeText={setDailyRate}
        placeholder="400"
        keyboardType="decimal-pad"
        prefix="₹"
        suffix="/day"
        required
        style={{ marginBottom: 12 }}
      />

      <FormInput
        label="Advance Amount (Optional)"
        value={advanceBalance}
        onChangeText={setAdvanceBalance}
        placeholder="0"
        keyboardType="decimal-pad"
        prefix="₹"
        style={{ marginBottom: 20 }}
      />

      {/* Active Status */}
      <SectionHeader title="Status" style={{ marginBottom: 16 }} />

      <Toggle
        label="Active Worker"
        description="Inactive workers won't appear in attendance lists"
        value={isActive}
        onValueChange={setIsActive}
        style={{ marginBottom: 16 }}
      />

      {/* Info Card */}
      <InfoCard
        icon="information-circle"
        iconColor="#3B82F6"
        backgroundColor="#EFF6FF"
        message="Daily rate is used to calculate earnings. Advance balance tracks outstanding loans."
      />
    </FormModal>
  );
}
