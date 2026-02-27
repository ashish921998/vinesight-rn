import React, { useCallback, useEffect, useRef } from 'react';
import { View, type LayoutChangeEvent, type ViewProps } from 'react-native';

export interface GuidedTourTargetRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

type MeasureFn = () => Promise<GuidedTourTargetRect | null>;

const registry = new Map<string, MeasureFn>();

export async function measureGuidedTourTarget(
  targetId: string,
): Promise<GuidedTourTargetRect | null> {
  const fn = registry.get(targetId);
  if (!fn) return null;
  return fn();
}

function registerGuidedTourTarget(targetId: string, measure: MeasureFn) {
  registry.set(targetId, measure);
  return () => {
    if (registry.get(targetId) === measure) {
      registry.delete(targetId);
    }
  };
}

interface GuidedTourTargetProps extends ViewProps {
  targetId: string;
  children: React.ReactNode;
}

export function GuidedTourTarget({
  targetId,
  children,
  onLayout,
  ...props
}: GuidedTourTargetProps) {
  const ref = useRef<View | null>(null);
  const unregisterRef = useRef<null | (() => void)>(null);

  const measure = useCallback(async (): Promise<GuidedTourTargetRect | null> => {
    const node = ref.current;
    if (!node) return null;
    return new Promise((resolve) => {
      try {
        node.measureInWindow((x, y, width, height) => {
          if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
            resolve(null);
            return;
          }
          resolve({ x, y, width, height });
        });
      } catch {
        resolve(null);
      }
    });
  }, []);

  useEffect(() => {
    unregisterRef.current?.();
    unregisterRef.current = registerGuidedTourTarget(targetId, measure);
    return () => {
      unregisterRef.current?.();
      unregisterRef.current = null;
    };
  }, [measure, targetId]);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      onLayout?.(event);
      unregisterRef.current?.();
      unregisterRef.current = registerGuidedTourTarget(targetId, measure);
    },
    [measure, onLayout, targetId],
  );

  return (
    <View ref={ref} onLayout={handleLayout} collapsable={false} {...props}>
      {children}
    </View>
  );
}
