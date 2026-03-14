/**
 * Farm Data Query Module
 * Handles querying ALL farm data types for activity logging, history queries, and context assembly.
 *
 * Supported data types:
 * - irrigation_records, spray_records, fertigation_records, expense_records
 * - harvest_records, warehouse_items, workers, worker_attendance
 * - task_reminders, soil_test_records, petiole_test_records, daily_notes
 * - weather data (via Open-Meteo API)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';
import { safeNumber, toOptionalNumber, toOptionalString } from '../utils/index.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')?.trim() ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() ?? '';
const OPEN_METEO_API = 'https://api.open-meteo.com/v1/forecast';

// Lazy-initialized Supabase client
let supabaseClient: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (!supabaseClient && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return supabaseClient;
}

// ============================================================
// MARK: - Types
// ============================================================

export interface FarmRecordRow {
  id?: string | number;
  farm_id?: number | null;
  date?: string | null;
  duration?: number | string | null;
  chemical?: string | null;
  dose?: string | number | null;
  fertilizers?: unknown;
  water_volume?: number | string | null;
  cost?: number | string | null;
  type?: string | null;
  quantity?: number | string | null;
  grade?: string | null;
  name?: string | null;
  notes?: string | null;
  parameters?: Record<string, unknown> | null;
}

export interface Citation {
  id: string;
  title: string;
  sourceType: 'farm_record' | 'kb_doc' | 'memory' | 'external' | 'weather';
  url?: string | null;
  snippet?: string | null;
  confidence?: number | null;
  metadata?: Record<string, unknown> | null;
}

export interface ToolCall {
  tool: string;
  status: 'ok' | 'error' | 'skipped';
  input?: Record<string, unknown> | null;
  output?: Record<string, unknown> | null;
  error?: string | null;
}

export interface FarmDataQueryResult {
  answer: string | null;
  citations: Citation[];
  records: FarmRecordRow[];
  totalCount: number;
}

export interface WeatherData {
  temperature: number;
  humidity: number;
  windSpeed: number;
  precipitation: number;
  precipitationProbability: number;
  condition: string;
  et0: number;
  forecast: Array<{
    date: string;
    maxTemp: number;
    minTemp: number;
    precipitation: number;
    precipitationProbability: number;
    et0: number;
  }>;
}

// ============================================================
// MARK: - Activity Detection
// ============================================================

/**
 * Detect activity type from transcript text
 */
export function detectActivity(
  text: string,
): 'irrigation' | 'spray' | 'fertigation' | 'expense' | 'harvest' | null {
  if (/\birrigat|\bwater|सिंचाई|सिंचन|पाणी|ठिबक/i.test(text)) return 'irrigation';
  if (/\bspray|chemical|pesticide|स्प्रे|फवारणी|छिड़काव/i.test(text)) return 'spray';
  if (/\bfertigat|fertiliz|खत|उर्वरक|फर्टिगेशन/i.test(text)) return 'fertigation';
  if (/\bexpense|cost|spend|खर्च|लागत/i.test(text)) return 'expense';
  if (/\bharvest|yield|pick|कटनी|उत्पादन|पिक/i.test(text)) return 'harvest';
  return null;
}

/**
 * Detect data query type from transcript
 */
export function detectQueryType(
  text: string,
):
  | 'irrigation'
  | 'spray'
  | 'fertigation'
  | 'expense'
  | 'harvest'
  | 'warehouse'
  | 'workers'
  | 'tasks'
  | 'soil_test'
  | 'petiole_test'
  | 'daily_notes'
  | 'weather'
  | null {
  // Activity types
  if (/\birrigat|\bwater|सिंचाई|सिंचन|पाणी|ठिबक/i.test(text)) return 'irrigation';
  if (/\bspray|chemical|pesticide|स्प्रे|फवारणी|छिड़काव/i.test(text)) return 'spray';
  if (/\bfertigat|fertiliz|खत|उर्वरक|फर्टिगेशन/i.test(text)) return 'fertigation';
  if (/\bexpense|cost|spend|खर्च|लागत/i.test(text)) return 'expense';
  if (/\bharvest|yield|pick|कटनी|उत्पादन/i.test(text)) return 'harvest';

  // Other data types
  if (/\bwarehouse|inventory|stock|godown|गोदाम|स्टॉक|इन्व्हेंटरी/i.test(text)) return 'warehouse';
  if (/\bworker|attendance|मजुर|कामगार|हजेरी|worker_attendance/i.test(text)) return 'workers';
  if (/\btask|reminder|काम|टास्क|reminder|remember/i.test(text)) return 'tasks';
  if (/\bsoil[\s_-]?test|मृदा|माती|चाचणी/i.test(text)) return 'soil_test';
  if (/\bpetiole|पेटियोल|देठ|पान/i.test(text)) return 'petiole_test';
  if (/\bdaily[\s_-]?note|नोंद|note|diary|दैनिक/i.test(text)) return 'daily_notes';
  if (/\bweather|हवामान|मौसम|पाऊस|बारिश/i.test(text)) return 'weather';

  return null;
}

/**
 * Check if transcript indicates a history/query intent
 */
export function isLikelyHistoryIntent(text: string): boolean {
  return (
    /\b(total|how much|how many|last|latest|history|record|show|list|what|when)\b/i.test(text) ||
    /कितना|कितने|किती|इतिहास|एकूण|कुल|शेवट|दाखवा|यादी/i.test(text)
  );
}

/**
 * Parse explicit date from transcript
 */
export function parseExplicitDate(text: string): string | null {
  const directIso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (directIso?.[1]) return directIso[1];
  return null;
}

// ============================================================
// MARK: - Farm Record Queries
// ============================================================

/**
 * Query irrigation records
 */
