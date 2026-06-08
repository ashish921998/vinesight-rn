import { useM3 } from '@/styles/use-theme';
import { fontSize, radius } from '@/styles/theme';
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
  const { t } = useTranslation();

  if (tabs.length < 2) return null;

  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10 }}>
      <View
        style={{
          backgroundColor: m3.surface.s50,
          borderRadius: radius.full,
          padding: 5,
          flexDirection: 'row',
          borderWidth: 1,
          borderColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.12),
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
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`${label} tab${isActive ? ', selected' : ''}`}
              style={[
                { flex: 1, borderRadius: radius.full, overflow: 'hidden' },
                { marginHorizontal: 1.5 },
              ]}
            >
              <View
                style={{
                  width: '100%',
                  borderRadius: radius.full,
                  paddingVertical: 12,
                  paddingHorizontal: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isActive
                    ? colorWithOpacity(m3.colorScheme.primary, 0.14)
                    : 'transparent',
                  borderWidth: 1,
                  borderColor: isActive
                    ? colorWithOpacity(m3.colorScheme.primary, 0.24)
                    : 'transparent',
                }}
              >
                <AppIcon
                  name={iconName}
                  size={16}
                  color={isActive ? m3.colorScheme.primary : m3.colorScheme.onSurfaceVariant}
                />
                <Text
                  style={[
                    { marginLeft: 8, fontSize: fontSize.sm, fontWeight: '700' },
                    {
                      color: isActive ? m3.colorScheme.primary : m3.colorScheme.onSurfaceVariant,
                    },
                  ]}
                >
                  {label}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
