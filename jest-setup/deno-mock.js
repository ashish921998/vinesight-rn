/**
 * Deno environment mock for Jest tests.
 * Deno Edge Function modules use Deno.env.get() for environment variables.
 * This file provides a compatible mock for Node.js/Jest environments.
 *
 * NOTE: Must be listed in jest.config.js `setupFiles` (NOT setupFilesAfterFramework)
 * so Deno is available when modules are loaded.
 */

// Set default test environment variables so module-level constants are initialised
// with real-looking values when modules are first imported.
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-openai-key';
process.env.SARVAM_API_KEY = process.env.SARVAM_API_KEY || 'test-sarvam-key';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';
process.env.ASSISTANT_USE_SARVAM_VOICE = process.env.ASSISTANT_USE_SARVAM_VOICE || 'true';
process.env.ASSISTANT_SARVAM_TTS_MODEL = process.env.ASSISTANT_SARVAM_TTS_MODEL || 'bulbul:v3';
process.env.ASSISTANT_SARVAM_TTS_EN_SPEAKER =
  process.env.ASSISTANT_SARVAM_TTS_EN_SPEAKER || 'shubh';
process.env.ASSISTANT_SARVAM_TTS_HI_SPEAKER =
  process.env.ASSISTANT_SARVAM_TTS_HI_SPEAKER || 'shubh';
process.env.ASSISTANT_SARVAM_TTS_MR_SPEAKER =
  process.env.ASSISTANT_SARVAM_TTS_MR_SPEAKER || 'shubh';

// Provide the Deno global with an env.get() backed by process.env
global.Deno = {
  env: {
    get: (key) => process.env[key] ?? undefined,
  },
};

// btoa / atob are available in Node ≥ 16; polyfill for older environments
if (typeof global.btoa === 'undefined') {
  global.btoa = (str) => Buffer.from(str, 'binary').toString('base64');
}
if (typeof global.atob === 'undefined') {
  global.atob = (str) => Buffer.from(str, 'base64').toString('binary');
}
