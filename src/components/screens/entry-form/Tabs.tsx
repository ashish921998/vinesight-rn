import { LinearGradient } from 'expo-linear-gradient';
import { useM3, useThemeColors } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { AppIcon } from '@/components/ui/app-icon';
import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';

export type EntryTab = 'log' | 'task';

interface TabsProps {
  tabs: EntryTab[];
  activeTab: EntryTab;
  onTabChange: (tab: EntryTab) => void;
}

export function Tabs({ tabs, activeTab, onTabChange }: TabsProps) {
  const m3 = useM3();
  const colors = useThemeColors();
  const { t } = useTranslation();

  if (tabs.length < 2) return null;

  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}>
      <View
        style={{
          backgroundColor: colors.surface[100],
          borderRadius: 999,
          padding: 4,
          flexDirection: 'row',
        }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab;
          const label = tab === 'log' ? t('entryForm.tabs.log') : t('entryForm.tabs.task');
          const iconName = tab === 'log' ? 'document-text' : 'checkbox-outline';
          return (
            <Pressable
              key={tab}
              onPress={() => onTabChange(tab)}
              style={[{ flex: 1, borderRadius: 999, overflow: 'hidden' }, { marginHorizontal: 2 }]}
            >
              {isActive ? (
                <LinearGradient
                  colors={[
                    colorWithOpacity(m3.colorScheme.primary, 0.95),
                    colorWithOpacity(m3.colorScheme.primary, 0.7),
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    width: '100%',
                    borderRadius: 999,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AppIcon name={iconName} size={16} color={m3.colorScheme.onPrimary} />
                  <Text
                    selectable
                    style={[
                      { marginLeft: 8, fontSize: 14, fontWeight: '600' },
                      { color: m3.colorScheme.onPrimary },
                    ]}
                  >
                    {label}
                  </Text>
                </LinearGradient>
              ) : (
                <View
                  style={{
                    width: '100%',
                    borderRadius: 999,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AppIcon name={iconName} size={16} color={m3.colorScheme.onSurfaceVariant} />
                  <Text
                    selectable
                    style={[
                      { marginLeft: 8, fontSize: 14, fontWeight: '600' },
                      { color: m3.colorScheme.onSurfaceVariant },
                    ]}
                  >
                    {label}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
