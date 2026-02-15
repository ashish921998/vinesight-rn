import { useLocalSearchParams, useRouter } from 'expo-router';
import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';

import SoilProfileForm from '@/components/screens/soil-profile-form';
import { spacing, fontSize, fontWeight } from '@/styles/theme';
import { useM3, useThemeColors } from '@/styles/use-theme';

export default function AddSoilProfileRoute() {
  const router = useRouter();
  const { t } = useTranslation();
  const m3 = useM3();
  const colors = useThemeColors();
  const params = useLocalSearchParams<{ farmId?: string }>();
  const farmId = params.farmId ? parseInt(params.farmId, 10) : NaN;

  if (!Number.isFinite(farmId)) {
    const farmIdLabel = params.farmId ?? t('common.na');
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing[6],
          backgroundColor: m3.colorScheme.background,
        }}
      >
        <Text
          style={{
            fontSize: fontSize.lg,
            fontWeight: fontWeight.semibold,
            color: colors.surface[900],
            textAlign: 'center',
          }}
        >
          {t('soilProfiling.errors.unableToOpenFormTitle')}
        </Text>
        <Text
          style={{
            fontSize: fontSize.base,
            color: colors.surface[600],
            textAlign: 'center',
            marginTop: spacing[2],
          }}
        >
          {t('soilProfiling.errors.invalidFarmId', { farmId: farmIdLabel })}
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={{
            marginTop: spacing[4],
            paddingHorizontal: spacing[6],
            paddingVertical: spacing[3],
            backgroundColor: colors.primary[500],
            borderRadius: spacing[3],
          }}
        >
          <Text style={{ color: colors.white, fontWeight: fontWeight.semibold }}>
            {t('common.back')}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <>
      <SoilProfileForm onClose={() => router.back()} presentation="screen" farmId={farmId} />
    </>
  );
}
