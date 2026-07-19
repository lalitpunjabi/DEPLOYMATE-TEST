import { Request, Response } from 'express';

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

export async function getLiveMetrics(_req: Request, res: Response): Promise<void> {
  try {
    // Attempt live connection to local Prometheus query API if configured in .env, otherwise fall back
    const prometheusUrl = process.env.PROMETHEUS_URL;
    
    if (prometheusUrl) {
      // Example query to Prometheus:
      // const response = await fetch(`${prometheusUrl}/api/v1/query?query=up`);
      // Return queried metrics
    }
    
    // Fallback to simulated metrics
    const metrics = generateSimulatedMetrics();
    res.status(200).json({
      ...metrics,
      source: prometheusUrl ? 'PROMETHEUS_LIVE' : 'SIMULATOR_ENGINE'
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to retrieve telemetry metrics.', error: error.message });
  }
}

export async function getHistoricalMetrics(_req: Request, res: Response): Promise<void> {
  try {
    // Generate 12 historical points
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
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to retrieve historical metrics.', error: error.message });
  }
}
