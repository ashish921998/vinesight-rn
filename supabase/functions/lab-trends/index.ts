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

const SOIL_PARAMETERS = [
  { key: 'ph', label: 'pH', shortLabel: 'pH', unit: '', optimalMin: 6.5, optimalMax: 7.5 },
  { key: 'ec', label: 'EC', shortLabel: 'EC', unit: 'dS/m', optimalMin: 0, optimalMax: 1.0 },
  {
    key: 'organicCarbon',
    label: 'Organic Carbon',
    shortLabel: 'OC',
    unit: '%',
    optimalMin: 1.01,
    optimalMax: 3.0,
  },
  {
    key: 'organicMatter',
    label: 'Organic Matter',
    shortLabel: 'OM',
    unit: '%',
    optimalMin: 2.0,
    optimalMax: 5.0,
  },
  {
    key: 'nitrogen',
    label: 'Nitrogen',
    shortLabel: 'N',
    unit: 'kg/ha',
    optimalMin: 280,
    optimalMax: 560,
  },
  {
    key: 'phosphorus',
    label: 'Phosphorus',
    shortLabel: 'P',
    unit: 'kg/ha',
    optimalMin: 20,
    optimalMax: 40,
  },
  {
    key: 'potassium',
    label: 'Potassium',
    shortLabel: 'K',
    unit: 'kg/ha',
    optimalMin: 140,
    optimalMax: 280,
  },
  {
    key: 'calcium',
    label: 'Calcium',
    shortLabel: 'Ca',
    unit: 'meq/100g',
    optimalMin: 10,
    optimalMax: 20,
  },
  {
    key: 'magnesium',
    label: 'Magnesium',
    shortLabel: 'Mg',
    unit: 'meq/100g',
    optimalMin: 2,
    optimalMax: 5,
  },
  { key: 'sulfur', label: 'Sulfur', shortLabel: 'S', unit: 'ppm', optimalMin: 10, optimalMax: 20 },
  { key: 'iron', label: 'Iron', shortLabel: 'Fe', unit: 'ppm', optimalMin: 4.5, optimalMax: 8.0 },
  {
    key: 'manganese',
    label: 'Manganese',
    shortLabel: 'Mn',
    unit: 'ppm',
    optimalMin: 2.0,
    optimalMax: 5.0,
  },
  { key: 'zinc', label: 'Zinc', shortLabel: 'Zn', unit: 'ppm', optimalMin: 1.0, optimalMax: 2.5 },
  {
    key: 'copper',
    label: 'Copper',
    shortLabel: 'Cu',
    unit: 'ppm',
    optimalMin: 0.2,
    optimalMax: 0.5,
  },
  { key: 'boron', label: 'Boron', shortLabel: 'B', unit: 'ppm', optimalMin: 0.5, optimalMax: 1.0 },
];

const PETIOLE_PARAMETERS = [
  {
    key: 'total_nitrogen',
    label: 'Total Nitrogen',
    shortLabel: 'N',
    unit: '%',
    optimalMin: 1.8,
    optimalMax: 2.2,
  },
  {
    key: 'phosphorus',
    label: 'Phosphorus',
    shortLabel: 'P',
    unit: '%',
    optimalMin: 0.15,
    optimalMax: 0.25,
  },
  {
    key: 'potassium',
    label: 'Potassium',
    shortLabel: 'K',
    unit: '%',
    optimalMin: 1.2,
    optimalMax: 1.8,
  },
  {
    key: 'calcium',
    label: 'Calcium',
    shortLabel: 'Ca',
    unit: '%',
    optimalMin: 1.5,
    optimalMax: 2.5,
  },
  {
    key: 'magnesium',
    label: 'Magnesium',
    shortLabel: 'Mg',
    unit: '%',
    optimalMin: 0.3,
    optimalMax: 0.5,
  },
  { key: 'sulfur', label: 'Sulfur', shortLabel: 'S', unit: '%', optimalMin: 0.2, optimalMax: 0.3 },
  { key: 'iron', label: 'Iron', shortLabel: 'Fe', unit: 'ppm', optimalMin: 50, optimalMax: 150 },
  {
    key: 'manganese',
    label: 'Manganese',
    shortLabel: 'Mn',
    unit: 'ppm',
    optimalMin: 25,
    optimalMax: 150,
  },
  { key: 'zinc', label: 'Zinc', shortLabel: 'Zn', unit: 'ppm', optimalMin: 20, optimalMax: 100 },
  { key: 'copper', label: 'Copper', shortLabel: 'Cu', unit: 'ppm', optimalMin: 5, optimalMax: 25 },
  { key: 'boron', label: 'Boron', shortLabel: 'B', unit: 'ppm', optimalMin: 25, optimalMax: 60 },
  {
    key: 'molybdenum',
    label: 'Molybdenum',
    shortLabel: 'Mo',
    unit: 'ppm',
    optimalMin: 0.1,
    optimalMax: 1.0,
  },
  { key: 'sodium', label: 'Sodium', shortLabel: 'Na', unit: 'ppm', optimalMin: 0, optimalMax: 50 },
  {
    key: 'chloride',
    label: 'Chloride',
    shortLabel: 'Cl',
    unit: 'ppm',
    optimalMin: 0,
    optimalMax: 150,
  },
  {
    key: 'ammoniacal_nitrogen',
    label: 'Ammoniacal Nitrogen',
    shortLabel: 'NH4',
    unit: 'ppm',
    optimalMin: 0,
    optimalMax: 50,
  },
];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function mapSoilParameters(parameters: Record<string, number>): Record<string, number> {
  const keyMap: Record<string, string> = {
    pH: 'ph',
    EC: 'ec',
    OC: 'organicCarbon',
    OM: 'organicMatter',
    N: 'nitrogen',
    P: 'phosphorus',
    K: 'potassium',
    Ca: 'calcium',
    Mg: 'magnesium',
    S: 'sulfur',
    Fe: 'iron',
    Mn: 'manganese',
    Zn: 'zinc',
    Cu: 'copper',
    B: 'boron',
  };

  const mapped: Record<string, number> = {};
  for (const [key, value] of Object.entries(parameters || {})) {
    const newKey = keyMap[key] || key;
    mapped[newKey] = value;
  }
  return mapped;
}

