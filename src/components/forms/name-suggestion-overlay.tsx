import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { borderRadius, fontSize, spacing } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';

/** The fields the overlay renders; both forms' quick-add items carry them. */
export interface SuggestionItemLike {
  name: string;
  quantity?: number | null;
  unit?: string | null;
}

interface NameSuggestionOverlayProps<T extends SuggestionItemLike> {
  items: readonly T[];
  onSelect: (item: T) => void;
  /** Unit label for items that carry none ('kg' for fertigation, 'gm/L' for spray). */
  fallbackUnitLabel: string;
}

/**
 * The name-typeahead dropdown both product-row forms render under the name
 * field (issue #208): absolutely positioned below the input, capped height,
 * one pressable row per suggestion showing name and dose. Visibility is the
 * caller's decision — this only renders the open dropdown.
 */
export function NameSuggestionOverlay<T extends SuggestionItemLike>({
  items,
  onSelect,
  fallbackUnitLabel,
}: NameSuggestionOverlayProps<T>) {
  const m3 = useM3();
  return (
    <View
      style={{
        position: 'absolute',
        top: 52,
        left: 0,
        right: 0,
        backgroundColor: '#ffffff',
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: m3.surface.s300,
        maxHeight: 208,
        overflow: 'hidden',
        zIndex: 20,
      }}
    >
      <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
        {items.map((item, index) => (
          <Pressable
            key={`${item.name}-${item.unit ?? 'unit'}-${index}`}
            onPress={() => onSelect(item)}
            style={{
              paddingHorizontal: spacing[3],
              paddingVertical: spacing[2],
              borderTopWidth: index === 0 ? 0 : 1,
              borderTopColor: m3.surface.s100,
            }}
          >
            <Text style={{ fontSize: fontSize.sm, color: m3.surface.s900 }}>{item.name}</Text>
            <Text style={{ fontSize: fontSize.xs, color: m3.surface.s500 }}>
              {item.quantity ? `${item.quantity} ` : ''}
              {item.unit ?? fallbackUnitLabel}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
