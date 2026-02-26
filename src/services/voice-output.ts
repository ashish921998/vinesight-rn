import * as FileSystem from 'expo-file-system/legacy';
import * as Speech from 'expo-speech';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';
import type { AssistantTurnResponse } from '@/types/ai';
import type { SupportedLanguageCode } from '@/i18n/languages';

interface PlaybackOptions {
  language: SupportedLanguageCode;
  rate?: number;
  onStateChange?: (isPlaying: boolean) => void;
}

interface PlaybackStatusUpdate {
  didJustFinish?: boolean;
  isLoaded?: boolean;
  playing?: boolean;
}

function resolveLocale(language: SupportedLanguageCode): string {
  if (language === 'mr') return 'mr-IN';
  if (language === 'hi') return 'hi-IN';
  return 'en-IN';
}

class VoiceOutputService {
  private activePlayer: AudioPlayer | null = null;

  private activePlayerSubscription: { remove: () => void } | null = null;

  private lastMessageText: string | null = null;

  private lastLanguage: SupportedLanguageCode = 'en';

  private lastAudioUri: string | null = null;

  private async playAudioUri(fileUri: string, options: PlaybackOptions): Promise<boolean> {
    if (!fileUri) return false;

    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
      interruptionMode: 'duckOthers',
      shouldRouteThroughEarpiece: false,
      shouldPlayInBackground: false,
    });

    await this.stop();
    const player = createAudioPlayer(fileUri);
    player.playbackRate = options.rate ?? 1;
    this.activePlayer = player;
    this.lastAudioUri = fileUri;

    options.onStateChange?.(true);
    this.activePlayerSubscription = player.addListener(
      'playbackStatusUpdate',
      (status: PlaybackStatusUpdate) => {
        if (status.didJustFinish || status.isLoaded === false || !status.playing) {
          options.onStateChange?.(false);
        }
      },
    );
    player.play();

    return true;
  }

  async playAssistantTurn(
    response: AssistantTurnResponse,
    options: PlaybackOptions,
  ): Promise<void> {
    const text = response.message.content?.trim();
    const audio = response.message.audio;
    this.lastLanguage = options.language;
    this.lastMessageText = text || null;

    if (!audio?.base64 && this.lastAudioUri) {
      const staleAudioUri = this.lastAudioUri;
      this.lastAudioUri = null;
      FileSystem.deleteAsync(staleAudioUri).catch((error) => {
        if (__DEV__) console.warn('Failed to delete stale audio file:', error);
      });
    }

    try {
      if (audio?.base64 && FileSystem.cacheDirectory) {
        const oldAudioUri = this.lastAudioUri;
        this.lastAudioUri = null;
        const extension = (audio.mimeType ?? 'audio/mpeg').includes('wav') ? 'wav' : 'mp3';
        const fileUri = `${FileSystem.cacheDirectory}assistant-voice-${Date.now()}.${extension}`;

        await FileSystem.writeAsStringAsync(fileUri, audio.base64, {
          encoding: FileSystem.EncodingType.Base64,
        });

        if (oldAudioUri && oldAudioUri !== fileUri) {
          FileSystem.deleteAsync(oldAudioUri).catch((error) => {
            if (__DEV__) console.warn('Failed to delete old audio file:', error);
          });
        }

        const played = await this.playAudioUri(fileUri, options);
        if (played) return;
      }

      if (text) {
        options.onStateChange?.(true);
        Speech.speak(text, {
          language: resolveLocale(options.language),
          rate: options.rate ?? 0.9,
          onDone: () => options.onStateChange?.(false),
          onStopped: () => options.onStateChange?.(false),
          onError: () => options.onStateChange?.(false),
        });
      }
    } catch {
      options.onStateChange?.(false);
      if (text) {
        Speech.speak(text, {
          language: resolveLocale(options.language),
          rate: options.rate ?? 0.9,
        });
      }
    }
  }

  async replayLast(options?: {
    rate?: number;
    onStateChange?: (isPlaying: boolean) => void;
  }): Promise<void> {
    const rate = options?.rate ?? 1;

    if (this.lastAudioUri) {
      const played = await this.playAudioUri(this.lastAudioUri, {
        language: this.lastLanguage,
        rate,
        onStateChange: options?.onStateChange,
      }).catch(() => false);
      if (played) return;
    }

    const audioUri = this.lastAudioUri;
    this.lastAudioUri = null;
    if (audioUri) {
      FileSystem.deleteAsync(audioUri).catch((error) => {
        if (__DEV__) console.warn('Failed to delete audio file:', error);
      });
    }

    if (this.lastMessageText) {
      options?.onStateChange?.(true);
      Speech.speak(this.lastMessageText, {
        language: resolveLocale(this.lastLanguage),
        rate,
        onDone: () => options?.onStateChange?.(false),
        onStopped: () => options?.onStateChange?.(false),
        onError: () => options?.onStateChange?.(false),
      });
    }
  }

  async stop(): Promise<void> {
    try {
      Speech.stop();
    } catch {
      // no-op
    }

    this.activePlayerSubscription?.remove();
    this.activePlayerSubscription = null;

    if (!this.activePlayer) return;
    try {
      this.activePlayer.pause();
    } catch {
      // no-op
    }
    try {
      this.activePlayer.remove();
    } catch {
      // no-op
    }
    this.activePlayer = null;

    const audioUri = this.lastAudioUri;
    this.lastAudioUri = null;
    if (audioUri) {
      FileSystem.deleteAsync(audioUri).catch((error) => {
        if (__DEV__) console.warn('Failed to delete audio file:', error);
      });
    }
  }
}

export const voiceOutputService = new VoiceOutputService();
