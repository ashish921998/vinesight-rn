import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')?.trim() ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() ?? '';
const EXPO_ACCESS_TOKEN = Deno.env.get('EXPO_ACCESS_TOKEN')?.trim() ?? '';
const FERTILIZER_PLAN_NOTIFY_AUTH = Deno.env.get('FERTILIZER_PLAN_NOTIFY_AUTH')?.trim() ?? '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

type Locale = 'en' | 'hi' | 'mr';
const SUPPORTED_LOCALES: readonly Locale[] = ['en', 'hi', 'mr'];

function normalizeLocale(locale: string | null): Locale {
  if (locale && (SUPPORTED_LOCALES as readonly string[]).includes(locale)) {
    return locale as Locale;
  }
  return 'en';
}

// Localized copy. `consultant` is the sending organization's name (or a generic
// fallback); `farm` is the farm name when available.
function buildCopy(
  locale: Locale,
  consultant: string,
  farm: string | null,
): { title: string; body: string } {
  switch (locale) {
    case 'hi':
      return {
        title: 'नई फर्टिलाइज़र योजना',
        body: farm
          ? `${consultant} ने ${farm} के लिए एक फर्टिलाइज़र योजना भेजी है। देखने के लिए टैप करें।`
          : `${consultant} ने एक नई फर्टिलाइज़र योजना भेजी है। देखने के लिए टैप करें।`,
      };
    case 'mr':
      return {
        title: 'नवीन खत योजना',
        body: farm
          ? `${consultant} यांनी ${farm} साठी खत योजना पाठवली आहे. पाहण्यासाठी टॅप करा.`
          : `${consultant} यांनी नवीन खत योजना पाठवली आहे. पाहण्यासाठी टॅप करा.`,
      };
    default:
      return {
        title: 'New fertilizer plan',
        body: farm
          ? `${consultant} shared a fertilizer plan for ${farm}. Tap to view.`
          : `${consultant} shared a new fertilizer plan. Tap to view.`,
      };
  }
}

type PushDeviceRow = {
  id: string;
  user_id: string;
  expo_push_token: string;
  locale: string | null;
  notifications_enabled: boolean;
};

type ExpoPushMessage = {
  to: string;
  sound: string;
  title: string;
  body: string;
  data: { type: 'fertilizer_plan'; farmId: number; planId: string };
};

type ExpoPushTicket = { status: string; details?: string };

const EXPO_BATCH_LIMIT = 100;

async function sendExpoPushBatch(messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (EXPO_ACCESS_TOKEN) {
    headers.Authorization = `Bearer ${EXPO_ACCESS_TOKEN}`;
  }

  const allTickets: ExpoPushTicket[] = [];
  for (let i = 0; i < messages.length; i += EXPO_BATCH_LIMIT) {
    const chunk = messages.slice(i, i + EXPO_BATCH_LIMIT);
    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers,
        body: JSON.stringify(chunk),
      });
      if (!response.ok) {
        const text = await response.text();
        console.error('Expo push batch failed', { status: response.status, text, batchIndex: i });
        break;
      }
      const data = (await response.json()) as { data?: ExpoPushTicket[] };
      allTickets.push(...(data.data ?? []));
    } catch (batchError) {
      console.error('Expo push batch error', { error: String(batchError), batchIndex: i });
      break;
    }
  }
  return allTickets;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const authHeader = req.headers.get('authorization');
  if (
    !FERTILIZER_PLAN_NOTIFY_AUTH ||
    !authHeader ||
    !authHeader.startsWith('Bearer ') ||
    authHeader.slice(7) !== FERTILIZER_PLAN_NOTIFY_AUTH
  ) {
    return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 401,
    });
  }

  try {
    const payload = (await req.json().catch(() => ({}))) as { plan_id?: string };
    const planId = payload.plan_id?.trim();
    if (!planId) {
      return new Response(JSON.stringify({ ok: false, error: 'plan_id is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Resolve the plan, the sending organization, and the owning farm in one read.
    const { data: plan, error: planError } = await supabase
      .from('fertilizer_plans')
      .select('id,farm_id,organization:organizations(name),farm:farms(name,user_id)')
      .eq('id', planId)
      .maybeSingle();

    if (planError) throw planError;
    if (!plan) {
      return new Response(JSON.stringify({ ok: false, error: 'plan not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    const planRow = plan as unknown as {
      id: string;
      farm_id: number;
      organization: { name: string | null } | null;
      farm: { name: string | null; user_id: string | null } | null;
    };

    const ownerUserId = planRow.farm?.user_id ?? null;
    if (!ownerUserId) {
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: 'no farm owner' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const { data: devices, error: deviceError } = await supabase
      .from('user_push_devices')
      .select('id,user_id,expo_push_token,locale,notifications_enabled')
      .eq('user_id', ownerUserId)
      .eq('notifications_enabled', true);

    if (deviceError) throw deviceError;

    const rows = (devices ?? []) as PushDeviceRow[];
    const consultant = planRow.organization?.name?.trim() || 'Your consultant';
    const farmName = planRow.farm?.name?.trim() || null;

    const messages: ExpoPushMessage[] = rows
      .filter((row) => row.expo_push_token)
      .map((row) => {
        const copy = buildCopy(normalizeLocale(row.locale), consultant, farmName);
        return {
          to: row.expo_push_token,
          sound: 'default',
          title: copy.title,
          body: copy.body,
          data: { type: 'fertilizer_plan', farmId: planRow.farm_id, planId: planRow.id },
        };
      });

    if (messages.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: 'no devices' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const tickets = await sendExpoPushBatch(messages);
    const sent = tickets.filter((ticket) => ticket.status === 'ok').length;
    const failed = tickets.filter((ticket) => ticket.status === 'error');
    if (failed.length > 0) {
      console.error('fertilizer_plan_push_failures', {
        planId,
        failed: failed.map((ticket) => ticket.details ?? 'unknown'),
      });
    }

    return new Response(
      JSON.stringify({ ok: true, devices: rows.length, attempted: messages.length, sent }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    );
  } catch (error) {
    console.error('fertilizer_plan_notify_failed', error);
    return new Response(JSON.stringify({ ok: false, error: String(error) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
