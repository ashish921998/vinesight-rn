/**
 * Farm Data Query Module
 * Handles querying farm records for activity logging and history queries.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';
import { safeNumber, toOptionalNumber, toOptionalString } from '../utils/index.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')?.trim() ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() ?? '';

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
}

export interface Citation {
  id: string;
  title: string;
  sourceType: 'farm_record' | 'kb_doc' | 'memory' | 'external';
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

/**
 * Detect activity type from transcript text
 */
export function detectActivity(
  text: string,
): 'irrigation' | 'spray' | 'fertigation' | 'expense' | null {
  if (/\birrigat|\bwater|सिंचाई|सिंचन|पाणी|ठिबक/i.test(text)) return 'irrigation';
  if (/\bspray|chemical|pesticide|स्प्रे|फवारणी|छिड़काव/i.test(text)) return 'spray';
  if (/\bfertigat|fertiliz|खत|उर्वरक|फर्टिगेशन/i.test(text)) return 'fertigation';
  if (/\bexpense|cost|spend|खर्च|लागत/i.test(text)) return 'expense';
  return null;
}

/**
 * Parse explicit date from transcript
 */
export function parseExplicitDate(text: string): string | null {
  const directIso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (directIso?.[1]) return directIso[1];
  return null;
}

/**
 * Check if transcript indicates a history query intent
 */
export function isLikelyHistoryIntent(text: string): boolean {
  return (
    /\b(total|how much|how many|last|latest|history|record)\b/i.test(text) ||
    /कितना|कितने|किती|इतिहास|एकूण|कुल|शेवट/i.test(text)
  );
}

/**
 * Query farm records for activity history
 */
