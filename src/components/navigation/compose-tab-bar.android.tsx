import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import { Host, Icon, NavigationBar, NavigationBarItem, Text } from '@expo/ui/jetpack-compose';
import agricultureOutlinedIcon from '@expo/material-symbols/agriculture.xml';
import buildOutlinedIcon from '@expo/material-symbols/build.xml';
import groupOutlinedIcon from '@expo/material-symbols/group.xml';
import homeOutlinedIcon from '@expo/material-symbols/home.xml';
import { useM3, useIsDark } from '@/styles/use-theme';
import { useAppModeStore } from '@/stores';
import homeFilledIcon from '../../../assets/tab-icons/material-home-filled.xml';
import agricultureFilledIcon from '../../../assets/tab-icons/material-agriculture-filled.xml';
import groupFilledIcon from '../../../assets/tab-icons/material-group-filled.xml';
import buildFilledIcon from '../../../assets/tab-icons/material-build-filled.xml';
import { BASE_TABS, DETAILED_TABS, type TabIconKey } from './tab-definitions';

// Android bottom nav via @expo/ui's Material 3 NavigationBar. It is a pure
// renderer with no routing, so we drive it from expo-router's <Tabs> navigator
// state (passed in as BottomTabBarProps) — selection from state.index, taps via
// navigation.emit/navigate. Icons must be Android XML vector drawables.
//
// Tab labels and the Android icon key come straight from the canonical
// BASE_TABS / DETAILED_TABS model in tab-definitions.ts, so this bar always
// matches the iOS NativeTabs chrome.
//
// NOTE on the `icon` slot: this @expo/ui build exposes NavigationBarItem.SelectedIcon
// in TS, but the Android Kotlin view only reads `icon` and `label`. Keep selected
// treatment in the single supported slot.
//
const FILLED_ICONS: Record<TabIconKey, number> = {
  home: homeFilledIcon,
  tractor: agricultureFilledIcon,
  workers: groupFilledIcon,
  tools: buildFilledIcon,
};

// Inactive tabs show the outlined glyph; the selected tab swaps to the filled
// one (standard Material behavior). The filled set ships as custom assets
// because @expo/material-symbols only provides the outlined style.
const OUTLINED_ICONS: Record<TabIconKey, number> = {
  home: homeOutlinedIcon,
  tractor: agricultureOutlinedIcon,
  workers: groupOutlinedIcon,
  tools: buildOutlinedIcon,
};

export function ComposeTabBar({ state, navigation }: BottomTabBarProps) {
  const { t } = useTranslation();
  const m3 = useM3();
  const isDark = useIsDark();
  const detailedMode = useAppModeStore((s) => s.detailedMode);

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

  return (
    <View
      style={{
        // M3 NavigationBar spec (m3.material.io/components/navigation-bar/specs):
        // the container color role is `surface container` (surface[200]), not
        // surfaceContainerLow — at surface[100] the bar blends into the app bg.
        //
        // NO manual bottom padding: the native Compose NavigationBar already applies
        // `navigationBarsPadding()` (windowInsets) internally, so its container color
        // extends behind the system gesture/3-button bar. Adding `insets.bottom` here
        // on top double-counts it and produces the extra bottom gap (large in 3-button
        // mode, smaller in gesture mode). See NavigationBarView.kt — it calls the M3
        // `NavigationBar` composable without overriding `windowInsets`.
        backgroundColor: m3.surface.surfaceContainer,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: m3.colorScheme.outlineVariant,
      }}
    >
      <Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
        <NavigationBar containerColor={m3.surface.surfaceContainer}>
          {tabs.map((tab) => {
            const route = state.routes.find((r: { name: string }) => r.name === tab.name);
            if (!route) return null;
            const focused = activeName === tab.name;
            const iconKey = tab.androidIconKey;
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
                  <Icon
                    source={focused ? FILLED_ICONS[iconKey] : OUTLINED_ICONS[iconKey]}
                    size={24}
                    tint={focused ? m3.primary.p500 : m3.colorScheme.onSurfaceVariant}
                  />
                </NavigationBarItem.Icon>
                <NavigationBarItem.Label>
                  {/*
                    typography: 'labelMedium' matches the M3 NavigationBar spec
                    (12sp / weight 500 — what Play Store & Google apps use). The
                    @expo/ui Text does NOT inherit the label style that
                    NavigationBarItem provides via ProvideTextStyle; without this it
                    falls back to Compose TextStyle.Default (16sp / weight 400),
                    which looks too large and too thin.
                  */}
                  <Text style={{ typography: 'labelMedium' }}>{t(tab.titleKey)}</Text>
                </NavigationBarItem.Label>
              </NavigationBarItem>
            );
          })}
        </NavigationBar>
      </Host>
    </View>
  );
}
