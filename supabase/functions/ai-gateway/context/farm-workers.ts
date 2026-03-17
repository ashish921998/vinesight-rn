/**
 * Farm Workers Module
 * Worker and attendance queries — always tenant-scoped to the authenticated user.
 */

import {
  getSupabaseClient,
  type Citation,
  type FarmDataQueryResult,
  type FarmRecordRow,
  type ToolCall,
} from './farm-details.ts';

/**
 * Query workers and attendance.
 * SECURITY: Attendance rows are ALWAYS filtered by the user's own worker IDs
 * (joined through the workers table) to prevent cross-tenant data leakage
 * even when farmId is not provided.
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

  // Fetch this user's workers first (used both for listing and for attendance scoping)
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

  // If a specific date is requested, fetch attendance — ALWAYS scoped to this user's worker IDs.
  let attendanceRows: Array<Record<string, unknown>> = [];
  if (input.explicitDate && workers.length > 0) {
    const userWorkerIds = workers
      .map((w) => (w as Record<string, unknown>).id)
      .filter((id): id is string | number => id !== null && id !== undefined);

    let attendanceQuery = client
      .from('worker_attendance')
      .select('id, worker_id, date, work_status, work_type, workers(name)')
      .eq('date', input.explicitDate)
      .in('worker_id', userWorkerIds); // SECURITY: tenant-scope to user's worker IDs

    if (input.farmId) attendanceQuery = attendanceQuery.contains('farm_ids', [input.farmId]);

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
      ] as Citation[],
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
    ] as Citation[],
    records: workers as FarmRecordRow[],
    totalCount: workers.length,
  };
}
