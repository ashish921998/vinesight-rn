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
  AssistantGatewayError,
  AssistantGatewayErrorCode,
} from '@/services/assistant-gateway';
import { useVoiceRecorder } from './use-voice-recorder';
import type { RecordingResultData } from './use-voice-recorder';
import type { VoiceModeState } from '@/components/assistant/VoiceMode/AnimatedOrb';
import type { VoiceModeMessage } from '@/components/assistant/VoiceMode/VoiceThread';
import type { ChatMessage } from '@/types/ai';
import type { SupportedLanguageCode } from '@/i18n/languages';
import type { AssistantFarmContext } from './use-assistant';

// ─── Types ────────────────────────────────────────────────────────────────────

export type VoiceModeErrorKind =
  | 'permission_denied'
  | 'recording_failed'
  | 'stt_failed'
  | 'network_error'
  | 'timeout'
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
    if (
      err.code === AssistantGatewayErrorCode.NETWORK_ERROR ||
      err.code === AssistantGatewayErrorCode.TIMEOUT
    ) {
      return { kind: 'network_error', message: err.message };
    }
    if (err.code === AssistantGatewayErrorCode.AUDIO_VALIDATION_FAILED) {
      return { kind: 'stt_failed', message: err.message };
    }
    return { kind: 'stt_failed', message: err.message };
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

  // ─── Recording complete handler ──────────────────────────────────────────

  const handleRecordingComplete = useCallback(async (result: RecordingResultData) => {
    // If voice mode was closed before recording finished, discard
    if (!isOpenRef.current) return;

    setVoiceState('processing');

    const { conversationId, language, farmContext, onNewMessage, onConversationIdChange } =
      optionsRef.current;

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
        { requestId: `voice-${Date.now()}` },
      );

      // Still open after await?
      if (!isOpenRef.current) return;

      // Propagate new conversation ID
      const newConversationId = response.message.conversationId;
      if (newConversationId && !conversationId) {
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

      // Also surface assistant message in the main chat thread
      onNewMessage?.(response.message);

      // Surface a synthetic user message in the main chat thread (transcript-based)
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

      setBackendError(null);

      // Transition to speaking if audio is available (TTS handled by next feature)
      if (response.message.audio?.base64 || response.message.audio?.url) {
        setVoiceState('speaking');
      } else {
        setVoiceState('idle');
      }
    } catch (err) {
      if (!isOpenRef.current) return;

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

    if (voiceState === 'idle' || voiceState === 'error') {
      // Start recording
      void (async () => {
        const started = await startRecording();
        if (started) {
          setVoiceState('listening');
        } else {
          // startRecording sets recorderError — transition to error state
          setVoiceState('error');
        }
      })();
    } else if (voiceState === 'listening') {
      // Manual stop — result comes via handleRecordingComplete callback
      stopRecording();
      // voiceState transitions to 'processing' in handleRecordingComplete
    } else if (voiceState === 'speaking') {
      // Interrupt speaking (actual playback interruption handled by TTS feature)
      // Transition directly to listening
      void (async () => {
        const started = await startRecording();
        if (started) {
          setVoiceState('listening');
        } else {
          setVoiceState('idle');
        }
      })();
    }
    // Processing state: orb is disabled in VoiceModeModal — this branch is never reached
  }, [voiceState, startRecording, stopRecording, clearRecorderError]);

  // ─── handleClose ─────────────────────────────────────────────────────────

  const handleClose = useCallback(() => {
    isOpenRef.current = false;

    // Stop recording if active
    if (isRecording) {
      stopRecording();
    }

    setIsVoiceModeVisible(false);
    setVoiceState('idle');
    setBackendError(null);
    clearRecorderError();
  }, [isRecording, stopRecording, clearRecorderError]);

  // ─── clearVoiceModeError ─────────────────────────────────────────────────

  const clearVoiceModeError = useCallback(() => {
    setBackendError(null);
    clearRecorderError();
    if (voiceState === 'error') {
      setVoiceState('idle');
    }
  }, [voiceState, clearRecorderError]);

  return {
    voiceState,
    voiceMessages,
    isVoiceModeVisible,
    openVoiceMode,
    handleOrbPress,
    handleClose,
    voiceModeError,
    clearVoiceModeError,
  };
}