export async function queryIrrigationRecords(input: {
  userId: string | null;
  farmId: number | null;
  explicitDate: string | null;
  isTotalQuery: boolean;
  locale: 'en' | 'hi' | 'mr';
  toolCalls: ToolCall[];
}): Promise<FarmDataQueryResult> {
  const client = getSupabaseClient();
  if (!input.userId || !client) {
    input.toolCalls.push({
      tool: 'log_activity.query',
      status: 'skipped',
      output: { reason: 'missing_user_or_client' },
    });
    return { answer: null, citations: [], records: [], totalCount: 0 };
  }

  const table = 'irrigation_records';
  let totalDuration = 0;
  let totalRows = 0;
  const pageSize = 500;

  if (input.isTotalQuery) {
    for (let start = 0; ; start += pageSize) {
      let pageQuery = client
        .from(table)
        .select('id, duration, farms!inner(user_id)')
        .eq('farms.user_id', input.userId)
        .order('date', { ascending: false })
        .range(start, start + pageSize - 1);

      if (input.farmId) pageQuery = pageQuery.eq('farm_id', input.farmId);
      if (input.explicitDate) pageQuery = pageQuery.eq('date', input.explicitDate);

      const { data, error } = await pageQuery;
      if (error) {
        input.toolCalls.push({ tool: 'log_activity.query', status: 'error', error: error.message });
        return { answer: null, citations: [], records: [], totalCount: 0 };
      }

      const pageRows = Array.isArray(data) ? data : [];
      totalRows += pageRows.length;
      for (const row of pageRows) {
        totalDuration += safeNumber((row as Record<string, unknown>).duration);
      }
      if (pageRows.length < pageSize) break;
    }

    input.toolCalls.push({
      tool: 'log_activity.query',
      status: 'ok',
      output: { table, count: totalRows },
    });

    if (totalRows === 0) {
      return {
        answer:
          input.locale === 'hi'
            ? 'कोई सिंचाई रिकॉर्ड नहीं मिला।'
            : input.locale === 'mr'
              ? 'कोणतीही सिंचन नोंद आढळली नाही.'
              : 'No irrigation records found.',
        citations: [],
        records: [],
        totalCount: 0,
      };
    }

    return {
      answer:
        input.locale === 'hi'
          ? `कुल सिंचाई ${totalDuration.toFixed(2)} घंटे (${totalRows} रिकॉर्ड)।`
          : input.locale === 'mr'
            ? `एकूण सिंचन ${totalDuration.toFixed(2)} तास (${totalRows} नोंदी).`
            : `Total irrigation is ${totalDuration.toFixed(2)} hours across ${totalRows} records.`,
      citations: [
        {
          id: 'irrigation-total',
          title: 'Irrigation records',
          sourceType: 'farm_record',
          snippet: `Computed from ${totalRows} irrigation record(s).`,
        },
      ],
      records: [],
      totalCount: totalRows,
    };
  }

  // Latest records query
  let query = client
    .from(table)
    .select('id, farm_id, date, duration, farms!inner(user_id, name)')
    .eq('farms.user_id', input.userId)
    .order('date', { ascending: false })
    .limit(50);

  if (input.farmId) query = query.eq('farm_id', input.farmId);
  if (input.explicitDate) query = query.eq('date', input.explicitDate);

  const { data, error } = await query;
  if (error) {
    input.toolCalls.push({ tool: 'log_activity.query', status: 'error', error: error.message });
    return { answer: null, citations: [], records: [], totalCount: 0 };
  }

  const rows = Array.isArray(data) ? data : [];
  input.toolCalls.push({
    tool: 'log_activity.query',
    status: 'ok',
    output: { table, count: rows.length },
  });

  if (rows.length === 0) {
    return {
      answer:
        input.locale === 'hi'
          ? 'कोई सिंचाई रिकॉर्ड नहीं मिला।'
          : input.locale === 'mr'
            ? 'कोणतीही सिंचन नोंद आढळली नाही.'
            : 'No irrigation records found.',
      citations: [],
      records: [],
      totalCount: 0,
    };
  }

  const latest = rows[0] as Record<string, unknown>;
  const latestDate = String(latest.date ?? 'unknown');
  const latestDuration = safeNumber(latest.duration);

  return {
    answer:
      input.locale === 'hi'
        ? `नवीनतम सिंचाई: ${latestDuration} घंटे ${latestDate} को।`
        : input.locale === 'mr'
          ? `अलीकडील सिंचन: ${latestDuration} तास ${latestDate} रोजी.`
          : `Latest irrigation: ${latestDuration} hours on ${latestDate}.`,
    citations: [
      {
        id: 'irrigation-latest',
        title: 'Latest irrigation record',
        sourceType: 'farm_record',
        snippet: JSON.stringify(latest),
      },
    ],
    records: rows as FarmRecordRow[],
    totalCount: rows.length,
  };
}

/**
 * Query spray records
 */
export async function querySprayRecords(input: {
  userId: string | null;
  farmId: number | null;
  explicitDate: string | null;
  locale: 'en' | 'hi' | 'mr';
  toolCalls: ToolCall[];
}): Promise<FarmDataQueryResult> {
  const client = getSupabaseClient();
  if (!input.userId || !client) {
    input.toolCalls.push({
      tool: 'log_activity.query',
      status: 'skipped',
      output: { reason: 'missing_user_or_client' },
    });
    return { answer: null, citations: [], records: [], totalCount: 0 };
  }

  const table = 'spray_records';
  let query = client
    .from(table)
    .select('id, farm_id, date, chemical, dose, water_volume, farms!inner(user_id, name)')
    .eq('farms.user_id', input.userId)
    .order('date', { ascending: false })
    .limit(50);

  if (input.farmId) query = query.eq('farm_id', input.farmId);
  if (input.explicitDate) query = query.eq('date', input.explicitDate);

  const { data, error } = await query;
  if (error) {
    input.toolCalls.push({ tool: 'log_activity.query', status: 'error', error: error.message });
    return { answer: null, citations: [], records: [], totalCount: 0 };
  }

  const rows = Array.isArray(data) ? data : [];
  input.toolCalls.push({
    tool: 'log_activity.query',
    status: 'ok',
    output: { table, count: rows.length },
  });

  if (rows.length === 0) {
    return {
      answer:
        input.locale === 'hi'
          ? 'कोई स्प्रे रिकॉर्ड नहीं मिला।'
          : input.locale === 'mr'
            ? 'कोणतीही फवारणी नोंद आढळली नाही.'
            : 'No spray records found.',
      citations: [],
      records: [],
      totalCount: 0,
    };
  }

  const latest = rows[0] as Record<string, unknown>;
  const latestDate = String(latest.date ?? 'unknown');
  const chemical = String(latest.chemical ?? 'unknown');
  const dose = latest.dose ?? '-';

  return {
    answer:
      input.locale === 'hi'
        ? `नवीनतम स्प्रे: ${chemical} (${dose}) ${latestDate} को।`
        : input.locale === 'mr'
          ? `अलीकडील फवारणी: ${chemical} (${dose}) ${latestDate} रोजी.`
          : `Latest spray: ${chemical} (${dose}) on ${latestDate}.`,
    citations: [
      {
        id: 'spray-latest',
        title: 'Latest spray record',
        sourceType: 'farm_record',
        snippet: JSON.stringify(latest),
      },
    ],
    records: rows as FarmRecordRow[],
    totalCount: rows.length,
  };
}

