import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Cpu, 
  Layers, 
  Percent, 
  ArrowUpRight, 
  ArrowDownRight, 
  Loader2, 
  RefreshCw,
  Zap,
  Radio
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';

interface HistoricalMetric {
  time: string;
  cpu: number;
  memory: number;
  requests: number;
  errors: number;
}

interface LiveMetric {
  timestamp: string;
  cpuUsage: number;
  memoryUsage: number;
  requestCount: number;
  errorRate: number;
  source: string;
}

export const Monitoring: React.FC = () => {
  const { token } = useAuth();
  
  const [history, setHistory] = useState<HistoricalMetric[]>([]);
  const [live, setLive] = useState<LiveMetric | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLiveActive, setIsLiveActive] = useState(true);

  // Fallback Historical Mock Data
  const mockHistory = [
    { time: '14:00', cpu: 32, memory: 58, requests: 120, errors: 0.1 },
    { time: '14:05', cpu: 45, memory: 60, requests: 180, errors: 0.2 },
    { time: '14:10', cpu: 38, memory: 59, requests: 150, errors: 0.15 },
    { time: '14:15', cpu: 52, memory: 63, requests: 240, errors: 0.4 },
    { time: '14:20', cpu: 88, memory: 72, requests: 490, errors: 1.8 }, // Spike
    { time: '14:25', cpu: 60, memory: 68, requests: 310, errors: 0.6 },
    { time: '14:30', cpu: 42, memory: 61, requests: 210, errors: 0.2 },
  ];

  const fetchHistory = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/v1/monitoring/history', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setHistory(await res.json());
      } else {
        setHistory(mockHistory);
      }
    } catch {
      setHistory(mockHistory);
    }
  };

  const fetchLive = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/v1/monitoring/live', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setLive(await res.json());
      }
    } catch {
      // Simulate live fluctuation locally if backend down
      setLive({
        timestamp: new Date().toISOString(),
        cpuUsage: parseFloat((35 + Math.random() * 20).toFixed(1)),
        memoryUsage: parseFloat((62 + Math.random() * 5).toFixed(1)),
        requestCount: Math.floor(180 + Math.random() * 80),
        errorRate: parseFloat((Math.random() * 0.8).toFixed(2)),
        source: 'LOCAL_SIMULATOR'
      });
    }
  };

  // Initial load
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await Promise.all([fetchHistory(), fetchLive()]);
      setIsLoading(false);
    };
    init();
  }, [token]);

  // Polling loop for live telemetry stats
  useEffect(() => {
    if (!isLiveActive) return;
    const interval = setInterval(() => {
      fetchLive();
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
  }, [isLiveActive, token]);

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const liveCpu = live?.cpuUsage || 0;
  const liveMemory = live?.memoryUsage || 0;
  const liveRequests = live?.requestCount || 0;
  const liveErrors = live?.errorRate || 0;

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text">Cluster Telemetry Metrics</h1>
          <p className="text-sm text-muted">Real-time CPU, Memory, Traffic Rates, and Error logs telemetry.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsLiveActive(!isLiveActive)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold border transition-all ${
              isLiveActive
                ? 'bg-success/15 border-success/30 text-success glow-active'
                : 'bg-slate-800 border-border text-muted'
            }`}
          >
            <Radio className="h-4 w-4" />
            {isLiveActive ? 'Live Polling Active' : 'Polling Suspended'}
          </button>
          <button
            onClick={() => {
              fetchHistory();
              fetchLive();
            }}
            className="rounded-lg border border-border p-2 hover:bg-slate-800 text-muted hover:text-text transition-colors"
          >
            <RefreshCw className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>

      {/* Live Metric Widgets */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* CPU */}
        <div className="glass-panel p-5 bg-panel/30">
          <div className="flex items-center justify-between text-muted text-xs font-semibold uppercase tracking-wider">
            <span>CPU Utilization</span>
            <Cpu className="h-5 w-5 text-primary" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-text">{liveCpu}%</span>
            <span className="text-xs text-success flex items-center font-mono">
              <ArrowDownRight className="h-3 w-3" /> normal
            </span>
          </div>
          <div className="w-full bg-slate-900 rounded-full h-1.5 mt-4 overflow-hidden border border-white/[0.03]">
            <div className="bg-primary h-1.5 rounded-full transition-all duration-1000" style={{ width: `${liveCpu}%` }} />
          </div>
        </div>

        {/* Memory */}
        <div className="glass-panel p-5 bg-panel/30">
          <div className="flex items-center justify-between text-muted text-xs font-semibold uppercase tracking-wider">
            <span>Memory Consumption</span>
            <Layers className="h-5 w-5 text-secondary" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-text">{liveMemory}%</span>
            <span className="text-xs text-success flex items-center font-mono">
              <ArrowDownRight className="h-3 w-3" /> stable
            </span>
          </div>
          <div className="w-full bg-slate-900 rounded-full h-1.5 mt-4 overflow-hidden border border-white/[0.03]">
            <div className="bg-secondary h-1.5 rounded-full transition-all duration-1000" style={{ width: `${liveMemory}%` }} />
          </div>
        </div>

        {/* Request Rates */}
        <div className="glass-panel p-5 bg-panel/30">
          <div className="flex items-center justify-between text-muted text-xs font-semibold uppercase tracking-wider">
            <span>Request Ingestion</span>
            <Zap className="h-5 w-5 text-warning animate-pulse" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-text">{liveRequests} <span className="text-xs font-normal text-muted">req/s</span></span>
            <span className="text-xs text-success flex items-center font-mono">
              <ArrowUpRight className="h-3 w-3" /> active
            </span>
          </div>
          <div className="w-full bg-slate-900 rounded-full h-1.5 mt-4 overflow-hidden border border-white/[0.03]">
            <div className="bg-warning h-1.5 rounded-full transition-all duration-1000" style={{ width: `${Math.min(liveRequests / 5, 100)}%` }} />
          </div>
        </div>

        {/* Error Rates */}
        <div className="glass-panel p-5 bg-panel/30">
          <div className="flex items-center justify-between text-muted text-xs font-semibold uppercase tracking-wider">
            <span>Error Frequency</span>
            <Percent className="h-5 w-5 text-danger" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-text">{liveErrors}%</span>
            <span className="text-xs text-success flex items-center font-mono">
              <ArrowDownRight className="h-3 w-3" /> normal
            </span>
          </div>
          <div className="w-full bg-slate-900 rounded-full h-1.5 mt-4 overflow-hidden border border-white/[0.03]">
            <div className="bg-danger h-1.5 rounded-full transition-all duration-1000" style={{ width: `${Math.min(liveErrors * 10, 100)}%` }} />
          </div>
        </div>
      </div>

      {/* Graphs Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* CPU & Memory Line Chart */}
        <div className="glass-panel p-6 bg-panel/20">
          <div className="mb-6">
            <h3 className="text-base font-semibold text-text">Cluster Resources Telemetry</h3>
            <p className="text-xs text-muted">CPU vs Memory footprint utilization trends (5-minute history).</p>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="time" stroke="#64748B" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748B" fontSize={11} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#131A2C', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}
                  labelStyle={{ color: '#94A3B8', fontSize: '11px' }}
                  itemStyle={{ fontSize: '12px' }}
                />
                <Line type="monotone" dataKey="cpu" name="CPU Usage %" stroke="#6366F1" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="memory" name="Memory Usage %" stroke="#06B6D4" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Requests & Errors Bar Chart */}
        <div className="glass-panel p-6 bg-panel/20">
          <div className="mb-6">
            <h3 className="text-base font-semibold text-text">Network Ingress Load</h3>
            <p className="text-xs text-muted">HTTP Ingress traffic request counts vs error percentages.</p>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRequestsPlot" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#F59E0B" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="time" stroke="#64748B" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748B" fontSize={11} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#131A2C', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}
                  labelStyle={{ color: '#94A3B8', fontSize: '11px' }}
                  itemStyle={{ fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="requests" name="Ingress Req/s" stroke="#F59E0B" strokeWidth={2} fillOpacity={1} fill="url(#colorRequestsPlot)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
