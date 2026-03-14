/**
 * Tests for useVoiceMode hook.
 * Verifies:
 * - Opens voice mode (sets isVoiceModeVisible=true, voiceState='idle')
 * - Orb press in idle starts recording → voiceState='listening'
 * - Orb press in listening stops recording → voiceState='processing'
 * - handleRecordingComplete sends audio to backend → voiceState='idle' or 'speaking'
 * - Backend error (STT failure) transitions to error state
 * - Network error transitions to error state with network error kind
 * - Closes voice mode → isVoiceModeVisible=false, voiceState='idle'
 * - Voice messages added to thread after backend response
 * - onNewMessage called with assistant message
 * - onConversationIdChange called with new conversation ID
 * - clearVoiceModeError returns to idle from error state
 * - Mic permission denied shows permission_denied error
 */

import { renderHook, act } from '@testing-library/react-native';
import { useVoiceMode } from '@/hooks/use-voice-mode';
import {
  sendAssistantTurn,
  AssistantGatewayError,
  AssistantGatewayErrorCode,
} from '@/services/assistant-gateway';

// ── Mocks ──────────────────────────────────────────────────────────────────────

// Mock useVoiceRecorder
const mockStartRecording = jest.fn().mockResolvedValue(true);
const mockStopRecording = jest.fn();
const mockClearRecorderError = jest.fn();

let mockRecorderState = {
  isRecording: false,
  durationMillis: 0,
  error: null as import('@/hooks/use-voice-recorder').VoiceRecorderError | null,
};

// Capture the onRecordingComplete callback so tests can simulate auto-stop
let capturedOnComplete:
  | ((result: import('@/hooks/use-voice-recorder').RecordingResultData) => void)
  | undefined;

jest.mock('@/hooks/use-voice-recorder', () => ({
  useVoiceRecorder: jest.fn((onComplete) => {
    capturedOnComplete = onComplete;
    return {
      isRecording: mockRecorderState.isRecording,
      durationMillis: mockRecorderState.durationMillis,
      startRecording: mockStartRecording,
      stopRecording: mockStopRecording,
      error: mockRecorderState.error,
      clearError: mockClearRecorderError,
    };
  }),
  MAX_RECORDING_DURATION_SECONDS: 60,
}));

jest.mock('@/services/assistant-gateway', () => ({
  sendAssistantTurn: jest.fn(),
  AssistantGatewayError: class AssistantGatewayError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.name = 'AssistantGatewayError';
      this.code = code;
    }
  },
  AssistantGatewayErrorCode: {
    NETWORK_ERROR: 'NETWORK_ERROR',
    TIMEOUT: 'TIMEOUT',
    SERVER_ERROR: 'SERVER_ERROR',
    AUDIO_VALIDATION_FAILED: 'AUDIO_VALIDATION_FAILED',
    CANCELED: 'CANCELED',
    INVALID_REQUEST: 'INVALID_REQUEST',
    INVALID_RESPONSE: 'INVALID_RESPONSE',
    AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
    RATE_LIMITED: 'RATE_LIMITED',
    UNKNOWN: 'UNKNOWN',
  },
}));

const mockSendAssistantTurn = sendAssistantTurn as jest.Mock;

// ── Sample data ────────────────────────────────────────────────────────────────

const RECORDING_RESULT = {
  uri: 'file://recording.wav',
  base64: 'SGVsbG8=',
  format: 'wav',
  durationSeconds: 3.0,
};

const ASSISTANT_RESPONSE = {
  message: {
    id: 'assistant-msg-1',
    role: 'assistant' as const,
    content: 'The wheat crop needs watering today.',
    timestamp: new Date(),
    conversationId: 'conv-xyz',
    inputMode: 'audio' as const,
    audio: null,
  },
  suggestions: [],
  userTranscript: 'How is my wheat doing?',
  sttProviderUsed: 'sarvam',
};

