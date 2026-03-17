/**
 * Circuit Breaker Pattern Implementation
 * Prevents cascading failures when external services are unavailable.
 */

export interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  isOpen: boolean;
}

const FAILURE_THRESHOLD = 5;
const RESET_TIMEOUT_MS = 60000;

// In-memory circuit breaker state (resets on function cold start)
const circuitBreakers = new Map<string, CircuitBreakerState>();

/**
 * Clean up expired circuit breakers to prevent memory bloat
 */
export function cleanExpiredCircuitBreakers(): void {
  const now = Date.now();
  let cleaned = 0;
  for (const [key, state] of circuitBreakers.entries()) {
    if (now - state.lastFailureTime > RESET_TIMEOUT_MS) {
      circuitBreakers.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`[Circuit cleanup] deleted ${cleaned} expired circuit breakers`);
  }
}

/**
 * Check if a provider is available (circuit breaker not open)
 */
export function checkCircuitBreaker(provider: string): boolean {
  const state = circuitBreakers.get(provider);
  if (!state || !state.isOpen) return true;
  if (Date.now() - state.lastFailureTime > RESET_TIMEOUT_MS) {
    state.isOpen = false;
    state.failures = 0;
    circuitBreakers.set(provider, state);
    return true;
  }
  return false;
}

/**
 * Record a failure for a provider (may trip the circuit breaker)
 */
export function recordProviderFailure(provider: string): void {
  const state = circuitBreakers.get(provider) ?? {
    failures: 0,
    lastFailureTime: 0,
    isOpen: false,
  };
  state.failures += 1;
  state.lastFailureTime = Date.now();
  if (state.failures >= FAILURE_THRESHOLD) {
    state.isOpen = true;
    console.error(`Circuit breaker opened for ${provider} after ${state.failures} failures`);
  }
  circuitBreakers.set(provider, state);
}

/**
 * Record a success for a provider (may reset the circuit breaker)
 * CRITICAL: Reset failure count to 0 on success to track CONSECUTIVE failures,
 * not cumulative failures. The circuit breaker should only trip after
 * 5 consecutive failures.
 */
export function recordProviderSuccess(provider: string): void {
  const state = circuitBreakers.get(provider);
  if (!state) return;
  // Reset consecutive failure count to 0 on any success
  state.failures = 0;
  state.isOpen = false;
  circuitBreakers.set(provider, state);
}

/**
 * Get circuit breaker state for debugging
 */
export function getCircuitBreakerState(provider: string): CircuitBreakerState | undefined {
  return circuitBreakers.get(provider);
}

/**
 * Get failure threshold constant
 */
export function getFailureThreshold(): number {
  return FAILURE_THRESHOLD;
}

/**
 * Get reset timeout constant
 */
export function getResetTimeoutMs(): number {
  return RESET_TIMEOUT_MS;
}
