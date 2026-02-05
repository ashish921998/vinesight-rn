import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const DODO_WEBHOOK_SECRET = Deno.env.get('DODO_WEBHOOK_SECRET') ?? '';
const DODO_PLAN_MAP_RAW = Deno.env.get('DODO_PLAN_MAP') ?? '';
const DODO_DEFAULT_PLAN_ID = Deno.env.get('DODO_DEFAULT_PLAN_ID') ?? 'pro';

const WEBHOOK_ID_HEADER = 'webhook-id';
const WEBHOOK_TIMESTAMP_HEADER = 'webhook-timestamp';
const WEBHOOK_SIGNATURE_HEADER = 'webhook-signature';

const ACTIVE_STATUSES = new Set(['active', 'trialing', 'grace']);

type DodoPayload = {
  type?: string;
  event_type?: string;
  data?: unknown;
  event?: { type?: string; data?: unknown };
};

type DodoData = {
  status?: string | null;
  next_billing_date?: string | number | null;
  current_period_end?: string | number | null;
  renewal_date?: string | number | null;
  trial_end?: string | number | null;
  trial_end_date?: string | number | null;
  product_id?: string | null;
  price_id?: string | null;
  plan_id?: string | null;
  metadata?: Record<string, unknown> | null;
  customer?: {
    id?: string | null;
    email?: string | null;
    metadata?: Record<string, unknown> | null;
  } | null;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function parsePlanMap(): Record<string, string> {
  if (!DODO_PLAN_MAP_RAW) return {};
  try {
    const parsed = JSON.parse(DODO_PLAN_MAP_RAW) as Record<string, string>;
    if (!parsed || typeof parsed !== 'object') return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([key, value]) => typeof key === 'string' && typeof value === 'string' && value.length > 0,
      ),
    );
  } catch {
    return {};
  }
}

function toUtf8(input: string) {
  return new TextEncoder().encode(input);
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function computeSignature(secret: string, payload: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    toUtf8(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, toUtf8(payload));
  return toHex(signature);
}

function extractSignatureCandidates(signatureHeader: string) {
  return signatureHeader
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.replace(/^v1=/, ''))
    .filter(Boolean);
}

async function verifySignature(opts: {
  secret: string;
  webhookId: string;
  timestamp: string;
  signatureHeader: string;
  rawBody: string;
}) {
  const { secret, webhookId, timestamp, signatureHeader, rawBody } = opts;
  const payload = `${webhookId}.${timestamp}.${rawBody}`;
  const expected = await computeSignature(secret, payload);
  const candidates = extractSignatureCandidates(signatureHeader);
  return candidates.some((candidate) => candidate === expected);
}

function getEventType(payload: DodoPayload): string {
  return payload.type ?? payload.event_type ?? payload.event?.type ?? '';
}

function getEventData(payload: DodoPayload): DodoData {
  const data = payload.data ?? payload.event?.data ?? {};
  if (typeof data === 'object' && data !== null) return data as DodoData;
  return {} as DodoData;
}

function normalizeStatus(eventType: string, dataStatus?: string | null) {
  const normalizedStatus = (dataStatus ?? '').toLowerCase();
  const normalizedEvent = eventType.toLowerCase();

  if (normalizedStatus === 'on_hold' || normalizedEvent === 'subscription.on_hold') return 'grace';
  if (normalizedStatus === 'cancelled' || normalizedEvent === 'subscription.cancelled')
    return 'canceled';
  if (normalizedStatus === 'expired' || normalizedEvent === 'subscription.expired')
    return 'expired';
  if (normalizedStatus === 'failed' || normalizedEvent === 'subscription.failed') return 'expired';

  return 'active';
}

function parseDate(value?: string | number | null) {
  if (!value) return null;
  if (typeof value === 'number') {
    const ms = value > 1e12 ? value : value * 1000;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getMetadataValue(
  metadata: Record<string, unknown> | null | undefined,
  key: string,
): string | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const value = metadata[key];
  if (typeof value === 'string' && value.trim()) return value.trim();
  return null;
}

function resolveUserId(data: DodoData) {
  const metadata = data.metadata ?? undefined;
  const customerMetadata = data.customer?.metadata ?? undefined;

  return (
    getMetadataValue(metadata, 'app_user_id') ||
    getMetadataValue(metadata, 'user_id') ||
    getMetadataValue(metadata, 'supabase_user_id') ||
    getMetadataValue(customerMetadata, 'app_user_id') ||
    getMetadataValue(customerMetadata, 'user_id') ||
    getMetadataValue(customerMetadata, 'supabase_user_id') ||
    null
  );
}

function resolvePlanId(data: DodoData, planMap: Record<string, string>) {
  const metadataPlan = getMetadataValue(data.metadata ?? undefined, 'plan_id');
  if (metadataPlan) return metadataPlan;

  const keys = [data.product_id, data.price_id, data.plan_id].filter(Boolean) as string[];
  for (const key of keys) {
    if (planMap[key]) return planMap[key];
  }

  return DODO_DEFAULT_PLAN_ID;
}

Deno.serve(async (req) => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ error: 'Supabase not configured' }, 500);
  }

  if (!DODO_WEBHOOK_SECRET) {
    return jsonResponse({ error: 'Dodo webhook secret missing' }, 500);
  }

  const webhookId = req.headers.get(WEBHOOK_ID_HEADER) ?? '';
  const webhookTimestamp = req.headers.get(WEBHOOK_TIMESTAMP_HEADER) ?? '';
  const webhookSignature = req.headers.get(WEBHOOK_SIGNATURE_HEADER) ?? '';

  if (!webhookId || !webhookTimestamp || !webhookSignature) {
    return jsonResponse({ error: 'Missing webhook headers' }, 400);
  }

  const rawBody = await req.text();

  const isValid = await verifySignature({
    secret: DODO_WEBHOOK_SECRET,
    webhookId,
    timestamp: webhookTimestamp,
    signatureHeader: webhookSignature,
    rawBody,
  });

  if (!isValid) {
    return jsonResponse({ error: 'Invalid signature' }, 401);
  }

  const body = JSON.parse(rawBody) as DodoPayload;
  const eventType = getEventType(body);
  const data = getEventData(body);

  const userId = resolveUserId(data);
  if (!userId) {
    return jsonResponse({ error: 'Missing user_id in metadata' }, 400);
  }

  const planMap = parsePlanMap();
  const planId = resolvePlanId(data, planMap);
  const status = normalizeStatus(eventType, data.status ?? null);
  const renewsAt =
    parseDate(data.next_billing_date) ??
    parseDate(data.current_period_end) ??
    parseDate(data.renewal_date);
  const trialEndsAt = parseDate(data.trial_end ?? data.trial_end_date);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: existing } = await admin
    .from('subscriptions')
    .select('provider,status')
    .eq('user_id', userId)
    .maybeSingle();

  if (
    existing?.provider &&
    existing.provider !== 'dodo' &&
    existing.status &&
    ACTIVE_STATUSES.has(existing.status) &&
    !ACTIVE_STATUSES.has(status)
  ) {
    return jsonResponse({ ok: true, ignored: true });
  }

  const { error } = await admin.from('subscriptions').upsert(
    {
      user_id: userId,
      plan_id: planId,
      status,
      trial_ends_at: trialEndsAt,
      renews_at: renewsAt,
      provider: 'dodo',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );

  if (error) {
    return jsonResponse({ error: 'Failed to update subscription' }, 500);
  }

  return jsonResponse({ ok: true });
});
