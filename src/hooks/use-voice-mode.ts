/**
 * useVoiceMode Hook
 * Orchestrates the full voice mode conversation flow:
 *
 * State machine: idle → listening → processing → speaking → idle (loop)
 * Error states: idle → error (with retry) → listening (on retry)
 *
 * Responsibilities:
 * - Voice mode visibility
 * - Driving VoiceModeModal state (voiceState)
 * - Starting/stopping recording (via useVoiceRecorder)
 * - Sending audio to backend via sendAssistantTurn (input_mode: 'audio')
 * - Managing voice conversation thread (VoiceModeMessage[])
 * - Persisting voice messages to main conversation via onNewMessage callback
 * - Error handling: STT failure, network failure, permission denied
 * - Propagating conversation ID changes back to caller
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  sendAssistantTurn,
  cancelPendingAssistantTurnRequest,
  AssistantGatewayError,
  AssistantGatewayErrorCode,
} from '@/services/assistant-gateway';
import { voiceOutputService } from '@/services/voice-output';
import { useVoiceRecorder } from './use-voice-recorder';
import type { RecordingResultData } from './use-voice-recorder';
import type { VoiceModeState } from '@/components/assistant/VoiceMode/AnimatedOrb';
import type { VoiceModeMessage } from '@/components/assistant/VoiceMode/VoiceThread';
import type { AssistantVoiceLogAction, ChatMessage } from '@/types/ai';
import type { SupportedLanguageCode } from '@/i18n/languages';
import type { AssistantFarmContext } from './use-assistant';

// ─── Types ────────────────────────────────────────────────────────────────────

export type VoiceModeErrorKind =
  | 'permission_denied'
  | 'recording_failed'
  | 'stt_failed'
  | 'network_error'
  | 'timeout'
  | 'gateway_error'
  | 'unknown';

export interface VoiceModeError {
  kind: VoiceModeErrorKind;
  message: string;
}

export interface UseVoiceModeOptions {
  /** Conversation ID from the parent chat session */
  conversationId: string | null;
  language: SupportedLanguageCode;
  farmContext?: AssistantFarmContext;
  /**
   * Called when a new message (user or assistant) is produced by voice mode.
   * Used to persist voice messages into the main chat thread.
   */
  onNewMessage?: (message: ChatMessage) => void;
  /**
   * Called when voice mode creates / updates the conversation ID.
   */
  onConversationIdChange?: (id: string) => void;
  /**
   * Called when a voice turn produces a voiceLogAction (activity log flow).
   */
  onVoiceLogAction?: (action: AssistantVoiceLogAction) => void;
}

