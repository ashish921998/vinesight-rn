import type { ReactNode } from 'react';
import type { SafeAreaViewProps } from 'react-native-safe-area-context';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/styles/theme';

type SafeScreenProps = SafeAreaViewProps & {
  backgroundColor?: string;
  children: ReactNode;
};

export function SafeScreen({
  backgroundColor = colors.gray[50],
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
