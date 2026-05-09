const bootTraceStartedAt = Date.now();

export function logBootTrace(event: string, data?: Record<string, unknown>) {
  if (!__DEV__) return;

  const elapsedMs = Date.now() - bootTraceStartedAt;
  console.log(`[Boot +${elapsedMs}ms] ${event}`, data ?? {});
}
