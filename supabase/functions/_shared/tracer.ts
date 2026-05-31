// Structured tracing utility for Brandie edge functions
// Generates run_id per request and logs structured spans for each agent stage

export interface Span {
  agent: string;
  started_at: number;
  ended_at?: number;
  latency_ms?: number;
  input_tokens?: number;
  output_tokens?: number;
  status: "ok" | "error" | "timeout";
  error?: string;
  metadata?: Record<string, unknown>;
}

export class Tracer {
  public readonly runId: string;
  public readonly userId: string;
  public readonly startedAt: number;
  private spans: Span[] = [];
  private metrics: Record<string, unknown> = {};

  constructor(userId: string) {
    this.runId = crypto.randomUUID();
    this.userId = userId;
    this.startedAt = Date.now();
  }

  /** Record a pipeline-level metric (persisted to design_traces.metrics). */
  setMetric(key: string, value: unknown): void {
    this.metrics[key] = value;
  }

  /** Bulk-merge metrics. */
  setMetrics(values: Record<string, unknown>): void {
    Object.assign(this.metrics, values);
  }

  /** Get current metrics snapshot. */
  getMetrics(): Record<string, unknown> {
    return { ...this.metrics };
  }

  /** Start a new span, returns a finish function */
  startSpan(agent: string): SpanHandle {
    const span: Span = {
      agent,
      started_at: Date.now(),
      status: "ok",
    };
    this.spans.push(span);

    return {
      finish: (result?: Partial<Pick<Span, "input_tokens" | "output_tokens" | "status" | "error" | "metadata">>) => {
        span.ended_at = Date.now();
        span.latency_ms = span.ended_at - span.started_at;
        if (result) {
          if (result.input_tokens !== undefined) span.input_tokens = result.input_tokens;
          if (result.output_tokens !== undefined) span.output_tokens = result.output_tokens;
          if (result.status) span.status = result.status;
          if (result.error) span.error = result.error;
          if (result.metadata) span.metadata = result.metadata;
        }
      },
      fail: (error: string) => {
        span.ended_at = Date.now();
        span.latency_ms = span.ended_at - span.started_at;
        span.status = "error";
        span.error = error;
      },
    };
  }

  /** Get total elapsed time */
  get elapsed(): number {
    return Date.now() - this.startedAt;
  }

  /** Get all spans */
  getSpans(): Span[] {
    return this.spans;
  }

  /** Get summary for logging */
  summary(): Record<string, unknown> {
    const totalTokensIn = this.spans.reduce((s, sp) => s + (sp.input_tokens || 0), 0);
    const totalTokensOut = this.spans.reduce((s, sp) => s + (sp.output_tokens || 0), 0);
    const errors = this.spans.filter(s => s.status === "error");

    return {
      run_id: this.runId,
      user_id: this.userId,
      total_latency_ms: this.elapsed,
      span_count: this.spans.length,
      total_input_tokens: totalTokensIn,
      total_output_tokens: totalTokensOut,
      error_count: errors.length,
      spans: this.spans.map(s => ({
        agent: s.agent,
        latency_ms: s.latency_ms,
        status: s.status,
        ...(s.error ? { error: s.error } : {}),
      })),
    };
  }

  /** Log summary to console in structured format */
  log(): void {
    console.log(`[TRACE:${this.runId}]`, JSON.stringify(this.summary()));
  }
}

export interface SpanHandle {
  finish: (result?: Partial<Pick<Span, "input_tokens" | "output_tokens" | "status" | "error" | "metadata">>) => void;
  fail: (error: string) => void;
}
