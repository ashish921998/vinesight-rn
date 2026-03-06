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
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { useIsDark, useM3 } from '@/styles/use-theme';
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
  /** Optional rich JSX rendered below the message text. */
  messageNode?: React.ReactNode;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  actionLabel?: string;
  onAction?: () => void;
  blockOutsideTouches?: boolean;
  tooltipPlacement?: 'auto' | 'top';
  tooltipOffsetY?: number;
  focusPadding?: number;
  /** Extra pixels to shift the skip chip downward. */
  skipTopOffset?: number;
  /** Hides the "Tap the highlighted area to continue" instruction. */
  hideTapHint?: boolean;
  /** Renders the Skip button inside the tooltip bubble (bottom-left)
   *  instead of the floating top-right chip. */
  inlineSkip?: boolean;
  /** Custom progress label (e.g., "2 / 4"). Defaults to "1 / 2" or "2 / 2" based on step. */
  progressLabel?: string;
  /** Compact bubble layout for constrained flows. */
  compact?: boolean;
  /** Hides bubble pointer triangle. */
  hidePointer?: boolean;
  /** Hides bubble entirely (skip chip can still remain visible). */
  hideBubble?: boolean;
  /** Hides focus ring around highlighted target. */
  hideFocus?: boolean;
  /** Hides dimmed scrim around target. */
  hideDimming?: boolean;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ScrimOverlay({
  rect,
  focusPadding,
  overlayOpacity,
  blockOutsideTouches,
  hideDimming,
  screenWidth,
  screenHeight,
}: {
  rect: GuidedTourTargetRect;
  focusPadding: number;
  overlayOpacity: number;
  blockOutsideTouches: boolean;
  hideDimming: boolean;
  screenWidth: number;
  screenHeight: number;
}) {
  const cutL = Math.max(0, rect.x - focusPadding);
  const cutT = Math.max(0, rect.y - focusPadding);
  const cutR = Math.min(screenWidth, rect.x + rect.width + focusPadding);
  const cutB = Math.min(screenHeight, rect.y + rect.height + focusPadding);
  const dimColor = hideDimming ? 'transparent' : colorWithOpacity('#000', overlayOpacity);
  const pointerMode = blockOutsideTouches ? ('auto' as const) : ('none' as const);
  const captureProps = blockOutsideTouches
    ? {
        onStartShouldSetResponder: () => true,
        onMoveShouldSetResponder: () => true,
        onResponderTerminationRequest: () => false,
      }
    : {};

  return (
    <>
      {/* Top scrim */}
      <View
        pointerEvents={pointerMode}
        {...captureProps}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: Math.max(0, cutT),
          backgroundColor: dimColor,
        }}
      />
      {/* Bottom scrim */}
      <View
        pointerEvents={pointerMode}
        {...captureProps}
        style={{
          position: 'absolute',
          top: cutB,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: dimColor,
        }}
      />
      {/* Left scrim */}
      <View
        pointerEvents={pointerMode}
        {...captureProps}
        style={{
          position: 'absolute',
          top: cutT,
          left: 0,
          width: Math.max(0, cutL),
          height: Math.max(0, cutB - cutT),
          backgroundColor: dimColor,
        }}
      />
      {/* Right scrim */}
      <View
        pointerEvents={pointerMode}
        {...captureProps}
        style={{
          position: 'absolute',
          top: cutT,
          left: cutR,
          right: 0,
          height: Math.max(0, cutB - cutT),
          backgroundColor: dimColor,
        }}
      />
    </>
  );
}

