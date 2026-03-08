import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')?.trim() ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() ?? '';
const EXPO_ACCESS_TOKEN = Deno.env.get('EXPO_ACCESS_TOKEN')?.trim() ?? '';
const FEATURE_OVERVIEW_REMINDERS_AUTH =
  Deno.env.get('FEATURE_OVERVIEW_REMINDERS_AUTH')?.trim() ?? '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

type Locale = 'en' | 'hi' | 'mr';
type FeatureDay = 1 | 2 | 3 | 4 | 5 | 6 | 7;
type FeatureOverviewRoute =
  | '/(tabs)'
  | '/(tabs)/explore'
  | '/tasks'
  | '/(tabs)/workers'
  | '/warehouse'
  | '/weather'
  | '/analytics';

type CampaignMessage = {
  title: string;
  body: string;
  route: FeatureOverviewRoute;
};

type PushDeviceRow = {
  id: string;
  user_id: string;
  expo_push_token: string;
  locale: string | null;
  timezone: string | null;
  notifications_enabled: boolean;
  feature_overview_enabled: boolean;
  feature_overview_started_at: string | null;
  feature_overview_next_day: number | null;
  feature_overview_last_sent_on: string | null;
  feature_overview_completed_at: string | null;
};

const featureOverviewCopy: Record<Locale, Record<FeatureDay, CampaignMessage>> = {
  en: {
    1: {
      title: 'Start with your dashboard',
      body: 'See today’s farm snapshot, tasks, and quick actions in one place.',
      route: '/(tabs)',
    },
    2: {
      title: 'Organize your farms',
      body: 'Open your farms module to review blocks, details, and crop setup.',
      route: '/(tabs)/explore',
    },
    3: {
      title: 'Stay ahead on tasks',
      body: 'Check upcoming work, due items, and what needs attention today.',
      route: '/tasks',
    },
    4: {
      title: 'Track your workers',
      body: 'Manage labour, attendance, and worker activity from one screen.',
      route: '/(tabs)/workers',
    },
    5: {
      title: 'Keep warehouse stock ready',
      body: 'Review inventory and spot items that are nearing reorder quantity.',
      route: '/warehouse',
    },
    6: {
      title: 'Use weather before you decide',
      body: 'Open weather insights before irrigation, spray, or field planning.',
      route: '/weather',
    },
    7: {
      title: 'See the bigger picture',
      body: 'Open analytics to review farm performance and trends across your season.',
      route: '/analytics',
    },
  },
  hi: {
    1: {
      title: 'डैशबोर्ड से शुरुआत करें',
      body: 'आज का फार्म स्नैपशॉट, कार्य और क्विक एक्शन एक ही जगह देखें।',
      route: '/(tabs)',
    },
    2: {
      title: 'अपने फार्म व्यवस्थित करें',
      body: 'ब्लॉक, विवरण और फसल सेटअप देखने के लिए फार्म मॉड्यूल खोलें।',
      route: '/(tabs)/explore',
    },
    3: {
      title: 'कार्यों में आगे रहें',
      body: 'आज के जरूरी काम, ड्यू आइटम और अगला क्या है, यह देखें।',
      route: '/tasks',
    },
    4: {
      title: 'अपने वर्कर्स ट्रैक करें',
      body: 'मजदूर, उपस्थिति और उनकी गतिविधि एक ही स्क्रीन से संभालें।',
      route: '/(tabs)/workers',
    },
    5: {
      title: 'वेयरहाउस स्टॉक तैयार रखें',
      body: 'इन्वेंटरी देखें और रीऑर्डर के करीब पहुंची वस्तुओं को पहचानें।',
      route: '/warehouse',
    },
    6: {
      title: 'निर्णय से पहले मौसम देखें',
      body: 'सिंचाई, स्प्रे या फील्ड प्लान से पहले मौसम इनसाइट्स खोलें।',
      route: '/weather',
    },
    7: {
      title: 'पूरा चित्र देखें',
      body: 'सीजन के ट्रेंड और फार्म प्रदर्शन देखने के लिए एनालिटिक्स खोलें।',
      route: '/analytics',
    },
  },
  mr: {
    1: {
      title: 'डॅशबोर्डपासून सुरुवात करा',
      body: 'आजचे शेत दृश्य, कामे आणि क्विक अॅक्शन्स एकाच ठिकाणी पाहा.',
      route: '/(tabs)',
    },
    2: {
      title: 'तुमची शेते व्यवस्थित ठेवा',
      body: 'ब्लॉक्स, तपशील आणि पीक सेटअप पाहण्यासाठी शेत मॉड्यूल उघडा.',
      route: '/(tabs)/explore',
    },
    3: {
      title: 'कामांमध्ये पुढे रहा',
      body: 'आजची महत्त्वाची कामे, देय आयटम्स आणि पुढे काय आहे ते पाहा.',
      route: '/tasks',
    },
    4: {
      title: 'तुमचे कामगार ट्रॅक करा',
      body: 'मजूर, उपस्थिती आणि कामगारांची हालचाल एका स्क्रीनवरून सांभाळा.',
      route: '/(tabs)/workers',
    },
    5: {
      title: 'गोदामातील साठा तयार ठेवा',
      body: 'इन्व्हेंटरी पाहा आणि पुनःऑर्डरच्या जवळ आलेल्या वस्तू ओळखा.',
      route: '/warehouse',
    },
    6: {
      title: 'निर्णयापूर्वी हवामान पाहा',
      body: 'पाणी, स्प्रे किंवा फील्ड प्लॅनपूर्वी हवामान इनसाइट्स उघडा.',
      route: '/weather',
    },
    7: {
      title: 'मोठे चित्र पहा',
      body: 'सीझनमधील ट्रेंड आणि शेत कामगिरी पाहण्यासाठी अॅनालिटिक्स उघडा.',
      route: '/analytics',
    },
  },
};

