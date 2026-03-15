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

// Silence detection - Adaptive thresholds for better cross-device reliability
// Using dBFS (decibels relative to full scale) where 0 = max volume, -160 = silence
const SPEECH_THRESHOLD_DB = -32; // level above which we consider user is speaking (higher = louder required)
const SILENCE_THRESHOLD_DB = -42; // level below which we consider silence (lower = more tolerant of quiet)
const SILENCE_DURATION_MS = 1800; // how long silence must last before auto-stopping (1.8s feels natural)
const SILENCE_POLL_INTERVAL_MS = 100; // sample metering more frequently for smoother detection
const MIN_SPEECH_DURATION_MS = 800; // minimum speech before auto-stop allowed (slightly lower for responsiveness)
const AMBIENT_NOISE_CALIBRATION_MS = 500; // time to sample ambient noise at start
const MAX_RECORDING_DURATION_MS = 60000; // hard limit to prevent endless recording

// Fallback timeouts for devices where metering doesn't work reliably
const METERING_TIMEOUT_MS = 3000; // if no valid metering for 3s, fall back to time-based auto-stop
const FALLBACK_AUTO_STOP_MS = 10000; // time-based auto-stop when metering unavailable (10s)

const VOICE_RECORDING_OPTIONS: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  isMeteringEnabled: true,
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
    case 'aac':
      return 'audio/aac';
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
  const pendingDiscardRef = useRef(false);
  const silenceDetectionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const silenceDetectionStartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceStartTimeRef = useRef<number | null>(null);
  const hasDetectedSpeechRef = useRef(false);
  const autoStopInProgressRef = useRef(false);
  const stopVoiceRecordingAndCaptureRef = useRef<() => Promise<VoiceAudioPayload | null>>(() =>
    Promise.resolve(null),
  );
  const sendVoiceAudioToServerRef = useRef<(payload: VoiceAudioPayload) => void>(() => {});
  // Fallback timers for devices where metering doesn't work
  const maxDurationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noMeteringFallbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasReceivedValidMeteringRef = useRef(false);

  // Shared helper to clear all voice recording timers
  const clearAllVoiceTimers = useCallback(() => {
    if (silenceDetectionIntervalRef.current) {
      clearInterval(silenceDetectionIntervalRef.current);
      silenceDetectionIntervalRef.current = null;
    }
    if (silenceDetectionStartTimeoutRef.current) {
      clearTimeout(silenceDetectionStartTimeoutRef.current);
      silenceDetectionStartTimeoutRef.current = null;
    }
    if (maxDurationTimeoutRef.current) {
      clearTimeout(maxDurationTimeoutRef.current);
      maxDurationTimeoutRef.current = null;
    }
    if (noMeteringFallbackTimeoutRef.current) {
      clearTimeout(noMeteringFallbackTimeoutRef.current);
      noMeteringFallbackTimeoutRef.current = null;
    }
    if (voiceModeStartTimeoutRef.current) {
      clearTimeout(voiceModeStartTimeoutRef.current);
      voiceModeStartTimeoutRef.current = null;
    }
  }, []);

  voiceInputStateRef.current = voiceInputState;
  voiceConversationModeRef.current = voiceConversationMode;
  isAssistantSpeakingRef.current = isAssistantSpeaking;
  isVoiceModeVisibleRef.current = isVoiceModeVisible;
  isLoadingRef.current = isLoading;

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

  useEffect(() => {
    return () => {
      clearAllVoiceTimers();

      if (voiceRecordingStartTimeRef.current !== null) {
        void voiceRecorder.stop().catch(() => {
          // no-op
        });
        voiceRecordingStartTimeRef.current = null;
      }

      void resetRecordingAudioMode().catch(() => {
        // no-op
      });
    };
  }, [voiceRecorder, resetRecordingAudioMode, clearAllVoiceTimers]);

  const waitForVoiceProcessingToFinish = useCallback(async () => {
    for (let attempt = 0; attempt < 40 && isProcessingVoiceRef.current; attempt++) {
      await sleep(25);
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

      if (pendingDiscardRef.current) {
        pendingDiscardRef.current = false;
        await voiceRecorder.stop().catch(() => {
          // no-op
        });
        voiceRecordingStartTimeRef.current = null;
        voiceInputStateRef.current = 'idle';
        setVoiceInputState('idle');
        setLiveVoiceTranscript('');
        await resetRecordingAudioMode();
        return false;
      }

      voiceInputStateRef.current = 'recording';
      setVoiceInputState('recording');
      setVoiceModeError(null);
      setVoiceModeNotice(null);
      setLiveVoiceTranscript('');

      // Start silence detection in auto mode
      if (voiceConversationModeRef.current === 'auto') {
        silenceStartTimeRef.current = null;
        hasDetectedSpeechRef.current = false;
        autoStopInProgressRef.current = false;
        hasReceivedValidMeteringRef.current = false;

        if (silenceDetectionIntervalRef.current) {
          clearInterval(silenceDetectionIntervalRef.current);
          silenceDetectionIntervalRef.current = null;
        }

        if (silenceDetectionStartTimeoutRef.current) {
          clearTimeout(silenceDetectionStartTimeoutRef.current);
          silenceDetectionStartTimeoutRef.current = null;
        }

        if (maxDurationTimeoutRef.current) {
          clearTimeout(maxDurationTimeoutRef.current);
          maxDurationTimeoutRef.current = null;
        }

        if (noMeteringFallbackTimeoutRef.current) {
          clearTimeout(noMeteringFallbackTimeoutRef.current);
          noMeteringFallbackTimeoutRef.current = null;
        }

        // Independent max-duration safety timer - always fires regardless of metering
        maxDurationTimeoutRef.current = setTimeout(() => {
          if (voiceInputStateRef.current !== 'recording' || autoStopInProgressRef.current) {
            return;
          }
          // Clear all other timers first to prevent races
          if (silenceDetectionIntervalRef.current) {
            clearInterval(silenceDetectionIntervalRef.current);
            silenceDetectionIntervalRef.current = null;
          }
          if (noMeteringFallbackTimeoutRef.current) {
            clearTimeout(noMeteringFallbackTimeoutRef.current);
            noMeteringFallbackTimeoutRef.current = null;
          }
          autoStopInProgressRef.current = true;
          if (__DEV__) {
            console.log('[Voice] Max duration reached, auto-stopping');
          }
          setVoiceInputState('processing');
          void stopVoiceRecordingAndCaptureRef.current().then((payload) => {
            if (payload) {
              sendVoiceAudioToServerRef.current(payload);
            } else {
              setVoiceInputState('idle');
            }
            autoStopInProgressRef.current = false;
          });
        }, MAX_RECORDING_DURATION_MS);

        // Fallback timer for devices where metering doesn't work
        // If no valid metering received for METERING_TIMEOUT_MS, use time-based auto-stop
        noMeteringFallbackTimeoutRef.current = setTimeout(() => {
          if (
            voiceInputStateRef.current !== 'recording' ||
            autoStopInProgressRef.current ||
            hasReceivedValidMeteringRef.current
          ) {
            return;
          }
          // Metering not working - schedule time-based auto-stop after FALLBACK_AUTO_STOP_MS
          if (__DEV__) {
            console.log('[Voice] No metering available, using time-based fallback');
          }
          // Clear the outer timeout reference before setting the inner one
          noMeteringFallbackTimeoutRef.current = null;
          noMeteringFallbackTimeoutRef.current = setTimeout(() => {
            if (voiceInputStateRef.current !== 'recording' || autoStopInProgressRef.current) {
              return;
            }
            // Clear other timers first to prevent races
            if (silenceDetectionIntervalRef.current) {
              clearInterval(silenceDetectionIntervalRef.current);
              silenceDetectionIntervalRef.current = null;
            }
            if (maxDurationTimeoutRef.current) {
              clearTimeout(maxDurationTimeoutRef.current);
              maxDurationTimeoutRef.current = null;
            }
            autoStopInProgressRef.current = true;
            if (__DEV__) {
              console.log('[Voice] Fallback auto-stop triggered');
            }
            setVoiceInputState('processing');
            void stopVoiceRecordingAndCaptureRef.current().then((payload) => {
              if (payload) {
                sendVoiceAudioToServerRef.current(payload);
              } else {
                setVoiceInputState('idle');
              }
              autoStopInProgressRef.current = false;
            });
          }, FALLBACK_AUTO_STOP_MS);
        }, METERING_TIMEOUT_MS);

        silenceDetectionStartTimeoutRef.current = setTimeout(() => {
          silenceDetectionStartTimeoutRef.current = null;
          silenceDetectionIntervalRef.current = setInterval(() => {
            if (
              voiceInputStateRef.current !== 'recording' ||
              autoStopInProgressRef.current ||
              !voiceRecordingStartTimeRef.current
            ) {
              return;
            }

            const recordingElapsed = Date.now() - voiceRecordingStartTimeRef.current;
            const status = voiceRecorder.getStatus();
            const metering = status.metering;

            // Track whether we ever receive valid metering
            // Note: -160 is a VALID metering value meaning "silence" (very quiet)
            // Only undefined means metering is not working at all
            if (metering !== undefined) {
              hasReceivedValidMeteringRef.current = true;
            } else {
              // No metering available - skip silence detection for this poll
              // The fallback timer will handle auto-stop if metering never works
              return;
            }

            // Detect speech: level must exceed SPEECH_THRESHOLD_DB to count as "user spoke"
            // This prevents ambient noise from falsely triggering speech detection
            if (metering > SPEECH_THRESHOLD_DB) {
              hasDetectedSpeechRef.current = true;
              silenceStartTimeRef.current = null;
              return;
            }

            // Don't auto-stop until user has spoken for minimum duration
            if (!hasDetectedSpeechRef.current || recordingElapsed < MIN_SPEECH_DURATION_MS) {
              return;
            }

            // Silence detection: level must drop below SILENCE_THRESHOLD_DB (not just SPEECH_THRESHOLD)
            // This creates hysteresis - prevents flickering when level is near threshold
            if (metering > SILENCE_THRESHOLD_DB) {
              // Level is between silence and speech thresholds - reset silence timer
              // This handles trailing speech or breathing sounds
              silenceStartTimeRef.current = null;
              return;
            }

            // Below SILENCE_THRESHOLD_DB – track silence duration
            if (silenceStartTimeRef.current === null) {
              silenceStartTimeRef.current = Date.now();
            }

            const silenceDuration = Date.now() - silenceStartTimeRef.current;
            if (silenceDuration >= SILENCE_DURATION_MS) {
              // Silence detected – clear interval FIRST to prevent race with next poll
              if (silenceDetectionIntervalRef.current) {
                clearInterval(silenceDetectionIntervalRef.current);
                silenceDetectionIntervalRef.current = null;
              }
              autoStopInProgressRef.current = true;
              if (maxDurationTimeoutRef.current) {
                clearTimeout(maxDurationTimeoutRef.current);
                maxDurationTimeoutRef.current = null;
              }
              if (noMeteringFallbackTimeoutRef.current) {
                clearTimeout(noMeteringFallbackTimeoutRef.current);
                noMeteringFallbackTimeoutRef.current = null;
              }
              if (__DEV__) {
                console.log('[Voice] Silence detected, auto-stopping');
              }
              setVoiceInputState('processing');
              void stopVoiceRecordingAndCaptureRef.current().then((payload) => {
                if (payload) {
                  sendVoiceAudioToServerRef.current(payload);
                } else {
                  setVoiceInputState('idle');
                }
                autoStopInProgressRef.current = false;
              });
            }
          }, SILENCE_POLL_INTERVAL_MS);
        }, AMBIENT_NOISE_CALIBRATION_MS);
      }

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
    __DEV__,
    t,
    voiceRecorder,
    resetRecordingAudioMode,
    shouldAbortRecordingStart,
    setLiveVoiceTranscript,
    setVoiceInputState,
    setVoiceModeError,
    setVoiceModeNotice,
  ]);

  const stopVoiceRecordingAndCapture = useCallback(
    async (options?: { discard?: boolean }): Promise<VoiceAudioPayload | null> => {
      // Stop all timers as soon as recording is stopping
      clearAllVoiceTimers();

      if (isProcessingVoiceRef.current) {
        if (options?.discard) {
          pendingDiscardRef.current = true;
          setVoiceInputState('idle');
          setLiveVoiceTranscript('');
        }
        await waitForVoiceProcessingToFinish();
        if (isProcessingVoiceRef.current) {
          return null;
        }
      }

      // Only stop if there is actually something to stop.
      if (voiceInputStateRef.current !== 'recording') {
        if (options?.discard) {
          pendingDiscardRef.current = false;
          setVoiceInputState('idle');
          setLiveVoiceTranscript('');
        }
        return null;
      }

      isProcessingVoiceRef.current = true;

      try {
        const startTime = voiceRecordingStartTimeRef.current;
        const recordingDuration = startTime ? Date.now() - startTime : 0;

        await voiceRecorder.stop();

        voiceRecordingStartTimeRef.current = null;

        if (options?.discard) {
          pendingDiscardRef.current = false;
          voiceInputStateRef.current = 'idle';
          setVoiceInputState('idle');
          setLiveVoiceTranscript('');
          return null;
        }

        const status = voiceRecorder.getStatus();
        // voiceRecorder.uri is the canonical source in expo-audio (new API).
        // status.durationMillis is the timer from the recorder status.
        let uri = voiceRecorder.uri;
        let durationMs =
          typeof status.durationMillis === 'number' ? status.durationMillis : recordingDuration;

        for (let attempt = 0; attempt < 10 && !uri; attempt++) {
          await sleep(100);
          const newStatus = voiceRecorder.getStatus();
          uri = voiceRecorder.uri;
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
        await resetRecordingAudioMode();
      }
    },
    [
      __DEV__,
      clearAllVoiceTimers,
      t,
      voiceRecorder,
      resetRecordingAudioMode,
      setLiveVoiceTranscript,
      setVoiceInputState,
      setVoiceModeError,
      waitForVoiceProcessingToFinish,
    ],
  );

  const sendVoiceAudioToServer = useCallback(
    (voicePayload: VoiceAudioPayload) => {
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
      __DEV__,
      t,
      telemetry,
      sendMessage,
      setLiveVoiceTranscript,
      setVoiceInputState,
      setVoiceModeError,
    ],
  );

  // Keep stable refs current for use by silence detection interval
  stopVoiceRecordingAndCaptureRef.current = stopVoiceRecordingAndCapture;
  sendVoiceAudioToServerRef.current = sendVoiceAudioToServer;

  const discardVoiceRecording = useCallback(async () => {
    // Stop all timers
    clearAllVoiceTimers();
    pendingDiscardRef.current = true;

    if (isProcessingVoiceRef.current) {
      await waitForVoiceProcessingToFinish();
    }

    if (voiceInputStateRef.current === 'recording') {
      await stopVoiceRecordingAndCapture({ discard: true });
    }
    pendingDiscardRef.current = false;
    voiceInputStateRef.current = 'idle';
    setVoiceInputState('idle');
    setLiveVoiceTranscript('');
    setVoiceModeError(null);
  }, [
    clearAllVoiceTimers,
    stopVoiceRecordingAndCapture,
    setLiveVoiceTranscript,
    setVoiceInputState,
    setVoiceModeError,
    waitForVoiceProcessingToFinish,
  ]);

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
