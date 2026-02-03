import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { m3 } from '@/styles/theme';

export default function AuthLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: m3.colorScheme.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="login" />
        <Stack.Screen name="otp-verification" />
      </Stack>
    </>
  );
}
