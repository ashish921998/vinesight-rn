/**
 * Farm Extra Records Module
 * Queries for: warehouse, tasks, soil tests, petiole tests, daily notes.
 */

import {
  getSupabaseClient,
  safeNumber,
  type Citation,
  type FarmDataQueryResult,
  type FarmRecordRow,
  type ToolCall,
} from './farm-details.ts';

const SKIPPED = { answer: null, citations: [], records: [], totalCount: 0 } as FarmDataQueryResult;

function skippedResult(toolCalls: ToolCall[], tool: string): FarmDataQueryResult {
  toolCalls.push({ tool, status: 'skipped', output: { reason: 'missing_user_or_client' } });
  return SKIPPED;
}

export async function queryWarehouseItems(input: {
  userId: string | null;
  locale: 'en' | 'hi' | 'mr';
  toolCalls: ToolCall[];
}): Promise<FarmDataQueryResult> {
  const client = getSupabaseClient();
  if (!input.userId || !client) return skippedResult(input.toolCalls, 'warehouse.query');

  const { data, error } = await client
    .from('warehouse_items')
    .select('id, name, type, quantity, unit, unit_price')
    .eq('user_id', input.userId)
    .order('name', { ascending: true })
    .limit(100);

  if (error) {
    input.toolCalls.push({ tool: 'warehouse.query', status: 'error', error: error.message });
    return SKIPPED;
  }

  const rows = Array.isArray(data) ? data : [];
  input.toolCalls.push({ tool: 'warehouse.query', status: 'ok', output: { count: rows.length } });

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
    ] as Citation[],
    records: rows as FarmRecordRow[],
    totalCount: rows.length,
  };
}

export async function queryTaskReminders(input: {
  userId: string | null;
  farmId: number | null;
  locale: 'en' | 'hi' | 'mr';
  toolCalls: ToolCall[];
}): Promise<FarmDataQueryResult> {
  const client = getSupabaseClient();
  if (!input.userId || !client) return skippedResult(input.toolCalls, 'tasks.query');

  let q = client
    .from('task_reminders')
    .select('id, farm_id, title, type, status, priority, due_date, farms!inner(user_id)')
    .eq('farms.user_id', input.userId)
    .eq('status', 'pending')
    .order('due_date', { ascending: true })
    .limit(20);

  if (input.farmId) q = q.eq('farm_id', input.farmId);

  const { data, error } = await q;
  if (error) {
    input.toolCalls.push({ tool: 'tasks.query', status: 'error', error: error.message });
    return SKIPPED;
  }
  const rows = Array.isArray(data) ? data : [];
  input.toolCalls.push({ tool: 'tasks.query', status: 'ok', output: { count: rows.length } });

  if (rows.length === 0)
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

  const highPriority = rows.filter((r) => r.priority === 'high').length;
  const today = new Date().toISOString().split('T')[0];
  const dueToday = rows.filter((r) => r.due_date === today).length;

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
    ] as Citation[],
    records: rows as FarmRecordRow[],
    totalCount: rows.length,
  };
}

export async function querySoilTestRecords(input: {
  userId: string | null;
  farmId: number | null;
  locale: 'en' | 'hi' | 'mr';
  toolCalls: ToolCall[];
}): Promise<FarmDataQueryResult> {
  const client = getSupabaseClient();
  if (!input.userId || !client) return skippedResult(input.toolCalls, 'soil_test.query');

  let q = client
    .from('soil_test_records')
    .select('id, farm_id, date, parameters, recommendations, farms!inner(user_id, name)')
    .eq('farms.user_id', input.userId)
    .order('date', { ascending: false })
    .limit(10);
  if (input.farmId) q = q.eq('farm_id', input.farmId);
  const { data, error } = await q;
  if (error) {
    input.toolCalls.push({ tool: 'soil_test.query', status: 'error', error: error.message });
    return SKIPPED;
  }
  const rows = Array.isArray(data) ? data : [];
  input.toolCalls.push({ tool: 'soil_test.query', status: 'ok', output: { count: rows.length } });

  if (rows.length === 0)
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

  const latest = rows[0] as Record<string, unknown>;
  const params = latest.parameters as Record<string, unknown> | null;
  const ph = params?.pH ?? params?.['pH'] ?? 'N/A';
  const latestDate = String(latest.date ?? 'unknown');

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
    ] as Citation[],
    records: rows as FarmRecordRow[],
    totalCount: rows.length,
  };
}

export async function queryPetioleTestRecords(input: {
  userId: string | null;
  farmId: number | null;
  locale: 'en' | 'hi' | 'mr';
  toolCalls: ToolCall[];
}): Promise<FarmDataQueryResult> {
  const client = getSupabaseClient();
  if (!input.userId || !client) return skippedResult(input.toolCalls, 'petiole_test.query');

  let q = client
    .from('petiole_test_records')
    .select('id, farm_id, date, parameters, recommendations, farms!inner(user_id, name)')
    .eq('farms.user_id', input.userId)
    .order('date', { ascending: false })
    .limit(10);
  if (input.farmId) q = q.eq('farm_id', input.farmId);
  const { data, error } = await q;
  if (error) {
    input.toolCalls.push({ tool: 'petiole_test.query', status: 'error', error: error.message });
    return SKIPPED;
  }
  const rows = Array.isArray(data) ? data : [];
  input.toolCalls.push({
    tool: 'petiole_test.query',
    status: 'ok',
    output: { count: rows.length },
  });

  if (rows.length === 0)
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
    ] as Citation[],
    records: rows as FarmRecordRow[],
    totalCount: rows.length,
  };
}

export async function queryDailyNotes(input: {
  userId: string | null;
  farmId: number | null;
  explicitDate: string | null;
  locale: 'en' | 'hi' | 'mr';
  toolCalls: ToolCall[];
}): Promise<FarmDataQueryResult> {
  const client = getSupabaseClient();
  if (!input.userId || !client) return skippedResult(input.toolCalls, 'daily_notes.query');

  let q = client
    .from('daily_notes')
    .select('id, farm_id, date, notes, farms!inner(user_id, name)')
    .eq('farms.user_id', input.userId)
    .order('date', { ascending: false })
    .limit(30);
  if (input.farmId) q = q.eq('farm_id', input.farmId);
  if (input.explicitDate) q = q.eq('date', input.explicitDate);
  const { data, error } = await q;
  if (error) {
    input.toolCalls.push({ tool: 'daily_notes.query', status: 'error', error: error.message });
    return SKIPPED;
  }
  const rows = Array.isArray(data) ? data : [];
  input.toolCalls.push({ tool: 'daily_notes.query', status: 'ok', output: { count: rows.length } });

  if (rows.length === 0)
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
    ] as Citation[],
    records: rows as FarmRecordRow[],
    totalCount: rows.length,
  };
}
