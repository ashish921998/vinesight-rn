/**
 * CORS Headers Configuration
 * Standard CORS headers for Supabase Edge Functions.
 */

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Create a JSON response with CORS headers
 */
export function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Create an OPTIONS response for CORS preflight
 */
export function corsOptionsResponse(): Response {
  return new Response('ok', { headers: corsHeaders });
}
