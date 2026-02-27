import React, { useCallback, useEffect, useRef } from 'react';
import { View, type LayoutChangeEvent, type ViewProps } from 'react-native';

export interface GuidedTourTargetRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

type MeasureFn = () => Promise<GuidedTourTargetRect | null>;

const registry = new Map<string, MeasureFn[]>();

export async function measureGuidedTourTarget(
  targetId: string,
): Promise<GuidedTourTargetRect | null> {
  const fns = registry.get(targetId);
  if (!fns || fns.length === 0) return null;
  const mostRecentFn = fns[fns.length - 1];
  return mostRecentFn();
}

function registerGuidedTourTarget(targetId: string, measure: MeasureFn) {
  const fns = registry.get(targetId) ?? [];
  fns.push(measure);
  registry.set(targetId, fns);
  return () => {
    const currentFns = registry.get(targetId);
    if (currentFns) {
      const index = currentFns.indexOf(measure);
      if (index !== -1) {
        currentFns.splice(index, 1);
        if (currentFns.length === 0) {
          registry.delete(targetId);
        }
      }
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
