/**
 * Farm Details Module
 * Types, Supabase client, activity detection utilities, date parsing,
 * and farm ownership lookup functions.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';
import { safeNumber, toOptionalNumber, toOptionalString } from '../utils/index.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')?.trim() ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() ?? '';

// Lazy-initialized Supabase client (singleton)
let _supabaseClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
  if (!_supabaseClient && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    _supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _supabaseClient;
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
  if (/\birrigat|\bwater|सिंचाई|सिंचन|पाणी|ठिबक/i.test(text)) return 'irrigation';
  if (/\bspray|chemical|pesticide|स्प्रे|फवारणी|छिड़काव/i.test(text)) return 'spray';
  if (/\bfertigat|fertiliz|खत|उर्वरक|फर्टिगेशन/i.test(text)) return 'fertigation';
  if (/\bexpense|cost|spend|खर्च|लागत/i.test(text)) return 'expense';
  if (/\bharvest|yield|pick|कटनी|उत्पादन/i.test(text)) return 'harvest';
  if (/\bwarehouse|inventory|stock|godown|गोदाम|स्टॉक|इन्व्हेंटरी/i.test(text)) return 'warehouse';
  if (/\bworker|attendance|मजुर|कामगार|हजेरी|worker_attendance/i.test(text)) return 'workers';
  if (/\btask|reminder|काम|टास्क|reminder|remember/i.test(text)) return 'tasks';
  if (/\bsoil[\s_-]?test|मृदा|माती|चाचणी/i.test(text)) return 'soil_test';
  if (/\bpetiole|पेटियोल|देठ|पान/i.test(text)) return 'petiole_test';
  if (/\bdaily[\s_-]?note|नोंद|note|diary|दैनिक/i.test(text)) return 'daily_notes';
  if (/\bweather|हवामान|मौसम|पाऊस|बारिश/i.test(text)) return 'weather';
  return null;
}

export function isLikelyHistoryIntent(text: string): boolean {
  return (
    /\b(total|how much|how many|last|latest|history|record|show|list|what|when)\b/i.test(text) ||
    /कितना|कितने|किती|इतिहास|एकूण|कुल|शेवट|दाखवा|यादी/i.test(text)
  );
}

// ============================================================
// MARK: - Date Parsing
// ============================================================

function formatIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Parse explicit date from transcript.
 * Supports YYYY-MM-DD, "today"/"aaj"/"आज", "yesterday"/"kal"/"काल".
 */
export function parseExplicitDate(text: string): string | null {
  const directIso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (directIso?.[1]) return directIso[1];

  const lower = text.toLowerCase();
  const now = new Date();

  if (/\btoday\b|\baaj\b/.test(lower) || /आज/.test(text)) return formatIsoDate(now);

  if (/\byesterday\b|\bkal\b/.test(lower) || /काल/.test(text)) {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    return formatIsoDate(yesterday);
  }

  return null;
}

// ============================================================
// MARK: - Farm Lookup
// ============================================================

/**
 * Fetch all farms belonging to a user (for routing)
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

  return (Array.isArray(data) ? data : [])
    .map((row) => {
      const id = toOptionalNumber((row as Record<string, unknown>).id);
      const name = toOptionalString((row as Record<string, unknown>).name);
      if (id === null || !name) return null;
      return { id, name };
    })
    .filter((row): row is { id: number; name: string } => Boolean(row));
}

/**
 * Fetch farm details including coordinates.
 * SECURITY: Validates farm ownership by requiring userId.
 * Returns null if the farm does not exist or belongs to a different user.
 * Callers must NOT fall back to hardcoded coordinates when null is returned.
 */
export async function fetchFarmDetails(
  farmId: number | null,
  userId: string | null,
): Promise<{ latitude: number | null; longitude: number | null; name: string } | null> {
  const client = getSupabaseClient();
  if (!farmId || !userId || !client) return null;

  const { data, error } = await client
    .from('farms')
    .select('id, name, latitude, longitude')
    .eq('id', farmId)
    .eq('user_id', userId) // SECURITY: always verify ownership
    .single();

  if (error || !data) return null;

  const row = data as Record<string, unknown>;
  return {
    name: String(row.name ?? 'Farm'),
    latitude: toOptionalNumber(row.latitude),
    longitude: toOptionalNumber(row.longitude),
  };
}

// Re-export safeNumber for use in other farm sub-modules
export { safeNumber };