/**
 * Query fertigation records
 */
export async function queryFertigationRecords(input: {
  userId: string | null;
  farmId: number | null;
  explicitDate: string | null;
  locale: 'en' | 'hi' | 'mr';
  toolCalls: ToolCall[];
}): Promise<FarmDataQueryResult> {
  const client = getSupabaseClient();
  if (!input.userId || !client) {
    input.toolCalls.push({
      tool: 'log_activity.query',
      status: 'skipped',
      output: { reason: 'missing_user_or_client' },
    });
    return { answer: null, citations: [], records: [], totalCount: 0 };
  }

  const table = 'fertigation_records';
  let query = client
    .from(table)
    .select('id, farm_id, date, fertilizers, water_volume, farms!inner(user_id, name)')
    .eq('farms.user_id', input.userId)
    .order('date', { ascending: false })
    .limit(50);

  if (input.farmId) query = query.eq('farm_id', input.farmId);
  if (input.explicitDate) query = query.eq('date', input.explicitDate);

  const { data, error } = await query;
  if (error) {
    input.toolCalls.push({ tool: 'log_activity.query', status: 'error', error: error.message });
    return { answer: null, citations: [], records: [], totalCount: 0 };
  }

  const rows = Array.isArray(data) ? data : [];
  input.toolCalls.push({
    tool: 'log_activity.query',
    status: 'ok',
    output: { table, count: rows.length },
  });

  if (rows.length === 0) {
    return {
      answer:
        input.locale === 'hi'
          ? 'कोई फर्टिगेशन रिकॉर्ड नहीं मिला।'
          : input.locale === 'mr'
            ? 'कोणतीही फर्टिगेशन नोंद आढळली नाही.'
            : 'No fertigation records found.',
      citations: [],
      records: [],
      totalCount: 0,
    };
  }

  const latest = rows[0] as Record<string, unknown>;
  const latestDate = String(latest.date ?? 'unknown');
  const fertilizers = latest.fertilizers ?? 'unknown';

  return {
    answer:
      input.locale === 'hi'
        ? `नवीनतम फर्टिगेशन: ${JSON.stringify(fertilizers)} ${latestDate} को।`
        : input.locale === 'mr'
          ? `अलीकडील फर्टिगेशन: ${JSON.stringify(fertilizers)} ${latestDate} रोजी.`
          : `Latest fertigation: ${JSON.stringify(fertilizers)} on ${latestDate}.`,
    citations: [
      {
        id: 'fertigation-latest',
        title: 'Latest fertigation record',
        sourceType: 'farm_record',
        snippet: JSON.stringify(latest),
      },
    ],
    records: rows as FarmRecordRow[],
    totalCount: rows.length,
  };
}

/**
 * Query expense records with aggregation
 */
export async function queryExpenseRecords(input: {
  userId: string | null;
  farmId: number | null;
  explicitDate: string | null;
  isTotalQuery: boolean;
  locale: 'en' | 'hi' | 'mr';
  toolCalls: ToolCall[];
}): Promise<FarmDataQueryResult> {
  const client = getSupabaseClient();
  if (!input.userId || !client) {
    input.toolCalls.push({
      tool: 'log_activity.query',
      status: 'skipped',
      output: { reason: 'missing_user_or_client' },
    });
    return { answer: null, citations: [], records: [], totalCount: 0 };
  }

  const table = 'expense_records';
  let totalCost = 0;
  let totalRows = 0;
  const pageSize = 500;

  if (input.isTotalQuery) {
    for (let start = 0; ; start += pageSize) {
      let pageQuery = client
        .from(table)
        .select('id, cost, farms!inner(user_id)')
        .eq('farms.user_id', input.userId)
        .order('date', { ascending: false })
        .range(start, start + pageSize - 1);

      if (input.farmId) pageQuery = pageQuery.eq('farm_id', input.farmId);
      if (input.explicitDate) pageQuery = pageQuery.eq('date', input.explicitDate);

      const { data, error } = await pageQuery;
      if (error) {
        input.toolCalls.push({ tool: 'log_activity.query', status: 'error', error: error.message });
        return { answer: null, citations: [], records: [], totalCount: 0 };
      }

      const pageRows = Array.isArray(data) ? data : [];
      totalRows += pageRows.length;
      for (const row of pageRows) {
        totalCost += safeNumber((row as Record<string, unknown>).cost);
      }
      if (pageRows.length < pageSize) break;
    }

    input.toolCalls.push({
      tool: 'log_activity.query',
      status: 'ok',
      output: { table, count: totalRows },
    });

    if (totalRows === 0) {
      return {
        answer:
          input.locale === 'hi'
            ? 'कोई खर्च रिकॉर्ड नहीं मिला।'
            : input.locale === 'mr'
              ? 'कोणतीही खर्च नोंद आढळली नाही.'
              : 'No expense records found.',
        citations: [],
        records: [],
        totalCount: 0,
      };
    }

    return {
      answer:
        input.locale === 'hi'
          ? `कुल खर्च ₹${totalCost.toFixed(2)} (${totalRows} रिकॉर्ड)।`
          : input.locale === 'mr'
            ? `एकूण खर्च ₹${totalCost.toFixed(2)} (${totalRows} नोंदी).`
            : `Total expense is ₹${totalCost.toFixed(2)} across ${totalRows} records.`,
      citations: [
        {
          id: 'expense-total',
          title: 'Expense records',
          sourceType: 'farm_record',
          snippet: `Computed from ${totalRows} expense record(s).`,
        },
      ],
      records: [],
      totalCount: totalRows,
    };
  }

  let query = client
    .from(table)
    .select('id, farm_id, date, cost, type, farms!inner(user_id, name)')
    .eq('farms.user_id', input.userId)
    .order('date', { ascending: false })
    .limit(50);

  if (input.farmId) query = query.eq('farm_id', input.farmId);
  if (input.explicitDate) query = query.eq('date', input.explicitDate);

  const { data, error } = await query;
  if (error) {
    input.toolCalls.push({ tool: 'log_activity.query', status: 'error', error: error.message });
    return { answer: null, citations: [], records: [], totalCount: 0 };
  }

  const rows = Array.isArray(data) ? data : [];
  input.toolCalls.push({
    tool: 'log_activity.query',
    status: 'ok',
    output: { table, count: rows.length },
  });

  if (rows.length === 0) {
    return {
      answer:
        input.locale === 'hi'
          ? 'कोई खर्च रिकॉर्ड नहीं मिला।'
          : input.locale === 'mr'
            ? 'कोणतीही खर्च नोंद आढळली नाही.'
            : 'No expense records found.',
      citations: [],
      records: [],
      totalCount: 0,
    };
  }

  const latest = rows[0] as Record<string, unknown>;
  const latestDate = String(latest.date ?? 'unknown');
  const latestCost = safeNumber(latest.cost);
  const latestType = String(latest.type ?? 'other');

  return {
    answer:
      input.locale === 'hi'
        ? `नवीनतम खर्च: ₹${latestCost.toFixed(2)} (${latestType}) ${latestDate} को।`
        : input.locale === 'mr'
          ? `अलीकडील खर्च: ₹${latestCost.toFixed(2)} (${latestType}) ${latestDate} रोजी.`
          : `Latest expense: ₹${latestCost.toFixed(2)} (${latestType}) on ${latestDate}.`,
    citations: [
      {
        id: 'expense-latest',
        title: 'Latest expense record',
        sourceType: 'farm_record',
        snippet: JSON.stringify(latest),
      },
    ],
    records: rows as FarmRecordRow[],
    totalCount: rows.length,
  };
}

