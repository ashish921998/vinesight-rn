import {
  buildAudioPayload,
  normalizeBase64Payload,
  parseInvokeError,
  toSafetyMeta,
  toVoiceLogAction,
} from '@/services/assistant-gateway-utils';
import { AssistantGatewayErrorCode } from '@/services/assistant-gateway-types';

describe('assistant-gateway-utils', () => {
  describe('normalizeBase64Payload', () => {
    it('strips data URLs with extra mime parameters', () => {
      expect(normalizeBase64Payload('data:audio/webm;codecs=opus;base64,Zm9v')).toBe('Zm9v');
    });

    it('returns empty string for whitespace-only payloads', () => {
      expect(normalizeBase64Payload('   ')).toBe('');
      expect(normalizeBase64Payload('\n\t')).toBe('');
    });
  });

  describe('parseInvokeError', () => {
    it('handles null without throwing', () => {
      const error = parseInvokeError(null, 'test_context');
      expect(error.code).toBe(AssistantGatewayErrorCode.UNKNOWN);
    });

    it('handles undefined without throwing', () => {
      const error = parseInvokeError(undefined, 'test_context');
      expect(error.code).toBe(AssistantGatewayErrorCode.UNKNOWN);
    });
  });

  describe('toVoiceLogAction', () => {
    it('returns null for unsupported kinds', () => {
      expect(
        toVoiceLogAction({
          kind: 'unexpected',
          draft: null,
          prefill: null,
          missing_fields: [],
          expected_field: null,
          clarify_attempts: 0,
          clarify_exhausted: false,
        } as never),
      ).toBeNull();
    });
  });

  describe('toSafetyMeta', () => {
    it('normalizes malformed safety flags to safe defaults', () => {
      expect(
        toSafetyMeta({
          blocked: 'yes' as never,
          risk_level: 'unsafe' as never,
          reasons: ['ok', 42, null] as never,
          escalation_suggested: 'true' as never,
        }),
      ).toEqual({
        blocked: false,
        riskLevel: 'low',
        reasons: ['ok'],
        escalationSuggested: false,
      });
    });
  });

  describe('buildAudioPayload', () => {
    it('returns null for whitespace-only audio fields', () => {
      expect(
        buildAudioPayload({
          assistant_audio_b64: '   ',
          assistant_audio_url: '\n\t',
        } as never),
      ).toBeNull();
    });
  });
});
