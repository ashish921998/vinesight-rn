/**
 * Audio Utilities
 * Audio format detection and MIME type normalization.
 */

import { decodeBase64ToBytes } from './helpers.ts';

/**
 * Audio format detection result
 */
export interface AudioFormatInfo {
  mime: string;
  filename: string;
}

/**
 * Detect audio format from binary header bytes
 */
export function detectAudioFormatFromHeader(binary: Uint8Array): AudioFormatInfo | null {
  if (binary.length < 12) return null;

  // WAV: starts with "RIFF"
  if (binary[0] === 0x52 && binary[1] === 0x49 && binary[2] === 0x46 && binary[3] === 0x46) {
    return { mime: 'audio/wav', filename: 'audio.wav' };
  }
  // FLAC: starts with "fLaC"
  if (binary[0] === 0x66 && binary[1] === 0x4c && binary[2] === 0x61 && binary[3] === 0x43) {
    return { mime: 'audio/flac', filename: 'audio.flac' };
  }
  // OGG: starts with "OggS"
  if (binary[0] === 0x4f && binary[1] === 0x67 && binary[2] === 0x67 && binary[3] === 0x53) {
    return { mime: 'audio/ogg', filename: 'audio.ogg' };
  }
  // MP3: starts with ID3 tag or 0xFF 0xFB sync word
  if (
    (binary[0] === 0x49 && binary[1] === 0x44 && binary[2] === 0x33) ||
    (binary[0] === 0xff && (binary[1] & 0xe0) === 0xe0)
  ) {
    return { mime: 'audio/mpeg', filename: 'audio.mp3' };
  }
  // CAF: starts with "caff"
  if (binary[0] === 0x63 && binary[1] === 0x61 && binary[2] === 0x66 && binary[3] === 0x66) {
    return { mime: 'audio/mp4', filename: 'audio.caf' };
  }
  // MP4/M4A: "ftyp" at offset 4
  if (binary[4] === 0x66 && binary[5] === 0x74 && binary[6] === 0x79 && binary[7] === 0x70) {
    return { mime: 'audio/mp4', filename: 'audio.m4a' };
  }
  // WebM: starts with 0x1A 0x45 0xDF 0xA3 (EBML header)
  if (binary[0] === 0x1a && binary[1] === 0x45 && binary[2] === 0xdf && binary[3] === 0xa3) {
    return { mime: 'audio/webm', filename: 'audio.webm' };
  }
  return null;
}

/**
 * Normalize MIME type for OpenAI Whisper API
 */
export function normalizeOpenAiAudioMime(mimeType: string): AudioFormatInfo {
  const normalized = mimeType.trim().toLowerCase();
  if (normalized.includes('wav')) return { mime: 'audio/wav', filename: 'audio.wav' };
  if (normalized.includes('flac')) return { mime: 'audio/flac', filename: 'audio.flac' };
  if (normalized.includes('webm')) return { mime: 'audio/webm', filename: 'audio.webm' };
  if (normalized.includes('ogg') || normalized.includes('oga'))
    return { mime: 'audio/ogg', filename: 'audio.ogg' };
  if (normalized.includes('x-m4a') || normalized.includes('m4a'))
    return { mime: 'audio/mp4', filename: 'audio.m4a' };
  if (normalized.includes('mp4')) return { mime: 'audio/mp4', filename: 'audio.m4a' };
  if (normalized.includes('mpeg') || normalized.includes('mp3'))
    return { mime: 'audio/mpeg', filename: 'audio.mp3' };
  if (normalized.includes('caf')) return { mime: 'audio/mpeg', filename: 'audio.mp3' };
  if (normalized.includes('aac')) return { mime: 'audio/mpeg', filename: 'audio.mp3' };
  return { mime: 'audio/mpeg', filename: 'audio.mp3' };
}

/**
 * Normalize MIME type for Sarvam STT API
 */
export function normalizeSarvamAudioMime(mimeType: string): AudioFormatInfo | null {
  const normalized = mimeType.trim().toLowerCase();
  if (!normalized) return { mime: 'audio/mpeg', filename: 'audio.mp3' };
  if (normalized.includes('wav')) return { mime: 'audio/wav', filename: 'audio.wav' };
  if (normalized.includes('x-m4a') || normalized.includes('m4a')) {
    return { mime: 'audio/mp4', filename: 'audio.m4a' };
  }
  if (normalized.includes('mp4')) return { mime: 'audio/mp4', filename: 'audio.m4a' };
  if (normalized.includes('mpeg') || normalized.includes('mp3')) {
    return { mime: 'audio/mpeg', filename: 'audio.mp3' };
  }
  if (normalized.startsWith('audio/')) return { mime: normalized, filename: 'audio.mp3' };
  return { mime: 'audio/mpeg', filename: 'audio.mp3' };
}

/**
 * Detect audio format from base64 string
 */
export function detectAudioFormatFromBase64(base64Audio: string): AudioFormatInfo | null {
  try {
    const binary = decodeBase64ToBytes(base64Audio);
    return detectAudioFormatFromHeader(binary);
  } catch {
    return null;
  }
}

/**
 * Check if MIME type is unsupported by Sarvam
 *
 * Note: Saaras v3 supports M4A, MP4, CAF, and all major audio formats.
 * This function now returns false for all formats since Saaras v3 handles them.
 * Kept for backward compatibility but effectively deprecated.
 */
export function isSarvamUnsupportedContainer(_mimeType: string): boolean {
  // Saaras v3 supports M4A, MP4, CAF, and all major audio formats
  // No format bypass needed anymore
  return false;
}

/**
 * Audio size constants
 */
export const MAX_AUDIO_SIZE_MB = 10;
export const MAX_TEXT_LENGTH = 5000;
// Use Math.ceil to ensure we accept valid boundary-sized uploads (exact 10MB)
export const MAX_AUDIO_BASE64_LENGTH = Math.ceil((MAX_AUDIO_SIZE_MB * 1024 * 1024) / 3) * 4;
export const MIN_AUDIO_BASE64_LENGTH = 1000;
export const MIN_AUDIO_ESTIMATED_BYTES = 700;

/**
 * Timeouts for external API calls
 */
export const STT_TIMEOUT_MS = 15000;
export const TTS_TIMEOUT_MS = 10000;
export const LLM_TIMEOUT_MS = 30000;
