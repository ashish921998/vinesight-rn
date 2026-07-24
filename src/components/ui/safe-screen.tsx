import type { ComponentProps, ReactNode } from 'react';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useM3 } from '@/styles/use-theme';

interface SafeScreenProps extends ComponentProps<typeof SafeAreaView> {
  backgroundColor?: string;
  children: ReactNode;
}

const DEFAULT_EDGES: Edge[] = ['top', 'left', 'right'];

export function SafeScreen({
  backgroundColor,
  style,
  edges = DEFAULT_EDGES,
  children,
  ...props
}: SafeScreenProps) {
  const m3 = useM3();
  const resolvedBackground = backgroundColor ?? m3.neutral.n50;
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
