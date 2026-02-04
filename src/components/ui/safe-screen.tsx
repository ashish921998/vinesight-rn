import type { ComponentProps, ReactNode } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColors } from '@/styles/use-theme';

interface SafeScreenProps extends ComponentProps<typeof SafeAreaView> {
  backgroundColor?: string;
  children: ReactNode;
}

export function SafeScreen({
  backgroundColor,
  style,
  edges = ['top', 'left', 'right'],
  children,
  ...props
}: SafeScreenProps) {
  const colors = useThemeColors();
  const resolvedBackground = backgroundColor ?? colors.gray[50];
  return (
    <SafeAreaView
      style={[{ flex: 1, backgroundColor: resolvedBackground }, style]}
      edges={edges}
      {...props}
    >
      {children}
    </SafeAreaView>
  );
}
