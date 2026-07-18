import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import { Host, Icon, NavigationBar, NavigationBarItem, Text } from '@expo/ui/jetpack-compose';
import { useM3 } from '@/styles/use-theme';
import { useAppModeStore } from '@/stores';
import { getAndroidBottomSystemInset } from '@/utils/android-system-bars';
import dashboardIcon from '../../../assets/tab-icons/dashboard.xml';
import exploreIcon from '../../../assets/tab-icons/explore.xml';
import workersIcon from '../../../assets/tab-icons/workers.xml';
import toolsIcon from '../../../assets/tab-icons/tools.xml';
import assistantIcon from '../../../assets/tab-icons/assistant.xml';
import { BASE_TABS, DETAILED_TABS } from './tab-definitions';

type TabName = (typeof BASE_TABS)[number]['name'] | (typeof DETAILED_TABS)[number]['name'];

// Android bottom nav via @expo/ui's Material 3 NavigationBar. It is a pure
// renderer with no routing, so we drive it from expo-router's <Tabs> navigator
// state (passed in as BottomTabBarProps) — selection from state.index, taps via
// navigation.emit/navigate. Icons must be Android XML vector drawables.
const TAB_ICONS: Record<TabName, number> = {
  index: dashboardIcon,
  explore: exploreIcon,
  workers: workersIcon,
  tools: toolsIcon,
  assistant: assistantIcon,
};

export function ComposeTabBar({ state, navigation, insets }: BottomTabBarProps) {
  const { t } = useTranslation();
  const m3 = useM3();
  const detailedMode = useAppModeStore((s) => s.detailedMode);
  const bottomInset = getAndroidBottomSystemInset(insets.bottom);

  const tabs = detailedMode ? [...BASE_TABS, ...DETAILED_TABS] : BASE_TABS;
  const activeName = state.routes[state.index]?.name;
  const itemColors = {
    selectedIconColor: m3.colorScheme.onSecondaryContainer,
    selectedTextColor: m3.colorScheme.onSurface,
    selectedIndicatorColor: m3.colorScheme.secondaryContainer,
    unselectedIconColor: m3.colorScheme.onSurfaceVariant,
    unselectedTextColor: m3.colorScheme.onSurfaceVariant,
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
      <Host matchContents>
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
                  <Icon source={TAB_ICONS[tab.name]} size={24} />
                </NavigationBarItem.Icon>
                <NavigationBarItem.Label>
                  <Text>{t(tab.titleKey)}</Text>
                </NavigationBarItem.Label>
              </NavigationBarItem>
            );
          })}
        </NavigationBar>
      </Host>
    </View>
  );
}