const SUPPORTED_LOCALES: readonly Locale[] = ['en', 'hi', 'mr'];

function normalizeLocale(locale: string | null): Locale {
  if (locale && (SUPPORTED_LOCALES as readonly string[]).includes(locale)) {
    return locale as Locale;
  }
  return 'en';
}

function getZonedParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const values = Object.fromEntries(
    parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]),
  );

  const year = values.year;
  const month = values.month;
  const day = values.day;
  const hour = Number(values.hour);

  if (!year || !month || !day || !Number.isInteger(hour)) {
    throw new Error(`Unable to resolve timezone parts for ${timeZone}`);
  }

  return {
    year,
    month,
    day,
    hour,
    date: `${year}-${month}-${day}`,
  };
}

function normalizeFeatureDay(value: number | null): FeatureDay | null {
  if (value === null || !Number.isInteger(value) || value < 1 || value > 7) {
    return null;
  }
  return value as FeatureDay;
}

function getStartLocalDate(startedAt: string | null, timeZone: string): string | null {
  if (!startedAt) return null;
  const date = new Date(startedAt);
  if (Number.isNaN(date.getTime())) return null;
  return getZonedParts(date, timeZone).date;
}

type ExpoPushMessage = {
  to: string;
  sound: string;
  title: string;
  body: string;
  data: { type: string; day: FeatureDay; route: string; campaign: string };
};

type ExpoPushTicket = { status: string; details?: string };

