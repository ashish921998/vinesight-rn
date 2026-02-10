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

  const store = useFarmAssistantStore();
  const queryTimestamps = useRef<number[]>([]);
  const pendingTranscriptRef = useRef<string>('');
  const hasSubmittedVoiceQueryRef = useRef(false);
  const isStartingListeningRef = useRef(false);
  const submitQueryRef = useRef<(text: string) => Promise<void>>(undefined);

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

      // Stop any active voice recognition
      if (store.status === 'listening') {
        hasSubmittedVoiceQueryRef.current = true;
        try {
          ExpoSpeechRecognitionModule.abort();
        } catch {
          /* ignore */
        }
      }

      if (isRateLimited()) {
        store.setError('Too many queries. Please wait a moment.');
        telemetry.capture('farm_assistant_error', {
          error_type: 'rate_limited',
          message: 'Too many queries. Please wait a moment.',
        });
        return;
      }

      queryTimestamps.current.push(Date.now());
      store.setTranscript(text);
      store.setStatus('processing');

      telemetry.capture('farm_assistant_query_submitted', {
        query_length: text.length,
        input_method: 'text',
      });

      try {
        const unsupported = checkUnsupportedIntent(text);
        if (unsupported) {
          store.setError(unsupported.message);
          telemetry.capture('farm_assistant_error', {
            error_type: 'unsupported',
            message: unsupported.message,
          });
          return;
        }

        const intent = classifyIntent(text, farms);
        store.setIntent(intent);

        const clarification = buildClarification(intent);
        if (clarification) {
          store.setClarification(clarification);
          telemetry.capture('farm_assistant_clarification_triggered', {
            has_category: !!intent.category,
            confidence: intent.confidence,
          });
          return;
        }

        if (!intent.category) {
          const noCategMsg =
            "I couldn't understand that question. I can help with spray, irrigation, fertigation, and expense history.";
          store.setError(noCategMsg);
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
        store.setAnswer(result.answer);

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
        store.setError(message);
        telemetry.capture('farm_assistant_error', {
          error_type: 'query_failed',
          message,
        });
      }
    },
    [farms, language, store, isRateLimited, speakAnswer],
  );

  // Keep ref in sync with latest submitQuery
  useEffect(() => {
    submitQueryRef.current = submitQuery;
  }, [submitQuery]);

  // Voice recognition event handlers (use ref to avoid circular dependency)
  useSpeechRecognitionEvent('start', () => {
    store.setStatus('listening');
  });

  useSpeechRecognitionEvent('end', () => {
    if (store.status !== 'listening') return;

    const finalTranscript = pendingTranscriptRef.current.trim();
    if (finalTranscript && !hasSubmittedVoiceQueryRef.current) {
      hasSubmittedVoiceQueryRef.current = true;
      submitQueryRef.current?.(finalTranscript);
      return;
    }

    store.setStatus('idle');
  });

  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results[0]?.transcript ?? '';
    pendingTranscriptRef.current = transcript;
    store.setTranscript(transcript);

    if (event.isFinal && transcript.trim() && !hasSubmittedVoiceQueryRef.current) {
      hasSubmittedVoiceQueryRef.current = true;
      submitQueryRef.current?.(transcript.trim());
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    if (event.error === 'no-speech') {
      store.setStatus('idle');
      return;
    }
    if (event.error === 'not-allowed') {
      store.setMicAvailable(false);
      store.setStatus('idle');
      return;
    }
    // Ignore 'aborted' errors — these are programmatic (e.g., user closed modal, submitted query)
    if (event.error === 'aborted') {
      return;
    }
    store.setError(event.message ?? 'Voice recognition failed. Try typing your question.');
    telemetry.capture('farm_assistant_error', {
      error_type: 'voice_recognition',
      message: event.message,
      error_code: event.error,
    });
  });

  // Check mic permissions on mount
  useEffect(() => {
    if (Platform.OS === 'web') {
      store.setMicAvailable(false);
      return;
    }
    ExpoSpeechRecognitionModule.getPermissionsAsync()
      .then((result) => {
        if (result.status === 'denied') {
          store.setMicAvailable(false);
        }
      })
      .catch(() => {
        store.setMicAvailable(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startListening = useCallback(async () => {
    // Don't start if already listening to prevent crashes
    if (store.status === 'listening' || isStartingListeningRef.current) {
      return;
    }

    isStartingListeningRef.current = true;

    try {
      const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!result.granted) {
        store.setMicAvailable(false);
        store.setStatus('idle');
        return;
      }
      store.setMicAvailable(true);
      pendingTranscriptRef.current = '';
      hasSubmittedVoiceQueryRef.current = false;
      store.setTranscript('');
      store.setStatus('listening');

      await Promise.resolve(
        ExpoSpeechRecognitionModule.start({
          lang: speechLocale,
          interimResults: true,
          continuous: false,
        }),
      );
    } catch (err) {
      console.warn('Speech recognition start failed:', err);
      store.setStatus('idle');
      store.setMicAvailable(false);
      store.setError('Voice recognition is not available on this device.');
    } finally {
      isStartingListeningRef.current = false;
    }
  }, [speechLocale, store]);

  const stopListening = useCallback(() => {
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch (err) {
      console.warn('Speech recognition stop failed:', err);
      store.setStatus('idle');
    }
  }, [store]);

  const selectClarification = useCallback(
    async (option: string) => {
      telemetry.capture('farm_assistant_clarification_selected', { option });

      const currentTranscript = store.transcript;
      const enrichedTranscript = `${currentTranscript} ${option}`;
      store.setClarification(null);
      store.setStatus('processing');
      store.setTranscript(enrichedTranscript);

      try {
        const result = await executeQuery(enrichedTranscript, farms, language);
        store.setAnswer(result.answer);

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
        store.setError(message);
        telemetry.capture('farm_assistant_error', {
          error_type: 'query_failed',
          message,
        });
      }
    },
    [farms, language, store, speakAnswer],
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
    store.reset();
  }, [store]);

  const openModal = useCallback(() => {
    store.openModal();
  }, [store]);

  const closeModal = useCallback(() => {
    try {
      ExpoSpeechRecognitionModule.abort();
    } catch {
      /* ignore */
    }
    Speech.stop();
    pendingTranscriptRef.current = '';
    hasSubmittedVoiceQueryRef.current = false;
    store.closeModal();
  }, [store]);

  return {
    isModalVisible: store.isModalVisible,
    status: store.status as FarmAssistantStatus,
    transcript: store.transcript,
    answer: store.answer as AssistantAnswer | null,
    clarification: store.clarification as ClarificationPrompt | null,
    error: store.error,
    isMicAvailable: store.isMicAvailable,

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
