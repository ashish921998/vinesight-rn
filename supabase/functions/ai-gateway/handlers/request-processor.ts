/**
 * Request Processor
 * Handles STT, input validation, and initial request setup.
 */

import {
  estimateBase64Bytes,
  isLikelyInvalidAudioError,
  jsonResponse,
  MAX_AUDIO_BASE64_LENGTH,
  MAX_AUDIO_SIZE_MB,
  MAX_TEXT_LENGTH,
  MIN_AUDIO_BASE64_LENGTH,
  MIN_AUDIO_ESTIMATED_BYTES,
  normalizeBase64Input,
  normalizeInputText,
  readConversationRouteState,
  resolveConversationId,
  stringifyUnknown,
  writeConversationTurn,
} from '../utils/index.ts';

import { transcribeAudio } from '../providers/index.ts';

import { fetchUserFarms, type ToolCall } from '../context/index.ts';
import type { AssistantGatewayRequest, AssistantRouteState } from '../types.ts';
import type { VoiceLogDraft, VoiceLogMissingField } from '../routing/index.ts';

export interface SttResult {
  transcript: string;
  effectiveInputMode: 'text' | 'audio';
  sttProviderUsed: string | null;
  sttConfidence: number | null;
  providerFallbackReason: string | null;
}

export interface ConversationSetup {
  farmId: number | null;
  userId: string;
  conversationId: string | null;
  farmsForRouting: Array<{ id: number; name: string }>;
  contextFarmForRouting: { id: number; name: string } | null;
  routeState: AssistantRouteState;
}

/**
 * Process audio input for STT
 */
export async function processStt(
  body: AssistantGatewayRequest,
  locale: 'en' | 'hi' | 'mr',
  providerFallbackEnabled: boolean,
  toolCalls: ToolCall[],
): Promise<{ result: SttResult | null; response: Response | null }> {
  let transcript = normalizeInputText(body?.input_text);
  const inputMode: 'text' | 'audio' = body?.input_mode === 'audio' ? 'audio' : 'text';
  let effectiveInputMode: 'text' | 'audio' = inputMode;
  let sttProviderUsed: string | null = null;
  let sttConfidence: number | null = null;
  let providerFallbackReason: string | null = null;

  if (inputMode === 'audio') {
    const audioBase64 = body?.input_audio_b64?.trim();
    const audioMimeType = body?.audio_format?.trim() || 'audio/mpeg';

    if (transcript) {
      effectiveInputMode = 'text';
      sttProviderUsed = 'client_transcript';
    } else if (!audioBase64) {
      return {
        result: null,
        response: jsonResponse(
          { error: 'Audio input mode requires input_audio_b64 or input_text' },
          400,
        ),
      };
    } else {
      const normalizedAudioBase64 = normalizeBase64Input(audioBase64);
      const estimatedAudioBytes = estimateBase64Bytes(normalizedAudioBase64);

      // Minimum audio size validation
      if (normalizedAudioBase64.length < MIN_AUDIO_BASE64_LENGTH) {
        return {
          result: null,
          response: jsonResponse(
            { error: 'INVALID_AUDIO', message: 'Audio recording is too short.' },
            400,
          ),
        };
      }
      if (estimatedAudioBytes < MIN_AUDIO_ESTIMATED_BYTES) {
        return {
          result: null,
          response: jsonResponse(
            { error: 'INVALID_AUDIO', message: 'Audio data is too small.' },
            400,
          ),
        };
      }

      // Maximum audio size validation (10MB)
      if (normalizedAudioBase64.length > MAX_AUDIO_BASE64_LENGTH) {
        return {
          result: null,
          response: jsonResponse(
            {
              error: 'AUDIO_TOO_LARGE',
              message: `Audio exceeds maximum size of ${MAX_AUDIO_SIZE_MB}MB.`,
              max_size_mb: MAX_AUDIO_SIZE_MB,
            },
            400,
          ),
        };
      }

      try {
        const sttResult = await transcribeAudio({
          base64Audio: normalizedAudioBase64,
          mimeType: audioMimeType,
          locale,
          providerFallbackEnabled,
        });
        transcript = sttResult.transcript;
        sttProviderUsed = sttResult.provider;
        sttConfidence = sttResult.confidence;
        providerFallbackReason = sttResult.fallbackReason;

        toolCalls.push({
          tool: 'stt.transcribe',
          status: 'ok',
          output: { stt_provider: sttProviderUsed, stt_confidence: sttConfidence },
        });
      } catch (error) {
        const errorMessage = stringifyUnknown(error);

        // Handle empty transcript from STT
        if (errorMessage.includes('stt_empty_transcript')) {
          return {
            result: null,
            response: jsonResponse(
              {
                error: 'EMPTY_TRANSCRIPT',
                message: 'Speech transcription returned no text. Please try again.',
              },
              400,
            ),
          };
        }

        if (isLikelyInvalidAudioError(errorMessage)) {
          return {
            result: null,
            response: jsonResponse(
              { error: 'INVALID_AUDIO_FORMAT', message: 'Audio could not be processed.' },
              400,
            ),
          };
        }
        throw error;
      }
    }
  }

  if (!transcript) {
    return {
      result: null,
      response: jsonResponse({ error: 'Input transcript is empty' }, 400),
    };
  }

  // Validate text length (max 5000 chars)
  if (transcript.length > MAX_TEXT_LENGTH) {
    return {
      result: null,
      response: jsonResponse(
        {
          error: 'TEXT_TOO_LONG',
          message: `Input text exceeds maximum length of ${MAX_TEXT_LENGTH} characters.`,
          max_length: MAX_TEXT_LENGTH,
        },
        400,
      ),
    };
  }

  return {
    result: {
      transcript,
      effectiveInputMode,
      sttProviderUsed,
      sttConfidence,
      providerFallbackReason,
    },
    response: null,
  };
}

