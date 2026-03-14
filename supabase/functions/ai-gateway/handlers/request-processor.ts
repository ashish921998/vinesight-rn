/**
 * Request Processor
 * Handles STT, input validation, and initial request setup.
 */

import {
  estimateBase64Bytes,
  isLikelyInvalidAudioError,
  MIN_AUDIO_BASE64_LENGTH,
  MIN_AUDIO_ESTIMATED_BYTES,
  normalizeBase64Input,
  normalizeInputText,
  readConversationRouteState,
  resolveConversationId,
  resolveLocale,
  stringifyUnknown,
  writeConversationTurn,
} from '../utils/index.ts';

import { transcribeAudio } from '../providers/index.ts';

import { fetchUserFarms, type ToolCall } from '../context/index.ts';
import type { AssistantGatewayRequest, AssistantRouteState } from '../types.ts';
import type { VoiceLogDraft, VoiceLogMissingField } from '../voice-routing.ts';

export interface RequestSetup {
  body: AssistantGatewayRequest;
  authenticatedUserId: string;
  locale: 'en' | 'hi' | 'mr';
  providerFallbackEnabled: boolean;
  clientPersistedUserTurn: boolean;
}

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
 * Validate and setup request
 */
export async function setupRequest(
  req: Request,
  _traceId: string,
): Promise<{ setup: RequestSetup | null; response: Response | null }> {
  let body: AssistantGatewayRequest;
  try {
    body = (await req.json()) as AssistantGatewayRequest;
  } catch {
    return {
      setup: null,
      response: {
        status: 400,
        body: { error: 'Invalid JSON request body' },
      } as unknown as Response,
    };
  }

  // Auth is handled in main.ts - return body for now
  return {
    setup: {
      body,
      authenticatedUserId: '',
      locale: resolveLocale(body?.locale),
      providerFallbackEnabled: true,
      clientPersistedUserTurn: false,
    },
    response: null,
  };
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
        response: {
          status: 400,
          body: { error: 'Audio input mode requires input_audio_b64 or input_text' },
        } as unknown as Response,
      };
    } else {
      const normalizedAudioBase64 = normalizeBase64Input(audioBase64);
      const estimatedAudioBytes = estimateBase64Bytes(normalizedAudioBase64);

      if (normalizedAudioBase64.length < MIN_AUDIO_BASE64_LENGTH) {
        return {
          result: null,
          response: {
            status: 400,
            body: { error: 'INVALID_AUDIO', message: 'Audio recording is too short.' },
          } as unknown as Response,
        };
      }
      if (estimatedAudioBytes < MIN_AUDIO_ESTIMATED_BYTES) {
        return {
          result: null,
          response: {
            status: 400,
            body: { error: 'INVALID_AUDIO', message: 'Audio data is too small.' },
          } as unknown as Response,
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
        if (isLikelyInvalidAudioError(errorMessage)) {
          return {
            result: null,
            response: {
              status: 400,
              body: { error: 'INVALID_AUDIO_FORMAT', message: 'Audio could not be processed.' },
            } as unknown as Response,
          };
        }
        throw error;
      }
    }
  }

  if (!transcript) {
    return {
      result: null,
      response: {
        status: 400,
        body: { error: 'Input transcript is empty' },
      } as unknown as Response,
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
  if (conversationId && !clientPersistedUserTurn) {
    await writeConversationTurn({
      conversationId,
      userId,
      farmId,
      role: 'user',
      content: transcript,
      inputMode: effectiveInputMode,
      traceId,
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