/**
 * Query harvest records with aggregation
 */
export async function queryHarvestRecords(input: {
  userId: string | null;
  farmId: number | null;
  explicitDate: string | null;
  isTotalQuery: boolean;
  locale: 'en' | 'hi' | 'mr';
  toolCalls: ToolCall[];
}): Promise<FarmDataQueryResult> {
  const client = getSupabaseClient();
  if (!input.userId || !client) {
    input.toolCalls.push({
      tool: 'log_activity.query',
      status: 'skipped',
      output: { reason: 'missing_user_or_client' },
    });
    return { answer: null, citations: [], records: [], totalCount: 0 };
  }

  const table = 'harvest_records';
  let totalQuantity = 0;
  let totalRows = 0;
  const pageSize = 500;

  if (input.isTotalQuery) {
    for (let start = 0; ; start += pageSize) {
      let pageQuery = client
        .from(table)
        .select('id, quantity, farms!inner(user_id)')
        .eq('farms.user_id', input.userId)
        .order('date', { ascending: false })
        .range(start, start + pageSize - 1);

      if (input.farmId) pageQuery = pageQuery.eq('farm_id', input.farmId);
      if (input.explicitDate) pageQuery = pageQuery.eq('date', input.explicitDate);

      const { data, error } = await pageQuery;
      if (error) {
        input.toolCalls.push({ tool: 'log_activity.query', status: 'error', error: error.message });
        return { answer: null, citations: [], records: [], totalCount: 0 };
      }

      const pageRows = Array.isArray(data) ? data : [];
      totalRows += pageRows.length;
      for (const row of pageRows) {
        totalQuantity += safeNumber((row as Record<string, unknown>).quantity);
      }
      if (pageRows.length < pageSize) break;
    }

    input.toolCalls.push({
      tool: 'log_activity.query',
      status: 'ok',
      output: { table, count: totalRows },
    });

    if (totalRows === 0) {
      return {
        answer:
          input.locale === 'hi'
            ? 'कोई कटनी रिकॉर्ड नहीं मिला।'
            : input.locale === 'mr'
              ? 'कोणतीही कापणी नोंद आढळली नाही.'
              : 'No harvest records found.',
        citations: [],
        records: [],
        totalCount: 0,
      };
    }

    return {
      answer:
        input.locale === 'hi'
          ? `कुल कटनी ${totalQuantity.toFixed(2)} क्विंटल (${totalRows} रिकॉर्ड)।`
          : input.locale === 'mr'
            ? `एकूण कापणी ${totalQuantity.toFixed(2)} क्विंटल (${totalRows} नोंदी).`
            : `Total harvest is ${totalQuantity.toFixed(2)} quintals across ${totalRows} records.`,
      citations: [
        {
          id: 'harvest-total',
          title: 'Harvest records',
          sourceType: 'farm_record',
          snippet: `Computed from ${totalRows} harvest record(s).`,
        },
      ],
      records: [],
      totalCount: totalRows,
    };
  }

  let query = client
    .from(table)
    .select('id, farm_id, date, quantity, grade, price, farms!inner(user_id, name)')
    .eq('farms.user_id', input.userId)
    .order('date', { ascending: false })
    .limit(50);

  if (input.farmId) query = query.eq('farm_id', input.farmId);
  if (input.explicitDate) query = query.eq('date', input.explicitDate);

  const { data, error } = await query;
  if (error) {
    input.toolCalls.push({ tool: 'log_activity.query', status: 'error', error: error.message });
    return { answer: null, citations: [], records: [], totalCount: 0 };
  }

  const rows = Array.isArray(data) ? data : [];
  input.toolCalls.push({
    tool: 'log_activity.query',
    status: 'ok',
    output: { table, count: rows.length },
  });

  if (rows.length === 0) {
    return {
      answer:
        input.locale === 'hi'
          ? 'कोई कटनी रिकॉर्ड नहीं मिला।'
          : input.locale === 'mr'
            ? 'कोणतीही कापणी नोंद आढळली नाही.'
            : 'No harvest records found.',
      citations: [],
      records: [],
      totalCount: 0,
    };
  }

  const latest = rows[0] as Record<string, unknown>;
  const latestDate = String(latest.date ?? 'unknown');
  const latestQty = safeNumber(latest.quantity);
  const latestGrade = String(latest.grade ?? 'N/A');

  return {
    answer:
      input.locale === 'hi'
        ? `नवीनतम कटनी: ${latestQty} क्विंटल (${latestGrade} ग्रेड) ${latestDate} को।`
        : input.locale === 'mr'
          ? `अलीकडील कापणी: ${latestQty} क्विंटल (${latestGrade} ग्रेड) ${latestDate} रोजी.`
          : `Latest harvest: ${latestQty} quintals (${latestGrade} grade) on ${latestDate}.`,
    citations: [
      {
        id: 'harvest-latest',
        title: 'Latest harvest record',
        sourceType: 'farm_record',
        snippet: JSON.stringify(latest),
      },
    ],
    records: rows as FarmRecordRow[],
    totalCount: rows.length,
  };
}

