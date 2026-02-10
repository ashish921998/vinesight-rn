/**
 * Farm Assistant Hook
 * Orchestrates the full query flow: classify → clarify → fetch → compute → verbalize
 * Includes voice recognition lifecycle via expo-speech-recognition
 */

import { useCallback, useRef, useEffect } from 'react';
import { Platform } from 'react-native';
import * as Speech from 'expo-speech';
import {
  ExpoSpeechRecognitionModule as _SpeechModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { useFarmAssistantStore } from '@/stores/farm-assistant-store';
import { useFarms } from './use-farms';
import { useLanguageStore } from '@/stores/language-store';
import {
  classifyIntent,
  buildClarification,
  checkUnsupportedIntent,
  executeQuery,
} from '@/services/farm-assistant-service';
import type {
  FarmAssistantStatus,
  AssistantAnswer,
  ClarificationPrompt,
} from '@/types/voice-assistant';
import type { SupportedLanguageCode } from '@/i18n/languages';
import { telemetry } from '@/services/telemetry';

// Cast to bypass web type resolution — native module has these methods at runtime
const ExpoSpeechRecognitionModule = _SpeechModule as typeof _SpeechModule & {
  getPermissionsAsync(): Promise<{ status: string; granted: boolean }>;
  requestPermissionsAsync(): Promise<{ status: string; granted: boolean }>;
  start(options: { lang: string; interimResults: boolean; continuous: boolean }): void;
  stop(): void;
  abort(): void;
};

const MAX_QUERIES_PER_MINUTE = 10;

const LOCALE_MAP: Record<SupportedLanguageCode, string> = {
  en: 'en-IN',
  mr: 'mr-IN',
  hi: 'hi-IN',
};

export function useFarmAssistant() {
  const { data: farms = [] } = useFarms();
  const language = useLanguageStore((s) => s.language) ?? 'en';
  const speechLocale = LOCALE_MAP[language] ?? 'en-IN';

  // Subscribe only to values needed for rendering/return (causes re-renders)
  const isModalVisible = useFarmAssistantStore((s) => s.isModalVisible);
  const status = useFarmAssistantStore((s) => s.status);
  const transcript = useFarmAssistantStore((s) => s.transcript);
  const answer = useFarmAssistantStore((s) => s.answer);
  const clarification = useFarmAssistantStore((s) => s.clarification);
  const error = useFarmAssistantStore((s) => s.error);
  const isMicAvailable = useFarmAssistantStore((s) => s.isMicAvailable);

  // Destructure actions (referentially stable in Zustand)
  const {
    openModal: storeOpenModal,
    closeModal: storeCloseModal,
    setStatus: storeSetStatus,
    setTranscript: storeSetTranscript,
    setIntent: storeSetIntent,
    setAnswer: storeSetAnswer,
    setClarification: storeSetClarification,
    setError: storeSetError,
    setMicAvailable: storeSetMicAvailable,
    reset: storeReset,
  } = useFarmAssistantStore((s) => ({
    openModal: s.openModal,
    closeModal: s.closeModal,
    setStatus: s.setStatus,
    setTranscript: s.setTranscript,
    setIntent: s.setIntent,
    setAnswer: s.setAnswer,
    setClarification: s.setClarification,
    setError: s.setError,
    setMicAvailable: s.setMicAvailable,
    reset: s.reset,
  }));

  const queryTimestamps = useRef<number[]>([]);
  const pendingTranscriptRef = useRef<string>('');
  const hasSubmittedVoiceQueryRef = useRef(false);
  const isStartingListeningRef = useRef(false);
  const submitQueryRef = useRef<((text: string) => Promise<void>) | undefined>(undefined);

  const isRateLimited = useCallback((): boolean => {
    const now = Date.now();
    queryTimestamps.current = queryTimestamps.current.filter((t) => now - t < 60000);
    return queryTimestamps.current.length >= MAX_QUERIES_PER_MINUTE;
  }, []);

  const speakAnswer = useCallback((text: string, lang: SupportedLanguageCode) => {
    const languageMap: Record<SupportedLanguageCode, string> = {
      en: 'en-IN',
      hi: 'hi-IN',
      mr: 'mr-IN',
    };

    Speech.speak(text, {
      language: languageMap[lang] || 'en-IN',
      pitch: 1.0,
      rate: 0.9,
    });
  }, []);

  const submitQuery = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      // Read status at call time to avoid dependency on subscribed value
      const currentStatus = useFarmAssistantStore.getState().status;

      // Stop any active voice recognition
      if (currentStatus === 'listening') {
        hasSubmittedVoiceQueryRef.current = true;
        try {
          ExpoSpeechRecognitionModule.abort();
        } catch {
          /* ignore */
        }
      }

      if (isRateLimited()) {
        storeSetError('Too many queries. Please wait a moment.');
        telemetry.capture('farm_assistant_error', {
          error_type: 'rate_limited',
          message: 'Too many queries. Please wait a moment.',
        });
        return;
      }

      queryTimestamps.current.push(Date.now());
      storeSetTranscript(text);
      storeSetStatus('processing');

      telemetry.capture('farm_assistant_query_submitted', {
        query_length: text.length,
        input_method: 'text',
      });

      try {
        const unsupported = checkUnsupportedIntent(text);
        if (unsupported) {
          storeSetError(unsupported.message);
          telemetry.capture('farm_assistant_error', {
            error_type: 'unsupported',
            message: unsupported.message,
          });
          return;
        }

        const intent = classifyIntent(text, farms);
        storeSetIntent(intent);

        const clarification = buildClarification(intent);
        if (clarification) {
          storeSetClarification(clarification);
          telemetry.capture('farm_assistant_clarification_triggered', {
            has_category: !!intent.category,
            confidence: intent.confidence,
          });
          return;
        }

        if (!intent.category) {
          const noCategMsg =
            "I couldn't understand that question. I can help with spray, irrigation, fertigation, and expense history.";
          storeSetError(noCategMsg);
          telemetry.capture('farm_assistant_error', {
            error_type: 'no_category',
            message: noCategMsg,
          });
          return;
        }

        telemetry.capture('farm_assistant_category_detected', {
          category: intent.category,
          query_type: intent.queryType,
          confidence: intent.confidence,
          has_time_range: !!intent.timeRange,
          has_farm_filter: !!intent.farmName,
        });

        const result = await executeQuery(text, farms, language);
        storeSetAnswer(result.answer);

        // Speak the answer aloud
        if (result.answer.verbalizedText) {
          speakAnswer(result.answer.verbalizedText, language);
        }

        telemetry.capture('farm_assistant_answer_delivered', {
          category: result.answer.category,
          query_type: result.answer.queryType,
          record_count: result.answer.totalRecordCount,
          has_verbalization: !!result.answer.verbalizedText,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Something went wrong. Please try again.';
        storeSetError(message);
        telemetry.capture('farm_assistant_error', {
          error_type: 'query_failed',
          message,
        });
      }
    },
    [
      farms,
      language,
      isRateLimited,
      speakAnswer,
      storeSetError,
      storeSetTranscript,
      storeSetStatus,
      storeSetIntent,
      storeSetClarification,
      storeSetAnswer,
    ],
  );

  // Keep ref in sync with latest submitQuery
  useEffect(() => {
    submitQueryRef.current = submitQuery;
  }, [submitQuery]);

  // Voice recognition event handlers (use ref to avoid circular dependency)
  useSpeechRecognitionEvent('start', () => {
    storeSetStatus('listening');
  });

  useSpeechRecognitionEvent('end', () => {
    const currentStatus = useFarmAssistantStore.getState().status;
    if (currentStatus !== 'listening') return;

    const finalTranscript = pendingTranscriptRef.current.trim();
    if (finalTranscript && !hasSubmittedVoiceQueryRef.current) {
      hasSubmittedVoiceQueryRef.current = true;
      submitQueryRef.current?.(finalTranscript);
      return;
    }

    storeSetStatus('idle');
  });

  useSpeechRecognitionEvent('result', (event) => {
    const resultTranscript = event.results[0]?.transcript ?? '';
    pendingTranscriptRef.current = resultTranscript;
    storeSetTranscript(resultTranscript);

    if (event.isFinal && resultTranscript.trim() && !hasSubmittedVoiceQueryRef.current) {
      hasSubmittedVoiceQueryRef.current = true;
      submitQueryRef.current?.(resultTranscript.trim());
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    if (event.error === 'no-speech') {
      storeSetStatus('idle');
      return;
    }
    if (event.error === 'not-allowed') {
      storeSetMicAvailable(false);
      storeSetStatus('idle');
      return;
    }
    // Ignore 'aborted' errors — these are programmatic (e.g., user closed modal, submitted query)
    if (event.error === 'aborted') {
      return;
    }
    storeSetError(event.message ?? 'Voice recognition failed. Try typing your question.');
    telemetry.capture('farm_assistant_error', {
      error_type: 'voice_recognition',
      message: event.message,
      error_code: event.error,
    });
  });

  // Check mic permissions on mount
  useEffect(() => {
    if (Platform.OS === 'web') {
      storeSetMicAvailable(false);
      return;
    }
    ExpoSpeechRecognitionModule.getPermissionsAsync()
      .then((result) => {
        if (result.status === 'denied') {
          storeSetMicAvailable(false);
        }
      })
      .catch(() => {
        storeSetMicAvailable(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startListening = useCallback(async () => {
    // Read status at call time to avoid dependency on subscribed value
    const currentStatus = useFarmAssistantStore.getState().status;

    // Don't start if already listening to prevent crashes
    if (currentStatus === 'listening' || isStartingListeningRef.current) {
      return;
    }

    isStartingListeningRef.current = true;

    try {
      const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!result.granted) {
        storeSetMicAvailable(false);
        storeSetStatus('idle');
        return;
      }
      storeSetMicAvailable(true);
      pendingTranscriptRef.current = '';
      hasSubmittedVoiceQueryRef.current = false;
      storeSetTranscript('');
      storeSetStatus('listening');

      await Promise.resolve(
        ExpoSpeechRecognitionModule.start({
          lang: speechLocale,
          interimResults: true,
          continuous: false,
        }),
      );
    } catch (err) {
      console.warn('Speech recognition start failed:', err);
      storeSetStatus('idle');
      storeSetMicAvailable(false);
      storeSetError('Voice recognition is not available on this device.');
    } finally {
      isStartingListeningRef.current = false;
    }
  }, [speechLocale, storeSetMicAvailable, storeSetStatus, storeSetTranscript, storeSetError]);

  const stopListening = useCallback(() => {
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch (err) {
      console.warn('Speech recognition stop failed:', err);
      storeSetStatus('idle');
    }
  }, [storeSetStatus]);

  const selectClarification = useCallback(
    async (option: string) => {
      telemetry.capture('farm_assistant_clarification_selected', { option });

      const currentTranscript = useFarmAssistantStore.getState().transcript;
      const enrichedTranscript = `${currentTranscript} ${option}`;
      storeSetClarification(null);
      storeSetStatus('processing');
      storeSetTranscript(enrichedTranscript);

      try {
        const result = await executeQuery(enrichedTranscript, farms, language);
        storeSetAnswer(result.answer);

        // Speak the answer aloud
        if (result.answer.verbalizedText) {
          speakAnswer(result.answer.verbalizedText, language);
        }

        telemetry.capture('farm_assistant_answer_delivered', {
          category: result.answer.category,
          query_type: result.answer.queryType,
          record_count: result.answer.totalRecordCount,
          has_verbalization: !!result.answer.verbalizedText,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Something went wrong. Please try again.';
        storeSetError(message);
        telemetry.capture('farm_assistant_error', {
          error_type: 'query_failed',
          message,
        });
      }
    },
    [
      farms,
      language,
      speakAnswer,
      storeSetClarification,
      storeSetStatus,
      storeSetTranscript,
      storeSetAnswer,
      storeSetError,
    ],
  );

  const reset = useCallback(() => {
    try {
      ExpoSpeechRecognitionModule.abort();
    } catch {
      /* ignore */
    }
    Speech.stop();
    pendingTranscriptRef.current = '';
    hasSubmittedVoiceQueryRef.current = false;
    storeReset();
  }, [storeReset]);

  const openModal = useCallback(() => {
    storeOpenModal();
  }, [storeOpenModal]);

  const closeModal = useCallback(() => {
    try {
      ExpoSpeechRecognitionModule.abort();
    } catch {
      /* ignore */
    }
    Speech.stop();
    pendingTranscriptRef.current = '';
    hasSubmittedVoiceQueryRef.current = false;
    storeCloseModal();
  }, [storeCloseModal]);

  return {
    isModalVisible,
    status: status as FarmAssistantStatus,
    transcript,
    answer: answer as AssistantAnswer | null,
    clarification: clarification as ClarificationPrompt | null,
    error,
    isMicAvailable,

    startListening,
    stopListening,
    submitQuery,
    selectClarification,
    reset,
    openModal,
    closeModal,
    speakAnswer,
  };
}
