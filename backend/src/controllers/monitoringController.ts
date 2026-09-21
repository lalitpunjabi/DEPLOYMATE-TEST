import { Request, Response } from 'express';

// PROMETHEUS_URL is trusted operator configuration (an env var), not user input.
// We only guard the scheme to prevent obvious misconfiguration (e.g. file://).
// Internal/private Prometheus hosts are intentionally allowed.
function assertHttpUrl(urlString: string): void {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new Error('PROMETHEUS_URL is not a valid URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('PROMETHEUS_URL must use http or https');
  }
}

// Simulated metrics generator for offline showcase setups
function generateSimulatedMetrics() {
  const timestamp = new Date();

  // Base fluctuating stats
  const cpuUsage = 30 + Math.random() * 40; // 30% - 70%
  const memoryUsage = 55 + Math.random() * 15; // 55% - 70%
  const requestCount = Math.floor(100 + Math.random() * 400); // 100 - 500 req/s
  const errorRate = Math.random() < 0.15 ? Math.random() * 5 : Math.random() * 1; // occasional spike up to 5%, average <1%

  return {
    timestamp,
    cpuUsage: parseFloat(cpuUsage.toFixed(2)),
    memoryUsage: parseFloat(memoryUsage.toFixed(2)),
    requestCount,
    errorRate: parseFloat(errorRate.toFixed(2))
  };
}

const PROM_TIMEOUT_MS = 5000;

/**
 * Run a real PromQL instant query against the configured Prometheus server.
 * Throws on any transport/parse/API error so callers can never claim
 * PROMETHEUS_LIVE without a verified successful query (hardening spec §7).
 */
async function promInstantQuery(baseUrl: string, promql: string): Promise<number> {
  assertHttpUrl(baseUrl);
  const res = await fetch(
    `${baseUrl.replace(/\/$/, '')}/api/v1/query?query=${encodeURIComponent(promql)}`,
    { signal: AbortSignal.timeout(PROM_TIMEOUT_MS) }
  );
  if (!res.ok) {
    throw new Error(`Prometheus responded with HTTP ${res.status}`);
  }
  const data = (await res.json()) as {
    status?: string;
    data?: { resultType?: string; result?: Array<{ value?: [number, string] }> };
  };
  if (data.status !== 'success' || !Array.isArray(data.data?.result) || data.data.result.length === 0) {
    throw new Error('Prometheus returned no result for query');
  }
  const raw = data.data.result[0]?.value?.[1];
  const value = parseFloat(String(raw));
  if (!Number.isFinite(value)) {
    throw new Error('Prometheus returned a non-numeric value');
  }
  return value;
}

/**
 * Run a real PromQL range query. Returns samples as [timestampSeconds, value][].
 */
async function promRangeQuery(
  baseUrl: string,
  promql: string
): Promise<Array<[number, number]>> {
  assertHttpUrl(baseUrl);
  const end = Math.floor(Date.now() / 1000);
  const start = end - 3600; // last hour
  const params = new URLSearchParams({
    query: promql,
    start: String(start),
    end: String(end),
    step: '300',
  });
  const res = await fetch(
    `${baseUrl.replace(/\/$/, '')}/api/v1/query_range?${params.toString()}`,
    { signal: AbortSignal.timeout(PROM_TIMEOUT_MS) }
  );
  if (!res.ok) {
    throw new Error(`Prometheus responded with HTTP ${res.status}`);
  }
  const data = (await res.json()) as {
    status?: string;
    data?: { result?: Array<{ values?: Array<[number, string]> }> };
  };
  if (data.status !== 'success' || !Array.isArray(data.data?.result)) {
    throw new Error('Prometheus range query returned no result');
  }
  const values = data.data.result[0]?.values;
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error('Prometheus range query had empty series');
  }
  return values
    .map(([ts, v]) => [ts, parseFloat(v)] as [number, number])
    .filter(([, v]) => Number.isFinite(v));
}

