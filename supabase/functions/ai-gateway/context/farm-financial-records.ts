/**
 * Farm Financial Records Module
 * Expense and harvest record queries.
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

export async function queryExpenseRecords(input: {
  userId: string | null;
  farmId: number | null;
  explicitDate: string | null;
  isTotalQuery: boolean;
  locale: 'en' | 'hi' | 'mr';
  toolCalls: ToolCall[];
}): Promise<FarmDataQueryResult> {
  const client = getSupabaseClient();
  if (!input.userId || !client) return skippedResult(input.toolCalls, 'log_activity.query');

  const table = 'expense_records';
  const pageSize = 500;
  let totalCost = 0;
  let totalRows = 0;

  if (input.isTotalQuery) {
    for (let start = 0; ; start += pageSize) {
      let pq = client
        .from(table)
        .select('id, cost, farms!inner(user_id)')
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
      for (const row of rows) totalCost += safeNumber((row as Record<string, unknown>).cost);
      if (rows.length < pageSize) break;
    }
    input.toolCalls.push({
      tool: 'log_activity.query',
      status: 'ok',
      output: { table, count: totalRows },
    });
    if (totalRows === 0)
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

  let q = client
    .from(table)
    .select('id, farm_id, date, cost, type, farms!inner(user_id, name)')
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
          ? 'कोई खर्च रिकॉर्ड नहीं मिला।'
          : input.locale === 'mr'
            ? 'कोणतीही खर्च नोंद आढळली नाही.'
            : 'No expense records found.',
      citations: [],
      records: [],
      totalCount: 0,
    };
  const latest = rows[0] as Record<string, unknown>;
  return {
    answer:
      input.locale === 'hi'
        ? `नवीनतम खर्च: ₹${safeNumber(latest.cost).toFixed(2)} (${String(latest.type ?? 'other')}) ${String(latest.date ?? 'unknown')} को।`
        : input.locale === 'mr'
          ? `अलीकडील खर्च: ₹${safeNumber(latest.cost).toFixed(2)} (${String(latest.type ?? 'other')}) ${String(latest.date ?? 'unknown')} रोजी.`
          : `Latest expense: ₹${safeNumber(latest.cost).toFixed(2)} (${String(latest.type ?? 'other')}) on ${String(latest.date ?? 'unknown')}.`,
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

export async function queryHarvestRecords(input: {
  userId: string | null;
  farmId: number | null;
  explicitDate: string | null;
  isTotalQuery: boolean;
  locale: 'en' | 'hi' | 'mr';
  toolCalls: ToolCall[];
}): Promise<FarmDataQueryResult> {
  const client = getSupabaseClient();
  if (!input.userId || !client) return skippedResult(input.toolCalls, 'log_activity.query');

  const table = 'harvest_records';
  const pageSize = 500;
  let totalQuantity = 0;
  let totalRows = 0;

  if (input.isTotalQuery) {
    for (let start = 0; ; start += pageSize) {
      let pq = client
        .from(table)
        .select('id, quantity, farms!inner(user_id)')
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
        totalQuantity += safeNumber((row as Record<string, unknown>).quantity);
      if (rows.length < pageSize) break;
    }
    input.toolCalls.push({
      tool: 'log_activity.query',
      status: 'ok',
      output: { table, count: totalRows },
    });
    if (totalRows === 0)
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

  let q = client
    .from(table)
    .select('id, farm_id, date, quantity, grade, price, farms!inner(user_id, name)')
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
          ? 'कोई कटनी रिकॉर्ड नहीं मिला।'
          : input.locale === 'mr'
            ? 'कोणतीही कापणी नोंद आढळली नाही.'
            : 'No harvest records found.',
      citations: [],
      records: [],
      totalCount: 0,
    };
  const latest = rows[0] as Record<string, unknown>;
  return {
    answer:
      input.locale === 'hi'
        ? `नवीनतम कटनी: ${safeNumber(latest.quantity)} क्विंटल (${String(latest.grade ?? 'N/A')} ग्रेड) ${String(latest.date ?? 'unknown')} को।`
        : input.locale === 'mr'
          ? `अलीकडील कापणी: ${safeNumber(latest.quantity)} क्विंटल (${String(latest.grade ?? 'N/A')} ग्रेड) ${String(latest.date ?? 'unknown')} रोजी.`
          : `Latest harvest: ${safeNumber(latest.quantity)} quintals (${String(latest.grade ?? 'N/A')} grade) on ${String(latest.date ?? 'unknown')}.`,
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
