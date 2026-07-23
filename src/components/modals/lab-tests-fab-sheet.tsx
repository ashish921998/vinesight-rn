import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheet } from '@expo/ui/community/bottom-sheet';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
import { SheetHeader } from '@/components/ui/sheet-header';
import { useM3 } from '@/styles/use-theme';
import { borderRadius, fontSize, fontWeight, spacing } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { useTranslation } from 'react-i18next';

type ActionId = 'add_soil' | 'add_petiole';

interface Action {
  id: ActionId;
  label: string;
  description: string;
  icon: string;
  color: string;
  bgColor: string;
  onPress: () => void;
}

interface LabTestsFabSheetProps {
  visible: boolean;
  onClose: () => void;
  onAddSoilTest: () => void;
  onAddPetioleTest: () => void;
}

export function LabTestsFabSheet({
  visible,
  onClose,
  onAddSoilTest,
  onAddPetioleTest,
}: LabTestsFabSheetProps) {
  const { t } = useTranslation();
  const m3 = useM3();
  const insets = useSafeAreaInsets();

  // Defer navigation until the sheet has finished closing so the action screen
  // doesn't mount behind a still-visible sheet.
  const [pendingAction, setPendingAction] = useState<ActionId | null>(null);

  const handleActionPress = (actionId: ActionId) => {
    setPendingAction(actionId);
    onClose();
  };

  const handleSheetClose = () => {
    onClose();
    if (pendingAction === 'add_soil') {
      onAddSoilTest();
    } else if (pendingAction === 'add_petiole') {
      onAddPetioleTest();
    }
    setPendingAction(null);
  };

  const soilColor = m3.colorScheme.primary;
  const petioleColor = m3.colorScheme.tertiary || m3.colorScheme.secondary || soilColor;

  const actions: Action[] = [
    {
      id: 'add_soil',
      label: t('labTests.actions.addSoilTest'),
      description: t('labTests.actions.addSoilTestDesc'),
      icon: 'square.stack.3d.up.fill',
      color: soilColor,
      bgColor: colorWithOpacity(soilColor, 0.1),
      onPress: () => handleActionPress('add_soil'),
    },
    {
      id: 'add_petiole',
      label: t('labTests.actions.addPetioleTest'),
      description: t('labTests.actions.addPetioleTestDesc'),
      icon: 'leaf.fill',
      color: petioleColor,
      bgColor: colorWithOpacity(petioleColor, 0.1),
      onPress: () => handleActionPress('add_petiole'),
    },
  ];

  return (
    <BottomSheet
      index={visible ? 0 : -1}
      enableDynamicSizing
      enablePanDownToClose
      onClose={handleSheetClose}
      backgroundStyle={{ backgroundColor: m3.colorScheme.surface }}
    >
      <View style={{ paddingBottom: Math.max(insets.bottom, spacing[6]) }}>
        <SheetHeader title={t('labTests.actions.title')} />

        <View style={{ paddingHorizontal: spacing[3], gap: spacing[2] }}>
          {actions.map((action) => (
            <Pressable
              key={action.id}
              testID={`fab-action-${action.id}`}
              onPress={action.onPress}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing[4],
                paddingVertical: spacing[4],
                paddingHorizontal: spacing[4],
                borderRadius: borderRadius.xl,
                backgroundColor: pressed
                  ? colorWithOpacity(m3.colorScheme.onSurface, 0.06)
                  : 'transparent',
              })}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: borderRadius.full,
                  backgroundColor: action.bgColor,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <UiSymbol name={action.icon} size={22} color={action.color} />
              </View>

              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: fontSize.base,
                    fontWeight: fontWeight.semibold,
                    color: m3.colorScheme.onSurface,
                    marginBottom: 2,
                  }}
                >
                  {action.label}
                </Text>
                <Text
                  style={{
                    fontSize: fontSize.sm,
                    color: m3.colorScheme.onSurfaceVariant,
                    lineHeight: 18,
                  }}
                >
                  {action.description}
                </Text>
              </View>

              <UiSymbol
                name="chevron.right"
                size={14}
                color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.4)}
              />
            </Pressable>
          ))}
        </View>
      </View>
    </BottomSheet>
  );
}
