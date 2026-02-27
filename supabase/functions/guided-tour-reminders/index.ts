import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')?.trim() ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() ?? '';
const EXPO_ACCESS_TOKEN = Deno.env.get('EXPO_ACCESS_TOKEN')?.trim() ?? '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

type Locale = 'en' | 'hi' | 'mr';

const reminderCopy: Record<Locale, { title: string; body: string }> = {
  en: { title: 'Your farm is waiting!', body: 'Tap to finish setting up.' },
  hi: { title: 'आपका फार्म आपका इंतज़ार कर रहा है!', body: 'सेटअप पूरा करने के लिए टैप करें।' },
  mr: { title: 'तुमचे शेत तुमची वाट पाहत आहे!', body: 'सेटअप पूर्ण करण्यासाठी टॅप करा.' },
};

function hoursSince(ts: string | null): number {
  if (!ts) return Number.POSITIVE_INFINITY;
  const time = Date.parse(ts);
  if (!Number.isFinite(time)) return Number.POSITIVE_INFINITY;
  return (Date.now() - time) / (1000 * 60 * 60);
}

async function sendExpoPush(token: string, locale: Locale, sequence: 1 | 2) {
  const copy = reminderCopy[locale] ?? reminderCopy.en;
  const message = {
    to: token,
    sound: 'default',
    title: copy.title,
    body: copy.body,
    data: {
      type: 'guided_tour_reminder',
      sequence,
      deeplink: '/(tabs)/index',
    },
  };

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (EXPO_ACCESS_TOKEN) {
    headers.Authorization = `Bearer ${EXPO_ACCESS_TOKEN}`;
  }

  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers,
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Expo push send failed (${response.status}): ${text}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { data: rows, error } = await supabase
      .from('user_guided_tour_state')
      .select('user_id,tour_status,reminders_sent,last_active_at,locale')
      .eq('tour_status', 'in_progress');

    if (error) throw error;

    let processed = 0;
    let sent = 0;
    let expired = 0;

    for (const row of rows ?? []) {
      processed += 1;
      const inactivityHours = hoursSince(row.last_active_at ?? null);
      const remindersSent = Number(row.reminders_sent ?? 0) as 0 | 1 | 2;
      const locale = (row.locale === 'hi' || row.locale === 'mr' ? row.locale : 'en') as Locale;
      const userId = row.user_id as string;

      if (remindersSent === 0 && inactivityHours >= 24) {
        const { data: devices } = await supabase
          .from('user_push_devices')
          .select('expo_push_token')
          .eq('user_id', userId)
          .eq('notifications_enabled', true);

        let delivered = false;
        for (const device of devices ?? []) {
          const token = device.expo_push_token as string | undefined;
          if (!token) continue;
          try {
            await sendExpoPush(token, locale, 1);
            delivered = true;
          } catch (e) {
            console.error('tour_reminder_sent failed seq1', { userId, error: String(e) });
          }
        }

        if (delivered) {
          sent += 1;
          console.log('tour_reminder_sent', { userId, sequence: 1 });
          await supabase
            .from('user_guided_tour_state')
            .update({ reminders_sent: 1, updated_at: new Date().toISOString() })
            .eq('user_id', userId)
            .eq('tour_status', 'in_progress');
        }
        continue;
      }

      if (remindersSent === 1 && inactivityHours >= 72) {
        const { data: devices } = await supabase
          .from('user_push_devices')
          .select('expo_push_token')
          .eq('user_id', userId)
          .eq('notifications_enabled', true);

        let delivered = false;
        for (const device of devices ?? []) {
          const token = device.expo_push_token as string | undefined;
          if (!token) continue;
          try {
            await sendExpoPush(token, locale, 2);
            delivered = true;
          } catch (e) {
            console.error('tour_reminder_sent failed seq2', { userId, error: String(e) });
          }
        }

        if (delivered) {
          sent += 1;
          console.log('tour_reminder_sent', { userId, sequence: 2 });
          await supabase
            .from('user_guided_tour_state')
            .update({ reminders_sent: 2, updated_at: new Date().toISOString() })
            .eq('user_id', userId)
            .eq('tour_status', 'in_progress');
        }
        continue;
      }

      if (remindersSent === 2 && inactivityHours >= 72) {
        await supabase
          .from('user_guided_tour_state')
          .update({
            tour_status: 'expired',
            tour_expired_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId)
          .eq('tour_status', 'in_progress');
        expired += 1;
      }
    }

    return new Response(JSON.stringify({ ok: true, processed, sent, expired }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('[guided-tour-reminders] failed', error);
    return new Response(JSON.stringify({ ok: false, error: String(error) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
