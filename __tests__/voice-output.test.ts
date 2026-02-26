import { voiceOutputService } from '@/services/voice-output';
import type { AssistantTurnResponse } from '@/types/ai';
import type { SupportedLanguageCode } from '@/i18n/languages';

type PlaybackStatusListener = (status: { didJustFinish?: boolean; isLoaded?: boolean }) => void;

const mockDeleteAsync = jest.fn().mockResolvedValue(undefined);
const mockWriteAsStringAsync = jest.fn().mockResolvedValue(undefined);
const mockSetAudioModeAsync = jest.fn().mockResolvedValue(undefined);
const mockCreateAudioPlayer = jest.fn();
const mockSpeechSpeak = jest.fn();
const mockSpeechStop = jest.fn();

jest.mock(
  'expo-file-system/legacy',
  () => ({
    cacheDirectory: '/tmp/',
    deleteAsync: (...args: unknown[]) => mockDeleteAsync(...args),
    writeAsStringAsync: (...args: unknown[]) => mockWriteAsStringAsync(...args),
    EncodingType: { Base64: 'base64' },
  }),
  { virtual: true },
);

jest.mock('expo-speech', () => ({
  speak: (...args: unknown[]) => mockSpeechSpeak(...args),
  stop: (...args: unknown[]) => mockSpeechStop(...args),
}));

jest.mock('expo-audio', () => ({
  createAudioPlayer: (...args: unknown[]) => mockCreateAudioPlayer(...args),
  setAudioModeAsync: (...args: unknown[]) => mockSetAudioModeAsync(...args),
}));

function getServiceState() {
  return voiceOutputService as unknown as {
    activePlayer: {
      pause?: () => void;
      remove?: () => void;
    } | null;
    activePlayerSubscription: { remove: () => void } | null;
    lastMessageText: string | null;
    lastLanguage: SupportedLanguageCode;
    lastAudioUri: string | null;
  };
}

describe('voice-output stale replay handling', () => {
  beforeEach(async () => {
    jest.clearAllMocks();

    const state = getServiceState();
    state.activePlayer = null;
    state.activePlayerSubscription = null;
    state.lastMessageText = null;
    state.lastLanguage = 'en';
    state.lastAudioUri = null;

    await voiceOutputService.stop();
  });

  it('clears stale cached audio when latest assistant turn has no audio before replay', async () => {
    const state = getServiceState();
    state.lastAudioUri = '/tmp/assistant-voice-old.mp3';
    state.lastMessageText = 'Old assistant reply';
    state.lastLanguage = 'en';

    const response = {
      message: {
        id: 'turn-1',
        role: 'assistant',
        content: 'Latest assistant reply (text only)',
        timestamp: new Date('2026-02-26T00:00:00Z'),
      },
    } as AssistantTurnResponse;

    await voiceOutputService.playAssistantTurn(response, {
      language: 'en',
    });

    expect(mockDeleteAsync).toHaveBeenCalledWith('/tmp/assistant-voice-old.mp3');
    expect(state.lastAudioUri).toBeNull();
    expect(mockSpeechSpeak).toHaveBeenCalledWith(
      'Latest assistant reply (text only)',
      expect.objectContaining({
        language: 'en-IN',
      }),
    );

    await voiceOutputService.replayLast();

    expect(mockCreateAudioPlayer).not.toHaveBeenCalled();
    expect(mockSetAudioModeAsync).not.toHaveBeenCalled();
    expect(mockSpeechSpeak).toHaveBeenCalledTimes(2);
    expect(mockSpeechSpeak).toHaveBeenLastCalledWith(
      'Latest assistant reply (text only)',
      expect.objectContaining({
        language: 'en-IN',
      }),
    );
  });

  it('forwards onDone when cached audio file playback finishes', async () => {
    let playbackStatusListener: PlaybackStatusListener | null = null;
    const mockSubscription = { remove: jest.fn() };
    const mockPlayer = {
      playbackRate: 1,
      addListener: jest.fn((eventName: string, listener: PlaybackStatusListener) => {
        expect(eventName).toBe('playbackStatusUpdate');
        playbackStatusListener = listener;
        return mockSubscription;
      }),
      play: jest.fn(),
      pause: jest.fn(),
      remove: jest.fn(),
    };
    mockCreateAudioPlayer.mockReturnValue(mockPlayer);

    const onDone = jest.fn();
    const onStateChange = jest.fn();

    const response = {
      message: {
        id: 'turn-audio-1',
        role: 'assistant',
        content: 'Audio-backed reply',
        timestamp: new Date('2026-02-26T00:00:00Z'),
        audio: {
          base64: 'ZmFrZQ==',
          mimeType: 'audio/mpeg',
        },
      },
    } as AssistantTurnResponse;

    await voiceOutputService.playAssistantTurn(response, {
      language: 'en',
      onDone,
      onStateChange,
    });

    expect(mockCreateAudioPlayer).toHaveBeenCalledTimes(1);
    expect(playbackStatusListener).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();

    if (!playbackStatusListener) {
      throw new Error('Expected playback status listener to be registered');
    }
    const listener = playbackStatusListener as PlaybackStatusListener;
    listener({ didJustFinish: true, isLoaded: true });

    expect(onStateChange).toHaveBeenCalledWith(true);
    expect(onStateChange).toHaveBeenCalledWith(false);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(mockSubscription.remove).toHaveBeenCalledTimes(1);
    expect(mockPlayer.pause).toHaveBeenCalledTimes(1);
    expect(mockPlayer.remove).toHaveBeenCalledTimes(1);
  });

  it('replayLast forwards onDone when replaying cached audio', async () => {
    let playbackStatusListener: PlaybackStatusListener | null = null;
    const mockSubscription = { remove: jest.fn() };
    const mockPlayer = {
      playbackRate: 1,
      addListener: jest.fn((eventName: string, listener: PlaybackStatusListener) => {
        expect(eventName).toBe('playbackStatusUpdate');
        playbackStatusListener = listener;
        return mockSubscription;
      }),
      play: jest.fn(),
      pause: jest.fn(),
      remove: jest.fn(),
    };
    mockCreateAudioPlayer.mockReturnValue(mockPlayer);

    const state = getServiceState();
    state.lastAudioUri = '/tmp/cached-replay.mp3';
    state.lastMessageText = 'Replay me';
    state.lastLanguage = 'en';

    const onDone = jest.fn();
    const onStateChange = jest.fn();

    await voiceOutputService.replayLast({
      onDone,
      onStateChange,
    });

    expect(mockCreateAudioPlayer).toHaveBeenCalledWith('/tmp/cached-replay.mp3');

    if (!playbackStatusListener) {
      throw new Error('Expected playback status listener to be registered');
    }
    const listener = playbackStatusListener as PlaybackStatusListener;
    listener({ didJustFinish: true, isLoaded: true });

    expect(onStateChange).toHaveBeenCalledWith(true);
    expect(onStateChange).toHaveBeenCalledWith(false);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
