/**
 * Telemetry Tracking Utilities
 * Tracks events to the telemetry_events table for monitoring and analytics.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')?.trim() ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() ?? '';

export interface TelemetryEvent {
  event_name: string;
  user_id: string | null;
  farm_id: number | null;
  trace_id: string;
  properties: Record<string, unknown>;
  timestamp: string;
}

// Lazy-initialized Supabase client for telemetry
let telemetryClient: ReturnType<typeof createClient> | null = null;

function getTelemetryClient() {
  if (!telemetryClient && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    telemetryClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return telemetryClient;
}

/**
 * Track a telemetry event to the database
 */
export async function trackTelemetry(event: TelemetryEvent): Promise<void> {
  const client = getTelemetryClient();
  if (!client) {
    console.warn('Telemetry client not initialized, skipping event', event.event_name);
    return;
  }

  try {
    await client.from('telemetry_events').insert(event);
  } catch (error) {
    console.warn('Telemetry tracking failed', error);
  }
}

/**
 * Generate a unique trace ID for request tracking
 */
export function generateTraceId(): string {
  return crypto.randomUUID();
}

/**
 * Create a telemetry event with common fields
 */
export function createTelemetryEvent(
  eventName: string,
  userId: string | null,
  farmId: number | null,
  traceId: string,
  properties: Record<string, unknown>,
): TelemetryEvent {
  return {
    event_name: eventName,
    user_id: userId,
    farm_id: farmId,
    trace_id: traceId,
    properties,
    timestamp: new Date().toISOString(),
  };
}