function mapPetioleParameters(parameters: Record<string, number>): Record<string, number> {
  const keyMap: Record<string, string> = {
    N: 'total_nitrogen',
    P: 'phosphorus',
    K: 'potassium',
    Ca: 'calcium',
    Mg: 'magnesium',
    S: 'sulfur',
    Fe: 'iron',
    Mn: 'manganese',
    Zn: 'zinc',
    Cu: 'copper',
    B: 'boron',
    Mo: 'molybdenum',
    Na: 'sodium',
    Cl: 'chloride',
    ammonical_nitrogen: 'ammoniacal_nitrogen',
  };

  const mapped: Record<string, number> = {};
  for (const [key, value] of Object.entries(parameters || {})) {
    const newKey = keyMap[key] || key;
    mapped[newKey] = value;
  }
  return mapped;
}

function calculateTrends(
  tests: Array<{ date: string; parameters: Record<string, number> }>,
  paramDefinitions: Array<{
    key: string;
    label: string;
    shortLabel: string;
    unit: string;
    optimalMin: number;
    optimalMax: number;
  }>,
  parameterMapper?: (params: Record<string, number>) => Record<string, number>,
) {
  const trendData = [...tests]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((test) => ({
      date: test.date,
      parameters: parameterMapper ? parameterMapper(test.parameters) : test.parameters,
    }));

  const parameterTrends: Record<string, unknown> = {};

  paramDefinitions.forEach((param) => {
    const values = trendData
      .map((t) => (t.parameters ? (t.parameters as Record<string, number>)[param.key] : undefined))
      .filter((v): v is number => v !== null && v !== undefined);

    if (values.length > 0) {
      const min = Math.min(...values);
      const max = Math.max(...values);
      const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
      const change =
        values.length > 1
          ? values[0] !== 0
            ? ((values[values.length - 1] - values[0]) / values[0]) * 100
            : null
          : 0;

      parameterTrends[param.key] = {
        key: param.key,
        label: param.label,
        shortLabel: param.shortLabel,
        unit: param.unit,
        optimalMin: param.optimalMin,
        optimalMax: param.optimalMax,
        values,
        min,
        max,
        avg,
        change,
      };
    }
  });

  const dateRange =
    trendData.length > 0
      ? { start: trendData[0].date, end: trendData[trendData.length - 1].date }
      : { start: '', end: '' };

  return { tests: trendData, parameterTrends, dateRange };
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
  if (!capabilities.labTests?.trends) {
    return jsonResponse({ reason: 'lab_trends_disabled' }, 403);
  }

  const body = await req.json().catch(() => null);
  const farmId = body?.farmId;
  const type = body?.type;

  if (!farmId || !type) {
    return jsonResponse({ error: 'Missing farmId or type' }, 400);
  }

  const table = type === 'petiole' ? 'petiole_test_records' : 'soil_test_records';

  const { data: tests, error } = await admin
    .from(table)
    .select('date,parameters')
    .eq('farm_id', farmId)
    .order('date', { ascending: true });

  if (error) {
    return jsonResponse({ error: 'Failed to load tests' }, 500);
  }

  const trendData =
    type === 'petiole'
      ? calculateTrends(tests || [], PETIOLE_PARAMETERS, mapPetioleParameters)
      : calculateTrends(tests || [], SOIL_PARAMETERS, mapSoilParameters);

  return jsonResponse(trendData);
});
