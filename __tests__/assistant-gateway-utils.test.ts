import {
  normalizeBase64Payload,
  parseInvokeError,
  toVoiceLogAction,
} from '@/services/assistant-gateway-utils';
import { AssistantGatewayErrorCode } from '@/services/assistant-gateway-types';

describe('assistant-gateway-utils', () => {
  describe('normalizeBase64Payload', () => {
    it('strips data URLs with extra mime parameters', () => {
      expect(normalizeBase64Payload('data:audio/webm;codecs=opus;base64,Zm9v')).toBe('Zm9v');
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
});
