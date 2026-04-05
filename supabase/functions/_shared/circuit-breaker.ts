// Circuit Breaker pattern for external API dependencies
// Prevents cascading failures by short-circuiting after consecutive errors

interface CircuitState {
  failures: number;
  lastFailureAt: number;
  state: "closed" | "open" | "half-open";
}

// In-memory circuit states (per-isolate, resets on cold start — acceptable for edge functions)
const circuits = new Map<string, CircuitState>();

const DEFAULT_FAILURE_THRESHOLD = 3;
const DEFAULT_RECOVERY_TIMEOUT_MS = 60_000; // 1 minute

/**
 * Check if a circuit is currently open (should NOT call the service).
 */
export function isCircuitOpen(
  serviceKey: string,
  failureThreshold = DEFAULT_FAILURE_THRESHOLD,
  recoveryTimeoutMs = DEFAULT_RECOVERY_TIMEOUT_MS,
): boolean {
  const circuit = circuits.get(serviceKey);
  if (!circuit) return false;

  if (circuit.state === "open") {
    // Check if recovery timeout has passed → transition to half-open
    if (Date.now() - circuit.lastFailureAt > recoveryTimeoutMs) {
      circuit.state = "half-open";
      return false; // Allow one probe request
    }
    return true; // Still open
  }

  return false;
}

/**
 * Record a successful call — resets the circuit.
 */
export function recordSuccess(serviceKey: string): void {
  circuits.set(serviceKey, { failures: 0, lastFailureAt: 0, state: "closed" });
}

/**
 * Record a failed call — increments failure counter, may open circuit.
 */
export function recordFailure(
  serviceKey: string,
  failureThreshold = DEFAULT_FAILURE_THRESHOLD,
): void {
  const circuit = circuits.get(serviceKey) || { failures: 0, lastFailureAt: 0, state: "closed" as const };
  circuit.failures += 1;
  circuit.lastFailureAt = Date.now();

  if (circuit.failures >= failureThreshold) {
    circuit.state = "open";
    console.warn(`[CircuitBreaker] Circuit OPENED for "${serviceKey}" after ${circuit.failures} failures`);
  }

  circuits.set(serviceKey, circuit);
}

/**
 * Get current circuit state for monitoring.
 */
export function getCircuitState(serviceKey: string): CircuitState | null {
  return circuits.get(serviceKey) || null;
}
