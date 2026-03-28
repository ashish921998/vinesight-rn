import { useCallback, useEffect, useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { EntryForm } from '@/components/screens/entry-form';
import { useModalStore } from '@/stores';
import type { LogTypeId } from '@/constants/calculator-models';
import type { VoiceLogFormPrefill } from '@/types/voice-log';
import {
  markOnboardingFirstActionCompleted,
  parseOnboardingFlag,
} from '@/features/onboarding/activation';

const parseTabs = (value?: string | string[]) => {
  if (!value) return undefined;
  const raw = Array.isArray(value) ? value.join(',') : value;
  const parts = raw.split(',').map((part) => part.trim());
  const valid = parts.filter((part) => part === 'log' || part === 'task') as Array<'log' | 'task'>;
  return valid.length ? valid : undefined;
};

const parseDuration = (value?: string | string[]) => {
  if (!value) return null;
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
};

const parseLogDate = (value?: string | string[]) => {
  if (!value) return null;
  const raw = Array.isArray(value) ? value[0] : value;
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
};

const parseEntrySource = (value?: string | string[]) => {
  if (!value) return null;
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === 'voice_ai' ? 'voice_ai' : raw === 'manual' ? 'manual' : null;
};

const parseBooleanParam = (value?: string | string[]) => {
  if (value == null) return false;
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === 'true';
};

export default function AddEntryRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    farmId?: string;
    allFarms?: string;
    initialTab?: 'log' | 'task';
    tabs?: string;
    initialLogType?: LogTypeId;
    initialIrrigationDurationHours?: string;
    irrigationDurationHours?: string;
    initialLogDate?: string;
    entrySource?: string;
    onboarding?: string;
    onboardingActionType?: string;
  }>();
  const { addEntry, setAddEntry } = useModalStore();

  const initialFarmId = useMemo(() => {
    if (!params.farmId) return undefined;
    if (params.farmId === 'all') return undefined;
    const parsed = parseInt(params.farmId, 10);
    return Number.isNaN(parsed) ? undefined : parsed;
  }, [params.farmId]);

  const initialApplyToAllFarms = useMemo(() => {
    if (params.farmId === 'all') return true;
    if (parseBooleanParam(params.allFarms)) return true;
    return addEntry?.initialApplyToAllFarms ?? false;
  }, [params.allFarms, params.farmId, addEntry?.initialApplyToAllFarms]);

  const tabs = useMemo(
    () => parseTabs(params.tabs) ?? addEntry?.tabs,
    [params.tabs, addEntry?.tabs],
  );
  const initialTab = params.initialTab ?? addEntry?.initialTab;
  const initialLogType = params.initialLogType ?? addEntry?.initialLogType;
  const initialIrrigationDurationHours = useMemo(
    () =>
      parseDuration(params.initialIrrigationDurationHours) ??
      parseDuration(params.irrigationDurationHours) ??
      addEntry?.initialIrrigationDurationHours ??
      null,
    [
      params.initialIrrigationDurationHours,
      params.irrigationDurationHours,
      addEntry?.initialIrrigationDurationHours,
    ],
  );
  const initialLogDate = useMemo(
    () => parseLogDate(params.initialLogDate) ?? addEntry?.initialLogDate ?? null,
    [params.initialLogDate, addEntry?.initialLogDate],
  );
  const entrySource = useMemo(
    () => parseEntrySource(params.entrySource) ?? addEntry?.entrySource ?? null,
    [params.entrySource, addEntry?.entrySource],
  );
  const isOnboardingActionFlow = useMemo(
    () => parseOnboardingFlag(params.onboarding),
    [params.onboarding],
  );
  const voiceLogPrefill = useMemo<VoiceLogFormPrefill | null>(
    () => addEntry?.voiceLogPrefill ?? null,
    [addEntry?.voiceLogPrefill],
  );
  const resolvedFarmIdForOnboarding = useMemo(
    () => initialFarmId ?? addEntry?.initialFarmId ?? null,
    [addEntry?.initialFarmId, initialFarmId],
  );

  const handleOnboardingActionCompleted = useCallback(
    (actionType: 'log' | 'task') => {
      if (!isOnboardingActionFlow) return;
      markOnboardingFirstActionCompleted({
        actionType,
        farmId: resolvedFarmIdForOnboarding,
      });
    },
    [isOnboardingActionFlow, resolvedFarmIdForOnboarding],
  );

  useEffect(() => {
    return () => setAddEntry(null);
  }, [setAddEntry]);

  return (
    <>
      <EntryForm
        onClose={() => router.back()}
        presentation="screen"
        tabs={tabs}
        initialTab={initialTab}
        initialFarmId={initialFarmId ?? addEntry?.initialFarmId ?? null}
        initialApplyToAllFarms={initialApplyToAllFarms}
        initialLogType={initialLogType ?? null}
        initialIrrigationDurationHours={initialIrrigationDurationHours}
        initialLogDate={initialLogDate}
        initialVoiceLogPrefill={voiceLogPrefill}
        entrySource={entrySource}
        editingTask={addEntry?.editingTask ?? null}
        sourceTaskId={addEntry?.sourceTaskId ?? null}
        initialLogPrefill={addEntry?.logPrefill ?? null}
        onLogSaveSuccess={() => handleOnboardingActionCompleted('log')}
        onTaskSaveSuccess={() => handleOnboardingActionCompleted('task')}
      />
    </>
  );
}
