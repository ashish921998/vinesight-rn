/**
 * Shared base64 helpers for edge functions.
 * `ai-gateway/utils/helpers.ts` re-exports `estimateBase64Bytes` from here.
 */

/**
 * Estimate the decoded byte size of base64 data (padding-aware).
 * Strips the same ASCII whitespace atob() ignores (WHATWG forgiving-base64:
 * tab, LF, FF, CR, space) so the estimate matches what decodeBase64ToBytes
 * actually decodes — internal line wrapping must not inflate the size.
 */
export function estimateBase64Bytes(base64Value: string): number {
  const normalized = base64Value.replace(/[\t\n\f\r ]/g, '');
  const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((normalized.length * 3) / 4) - padding);
}

/**
 * Decode a base64 string (without any data-URL prefix) to a Uint8Array.
 * Throws a DOMException if the input is not valid base64.
 */
export function decodeBase64ToBytes(base64Value: string): Uint8Array {
  return Uint8Array.from(atob(base64Value), (ch) => ch.charCodeAt(0));
}
