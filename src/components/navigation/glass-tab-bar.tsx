import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useCallback, useEffect, useMemo } from 'react';
import { Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { useAppModeStore } from '@/stores';
import { fontSize, radius, spacing } from '@/styles/theme';
import { useIsDark, useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { BASE_TABS, DETAILED_TABS, type Tab } from './tab-definitions';

const BAR_HEIGHT = 58;
const BAR_MARGIN = spacing[3];
const ROW_PADDING = spacing[1];
const ITEM_PADDING = spacing[2] - 1;
const ICON_SIZE = 21;
const SLIDE_SPRING = { duration: 420, dampingRatio: 0.82 };

const AnimatedIonicons = Animated.createAnimatedComponent(Ionicons);

type TabButtonProps = {
  tab: Tab;
  index: number;
  label: string;
  focused: boolean;
  slideIndex: SharedValue<number>;
  activeColor: string;
  inactiveColor: string;
  onPress: () => void;
  onLongPress: () => void;
};

function TabButton({
  tab,
  index,
  label,
  focused,
  slideIndex,
  activeColor,
  inactiveColor,
  onPress,
  onLongPress,
}: TabButtonProps) {
  const activeStyle = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(Math.abs(slideIndex.value - index), 1),
  }));

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.tab}
    >
      <View style={styles.iconContainer}>
        <Ionicons name={tab.ion[0]} color={inactiveColor} size={ICON_SIZE} />
        <AnimatedIonicons
          name={tab.ion[1]}
          color={activeColor}
          size={ICON_SIZE}
          style={[StyleSheet.absoluteFill, styles.centeredIcon, activeStyle]}
        />
      </View>
      <Animated.Text
        numberOfLines={1}
        style={[
          styles.label,
          { color: focused ? activeColor : inactiveColor },
          focused && styles.activeLabel,
        ]}
      >
        {label}
      </Animated.Text>
    </Pressable>
  );
}

/**
 * Vinesight's route-aware adaptation of the Revolut clone's floating glass bar.
 * Routing and mode visibility remain owned by expo-router and tab-definitions;
 * this component only replaces the navigator chrome.
 */
