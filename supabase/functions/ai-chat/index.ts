import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};

const FREE_CAPABILITIES = {
  farms: { maxFarms: 1 },
  logs: { retentionMonths: 3 },
  workers: { maxWorkers: 1 },
  attendance: { historyWeeks: 4 },
  labTests: { trends: false, autoParsing: false },
  soilWater: { manualUpdate: false, moistureTrends: false },
  ai: { chatbot: false },
};

const PRO_CAPABILITIES = {
  farms: { maxFarms: 'unlimited' },
  logs: { retentionMonths: 'unlimited' },
  workers: { maxWorkers: 'unlimited' },
  attendance: { historyWeeks: 'unlimited' },
  labTests: { trends: true, autoParsing: true },
  soilWater: { manualUpdate: true, moistureTrends: true },
  ai: { chatbot: true },
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function buildSystemPrompt(language: string): string {
  const base = `You are Vinesight AI, an expert agricultural assistant specialized in grape farming and viticulture. You help farmers with:
- Disease identification and management
- Irrigation recommendations
- Fertilizer and nutrient management
- Pest control strategies
- Pruning and canopy management
- Weather-based farming advice
- Harvest timing and quality management
- Soil health and improvement

Provide clear, practical, and actionable advice. When suggesting treatments, always mention safety precautions and recommended dosages. Be concise but thorough. Use metrics appropriate for grape farming (acres, mm/day, kg/acre, etc.).`;

  if (language === 'mr') {
    return `${base}

LANGUAGE MODE: Marathi (mr)

Hard constraints:
- Respond ONLY in Marathi.
- Keep sentences short: max 18 words per sentence.
- Do NOT use English verbs.
- Use bullet points for actions.
- Give direct, actionable steps. Do not add explanations unless the user asks.
- Always use Arabic numerals (0-9), not Devanagari numerals.`;
  }

  if (language === 'hi') {
    return `${base}

LANGUAGE MODE: Hindi (hi)

Hard constraints:
- Respond ONLY in Hindi.
- Keep sentences short: max 18 words per sentence.
- Do NOT use English verbs.
- Use bullet points for actions.
- Give direct, actionable steps. Do not add explanations unless the user asks.
- Always use Arabic numerals (0-9), not Devanagari numerals.`;
  }

  return base;
}

async function callOpenAI(messages: Array<{ role: string; content: string }>, temperature = 0.7) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      temperature,
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI error: ${response.status} ${errorText}`);
  }

  return response.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ error: 'Supabase not configured' }, 500);
  }
  if (!OPENAI_API_KEY) {
    return jsonResponse({ error: 'OpenAI not configured' }, 500);
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const body = await req.json().catch(() => null);
  const message = body?.message;
  const history = body?.history ?? [];
  const farmContext = body?.farmContext ?? null;
  const language = body?.language ?? 'en';

  if (!message || typeof message !== 'string') {
    return jsonResponse({ error: 'Missing message' }, 400);
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: subscription } = await admin
    .from('subscriptions')
    .select('plan_id,status')
    .eq('user_id', userData.user.id)
    .maybeSingle();
  const { data: profile } = await admin
    .from('profiles')
    .select('subscription,trial_ends_at')
    .eq('id', userData.user.id)
    .maybeSingle();

  const subscriptionStatus = subscription?.status ?? 'inactive';
  const hasActiveSubscription = ['active', 'trialing', 'grace'].includes(subscriptionStatus);
  const profilePlan = typeof profile?.subscription === 'string' ? profile.subscription.trim() : '';
  const trialEndsAt = profile?.trial_ends_at ? new Date(profile.trial_ends_at) : null;
  const hasActiveTrial = Boolean(trialEndsAt && trialEndsAt.getTime() > Date.now());

  const planId = hasActiveSubscription
    ? (subscription?.plan_id ?? 'free')
    : profilePlan || (hasActiveTrial ? 'pro' : 'free');

  const capabilities = planId === 'pro' ? PRO_CAPABILITIES : FREE_CAPABILITIES;
  if (!capabilities.ai?.chatbot) {
    return jsonResponse({ reason: 'ai_disabled' }, 403);
  }

  const contextInfo = farmContext
    ? `\n\nCurrent Farm Context:\n- Farm: ${farmContext.farmName || 'Not specified'}\n- Crop: ${farmContext.cropVariety || 'Grapes'}\n- Area: ${farmContext.area || 'Not specified'} acres\n- Region: ${farmContext.region || 'Not specified'}\n- Growth Stage: ${farmContext.growthStage || 'Not specified'}\n- Days Since Pruning: ${farmContext.daysSincePruning || 'Not specified'} days`
    : '';

  const messages = [
    { role: 'system', content: buildSystemPrompt(language) + contextInfo },
    ...history.slice(-10).map((msg: { role: string; content: string }) => ({
      role: msg.role,
      content: msg.content,
    })),
    { role: 'user', content: message },
  ];

  try {
    const response = await callOpenAI(messages, 0.7);
    const assistantMessage =
      response.choices?.[0]?.message?.content ||
      'I apologize, but I encountered an issue generating a response. Please try again.';

    const suggestionPrompt = [
      {
        role: 'system',
        content:
          'Return 3 short follow-up suggestions as a JSON array of strings. Keep each suggestion under 6 words.',
      },
      { role: 'user', content: message },
    ];

    const suggestionResponse = await callOpenAI(suggestionPrompt, 0.2);
    let suggestions: string[] = [];
    const suggestionText = suggestionResponse.choices?.[0]?.message?.content ?? '[]';
    try {
      const parsed = JSON.parse(suggestionText);
      if (Array.isArray(parsed)) {
        suggestions = parsed.filter((s) => typeof s === 'string');
      }
    } catch {
      suggestions = [];
    }

    return jsonResponse({
      message: assistantMessage,
      suggestions,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'AI error' }, 500);
  }
});
