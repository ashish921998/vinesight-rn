import { useRef, useCallback, useEffect } from 'react';
import { Platform, Alert, Linking } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import {
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  RecordingPresets,
  AudioQuality,
  type RecordingOptions,
} from 'expo-audio';

const MIN_VOICE_AUDIO_DURATION_MS = 800;
const MIN_VOICE_AUDIO_BASE64_LENGTH = 800;
const MIN_VOICE_AUDIO_ESTIMATED_BYTES = 600;

const VOICE_RECORDING_OPTIONS: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  extension: '.wav',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 64000,
  android: {
    extension: '.aac',
    outputFormat: 'aac_adts',
    audioEncoder: 'aac',
  },
  ios: {
    extension: '.wav',
    audioQuality: AudioQuality.HIGH,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 128000,
  },
};

export interface VoiceAudioPayload {
  inputAudioBase64: string;
  audioFormat: string;
  durationMs: number;
}

type VoiceInputState = 'idle' | 'recording' | 'processing';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function inferAudioMimeType(uri: string): string {
  const ext = uri.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'wav':
      return 'audio/wav';
    case 'm4a':
      return 'audio/mp4';
    case 'mp3':
      return 'audio/mpeg';
    case 'webm':
      return 'audio/webm';
    case '3gp':
      return 'audio/3gpp';
    default:
      return 'audio/wav';
  }
}

function estimateBase64Bytes(base64Payload: string | null | undefined): number | null {
  if (!base64Payload) return null;
  const base64Length = base64Payload.length;
  if (base64Length === 0) return 0;
  const padding = (base64Payload.match(/=/g) || []).length;
  return Math.floor((base64Length * 3) / 4) - padding;
}

function validateVoiceAudioPayload(payload: VoiceAudioPayload | null): {
  ok: boolean;
  reason?: string;
  estimatedBytes?: number | null;
} {
  if (!payload?.inputAudioBase64?.trim()) {
    return { ok: false, reason: 'empty_audio_payload', estimatedBytes: null };
  }

  const estimatedBytes = estimateBase64Bytes(payload.inputAudioBase64);
  const durationMs = payload.durationMs ?? null;
  const hasSufficientBase64 = payload.inputAudioBase64.length >= MIN_VOICE_AUDIO_BASE64_LENGTH;
  const hasSufficientBytes =
    estimatedBytes !== null &&
    Number.isFinite(estimatedBytes) &&
    estimatedBytes >= MIN_VOICE_AUDIO_ESTIMATED_BYTES;

  if (
    durationMs !== null &&
    durationMs > 0 &&
    durationMs < MIN_VOICE_AUDIO_DURATION_MS &&
    !hasSufficientBase64 &&
    !hasSufficientBytes
  ) {
    return { ok: false, reason: 'audio_duration_too_short', estimatedBytes };
  }

  if (!hasSufficientBase64) {
    return { ok: false, reason: 'audio_base64_too_short', estimatedBytes };
  }

  if (!hasSufficientBytes) {
    return { ok: false, reason: 'audio_bytes_too_small', estimatedBytes };
  }

  return { ok: true, estimatedBytes };
}

function formatVoicePayloadDebug(params: {
  reason?: string;
  durationMs?: number | null;
  base64Length?: number | null;
  estimatedBytes?: number | null;
  captureError?: string | null;
}): string {
  return [
    `reason=${params.reason ?? 'unknown'}`,
    `duration_ms=${params.durationMs ?? 'null'}`,
    `base64_len=${params.base64Length ?? 0}`,
    `estimated_bytes=${params.estimatedBytes ?? 'null'}`,
    `capture_error=${params.captureError ?? 'null'}`,
  ].join(' ');
}

function promptOpenSettings(title: string, message: string, t: (key: string) => string) {
  Alert.alert(title, message, [
    { text: t('common.cancel'), style: 'cancel' },
    {
      text: t('common.ok'),
      onPress: () => {
        Linking.openSettings().catch(() => null);
      },
    },
  ]);
}

export interface UseVoiceRecordingOptions {
  t: (key: string, options?: Record<string, unknown>) => string;
  telemetry: {
    capture: (eventName: string, properties?: Record<string, unknown>) => void;
  };
  sendMessage: (
    text: string,
    source: 'text' | 'voice',
    voicePayload?: VoiceAudioPayload | null,
  ) => void;
  isVoiceModeVisible: boolean;
  voiceConversationMode: 'manual' | 'auto';
  isAssistantSpeaking: boolean;
  isLoading: boolean;
  __DEV__?: boolean;
  voiceInputState: VoiceInputState;
  setVoiceInputState: (state: VoiceInputState) => void;
  setVoiceModeError: (error: string | null) => void;
  setVoiceModeNotice: (notice: string | null) => void;
  setLiveVoiceTranscript: (transcript: string) => void;
}

export interface UseVoiceRecordingReturn {
  startVoiceRecording: () => Promise<boolean>;
  stopVoiceRecordingAndCapture: (options?: {
    discard?: boolean;
  }) => Promise<VoiceAudioPayload | null>;
  sendVoiceAudioToServer: (voicePayload: VoiceAudioPayload) => void;
  discardVoiceRecording: () => Promise<void>;
  handleTTSComplete: () => void;
  isRecording: boolean;
}