// ============================================================
// MARK: - Other Data Type Queries
// ============================================================

/**
 * Query warehouse items (inventory)
 */
export async function queryWarehouseItems(input: {
  userId: string | null;
  locale: 'en' | 'hi' | 'mr';
  toolCalls: ToolCall[];
}): Promise<FarmDataQueryResult> {
  const client = getSupabaseClient();
  if (!input.userId || !client) {
    input.toolCalls.push({
      tool: 'warehouse.query',
      status: 'skipped',
      output: { reason: 'missing_user_or_client' },
    });
    return { answer: null, citations: [], records: [], totalCount: 0 };
  }

  const { data, error } = await client
    .from('warehouse_items')
    .select('id, name, type, quantity, unit, unit_price')
    .eq('user_id', input.userId)
    .order('name', { ascending: true })
    .limit(100);

  if (error) {
    input.toolCalls.push({ tool: 'warehouse.query', status: 'error', error: error.message });
    return { answer: null, citations: [], records: [], totalCount: 0 };
  }

  const rows = Array.isArray(data) ? data : [];
  input.toolCalls.push({
    tool: 'warehouse.query',
    status: 'ok',
    output: { count: rows.length },
  });

  if (rows.length === 0) {
    return {
      answer:
        input.locale === 'hi'
          ? 'गोदाम में कोई आइटम नहीं।'
          : input.locale === 'mr'
            ? 'गोदामात कोणतीही वस्तू नाही.'
            : 'No items in warehouse.',
      citations: [],
      records: [],
      totalCount: 0,
    };
  }

  // Summarize inventory
  const fertilizerCount = rows.filter((r) => r.type === 'fertilizer').length;
  const sprayCount = rows.filter((r) => r.type === 'spray').length;
  const totalValue = rows.reduce(
    (sum, r) => sum + safeNumber(r.quantity) * safeNumber(r.unit_price),
    0,
  );

  return {
    answer:
      input.locale === 'hi'
        ? `गोदाम में ${rows.length} आइटम: ${fertilizerCount} खाद, ${sprayCount} स्प्रे। कुल मूल्य: ₹${totalValue.toFixed(2)}।`
        : input.locale === 'mr'
          ? `गोदामात ${rows.length} वस्तू: ${fertilizerCount} खत, ${sprayCount} फवारणी. एकूण मूल्य: ₹${totalValue.toFixed(2)}.`
          : `Warehouse has ${rows.length} items: ${fertilizerCount} fertilizers, ${sprayCount} sprays. Total value: ₹${totalValue.toFixed(2)}.`,
    citations: [
      {
        id: 'warehouse-summary',
        title: 'Warehouse inventory',
        sourceType: 'farm_record',
        snippet: `${rows.length} items in stock.`,
      },
    ],
    records: rows as FarmRecordRow[],
    totalCount: rows.length,
  };
}

/**
 * Query workers and attendance
 */
export async function queryWorkers(input: {
  userId: string | null;
  farmId: number | null;
  explicitDate: string | null;
  locale: 'en' | 'hi' | 'mr';
  toolCalls: ToolCall[];
}): Promise<FarmDataQueryResult> {
  const client = getSupabaseClient();
  if (!input.userId || !client) {
    input.toolCalls.push({
      tool: 'workers.query',
      status: 'skipped',
      output: { reason: 'missing_user_or_client' },
    });
    return { answer: null, citations: [], records: [], totalCount: 0 };
  }

  // Query workers
  const { data: workersData, error: workersError } = await client
    .from('workers')
    .select('id, name, daily_rate, is_active')
    .eq('user_id', input.userId)
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (workersError) {
    input.toolCalls.push({ tool: 'workers.query', status: 'error', error: workersError.message });
    return { answer: null, citations: [], records: [], totalCount: 0 };
  }

  const workers = Array.isArray(workersData) ? workersData : [];

  // If specific date, get attendance
  let attendanceRows: Array<Record<string, unknown>> = [];
  if (input.explicitDate) {
    let attendanceQuery = client
      .from('worker_attendance')
      .select('id, worker_id, date, work_status, work_type, workers(name)')
      .eq('date', input.explicitDate);

    if (input.farmId) {
      attendanceQuery = attendanceQuery.contains('farm_ids', [input.farmId]);
    }

    const { data: attendanceData, error: attendanceError } = await attendanceQuery;
    if (!attendanceError && Array.isArray(attendanceData)) {
      attendanceRows = attendanceData as Array<Record<string, unknown>>;
    }
  }

  input.toolCalls.push({
    tool: 'workers.query',
    status: 'ok',
    output: { workersCount: workers.length, attendanceCount: attendanceRows.length },
  });

  if (workers.length === 0) {
    return {
      answer:
        input.locale === 'hi'
          ? 'कोई कामगार नहीं मिला।'
          : input.locale === 'mr'
            ? 'कोणतेही कामगार आढळले नाही.'
            : 'No workers found.',
      citations: [],
      records: [],
      totalCount: 0,
    };
  }

  if (input.explicitDate && attendanceRows.length > 0) {
    const present = attendanceRows.filter(
      (r) => r.work_status === 'full_day' || r.work_status === 'half_day',
    ).length;
    return {
      answer:
        input.locale === 'hi'
          ? `${input.explicitDate} को ${present}/${workers.length} कामगार मौजूद।`
          : input.locale === 'mr'
            ? `${input.explicitDate} रोजी ${present}/${workers.length} कामगार उपस्थित.`
            : `${present}/${workers.length} workers present on ${input.explicitDate}.`,
      citations: [
        {
          id: 'workers-attendance',
          title: 'Worker attendance',
          sourceType: 'farm_record',
          snippet: `${present} present out of ${workers.length}.`,
        },
      ],
      records: attendanceRows as FarmRecordRow[],
      totalCount: workers.length,
    };
  }

  return {
    answer:
      input.locale === 'hi'
        ? `${workers.length} सक्रिय कामगार।`
        : input.locale === 'mr'
          ? `${workers.length} सक्रिय कामगार.`
          : `${workers.length} active workers.`,
    citations: [
      {
        id: 'workers-summary',
        title: 'Workers summary',
        sourceType: 'farm_record',
        snippet: `${workers.length} active workers.`,
      },
    ],
    records: workers as FarmRecordRow[],
    totalCount: workers.length,
  };
}

/**
 * Query task reminders
 */
