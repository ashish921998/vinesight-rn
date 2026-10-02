/**
 * Edit Activity screen — fertigation-only full-screen editor.
 *
 * Irrigation / spray / harvest / expense edit on QuickLogSheet. Fertigation
 * stays here because QuickLogSheet does not cover standalone fertigation.
 */

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  type TextInputProps,
  Keyboard,
  UIManager,
  findNodeHandle,
} from 'react-native';
import { Spinner } from '@/components/ui/spinner';
import { DateField, FormModal, SectionHeader } from '@/components/ui';
import { toast } from '@/components/ui/toast';
import { spacing } from '@/styles/theme';
import { useTranslation } from 'react-i18next';
import { useM3 } from '@/styles/use-theme';
import { triggerHapticSuccess } from '@/utils/haptics';
import {
  FertigationForm,
  validateFertigationForm,
  createEmptyFertigationFormData,
  type FertigationFormData,
} from '@/components/forms';
import { useUpdateFertigationRecord, useFarmAreaAcres, useResponsiveHeight } from '@/hooks';
import { toSupabaseDateString, fromSupabaseDateString } from '@/types';
import type { Farm, FertigationRecord } from '@/types';
import { fertigationRecordToFormData } from '@/utils/record-to-form';
import { buildFertigationUpdate } from '@/utils/form-to-update';

interface ActivityEditFormProps {
  visible?: boolean;
  onClose: () => void;
  farm: Farm;
  record: FertigationRecord;
  onSaveSuccess?: () => void;
  presentation?: 'modal' | 'screen';
}

export function ActivityEditForm({
  visible,
  onClose,
  farm,
  record,
  onSaveSuccess,
  presentation = 'modal',
}: ActivityEditFormProps) {
  const { t } = useTranslation();
  const m3 = useM3();
  const { farmAreaAcres } = useFarmAreaAcres(farm.area);
  const isVisible = visible ?? true;
  const { windowHeight } = useResponsiveHeight();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const savingRef = useRef(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [initializedRecordId, setInitializedRecordId] = useState<number | undefined>(undefined);
  const scrollViewRef = useRef<ScrollView>(null);
  const focusedInputRef = useRef<number | null>(null);
  const scrollOffsetRef = useRef(0);
  const keyboardHeightRef = useRef(0);

  const [fertigationData, setFertigationData] = useState<FertigationFormData>(
    createEmptyFertigationFormData(),
  );

  const updateFertigation = useUpdateFertigationRecord();

  const isFormValid = useMemo(() => validateFertigationForm(fertigationData), [fertigationData]);

  const scrollToNode = useCallback(
    (nodeHandle: number) => {
      if (!keyboardHeightRef.current) return;
      const resolvedHandle = findNodeHandle(nodeHandle) ?? nodeHandle;
      if (typeof resolvedHandle !== 'number') return;
      UIManager.measureInWindow(resolvedHandle, (_x, y, _width, height) => {
        const keyboardTop = windowHeight - keyboardHeightRef.current;
        const inputBottom = y + height;
        const buffer = 24;
        if (inputBottom > keyboardTop - buffer) {
          const scrollBy = inputBottom - (keyboardTop - buffer);
          scrollViewRef.current?.scrollTo({
            y: Math.max(0, scrollOffsetRef.current + scrollBy),
            animated: true,
          });
        }
      });
    },
    [windowHeight],
  );

  useEffect(() => {
    const keyboardShowListener = Keyboard.addListener('keyboardDidShow', (event) => {
      keyboardHeightRef.current = event.endCoordinates.height;
      const focusedNode = focusedInputRef.current;
      if (focusedNode != null) {
        requestAnimationFrame(() => scrollToNode(focusedNode));
      }
    });
    return () => {
      keyboardShowListener.remove();
    };
  }, [scrollToNode]);

  type OnFocusEvent = Parameters<NonNullable<TextInputProps['onFocus']>>[0];

  const scrollToFocusedInput = useCallback(
    (event: OnFocusEvent) => {
      const target = (event as { target?: unknown }).target ?? null;
      const nodeHandle = findNodeHandle(target as unknown as number | React.Component | null);
      if (typeof nodeHandle !== 'number') return;
      focusedInputRef.current = nodeHandle;
      requestAnimationFrame(() => scrollToNode(nodeHandle));
    },
    [scrollToNode],
  );

  useEffect(() => {
    if (isVisible && (!isInitialized || initializedRecordId !== record.id)) {
      const parsedDate = fromSupabaseDateString(record.date);
      if (parsedDate) setSelectedDate(parsedDate);
      setFertigationData(fertigationRecordToFormData(record));
      setInitializedRecordId(record.id);
      setIsInitialized(true);
    }
  }, [isVisible, isInitialized, initializedRecordId, record]);

  const handleSave = async () => {
    if (!isFormValid || savingRef.current) return;

    savingRef.current = true;
    setIsSubmitting(true);
    const dateStr = toSupabaseDateString(selectedDate);

    try {
      if (record.id == null) {
        throw new Error('Record ID is missing');
      }
      await updateFertigation.mutateAsync({
        id: record.id,
        updates: buildFertigationUpdate(fertigationData, dateStr, farmAreaAcres),
      });

      triggerHapticSuccess();
      toast.success(t('entryForm.logSaved'));
      onSaveSuccess?.();
      setIsInitialized(false);
      onClose();
    } catch (error) {
      console.error('Error updating log:', error);
      toast.error(t('common.errors.failedToUpdateLog'));
    } finally {
      savingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsInitialized(false);
    setInitializedRecordId(undefined);
    onClose();
  };

  return (
    <FormModal
      visible={isVisible}
      onClose={handleClose}
      title={t('activityEdit.title')}
      onSave={handleSave}
      saveLabel={t('common.saveChanges')}
      isLoading={isSubmitting}
      isSaveDisabled={!isFormValid}
      presentation={presentation}
      scrollViewRef={scrollViewRef}
      scrollViewProps={{
        keyboardShouldPersistTaps: 'handled',
        onScroll: (event) => {
          scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
        },
        scrollEventThrottle: 16,
      }}
    >
      <SectionHeader
        title={t('activityEdit.detailsTitle')}
        subtitle={farm.name}
        style={{ marginBottom: spacing[4] }}
      />

      <DateField
        value={selectedDate}
        onChange={setSelectedDate}
        label={t('activityEdit.dateLabel')}
        style={{ marginBottom: spacing[6] }}
      />

      {!isInitialized ? (
        <View
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: spacing[10],
          }}
        >
          <Spinner size="large" color={m3.primary.p500} />
          <Text selectable style={{ marginTop: spacing[4], color: m3.surface.s500 }}>
            {t('common.loading')}
          </Text>
        </View>
      ) : (
        <View style={{ marginTop: spacing[4] }}>
          <FertigationForm
            data={fertigationData}
            onChange={setFertigationData}
            onInputFocus={scrollToFocusedInput}
            areaAcres={farmAreaAcres}
          />
        </View>
      )}
    </FormModal>
  );
}