export async function queryFarmRecords(input: {
  transcript: string;
  userId: string | null;
  farmId: number | null;
  activity: ReturnType<typeof detectActivity>;
  locale: 'en' | 'hi' | 'mr';
  toolCalls: ToolCall[];
}): Promise<{ answer: string | null; citations: Citation[] }> {
  const client = getSupabaseClient();
  if (!input.userId || !input.activity) {
    input.toolCalls.push({
      tool: 'log_activity.query',
      status: 'skipped',
      output: { reason: 'missing_user_or_activity' },
    });
    return { answer: null, citations: [] };
  }

  if (!client) {
    input.toolCalls.push({
      tool: 'log_activity.query',
      status: 'error',
      error: 'supabase_client_unavailable',
    });
    return { answer: null, citations: [] };
  }

  const tableByActivity: Record<string, string> = {
    irrigation: 'irrigation_records',
    spray: 'spray_records',
    fertigation: 'fertigation_records',
    expense: 'expense_records',
  };

  const selectByActivity: Record<string, string> = {
    irrigation: 'id, farm_id, date, duration, farms!inner(user_id, name)',
    spray: 'id, farm_id, date, chemical, dose, water_volume, farms!inner(user_id, name)',
    fertigation: 'id, farm_id, date, fertilizers, water_volume, farms!inner(user_id, name)',
    expense: 'id, farm_id, date, cost, type, farms!inner(user_id, name)',
  };

  const table = tableByActivity[input.activity];
  const explicitDate = parseExplicitDate(input.transcript);
  const isTotalQuery = /\btotal|how much|how many|कितना|कितने|किती|एकूण|कुल/i.test(
    input.transcript,
  );
  const supportsTotalAggregation = input.activity === 'irrigation' || input.activity === 'expense';

  if (isTotalQuery && supportsTotalAggregation) {
    const valueField = input.activity === 'irrigation' ? 'duration' : 'cost';
    const pageSize = 1000;
    let total = 0;
    let totalRows = 0;

    for (let start = 0; ; start += pageSize) {
      let pageQuery = client
        .from(table)
        .select(`id, ${valueField}, farms!inner(user_id)`)
        .eq('farms.user_id', input.userId)
        .order('date', { ascending: false })
        .range(start, start + pageSize - 1);

      if (input.farmId) {
        pageQuery = pageQuery.eq('farm_id', input.farmId);
      }
      if (explicitDate) {
        pageQuery = pageQuery.eq('date', explicitDate);
      }

      const { data: pageData, error: pageError } = await pageQuery;
      if (pageError) {
        input.toolCalls.push({
          tool: 'log_activity.query',
          status: 'error',
          error: pageError.message,
        });
        return { answer: null, citations: [] };
      }

      const pageRows = Array.isArray(pageData) ? pageData : [];
      totalRows += pageRows.length;
      for (const row of pageRows) {
        const value = (row as Record<string, unknown>)[valueField];
        total += safeNumber(value);
      }

      if (pageRows.length < pageSize) break;
    }

    input.toolCalls.push({
      tool: 'log_activity.query',
      status: 'ok',
      output: { table, count: totalRows },
    });

    if (totalRows === 0) {
      const message =
        input.locale === 'hi'
          ? 'कोई रिकॉर्ड नहीं मिला।'
          : input.locale === 'mr'
            ? 'कोणतीही नोंद आढळली नाही.'
            : 'No records found.';
      return { answer: message, citations: [] };
    }

    if (input.activity === 'irrigation') {
      return {
        answer:
          input.locale === 'hi'
            ? `कुल सिंचाई ${total.toFixed(2)} घंटे है।`
            : input.locale === 'mr'
              ? `एकूण सिंचन ${total.toFixed(2)} तास आहे.`
              : `Total irrigation is ${total.toFixed(2)} hours.`,
        citations: [
          {
            id: 'farm-total-1',
            title: 'Farm operation logs',
            sourceType: 'farm_record',
            snippet: `Computed from ${totalRows} irrigation record(s).`,
          },
        ],
      };
    }

    return {
      answer:
        input.locale === 'hi'
          ? `कुल खर्च ₹${total.toFixed(2)} है।`
          : input.locale === 'mr'
            ? `एकूण खर्च ₹${total.toFixed(2)} आहे.`
            : `Total expense is ₹${total.toFixed(2)}.`,
      citations: [
        {
          id: 'farm-total-2',
          title: 'Farm expense logs',
          sourceType: 'farm_record',
          snippet: `Computed from ${totalRows} expense record(s).`,
        },
      ],
    };
  }

  let query = client
    .from(table)
    .select(selectByActivity[input.activity] ?? 'id, farm_id, date, farms!inner(user_id, name)')
    .eq('farms.user_id', input.userId)
    .order('date', { ascending: false });

  if (!(isTotalQuery && supportsTotalAggregation)) {
    query = query.limit(50);
  }

  if (input.farmId) {
    query = query.eq('farm_id', input.farmId);
  }
  if (explicitDate) {
    query = query.eq('date', explicitDate);
  }

  const { data, error } = await query;
  if (error) {
    input.toolCalls.push({
      tool: 'log_activity.query',
      status: 'error',
      error: error.message,
    });
    return { answer: null, citations: [] };
  }

  const validateFarmRecord = (row: unknown): row is FarmRecordRow => {
    if (!row || typeof row !== 'object') return false;
    const candidate = row as Record<string, unknown>;
    const validId = typeof candidate.id === 'string' || typeof candidate.id === 'number';
    const validDate = candidate.date === null || typeof candidate.date === 'string';
    return validId && validDate;
  };

  const rows: FarmRecordRow[] = Array.isArray(data) ? data.filter(validateFarmRecord) : [];
  input.toolCalls.push({
    tool: 'log_activity.query',
    status: 'ok',
    output: { table, count: rows.length },
  });

  if (rows.length === 0) {
    const message =
      input.locale === 'hi'
        ? 'कोई रिकॉर्ड नहीं मिला।'
        : input.locale === 'mr'
          ? 'कोणतीही नोंद आढळली नाही.'
          : 'No records found.';
    return { answer: message, citations: [] };
  }

  const latest = rows[0];
  const latestDate = latest?.date ?? 'unknown date';
  const latestAnswer =
    input.activity === 'irrigation'
      ? input.locale === 'hi'
        ? `नवीनतम सिंचाई: ${latest?.duration ?? 0} घंटे ${latestDate} को।`
        : input.locale === 'mr'
          ? `अलीकडील सिंचन: ${latest?.duration ?? 0} तास ${latestDate} रोजी.`
          : `Latest irrigation: ${latest?.duration ?? 0} hours on ${latestDate}.`
      : input.activity === 'spray'
        ? input.locale === 'hi'
          ? `नवीनतम स्प्रे: ${latest?.chemical ?? 'अज्ञात'} (${latest?.dose ?? '-'}) ${latestDate} को।`
          : input.locale === 'mr'
            ? `अलीकडील फवारणी: ${latest?.chemical ?? 'अज्ञात'} (${latest?.dose ?? '-'}) ${latestDate} रोजी.`
            : `Latest spray: ${latest?.chemical ?? 'Unknown'} (${latest?.dose ?? '-'}) on ${latestDate}.`
        : input.activity === 'expense'
          ? input.locale === 'hi'
            ? `नवीनतम खर्च: ₹${safeNumber(latest?.cost ?? 0).toFixed(2)} (${latest?.type ?? 'अन्य'}) ${latestDate} को।`
            : input.locale === 'mr'
              ? `अलीकडील खर्च: ₹${safeNumber(latest?.cost ?? 0).toFixed(2)} (${latest?.type ?? 'इतर'}) ${latestDate} रोजी.`
              : `Latest expense: ₹${safeNumber(latest?.cost ?? 0).toFixed(2)} (${latest?.type ?? 'other'}) on ${latestDate}.`
          : input.locale === 'hi'
            ? `नवीनतम ${input.activity} रिकॉर्ड ${latestDate} का है।`
            : input.locale === 'mr'
              ? `अलीकडील ${input.activity} नोंद ${latestDate} ची आहे.`
              : `Latest ${input.activity} record is from ${latestDate}.`;

  return {
    answer: latestAnswer,
    citations: [
      {
        id: 'farm-latest-1',
        title: 'Latest farm log record',
        sourceType: 'farm_record',
        snippet: JSON.stringify(latest),
      },
    ],
  };
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
    .select('id, name')
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