export async function queryTaskReminders(input: {
  userId: string | null;
  farmId: number | null;
  locale: 'en' | 'hi' | 'mr';
  toolCalls: ToolCall[];
}): Promise<FarmDataQueryResult> {
  const client = getSupabaseClient();
  if (!input.userId || !client) {
    input.toolCalls.push({
      tool: 'tasks.query',
      status: 'skipped',
      output: { reason: 'missing_user_or_client' },
    });
    return { answer: null, citations: [], records: [], totalCount: 0 };
  }

  let query = client
    .from('task_reminders')
    .select('id, farm_id, title, type, status, priority, due_date, farms!inner(user_id)')
    .eq('farms.user_id', input.userId)
    .eq('status', 'pending')
    .order('due_date', { ascending: true })
    .limit(20);

  if (input.farmId) query = query.eq('farm_id', input.farmId);

  const { data, error } = await query;
  if (error) {
    input.toolCalls.push({ tool: 'tasks.query', status: 'error', error: error.message });
    return { answer: null, citations: [], records: [], totalCount: 0 };
  }

  const rows = Array.isArray(data) ? data : [];
  input.toolCalls.push({
    tool: 'tasks.query',
    status: 'ok',
    output: { count: rows.length },
  });

  if (rows.length === 0) {
    return {
      answer:
        input.locale === 'hi'
          ? 'कोई लंबित कार्य नहीं।'
          : input.locale === 'mr'
            ? 'कोणतेही प्रलंबित काम नाही.'
            : 'No pending tasks.',
      citations: [],
      records: [],
      totalCount: 0,
    };
  }

  const highPriority = rows.filter((r) => r.priority === 'high').length;
  const dueToday = rows.filter((r) => {
    const due = r.due_date;
    if (!due) return false;
    const today = new Date().toISOString().split('T')[0];
    return due === today;
  }).length;

  return {
    answer:
      input.locale === 'hi'
        ? `${rows.length} लंबित कार्य। ${highPriority} उच्च प्राथमिकता, ${dueToday} आज के।`
        : input.locale === 'mr'
          ? `${rows.length} प्रलंबित काम. ${highPriority} उच्च प्राधान्य, ${dueToday} आजची.`
          : `${rows.length} pending tasks. ${highPriority} high priority, ${dueToday} due today.`,
    citations: [
      {
        id: 'tasks-summary',
        title: 'Task reminders',
        sourceType: 'farm_record',
        snippet: `${rows.length} pending tasks.`,
      },
    ],
    records: rows as FarmRecordRow[],
    totalCount: rows.length,
  };
}

/**
 * Query soil test records
 */
export async function querySoilTestRecords(input: {
  userId: string | null;
  farmId: number | null;
  locale: 'en' | 'hi' | 'mr';
  toolCalls: ToolCall[];
}): Promise<FarmDataQueryResult> {
  const client = getSupabaseClient();
  if (!input.userId || !client) {
    input.toolCalls.push({
      tool: 'soil_test.query',
      status: 'skipped',
      output: { reason: 'missing_user_or_client' },
    });
    return { answer: null, citations: [], records: [], totalCount: 0 };
  }

  let query = client
    .from('soil_test_records')
    .select('id, farm_id, date, parameters, recommendations, farms!inner(user_id, name)')
    .eq('farms.user_id', input.userId)
    .order('date', { ascending: false })
    .limit(10);

  if (input.farmId) query = query.eq('farm_id', input.farmId);

  const { data, error } = await query;
  if (error) {
    input.toolCalls.push({ tool: 'soil_test.query', status: 'error', error: error.message });
    return { answer: null, citations: [], records: [], totalCount: 0 };
  }

  const rows = Array.isArray(data) ? data : [];
  input.toolCalls.push({
    tool: 'soil_test.query',
    status: 'ok',
    output: { count: rows.length },
  });

  if (rows.length === 0) {
    return {
      answer:
        input.locale === 'hi'
          ? 'कोई मृदा परीक्षण रिकॉर्ड नहीं।'
          : input.locale === 'mr'
            ? 'कोणतीही माती चाचणी नोंद नाही.'
            : 'No soil test records found.',
      citations: [],
      records: [],
      totalCount: 0,
    };
  }

  const latest = rows[0] as Record<string, unknown>;
  const latestDate = String(latest.date ?? 'unknown');
  const params = latest.parameters as Record<string, unknown> | null;
  const ph = params?.pH ?? params?.['pH'] ?? 'N/A';

  return {
    answer:
      input.locale === 'hi'
        ? `नवीनतम मृदा परीक्षण: ${latestDate}। पीएच: ${ph}।`
        : input.locale === 'mr'
          ? `अलीकडील माती चाचणी: ${latestDate}. pH: ${ph}.`
          : `Latest soil test: ${latestDate}. pH: ${ph}.`,
    citations: [
      {
        id: 'soil-test-latest',
        title: 'Soil test record',
        sourceType: 'farm_record',
        snippet: JSON.stringify(latest),
      },
    ],
    records: rows as FarmRecordRow[],
    totalCount: rows.length,
  };
}

/**
 * Query petiole test records
 */
export async function queryPetioleTestRecords(input: {
  userId: string | null;
  farmId: number | null;
  locale: 'en' | 'hi' | 'mr';
  toolCalls: ToolCall[];
}): Promise<FarmDataQueryResult> {
  const client = getSupabaseClient();
  if (!input.userId || !client) {
    input.toolCalls.push({
      tool: 'petiole_test.query',
      status: 'skipped',
      output: { reason: 'missing_user_or_client' },
    });
    return { answer: null, citations: [], records: [], totalCount: 0 };
  }

  let query = client
    .from('petiole_test_records')
    .select('id, farm_id, date, parameters, recommendations, farms!inner(user_id, name)')
    .eq('farms.user_id', input.userId)
    .order('date', { ascending: false })
    .limit(10);

  if (input.farmId) query = query.eq('farm_id', input.farmId);

  const { data, error } = await query;
  if (error) {
    input.toolCalls.push({ tool: 'petiole_test.query', status: 'error', error: error.message });
    return { answer: null, citations: [], records: [], totalCount: 0 };
  }

  const rows = Array.isArray(data) ? data : [];
  input.toolCalls.push({
    tool: 'petiole_test.query',
    status: 'ok',
    output: { count: rows.length },
  });

  if (rows.length === 0) {
    return {
      answer:
        input.locale === 'hi'
          ? 'कोई पेटियोल परीक्षण रिकॉर्ड नहीं।'
          : input.locale === 'mr'
            ? 'कोणतीही पेटियोल चाचणी नोंद नाही.'
            : 'No petiole test records found.',
      citations: [],
      records: [],
      totalCount: 0,
    };
  }

  const latest = rows[0] as Record<string, unknown>;
  const latestDate = String(latest.date ?? 'unknown');

  return {
    answer:
      input.locale === 'hi'
        ? `नवीनतम पेटियोल परीक्षण: ${latestDate}।`
        : input.locale === 'mr'
          ? `अलीकडील पेटियोल चाचणी: ${latestDate}.`
          : `Latest petiole test: ${latestDate}.`,
    citations: [
      {
        id: 'petiole-test-latest',
        title: 'Petiole test record',
        sourceType: 'farm_record',
        snippet: JSON.stringify(latest),
      },
    ],
    records: rows as FarmRecordRow[],
    totalCount: rows.length,
  };
}

