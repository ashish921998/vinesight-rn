import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
import { useM3 } from '@/styles/use-theme';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { useTranslation } from 'react-i18next';

const SHEET_INITIAL_OFFSET = 400;

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

  const [modalVisible, setModalVisible] = useState(false);
  const [pendingAction, setPendingAction] = useState<ActionId | null>(null);

  const slideAnimRef = useRef(new Animated.Value(SHEET_INITIAL_OFFSET));
  const backdropAnimRef = useRef(new Animated.Value(0));
  const visibleRef = useRef(visible);
  const animationRunIdRef = useRef(0);

  useEffect(() => {
    visibleRef.current = visible;
    const runId = ++animationRunIdRef.current;

    if (visible) {
      setModalVisible(true);
      Animated.parallel([
        Animated.spring(slideAnimRef.current, {
          toValue: 0,
          tension: 65,
          friction: 11,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnimRef.current, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnimRef.current, {
          toValue: SHEET_INITIAL_OFFSET,
          duration: 220,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnimRef.current, {
          toValue: 0,
          duration: 200,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(() => {
        if (runId === animationRunIdRef.current && !visibleRef.current) {
          setModalVisible(false);
        }
      });
    }
  }, [visible]);

  useEffect(() => {
    if (modalVisible || pendingAction === null) return;

    if (pendingAction === 'add_soil') {
      onAddSoilTest();
    } else if (pendingAction === 'add_petiole') {
      onAddPetioleTest();
    }

    setPendingAction(null);
  }, [modalVisible, onAddPetioleTest, onAddSoilTest, pendingAction]);

  const handleActionPress = (actionId: ActionId) => {
    setPendingAction(actionId);
    onClose();
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
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          {
            backgroundColor: 'rgba(0,0,0,0.5)',
            // eslint-disable-next-line react-hooks/refs
            opacity: backdropAnimRef.current,
          },
        ]}
      >
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          // eslint-disable-next-line react-hooks/refs
          transform: [{ translateY: slideAnimRef.current }],
        }}
      >
        <View
          style={{
            backgroundColor: m3.colorScheme.surface,
            borderTopLeftRadius: borderRadius['2xl'],
            borderTopRightRadius: borderRadius['2xl'],
            paddingTop: spacing[2],
            paddingBottom: Math.max(insets.bottom, spacing[6]),
            overflow: 'hidden',
          }}
        >
          <View style={{ alignItems: 'center', paddingBottom: spacing[4] }}>
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.25),
              }}
            />
          </View>

          <Text
            style={{
              fontSize: fontSize.xs,
              fontWeight: fontWeight.semibold,
              color: m3.colorScheme.onSurfaceVariant,
              letterSpacing: 0.8,
              textTransform: 'uppercase',
              paddingHorizontal: spacing[5],
              marginBottom: spacing[3],
            }}
          >
            {t('labTests.actions.title')}
          </Text>

          <View style={{ paddingHorizontal: spacing[3], gap: spacing[2] }}>
            {actions.map((action) => (
              <Pressable
                key={action.id}
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

          <View
            style={{
              height: 1,
              backgroundColor: colorWithOpacity(m3.colorScheme.outlineVariant, 0.5),
              marginHorizontal: spacing[4],
              marginTop: spacing[3],
              marginBottom: spacing[2],
            }}
          />

          <Pressable
            onPress={onClose}
            style={({ pressed }) => ({
              marginHorizontal: spacing[3],
              paddingVertical: spacing[4],
              borderRadius: borderRadius.xl,
              alignItems: 'center',
              backgroundColor: pressed
                ? colorWithOpacity(m3.colorScheme.onSurface, 0.06)
                : 'transparent',
            })}
          >
            <Text
              style={{
                fontSize: fontSize.base,
                fontWeight: fontWeight.semibold,
                color: m3.colorScheme.onSurfaceVariant,
              }}
            >
              {t('common.cancel')}
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </Modal>
  );
}
