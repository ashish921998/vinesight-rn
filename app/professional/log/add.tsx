import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  createDelegatedLog,
  isValidDelegatedLogInput,
  type DelegatedLogType,
} from '@/services/delegated-logs';
import { useProfessionalWorkspace } from '@/hooks/use-professional-workspace';
import { useChemicalCatalog } from '@/hooks/use-chemical-catalog';
import { computePhiForMix } from '@/services/phi-service';
import { queryKeys } from '@/hooks/query-keys';
import { formatLocalDate } from '@/utils/date';
import { useM3 } from '@/styles/use-theme';
import { spacing, fontSize, fontWeight, borderRadius } from '@/styles/theme';

const TYPES: DelegatedLogType[] = ['irrigation', 'spray', 'fertigation', 'harvest', 'note'];

export default function AddDelegatedLog() {
  const { farmId, userId } = useLocalSearchParams<{ farmId: string; userId: string }>();
  const router = useRouter();
  const m3 = useM3();
  const qc = useQueryClient();
  const { t } = useTranslation();
  const [type, setType] = useState<DelegatedLogType>('irrigation');
  const [date, setDate] = useState(formatLocalDate(new Date()));
  const [primary, setPrimary] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const workspaceQuery = useProfessionalWorkspace();
  const { data: workspace } = workspaceQuery;
  const farmer = workspace?.clients.find((c) => c.user_id === userId);
  const farm = farmer?.farms.find((f) => f.id === Number(farmId));
  const catalog = useChemicalCatalog(type === 'spray');
  const [catalogMixId, setCatalogMixId] = useState<number | null>(null);
  const selectedMix = catalog.data?.find((mix) => mix.id === catalogMixId) ?? null;
  const primaryLabel = t(
    `professional.fields.${type === 'spray' ? 'chemical' : type === 'irrigation' ? 'duration' : type === 'fertigation' ? 'fertilizer' : type === 'harvest' ? 'quantity' : 'note'}`,
  );
  const valid = useMemo(() => {
    return isValidDelegatedLogInput(type, date, primary, selectedMix !== null);
  }, [date, primary, selectedMix, type]);
  if (workspaceQuery.isLoading) return <ActivityIndicator style={{ flex: 1 }} />;
  if (!workspace || !farmer || !farm)
    return (
      <View style={{ flex: 1, padding: spacing[4] }}>
        <Text>{t('professional.unavailableFarm')}</Text>
      </View>
    );
  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      if (type !== 'note' && farm.area <= 0) throw new Error(t('professional.errors.invalidArea'));
      const numericPrimary = Number(primary.trim());
      const phi = selectedMix ? computePhiForMix(selectedMix, date) : null;
      const payload: Record<string, unknown> =
        type === 'irrigation'
          ? { duration: numericPrimary, notes: notes.trim() }
          : type === 'spray' && selectedMix
            ? {
                catalog_mix_id: selectedMix.id,
                chemical: selectedMix.name,
                area: farm.area,
                dose: '',
                weather: '',
                operator: '',
                governing_phi_days: phi?.governingPhiDays ?? null,
                safe_harvest_date: phi?.safeHarvestDate ?? null,
                phi_blocking_component: phi?.blockingComponentName ?? null,
                phi_status: phi?.phiStatus ?? 'unknown',
                notes: notes.trim(),
              }
            : type === 'fertigation'
              ? {
                  fertilizers: [{ name: primary.trim(), unit: 'kg/acre', quantity: 1 }],
                  area: farm.area,
                  notes: notes.trim(),
                }
              : type === 'harvest'
                ? { quantity: numericPrimary, grade: '', notes: notes.trim() }
                : { notes: primary.trim() };
      await createDelegatedLog({
        organizationId: workspace.organization_id,
        clientUserId: farmer.user_id,
        farmId: farm.id,
        recordType: type,
        date,
        payload,
      });
      // Fire the refetches in the background — don't block navigation on them.
      // The activity list updates on its own once these resolve.
      void qc.invalidateQueries({ queryKey: queryKeys.professionalWorkspace.all });
      void qc.invalidateQueries({
        queryKey: queryKeys.professionalWorkspace.farmActivity(farm.id),
      });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('professional.errors.save'));
    } finally {
      setSaving(false);
    }
  };
  return (
    <ScrollView
      contentContainerStyle={{
        padding: spacing[4],
        backgroundColor: m3.colorScheme.background,
        flexGrow: 1,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: t('professional.addDelegatedLog') }} />
      <View
        style={{
          padding: spacing[4],
          borderRadius: borderRadius.xl,
          backgroundColor: m3.surface.surfaceContainer,
          marginBottom: spacing[5],
        }}
      >
        <Text style={{ fontWeight: fontWeight.bold, color: m3.colorScheme.onSurface }}>
          {farmer.full_name}
        </Text>
        <Text style={{ color: m3.colorScheme.onSurfaceVariant }}>
          {farm.name} · {workspace.organization_name}
        </Text>
      </View>
      <Text
        style={{
          fontSize: fontSize.sm,
          fontWeight: fontWeight.semibold,
          color: m3.colorScheme.onSurface,
          marginBottom: spacing[2],
        }}
      >
        {t('professional.logType')}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing[2],
          marginBottom: spacing[4],
        }}
      >
        {TYPES.map((item) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: type === item }}
            accessibilityLabel={t(`professional.types.${item}`)}
            key={item}
            onPress={() => {
              setType(item);
              setPrimary('');
              setCatalogMixId(null);
            }}
            style={{
              paddingHorizontal: spacing[3],
              paddingVertical: spacing[2],
              borderRadius: borderRadius.full,
              backgroundColor: type === item ? m3.colorScheme.primary : m3.surface.surfaceContainer,
            }}
          >
            <Text
              style={{ color: type === item ? m3.colorScheme.onPrimary : m3.colorScheme.onSurface }}
            >
              {t(`professional.types.${item}`)}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={{ color: m3.colorScheme.onSurface, marginBottom: spacing[1] }}>
        {t('professional.date')}
      </Text>
      <TextInput
        accessibilityLabel={t('professional.date')}
        value={date}
        onChangeText={setDate}
        placeholder="YYYY-MM-DD"
        style={{
          padding: spacing[4],
          borderRadius: borderRadius.xl,
          backgroundColor: m3.surface.surfaceContainer,
          color: m3.colorScheme.onSurface,
          marginBottom: spacing[4],
        }}
      />
      <Text style={{ color: m3.colorScheme.onSurface, marginBottom: spacing[1] }}>
        {primaryLabel}
      </Text>
      {type === 'spray' ? (
        <View style={{ gap: spacing[2], marginBottom: spacing[4] }}>
          {catalog.isLoading ? (
            <ActivityIndicator />
          ) : (
            catalog.data?.map((mix) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: catalogMixId === mix.id }}
                key={mix.id}
                onPress={() => setCatalogMixId(mix.id)}
                style={{
                  padding: spacing[3],
                  borderRadius: borderRadius.xl,
                  backgroundColor:
                    catalogMixId === mix.id ? m3.colorScheme.primary : m3.surface.surfaceContainer,
                }}
              >
                <Text
                  style={{
                    color:
                      catalogMixId === mix.id ? m3.colorScheme.onPrimary : m3.colorScheme.onSurface,
                  }}
                >
                  {mix.name}
                </Text>
              </Pressable>
            ))
          )}
        </View>
      ) : (
        <TextInput
          accessibilityLabel={primaryLabel}
          value={primary}
          onChangeText={setPrimary}
          keyboardType={type === 'irrigation' || type === 'harvest' ? 'decimal-pad' : 'default'}
          multiline={type === 'note'}
          style={{
            minHeight: type === 'note' ? 120 : undefined,
            padding: spacing[4],
            borderRadius: borderRadius.xl,
            backgroundColor: m3.surface.surfaceContainer,
            color: m3.colorScheme.onSurface,
            marginBottom: spacing[4],
          }}
        />
      )}
      {type !== 'note' && (
        <>
          <Text style={{ color: m3.colorScheme.onSurface, marginBottom: spacing[1] }}>
            {t('professional.notesOptional')}
          </Text>
          <TextInput
            accessibilityLabel={t('professional.notesOptional')}
            value={notes}
            onChangeText={setNotes}
            multiline
            style={{
              minHeight: 90,
              padding: spacing[4],
              borderRadius: borderRadius.xl,
              backgroundColor: m3.surface.surfaceContainer,
              color: m3.colorScheme.onSurface,
            }}
          />
        </>
      )}
      {error && <Text style={{ color: m3.colorScheme.error, marginTop: spacing[3] }}>{error}</Text>}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('professional.saveLog')}
        disabled={!valid || saving}
        onPress={save}
        style={{
          marginTop: spacing[5],
          padding: spacing[4],
          alignItems: 'center',
          borderRadius: borderRadius.xl,
          backgroundColor: valid ? m3.colorScheme.primary : m3.surface.surfaceContainer,
        }}
      >
        {saving ? (
          <ActivityIndicator color={m3.colorScheme.onPrimary} />
        ) : (
          <Text
            style={{
              color: valid ? m3.colorScheme.onPrimary : m3.colorScheme.onSurfaceVariant,
              fontWeight: fontWeight.bold,
            }}
          >
            {t('professional.saveLog')}
          </Text>
        )}
      </Pressable>
      <Text
        style={{
          marginTop: spacing[3],
          color: m3.colorScheme.onSurfaceVariant,
          fontSize: fontSize.xs,
        }}
      >
        {t('professional.onlineOnly')}
      </Text>
    </ScrollView>
  );
}