/**
 * Query daily notes
 */
export async function queryDailyNotes(input: {
  userId: string | null;
  farmId: number | null;
  explicitDate: string | null;
  locale: 'en' | 'hi' | 'mr';
  toolCalls: ToolCall[];
}): Promise<FarmDataQueryResult> {
  const client = getSupabaseClient();
  if (!input.userId || !client) {
    input.toolCalls.push({
      tool: 'daily_notes.query',
      status: 'skipped',
      output: { reason: 'missing_user_or_client' },
    });
    return { answer: null, citations: [], records: [], totalCount: 0 };
  }

  let query = client
    .from('daily_notes')
    .select('id, farm_id, date, notes, farms!inner(user_id, name)')
    .eq('farms.user_id', input.userId)
    .order('date', { ascending: false })
    .limit(30);

  if (input.farmId) query = query.eq('farm_id', input.farmId);
  if (input.explicitDate) query = query.eq('date', input.explicitDate);

  const { data, error } = await query;
  if (error) {
    input.toolCalls.push({ tool: 'daily_notes.query', status: 'error', error: error.message });
    return { answer: null, citations: [], records: [], totalCount: 0 };
  }

  const rows = Array.isArray(data) ? data : [];
  input.toolCalls.push({
    tool: 'daily_notes.query',
    status: 'ok',
    output: { count: rows.length },
  });

  if (rows.length === 0) {
    return {
      answer:
        input.locale === 'hi'
          ? 'कोई दैनिक नोट नहीं।'
          : input.locale === 'mr'
            ? 'कोणतीही दैनिक नोंद नाही.'
            : 'No daily notes found.',
      citations: [],
      records: [],
      totalCount: 0,
    };
  }

  const latest = rows[0] as Record<string, unknown>;
  const latestDate = String(latest.date ?? 'unknown');
  const notePreview = String(latest.notes ?? '').slice(0, 100);

  return {
    answer:
      input.locale === 'hi'
        ? `नवीनतम नोट (${latestDate}): ${notePreview}...`
        : input.locale === 'mr'
          ? `अलीकडील नोंद (${latestDate}): ${notePreview}...`
          : `Latest note (${latestDate}): ${notePreview}...`,
    citations: [
      {
        id: 'daily-note-latest',
        title: 'Daily note',
        sourceType: 'farm_record',
        snippet: String(latest.notes ?? ''),
      },
    ],
    records: rows as FarmRecordRow[],
    totalCount: rows.length,
  };
}

// ============================================================
// MARK: - Weather Data
// ============================================================

/**
 * Fetch weather data for a location
 */
export async function fetchWeatherData(input: {
  latitude: number | null;
  longitude: number | null;
  locale: 'en' | 'hi' | 'mr';
  toolCalls: ToolCall[];
}): Promise<{ data: WeatherData | null; citation: Citation | null }> {
  const lat = input.latitude ?? 19.0825; // Default: Nashik
  const lon = input.longitude ?? 73.1963;

  try {
    const params = new URLSearchParams({
      latitude: lat.toString(),
      longitude: lon.toString(),
      daily: [
        'temperature_2m_max',
        'temperature_2m_min',
        'temperature_2m_mean',
        'relative_humidity_2m_mean',
        'precipitation_sum',
        'precipitation_probability_max',
        'et0_fao_evapotranspiration',
        'wind_speed_10m_max',
      ].join(','),
      timezone: 'auto',
      forecast_days: '7',
    });

    const response = await fetch(`${OPEN_METEO_API}?${params}`);
    if (!response.ok) {
      input.toolCalls.push({
        tool: 'weather.fetch',
        status: 'error',
        error: `HTTP ${response.status}`,
      });
      return { data: null, citation: null };
    }

    const json = await response.json();
    const daily = json.daily;

    if (!daily || !Array.isArray(daily.time)) {
      input.toolCalls.push({
        tool: 'weather.fetch',
        status: 'error',
        error: 'invalid_response_format',
      });
      return { data: null, citation: null };
    }

    const weatherData: WeatherData = {
      temperature: Math.round(daily.temperature_2m_mean[0]),
      humidity: Math.round(daily.relative_humidity_2m_mean[0]),
      windSpeed: Math.round(daily.wind_speed_10m_max[0]),
      precipitation: daily.precipitation_sum[0] || 0,
      precipitationProbability: daily.precipitation_probability_max?.[0] || 0,
      condition: getWeatherCondition(daily.temperature_2m_mean[0], daily.precipitation_sum[0]),
      et0: daily.et0_fao_evapotranspiration[0] || 5,
      forecast: daily.time.slice(0, 7).map((date: string, i: number) => ({
        date,
        maxTemp: Math.round(daily.temperature_2m_max[i]),
        minTemp: Math.round(daily.temperature_2m_min[i]),
        precipitation: daily.precipitation_sum[i] || 0,
        precipitationProbability: daily.precipitation_probability_max?.[i] || 0,
        et0: daily.et0_fao_evapotranspiration[i] || 5,
      })),
    };

    input.toolCalls.push({
      tool: 'weather.fetch',
      status: 'ok',
      output: { temperature: weatherData.temperature, condition: weatherData.condition },
    });

    const citation: Citation = {
      id: 'weather-current',
      title: 'Current weather',
      sourceType: 'weather',
      snippet: `${weatherData.temperature}°C, ${weatherData.condition}, ${weatherData.precipitation}mm rain`,
      metadata: {
        source: 'open-meteo',
        latitude: lat,
        longitude: lon,
      },
    };

    return { data: weatherData, citation };
  } catch (error) {
    input.toolCalls.push({
      tool: 'weather.fetch',
      status: 'error',
      error: String(error),
    });
    return { data: null, citation: null };
  }
}

