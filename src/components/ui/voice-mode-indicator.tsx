import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, ActivityIndicator } from 'react-native';
import { Symbol as UiSymbol } from './symbol';

type VoiceIndicatorState = 'idle' | 'starting' | 'listening' | 'processing' | 'speaking';

interface VoiceModeIndicatorProps {
  state: VoiceIndicatorState;
  size?: number;
  primaryColor: string;
  surfaceColor: string;
  onSurfaceColor: string;
}

export function VoiceModeIndicator({
  state,
  size = 160,
  primaryColor,
  surfaceColor,
  onSurfaceColor,
}: VoiceModeIndicatorProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ring1Anim = useRef(new Animated.Value(0)).current;
  const ring2Anim = useRef(new Animated.Value(0)).current;
  const ring3Anim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (state === 'listening') {
      // Pulsing mic button
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );

      // Concentric expanding rings
      const ringAnimation = (anim: Animated.Value, delay: number) =>
        Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.parallel([
              Animated.timing(anim, {
                toValue: 1,
                duration: 2000,
                easing: Easing.out(Easing.ease),
                useNativeDriver: true,
              }),
            ]),
            Animated.timing(anim, {
              toValue: 0,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
        );

      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      pulse.start();
      ringAnimation(ring1Anim, 0).start();
      ringAnimation(ring2Anim, 666).start();
      ringAnimation(ring3Anim, 1333).start();

      return () => {
        pulse.stop();
        ring1Anim.stopAnimation();
        ring2Anim.stopAnimation();
        ring3Anim.stopAnimation();
        pulseAnim.setValue(1);
        ring1Anim.setValue(0);
        ring2Anim.setValue(0);
        ring3Anim.setValue(0);
      };
    }

    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();

    pulseAnim.setValue(1);
    ring1Anim.setValue(0);
    ring2Anim.setValue(0);
    ring3Anim.setValue(0);

    return undefined;
  }, [state, pulseAnim, ring1Anim, ring2Anim, ring3Anim, fadeAnim]);

  const ringSize = size * 1.8;

  const renderRing = (anim: Animated.Value) => {
    const scale = anim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.6, 1],
    });
    const opacity = anim.interpolate({
      inputRange: [0, 0.3, 1],
      outputRange: [0.5, 0.3, 0],
    });

    return (
      <Animated.View
        style={{
          position: 'absolute',
          width: ringSize,
          height: ringSize,
          borderRadius: ringSize / 2,
          borderWidth: 2,
          borderColor: primaryColor,
          opacity: Animated.multiply(opacity, fadeAnim),
          transform: [{ scale }],
        }}
      />
    );
  };

  const isActive = state === 'listening';
  const isProcessing = state === 'processing' || state === 'starting';
  const isSpeaking = state === 'speaking';

  const backgroundColor = isActive
    ? `${primaryColor}33`
    : isSpeaking
      ? `${primaryColor}22`
      : `${surfaceColor}B3`;

  const borderColor = isActive
    ? `${primaryColor}73`
    : isSpeaking
      ? `${primaryColor}55`
      : `${onSurfaceColor}33`;

  const iconName = isActive
    ? 'mic.fill'
    : isSpeaking
      ? 'speaker.wave.2.fill'
      : 'mic.fill';

  const iconColor = isActive || isSpeaking ? primaryColor : onSurfaceColor;
  const iconSize = size * 0.26;

  return (
    <View
      style={{
        width: ringSize,
        height: ringSize,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {renderRing(ring1Anim)}
      {renderRing(ring2Anim)}
      {renderRing(ring3Anim)}

      <Animated.View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor,
          borderWidth: 2,
          borderColor,
          transform: [{ scale: pulseAnim }],
        }}
      >
        {isProcessing ? (
          <ActivityIndicator size="large" color={primaryColor} />
        ) : (
          <UiSymbol name={iconName} size={iconSize} color={iconColor} />
        )}
      </Animated.View>
    </View>
  );
}
