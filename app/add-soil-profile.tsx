import { useLocalSearchParams, useRouter } from 'expo-router';
import { View, Text, Pressable } from 'react-native';

import SoilProfileForm from '@/components/screens/soil-profile-form';
import { colors, spacing, fontSize, fontWeight } from '@/styles/theme';

export default function AddSoilProfileRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ farmId?: string }>();
  const farmId = params.farmId ? parseInt(params.farmId, 10) : NaN;

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
          Unable to open soil profile form
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
          onPress={() => router.back()}
          style={{
            marginTop: spacing[4],
            paddingHorizontal: spacing[6],
            paddingVertical: spacing[3],
            backgroundColor: colors.primary[500],
            borderRadius: spacing[3],
          }}
        >
          <Text style={{ color: colors.white, fontWeight: fontWeight.semibold }}>Go Back</Text>
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
