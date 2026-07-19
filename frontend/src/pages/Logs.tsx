import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Terminal as TerminalIcon, 
  Search, 
  Cpu, 
  Loader2, 
  RefreshCw, 
  SlidersHorizontal,
  Info,
  AlertTriangle,
  XOctagon,
  Download,
  Copy,
  Check,
  Code2
} from 'lucide-react';

interface LogLine {
  timestamp: string;
  level: string;
  pod: string;
  message: string;
}

export const Logs: React.FC = () => {
  const { token } = useAuth();
  
  // States
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [selectedPod, setSelectedPod] = useState<string>('');
  const [selectedLevel, setSelectedLevel] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  
  // LogQL query state
  const [logqlQuery, setLogqlQuery] = useState<string>('{app="*"}');
  const [isCopied, setIsCopied] = useState(false);
  const [isCopiedLogs, setIsCopiedLogs] = useState(false);

  // Available mock pods list
  const podsList = [
    { value: '', label: 'All Container Pods' },
    { value: 'deploymate-api-5d7f8c9b-abc12', label: 'deploymate-api-abc12' },
    { value: 'deploymate-api-5d7f8c9b-def34', label: 'deploymate-api-def34' },
    { value: 'deploymate-ui-6b9f4d7a-xyz99', label: 'deploymate-ui-xyz99' },
    { value: 'fastapi-copilot-7c8f9b1c-7721a', label: 'fastapi-copilot-7721a' }
  ];

  const levelsList = [
    { value: '', label: 'All Log Levels' },
    { value: 'INFO', label: 'INFO' },
    { value: 'WARN', label: 'WARN' },
    { value: 'ERROR', label: 'ERROR' }
  ];

  // Auto-generate LogQL Query based on filters
  useEffect(() => {
    let query = '{';
    const elements = [];
    if (selectedPod) {
      elements.push(`pod="${selectedPod.replace('deploymate-', '')}"`);
    } else {
      elements.push('app="*"');
    }
    if (selectedLevel) {
      elements.push(`level="${selectedLevel}"`);
    }
    query += elements.join(', ');
    query += '}';
    
    if (searchQuery) {
      query += ` |= "${searchQuery}"`;
    }
    setLogqlQuery(query);
  }, [selectedPod, selectedLevel, searchQuery]);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const urlParams = new URLSearchParams();
      if (selectedPod) urlParams.append('pod', selectedPod);
      if (selectedLevel) urlParams.append('level', selectedLevel);
      if (searchQuery) urlParams.append('query', searchQuery);

      const res = await fetch(`http://localhost:5000/api/v1/logs?${urlParams.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        setLogs(await res.json());
      } else {
        throw new Error();
      }
    } catch {
      // Offline fallback mock logs
      const mockLogs: LogLine[] = [
        { timestamp: new Date(Date.now() - 60000 * 30).toISOString(), level: 'INFO', pod: 'deploymate-api-5d7f8c9b-abc12', message: 'Starting DEPLOYMATE Server on port 5000' },
        { timestamp: new Date(Date.now() - 60000 * 29).toISOString(), level: 'INFO', pod: 'deploymate-api-5d7f8c9b-abc12', message: 'Kubernetes Client successfully connected to Local cluster context on namespace [default]' },
        { timestamp: new Date(Date.now() - 60000 * 28).toISOString(), level: 'INFO', pod: 'deploymate-api-5d7f8c9b-abc12', message: 'PostgreSQL connection pool established to postgresql://localhost:5432/deploymate' },
        { timestamp: new Date(Date.now() - 60000 * 25).toISOString(), level: 'INFO', pod: 'deploymate-ui-6b9f4d7a-xyz99', message: 'Vite Development Server listening on port 5173' },
        { timestamp: new Date(Date.now() - 60000 * 20).toISOString(), level: 'INFO', pod: 'deploymate-api-5d7f8c9b-def34', message: 'Ingress routing rules applied to namespace [deploymate-staging]' },
        { timestamp: new Date(Date.now() - 60000 * 18).toISOString(), level: 'WARN', pod: 'deploymate-api-5d7f8c9b-abc12', message: 'SMTP credentials missing in environment context. Email alerts running in simulation log mode.' },
        { timestamp: new Date(Date.now() - 60000 * 15).toISOString(), level: 'INFO', pod: 'deploymate-api-5d7f8c9b-abc12', message: 'Incoming manual webhook trigger received for project [payment-gateway] branch [main]' },
        { timestamp: new Date(Date.now() - 60000 * 14).toISOString(), level: 'INFO', pod: 'deploymate-api-5d7f8c9b-abc12', message: 'GET /api/v1/projects 200 OK - 42.1ms' },
        { timestamp: new Date(Date.now() - 60000 * 12).toISOString(), level: 'INFO', pod: 'fastapi-copilot-7c8f9b1c-7721a', message: 'FastAPI server started successfully on port 8000' },
        { timestamp: new Date(Date.now() - 60000 * 11).toISOString(), level: 'INFO', pod: 'fastapi-copilot-7c8f9b1c-7721a', message: 'Google Gemini Pro SDK API connector authenticated successfully.' },
        { timestamp: new Date(Date.now() - 60000 * 10).toISOString(), level: 'ERROR', pod: 'deploymate-api-5d7f8c9b-def34', message: 'Authentication failure: JWT verification signature mismatch for user: dev@deploymate.com' },
        { timestamp: new Date(Date.now() - 60000 * 8).toISOString(), level: 'INFO', pod: 'deploymate-api-5d7f8c9b-abc12', message: 'POST /api/v1/auth/login 200 OK - 89.4ms' },
        { timestamp: new Date(Date.now() - 60000 * 5).toISOString(), level: 'WARN', pod: 'fastapi-copilot-7c8f9b1c-7721a', message: 'Gemini request throttle: approaching rate-limit (92/100 requests per min)' },
        { timestamp: new Date(Date.now() - 60000 * 2).toISOString(), level: 'INFO', pod: 'deploymate-api-5d7f8c9b-abc12', message: 'POST /api/v1/kubernetes/rollback 200 OK - 124.5ms' },
        { timestamp: new Date(Date.now() - 60000 * 1).toISOString(), level: 'ERROR', pod: 'deploymate-api-5d7f8c9b-def34', message: 'Failed to resolve DNS query for ECR registry endpoint [deploymate-registry.amazonaws.com] - status code: 503 Service Unavailable' }
      ];

      let filtered = [...mockLogs];
      if (selectedPod) filtered = filtered.filter(l => l.pod === selectedPod);
      if (selectedLevel) filtered = filtered.filter(l => l.level === selectedLevel);
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(l => l.message.toLowerCase().includes(q));
      }
      setLogs(filtered);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [selectedPod, selectedLevel, searchQuery, token]);

  const getLogLevelIcon = (level: string) => {
    if (level === 'ERROR') return <XOctagon className="h-3.5 w-3.5 text-danger shrink-0" />;
    if (level === 'WARN') return <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />;
    return <Info className="h-3.5 w-3.5 text-success shrink-0" />;
  };

  const getLogLevelClass = (level: string) => {
    if (level === 'ERROR') return 'text-danger bg-danger/10 border-danger/20';
    if (level === 'WARN') return 'text-warning bg-warning/10 border-warning/20';
    return 'text-success bg-success/10 border-success/20';
  };

  // Colorize Log message for advanced terminal output
  const colorizeLogMessage = (msg: string) => {
    // Regex matches
    const parts = msg.split(/(\b(?:GET|POST|PUT|DELETE|SELECT|INSERT|UPDATE)\b|\b\d{3}\b|\b\d+(?:\.\d+)?ms\b|\[[^\]]+\]|\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b)/g);
    
    return parts.map((part, index) => {
      // HTTP methods
      if (/^(?:GET|POST|PUT|DELETE)$/.test(part)) {
        return <span key={index} className="text-amber-400 font-bold">{part}</span>;
      }
      // SQL statements
      if (/^(?:SELECT|INSERT|UPDATE)$/.test(part)) {
        return <span key={index} className="text-violet-400 font-bold">{part}</span>;
      }
      // Status Codes
      if (/^\d{3}$/.test(part)) {
        const code = parseInt(part);
        if (code >= 200 && code < 300) return <span key={index} className="px-1 py-0.5 text-[10px] font-bold rounded bg-success/20 text-success border border-success/30">{part}</span>;
        if (code >= 300 && code < 400) return <span key={index} className="px-1 py-0.5 text-[10px] font-bold rounded bg-warning/20 text-warning border border-warning/30">{part}</span>;
        return <span key={index} className="px-1 py-0.5 text-[10px] font-bold rounded bg-danger/20 text-danger border border-danger/30">{part}</span>;
      }
      // Timestamps/Metrics latency
      if (/^\d+(?:\.\d+)?ms$/.test(part)) {
        return <span key={index} className="text-teal-400 font-mono">{part}</span>;
      }
      // Bracket indicators like [default]
      if (/^\[[^\]]+\]$/.test(part)) {
        return <span key={index} className="text-slate-500 font-semibold">{part}</span>;
      }
      // IP Addresses
      if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(part)) {
        return <span key={index} className="text-cyan-400 font-mono underline decoration-dashed decoration-cyan-400/30">{part}</span>;
      }

      return <span key={index}>{part}</span>;
    });
  };

  const copyLogql = () => {
    navigator.clipboard.writeText(logqlQuery);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const copyAllLogs = () => {
    const rawLogs = logs.map(l => `[${new Date(l.timestamp).toLocaleTimeString()}] [${l.level}] [${l.pod}] ${l.message}`).join('\n');
    navigator.clipboard.writeText(rawLogs);
    setIsCopiedLogs(true);
    setTimeout(() => setIsCopiedLogs(false), 2000);
  };

  const downloadLogs = () => {
    const rawLogs = logs.map(l => `[${new Date(l.timestamp).toISOString()}] [${l.level}] [${l.pod}] ${l.message}`).join('\n');
    const blob = new Blob([rawLogs], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `deploymate-loki-logs-${selectedPod || 'all'}-${Date.now()}.log`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text flex items-center gap-2">
            <TerminalIcon className="text-primary-light h-6.5 w-6.5 animate-pulse" />
            Loki Centralized Logs Explorer
          </h1>
          <p className="text-sm text-muted">Filter pod stdout descriptors, compile LogQL statements, and query Loki aggregators.</p>
        </div>

        <button onClick={fetchLogs} className="rounded-lg border border-border p-2 hover:bg-slate-800 self-start sm:self-auto text-muted hover:text-text transition-colors">
          <RefreshCw className="h-4.5 w-4.5" />
        </button>
      </div>

      {/* LogQL Query Box Panel */}
      <div className="glass-panel p-4 bg-[#090C16] border-slate-900 flex flex-col sm:flex-row gap-3.5 items-center select-text">
        <div className="flex items-center gap-2 text-primary-light font-mono text-xs font-semibold shrink-0">
          <Code2 className="h-4.5 w-4.5" />
          <span>LogQL Query:</span>
        </div>
        <div className="flex-1 font-mono text-xs text-text bg-slate-950 p-2.5 rounded-lg border border-white/[0.04] select-all truncate w-full">
          {logqlQuery}
        </div>
        <button
          onClick={copyLogql}
          className="rounded border border-border bg-slate-900 px-3 py-1.5 text-xs text-muted hover:text-text hover:bg-slate-800 transition-all flex items-center gap-1 shrink-0"
        >
          {isCopied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
          Copy Query
        </button>
      </div>

      {/* Query Filters Panel */}
      <div className="glass-panel p-4 bg-panel/30 flex flex-col gap-4 md:flex-row md:items-center">
        <div className="flex items-center gap-2 text-muted text-sm font-semibold shrink-0">
          <SlidersHorizontal className="h-4 w-4" /> Filters:
        </div>

        {/* Pod Selector */}
        <select
          value={selectedPod}
          onChange={(e) => setSelectedPod(e.target.value)}
          className="rounded-lg border border-border bg-[#0E1424] px-3 py-1.5 text-sm text-text focus:outline-none focus:ring-1 focus:ring-primary/50 w-full md:w-auto font-sans"
        >
          {podsList.map(p => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>

        {/* Level Selector */}
        <select
          value={selectedLevel}
          onChange={(e) => setSelectedLevel(e.target.value)}
          className="rounded-lg border border-border bg-[#0E1424] px-3 py-1.5 text-sm text-text focus:outline-none focus:ring-1 focus:ring-primary/50 w-full md:w-auto font-sans"
        >
          {levelsList.map(l => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>

        {/* Text Filter */}
        <div className="flex items-center gap-2 border border-border bg-slate-950/40 rounded-lg px-3 py-1.5 flex-1 w-full font-sans">
          <Search className="h-4 w-4 text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search logs pattern..."
            className="bg-transparent text-sm text-text focus:outline-none placeholder:text-slate-600 w-full"
          />
        </div>
      </div>

      {/* Log Console Output */}
      <div className="glass-panel bg-[#050811] border-slate-900 shadow-glow p-6">
        <div className="flex items-center justify-between border-b border-white/[0.04] pb-4 mb-4 select-none">
          <div className="flex items-center gap-2 text-xs font-mono font-semibold text-muted">
            <TerminalIcon className="h-4.5 w-4.5 text-primary-light" />
            <span>Stdout/Stderr Aggregation Console</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={copyAllLogs}
              disabled={logs.length === 0}
              className="rounded-md border border-border hover:bg-slate-900/60 p-1.5 text-muted hover:text-text transition-colors flex items-center gap-1.5 text-[10px] font-semibold uppercase disabled:opacity-40"
            >
              {isCopiedLogs ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
              Copy Output
            </button>
            <button
              onClick={downloadLogs}
              disabled={logs.length === 0}
              className="rounded-md border border-border hover:bg-slate-900/60 p-1.5 text-muted hover:text-text transition-colors flex items-center gap-1.5 text-[10px] font-semibold uppercase disabled:opacity-40"
            >
              <Download className="h-3.5 w-3.5" />
              Download Log
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-muted font-sans select-none">
            <TerminalIcon className="h-12 w-12 text-slate-700 mb-3 stroke-1" />
            <p className="text-sm font-semibold text-text">No Log Matches</p>
            <p className="text-xs text-muted max-w-xs mt-1">Refine your query constraints or verify the target pod containers state.</p>
          </div>
        ) : (
          <div className="font-mono text-[11px] text-slate-300 space-y-1.5 overflow-y-auto max-h-[500px] pr-2 select-text leading-relaxed">
            {logs.map((log, idx) => (
              <div key={idx} className="flex flex-col sm:flex-row sm:items-start gap-2.5 py-1 px-2 rounded hover:bg-slate-900/40 border border-transparent hover:border-white/[0.01]">
                {/* Timestamp */}
                <span className="text-[10px] text-slate-600 shrink-0 select-none">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                
                {/* Log Level badge */}
                <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold border shrink-0 uppercase select-none ${getLogLevelClass(log.level)}`}>
                  {getLogLevelIcon(log.level)}
                  {log.level}
                </span>

                {/* Pod Label */}
                <span className="text-secondary-light font-semibold shrink-0 select-none flex items-center gap-1 font-mono text-[10px]">
                  <Cpu className="h-3.5 w-3.5 shrink-0" />
                  {log.pod.replace('deploymate-','')}
                </span>

                {/* Message (Colorized!) */}
                <span className="text-slate-300 break-all select-text font-mono">
                  {colorizeLogMessage(log.message)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
