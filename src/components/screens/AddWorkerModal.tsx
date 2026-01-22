/**
 * Add Worker Modal
 * Modal for adding/editing workers
 * Ported from iOS AddWorkerSheet.swift
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCreateWorker, useUpdateWorker } from '@/hooks';
import type { Worker } from '@/types';

interface AddWorkerModalProps {
  visible: boolean;
  onClose: () => void;
  worker?: Worker; // If provided, edit mode
  onSaveSuccess?: () => void;
}

export function AddWorkerModal({ visible, onClose, worker, onSaveSuccess }: AddWorkerModalProps) {
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
  }, [worker, visible]);

  const isValid = name.trim().length > 0 && parseFloat(dailyRate) > 0;

  const handleSave = async () => {
    if (!isValid) return;

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
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 bg-surface-50"
      >
        {/* Header */}
        <View className="bg-white px-4 py-4 border-b border-surface-100">
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-bold text-surface-900">
              {isEditMode ? 'Edit Worker' : 'Add Worker'}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close-circle" size={28} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Content */}
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Form Card */}
          <View className="bg-white rounded-2xl p-4">
            {/* Name */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-surface-700 mb-2">
                Worker Name <Text className="text-red-500">*</Text>
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Enter worker name"
                placeholderTextColor="#9CA3AF"
                className="bg-surface-50 rounded-xl px-4 py-3 text-base text-surface-900"
              />
            </View>

            {/* Daily Rate */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-surface-700 mb-2">
                Daily Rate (₹) <Text className="text-red-500">*</Text>
              </Text>
              <View className="flex-row items-center bg-surface-50 rounded-xl">
                <Text className="text-surface-500 pl-4">₹</Text>
                <TextInput
                  value={dailyRate}
                  onChangeText={setDailyRate}
                  placeholder="400"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="decimal-pad"
                  className="flex-1 px-2 py-3 text-base text-surface-900"
                />
                <Text className="text-surface-500 pr-4">/day</Text>
              </View>
            </View>

            {/* Advance Balance */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-surface-700 mb-2">Advance Balance (₹)</Text>
              <View className="flex-row items-center bg-surface-50 rounded-xl">
                <Text className="text-surface-500 pl-4">₹</Text>
                <TextInput
                  value={advanceBalance}
                  onChangeText={setAdvanceBalance}
                  placeholder="0"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="decimal-pad"
                  className="flex-1 px-2 py-3 text-base text-surface-900"
                />
              </View>
              <Text className="text-xs text-surface-500 mt-1">
                Outstanding advance given to worker
              </Text>
            </View>

            {/* Active Status */}
            <View className="flex-row items-center justify-between py-2">
              <View>
                <Text className="text-sm font-medium text-surface-700">Active Worker</Text>
                <Text className="text-xs text-surface-500 mt-0.5">
                  Inactive workers are hidden from attendance
                </Text>
              </View>
              <Switch
                value={isActive}
                onValueChange={setIsActive}
                trackColor={{ false: '#D1D5DB', true: '#86EFAC' }}
                thumbColor={isActive ? '#22C55E' : '#F3F4F6'}
              />
            </View>
          </View>

          {/* Tips Card */}
          <View className="bg-blue-50 rounded-xl p-4 mt-4">
            <View className="flex-row items-start">
              <Ionicons name="information-circle" size={20} color="#3B82F6" />
              <View className="flex-1 ml-2">
                <Text className="text-sm font-medium text-blue-700">Tips</Text>
                <Text className="text-xs text-blue-600 mt-1">
                  • Daily rate is used to calculate attendance earnings{'\n'}• Advance balance
                  tracks money owed by the worker{'\n'}
                  {/* eslint-disable-next-line react/no-unescaped-entities */}• Mark workers as
                  inactive when they're no longer working
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Footer */}
        <View className="bg-white px-4 py-4 border-t border-surface-100">
          <View className="flex-row" style={{ gap: 12 }}>
            <TouchableOpacity
              onPress={onClose}
              className="flex-1 py-3.5 rounded-xl border border-surface-200 items-center"
            >
              <Text className="font-semibold text-surface-600">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              disabled={!isValid || isSubmitting}
              className="flex-1 py-3.5 rounded-xl items-center flex-row justify-center"
              style={{
                backgroundColor: isValid && !isSubmitting ? '#408059' : '#E5E7EB',
              }}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons
                    name={isEditMode ? 'checkmark' : 'add'}
                    size={18}
                    color={isValid ? '#FFFFFF' : '#9CA3AF'}
                  />
                  <Text
                    className="ml-2 font-semibold"
                    style={{ color: isValid ? '#FFFFFF' : '#9CA3AF' }}
                  >
                    {isEditMode ? 'Save Changes' : 'Add Worker'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