export interface UseVoiceModeReturn {
  voiceState: VoiceModeState;
  voiceMessages: VoiceModeMessage[];
  isVoiceModeVisible: boolean;
  openVoiceMode: () => void;
  /** Handles orb tap: starts recording in idle, stops in listening, retries in error */
  handleOrbPress: () => void;
  /** Closes voice mode and stops any in-progress recording */
  handleClose: () => void;
  /** Combined error from recording or backend (null when no error) */
  voiceModeError: VoiceModeError | null;
  clearVoiceModeError: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function classifyGatewayError(err: unknown): VoiceModeError {
  if (err instanceof AssistantGatewayError) {
    if (err.code === AssistantGatewayErrorCode.NETWORK_ERROR) {
      return { kind: 'network_error', message: err.message };
    }
    if (err.code === AssistantGatewayErrorCode.TIMEOUT) {
      return { kind: 'timeout', message: err.message };
    }
    if (err.code === AssistantGatewayErrorCode.AUDIO_VALIDATION_FAILED) {
      return { kind: 'stt_failed', message: err.message };
    }
    return { kind: 'gateway_error', message: err.message };
  }
  if (err instanceof Error) {
    return { kind: 'unknown', message: err.message };
  }
  return { kind: 'unknown', message: String(err) };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useVoiceMode(options: UseVoiceModeOptions): UseVoiceModeReturn {
  const [voiceState, setVoiceState] = useState<VoiceModeState>('idle');
  const [voiceMessages, setVoiceMessages] = useState<VoiceModeMessage[]>([]);
  const [isVoiceModeVisible, setIsVoiceModeVisible] = useState(false);
  const [backendError, setBackendError] = useState<VoiceModeError | null>(null);

  // Keep the latest options in a ref to avoid stale closures in async code
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  // Tracks whether voice mode is still open when an async response arrives
  const isOpenRef = useRef(false);

  // Stable ref to the latest startRecording so handleRecordingComplete's TTS
  // onDone callback can trigger auto-listen without a stale closure.
  // Initialised to a no-op; updated after useVoiceRecorder is called.
  const startRecordingRef = useRef<() => Promise<boolean>>(async () => false);
  const stopRecordingRef = useRef<() => void>(() => undefined);
  const clearRecorderErrorRef = useRef<() => void>(() => undefined);
  const isRecordingRef = useRef(false);

  // Tracks the in-flight voice request ID for cancellation
  const voiceRequestIdRef = useRef<string | null>(null);

  // ─── Recording complete handler ──────────────────────────────────────────

  const handleRecordingComplete = useCallback(async (result: RecordingResultData) => {
    // If voice mode was closed before recording finished, discard
    if (!isOpenRef.current) return;

    setVoiceState('processing');

    const { conversationId, language, farmContext, onNewMessage, onConversationIdChange } =
      optionsRef.current;

    const requestId = `voice-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;

    // Cancel any previous in-flight voice request
    if (voiceRequestIdRef.current) {
      cancelPendingAssistantTurnRequest(voiceRequestIdRef.current);
    }
    voiceRequestIdRef.current = requestId;

    try {
      const response = await sendAssistantTurn(
        {
          conversationId,
          userMessage: '',
          language,
          inputMode: 'audio',
          inputAudioBase64: result.base64,
          audioFormat: result.format,
          audioDuration: result.durationSeconds,
          farmContext,
          clientCanPlayAudio: true,
          clientPersistedUserTurn: false,
        },
        { requestId },
      );

      // Discard if superseded or voice mode closed
      if (!isOpenRef.current || voiceRequestIdRef.current !== requestId) return;
      voiceRequestIdRef.current = null;

      // Propagate new conversation ID
      const newConversationId = response.message.conversationId;
      if (newConversationId && newConversationId !== conversationId) {
        onConversationIdChange?.(newConversationId);
      }

      // Build the user transcript message for the thread
      const transcriptText = response.userTranscript ?? '🎤';

      const userVoiceMsg: VoiceModeMessage = {
        id: `vm-user-${Date.now()}`,
        role: 'user',
        text: transcriptText,
        timestamp: new Date(),
      };

      const assistantVoiceMsg: VoiceModeMessage = {
        id: response.message.id,
        role: 'assistant',
        text: response.message.content,
        timestamp: response.message.timestamp,
      };

      setVoiceMessages((prev) => [...prev, userVoiceMsg, assistantVoiceMsg]);

      // Surface a synthetic user message FIRST, then the assistant reply.
      // This ensures correct turn order (user → assistant) in the main chat thread.
      if (response.userTranscript) {
        const userChatMessage: ChatMessage = {
          id: userVoiceMsg.id,
          role: 'user',
          content: response.userTranscript,
          timestamp: userVoiceMsg.timestamp,
          conversationId: newConversationId ?? conversationId ?? undefined,
          inputMode: 'audio',
        };
        onNewMessage?.(userChatMessage);
      }

      // Then surface assistant message in the main chat thread
      onNewMessage?.(response.message);

      // Propagate voice log action to parent (activity log confirmation flow)
      if (response.voiceLogAction) {
        optionsRef.current.onVoiceLogAction?.(response.voiceLogAction);
      }

      setBackendError(null);

      // Transition state and handle TTS playback
      if (__DEV__) {
        console.log('[use-voice-mode] Audio decision:', {
          hasAudio: Boolean(response.message.audio),
          hasBase64: Boolean(response.message.audio?.base64),
          hasUrl: Boolean(response.message.audio?.url),
          audioProvider: response.message.audio?.provider ?? null,
          audioMimeType: response.message.audio?.mimeType ?? null,
          ttsSkippedReason: response.ttsSkippedReason ?? null,
          userTranscript: response.userTranscript ?? null,
        });
      }
      if (response.message.audio?.base64 || response.message.audio?.url) {
        // Audio present → enter speaking state and play via voiceOutputService
        setVoiceState('speaking');
        void voiceOutputService.playAssistantTurn(response, {
          language: optionsRef.current.language,
          onDone: () => {
            // Natural end of TTS playback → auto-listen for next question
            if (!isOpenRef.current) return;
            void (async () => {
              const started = await startRecordingRef.current();
              if (!isOpenRef.current) {
                if (started) {
                  stopRecordingRef.current();
                }
                return;
              }
              setVoiceState(started ? 'listening' : 'idle');
            })();
          },
          onStopped: () => {
            // TTS stopped externally (e.g., Speech.speak stop signal).
            // The orb-tap interruption flow (handleOrbPress) already manages
            // its own state transition, so only revert to idle if still speaking.
            if (!isOpenRef.current) return;
            setVoiceState((prev) => (prev === 'speaking' ? 'idle' : prev));
          },
          onError: () => {
            // TTS error — display text already added to thread; return to idle
            if (!isOpenRef.current) return;
            setVoiceState('idle');
          },
        });
      } else {
        // No audio returned (TTS failed / skipped) — text is already displayed
        // in the thread; transition to idle so user can tap to speak again.
        setVoiceState('idle');
      }
    } catch (err) {
      if (!isOpenRef.current || voiceRequestIdRef.current !== requestId) return;
      voiceRequestIdRef.current = null;

      // Silently ignore cancellation
      if (err instanceof AssistantGatewayError && err.code === AssistantGatewayErrorCode.CANCELED) {
        return;
      }

      const classified = classifyGatewayError(err);
      setBackendError(classified);
      setVoiceState('error');
    }
  }, []);

  // ─── useVoiceRecorder ────────────────────────────────────────────────────

  const {
    isRecording,
    startRecording,
    stopRecording,
    error: recorderError,
    clearError: clearRecorderError,
  } = useVoiceRecorder(handleRecordingComplete);

  // Keep startRecordingRef up-to-date so TTS onDone can trigger auto-listen
  useEffect(() => {
    startRecordingRef.current = startRecording;
  }, [startRecording]);

  useEffect(() => {
    stopRecordingRef.current = stopRecording;
  }, [stopRecording]);

  useEffect(() => {
    clearRecorderErrorRef.current = clearRecorderError;
  }, [clearRecorderError]);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    return () => {
      isOpenRef.current = false;

      if (voiceRequestIdRef.current) {
        cancelPendingAssistantTurnRequest(voiceRequestIdRef.current);
        voiceRequestIdRef.current = null;
      }

      void voiceOutputService.stop();

      if (isRecordingRef.current) {
        stopRecordingRef.current();
      }

      clearRecorderErrorRef.current();
    };
  }, []);

  // ─── Derive combined error ────────────────────────────────────────────────

  const voiceModeError: VoiceModeError | null = (() => {
    if (recorderError !== null) {
      if (recorderError.kind === 'permission_denied') {
        return { kind: 'permission_denied', message: recorderError.message };
      }
      return { kind: 'recording_failed', message: recorderError.message };
    }
    return backendError;
  })();
  const effectiveVoiceState: VoiceModeState = recorderError !== null ? 'error' : voiceState;

  // ─── openVoiceMode ────────────────────────────────────────────────────────

  const openVoiceMode = useCallback(() => {
    isOpenRef.current = true;
    setVoiceState('idle');
    setVoiceMessages([]);
    setBackendError(null);
    setIsVoiceModeVisible(true);
  }, []);

  // ─── handleOrbPress ───────────────────────────────────────────────────────

  const handleOrbPress = useCallback(() => {
    setBackendError(null);
    clearRecorderError();

    if (effectiveVoiceState === 'idle' || effectiveVoiceState === 'error') {
      // Start recording
      void (async () => {
        const started = await startRecording();
        if (!isOpenRef.current) {
          if (started) {
            stopRecordingRef.current();
          }
          return;
        }
        // startRecording sets recorderError on failure.
        setVoiceState(started ? 'listening' : 'error');
      })();
    } else if (effectiveVoiceState === 'listening') {
      // Manual stop — result comes via handleRecordingComplete callback
      stopRecording();
      // voiceState transitions to 'processing' in handleRecordingComplete
    } else if (effectiveVoiceState === 'speaking') {
      // Interrupt speaking — await TTS stop, then start listening
      void (async () => {
        try {
          await voiceOutputService.stop();
        } catch {
          // Ignore TTS stop errors
        }
        if (!isOpenRef.current) return;
        try {
          const started = await startRecording();
          if (!isOpenRef.current) {
            if (started) {
              stopRecordingRef.current();
            }
            return;
          }
          setVoiceState(started ? 'listening' : 'idle');
        } catch {
          setVoiceState('idle');
        }
      })();
    }
    // Processing state: orb is disabled in VoiceModeModal — this branch is never reached
  }, [effectiveVoiceState, startRecording, stopRecording, clearRecorderError]);

  // ─── handleClose ─────────────────────────────────────────────────────────

  const handleClose = useCallback(() => {
    isOpenRef.current = false;

    // Cancel any in-flight voice request
    if (voiceRequestIdRef.current) {
      cancelPendingAssistantTurnRequest(voiceRequestIdRef.current);
      voiceRequestIdRef.current = null;
    }

    // Stop any active TTS playback
    void voiceOutputService.stop();

    // stopRecording is idempotent and uses recorder-owned state
    stopRecording();

    setIsVoiceModeVisible(false);
    setVoiceState('idle');
    setBackendError(null);
    clearRecorderError();
  }, [stopRecording, clearRecorderError]);

  // ─── clearVoiceModeError ─────────────────────────────────────────────────

  const clearVoiceModeError = useCallback(() => {
    setBackendError(null);
    clearRecorderError();
    if (effectiveVoiceState === 'error') {
      setVoiceState('idle');
    }
  }, [effectiveVoiceState, clearRecorderError]);

  return {
    voiceState: effectiveVoiceState,
    voiceMessages,
    isVoiceModeVisible,
    openVoiceMode,
    handleOrbPress,
    handleClose,
    voiceModeError,
    clearVoiceModeError,
  };
}
