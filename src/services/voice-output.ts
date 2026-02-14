import * as FileSystem from 'expo-file-system/legacy';
import * as Speech from 'expo-speech';
import type { AssistantTurnResponse } from '@/types/ai';
import type { SupportedLanguageCode } from '@/i18n/languages';

interface PlaybackOptions {
  language: SupportedLanguageCode;
  rate?: number;
  onStateChange?: (isPlaying: boolean) => void;
}

type ExpoAudioModule = {
  Audio: {
    Sound: {
      createAsync: (
        source: { uri: string },
        initialStatus?: { shouldPlay?: boolean; rate?: number },
      ) => Promise<{ sound: ExpoAudioSound }>;
    };
  };
};

type ExpoAudioSound = {
  setOnPlaybackStatusUpdate: (
    listener: (status: { didJustFinish?: boolean; isLoaded?: boolean }) => void,
  ) => void;
  stopAsync: () => Promise<void>;
  unloadAsync: () => Promise<void>;
  playAsync: () => Promise<void>;
};

let AudioModule: ExpoAudioModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  AudioModule = require('expo-av') as ExpoAudioModule;
} catch {
  AudioModule = null;
}

function resolveLocale(language: SupportedLanguageCode): string {
  if (language === 'mr') return 'mr-IN';
  if (language === 'hi') return 'hi-IN';
  return 'en-IN';
}

class VoiceOutputService {
  private activeSound: ExpoAudioSound | null = null;

  private lastMessageText: string | null = null;

  private lastLanguage: SupportedLanguageCode = 'en';

  private lastAudioUri: string | null = null;

  private async playAudioBase64(
    base64Audio: string,
    mimeType: string,
    options: PlaybackOptions,
  ): Promise<boolean> {
    if (!AudioModule?.Audio || !FileSystem.cacheDirectory) {
      return false;
    }

    const extension = mimeType.includes('wav') ? 'wav' : 'mp3';
    const fileUri = `${FileSystem.cacheDirectory}assistant-voice-${Date.now()}.${extension}`;

    await FileSystem.writeAsStringAsync(fileUri, base64Audio, {
      encoding: FileSystem.EncodingType.Base64,
    });

    await this.stop();
    const { sound } = await AudioModule.Audio.Sound.createAsync(
      { uri: fileUri },
      {
        shouldPlay: true,
        rate: options.rate ?? 1,
      },
    );

    this.activeSound = sound;
    this.lastAudioUri = fileUri;

    options.onStateChange?.(true);

    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.didJustFinish || status.isLoaded === false) {
        options.onStateChange?.(false);
      }
    });

    return true;
  }

  async playAssistantTurn(
    response: AssistantTurnResponse,
    options: PlaybackOptions,
  ): Promise<void> {
    const text = response.message.content?.trim();
    this.lastLanguage = options.language;
    this.lastMessageText = text || null;

    try {
      const audio = response.message.audio;
      if (audio?.base64) {
        const played = await this.playAudioBase64(
          audio.base64,
          audio.mimeType ?? 'audio/mpeg',
          options,
        );
        if (played) {
          return;
        }
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
    const rate = options?.rate ?? 0.9;

    if (this.lastAudioUri && AudioModule?.Audio) {
      try {
        await this.stop();
        const { sound } = await AudioModule.Audio.Sound.createAsync(
          { uri: this.lastAudioUri },
          { shouldPlay: true, rate },
        );
        this.activeSound = sound;
        options?.onStateChange?.(true);
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.didJustFinish || status.isLoaded === false) {
            options?.onStateChange?.(false);
          }
        });
        return;
      } catch {
        // Fall through to Speech replay.
      }
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

    if (!this.activeSound) return;

    try {
      await this.activeSound.stopAsync();
    } catch {
      // no-op
    }

    try {
      await this.activeSound.unloadAsync();
    } catch {
      // no-op
    }

    this.activeSound = null;
  }
}

export const voiceOutputService = new VoiceOutputService();
