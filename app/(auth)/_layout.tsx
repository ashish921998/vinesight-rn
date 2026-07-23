import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useM3, useIsDark } from '@/styles/use-theme';

export default function AuthLayout() {
  const m3 = useM3();
  const isDark = useIsDark();

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView
        style={{ flex: 1, backgroundColor: m3.colorScheme.background }}
        edges={['top', 'bottom', 'left', 'right']}
      >
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: m3.colorScheme.background },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="login" />
          <Stack.Screen name="forgot-password" />
          <Stack.Screen name="reset-password" options={{ gestureEnabled: false }} />
          <Stack.Screen name="otp-verification" />
          <Stack.Screen name="phone-login" />
          <Stack.Screen name="profile-completion" />
        </Stack>
      </SafeAreaView>
    </>
  );
}
