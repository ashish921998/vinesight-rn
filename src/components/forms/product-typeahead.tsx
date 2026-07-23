import React, { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { borderRadius, fontSize, fontWeight, spacing } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import {
  buildSearchSelectSections,
  type SearchSelectOption,
  type SearchSelectSelection,
} from '@/components/ui/search-select-logic';

interface ProductTypeaheadProps {
  /** Raw text typed in the name field; matching/ranking is shared with SearchSelect. */
  query: string;
  history?: SearchSelectOption[];
  plan?: SearchSelectOption[];
  catalog?: SearchSelectOption[];
  onSelect: (selection: SearchSelectSelection) => void;
  /** Form accent (fertigation success / spray tertiary) for the add-custom row. */
  accentColor: string;
  maxPerSection?: number;
}

/**
 * The name field's inline suggestion dropdown — the single entry point for
 * picking products (v2 drawer design): the farmer's own history first, then
 * plan items, then catalog products / whole spray mixes, then the "Add as
 * new" escape hatch. Replaces both the old NameSuggestionOverlay and the
 * separate SearchSelect modal flow inside the product-row forms.
 */
export function ProductTypeahead({
  query,
  history = [],
  plan = [],
  catalog = [],
  onSelect,
  accentColor,
  maxPerSection = 3,
}: ProductTypeaheadProps) {
  const m3 = useM3();
  const { t } = useTranslation();

  const sections = useMemo(
    () =>
      buildSearchSelectSections({ query, history, plan, catalog }).map((section) => ({
        ...section,
        options:
          section.id === 'custom' ? section.options : section.options.slice(0, maxPerSection),
      })),
    [query, history, plan, catalog, maxPerSection],
  );

  if (sections.length === 0) return null;

  // In normal flow (not an absolute overlay): inside a bottom sheet the fixed
  // Save footer would draw over an overlay, so the list pushes content down
  // and scrolls with the form instead.
  return (
    <View
      style={{
        marginTop: spacing[1],
        backgroundColor: m3.surface.s50,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: m3.surface.s300,
        maxHeight: 264,
        overflow: 'hidden',
      }}
    >
      <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
        {sections.map((section) => (
          <View key={section.id}>
            {section.id !== 'custom' ? (
              <Text
                style={{
                  paddingHorizontal: spacing[3],
                  paddingTop: spacing[2],
                  paddingBottom: spacing[1],
                  fontSize: fontSize.xs,
                  fontWeight: fontWeight.bold,
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                  color: m3.surface.s500,
                }}
              >
                {t(`searchSelect.sections.${section.id}`)}
              </Text>
            ) : null}
            {section.options.map((option) => {
              const isCustom = section.id === 'custom';
              const isMix = option.selection.kind === 'mix';
              return (
                <Pressable
                  key={option.key}
                  onPress={() => onSelect(option.selection)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    isCustom ? t('searchSelect.addCustom', { query: option.name }) : option.name
                  }
                  style={{
                    paddingHorizontal: spacing[3],
                    paddingVertical: spacing[2],
                    borderTopWidth: 1,
                    borderTopColor: m3.surface.s100,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing[2],
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      numberOfLines={1}
                      style={{
                        fontSize: fontSize.sm,
                        fontWeight: fontWeight.semibold,
                        color: isCustom ? accentColor : m3.surface.s900,
                      }}
                    >
                      {isCustom ? t('searchSelect.addCustom', { query: option.name }) : option.name}
                    </Text>
                    {option.detail ? (
                      <Text
                        numberOfLines={1}
                        style={{ fontSize: fontSize.xs, color: m3.surface.s500 }}
                      >
                        {option.detail}
                      </Text>
                    ) : null}
                  </View>
                  {isMix ? (
                    <View
                      style={{
                        paddingHorizontal: spacing[2],
                        paddingVertical: 2,
                        borderRadius: borderRadius.full,
                        backgroundColor: colorWithOpacity(accentColor, 0.14),
                      }}
                    >
                      <Text
                        style={{
                          fontSize: fontSize.xs,
                          fontWeight: fontWeight.bold,
                          color: accentColor,
                        }}
                      >
                        {t('searchSelect.mixTag')}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
