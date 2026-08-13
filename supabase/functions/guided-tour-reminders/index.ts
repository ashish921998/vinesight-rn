import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')?.trim() ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() ?? '';
const EXPO_ACCESS_TOKEN = Deno.env.get('EXPO_ACCESS_TOKEN')?.trim() ?? '';
const REMINDER_JOB_SECRET = Deno.env.get('FARM_SETUP_REMINDERS_AUTH')?.trim() ?? '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !REMINDER_JOB_SECRET) {
  throw new Error(
    'SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and FARM_SETUP_REMINDERS_AUTH are required',
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

type Locale = 'en' | 'hi' | 'mr';
type ReminderNumber = 1 | 2 | 3;

type ClaimedReminder = {
  user_id: string;
  reminder_number: ReminderNumber;
};

type PushDevice = {
  id: string;
  user_id: string;
  expo_push_token: string;
  locale: string | null;
};

type ExpoPushMessage = {
  to: string;
  sound: 'default';
  title: string;
  body: string;
  data: {
    type: 'farm_setup_reminder';
    campaign: 'first_farm_v1';
    sequence: ReminderNumber;
    route: '/farm/add';
  };
};

type ExpoPushTicket = {
  id?: string;
  status: 'ok' | 'error';
  message?: string;
  details?: { error?: string };
};

type PendingPush = {
  deviceId: string;
  userId: string;
  message: ExpoPushMessage;
};

const reminderCopy: Record<Locale, { title: string; body: string }> = {
  en: {
    title: 'Set up your first farm',
    body: 'Add your farm to start tracking irrigation, sprays, expenses, and daily work.',
  },
  hi: {
    title: 'अपना पहला फार्म सेट अप करें',
    body: 'सिंचाई, स्प्रे, खर्च और रोज़ के काम ट्रैक करने के लिए अपना फार्म जोड़ें।',
  },
  mr: {
    title: 'तुमचे पहिले शेत सेट अप करा',
    body: 'सिंचन, फवारणी, खर्च आणि रोजची कामे नोंदवण्यासाठी तुमचे शेत जोडा.',
  },
};

const EXPO_BATCH_LIMIT = 100;
const EXPO_REQUEST_TIMEOUT_MS = 15_000;
const CLAIM_LIMIT = 250;

function normalizeLocale(locale: string | null): Locale {
  return locale === 'hi' || locale === 'mr' ? locale : 'en';
}

function buildPushMessage(
  token: string,
  locale: Locale,
  sequence: ReminderNumber,
): ExpoPushMessage {
  const copy = reminderCopy[locale];
  return {
    to: token,
    sound: 'default',
    title: copy.title,
    body: copy.body,
    data: {
      type: 'farm_setup_reminder',
      campaign: 'first_farm_v1',
      sequence,
      route: '/farm/add',
    },
  };
}

async function beginClaimedDispatch(pushes: PendingPush[], claimId: string) {
  const userIds = [...new Set(pushes.map((push) => push.userId))];
  const { data, error } = await supabase.rpc('begin_farm_setup_reminder_dispatch', {
    p_claim_id: claimId,
    p_user_ids: userIds,
  });
  if (error) throw error;

  const dispatchingUserIds = new Set(
    ((data ?? []) as { user_id: string }[]).map((row) => row.user_id),
  );
  return pushes.filter((push) => dispatchingUserIds.has(push.userId));
}

async function sendExpoPushes(
  pushes: PendingPush[],
  claimId: string,
): Promise<{
  deliveredUserIds: Set<string>;
  invalidDeviceIds: Set<string>;
  accepted: number;
  rejected: number;
  skippedIneligible: number;
}> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (EXPO_ACCESS_TOKEN) {
    headers.Authorization = `Bearer ${EXPO_ACCESS_TOKEN}`;
  }

  const deliveredUserIds = new Set<string>();
  const invalidDeviceIds = new Set<string>();
  let accepted = 0;
  let rejected = 0;
  let skippedIneligible = 0;

  for (let offset = 0; offset < pushes.length; offset += EXPO_BATCH_LIMIT) {
    const chunk = pushes.slice(offset, offset + EXPO_BATCH_LIMIT);
    // Persist the campaign attempt before the external side effect. This gives
    // farm cancellation and dispatch a durable ordering and prevents replays.
    const eligibleChunk = await beginClaimedDispatch(chunk, claimId);
    skippedIneligible += chunk.length - eligibleChunk.length;
    if (eligibleChunk.length === 0) continue;

    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers,
        body: JSON.stringify(eligibleChunk.map((push) => push.message)),
        signal: AbortSignal.timeout(EXPO_REQUEST_TIMEOUT_MS),
      });

      if (!response.ok) {
        const text = await response.text();
        rejected += eligibleChunk.length;
        console.error('Expo push batch failed', { status: response.status, text, offset });
        continue;
      }

      const result = (await response.json()) as { data?: ExpoPushTicket[] };
      const tickets = result.data ?? [];

      eligibleChunk.forEach((push, index) => {
        const ticket = tickets[index];
        if (ticket?.status === 'ok') {
          accepted += 1;
          deliveredUserIds.add(push.userId);
          return;
        }

        rejected += 1;
        if (ticket?.details?.error === 'DeviceNotRegistered') {
          invalidDeviceIds.add(push.deviceId);
        }
        console.error('Expo push ticket rejected', {
          userId: push.userId,
          deviceId: push.deviceId,
          message: ticket?.message ?? 'Missing Expo push ticket',
          error: ticket?.details?.error ?? null,
        });
      });
    } catch (error) {
      rejected += eligibleChunk.length;
      console.error('Expo push batch threw', { offset, error: String(error) });
    }
  }

  return { deliveredUserIds, invalidDeviceIds, accepted, rejected, skippedIneligible };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const authHeader = req.headers.get('authorization');
  if (
    !REMINDER_JOB_SECRET ||
    !authHeader ||
    !authHeader.startsWith('Bearer ') ||
    authHeader.slice(7) !== REMINDER_JOB_SECRET
  ) {
    return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 401,
    });
  }

  const claimId = crypto.randomUUID();
  let claimed: ClaimedReminder[] = [];

  try {
    const { data: claimRows, error: claimError } = await supabase.rpc(
      'claim_due_farm_setup_reminders',
      { p_claim_id: claimId, p_limit: CLAIM_LIMIT },
    );
    if (claimError) throw claimError;

    claimed = (claimRows ?? []) as ClaimedReminder[];
    if (claimed.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, claimed: 0, usersDelivered: 0, accepted: 0, rejected: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
      );
    }

    const claimedByUser = new Map(claimed.map((row) => [row.user_id, row]));
    const userIds = [...claimedByUser.keys()];

    // Recheck farms after claiming. The insert trigger normally cancels the
    // campaign, while this read closes the remaining claim-to-send race window.
    const [{ data: farms, error: farmsError }, { data: devices, error: devicesError }] =
      await Promise.all([
        supabase.from('farms').select('user_id').in('user_id', userIds),
        supabase
          .from('user_push_devices')
          .select('id,user_id,expo_push_token,locale')
          .in('user_id', userIds)
          .eq('notifications_enabled', true),
      ]);

    if (farmsError) throw farmsError;
    if (devicesError) throw devicesError;

    const usersWithFarms = new Set((farms ?? []).map((farm) => farm.user_id as string));
    const pushes: PendingPush[] = [];

    for (const device of (devices ?? []) as PushDevice[]) {
      const reminder = claimedByUser.get(device.user_id);
      if (!reminder || usersWithFarms.has(device.user_id) || !device.expo_push_token) continue;

      pushes.push({
        deviceId: device.id,
        userId: device.user_id,
        message: buildPushMessage(
          device.expo_push_token,
          normalizeLocale(device.locale),
          reminder.reminder_number,
        ),
      });
    }

    const sendResult = await sendExpoPushes(pushes, claimId);

    if (sendResult.invalidDeviceIds.size > 0) {
      const { error: disableError } = await supabase
        .from('user_push_devices')
        .update({ notifications_enabled: false, updated_at: new Date().toISOString() })
        .in('id', [...sendResult.invalidDeviceIds]);
      if (disableError) {
        console.error('Failed to disable invalid Expo push tokens', disableError);
      }
    }

    const { error: finishError } = await supabase.rpc('finish_farm_setup_reminder_claim', {
      p_claim_id: claimId,
      p_delivered_user_ids: [],
    });
    if (finishError) throw finishError;

    console.log('farm_setup_reminder_job_complete', {
      claimed: claimed.length,
      usersDelivered: sendResult.deliveredUserIds.size,
      accepted: sendResult.accepted,
      rejected: sendResult.rejected,
      skippedIneligible: usersWithFarms.size + sendResult.skippedIneligible,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        claimed: claimed.length,
        usersDelivered: sendResult.deliveredUserIds.size,
        accepted: sendResult.accepted,
        rejected: sendResult.rejected,
        skippedIneligible: usersWithFarms.size + sendResult.skippedIneligible,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    );
  } catch (error) {
    console.error('[guided-tour-reminders] farm setup reminder job failed', error);

    // Dispatched users were durably advanced before Expo. This only releases
    // users that never reached that decision, so accepted pushes cannot replay.
    if (claimed.length > 0) {
      const { error: releaseError } = await supabase.rpc('finish_farm_setup_reminder_claim', {
        p_claim_id: claimId,
        p_delivered_user_ids: [],
      });
      if (releaseError) {
        console.error('Failed to release farm setup reminder claim', releaseError);
      }
    }

    return new Response(JSON.stringify({ ok: false, error: 'Internal server error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
