import { useCallback, useEffect, useRef } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { ScrollView as GestureScrollView } from 'react-native-gesture-handler';
import Animated, {
  FadeInDown,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useM3 } from '@/styles/use-theme';
import { spacing, fontSize, fontWeight, borderRadius } from '@/styles/theme';
import { springs } from '@/styles/motion';
import { colorWithOpacity } from '@/utils/color';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
import type {
  SearchSelectSection,
  SearchSelectSelection,
} from '@/components/ui/search-select-logic';

export interface ProductPickerFieldProps {
  /** Currently picked product name, or empty when nothing's picked yet. */
  productName: string;
  isOpen: boolean;
  query: string;
  sections: SearchSelectSection[];
  onOpen: () => void;
  onClose: () => void;
  onQueryChange: (text: string) => void;
  onSelect: (selection: SearchSelectSelection) => void;
}

/**
 * Inline accordion product field, replacing a nested SearchSelect sheet on
 * top of an already-modal plan form. The chevron is a single element that
 * rotates 0°→90° (right → down) across both states — the standard disclosure
 * convention — rather than swapping between two unrelated icons, and both the
 * row and the results panel animate via Reanimated's layout transitions so
 * sibling rows glide instead of jump-cutting when this one expands.
 */
export function ProductPickerField({
  productName,
  isOpen,
  query,
  sections,
  onOpen,
  onClose,
  onQueryChange,
  onSelect,
}: ProductPickerFieldProps) {
  const m3 = useM3();
  const { t } = useTranslation();
  const rotation = useSharedValue(isOpen ? 90 : 0);
  // Set on a result row's touch-down, before the TextInput's blur fires, so
  // the blur handler's deferred close doesn't unmount the row mid-tap. Cleared
  // on press-out so a cancelled tap (finger dragged off the row — onPressOut
  // fires but onPress doesn't) doesn't leave the flag latched true: that would
  // make the deferred blur consume it and return without closing, stranding the
  // picker open with no keyboard focus.
  const selectingRef = useRef(false);

  useEffect(() => {
    rotation.value = withSpring(isOpen ? 90 : 0, springs.snappy);
  }, [isOpen, rotation]);

  const handleBlur = useCallback(() => {
    // Losing focus (tapping another field, dragging to dismiss the keyboard)
    // means the consultant moved on without picking — collapse back to the
    // summary row instead of leaving an open search box with no keyboard.
    // Deferred so a genuine row tap (which blurs first, then fires onPress)
    // isn't preempted mid-selection.
    setTimeout(() => {
      if (selectingRef.current) {
        selectingRef.current = false;
        return;
      }
      onClose();
    }, 150);
  }, [onClose]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View layout={LinearTransition.springify().dampingRatio(1)}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: m3.surface.s100,
          borderWidth: 1,
          borderColor: m3.surface.s300,
          borderTopLeftRadius: borderRadius.sm,
          borderTopRightRadius: borderRadius.sm,
          borderBottomLeftRadius: isOpen ? 0 : borderRadius.sm,
          borderBottomRightRadius: isOpen ? 0 : borderRadius.sm,
          minHeight: 48,
        }}
      >
        {isOpen ? (
          <TextInput
            value={query}
            onChangeText={onQueryChange}
            onBlur={handleBlur}
            autoFocus
            autoCorrect={false}
            accessibilityLabel={t('searchSelect.searchPlaceholder')}
            placeholder={t('searchSelect.searchPlaceholder')}
            placeholderTextColor={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)}
            style={{
              flex: 1,
              color: m3.surface.s900,
              fontSize: fontSize.base,
              paddingHorizontal: spacing[4],
              paddingVertical: spacing[3],
            }}
          />
        ) : (
          <Pressable
            onPress={onOpen}
            accessibilityRole="button"
            accessibilityLabel={productName || t('professional.reviews.selectProduct')}
            accessibilityState={{ expanded: false }}
            style={{ flex: 1, paddingHorizontal: spacing[4], paddingVertical: spacing[3] }}
          >
            <Text
              numberOfLines={1}
              style={{
                fontSize: fontSize.base,
                color: productName ? m3.surface.s900 : m3.neutral.n400,
              }}
            >
              {productName || t('professional.reviews.selectProduct')}
            </Text>
          </Pressable>
        )}

        <Pressable
          onPress={isOpen ? onClose : onOpen}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={isOpen ? t('common.close') : t('professional.reviews.selectProduct')}
          accessibilityState={{ expanded: isOpen }}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Animated.View style={chevronStyle}>
            <UiSymbol name="chevron.right" size={18} color={m3.surface.s600} />
          </Animated.View>
        </Pressable>
      </View>

      {isOpen ? (
        <Animated.View
          entering={FadeInDown.duration(200)}
          layout={LinearTransition.springify().dampingRatio(1)}
          style={{
            marginTop: -1,
            borderWidth: 1,
            borderColor: m3.surface.s300,
            borderTopWidth: 0,
            borderBottomLeftRadius: borderRadius.sm,
            borderBottomRightRadius: borderRadius.sm,
            backgroundColor: m3.colorScheme.surface,
            overflow: 'hidden',
          }}
        >
          {sections.length === 0 ? (
            <Text style={{ padding: spacing[3], fontSize: fontSize.sm, color: m3.surface.s500 }}>
              {t('searchSelect.empty')}
            </Text>
          ) : (
            // Capped + independently scrollable: an org can accumulate dozens of
            // history rows, and letting the list grow unbounded inline would push
            // "Add another product" and notes far down, forcing the user to
            // scroll the whole form just to see past it. Uses gesture-handler's
            // ScrollView (not core RN's) — nested same-direction scrollers need
            // explicit gesture arbitration, which RNGH provides and core RN's
            // `nestedScrollEnabled` only approximates on Android.
            <GestureScrollView
              style={{ maxHeight: 260 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            >
              {sections.map((section) => (
                <View key={section.id}>
                  {section.id === 'history' ? (
                    <Text
                      accessibilityRole="header"
                      style={{
                        paddingHorizontal: spacing[3],
                        paddingTop: spacing[3],
                        paddingBottom: spacing[1],
                        fontSize: fontSize.xs,
                        fontWeight: fontWeight.semibold,
                        color: m3.surface.s500,
                        textTransform: 'uppercase',
                        letterSpacing: 0.4,
                      }}
                    >
                      {t('professional.reviews.prescribedOften')}
                    </Text>
                  ) : null}
                  {section.options.map((option) => {
                    const isCustomRow = section.id === 'custom';
                    const primaryText = isCustomRow
                      ? t('searchSelect.addCustom', { query: option.name })
                      : option.name;
                    const detailText = isCustomRow ? t('searchSelect.customHint') : option.detail;
                    return (
                      <Pressable
                        key={option.key}
                        onPressIn={() => {
                          selectingRef.current = true;
                        }}
                        // Fires on both a real tap (after onPress) and a
                        // cancelled one (drag away — no onPress). Resetting here
                        // un-strands a cancelled press without affecting a real
                        // one: onPress has already called onSelect by then.
                        onPressOut={() => {
                          selectingRef.current = false;
                        }}
                        onPress={() => onSelect(option.selection)}
                        accessibilityRole="button"
                        accessibilityLabel={
                          detailText ? `${primaryText}, ${detailText}` : primaryText
                        }
                        style={{
                          minHeight: 44,
                          justifyContent: 'center',
                          paddingHorizontal: spacing[3],
                          paddingVertical: spacing[3],
                          borderTopWidth: 1,
                          borderTopColor: m3.surface.s100,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: fontSize.sm,
                            fontWeight: fontWeight.semibold,
                            color: isCustomRow ? m3.colorScheme.primary : m3.surface.s900,
                          }}
                        >
                          {primaryText}
                        </Text>
                        {detailText ? (
                          <Text
                            style={{ fontSize: fontSize.xs, color: m3.surface.s500, marginTop: 2 }}
                          >
                            {detailText}
                          </Text>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </GestureScrollView>
          )}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}