function FocusRing({
  rect,
  focusPadding,
  accentColor,
  ringScale,
  ringOpacity,
  isCircularTarget,
}: {
  rect: GuidedTourTargetRect;
  focusPadding: number;
  accentColor: string;
  ringScale: Animated.AnimatedInterpolation<number>;
  ringOpacity: Animated.AnimatedInterpolation<number>;
  isCircularTarget: boolean;
}) {
  const innerRingRadius = isCircularTarget ? borderRadius.full : borderRadius.xl;
  const outerRingRadius = isCircularTarget ? borderRadius.full : borderRadius['2xl'];
  const haloInset = focusPadding + 12;

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: rect.x - haloInset,
          top: rect.y - haloInset,
          width: rect.width + haloInset * 2,
          height: rect.height + haloInset * 2,
          borderRadius: outerRingRadius,
          backgroundColor: colorWithOpacity(accentColor, 0.08),
          borderWidth: 1.5,
          borderColor: colorWithOpacity(accentColor, 0.22),
          transform: [{ scale: ringScale }],
          opacity: ringOpacity,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: rect.x - focusPadding,
          top: rect.y - focusPadding,
          width: rect.width + focusPadding * 2,
          height: rect.height + focusPadding * 2,
          borderRadius: innerRingRadius,
          borderWidth: 2,
          borderColor: accentColor,
          backgroundColor: 'transparent',
          shadowColor: accentColor,
          shadowOpacity: Platform.OS === 'android' ? 0 : 0.14,
          shadowRadius: Platform.OS === 'android' ? 0 : 14,
          shadowOffset: { width: 0, height: Platform.OS === 'android' ? 0 : 6 },
          elevation: Platform.OS === 'android' ? 3 : 0,
        }}
      />
    </>
  );
}

