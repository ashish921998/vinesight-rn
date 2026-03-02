import React, { useCallback, useEffect, useRef } from 'react';
import { Dimensions, View, type LayoutChangeEvent, type ViewProps } from 'react-native';

export interface GuidedTourTargetRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

type MeasureFn = () => Promise<GuidedTourTargetRect | null>;
type TargetListener = () => void;

interface TargetEntry {
  measure: MeasureFn;
  lastLayoutAt: number;
  lastRect: GuidedTourTargetRect | null;
}

const registry = new Map<string, TargetEntry[]>();
const listeners = new Map<string, Set<TargetListener>>();

function isRectInViewport(rect: GuidedTourTargetRect): boolean {
  const { width: viewportWidth, height: viewportHeight } = Dimensions.get('window');
  return (
    rect.x < viewportWidth &&
    rect.y < viewportHeight &&
    rect.x + rect.width > 0 &&
    rect.y + rect.height > 0
  );
}

function notifyTargetChanged(targetId: string) {
  const targetListeners = listeners.get(targetId);
  if (!targetListeners) return;
  for (const listener of targetListeners) {
    listener();
  }
}

export function subscribeGuidedTourTarget(targetId: string, listener: TargetListener): () => void {
  const targetListeners = listeners.get(targetId) ?? new Set<TargetListener>();
  targetListeners.add(listener);
  listeners.set(targetId, targetListeners);
  return () => {
    const current = listeners.get(targetId);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) {
      listeners.delete(targetId);
    }
  };
}

export async function measureGuidedTourTarget(
  targetId: string,
): Promise<GuidedTourTargetRect | null> {
  const entries = registry.get(targetId);
  if (!entries || entries.length === 0) return null;

  let firstMeasuredRect: GuidedTourTargetRect | null = null;
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const entry = entries[i];
    const measured = await entry.measure();
    if (measured) {
      entry.lastRect = measured;
      entry.lastLayoutAt = Date.now();
      if (isRectInViewport(measured)) return measured;
      if (!firstMeasuredRect) firstMeasuredRect = measured;
    }
  }

  if (firstMeasuredRect) return firstMeasuredRect;

  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const cached = entries[i]?.lastRect;
    if (!cached) continue;
    if (isRectInViewport(cached)) return cached;
    if (!firstMeasuredRect) firstMeasuredRect = cached;
  }

  return firstMeasuredRect;
}

function registerGuidedTourTarget(targetId: string, measure: MeasureFn) {
  const entry: TargetEntry = {
    measure,
    lastLayoutAt: Date.now(),
    lastRect: null,
  };
  const entries = registry.get(targetId) ?? [];
  entries.push(entry);
  registry.set(targetId, entries);
  notifyTargetChanged(targetId);
  return () => {
    const currentEntries = registry.get(targetId);
    if (currentEntries) {
      const index = currentEntries.indexOf(entry);
      if (index !== -1) {
        currentEntries.splice(index, 1);
        if (currentEntries.length === 0) {
          registry.delete(targetId);
        }
        notifyTargetChanged(targetId);
      }
    }
  };
}

interface GuidedTourTargetProps extends ViewProps {
  targetId: string;
  children: React.ReactNode;
  enabled?: boolean;
}

export function GuidedTourTarget({
  targetId,
  children,
  onLayout,
  enabled = true,
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
    if (enabled) {
      unregisterRef.current = registerGuidedTourTarget(targetId, measure);
    }
    return () => {
      unregisterRef.current?.();
      unregisterRef.current = null;
    };
  }, [enabled, measure, targetId]);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      onLayout?.(event);
      if (!enabled) return;
      unregisterRef.current?.();
      unregisterRef.current = registerGuidedTourTarget(targetId, measure);
      notifyTargetChanged(targetId);
    },
    [enabled, measure, onLayout, targetId],
  );

  return (
    <View ref={ref} onLayout={handleLayout} collapsable={false} {...props}>
      {children}
    </View>
  );
}
