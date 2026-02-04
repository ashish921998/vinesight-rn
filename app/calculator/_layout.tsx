import { Stack } from 'expo-router';
import { useM3 } from '@/styles/use-theme';

export default function CalculatorLayout() {
  const m3 = useM3();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: m3.colorScheme.surface },
        headerTintColor: m3.colorScheme.onSurface,
      }}
    />
  );
}
