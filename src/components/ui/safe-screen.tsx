import type { ComponentProps, ReactNode } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { m3 } from '@/styles/theme';

type SafeScreenProps = ComponentProps<typeof SafeAreaView> & {
  backgroundColor?: string;
  children: ReactNode;
};

export function SafeScreen({
  backgroundColor = m3.colorScheme.background,
  style,
  edges = ['top', 'left', 'right'],
  children,
  ...props
}: SafeScreenProps) {
  return (
    <SafeAreaView style={[{ flex: 1, backgroundColor }, style]} edges={edges} {...props}>
      {children}
    </SafeAreaView>
  );
}
