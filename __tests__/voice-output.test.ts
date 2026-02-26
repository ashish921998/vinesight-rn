import { voiceOutputService } from '@/services/voice-output';
import type { AssistantTurnResponse } from '@/types/ai';

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
    lastLanguage: 'en' | 'hi' | 'mr';
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
});
