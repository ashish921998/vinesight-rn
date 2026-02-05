import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ error: 'Supabase not configured' }, 500);
  }

  const authHeader = req.headers.get('Authorization') ?? '';

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: subscription } = await admin
    .from('subscriptions')
    .select('plan_id,status,trial_ends_at,renews_at')
    .eq('user_id', userData.user.id)
    .maybeSingle();

  const { data: profile } = await admin
    .from('profiles')
    .select('subscription,trial_started_at,trial_ends_at,trial_used_at')
    .eq('id', userData.user.id)
    .maybeSingle();

  const subscriptionStatus = subscription?.status ?? 'inactive';
  const hasActiveSubscription = ['active', 'trialing', 'grace'].includes(subscriptionStatus);
  const profilePlan = typeof profile?.subscription === 'string' ? profile.subscription.trim() : '';

  const now = new Date();
  let trialEndsAt = profile?.trial_ends_at ? new Date(profile.trial_ends_at) : null;
  let trialStartedAt = profile?.trial_started_at ? new Date(profile.trial_started_at) : null;

  if (!hasActiveSubscription && !profilePlan && !trialStartedAt) {
    const startedAt = new Date();
    const endsAt = new Date(startedAt);
    endsAt.setMonth(endsAt.getMonth() + 1);

    const { data: updatedProfile } = await admin
      .from('profiles')
      .update({
        trial_started_at: startedAt.toISOString(),
        trial_ends_at: endsAt.toISOString(),
      })
      .eq('id', userData.user.id)
      .select('trial_started_at,trial_ends_at')
      .maybeSingle();

    trialStartedAt = updatedProfile?.trial_started_at
      ? new Date(updatedProfile.trial_started_at)
      : startedAt;
    trialEndsAt = updatedProfile?.trial_ends_at ? new Date(updatedProfile.trial_ends_at) : endsAt;
  }

  const hasActiveTrial = Boolean(trialEndsAt && trialEndsAt.getTime() > now.getTime());

  const planId = hasActiveSubscription
    ? (subscription?.plan_id ?? 'free')
    : profilePlan || (hasActiveTrial ? 'pro' : 'free');

  const status = hasActiveSubscription
    ? subscriptionStatus
    : profilePlan
      ? 'active'
      : hasActiveTrial
        ? 'trialing'
        : 'active';

  if (!hasActiveSubscription && !profilePlan && trialEndsAt && now >= trialEndsAt) {
    if (!profile?.trial_used_at) {
      await admin
        .from('profiles')
        .update({ trial_used_at: now.toISOString() })
        .eq('id', userData.user.id);
    }
  }

  const resolvedPlanId = planId === 'pro' ? 'pro' : 'free';
  const capabilities = resolvedPlanId === 'pro' ? PRO_CAPABILITIES : FREE_CAPABILITIES;

  return jsonResponse({
    planId: resolvedPlanId,
    status,
    trialEndsAt: hasActiveTrial
      ? (trialEndsAt?.toISOString() ?? null)
      : (subscription?.trial_ends_at ?? null),
    renewsAt: subscription?.renews_at ?? null,
    capabilities,
  });
});
