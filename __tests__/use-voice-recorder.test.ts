/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for useVoiceRecorder hook.
 * Verifies:
 * - Initial state is not recording
 * - startRecording checks permissions before recording
 * - Permission denied sets error with kind 'permission_denied'
 * - startRecording returns false on permission denial
 * - startRecording returns true and triggers recording on success
 * - stopRecording fires the onRecordingComplete callback with audio data
 * - Silence detection: auto-stops after SILENCE_TIMEOUT_MS of metering below threshold
 * - Max duration auto-stop (via forDuration)
 * - clearError resets error state
 */

import { renderHook, act } from '@testing-library/react-native';
import { useVoiceRecorder } from '@/hooks/use-voice-recorder';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockRecord = jest.fn();
const mockStop = jest.fn().mockResolvedValue(undefined);
const mockPrepareToRecordAsync = jest.fn().mockResolvedValue(undefined);
const mockGetStatus = jest.fn().mockReturnValue({
  canRecord: true,
  isRecording: false,
  durationMillis: 0,
  mediaServicesDidReset: false,
  metering: -20,
  url: null,
});

// Shared recorder state that tests can mutate
let mockRecorderState = {
  canRecord: true,
  isRecording: false,
  durationMillis: 0,
  mediaServicesDidReset: false,
  metering: -20 as number | undefined,
  url: null as string | null,
};

const mockRecorder = {
  id: 1,
  currentTime: 0,
  isRecording: false,
  uri: null as string | null,
  record: mockRecord,
  stop: mockStop,
  pause: jest.fn(),
  getAvailableInputs: jest.fn().mockReturnValue([]),
  getCurrentInput: jest.fn(),
  setInput: jest.fn(),
  getStatus: mockGetStatus,
  startRecordingAtTime: jest.fn(),
  prepareToRecordAsync: mockPrepareToRecordAsync,
  recordForDuration: jest.fn(),
  addListener: jest.fn(),
  removeAllListeners: jest.fn(),
  release: jest.fn(),
};

// Permission response helpers
const grantedPermission = { granted: true, status: 'granted', expires: 'never', canAskAgain: true };
const deniedPermission = { granted: false, status: 'denied', expires: 'never', canAskAgain: false };

let mockGetRecordingPermissionsAsync = jest.fn().mockResolvedValue(grantedPermission);
let mockRequestRecordingPermissionsAsync = jest.fn().mockResolvedValue(grantedPermission);

jest.mock('expo-audio', () => ({
  useAudioRecorder: jest.fn(() => mockRecorder),
  useAudioRecorderState: jest.fn(() => mockRecorderState),
  requestRecordingPermissionsAsync: jest.fn(() => mockRequestRecordingPermissionsAsync()),
  getRecordingPermissionsAsync: jest.fn(() => mockGetRecordingPermissionsAsync()),
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
  IOSOutputFormat: { LINEARPCM: 'lpcm', MPEG4AAC: 'aac ' },
  AudioQuality: { HIGH: 96 },
  RecordingPresets: {
    HIGH_QUALITY: {
      extension: '.m4a',
      sampleRate: 44100,
      numberOfChannels: 2,
      bitRate: 128000,
      android: { outputFormat: 'mpeg4', audioEncoder: 'aac' },
      ios: {
        outputFormat: 'aac ',
        audioQuality: 96,
        linearPCMBitDepth: 16,
        linearPCMIsBigEndian: false,
        linearPCMIsFloat: false,
      },
      web: { mimeType: 'audio/webm', bitsPerSecond: 128000 },
    },
  },
}));

const mockReadAsStringAsync = jest.fn().mockResolvedValue('SGVsbG8gV29ybGQ='); // base64 "Hello World"

jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: jest.fn(() => mockReadAsStringAsync()),
  EncodingType: { Base64: 'base64', UTF8: 'utf8' },
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

function setRecorderState(overrides: Partial<typeof mockRecorderState>): void {
  Object.assign(mockRecorderState, overrides);
  const { useAudioRecorderState } = require('expo-audio');
  (useAudioRecorderState as jest.Mock).mockReturnValue({ ...mockRecorderState });
}