/**
 * Get weather condition text from temp and precipitation
 */
function getWeatherCondition(temp: number, precipitation: number): string {
  if (precipitation > 5) return 'Rainy';
  if (precipitation > 0) return 'Light Rain';
  if (temp > 35) return 'Hot';
  if (temp > 25) return 'Sunny';
  if (temp > 15) return 'Partly Cloudy';
  return 'Cloudy';
}

/**
 * Build weather context block for LLM
 */
export function buildWeatherContextBlock(weather: WeatherData | null): string {
  if (!weather) return '';

  const forecast3Days = weather.forecast.slice(0, 3);
  const upcomingRain = forecast3Days.reduce((sum, d) => sum + d.precipitation, 0);
  const maxRainProb = Math.max(...forecast3Days.map((d) => d.precipitationProbability));

  return `Weather context:
- Current: ${weather.temperature}°C, ${weather.humidity}% humidity, ${weather.condition}
- Wind: ${weather.windSpeed} km/h
- ET0: ${weather.et0.toFixed(1)} mm/day
- Precipitation today: ${weather.precipitation} mm
- Next 3 days rain: ${upcomingRain.toFixed(1)} mm (max ${maxRainProb}% probability)
- Forecast: ${forecast3Days.map((d) => `${d.date}: ${d.minTemp}-${d.maxTemp}°C`).join(', ')}`;
}

// ============================================================
// MARK: - Unified Query Interface
// ============================================================

/**
 * Query any farm data type based on query type
 */
export async function queryFarmRecords(input: {
  transcript: string;
  userId: string | null;
  farmId: number | null;
  activity: ReturnType<typeof detectActivity>;
  locale: 'en' | 'hi' | 'mr';
  toolCalls: ToolCall[];
}): Promise<{ answer: string | null; citations: Citation[] }> {
  const queryType = detectQueryType(input.transcript);
  const explicitDate = parseExplicitDate(input.transcript);
  const isTotalQuery = /\btotal|how much|how many|कितना|कितने|किती|एकूण|कुल/i.test(
    input.transcript,
  );

  let result: FarmDataQueryResult;

  switch (queryType) {
    case 'irrigation':
      result = await queryIrrigationRecords({
        userId: input.userId,
        farmId: input.farmId,
        explicitDate,
        isTotalQuery,
        locale: input.locale,
        toolCalls: input.toolCalls,
      });
      break;

    case 'spray':
      result = await querySprayRecords({
        userId: input.userId,
        farmId: input.farmId,
        explicitDate,
        locale: input.locale,
        toolCalls: input.toolCalls,
      });
      break;

    case 'fertigation':
      result = await queryFertigationRecords({
        userId: input.userId,
        farmId: input.farmId,
        explicitDate,
        locale: input.locale,
        toolCalls: input.toolCalls,
      });
      break;

    case 'expense':
      result = await queryExpenseRecords({
        userId: input.userId,
        farmId: input.farmId,
        explicitDate,
        isTotalQuery,
        locale: input.locale,
        toolCalls: input.toolCalls,
      });
      break;

    case 'harvest':
      result = await queryHarvestRecords({
        userId: input.userId,
        farmId: input.farmId,
        explicitDate,
        isTotalQuery,
        locale: input.locale,
        toolCalls: input.toolCalls,
      });
      break;

    case 'warehouse':
      result = await queryWarehouseItems({
        userId: input.userId,
        locale: input.locale,
        toolCalls: input.toolCalls,
      });
      break;

    case 'workers':
      result = await queryWorkers({
        userId: input.userId,
        farmId: input.farmId,
        explicitDate,
        locale: input.locale,
        toolCalls: input.toolCalls,
      });
      break;

    case 'tasks':
      result = await queryTaskReminders({
        userId: input.userId,
        farmId: input.farmId,
        locale: input.locale,
        toolCalls: input.toolCalls,
      });
      break;

    case 'soil_test':
      result = await querySoilTestRecords({
        userId: input.userId,
        farmId: input.farmId,
        locale: input.locale,
        toolCalls: input.toolCalls,
      });
      break;

    case 'petiole_test':
      result = await queryPetioleTestRecords({
        userId: input.userId,
        farmId: input.farmId,
        locale: input.locale,
        toolCalls: input.toolCalls,
      });
      break;

    case 'daily_notes':
      result = await queryDailyNotes({
        userId: input.userId,
        farmId: input.farmId,
        explicitDate,
        locale: input.locale,
        toolCalls: input.toolCalls,
      });
      break;

    case 'weather':
      // Weather handled separately
      return { answer: null, citations: [] };

    default:
      input.toolCalls.push({
        tool: 'log_activity.query',
        status: 'skipped',
        output: { reason: 'unknown_query_type' },
      });
      return { answer: null, citations: [] };
  }

  return { answer: result.answer, citations: result.citations };
}

/**
 * Fetch user farms for routing
 */
export async function fetchUserFarms(
  userId: string | null,
): Promise<Array<{ id: number; name: string }>> {
  const client = getSupabaseClient();
  if (!userId || !client) return [];

  const { data, error } = await client
    .from('farms')
    .select('id, name, latitude, longitude')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    console.warn('Failed to fetch farms for route resolution', error.message);
    return [];
  }

  const rows = Array.isArray(data) ? data : [];
  return rows
    .map((row) => {
      const id = toOptionalNumber((row as Record<string, unknown>).id);
      const name = toOptionalString((row as Record<string, unknown>).name);
      if (id === null || !name) return null;
      return { id, name };
    })
    .filter((row): row is { id: number; name: string } => Boolean(row));
}

/**
 * Fetch farm details including location for weather
 */
export async function fetchFarmDetails(
  farmId: number | null,
): Promise<{ latitude: number | null; longitude: number | null; name: string } | null> {
  const client = getSupabaseClient();
  if (!farmId || !client) return null;

  const { data, error } = await client
    .from('farms')
    .select('id, name, latitude, longitude')
    .eq('id', farmId)
    .single();

  if (error || !data) return null;

  const row = data as Record<string, unknown>;
  return {
    name: String(row.name ?? 'Farm'),
    latitude: toOptionalNumber(row.latitude),
    longitude: toOptionalNumber(row.longitude),
  };
}
