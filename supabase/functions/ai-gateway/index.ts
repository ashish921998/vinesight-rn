/**
 * AI Gateway - Main Entry Point
 * Routes requests to the main handler module.
 * This file is the public API for the Supabase Edge Function.
 */

import { corsOptionsResponse, jsonResponse } from './utils/index.ts';
import { handleRequest } from './handlers/main.ts';

// Main request handler - delegates to modular handler
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return corsOptionsResponse();
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  return handleRequest(req);
});