function PointerDiamond({
  pointerLeft,
  bubblePointsDown,
  bubbleWidth,
  fillColor,
  borderColor,
}: {
  pointerLeft: number;
  bubblePointsDown: boolean;
  bubbleWidth: number;
  fillColor: string;
  borderColor: string;
}) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: Math.max(14, Math.min(bubbleWidth - 28, pointerLeft + 2)),
        ...(bubblePointsDown ? { bottom: -7 } : { top: -7 }),
        width: 14,
        height: 14,
        backgroundColor: fillColor,
        borderLeftWidth: 1,
        borderTopWidth: 1,
        borderColor,
        transform: [{ rotate: '45deg' }],
      }}
    />
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function GuidedTourCoachmark({
  step,
  rect,
  targetId,
  onSkip,
  message,
  messageNode,
  secondaryActionLabel,
  onSecondaryAction,
  actionLabel,
  onAction,
  blockOutsideTouches = true,
  tooltipPlacement = 'auto',
  tooltipOffsetY = 0,
  focusPadding = 4,
  skipTopOffset = 0,
  hideTapHint = true,
  inlineSkip = false,
  progressLabel: customProgressLabel,
  compact = false,
  hidePointer = false,
  hideBubble = false,
  hideFocus = false,
  hideDimming = false,
}: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const m3 = useM3();
  const isDark = useIsDark();
  const [keyboardHeight, setKeyboardHeight] = React.useState(0);
  const pulse = useMemo(() => new Animated.Value(0), []);
  const reveal = useMemo(() => new Animated.Value(0), []);
  const lastClampKeyRef = React.useRef<string | null>(null);
  const [measuredTooltipHeight, setMeasuredTooltipHeight] = useState<number | null>(null);

  useEffect(() => {
    Animated.timing(reveal, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    if (Platform.OS === 'android') {
      pulse.setValue(0);
      return;
    }

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

  const defer = (fn: () => void) => setTimeout(fn, 0);
  const label =
    message ?? (step === 'add_farm' ? t('guidedTour.step1.coach') : t('guidedTour.step2.coach'));
  const progressLabel = customProgressLabel ?? (step === 'add_farm' ? '1 / 2' : '2 / 2');
  const isNonBlocking = !blockOutsideTouches;
  const hasCoachActions = Boolean(actionLabel || secondaryActionLabel);
  const hasActionRow = hasCoachActions || inlineSkip;
  const copyLines = label
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const primaryLine = copyLines[0] ?? label;
  const secondaryLine = copyLines.slice(1).join(' ');
  const hasMultiLineMessage = copyLines.length > 1;

  // Use measured height when available; otherwise fall back to a conservative
  // estimate for the first render. The reveal animation (260ms fade-in) keeps
  // the tooltip invisible while the first onLayout fires, so there's no jump.
  const TOOLTIP_FALLBACK_HEIGHT = compact
    ? 96
    : hasActionRow
      ? 184
      : hasMultiLineMessage
        ? 136
        : 102;
  const tooltipHeight = measuredTooltipHeight ?? TOOLTIP_FALLBACK_HEIGHT;

  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const keyboardBottomInset = Math.max(0, keyboardHeight - insets.bottom);
  const rectY = rect.y;
  const rectX = rect.x;
  const isLowerScreenTarget = rectY > screenHeight * 0.55;
  const preferAboveTarget = keyboardBottomInset > 0 && isLowerScreenTarget;
  const belowTop = rectY + rect.height + spacing[4];
  const aboveTop = rectY - tooltipHeight - spacing[4];
  const autoTooltipTop = preferAboveTarget
    ? Math.max(spacing[4], aboveTop)
    : belowTop + tooltipHeight + spacing[16] <= screenHeight - keyboardBottomInset
      ? belowTop
      : Math.max(spacing[4], aboveTop);
  const desiredTooltipTop =
    (tooltipPlacement === 'top' ? spacing[20] : autoTooltipTop) + tooltipOffsetY;
  const tooltipLeft = Math.max(spacing[4], Math.min(rectX - spacing[1], screenWidth - 320));
  const tooltipMaxWidth =
    tooltipPlacement === 'top'
      ? Math.max(300, screenWidth - spacing[8])
      : Math.max(252, screenWidth - tooltipLeft - spacing[4]);

  const forceRectTarget =
    targetId === GUIDED_TOUR_TARGET_IDS.ADD_LOG_ADD_ENTRY ||
    targetId === GUIDED_TOUR_TARGET_IDS.ADD_LOG_SAVE;
  const isCircularTarget = !forceRectTarget && Math.abs(rect.width - rect.height) < 8;
  const accentColor = step === 'add_farm' ? '#2FA36D' : '#4A86E8';
  const bubbleGradientColors: [string, string] = isDark
    ? [m3.surface.surfaceContainerHigh, m3.surface.surfaceContainer]
    : ['#FFFFFF', '#F5FAF7'];
  const bubbleFillColor = isDark ? m3.surface.surfaceContainer : '#FFFFFF';
  const bubbleBorderColor = isDark
    ? colorWithOpacity(m3.colorScheme.outline, 0.4)
    : colorWithOpacity(accentColor, 0.18);
  const primaryTextColor = m3.colorScheme.onSurface;
  const secondaryTextColor = colorWithOpacity(m3.colorScheme.onSurfaceVariant, isDark ? 0.9 : 0.7);
  const tertiaryTextColor = colorWithOpacity(m3.colorScheme.onSurfaceVariant, isDark ? 0.82 : 0.58);

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
    screenHeight - tooltipHeight - TOOLTIP_BOTTOM_CLEARANCE,
  );
  const clampedTop = Math.min(desiredTooltipTop, MAX_BUBBLE_TOP);

  const targetBottom = rectY + rect.height + focusPadding + 8;
  const targetTopEdge = rectY - focusPadding - 8;
  const bubbleBottom = clampedTop + tooltipHeight;
  const overlapsTarget = clampedTop < targetBottom && bubbleBottom > targetTopEdge;
  const preferredAboveTop = targetTopEdge - tooltipHeight - spacing[2];
  const preferredBelowTop = targetBottom + spacing[2];
  const maxAllowedTop = screenHeight - tooltipHeight - TOOLTIP_BOTTOM_CLEARANCE;
  const canFitAbove = preferredAboveTop >= TOOLTIP_TOP_CLEARANCE;
  const canFitBelow = preferredBelowTop <= maxAllowedTop;
  const chosenBubbleTop = overlapsTarget
    ? canFitAbove
      ? preferredAboveTop
      : canFitBelow
        ? preferredBelowTop
        : targetTopEdge - TOOLTIP_TOP_CLEARANCE >=
            screenHeight - targetBottom - TOOLTIP_BOTTOM_CLEARANCE
          ? TOOLTIP_TOP_CLEARANCE
          : maxAllowedTop
    : clampedTop;
  const bubbleTop = Math.max(chosenBubbleTop, TOOLTIP_TOP_CLEARANCE);
  const bubbleLeft = tooltipPlacement === 'top' ? spacing[4] : tooltipLeft;
  const bubbleRight = spacing[4];
  const bubbleWidth = Math.min(tooltipMaxWidth, screenWidth - bubbleLeft - bubbleRight);
  const bubblePointsDown = bubbleTop < rectY;
  const targetCenterX = rectX + rect.width / 2;
  const pointerLeft = Math.max(18, Math.min(bubbleWidth - 30, targetCenterX - bubbleLeft - 10));
  const showPointer =
    !hidePointer &&
    targetCenterX >= bubbleLeft + 12 &&
    targetCenterX <= bubbleLeft + bubbleWidth - 12;
  const showTapHint = step === 'add_farm' || step === 'add_log';

  useEffect(() => {
    if (hideBubble) return;
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
  }, [bubbleTop, desiredTooltipTop, hideBubble, keyboardBottomInset, rect.x, rect.y, step]);

  const overlayOpacity = blockOutsideTouches
    ? step === 'add_log'
      ? 0.52
      : 0.58
    : step === 'add_log'
      ? 0.34
      : 0.38;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* 4-scrim dimming + touch blocking — replaces SVG mask for consistent
          rendering on both platforms without antialiasing artifacts. */}
      <ScrimOverlay
        rect={rect}
        focusPadding={focusPadding}
        overlayOpacity={overlayOpacity}
        blockOutsideTouches={blockOutsideTouches}
        hideDimming={hideDimming}
        screenWidth={screenWidth}
        screenHeight={screenHeight}
      />

      {!hideFocus ? (
        <FocusRing
          rect={rect}
          focusPadding={focusPadding}
          accentColor={accentColor}
          ringScale={ringScale}
          ringOpacity={ringOpacity}
          isCircularTarget={isCircularTarget}
        />
      ) : null}

      {!hideBubble ? (
        <Animated.View
          pointerEvents="auto"
          style={{
            position: 'absolute',
            top: bubbleTop,
            left: bubbleLeft,
            right: bubbleRight,
            width: bubbleWidth,
            maxWidth: tooltipMaxWidth,
            borderRadius: borderRadius['2xl'],
            overflow: 'visible',
            opacity: bubbleOpacity,
            transform: [{ translateY: bubbleTranslateY }],
          }}
        >
          <LinearGradient
            colors={bubbleGradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            onLayout={(e) => {
              const h = e.nativeEvent.layout.height;
              if (h > 0) {
                setMeasuredTooltipHeight((prev) =>
                  prev !== null && Math.abs(prev - h) < 1 ? prev : h,
                );
              }
            }}
            style={{
              borderRadius: borderRadius['2xl'],
              borderWidth: 1,
              borderColor: bubbleBorderColor,
              paddingHorizontal: compact ? spacing[3] : spacing[4],
              paddingTop: compact ? spacing[3] : spacing[4],
              paddingBottom: compact ? spacing[3] : spacing[4],
              shadowColor: '#000',
              shadowOpacity: 0.18,
              shadowRadius: 24,
              shadowOffset: { width: 0, height: 12 },
              elevation: 8,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                marginBottom: compact ? spacing[2] : spacing[3],
              }}
            >
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2], flex: 1 }}
              >
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: borderRadius.full,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colorWithOpacity(accentColor, 0.12),
                  }}
                >
                  <UiSymbol name="sparkles" size={13} color={accentColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: primaryTextColor,
                      fontSize: fontSize.sm,
                      fontWeight: fontWeight.semibold,
                    }}
                  >
                    {t('coachmark.title', 'Guided tour')}
                  </Text>
                  <Text
                    style={{
                      color: tertiaryTextColor,
                      fontSize: fontSize.xs,
                      fontWeight: fontWeight.semibold,
                      marginTop: 2,
                    }}
                  >
                    {progressLabel}
                  </Text>
                </View>
              </View>
              {!inlineSkip ? (
                <Pressable
                  onPress={() => defer(onSkip)}
                  hitSlop={8}
                  style={{
                    paddingHorizontal: spacing[2],
                    paddingVertical: spacing[1],
                    marginLeft: spacing[2],
                  }}
                >
                  <Text
                    style={{
                      color: tertiaryTextColor,
                      fontSize: fontSize.sm,
                      fontWeight: fontWeight.semibold,
                    }}
                  >
                    {t('guidedTour.cta.skipTour', 'Skip tour')}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            <Text
              style={{
                color: primaryTextColor,
                fontSize: compact ? fontSize.lg : fontSize.xl,
                fontWeight: fontWeight.semibold,
                lineHeight: compact ? 26 : 30,
              }}
            >
              {primaryLine}
            </Text>
            {secondaryLine ? (
              <Text
                style={{
                  color: secondaryTextColor,
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.medium,
                  lineHeight: 20,
                  marginTop: spacing[2],
                }}
              >
                {secondaryLine}
              </Text>
            ) : null}

            {/* Optional rich JSX content below message */}
            {messageNode ?? null}

            {showTapHint && !hideTapHint ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing[2],
                  marginTop: spacing[3],
                  paddingVertical: spacing[1],
                }}
              >
                <UiSymbol
                  name="hand.tap.fill"
                  size={12}
                  color={colorWithOpacity(accentColor, 0.92)}
                />
                <Text
                  style={{
                    color: tertiaryTextColor,
                    fontSize: fontSize.xs,
                    fontWeight: fontWeight.medium,
                  }}
                >
                  {t('coachmark.tapToContinue', 'Tap the highlighted area to continue')}
                </Text>
              </View>
            ) : null}

            {(secondaryActionLabel && onSecondaryAction) ||
            (actionLabel && onAction) ||
            inlineSkip ? (
              <View
                style={{
                  marginTop: spacing[3],
                  flexDirection: 'row',
                  justifyContent: inlineSkip ? 'space-between' : 'flex-end',
                  alignItems: 'center',
                  gap: spacing[2],
                }}
              >
                {inlineSkip ? (
                  <Pressable
                    onPress={() => defer(onSkip)}
                    style={{
                      paddingHorizontal: spacing[2],
                      paddingVertical: spacing[1],
                    }}
                  >
                    <Text
                      style={{
                        color: tertiaryTextColor,
                        fontSize: fontSize.sm,
                        fontWeight: fontWeight.semibold,
                      }}
                    >
                      {t('guidedTour.cta.skipTour', 'Skip tour')}
                    </Text>
                  </Pressable>
                ) : null}

                <View style={{ flexDirection: 'row', gap: spacing[2] }}>
                  {secondaryActionLabel && onSecondaryAction ? (
                    <Pressable
                      onPress={() => defer(onSecondaryAction)}
                      style={{
                        paddingHorizontal: spacing[2],
                        paddingVertical: spacing[2],
                        borderRadius: borderRadius.full,
                        minHeight: 40,
                        justifyContent: 'center',
                      }}
                    >
                      <Text
                        style={{
                          color: secondaryTextColor,
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
                        minHeight: 40,
                        justifyContent: 'center',
                        backgroundColor: colorWithOpacity(accentColor, isDark ? 0.18 : 0.12),
                        borderWidth: 1,
                        borderColor: colorWithOpacity(accentColor, isDark ? 0.3 : 0.16),
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
              </View>
            ) : null}
          </LinearGradient>

          {showPointer ? (
            <PointerDiamond
              pointerLeft={pointerLeft}
              bubblePointsDown={bubblePointsDown}
              bubbleWidth={bubbleWidth}
              fillColor={bubbleFillColor}
              borderColor={bubbleBorderColor}
            />
          ) : null}
        </Animated.View>
      ) : null}

      {hideBubble ? (
        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            right: spacing[4],
            zIndex: 2,
            top: SKIP_TOP + skipTopOffset,
          }}
        >
          <Pressable
            onPress={() => defer(onSkip)}
            style={{
              paddingHorizontal: spacing[4],
              paddingVertical: spacing[2],
              borderRadius: borderRadius.full,
              backgroundColor: colorWithOpacity(
                isDark ? m3.surface.surfaceContainerHighest : '#111',
                isDark ? (isNonBlocking ? 0.9 : 0.96) : isNonBlocking ? 0.54 : 0.72,
              ),
              borderWidth: 1,
              borderColor: colorWithOpacity(
                isDark ? m3.colorScheme.outline : '#FFF',
                isDark ? 0.34 : 0.18,
              ),
              shadowColor: '#000',
              shadowOpacity: 0.18,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 8 },
              elevation: 4,
            }}
          >
            <Text
              style={{ color: isDark ? primaryTextColor : '#FFF', fontWeight: fontWeight.semibold }}
            >
              {t('guidedTour.cta.skipTour', 'Skip tour')}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