/**
 * Setup conversation context
 */
export async function setupConversation(
  body: AssistantGatewayRequest,
  authenticatedUserId: string,
  effectiveInputMode: 'text' | 'audio',
  transcript: string,
  _traceId: string,
): Promise<ConversationSetup> {
  const farmId = body?.farm_context?.farm_id ?? null;
  const userId = authenticatedUserId;
  const conversationId = await resolveConversationId(
    body?.conversation_id ?? null,
    userId,
    farmId,
    body?.locale ?? 'en',
  );

  const clientPersistedUserTurn = body?.client_capabilities?.client_persisted_user_turn === true;
  if (!conversationId) {
    console.warn(
      'setupConversation: resolveConversationId returned null; skipping user-turn persistence',
      {
        suppliedConversationId: body?.conversation_id ?? null,
        userId,
        farmId,
      },
    );
  } else if (!clientPersistedUserTurn) {
    await writeConversationTurn({
      conversationId,
      userId,
      farmId,
      role: 'user',
      content: transcript,
      inputMode: effectiveInputMode,
      traceId: _traceId,
    });
  }

  const farmsForRouting = await fetchUserFarms(userId);
  const contextFarmForRouting =
    farmId !== null ? (farmsForRouting.find((f) => f.id === farmId) ?? null) : null;

  const routeStateRaw = await readConversationRouteState(conversationId);
  const routeState: AssistantRouteState = {
    voice_log_draft: (routeStateRaw?.voice_log_draft as VoiceLogDraft) ?? null,
    voice_log_expected_field:
      (routeStateRaw?.voice_log_expected_field as VoiceLogMissingField) ?? null,
    voice_log_clarify_attempts: (routeStateRaw?.voice_log_clarify_attempts as number) ?? 0,
    route_clarification_pending: (routeStateRaw?.route_clarification_pending as boolean) ?? false,
    pending_ambiguous_transcript: (routeStateRaw?.pending_ambiguous_transcript as string) ?? null,
  };

  return { farmId, userId, conversationId, farmsForRouting, contextFarmForRouting, routeState };
}
