/**
 * useVoiceRecorder Hook
 * Manages audio recording lifecycle for voice mode.
 *
 * Features:
 * - Platform-specific recording options (WAV/LPCM on iOS, AAC on Android)
 * - Permission checking via expo-audio
 * - Silence detection: auto-stops after 2 seconds of silence (metering < -40 dBFS)
 * - Maximum recording duration: 60 seconds via forDuration param
 * - Reads recorded audio as base64 via expo-file-system
 * - Fires onRecordingComplete callback when recording finishes (any cause)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import {
  useAudioRecorder,
  useAudioRecorderState,
  requestRecordingPermissionsAsync,
  getRecordingPermissionsAsync,
  setAudioModeAsync,
  IOSOutputFormat,
  AudioQuality,
} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import type { RecordingOptions } from 'expo-audio';

// ─── Constants ───────────────────────────────────────────────────────────────

/** dBFS threshold below which audio counts as silence */
const SILENCE_THRESHOLD_DB = -40;

/** How long (ms) continuous silence must last before auto-stopping */
const SILENCE_TIMEOUT_MS = 2000;

/** Maximum recording duration in seconds (auto-stops after this) */
export const MAX_RECORDING_DURATION_SECONDS = 60;

/** How often (ms) to poll recorder state for metering + silence detection */
const METERING_POLL_INTERVAL_MS = 200;

// ─── Recording Options ───────────────────────────────────────────────────────

/**
 * Platform-aware recording options.
 * iOS: WAV (LINEARPCM) at 16kHz mono — compatible with Sarvam STT.
 * Android: AAC/M4A at 16kHz mono.
 */
