import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const WEBHOOK_AUTH = Deno.env.get('REVENUECAT_WEBHOOK_AUTH') ?? '';
const ENTITLEMENT_ID = Deno.env.get('REVENUECAT_ENTITLEMENT_ID') ?? 'Vinesight Pro';
const ENTITLEMENT_MAP_RAW = Deno.env.get('REVENUECAT_ENTITLEMENT_MAP') ?? '';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function parseEntitlementMap(): Array<[string, string]> {
  if (!ENTITLEMENT_MAP_RAW) return [];
  try {
    const parsed = JSON.parse(ENTITLEMENT_MAP_RAW) as Record<string, string>;
    if (!parsed || typeof parsed !== 'object') return [];
    return Object.entries(parsed).filter(
      ([key, value]) => typeof key === 'string' && typeof value === 'string' && value.length > 0,
    );
  } catch {
    return [];
  }
}

function normalizeStatus(eventType: string, periodType?: string) {
  const normalized = eventType.toUpperCase();
  if (normalized === 'BILLING_ISSUE') return 'grace';
  if (normalized === 'CANCELLATION') return 'canceled';
  if (normalized === 'EXPIRATION' || normalized === 'REFUND') return 'expired';
  if (periodType === 'TRIAL') return 'trialing';
  return 'active';
}

Deno.serve(async (req) => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ error: 'Supabase not configured' }, 500);
  }

  if (WEBHOOK_AUTH) {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (authHeader !== WEBHOOK_AUTH) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
  }

  const body = await req.json().catch(() => null);
  if (!body?.event) {
    return jsonResponse({ error: 'Invalid payload' }, 400);
  }

  const event = body.event;
  const appUserId = event.app_user_id;
  const entitlementIds = event.entitlement_ids ?? [];
  const periodType = event.period_type ?? null;
  const expirationMs = event.expiration_at_ms ?? null;
  const trialEndsAt = periodType === 'TRIAL' && expirationMs ? new Date(expirationMs) : null;
  const renewsAt = expirationMs ? new Date(expirationMs) : null;

  if (!appUserId) {
    return jsonResponse({ error: 'Missing app_user_id' }, 400);
  }

  const entitlementMap = parseEntitlementMap();
  let planId = 'free';
  if (entitlementMap.length > 0) {
    for (const [entitlementId, mappedPlanId] of entitlementMap) {
      if (entitlementIds.includes(entitlementId)) {
        planId = mappedPlanId;
        break;
      }
    }
  } else if (entitlementIds.includes(ENTITLEMENT_ID)) {
    planId = 'pro';
  }
  const status = normalizeStatus(event.type ?? 'unknown', periodType);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { error } = await admin.from('subscriptions').upsert(
    {
      user_id: appUserId,
      plan_id: planId,
      status,
      trial_ends_at: trialEndsAt,
      renews_at: renewsAt,
      provider: 'revenuecat',
    },
    { onConflict: 'user_id' },
  );

  if (error) {
    return jsonResponse({ error: 'Failed to update subscription' }, 500);
  }

  return jsonResponse({ ok: true });
});