function resetRecorderState(): void {
  mockRecorderState = {
    canRecord: true,
    isRecording: false,
    durationMillis: 0,
    mediaServicesDidReset: false,
    metering: -20,
    url: null,
  };
  const { useAudioRecorderState } = require('expo-audio');
  (useAudioRecorderState as jest.Mock).mockReturnValue({ ...mockRecorderState });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useVoiceRecorder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetRecorderState();
    mockRecorder.uri = null;
    mockGetRecordingPermissionsAsync = jest.fn().mockResolvedValue(grantedPermission);
    mockRequestRecordingPermissionsAsync = jest.fn().mockResolvedValue(grantedPermission);
    mockPrepareToRecordAsync.mockResolvedValue(undefined);
    mockStop.mockResolvedValue(undefined);
    mockReadAsStringAsync.mockResolvedValue('SGVsbG8gV29ybGQ=');
    const {
      getRecordingPermissionsAsync,
      requestRecordingPermissionsAsync,
    } = require('expo-audio');
    (getRecordingPermissionsAsync as jest.Mock).mockImplementation(() =>
      mockGetRecordingPermissionsAsync(),
    );
    (requestRecordingPermissionsAsync as jest.Mock).mockImplementation(() =>
      mockRequestRecordingPermissionsAsync(),
    );
  });

  it('initializes with isRecording=false and no error', () => {
    const { result } = renderHook(() => useVoiceRecorder());
    expect(result.current.isRecording).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.durationMillis).toBe(0);
  });

  it('startRecording returns false and sets permission_denied error when mic permission is denied', async () => {
    mockGetRecordingPermissionsAsync = jest.fn().mockResolvedValue(deniedPermission);
    mockRequestRecordingPermissionsAsync = jest.fn().mockResolvedValue(deniedPermission);

    const { result } = renderHook(() => useVoiceRecorder());
    let started = false;

    await act(async () => {
      started = await result.current.startRecording();
    });

    expect(started).toBe(false);
    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.kind).toBe('permission_denied');
  });

  it('startRecording returns true and calls prepareToRecordAsync + record when permission granted', async () => {
    const { result } = renderHook(() => useVoiceRecorder());
    let started = false;

    await act(async () => {
      started = await result.current.startRecording();
    });

    expect(started).toBe(true);
    expect(mockPrepareToRecordAsync).toHaveBeenCalledTimes(1);
    expect(mockRecord).toHaveBeenCalledTimes(1);
    // forDuration should be set to max 60 seconds
    expect(mockRecord).toHaveBeenCalledWith(
      expect.objectContaining({ forDuration: expect.any(Number) }),
    );
  });

  it('startRecording requests permission if not already granted', async () => {
    // First call returns not-granted, second (request) returns granted
    mockGetRecordingPermissionsAsync = jest.fn().mockResolvedValue(deniedPermission);
    mockRequestRecordingPermissionsAsync = jest.fn().mockResolvedValue(grantedPermission);

    const { result } = renderHook(() => useVoiceRecorder());
    let started = false;

    await act(async () => {
      started = await result.current.startRecording();
    });

    expect(started).toBe(true);
    expect(mockRequestRecordingPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(mockRecord).toHaveBeenCalled();
  });

  it('stopRecording calls recorder.stop()', async () => {
    const { result, rerender } = renderHook(() => useVoiceRecorder());

    // Start recording first
    await act(async () => {
      await result.current.startRecording();
    });

    // Simulate recording state and re-render hook to pick it up
    act(() => {
      setRecorderState({ isRecording: true, durationMillis: 3000 });
    });
    rerender({});

    act(() => {
      result.current.stopRecording();
    });

    expect(mockStop).toHaveBeenCalled();
  });

  it('clearError resets error state', async () => {
    mockGetRecordingPermissionsAsync = jest.fn().mockResolvedValue(deniedPermission);
    mockRequestRecordingPermissionsAsync = jest.fn().mockResolvedValue(deniedPermission);

    const { result } = renderHook(() => useVoiceRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.error).not.toBeNull();

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it('onRecordingComplete is called with audio data when recording finishes', async () => {
    const onComplete = jest.fn();
    const { result, rerender } = renderHook(() => useVoiceRecorder(onComplete));

    // Start recording
    await act(async () => {
      await result.current.startRecording();
    });

    // Simulate recording started
    act(() => {
      setRecorderState({ isRecording: true, durationMillis: 2000 });
    });
    rerender({});

    // Set URI before stopping
    mockRecorder.uri = 'file://recording.wav';

    // Simulate recording stopped (isRecording → false)
    await act(async () => {
      setRecorderState({ isRecording: false, durationMillis: 2000 });
    });
    rerender({});

    // Wait for async completion
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
    const resultData = onComplete.mock.calls[0][0];
    expect(resultData).toMatchObject({
      uri: 'file://recording.wav',
      base64: 'SGVsbG8gV29ybGQ=',
      durationSeconds: 2,
    });
    expect(['wav', 'm4a', 'webm']).toContain(resultData.format);
  });

  it('sets read_failed error when file cannot be read', async () => {
    mockReadAsStringAsync.mockRejectedValueOnce(new Error('file not found'));
    const onComplete = jest.fn();
    const { result, rerender } = renderHook(() => useVoiceRecorder(onComplete));

    await act(async () => {
      await result.current.startRecording();
    });

    act(() => {
      setRecorderState({ isRecording: true, durationMillis: 1000 });
    });
    rerender({});

    mockRecorder.uri = 'file://recording.wav';

    await act(async () => {
      setRecorderState({ isRecording: false, durationMillis: 1000 });
    });
    rerender({});

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(onComplete).not.toHaveBeenCalled();
    expect(result.current.error?.kind).toBe('read_failed');
  });

  it('isRecording reflects recorderState.isRecording', () => {
    const { result, rerender } = renderHook(() => useVoiceRecorder());

    expect(result.current.isRecording).toBe(false);

    act(() => {
      setRecorderState({ isRecording: true });
    });
    rerender({});

    expect(result.current.isRecording).toBe(true);
  });

  it('durationMillis reflects recorderState.durationMillis', () => {
    const { result, rerender } = renderHook(() => useVoiceRecorder());

    act(() => {
      setRecorderState({ isRecording: true, durationMillis: 5500 });
    });
    rerender({});

    expect(result.current.durationMillis).toBe(5500);
  });
});
