/**
 * SearchSelect — the one sectioned product picker (issue #193): history first,
 * active plan items second, catalog third, and an always-available
 * "Add '<query>' as custom" escape hatch so logging is never blocked.
 *
 * Purely presentational: section data arrives as pre-built options (see
 * search-select-logic.ts adapters), so history/plan/catalog render from the
 * React Query cache and keep working offline.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, SectionList, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { borderRadius, fontSize, fontWeight, spacing } from '@/styles/theme';
import {
  buildSearchSelectSections,
  type SearchSelectOption,
  type SearchSelectSectionId,
  type SearchSelectSelection,
} from './search-select-logic';

export const SEARCH_SELECT_DEBOUNCE_MS = 200;

const SECTION_TITLE_KEYS: Record<SearchSelectSectionId, string | null> = {
  history: 'searchSelect.sections.history',
  plan: 'searchSelect.sections.plan',
  catalog: 'searchSelect.sections.catalog',
  custom: null,
};

export interface SearchSelectProps {
  visible: boolean;
  onClose: () => void;
  /** Fired once per tap; the caller closes the picker (or keeps it open). */
  onSelect: (selection: SearchSelectSelection) => void;
  historyOptions?: SearchSelectOption[];
  planOptions?: SearchSelectOption[];
  catalogOptions?: SearchSelectOption[];
  /** Custom escape-hatch row (default true). */
  allowCustom?: boolean;
  title?: string;
  searchPlaceholder?: string;
  /**
   * Per-section header overrides (already-localized strings) for contexts
   * where the defaults misread — e.g. consultant plan authoring renames
   * history to "You often prescribe".
   */
  sectionTitles?: Partial<Record<SearchSelectSectionId, string>>;
}

export function SearchSelect({ visible, onClose, ...bodyProps }: SearchSelectProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* The body only mounts while open, so the query resets on every open. */}
      {visible ? <SearchSelectBody onClose={onClose} {...bodyProps} /> : null}
    </Modal>
  );
}

function SearchSelectBody({
  onClose,
  onSelect,
  historyOptions,
  planOptions,
  catalogOptions,
  allowCustom = true,
  title,
  searchPlaceholder,
  sectionTitles,
}: Omit<SearchSelectProps, 'visible'>) {
  const { t } = useTranslation();
  const m3 = useM3();
  const [inputValue, setInputValue] = useState('');
  const [query, setQuery] = useState('');

  // Debounced local filter: the input echoes immediately, matching waits.
  useEffect(() => {
    const handle = setTimeout(() => setQuery(inputValue), SEARCH_SELECT_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [inputValue]);

  const sections = useMemo(
    () =>
      buildSearchSelectSections({
        query,
        history: historyOptions,
        plan: planOptions,
        catalog: catalogOptions,
        allowCustom,
      }),
    [query, historyOptions, planOptions, catalogOptions, allowCustom],
  );

  const listSections = useMemo(
    () => sections.map((section) => ({ id: section.id, data: section.options })),
    [sections],
  );

  const emptyText = query.trim()
    ? t('common.noResultsFound', { defaultValue: 'No results found' })
    : t('searchSelect.empty');

  return (
    <Pressable
      onPress={onClose}
      accessibilityRole="none"
      testID="search-select-backdrop"
      style={{
        flex: 1,
        backgroundColor: colorWithOpacity(m3.colorScheme.shadow, 0.25),
        justifyContent: 'center',
        padding: spacing[4],
      }}
    >
      {/* Consumes the touch so tapping the card doesn't bubble to the backdrop's onPress. */}
      <Pressable
        onPress={() => {}}
        style={{
          borderRadius: borderRadius.xl,
          backgroundColor: m3.colorScheme.surface,
          borderWidth: 1,
          borderColor: m3.colorScheme.outlineVariant,
          maxHeight: '85%',
        }}
      >
        <View
          style={{
            padding: spacing[4],
            borderBottomWidth: 1,
            borderBottomColor: m3.surface.s100,
          }}
        >
          <Text
            style={{
              fontSize: fontSize.base,
              fontWeight: fontWeight.semibold,
              color: m3.surface.s900,
            }}
          >
            {title ?? t('searchSelect.title')}
          </Text>
          <TextInput
            value={inputValue}
            onChangeText={setInputValue}
            autoFocus
            autoCorrect={false}
            accessibilityLabel={searchPlaceholder ?? t('searchSelect.searchPlaceholder')}
            placeholder={searchPlaceholder ?? t('searchSelect.searchPlaceholder')}
            placeholderTextColor={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)}
            style={{
              marginTop: spacing[3],
              borderRadius: borderRadius.lg,
              borderWidth: 1,
              borderColor: m3.surface.s200,
              backgroundColor: m3.surface.s100,
              color: m3.surface.s900,
              paddingHorizontal: spacing[3],
              paddingVertical: spacing[3],
            }}
          />
        </View>

        <SectionList
          sections={listSections}
          keyExtractor={(option) => option.key}
          keyboardShouldPersistTaps="handled"
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => {
            const sectionId = section.id as SearchSelectSectionId;
            const titleKey = SECTION_TITLE_KEYS[sectionId];
            const headerText = sectionTitles?.[sectionId] ?? (titleKey ? t(titleKey) : null);
            if (!headerText) return null;
            return (
              <Text
                accessibilityRole="header"
                style={{
                  paddingHorizontal: spacing[4],
                  paddingTop: spacing[3],
                  paddingBottom: spacing[1],
                  fontSize: fontSize.xs,
                  fontWeight: fontWeight.semibold,
                  color: m3.surface.s500,
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                }}
              >
                {headerText}
              </Text>
            );
          }}
          renderItem={({ item, section }) => {
            const isCustomRow = section.id === 'custom';
            const primaryText = isCustomRow
              ? t('searchSelect.addCustom', { query: item.name })
              : item.name;
            const detailText = isCustomRow ? t('searchSelect.customHint') : item.detail;
            return (
              <Pressable
                onPress={() => onSelect(item.selection)}
                accessibilityRole="button"
                accessibilityLabel={detailText ? `${primaryText}, ${detailText}` : primaryText}
                style={{
                  paddingHorizontal: spacing[4],
                  paddingVertical: spacing[3],
                  borderTopWidth: 1,
                  borderTopColor: m3.surface.s100,
                }}
              >
                <Text
                  style={{
                    fontSize: fontSize.sm,
                    color: isCustomRow ? m3.colorScheme.primary : m3.surface.s900,
                    fontWeight: fontWeight.semibold,
                  }}
                >
                  {primaryText}
                </Text>
                {detailText ? (
                  <Text style={{ fontSize: fontSize.xs, color: m3.surface.s500, marginTop: 2 }}>
                    {detailText}
                  </Text>
                ) : null}
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <Text
              style={{
                paddingHorizontal: spacing[4],
                paddingVertical: spacing[4],
                fontSize: fontSize.sm,
                color: m3.surface.s500,
              }}
            >
              {emptyText}
            </Text>
          }
        />

        <View
          style={{
            padding: spacing[3],
            borderTopWidth: 1,
            borderTopColor: m3.surface.s100,
            alignItems: 'flex-end',
          }}
        >
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('common.close', { defaultValue: 'Close' })}
            style={{
              borderRadius: borderRadius.full,
              paddingHorizontal: spacing[3],
              paddingVertical: spacing[2],
              backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
            }}
          >
            <Text style={{ color: m3.colorScheme.primary, fontWeight: fontWeight.semibold }}>
              {t('common.close', { defaultValue: 'Close' })}
            </Text>
          </Pressable>
        </View>
      </Pressable>
    </Pressable>
  );
}
