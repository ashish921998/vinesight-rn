import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';

const HAPTIC_INTERVAL_MS = 1200;

class ThinkingFeedbackService {
  private player: AudioPlayer | null = null;
  private hapticTimer: ReturnType<typeof setInterval> | null = null;
  private isActive = false;

  async start(): Promise<void> {
    if (this.isActive) return;
    this.isActive = true;

    try {
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        interruptionMode: 'mixWithOthers',
        shouldRouteThroughEarpiece: false,
        shouldPlayInBackground: false,
      });
    } catch {
      // Non-critical
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const source = require('../../assets/sounds/thinking-tone.mp3');
      const player = createAudioPlayer(source);
      player.loop = true;
      player.volume = 0.4;
      this.player = player;
      player.play();
    } catch {
      if (__DEV__) console.warn('[thinking-feedback] Failed to start audio');
    }

    // Gentle haptic pulse at regular intervals
    this.triggerHaptic();
    this.hapticTimer = setInterval(() => {
      if (this.isActive) this.triggerHaptic();
    }, HAPTIC_INTERVAL_MS);
  }

  stop(): void {
    this.isActive = false;

    if (this.hapticTimer) {
      clearInterval(this.hapticTimer);
      this.hapticTimer = null;
    }

    if (this.player) {
      try {
        this.player.pause();
      } catch {
        // no-op
      }
      try {
        this.player.remove();
      } catch {
        // no-op
      }
      this.player = null;
    }
  }

  private triggerHaptic(): void {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // no-op — haptics not available on all devices
    }
  }
}

export const thinkingFeedback = new ThinkingFeedbackService();