export function GlassTabBar({ state, navigation, insets }: BottomTabBarProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const m3 = useM3();
  const isDark = useIsDark();
  const detailedMode = useAppModeStore((store) => store.detailedMode);
  const tabs = useMemo(
    () => (detailedMode ? [...BASE_TABS, ...DETAILED_TABS] : [...BASE_TABS]),
    [detailedMode],
  );
  const activeName = state.routes[state.index]?.name;
  const activeIndex = Math.max(
    tabs.findIndex((tab) => tab.name === activeName),
    0,
  );
  const slideIndex = useSharedValue(activeIndex);
  const dragging = useSharedValue(false);
  const lastTicked = useSharedValue(activeIndex);

  const activeColor = m3.colorScheme.primary;
  const inactiveColor = m3.colorScheme.onSurfaceVariant;
  const capsuleColor = colorWithOpacity(
    isDark ? m3.surface.surfaceContainerHigh : m3.surface.surfaceContainerLowest,
    isDark ? 0.82 : 0.9,
  );
  const highlightColor = colorWithOpacity(m3.colorScheme.primary, isDark ? 0.24 : 0.14);
  const bottomOffset = Math.max(insets.bottom - spacing[4], spacing[3]);
  const barWidth = width - BAR_MARGIN * 2;
  const itemWidth = (barWidth - ROW_PADDING * 2) / Math.max(tabs.length, 1);

  const selectIndex = useCallback(
    (index: number) => {
      const tab = tabs[index];
      const route = state.routes.find((candidate) => candidate.name === tab?.name);
      if (!tab || !route) return;

      const focused = route.name === activeName;
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });
      if (!focused && !event.defaultPrevented) {
        navigation.navigate(route.name as never);
      }
    },
    [activeName, navigation, state.routes, tabs],
  );

  const tick = useCallback(() => {
    if (Platform.OS === 'ios') void Haptics.selectionAsync();
  }, []);

  useEffect(() => {
    if (!dragging.value) slideIndex.value = withSpring(activeIndex, SLIDE_SPRING);
  }, [activeIndex, dragging, slideIndex]);

  const gesture = useMemo(() => {
    const indexAtX = (x: number) => {
      'worklet';
      const value = (x - ROW_PADDING) / itemWidth - 0.5;
      return Math.min(Math.max(value, 0), tabs.length - 1);
    };

    const pan = Gesture.Pan()
      .activeOffsetX([-6, 6])
      .failOffsetY([-14, 14])
      .onStart(() => {
        dragging.value = true;
        lastTicked.value = Math.round(slideIndex.value);
      })
      .onUpdate((event) => {
        const index = indexAtX(event.x);
        slideIndex.value = index;
        const rounded = Math.round(index);
        if (rounded !== lastTicked.value) {
          lastTicked.value = rounded;
          runOnJS(tick)();
        }
      })
      .onFinalize(() => {
        if (!dragging.value) return;
        const index = Math.round(slideIndex.value);
        slideIndex.value = withSpring(index, SLIDE_SPRING);
        dragging.value = false;
        runOnJS(selectIndex)(index);
      });

    return pan;
  }, [dragging, itemWidth, lastTicked, selectIndex, slideIndex, tabs.length, tick]);

  const highlightStyle = useAnimatedStyle(() => ({
    width: itemWidth,
    transform: [{ translateX: ROW_PADDING + itemWidth * slideIndex.value }],
  }));

  return (
    <View style={[styles.container, { height: BAR_HEIGHT + bottomOffset + spacing[3] }]}>
      <LinearGradient
        pointerEvents="none"
        colors={['transparent', colorWithOpacity(m3.colorScheme.background, 0.82)]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.barFrame, { marginBottom: bottomOffset }]}>
        <GestureDetector gesture={gesture}>
          <View
            style={[
              styles.bar,
              {
                backgroundColor: capsuleColor,
                borderColor: colorWithOpacity(m3.colorScheme.outline, isDark ? 0.34 : 0.22),
                shadowColor: m3.colorScheme.shadow,
              },
            ]}
          >
            <BlurView
              intensity={isDark ? 45 : 65}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: capsuleColor }]} />
            <Animated.View
              pointerEvents="none"
              style={[styles.highlight, { backgroundColor: highlightColor }, highlightStyle]}
            />
            <View style={styles.row}>
              {tabs.map((tab, index) => {
                const route = state.routes.find((candidate) => candidate.name === tab.name);
                if (!route) return null;
                const focused = tab.name === activeName;
                return (
                  <TabButton
                    key={tab.name}
                    tab={tab}
                    index={index}
                    label={t(tab.titleKey)}
                    focused={focused}
                    slideIndex={slideIndex}
                    activeColor={activeColor}
                    inactiveColor={inactiveColor}
                    onPress={() => {
                      slideIndex.value = withSpring(index, SLIDE_SPRING);
                      selectIndex(index);
                    }}
                    onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
                  />
                );
              })}
            </View>
          </View>
        </GestureDetector>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'flex-end',
  },
  barFrame: {
    marginHorizontal: BAR_MARGIN,
  },
  bar: {
    height: BAR_HEIGHT,
    borderRadius: radius.full,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 10,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ROW_PADDING,
  },
  highlight: {
    position: 'absolute',
    top: ROW_PADDING,
    bottom: ROW_PADDING,
    left: 0,
    borderRadius: radius.full,
    borderCurve: 'continuous',
  },
  tab: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: ITEM_PADDING,
  },
  iconContainer: {
    width: ICON_SIZE,
    height: ICON_SIZE,
  },
  centeredIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginTop: 2,
    fontSize: fontSize['2xs'],
    fontWeight: '500',
    lineHeight: 12,
  },
  activeLabel: {
    fontWeight: '600',
  },
});
