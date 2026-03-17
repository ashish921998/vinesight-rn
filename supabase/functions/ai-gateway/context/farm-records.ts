/**
 * Farm Records Module
 * Activity record queries: irrigation, spray, fertigation.
 * Expense and harvest records are in farm-financial-records.ts.
 */

import {
  getSupabaseClient,
  safeNumber,
  type FarmDataQueryResult,
  type FarmRecordRow,
  type ToolCall,
} from './farm-details.ts';

const SKIPPED = { answer: null, citations: [], records: [], totalCount: 0 } as FarmDataQueryResult;

function skippedResult(toolCalls: ToolCall[], tool: string): FarmDataQueryResult {
  toolCalls.push({ tool, status: 'skipped', output: { reason: 'missing_user_or_client' } });
  return SKIPPED;
}

export async function queryIrrigationRecords(input: {
  userId: string | null;
  farmId: number | null;
  explicitDate: string | null;
  isTotalQuery: boolean;
  locale: 'en' | 'hi' | 'mr';
  toolCalls: ToolCall[];
}): Promise<FarmDataQueryResult> {
  const client = getSupabaseClient();
  if (!input.userId || !client) return skippedResult(input.toolCalls, 'log_activity.query');

  const table = 'irrigation_records';
  const pageSize = 500;
  let totalDuration = 0;
  let totalRows = 0;

  if (input.isTotalQuery) {
    for (let start = 0; ; start += pageSize) {
      let pq = client
        .from(table)
        .select('id, duration, farms!inner(user_id)')
        .eq('farms.user_id', input.userId)
        .order('date', { ascending: false })
        .range(start, start + pageSize - 1);
      if (input.farmId) pq = pq.eq('farm_id', input.farmId);
      if (input.explicitDate) pq = pq.eq('date', input.explicitDate);
      const { data, error } = await pq;
      if (error) {
        input.toolCalls.push({ tool: 'log_activity.query', status: 'error', error: error.message });
        return SKIPPED;
      }
      const rows = Array.isArray(data) ? data : [];
      totalRows += rows.length;
      for (const row of rows)
        totalDuration += safeNumber((row as Record<string, unknown>).duration);
      if (rows.length < pageSize) break;
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

  let q = client
    .from(table)
    .select('id, farm_id, date, duration, farms!inner(user_id, name)')
    .eq('farms.user_id', input.userId)
    .order('date', { ascending: false })
    .limit(50);
  if (input.farmId) q = q.eq('farm_id', input.farmId);
  if (input.explicitDate) q = q.eq('date', input.explicitDate);
  const { data, error } = await q;
  if (error) {
    input.toolCalls.push({ tool: 'log_activity.query', status: 'error', error: error.message });
    return SKIPPED;
  }
  const rows = Array.isArray(data) ? data : [];
  input.toolCalls.push({
    tool: 'log_activity.query',
    status: 'ok',
    output: { table, count: rows.length },
  });
  if (rows.length === 0)
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
  const latest = rows[0] as Record<string, unknown>;
  return {
    answer:
      input.locale === 'hi'
        ? `नवीनतम सिंचाई: ${safeNumber(latest.duration)} घंटे ${String(latest.date ?? 'unknown')} को।`
        : input.locale === 'mr'
          ? `अलीकडील सिंचन: ${safeNumber(latest.duration)} तास ${String(latest.date ?? 'unknown')} रोजी.`
          : `Latest irrigation: ${safeNumber(latest.duration)} hours on ${String(latest.date ?? 'unknown')}.`,
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

export async function querySprayRecords(input: {
  userId: string | null;
  farmId: number | null;
  explicitDate: string | null;
  locale: 'en' | 'hi' | 'mr';
  toolCalls: ToolCall[];
}): Promise<FarmDataQueryResult> {
  const client = getSupabaseClient();
  if (!input.userId || !client) return skippedResult(input.toolCalls, 'log_activity.query');

  let q = client
    .from('spray_records')
    .select('id, farm_id, date, chemical, dose, water_volume, farms!inner(user_id, name)')
    .eq('farms.user_id', input.userId)
    .order('date', { ascending: false })
    .limit(50);
  if (input.farmId) q = q.eq('farm_id', input.farmId);
  if (input.explicitDate) q = q.eq('date', input.explicitDate);
  const { data, error } = await q;
  if (error) {
    input.toolCalls.push({ tool: 'log_activity.query', status: 'error', error: error.message });
    return SKIPPED;
  }
  const rows = Array.isArray(data) ? data : [];
  input.toolCalls.push({
    tool: 'log_activity.query',
    status: 'ok',
    output: { table: 'spray_records', count: rows.length },
  });
  if (rows.length === 0)
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
  const latest = rows[0] as Record<string, unknown>;
  const chemical = String(latest.chemical ?? 'unknown');
  const dose = latest.dose ?? '-';
  const latestDate = String(latest.date ?? 'unknown');
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

export async function queryFertigationRecords(input: {
  userId: string | null;
  farmId: number | null;
  explicitDate: string | null;
  locale: 'en' | 'hi' | 'mr';
  toolCalls: ToolCall[];
}): Promise<FarmDataQueryResult> {
  const client = getSupabaseClient();
  if (!input.userId || !client) return skippedResult(input.toolCalls, 'log_activity.query');

  let q = client
    .from('fertigation_records')
    .select('id, farm_id, date, fertilizers, water_volume, farms!inner(user_id, name)')
    .eq('farms.user_id', input.userId)
    .order('date', { ascending: false })
    .limit(50);
  if (input.farmId) q = q.eq('farm_id', input.farmId);
  if (input.explicitDate) q = q.eq('date', input.explicitDate);
  const { data, error } = await q;
  if (error) {
    input.toolCalls.push({ tool: 'log_activity.query', status: 'error', error: error.message });
    return SKIPPED;
  }
  const rows = Array.isArray(data) ? data : [];
  input.toolCalls.push({
    tool: 'log_activity.query',
    status: 'ok',
    output: { table: 'fertigation_records', count: rows.length },
  });
  if (rows.length === 0)
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
  const latest = rows[0] as Record<string, unknown>;
  const latestDate = String(latest.date ?? 'unknown');
  return {
    answer:
      input.locale === 'hi'
        ? `नवीनतम फर्टिगेशन: ${JSON.stringify(latest.fertilizers)} ${latestDate} को।`
        : input.locale === 'mr'
          ? `अलीकडील फर्टिगेशन: ${JSON.stringify(latest.fertilizers)} ${latestDate} रोजी.`
          : `Latest fertigation: ${JSON.stringify(latest.fertilizers)} on ${latestDate}.`,
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
