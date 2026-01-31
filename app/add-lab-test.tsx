import { useLocalSearchParams, useRouter } from 'expo-router';
import { View, Text, Pressable } from 'react-native';

import LabTestForm from '@/components/screens/lab-test-form';
import { colors, spacing, fontSize, fontWeight } from '@/styles/theme';

export default function AddLabTestRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ farmId?: string; testType?: 'soil' | 'petiole' }>();

  const farmId = params.farmId ? parseInt(params.farmId, 10) : NaN;
  const testType = params.testType === 'petiole' ? 'petiole' : 'soil';

  if (!Number.isFinite(farmId)) {
    const farmIdLabel = params.farmId ?? 'missing';
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing[6],
          backgroundColor: colors.surface[50],
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
          Unable to open lab test form
        </Text>
        <Text
          style={{
            fontSize: fontSize.base,
            color: colors.surface[600],
            textAlign: 'center',
            marginTop: spacing[2],
          }}
        >
          Invalid farmId: {farmIdLabel}
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
          <Text style={{ color: colors.white, fontWeight: fontWeight.semibold }}>
            Back to Lab Tests
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
