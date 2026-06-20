import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { createDelegatedLog, type DelegatedLogType } from '@/services/delegated-logs';
import { useProfessionalWorkspace } from '@/hooks/use-professional-workspace';
import { queryKeys } from '@/hooks/query-keys';
import { formatLocalDate } from '@/utils/date';
import { useM3 } from '@/styles/use-theme';
import { spacing, fontSize, fontWeight, borderRadius } from '@/styles/theme';

const TYPES: { id: DelegatedLogType; label: string }[] = [
  { id: 'irrigation', label: 'Irrigation' }, { id: 'spray', label: 'Spray' },
  { id: 'fertigation', label: 'Fertigation' }, { id: 'harvest', label: 'Harvest' },
  { id: 'note', label: 'Daily note' },
];

export default function AddDelegatedLog() {
  const { farmId, userId } = useLocalSearchParams<{ farmId: string; userId: string }>(); const router = useRouter(); const m3 = useM3(); const qc = useQueryClient();
  const { data: workspace } = useProfessionalWorkspace(); const farmer = workspace?.clients.find((c) => c.user_id === userId); const farm = farmer?.farms.find((f) => f.id === Number(farmId));
  const [type, setType] = useState<DelegatedLogType>('irrigation'); const [date, setDate] = useState(formatLocalDate(new Date())); const [primary, setPrimary] = useState(''); const [notes, setNotes] = useState(''); const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null);
  const primaryLabel = type === 'irrigation' ? 'Duration (hours)' : type === 'spray' ? 'Chemical' : type === 'fertigation' ? 'Fertilizer' : type === 'harvest' ? 'Quantity (kg)' : 'Note';
  const valid = useMemo(() => primary.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(date), [primary, date]);
  if (!workspace || !farmer || !farm) return <View style={{ flex: 1, padding: spacing[4] }}><Text>Farm access is no longer available.</Text></View>;
  const save = async () => { setSaving(true); setError(null); try {
    const payload: Record<string, unknown> = type === 'irrigation' ? { duration: Number(primary), notes } : type === 'spray' ? { chemical: primary, area: farm.area, dose: '', weather: '', operator: '', notes } : type === 'fertigation' ? { fertilizers: [{ name: primary, unit: 'kg/acre', quantity: 1 }], area: farm.area, notes } : type === 'harvest' ? { quantity: Number(primary), grade: '', notes } : { notes: primary };
    await createDelegatedLog({ organizationId: workspace.organization_id, clientUserId: farmer.user_id, farmId: farm.id, recordType: type, date, payload });
    await Promise.all([qc.invalidateQueries({ queryKey: queryKeys.professionalWorkspace.all }), qc.invalidateQueries({ queryKey: queryKeys.farms.detail(farm.id) })]); router.back();
  } catch (e) { setError(e instanceof Error ? e.message : 'Could not save this log. Check your connection and access.'); } finally { setSaving(false); } };
  return <ScrollView contentContainerStyle={{ padding: spacing[4], backgroundColor: m3.colorScheme.background, flexGrow: 1 }} keyboardShouldPersistTaps="handled"><Stack.Screen options={{ title: 'Add delegated log' }} />
    <View style={{ padding: spacing[4], borderRadius: borderRadius.xl, backgroundColor: m3.surface.surfaceContainer, marginBottom: spacing[5] }}><Text style={{ fontWeight: fontWeight.bold, color: m3.colorScheme.onSurface }}>{farmer.full_name}</Text><Text style={{ color: m3.colorScheme.onSurfaceVariant }}>{farm.name} · {workspace.organization_name}</Text></View>
    <Text style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: m3.colorScheme.onSurface, marginBottom: spacing[2] }}>Log type</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginBottom: spacing[4] }}>{TYPES.map((item) => <Pressable key={item.id} onPress={() => { setType(item.id); setPrimary(''); }} style={{ paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: borderRadius.full, backgroundColor: type === item.id ? m3.colorScheme.primary : m3.surface.surfaceContainer }}><Text style={{ color: type === item.id ? m3.colorScheme.onPrimary : m3.colorScheme.onSurface }}>{item.label}</Text></Pressable>)}</View>
    <Text style={{ color: m3.colorScheme.onSurface, marginBottom: spacing[1] }}>Date</Text><TextInput value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" style={{ padding: spacing[4], borderRadius: borderRadius.xl, backgroundColor: m3.surface.surfaceContainer, color: m3.colorScheme.onSurface, marginBottom: spacing[4] }} />
    <Text style={{ color: m3.colorScheme.onSurface, marginBottom: spacing[1] }}>{primaryLabel}</Text><TextInput value={primary} onChangeText={setPrimary} keyboardType={type === 'irrigation' || type === 'harvest' ? 'decimal-pad' : 'default'} multiline={type === 'note'} style={{ minHeight: type === 'note' ? 120 : undefined, padding: spacing[4], borderRadius: borderRadius.xl, backgroundColor: m3.surface.surfaceContainer, color: m3.colorScheme.onSurface, marginBottom: spacing[4] }} />
    {type !== 'note' && <><Text style={{ color: m3.colorScheme.onSurface, marginBottom: spacing[1] }}>Notes (optional)</Text><TextInput value={notes} onChangeText={setNotes} multiline style={{ minHeight: 90, padding: spacing[4], borderRadius: borderRadius.xl, backgroundColor: m3.surface.surfaceContainer, color: m3.colorScheme.onSurface }} /></>}
    {error && <Text style={{ color: m3.colorScheme.error, marginTop: spacing[3] }}>{error}</Text>}<Pressable disabled={!valid || saving} onPress={save} style={{ marginTop: spacing[5], padding: spacing[4], alignItems: 'center', borderRadius: borderRadius.xl, backgroundColor: valid ? m3.colorScheme.primary : m3.surface.surfaceContainer }}>{saving ? <ActivityIndicator color={m3.colorScheme.onPrimary} /> : <Text style={{ color: valid ? m3.colorScheme.onPrimary : m3.colorScheme.onSurfaceVariant, fontWeight: fontWeight.bold }}>Save log</Text>}</Pressable>
    <Text style={{ marginTop: spacing[3], color: m3.colorScheme.onSurfaceVariant, fontSize: fontSize.xs }}>Online only. Access is checked again when you save.</Text>
  </ScrollView>;
}
