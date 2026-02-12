import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useM3 } from '@/styles/use-theme';

export default function AuthLayout() {
  const m3 = useM3();
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
        <Stack.Screen name="phone-login" />
        <Stack.Screen name="profile-completion" />
      </Stack>
    </>
  );
}