function buildPushMessage(token: string, locale: Locale, day: FeatureDay): ExpoPushMessage {
  const copy = featureOverviewCopy[locale][day] ?? featureOverviewCopy.en[day];
  return {
    to: token,
    sound: 'default',
    title: copy.title,
    body: copy.body,
    data: {
      type: 'feature_overview',
      day,
      route: copy.route,
      campaign: 'install_core_v1',
    },
  };
}

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
    !FEATURE_OVERVIEW_REMINDERS_AUTH ||
    !authHeader ||
    !authHeader.startsWith('Bearer ') ||
    authHeader.slice(7) !== FEATURE_OVERVIEW_REMINDERS_AUTH
  ) {
    return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 401,
    });
  }

  try {
    let offset = 0;
    const batchSize = 500;
    const allRows: PushDeviceRow[] = [];

    while (true) {
      const { data, error } = await supabase
        .from('user_push_devices')
        .select(
          'id,user_id,expo_push_token,locale,timezone,notifications_enabled,feature_overview_enabled,feature_overview_started_at,feature_overview_next_day,feature_overview_last_sent_on,feature_overview_completed_at',
        )
        .eq('notifications_enabled', true)
        .eq('feature_overview_enabled', true)
        .is('feature_overview_completed_at', null)
        .not('timezone', 'is', null)
        .not('feature_overview_started_at', 'is', null)
        .range(offset, offset + batchSize - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      allRows.push(...(data as PushDeviceRow[]));
      if (data.length < batchSize) break;
      offset += batchSize;
    }

    const now = new Date();
    let processed = 0;
    let eligible = 0;
    let sent = 0;
    let completed = 0;
    let skippedInvalidTimezone = 0;

    type EligibleEntry = {
      row: PushDeviceRow;
      day: FeatureDay;
      zonedDate: string;
    };

    const eligibleEntries: EligibleEntry[] = [];

    for (const row of allRows) {
      processed += 1;
      const day = normalizeFeatureDay(row.feature_overview_next_day);
      if (!day || !row.timezone) continue;

      let zonedNow: ReturnType<typeof getZonedParts>;
      let startedLocalDate: string | null;
      try {
        zonedNow = getZonedParts(now, row.timezone);
        startedLocalDate = getStartLocalDate(row.feature_overview_started_at, row.timezone);
      } catch (error) {
        skippedInvalidTimezone += 1;
        console.error('feature_overview_invalid_timezone', {
          deviceId: row.id,
          timezone: row.timezone,
          error: String(error),
        });
        continue;
      }

      if (!startedLocalDate) continue;
      if (zonedNow.hour !== 10) continue;
      if (zonedNow.date <= startedLocalDate) continue;
      if (row.feature_overview_last_sent_on === zonedNow.date) continue;

      eligibleEntries.push({ row, day, zonedDate: zonedNow.date });
    }

    eligible = eligibleEntries.length;

    // Build messages and send in batches of up to 100
    const messages = eligibleEntries.map((entry) =>
      buildPushMessage(entry.row.expo_push_token, normalizeLocale(entry.row.locale), entry.day),
    );

    let tickets: ExpoPushTicket[] = [];
    try {
      tickets = await sendExpoPushBatch(messages);
    } catch (error) {
      console.error('feature_overview_batch_send_failed', { error: String(error) });
    }

    // Process results: update DB for successfully delivered tickets
    for (let i = 0; i < eligibleEntries.length; i++) {
      const { row, day, zonedDate } = eligibleEntries[i];
      const ticket = tickets[i];

      if (!ticket || ticket.status !== 'ok') {
        if (ticket?.status === 'error') {
          console.error('feature_overview_send_failed', {
            deviceId: row.id,
            userId: row.user_id,
            day,
            error: ticket.details ?? 'Unknown error',
          });
        }
        continue;
      }

      const updatePayload: Record<string, string | number | null> = {
        feature_overview_last_sent_on: zonedDate,
        updated_at: new Date().toISOString(),
      };
      if (day === 7) {
        updatePayload.feature_overview_completed_at = new Date().toISOString();
      } else {
        updatePayload.feature_overview_next_day = day + 1;
      }

      const updateQuery = supabase
        .from('user_push_devices')
        .update(updatePayload)
        .eq('id', row.id)
        .eq('feature_overview_next_day', day);

      const guardedQuery =
        row.feature_overview_last_sent_on === null
          ? updateQuery.is('feature_overview_last_sent_on', null)
          : updateQuery.eq('feature_overview_last_sent_on', row.feature_overview_last_sent_on);

      const { data: updatedRows, error: updateError } = await guardedQuery.select('id');

      if (updateError) {
        console.error('feature_overview_update_failed', {
          deviceId: row.id,
          userId: row.user_id,
          day,
          error: updateError,
        });
        continue;
      }

      if (!updatedRows || updatedRows.length === 0) {
        console.warn('feature_overview_update_lost_race', { deviceId: row.id, day });
        continue;
      }

      sent += 1;
      if (day === 7) {
        completed += 1;
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        processed,
        eligible,
        sent,
        completed,
        skippedInvalidTimezone,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    console.error('feature_overview_job_failed', error);
    return new Response(JSON.stringify({ ok: false, error: String(error) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
