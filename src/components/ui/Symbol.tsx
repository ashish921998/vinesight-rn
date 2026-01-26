import { SymbolView, SymbolWeight } from 'expo-symbols';
import React from 'react';

interface SymbolProps {
  name: string;
  size?: number;
  color?: string;
  weight?: SymbolWeight;
}

export function Symbol({ name, size = 24, color = '#000', weight = 'regular' }: SymbolProps) {
  return (
    <SymbolView
      name={name}
      size={size}
      tintColor={color}
      weight={weight}
      type="monochrome"
      fallback={
        <SymbolView name="questionmark.circle" size={size} tintColor={color} weight={weight} />
      }
    />
  );
}