export async function getLiveMetrics(_req: Request, res: Response): Promise<void> {
  const prometheusUrl = process.env.PROMETHEUS_URL;

  if (prometheusUrl) {
    try {
      // Honest LIVE path: only reached after queries actually succeeded.
      const [cpuPct, memPct, reqRate, errRate] = await Promise.all([
        promInstantQuery(
          prometheusUrl,
          '100 * (1 - avg(rate(node_cpu_seconds_total{mode="idle"}[5m])))'
        ),
        promInstantQuery(
          prometheusUrl,
          '100 * (1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)'
        ),
        promInstantQuery(prometheusUrl, 'sum(rate(http_requests_total[5m]))'),
        promInstantQuery(
          prometheusUrl,
          '100 * (sum(rate(http_requests_total{code=~"5.."}[5m])) or vector(0)) / (sum(rate(http_requests_total[5m])) or vector(1))'
        ),
      ]);

      res.status(200).json({
        timestamp: new Date(),
        cpuUsage: parseFloat(cpuPct.toFixed(2)),
        memoryUsage: parseFloat(memPct.toFixed(2)),
        requestCount: parseFloat(reqRate.toFixed(2)),
        errorRate: parseFloat(errRate.toFixed(2)),
        source: 'PROMETHEUS_LIVE',
        execution_mode: 'LIVE',
      });
      return;
    } catch (err) {
      // PROMETHEUS_URL configured but unreachable/failed → honest DEGRADED,
      // never a silent simulator disguised as live data.
      console.warn('[MONITORING] Prometheus query failed, serving DEGRADED simulated metrics:', (err as Error).message);
      const metrics = generateSimulatedMetrics();
      res.status(200).json({
        ...metrics,
        source: 'SIMULATOR_ENGINE',
        execution_mode: 'DEGRADED',
        notice: 'PROMETHEUS_URL is configured but the live query failed. Displayed values are simulated placeholders, not real telemetry.',
      });
      return;
    }
  }

  // No Prometheus configured → clearly-labeled simulator
  const metrics = generateSimulatedMetrics();
  res.status(200).json({
    ...metrics,
    source: 'SIMULATOR_ENGINE',
    execution_mode: 'SIMULATED',
  });
}

export async function getHistoricalMetrics(_req: Request, res: Response): Promise<void> {
  const prometheusUrl = process.env.PROMETHEUS_URL;

  if (prometheusUrl) {
    try {
      const [cpuSeries, memSeries, reqSeries, errSeries] = await Promise.all([
        promRangeQuery(prometheusUrl, '100 * (1 - avg(rate(node_cpu_seconds_total{mode="idle"}[5m])))'),
        promRangeQuery(prometheusUrl, '100 * (1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)'),
        promRangeQuery(prometheusUrl, 'sum(rate(http_requests_total[5m]))'),
        promRangeQuery(
          prometheusUrl,
          '100 * (sum(rate(http_requests_total{code=~"5.."}[5m])) or vector(0)) / (sum(rate(http_requests_total[5m])) or vector(1))'
        ),
      ]);

      const history = cpuSeries.map(([ts, cpu], i) => ({
        time: new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        cpu: parseFloat(Number(cpu).toFixed(1)),
        memory: parseFloat(Number(memSeries[i]?.[1] ?? 0).toFixed(1)),
        requests: Math.round(Number(reqSeries[i]?.[1] ?? 0)),
        errors: parseFloat(Number(errSeries[i]?.[1] ?? 0).toFixed(2)),
      }));

      res.status(200).json(history);
      return;
    } catch (err) {
      console.warn('[MONITORING] Prometheus range query failed, serving DEGRADED simulated history:', (err as Error).message);
      res.setHeader('X-Execution-Mode', 'DEGRADED');
    }
  } else {
    res.setHeader('X-Execution-Mode', 'SIMULATED');
  }

  // Simulated historical points (12 points, 5-min intervals)
  const history = [];
  const now = Date.now();
  for (let i = 11; i >= 0; i--) {
    const time = new Date(now - i * 5 * 60 * 1000); // 5 min intervals
    const timeString = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    history.push({
      time: timeString,
      cpu: parseFloat((25 + Math.random() * 30 + (i === 5 ? 25 : 0)).toFixed(1)), // simulate an artificial spike at index 5
      memory: parseFloat((50 + Math.random() * 10).toFixed(1)),
      requests: Math.floor(150 + Math.random() * 300),
      errors: parseFloat((Math.random() * 2).toFixed(2))
    });
  }
  res.status(200).json(history);
}
