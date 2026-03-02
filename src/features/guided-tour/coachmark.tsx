import React, { useEffect, useMemo, useState } from 'react';
import {
  Animated,
  Easing,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { telemetry } from '@/services/telemetry';
import { colorWithOpacity } from '@/utils/color';
import type { GuidedTourTargetRect } from './targets';
import { GUIDED_TOUR_TARGET_IDS, type GuidedTourTargetId } from './constants';
import type { GuidedTourStep } from './types';

interface Props {
  step: GuidedTourStep;
  rect: GuidedTourTargetRect;
  targetId?: GuidedTourTargetId | null;
  onSkip: () => void;
  message?: string;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  actionLabel?: string;
  onAction?: () => void;
  blockOutsideTouches?: boolean;
  tooltipPlacement?: 'auto' | 'top';
  tooltipOffsetY?: number;
  focusPadding?: number;
}

export function GuidedTourCoachmark({
  step,
  rect,
  targetId,
  onSkip,
  message,
  secondaryActionLabel,
  onSecondaryAction,
  actionLabel,
  onAction,
  blockOutsideTouches = true,
  tooltipPlacement = 'auto',
  tooltipOffsetY = 0,
  focusPadding = 4,
}: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const overlayRef = React.useRef<View | null>(null);
  const [overlayOrigin, setOverlayOrigin] = React.useState({ x: 0, y: 0 });
  const [keyboardHeight, setKeyboardHeight] = React.useState(0);
  const pulse = useMemo(() => new Animated.Value(0), []);
  const reveal = useMemo(() => new Animated.Value(0), []);
  const lastClampKeyRef = React.useRef<string | null>(null);
  const [measuredTooltipHeight, setMeasuredTooltipHeight] = useState<number | null>(null);
  const [measuredContentKey, setMeasuredContentKey] = useState<string>('');

  const currentContentKey = useMemo(
    () =>
      JSON.stringify({
        message,
        step,
        actionLabel,
        secondaryActionLabel,
        tooltipPlacement,
      }),
    [message, step, actionLabel, secondaryActionLabel, tooltipPlacement],
  );

  useEffect(() => {
    Animated.timing(reveal, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reveal]);

  useEffect(() => {
    const onShow = (event: { endCoordinates?: { height?: number } }) =>
      setKeyboardHeight(event.endCoordinates?.height ?? 0);
    const onChange = (event: { endCoordinates?: { height?: number } }) =>
      setKeyboardHeight(event.endCoordinates?.height ?? 0);
    const onHide = () => setKeyboardHeight(0);
    const showSub = Keyboard.addListener('keyboardDidShow', onShow);
    const hideSub = Keyboard.addListener('keyboardDidHide', onHide);
    const frameSub = Keyboard.addListener('keyboardDidChangeFrame', onChange);
    return () => {
      showSub.remove();
      hideSub.remove();
      frameSub.remove();
    };
  }, []);

  const handleOverlayLayout = React.useCallback(() => {
    requestAnimationFrame(() => {
      overlayRef.current?.measureInWindow((x, y) => {
        if (Number.isFinite(x) && Number.isFinite(y)) {
          setOverlayOrigin({ x, y });
        }
      });
    });
  }, []);

  const defer = (fn: () => void) => setTimeout(fn, 0);
  const label =
    message ?? (step === 'add_farm' ? t('guidedTour.step1.coach') : t('guidedTour.step2.coach'));
  const progressLabel = step === 'add_farm' ? '1 / 2' : '2 / 2';
  const isNonBlocking = !blockOutsideTouches;
  const hasCoachActions = Boolean(actionLabel || secondaryActionLabel);
  const copyLines = label
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const primaryLine = copyLines[0] ?? label;
  const secondaryLine = copyLines.slice(1).join(' ');
  const hasMultiLineMessage = copyLines.length > 1;
  // Fall back to a conservative estimate until onLayout gives us the real height.
  // The reveal animation (260ms fade-in) ensures the tooltip is invisible while
  // the first layout fires, so there is no visible jump on either platform.
  // Only use cached height if content hasn't changed since measurement.
  const TOOLTIP_HEIGHT_ESTIMATE =
    currentContentKey === measuredContentKey
      ? (measuredTooltipHeight ?? (hasCoachActions ? 260 : hasMultiLineMessage ? 170 : 130))
      : hasCoachActions
        ? 260
        : hasMultiLineMessage
          ? 170
          : 130;
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const keyboardBottomInset = Math.max(0, keyboardHeight - insets.bottom);
  const rectY = rect.y - overlayOrigin.y;
  const rectX = rect.x - overlayOrigin.x;
  const isLowerScreenTarget = rectY > screenHeight * 0.55;
  const preferAboveTarget = keyboardBottomInset > 0 && isLowerScreenTarget;
  const belowTop = rectY + rect.height + spacing[4];
  const aboveTop = rectY - TOOLTIP_HEIGHT_ESTIMATE - spacing[4];
  const autoTooltipTop = preferAboveTarget
    ? Math.max(spacing[4], aboveTop)
    : belowTop + TOOLTIP_HEIGHT_ESTIMATE + spacing[16] <= screenHeight - keyboardBottomInset
      ? belowTop
      : Math.max(spacing[4], aboveTop);
  const desiredTooltipTop =
    (tooltipPlacement === 'top' ? spacing[20] : autoTooltipTop) + tooltipOffsetY;
  const tooltipLeft = Math.max(spacing[4], Math.min(rectX, screenWidth - 286));
  const tooltipMaxWidth =
    tooltipPlacement === 'top'
      ? Math.max(286, screenWidth - spacing[8])
      : Math.max(240, screenWidth - tooltipLeft - spacing[4]);
  // If the target is roughly square (e.g. a circular FAB) use a full circle ring;
  // otherwise fall back to the themed rounded-rect radii.
  const forceRectTarget =
    targetId === GUIDED_TOUR_TARGET_IDS.ADD_LOG_ADD_ENTRY ||
    targetId === GUIDED_TOUR_TARGET_IDS.ADD_LOG_SAVE;
  const isCircularTarget = !forceRectTarget && Math.abs(rect.width - rect.height) < 8;
  const innerRingRadius = isCircularTarget ? borderRadius.full : borderRadius.xl;
  const outerRingRadius = isCircularTarget ? borderRadius.full : borderRadius['2xl'];
  const accentColor = step === 'add_farm' ? '#2FA36D' : '#4A86E8';
  const gradientColors: [string, string] =
    step === 'add_farm' ? ['#195A3A', '#2FA36D'] : ['#2D5DB8', '#4A86E8'];

  const bubbleOpacity = reveal.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const bubbleTranslateY = reveal.interpolate({
    inputRange: [0, 1],
    outputRange: [10, 0],
  });
  const ringScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.1],
  });
  const ringOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.16],
  });

  const SKIP_CHIP_HEIGHT = 44;
  const SKIP_TOP = insets.top + spacing[2];
  const TOOLTIP_TOP_CLEARANCE = SKIP_TOP + SKIP_CHIP_HEIGHT + spacing[3];
  const TOOLTIP_BOTTOM_CLEARANCE = Math.max(insets.bottom, spacing[3]) + keyboardBottomInset + 4;
  const MAX_BUBBLE_TOP = Math.max(
    TOOLTIP_TOP_CLEARANCE,
    screenHeight - TOOLTIP_HEIGHT_ESTIMATE - TOOLTIP_BOTTOM_CLEARANCE,
  );
  const bubbleTop = Math.max(TOOLTIP_TOP_CLEARANCE, Math.min(desiredTooltipTop, MAX_BUBBLE_TOP));
  const bubbleLeft = tooltipPlacement === 'top' ? spacing[4] : tooltipLeft;
  const bubbleRight = spacing[4];
  const bubbleWidth = Math.min(tooltipMaxWidth, screenWidth - bubbleLeft - bubbleRight);
  const bubblePointsDown = bubbleTop < rectY;
  const targetCenterX = rectX + rect.width / 2;
  const pointerLeft = Math.max(18, Math.min(bubbleWidth - 30, targetCenterX - bubbleLeft - 10));
  const showPointer =
    targetCenterX >= bubbleLeft + 8 && targetCenterX <= bubbleLeft + bubbleWidth - 8;
  const showTapHint = step === 'add_farm' || step === 'add_log';

  useEffect(() => {
    if (Math.abs(bubbleTop - desiredTooltipTop) < 1) return;
    const clampKey = `${step}:${Math.round(rect.x)}:${Math.round(rect.y)}:${Math.round(desiredTooltipTop)}:${Math.round(bubbleTop)}:${Math.round(keyboardBottomInset)}`;
    if (lastClampKeyRef.current === clampKey) return;
    lastClampKeyRef.current = clampKey;
    telemetry.capture('tour_bubble_clamped', {
      step,
      desiredTop: Math.round(desiredTooltipTop),
      clampedTop: Math.round(bubbleTop),
      keyboardInset: Math.round(keyboardBottomInset),
    });
  }, [bubbleTop, desiredTooltipTop, keyboardBottomInset, rect.x, rect.y, step]);

  const overlayPointerEvents: 'auto' | 'none' = blockOutsideTouches ? 'auto' : 'none';
  const overlayOpacity = blockOutsideTouches
    ? step === 'add_log'
      ? 0.68
      : 0.76
    : step === 'add_log'
      ? 0.4
      : 0.46;
  const focusInsetX = focusPadding;
  const focusInsetY = focusPadding;

  return (
    <View
      ref={overlayRef}
      onLayout={handleOverlayLayout}
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
    >
      <>
        <View
          pointerEvents={overlayPointerEvents}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: Math.max(0, rectY - focusInsetY),
            backgroundColor: colorWithOpacity('#000', overlayOpacity),
          }}
        />
        <View
          pointerEvents={overlayPointerEvents}
          style={{
            position: 'absolute',
            top: Math.max(0, rectY - focusInsetY),
            left: 0,
            width: Math.max(0, rectX - focusInsetX),
            height: rect.height + focusInsetY * 2,
            backgroundColor: colorWithOpacity('#000', overlayOpacity),
          }}
        />
        <View
          pointerEvents={overlayPointerEvents}
          style={{
            position: 'absolute',
            top: Math.max(0, rectY - focusInsetY),
            left: rectX + rect.width + focusInsetX,
            right: 0,
            height: rect.height + focusInsetY * 2,
            backgroundColor: colorWithOpacity('#000', overlayOpacity),
          }}
        />
        <View
          pointerEvents={overlayPointerEvents}
          style={{
            position: 'absolute',
            top: rectY + rect.height + focusInsetY,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: colorWithOpacity('#000', overlayOpacity),
          }}
        />
      </>

      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: rectX - (focusInsetX + 8),
          top: rectY - (focusInsetY + 8),
          width: rect.width + (focusInsetX + 8) * 2,
          height: rect.height + (focusInsetY + 8) * 2,
          borderRadius: outerRingRadius,
          borderWidth: 2,
          borderColor: colorWithOpacity(accentColor, 0.55),
          transform: [{ scale: ringScale }],
          opacity: ringOpacity,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: rectX - focusInsetX,
          top: rectY - focusInsetY,
          width: rect.width + focusInsetX * 2,
          height: rect.height + focusInsetY * 2,
          borderRadius: innerRingRadius,
          borderWidth: 2.5,
          borderColor: accentColor,
          backgroundColor: 'transparent',
          shadowColor: accentColor,
          shadowOpacity: Platform.OS === 'android' ? 0 : 0.36,
          shadowRadius: Platform.OS === 'android' ? 0 : 16,
          shadowOffset: { width: 0, height: Platform.OS === 'android' ? 0 : 8 },
          elevation: Platform.OS === 'android' ? 0 : 5,
        }}
      />

      <Animated.View
        pointerEvents="auto"
        style={{
          position: 'absolute',
          top: bubbleTop,
          left: bubbleLeft,
          right: bubbleRight,
          width: bubbleWidth,
          maxWidth: tooltipMaxWidth,
          borderRadius: borderRadius.xl,
          overflow: 'visible',
          opacity: bubbleOpacity,
          transform: [{ translateY: bubbleTranslateY }],
        }}
      >
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            if (h > 0) {
              setMeasuredContentKey(currentContentKey);
              setMeasuredTooltipHeight(h);
            }
          }}
          style={{
            borderRadius: borderRadius.xl,
            borderWidth: 1,
            borderColor: colorWithOpacity('#FFFFFF', 0.16),
            padding: spacing[4],
            shadowColor: '#000',
            shadowOpacity: 0.3,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 8 },
            elevation: 6,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing[2] }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2], flex: 1 }}>
              <UiSymbol name="sparkles" size={14} color="#FFFFFF" />
              <Text
                style={{ color: '#FFFFFF', fontSize: fontSize.sm, fontWeight: fontWeight.semibold }}
              >
                {t('coachmark.title', 'Guided tour')}
              </Text>
            </View>
            <Text
              style={{
                color: colorWithOpacity('#FFFFFF', 0.9),
                fontSize: fontSize.xs,
                fontWeight: fontWeight.semibold,
              }}
            >
              {progressLabel}
            </Text>
          </View>

          <Text
            style={{
              color: '#FFFFFF',
              fontSize: fontSize.base,
              fontWeight: fontWeight.semibold,
              lineHeight: 24,
            }}
          >
            {primaryLine}
          </Text>
          {secondaryLine ? (
            <Text
              style={{
                color: colorWithOpacity('#FFFFFF', 0.9),
                fontSize: fontSize.base,
                fontWeight: fontWeight.medium,
                lineHeight: 24,
                marginTop: spacing[1],
              }}
            >
              {secondaryLine}
            </Text>
          ) : null}

          {showTapHint ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing[2],
                marginTop: spacing[3],
              }}
            >
              <UiSymbol name="hand.tap.fill" size={13} color={colorWithOpacity('#FFFFFF', 0.9)} />
              <Text
                style={{
                  color: colorWithOpacity('#FFFFFF', 0.86),
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.medium,
                }}
              >
                {t('coachmark.tapToContinue', 'Tap the highlighted area to continue')}
              </Text>
            </View>
          ) : null}

          {(secondaryActionLabel && onSecondaryAction) || (actionLabel && onAction) ? (
            <View
              style={{
                marginTop: spacing[3],
                flexDirection: 'row',
                justifyContent: 'flex-end',
                gap: spacing[2],
              }}
            >
              {secondaryActionLabel && onSecondaryAction ? (
                <Pressable
                  onPress={() => defer(onSecondaryAction)}
                  style={{
                    paddingHorizontal: spacing[4],
                    paddingVertical: spacing[2],
                    borderRadius: borderRadius.full,
                    borderWidth: 1,
                    borderColor: colorWithOpacity('#FFFFFF', 0.42),
                    backgroundColor: colorWithOpacity('#FFFFFF', 0.14),
                  }}
                >
                  <Text
                    style={{
                      color: '#FFFFFF',
                      fontSize: fontSize.sm,
                      fontWeight: fontWeight.semibold,
                    }}
                  >
                    {secondaryActionLabel}
                  </Text>
                </Pressable>
              ) : null}
              {actionLabel && onAction ? (
                <Pressable
                  onPress={() => defer(onAction)}
                  style={{
                    paddingHorizontal: spacing[4],
                    paddingVertical: spacing[2],
                    borderRadius: borderRadius.full,
                    backgroundColor: '#FFFFFF',
                  }}
                >
                  <Text
                    style={{
                      color: accentColor,
                      fontSize: fontSize.sm,
                      fontWeight: fontWeight.semibold,
                    }}
                  >
                    {actionLabel}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </LinearGradient>

        {showPointer ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: pointerLeft,
              ...(bubblePointsDown ? { bottom: -12 } : { top: -12 }),
              width: 0,
              height: 0,
              borderLeftWidth: 10,
              borderRightWidth: 10,
              ...(bubblePointsDown
                ? {
                    borderTopWidth: 12,
                    borderTopColor: gradientColors[1],
                    borderLeftColor: 'transparent',
                    borderRightColor: 'transparent',
                    borderBottomWidth: 0,
                    borderBottomColor: 'transparent',
                  }
                : {
                    borderBottomWidth: 12,
                    borderBottomColor: gradientColors[0],
                    borderLeftColor: 'transparent',
                    borderRightColor: 'transparent',
                    borderTopWidth: 0,
                    borderTopColor: 'transparent',
                  }),
            }}
          />
        ) : null}
      </Animated.View>

      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          right: spacing[4],
          zIndex: 2,
          top: SKIP_TOP,
        }}
      >
        <Pressable
          onPress={() => defer(onSkip)}
          style={{
            paddingHorizontal: spacing[4],
            paddingVertical: spacing[2],
            borderRadius: borderRadius.full,
            backgroundColor: colorWithOpacity('#111', isNonBlocking ? 0.66 : 0.82),
            borderWidth: 1,
            borderColor: colorWithOpacity('#FFF', 0.24),
            shadowColor: '#000',
            shadowOpacity: 0.26,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 6 },
            elevation: 3,
          }}
        >
          <Text style={{ color: '#FFF', fontWeight: fontWeight.semibold }}>
            {t('guidedTour.cta.skipTour')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