const RECORDING_OPTIONS: RecordingOptions = {
  extension: Platform.OS === 'ios' ? '.wav' : '.m4a',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: Platform.OS === 'ios' ? 256000 : 64000,
  isMeteringEnabled: true,
  ios: {
    extension: '.wav',
    sampleRate: 16000,
    outputFormat: IOSOutputFormat.LINEARPCM,
    audioQuality: AudioQuality.HIGH,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  android: {
    extension: '.m4a',
    sampleRate: 16000,
    outputFormat: 'mpeg4',
    audioEncoder: 'aac',
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 64000,
  },
};

// ─── Types ───────────────────────────────────────────────────────────────────

export type VoiceRecorderErrorKind = 'permission_denied' | 'recording_failed' | 'read_failed';

export interface VoiceRecorderError {
  kind: VoiceRecorderErrorKind;
  message: string;
}

export interface RecordingResultData {
  uri: string;
  base64: string;
  /** 'wav' on iOS, 'm4a' on Android, 'webm' on web */
  format: string;
  durationSeconds: number;
  autoStopReason?: 'silence' | 'maxDuration';
}

export interface UseVoiceRecorderReturn {
  /** Whether recording is currently in progress */
  isRecording: boolean;
  /** Duration of current/last recording in ms */
  durationMillis: number;
  /**
   * Start recording.
   * Returns true if recording started successfully.
   * Returns false if permission denied or other setup error (error state is set).
   */
  startRecording: () => Promise<boolean>;
  /**
   * Manually stop recording.
   * The result will be delivered asynchronously via the onRecordingComplete callback.
   */
  stopRecording: () => void;
  error: VoiceRecorderError | null;
  clearError: () => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * @param onRecordingComplete - Called when recording stops (any reason).
 *   Delivers the audio data (base64, URI, format, duration) asynchronously.
 */
export function useVoiceRecorder(
  onRecordingComplete?: (result: RecordingResultData) => void,
): UseVoiceRecorderReturn {
  const [error, setError] = useState<VoiceRecorderError | null>(null);

  // Keep latest callback in a ref to avoid stale closures in effects
  const onCompleteRef = useRef(onRecordingComplete);
  useEffect(() => {
    onCompleteRef.current = onRecordingComplete;
  }, [onRecordingComplete]);

  // Silence detection: tracks when continuous silence started
  const silenceStartTimeRef = useRef<number | null>(null);
  // Prevents duplicate result processing once recording has fully stopped
  const isProcessingStopRef = useRef(false);
  // Prevents re-entrant stop calls while a stop request is already in flight
  const isStopRequestedRef = useRef(false);
  // Set just before calling recorder.stop() so handleRecordingFinished knows the reason
  const autoStopReasonRef = useRef<'silence' | 'maxDuration' | undefined>(undefined);
  // True when recording has been active this session (guards the stop-detection effect)
  const wasRecordingRef = useRef(false);
  // Captured durationMillis at the moment recording ends (recorder may reset to 0)
  const lastDurationMillisRef = useRef(0);

  // ── expo-audio hooks ──────────────────────────────────────────────────────

  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  // Poll recorder state frequently for responsive silence detection
  const recorderState = useAudioRecorderState(recorder, METERING_POLL_INTERVAL_MS);
  const isRecordingRef = useRef(false);

  useEffect(() => {
    isRecordingRef.current = recorderState.isRecording;
  }, [recorderState.isRecording]);

  // ── Internal: read file and fire callback ─────────────────────────────────

  const handleRecordingFinished = useCallback(async () => {
    if (isProcessingStopRef.current) return;
    isProcessingStopRef.current = true;
    isStopRequestedRef.current = false;

    try {
      try {
        await setAudioModeAsync({
          allowsRecording: false,
          playsInSilentMode: true,
          shouldRouteThroughEarpiece: false,
          shouldPlayInBackground: false,
        });
      } catch {
        // Non-critical
      }

      const uri = recorder.uri;
      if (!uri) {
        setError({ kind: 'recording_failed', message: 'No recording URI available after stop' });
        return;
      }

      const durationSeconds = lastDurationMillisRef.current / 1000;
      const format = Platform.OS === 'ios' ? 'wav' : Platform.OS === 'android' ? 'm4a' : 'webm';
      const reason = autoStopReasonRef.current;

      let base64: string;
      try {
        base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: 'base64',
        });
      } catch (readErr) {
        setError({ kind: 'read_failed', message: String(readErr) });
        return;
      }

      if (!base64 || base64.length === 0) {
        setError({ kind: 'read_failed', message: 'Empty audio file after recording' });
        return;
      }

      // Reset auto-stop reason for next recording session
      autoStopReasonRef.current = undefined;

      const result: RecordingResultData = {
        uri,
        base64,
        format,
        durationSeconds,
        ...(reason != null ? { autoStopReason: reason } : {}),
      };

      onCompleteRef.current?.(result);
    } finally {
      isProcessingStopRef.current = false;
    }
  }, [recorder]);

  // ── Effect: detect recording → stopped transition ─────────────────────────

  // Store handleRecordingFinished in a ref to keep effect deps minimal
  const handleFinishedRef = useRef(handleRecordingFinished);
  useEffect(() => {
    handleFinishedRef.current = handleRecordingFinished;
  }, [handleRecordingFinished]);

  useEffect(() => {
    return () => {
      silenceStartTimeRef.current = null;
      autoStopReasonRef.current = undefined;

      if (isRecordingRef.current || isStopRequestedRef.current) {
        isStopRequestedRef.current = true;
        void recorder.stop();
      }

      void setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        shouldRouteThroughEarpiece: false,
      }).catch(() => undefined);
    };
  }, [recorder]);

  useEffect(() => {
    const isRecordingNow = recorderState.isRecording;

    if (isRecordingNow && recorderState.durationMillis > 0) {
      // Track latest duration so we have it when recording stops
      lastDurationMillisRef.current = recorderState.durationMillis;
    }

    if (wasRecordingRef.current && !isRecordingNow) {
      // Recording just stopped — reset guard immediately to prevent double-fire
      wasRecordingRef.current = false;
      void handleFinishedRef.current();
    } else if (isRecordingNow && !wasRecordingRef.current) {
      wasRecordingRef.current = true;
    }
  }, [recorderState.isRecording, recorderState.durationMillis]);

  // ── Effect: silence detection ─────────────────────────────────────────────

  useEffect(() => {
    if (!recorderState.isRecording || isStopRequestedRef.current) return;

    const metering = recorderState.metering;
    if (metering === undefined || metering === null) return;

    const now = Date.now();

    if (metering < SILENCE_THRESHOLD_DB) {
      if (silenceStartTimeRef.current === null) {
        silenceStartTimeRef.current = now;
      } else if (now - silenceStartTimeRef.current >= SILENCE_TIMEOUT_MS) {
        // Silence timeout — auto-stop
        silenceStartTimeRef.current = null;
        autoStopReasonRef.current = 'silence';
        isStopRequestedRef.current = true;
        void recorder.stop();
      }
    } else {
      // Sound detected — reset silence timer
      silenceStartTimeRef.current = null;
    }
  }, [recorderState.isRecording, recorderState.metering, recorder]);

  // ── Public: startRecording ────────────────────────────────────────────────

  const startRecording = useCallback(async (): Promise<boolean> => {
    setError(null);
    silenceStartTimeRef.current = null;
    isProcessingStopRef.current = false;
    isStopRequestedRef.current = false;
    autoStopReasonRef.current = undefined;
    lastDurationMillisRef.current = 0;

    // ── Permission check ────────────────────────────────────────────────────
    try {
      const existing = await getRecordingPermissionsAsync();
      let granted = existing.granted;

      if (!granted) {
        const request = await requestRecordingPermissionsAsync();
        granted = request.granted;
      }

      if (!granted) {
        setError({ kind: 'permission_denied', message: 'Microphone permission was denied' });
        return false;
      }
    } catch (permErr) {
      setError({ kind: 'recording_failed', message: String(permErr) });
      return false;
    }

    // ── Configure audio session (iOS needs allowsRecording: true) ──────────
    try {
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        interruptionMode: 'doNotMix',
        shouldPlayInBackground: false,
        shouldRouteThroughEarpiece: false,
      });
    } catch {
      // Non-critical — continue even if audio mode fails
    }

    // ── Prepare + start ────────────────────────────────────────────────────
    try {
      await recorder.prepareToRecordAsync();
      recorder.record({ forDuration: MAX_RECORDING_DURATION_SECONDS });
      autoStopReasonRef.current = 'maxDuration';
      return true;
    } catch (startErr) {
      setError({ kind: 'recording_failed', message: String(startErr) });
      return false;
    }
  }, [recorder]);

  // ── Public: stopRecording ─────────────────────────────────────────────────

  const stopRecording = useCallback((): void => {
    if (!recorderState.isRecording || isStopRequestedRef.current) return;

    // Reset silence timer before stopping
    silenceStartTimeRef.current = null;
    // Mark as manual stop (overrides the pre-set 'maxDuration')
    autoStopReasonRef.current = undefined;
    isStopRequestedRef.current = true;

    void recorder.stop();
    // Result is delivered asynchronously via onRecordingComplete callback
  }, [recorder, recorderState.isRecording]);

  const clearError = useCallback((): void => {
    setError(null);
  }, []);

  return {
    isRecording: recorderState.isRecording,
    durationMillis: recorderState.durationMillis,
    startRecording,
    stopRecording,
    error,
    clearError,
  };
}
