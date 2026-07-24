import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import { Host, Icon, NavigationBar, NavigationBarItem, Text } from '@expo/ui/jetpack-compose';
import { useM3, useIsDark } from '@/styles/use-theme';
import { useAppModeStore } from '@/stores';
import { getAndroidBottomSystemInset } from '@/utils/android-system-bars';
import dashboardIcon from '../../../assets/tab-icons/dashboard.xml';
import homeIcon from '../../../assets/tab-icons/home.xml';
import barnIcon from '../../../assets/tab-icons/barn.xml';
import tractorIcon from '../../../assets/tab-icons/tractor.xml';
import workersIcon from '../../../assets/tab-icons/workers.xml';
import toolsIcon from '../../../assets/tab-icons/tools.xml';
import { BASE_TABS, DETAILED_TABS, baseTabIconKey, baseTabLabelKey } from './tab-definitions';

type TabName = (typeof BASE_TABS)[number]['name'] | (typeof DETAILED_TABS)[number]['name'];

// Android bottom nav via @expo/ui's Material 3 NavigationBar. It is a pure
// renderer with no routing, so we drive it from expo-router's <Tabs> navigator
// state (passed in as BottomTabBarProps) — selection from state.index, taps via
// navigation.emit/navigate. Icons must be Android XML vector drawables.
//
// The two base destinations swap their icon with the mode label:
//   index   → home (Simplified) / dashboard (Detailed)
//   explore → barn (Simplified, "Farms") / tractor (Detailed, "Farming")
const DETAILED_TAB_ICONS: Record<(typeof DETAILED_TABS)[number]['name'], number> = {
  workers: workersIcon,
  tools: toolsIcon,
};

const BASE_ICON_BY_KEY = {
  home: homeIcon,
  dashboard: dashboardIcon,
  barn: barnIcon,
  tractor: tractorIcon,
} as const;

export function ComposeTabBar({ state, navigation, insets }: BottomTabBarProps) {
  const { t } = useTranslation();
  const m3 = useM3();
  const isDark = useIsDark();
  const detailedMode = useAppModeStore((s) => s.detailedMode);
  const bottomInset = getAndroidBottomSystemInset(insets.bottom);

  const tabs = detailedMode ? [...BASE_TABS, ...DETAILED_TABS] : BASE_TABS;
  const activeName = state.routes[state.index]?.name;
  const itemColors = {
    selectedIconColor: m3.colorScheme.onSecondaryContainer,
    selectedTextColor: m3.colorScheme.onSurface,
    // Light mode's secondaryContainer (primary[50] #f0f5f2) is so desaturated it
    // reads gray/blue; bump to a clearly-green rung. Dark's green pill is already fine.
    selectedIndicatorColor: isDark ? m3.colorScheme.secondaryContainer : m3.primary.p200,
    unselectedIconColor: m3.colorScheme.onSurfaceVariant,
    unselectedTextColor: m3.colorScheme.onSurfaceVariant,
  };

  const iconFor = (tabName: TabName): number => {
    if (tabName === 'index' || tabName === 'explore') {
      return BASE_ICON_BY_KEY[baseTabIconKey(tabName, detailedMode)];
    }
    return DETAILED_TAB_ICONS[tabName as (typeof DETAILED_TABS)[number]['name']];
  };

  return (
    <View
      style={{
        backgroundColor: m3.surface.surfaceContainerLow,
        paddingBottom: bottomInset,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: m3.colorScheme.outlineVariant,
      }}
    >
      <Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
        <NavigationBar containerColor={m3.surface.surfaceContainerLow}>
          {tabs.map((tab) => {
            const route = state.routes.find((r: { name: string }) => r.name === tab.name);
            if (!route) return null;
            const focused = activeName === tab.name;
            return (
              <NavigationBarItem
                key={tab.name}
                selected={focused}
                colors={itemColors}
                onClick={() => {
                  const event = navigation.emit({
                    type: 'tabPress',
                    target: route.key,
                    canPreventDefault: true,
                  });
                  if (!focused && !event.defaultPrevented) {
                    navigation.navigate(route.name as never);
                  }
                }}
              >
                <NavigationBarItem.Icon>
                  <Icon source={iconFor(tab.name)} size={tab.name === 'tools' ? 22 : 24} />
                </NavigationBarItem.Icon>
                <NavigationBarItem.Label>
                  <Text>{t(baseTabLabelKey(tab.name, detailedMode, tab.titleKey))}</Text>
                </NavigationBarItem.Label>
              </NavigationBarItem>
            );
          })}
        </NavigationBar>
      </Host>
    </View>
  );
}
