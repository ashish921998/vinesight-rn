import { useLocalSearchParams, useRouter } from 'expo-router';
import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';

import LabTestForm from '@/components/screens/lab-test-form';
import { colors, spacing, fontSize, fontWeight } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';

export default function AddLabTestRoute() {
  const router = useRouter();
  const { t } = useTranslation();
  const m3 = useM3();
  const params = useLocalSearchParams<{ farmId?: string; testType?: 'soil' | 'petiole' }>();

  const farmId = params.farmId ? parseInt(params.farmId, 10) : NaN;
  const testType = params.testType === 'petiole' ? 'petiole' : 'soil';

  if (!Number.isFinite(farmId)) {
    const farmIdLabel = params.farmId ?? t('common.missing');
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
          textBreakStrategy="highQuality"
          lineBreakStrategyIOS="standard"
        >
          {t('labTests.errors.unableToOpenFormTitle')}
        </Text>
        <Text
          style={{
            fontSize: fontSize.base,
            color: colors.surface[600],
            textAlign: 'center',
            marginTop: spacing[2],
          }}
          textBreakStrategy="highQuality"
          lineBreakStrategyIOS="standard"
        >
          {t('labTests.errors.invalidFarmId', { farmId: farmIdLabel })}
        </Text>
        <Pressable
          onPress={() => router.push('/lab-tests')}
          style={{
            marginTop: spacing[4],
            paddingHorizontal: spacing[6],
            paddingVertical: spacing[3],
            backgroundColor: colors.primary[500],
            borderRadius: spacing[3],
          }}
        >
          <Text
            style={{ color: colors.white, fontWeight: fontWeight.semibold }}
            textBreakStrategy="highQuality"
            lineBreakStrategyIOS="standard"
          >
            {t('labTests.actions.backToList')}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <>
      <LabTestForm
        onClose={() => router.back()}
        presentation="screen"
        farmId={farmId}
        testType={testType}
      />
    </>
  );
}
