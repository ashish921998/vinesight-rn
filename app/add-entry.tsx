import { useEffect, useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { EntryForm } from '@/components/screens/entry-form';
import { useModalStore } from '@/stores';
import type { LogTypeId } from '@/constants/calculator-models';

const parseTabs = (value?: string | string[]) => {
  if (!value) return undefined;
  const raw = Array.isArray(value) ? value.join(',') : value;
  const parts = raw.split(',').map((part) => part.trim());
  const valid = parts.filter((part) => part === 'log' || part === 'task') as Array<'log' | 'task'>;
  return valid.length ? valid : undefined;
};

export default function AddEntryRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    farmId?: string;
    initialTab?: 'log' | 'task';
    tabs?: string;
    initialLogType?: LogTypeId;
  }>();
  const { addEntry, setAddEntry } = useModalStore();

  const initialFarmId = useMemo(() => {
    if (!params.farmId) return undefined;
    const parsed = parseInt(params.farmId, 10);
    return Number.isNaN(parsed) ? undefined : parsed;
  }, [params.farmId]);

  const tabs = useMemo(
    () => parseTabs(params.tabs) ?? addEntry?.tabs,
    [params.tabs, addEntry?.tabs],
  );
  const initialTab = params.initialTab ?? addEntry?.initialTab;
  const initialLogType = params.initialLogType ?? addEntry?.initialLogType;

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
        initialLogType={initialLogType ?? null}
        editingTask={addEntry?.editingTask ?? null}
      />
    </>
  );
}