const defaultOptions = {
  conversationId: null,
  language: 'en' as const,
  farmContext: undefined,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useVoiceMode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedOnComplete = undefined;
    mockRecorderState = { isRecording: false, durationMillis: 0, error: null };
    mockStartRecording.mockResolvedValue(true);
    mockSendAssistantTurn.mockResolvedValue(ASSISTANT_RESPONSE);
  });

  // ── Open / Close ──────────────────────────────────────────────────────────

  it('starts with isVoiceModeVisible=false and voiceState=idle', () => {
    const { result } = renderHook(() => useVoiceMode(defaultOptions));
    expect(result.current.isVoiceModeVisible).toBe(false);
    expect(result.current.voiceState).toBe('idle');
    expect(result.current.voiceMessages).toHaveLength(0);
    expect(result.current.voiceModeError).toBeNull();
  });

  it('openVoiceMode sets isVoiceModeVisible=true', () => {
    const { result } = renderHook(() => useVoiceMode(defaultOptions));
    act(() => {
      result.current.openVoiceMode();
    });
    expect(result.current.isVoiceModeVisible).toBe(true);
    expect(result.current.voiceState).toBe('idle');
  });

  it('handleClose sets isVoiceModeVisible=false and voiceState=idle', () => {
    const { result } = renderHook(() => useVoiceMode(defaultOptions));
    act(() => {
      result.current.openVoiceMode();
    });
    act(() => {
      result.current.handleClose();
    });
    expect(result.current.isVoiceModeVisible).toBe(false);
    expect(result.current.voiceState).toBe('idle');
  });

  it('handleClose stops recording if active', () => {
    mockRecorderState.isRecording = true;
    const { result } = renderHook(() => useVoiceMode(defaultOptions));
    act(() => {
      result.current.handleClose();
    });
    expect(mockStopRecording).toHaveBeenCalledTimes(1);
  });

  // ── Orb press state machine ───────────────────────────────────────────────

  it('orb press in idle state starts recording and transitions to listening', async () => {
    const { result } = renderHook(() => useVoiceMode(defaultOptions));
    act(() => result.current.openVoiceMode());

    await act(async () => {
      result.current.handleOrbPress();
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(mockStartRecording).toHaveBeenCalledTimes(1);
    expect(result.current.voiceState).toBe('listening');
  });

  it('orb press in listening state stops recording', async () => {
    const { result } = renderHook(() => useVoiceMode(defaultOptions));
    act(() => result.current.openVoiceMode());

    // Start recording
    await act(async () => {
      result.current.handleOrbPress();
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(result.current.voiceState).toBe('listening');

    // Stop recording
    act(() => {
      result.current.handleOrbPress();
    });

    expect(mockStopRecording).toHaveBeenCalledTimes(1);
  });

  it('orb press in error state retries recording', async () => {
    mockStartRecording.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const { result } = renderHook(() => useVoiceMode(defaultOptions));
    act(() => result.current.openVoiceMode());

    // First press — fails
    await act(async () => {
      result.current.handleOrbPress();
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(result.current.voiceState).toBe('error');

    // Second press — retry succeeds
    await act(async () => {
      result.current.handleOrbPress();
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(result.current.voiceState).toBe('listening');
  });

  it('startRecording failure transitions to error state', async () => {
    mockStartRecording.mockResolvedValue(false);
    const { result } = renderHook(() => useVoiceMode(defaultOptions));
    act(() => result.current.openVoiceMode());

    await act(async () => {
      result.current.handleOrbPress();
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current.voiceState).toBe('error');
  });

  // ── Recording complete + backend flow ─────────────────────────────────────

  it('recording complete sends audio to backend', async () => {
    const { result } = renderHook(() => useVoiceMode(defaultOptions));
    act(() => result.current.openVoiceMode());

    await act(async () => {
      result.current.handleOrbPress();
      await new Promise((r) => setTimeout(r, 0));
    });

    // Simulate recording complete
    await act(async () => {
      await capturedOnComplete?.(RECORDING_RESULT);
    });

    expect(mockSendAssistantTurn).toHaveBeenCalledTimes(1);
    const call = mockSendAssistantTurn.mock.calls[0][0];
    expect(call.inputMode).toBe('audio');
    expect(call.inputAudioBase64).toBe(RECORDING_RESULT.base64);
    expect(call.audioFormat).toBe(RECORDING_RESULT.format);
    expect(call.audioDuration).toBe(RECORDING_RESULT.durationSeconds);
  });

  it('after backend response, voice messages contain user transcript and assistant reply', async () => {
    const { result } = renderHook(() => useVoiceMode(defaultOptions));
    act(() => result.current.openVoiceMode());

    await act(async () => {
      result.current.handleOrbPress();
      await new Promise((r) => setTimeout(r, 0));
    });

    await act(async () => {
      await capturedOnComplete?.(RECORDING_RESULT);
    });

    const msgs = result.current.voiceMessages;
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe('user');
    expect(msgs[0].text).toBe('How is my wheat doing?');
    expect(msgs[1].role).toBe('assistant');
    expect(msgs[1].text).toBe('The wheat crop needs watering today.');
  });

  it('after backend response with no audio, transitions to idle', async () => {
    const { result } = renderHook(() => useVoiceMode(defaultOptions));
    act(() => result.current.openVoiceMode());

    await act(async () => {
      result.current.handleOrbPress();
      await new Promise((r) => setTimeout(r, 0));
    });

    await act(async () => {
      await capturedOnComplete?.(RECORDING_RESULT);
    });

    expect(result.current.voiceState).toBe('idle');
  });

  it('after backend response with audio, transitions to speaking', async () => {
    mockSendAssistantTurn.mockResolvedValueOnce({
      ...ASSISTANT_RESPONSE,
      message: {
        ...ASSISTANT_RESPONSE.message,
        audio: { base64: 'audio_base64_data=', mimeType: 'audio/mpeg' },
      },
    });

    const { result } = renderHook(() => useVoiceMode(defaultOptions));
    act(() => result.current.openVoiceMode());

    await act(async () => {
      result.current.handleOrbPress();
      await new Promise((r) => setTimeout(r, 0));
    });

    await act(async () => {
      await capturedOnComplete?.(RECORDING_RESULT);
    });

    expect(result.current.voiceState).toBe('speaking');
  });

  it('onNewMessage callback is called with the assistant message', async () => {
    const onNewMessage = jest.fn();
    const { result } = renderHook(() => useVoiceMode({ ...defaultOptions, onNewMessage }));
    act(() => result.current.openVoiceMode());

    await act(async () => {
      result.current.handleOrbPress();
      await new Promise((r) => setTimeout(r, 0));
    });

    await act(async () => {
      await capturedOnComplete?.(RECORDING_RESULT);
    });

    // Should be called at least once (assistant message + optionally user transcript)
    expect(onNewMessage).toHaveBeenCalled();
    const assistantCall = onNewMessage.mock.calls.find((c) => c[0].role === 'assistant');
    expect(assistantCall).toBeDefined();
    expect(assistantCall?.[0].content).toBe('The wheat crop needs watering today.');
  });

  it('onConversationIdChange called when backend returns new conversation ID', async () => {
    const onConversationIdChange = jest.fn();
    const { result } = renderHook(() =>
      useVoiceMode({ ...defaultOptions, onConversationIdChange }),
    );
    act(() => result.current.openVoiceMode());

    await act(async () => {
      result.current.handleOrbPress();
      await new Promise((r) => setTimeout(r, 0));
    });

    await act(async () => {
      await capturedOnComplete?.(RECORDING_RESULT);
    });

    expect(onConversationIdChange).toHaveBeenCalledWith('conv-xyz');
  });

  // ── Error handling ────────────────────────────────────────────────────────

  it('STT failure shows stt_failed error and transitions to error state', async () => {
    mockSendAssistantTurn.mockRejectedValueOnce(
      new AssistantGatewayError(
        AssistantGatewayErrorCode.AUDIO_VALIDATION_FAILED,
        'Audio recording is too short',
      ),
    );

    const { result } = renderHook(() => useVoiceMode(defaultOptions));
    act(() => result.current.openVoiceMode());

    await act(async () => {
      result.current.handleOrbPress();
      await new Promise((r) => setTimeout(r, 0));
    });

    await act(async () => {
      await capturedOnComplete?.(RECORDING_RESULT);
    });

    expect(result.current.voiceState).toBe('error');
    expect(result.current.voiceModeError).not.toBeNull();
    expect(result.current.voiceModeError?.kind).toBe('stt_failed');
  });

  it('network error shows network_error kind', async () => {
    mockSendAssistantTurn.mockRejectedValueOnce(
      new AssistantGatewayError(AssistantGatewayErrorCode.NETWORK_ERROR, 'Network request failed'),
    );

    const { result } = renderHook(() => useVoiceMode(defaultOptions));
    act(() => result.current.openVoiceMode());

    await act(async () => {
      result.current.handleOrbPress();
      await new Promise((r) => setTimeout(r, 0));
    });

    await act(async () => {
      await capturedOnComplete?.(RECORDING_RESULT);
    });

    expect(result.current.voiceModeError?.kind).toBe('network_error');
    expect(result.current.voiceState).toBe('error');
  });

  it('clearVoiceModeError returns to idle and clears error', async () => {
    mockSendAssistantTurn.mockRejectedValueOnce(
      new AssistantGatewayError(AssistantGatewayErrorCode.NETWORK_ERROR, 'Network failed'),
    );

    const { result } = renderHook(() => useVoiceMode(defaultOptions));
    act(() => result.current.openVoiceMode());

    await act(async () => {
      result.current.handleOrbPress();
      await new Promise((r) => setTimeout(r, 0));
    });

    await act(async () => {
      await capturedOnComplete?.(RECORDING_RESULT);
    });

    expect(result.current.voiceState).toBe('error');

    act(() => {
      result.current.clearVoiceModeError();
    });

    expect(result.current.voiceModeError).toBeNull();
    expect(result.current.voiceState).toBe('idle');
  });

  it('mic permission denied shows permission_denied error', () => {
    mockRecorderState.error = {
      kind: 'permission_denied',
      message: 'Microphone permission was denied',
    };
    const { result } = renderHook(() => useVoiceMode(defaultOptions));

    expect(result.current.voiceModeError).not.toBeNull();
    expect(result.current.voiceModeError?.kind).toBe('permission_denied');
  });

  it('voice messages are cleared when openVoiceMode is called', async () => {
    const { result } = renderHook(() => useVoiceMode(defaultOptions));
    act(() => result.current.openVoiceMode());

    await act(async () => {
      result.current.handleOrbPress();
      await new Promise((r) => setTimeout(r, 0));
    });

    await act(async () => {
      await capturedOnComplete?.(RECORDING_RESULT);
    });

    expect(result.current.voiceMessages).toHaveLength(2);

    // Reopen voice mode
    act(() => {
      result.current.openVoiceMode();
    });

    expect(result.current.voiceMessages).toHaveLength(0);
  });
});