export function useVoiceRecording({
  t,
  telemetry,
  sendMessage,
  isVoiceModeVisible,
  voiceConversationMode,
  isAssistantSpeaking,
  isLoading,
  __DEV__ = false,
  voiceInputState,
  setVoiceInputState,
  setVoiceModeError,
  setVoiceModeNotice,
  setLiveVoiceTranscript,
}: UseVoiceRecordingOptions): UseVoiceRecordingReturn {
  const voiceRecorder = useAudioRecorder(VOICE_RECORDING_OPTIONS);

  const isProcessingVoiceRef = useRef(false);
  const voiceInputStateRef = useRef<VoiceInputState>(voiceInputState);
  const voiceRecordingStartTimeRef = useRef<number | null>(null);
  const voiceConversationModeRef = useRef(voiceConversationMode);
  const isAssistantSpeakingRef = useRef(isAssistantSpeaking);
  const isVoiceModeVisibleRef = useRef(isVoiceModeVisible);
  const isLoadingRef = useRef(isLoading);
  const voiceModeStartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  voiceInputStateRef.current = voiceInputState;
  voiceConversationModeRef.current = voiceConversationMode;
  isAssistantSpeakingRef.current = isAssistantSpeaking;
  isVoiceModeVisibleRef.current = isVoiceModeVisible;
  isLoadingRef.current = isLoading;

  useEffect(() => {
    return () => {
      if (voiceModeStartTimeoutRef.current) {
        clearTimeout(voiceModeStartTimeoutRef.current);
        voiceModeStartTimeoutRef.current = null;
      }

      if (voiceRecordingStartTimeRef.current !== null) {
        void voiceRecorder.stop().catch(() => {
          // no-op
        });
        voiceRecordingStartTimeRef.current = null;
      }
    };
  }, [voiceRecorder]);

  const resetRecordingAudioMode = useCallback(async () => {
    try {
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        interruptionMode: 'duckOthers',
        shouldRouteThroughEarpiece: false,
        shouldPlayInBackground: false,
      });
    } catch {
      // no-op
    }
  }, []);

  const shouldAbortRecordingStart = useCallback(
    () => !isVoiceModeVisibleRef.current || voiceInputStateRef.current !== 'idle',
    [],
  );

  const startVoiceRecording = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web') {
      setVoiceModeError(t('ai.voice.unavailableBody'));
      return false;
    }

    if (isProcessingVoiceRef.current || voiceInputStateRef.current !== 'idle') {
      return false;
    }

    isProcessingVoiceRef.current = true;

    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setVoiceModeError(t('ai.voice.permissionBody'));
        promptOpenSettings(t('ai.voice.permissionTitle'), t('ai.voice.permissionBody'), t);
        return false;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        interruptionMode: 'duckOthers',
        shouldRouteThroughEarpiece: false,
        shouldPlayInBackground: false,
      });

      if (shouldAbortRecordingStart()) {
        await resetRecordingAudioMode();
        return false;
      }

      await voiceRecorder.prepareToRecordAsync();
      if (shouldAbortRecordingStart()) {
        await resetRecordingAudioMode();
        return false;
      }
      voiceRecorder.record();
      voiceRecordingStartTimeRef.current = Date.now();
      voiceInputStateRef.current = 'recording';
      setVoiceInputState('recording');
      setVoiceModeError(null);
      setVoiceModeNotice(null);
      setLiveVoiceTranscript('');

      return true;
    } catch (error) {
      if (__DEV__) {
        console.warn('Voice recording start failed:', error);
      }
      setVoiceModeError(t('ai.voice.unavailableBody'));
      await resetRecordingAudioMode();
      return false;
    } finally {
      isProcessingVoiceRef.current = false;
    }
  }, [
    t,
    voiceRecorder,
    resetRecordingAudioMode,
    shouldAbortRecordingStart,
    __DEV__,
    setLiveVoiceTranscript,
    setVoiceInputState,
    setVoiceModeError,
    setVoiceModeNotice,
  ]);

  const stopVoiceRecordingAndCapture = useCallback(
    async (options?: { discard?: boolean }): Promise<VoiceAudioPayload | null> => {
      if (isProcessingVoiceRef.current && !options?.discard) {
        return null;
      }

      isProcessingVoiceRef.current = true;

      try {
        const startTime = voiceRecordingStartTimeRef.current;
        const recordingDuration = startTime ? Date.now() - startTime : 0;

        await voiceRecorder.stop();

        voiceRecordingStartTimeRef.current = null;

        if (options?.discard) {
          setVoiceInputState('idle');
          setLiveVoiceTranscript('');
          return null;
        }

        const status = voiceRecorder.getStatus();
        let uri = voiceRecorder.uri ?? status.url;
        let durationMs =
          typeof status.durationMillis === 'number' ? status.durationMillis : recordingDuration;

        for (let attempt = 0; attempt < 10 && !uri; attempt++) {
          await sleep(100);
          const newStatus = voiceRecorder.getStatus();
          uri = voiceRecorder.uri ?? newStatus.url;
          if (!durationMs && typeof newStatus.durationMillis === 'number') {
            durationMs = newStatus.durationMillis;
          }
        }

        if (!uri) {
          setVoiceModeError(t('ai.voice.recordingTooShortBody'));
          setVoiceInputState('idle');
          return null;
        }

        for (let attempt = 0; attempt < 15; attempt++) {
          const info = await FileSystem.getInfoAsync(uri);
          if (info.exists && typeof info.size === 'number' && info.size > 0) {
            break;
          }
          await sleep(100);
        }

        const inputAudioBase64 = await FileSystem.readAsStringAsync(uri, {
          encoding: 'base64',
        });

        if (!inputAudioBase64.trim()) {
          setVoiceModeError(t('ai.voice.recordingTooShortBody'));
          setVoiceInputState('idle');
          return null;
        }

        const audioFormat = inferAudioMimeType(uri);

        if (__DEV__) {
          const estimatedBytes = estimateBase64Bytes(inputAudioBase64);
          console.log(
            `[Voice capture] format=${audioFormat} durationMs=${durationMs} base64len=${inputAudioBase64.length} estimatedBytes=${estimatedBytes}`,
          );
        }

        return {
          inputAudioBase64,
          audioFormat,
          durationMs,
        };
      } catch (error) {
        if (__DEV__) {
          console.warn('Voice recording stop failed:', error);
        }
        setVoiceModeError(t('ai.voice.unavailableBody'));
        setVoiceInputState('idle');
        return null;
      } finally {
        isProcessingVoiceRef.current = false;
        try {
          await setAudioModeAsync({
            allowsRecording: false,
            playsInSilentMode: true,
            interruptionMode: 'duckOthers',
            shouldRouteThroughEarpiece: false,
            shouldPlayInBackground: false,
          });
        } catch {
          // no-op
        }
      }
    },
    [t, voiceRecorder, __DEV__, setLiveVoiceTranscript, setVoiceInputState, setVoiceModeError],
  );

  const sendVoiceAudioToServer = useCallback(
    async (voicePayload: VoiceAudioPayload) => {
      const validation = validateVoiceAudioPayload(voicePayload);

      if (!validation.ok) {
        if (__DEV__) {
          console.warn(
            '[Voice payload rejected]',
            formatVoicePayloadDebug({
              reason: validation.reason,
              durationMs: voicePayload.durationMs,
              base64Length: voicePayload.inputAudioBase64.length,
              estimatedBytes: validation.estimatedBytes,
            }),
          );
        }

        telemetry.capture('voice_payload_rejected', {
          reason: validation.reason ?? 'unknown',
          duration_ms: voicePayload.durationMs ?? null,
          base64_length: voicePayload.inputAudioBase64.length,
          estimated_bytes: validation.estimatedBytes ?? null,
        });

        setVoiceModeError(t('ai.voice.recordingTooShortBody'));
        setVoiceInputState('idle');
        return;
      }

      setVoiceInputState('processing');
      setLiveVoiceTranscript(t('ai.voice.processing', { defaultValue: 'Processing...' }));

      sendMessage('', 'voice', voicePayload);
    },
    [
      t,
      telemetry,
      sendMessage,
      __DEV__,
      setLiveVoiceTranscript,
      setVoiceInputState,
      setVoiceModeError,
    ],
  );

  const discardVoiceRecording = useCallback(async () => {
    if (voiceInputStateRef.current === 'recording') {
      await stopVoiceRecordingAndCapture({ discard: true });
    }
    setVoiceInputState('idle');
    setLiveVoiceTranscript('');
    setVoiceModeError(null);
  }, [stopVoiceRecordingAndCapture, setLiveVoiceTranscript, setVoiceInputState, setVoiceModeError]);

  const handleTTSComplete = useCallback(() => {
    if (
      !isVoiceModeVisibleRef.current ||
      voiceConversationModeRef.current !== 'auto' ||
      voiceInputStateRef.current !== 'idle' ||
      isLoadingRef.current
    ) {
      return;
    }

    if (voiceModeStartTimeoutRef.current) {
      clearTimeout(voiceModeStartTimeoutRef.current);
    }

    voiceModeStartTimeoutRef.current = setTimeout(() => {
      voiceModeStartTimeoutRef.current = null;
      if (
        isVoiceModeVisibleRef.current &&
        voiceConversationModeRef.current === 'auto' &&
        voiceInputStateRef.current === 'idle' &&
        !isLoadingRef.current &&
        !isAssistantSpeakingRef.current
      ) {
        void startVoiceRecording();
      }
    }, 500);
  }, [startVoiceRecording]);

  return {
    startVoiceRecording,
    stopVoiceRecordingAndCapture,
    sendVoiceAudioToServer,
    discardVoiceRecording,
    handleTTSComplete,
    isRecording: voiceInputState === 'recording',
  };
}
