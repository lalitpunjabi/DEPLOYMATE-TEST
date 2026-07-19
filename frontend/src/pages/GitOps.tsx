import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDemo } from '../context/DemoContext';
import { 
  GitCompare, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  ShieldAlert,
  ChevronRight,
  GitBranch,
  Layers,
  ArrowRight,
  FileCode,
  CheckCircle2,
  Loader2
} from 'lucide-react';

interface GitOpsStatus {
  app_name: string;
  sync_status: string;
  cluster_health: string;
  drift_detected: boolean;
  drift_details: {
    kind: string;
    name: string;
    diff: string;
  } | null;
  history: any[];
}

export const GitOps: React.FC = () => {
  const { token } = useAuth();
  const { isDemoMode, demoStage } = useDemo();
  
  const [projectId] = useState('p1');
  const [status, setStatus] = useState<GitOpsStatus>({
    app_name: 'deploymate-api-deployment',
    sync_status: 'Synced',
    cluster_health: 'Healthy',
    drift_detected: false,
    drift_details: null,
    history: []
  });
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:5000/api/v1/gitops/sync-status?projectId=${projectId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (err) {
      console.error('Failed to load GitOps status', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [token]);

  const handleSync = async () => {
    setSyncing(true);
    setMessage(null);
    try {
      const response = await fetch('http://localhost:5000/api/v1/gitops/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ project_id: projectId, app_name: status.app_name })
      });
      if (response.ok) {
        setMessage('ArgoCD reconciliation sync successfully executed.');
        await fetchStatus();
      }
    } catch (err) {
      setMessage('Synchronization dispatcher failed.');
    } finally {
      setSyncing(false);
    }
  };

  const handleTriggerDrift = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch('http://localhost:5000/api/v1/gitops/drift-trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ project_id: projectId, app_name: status.app_name })
      });
      if (response.ok) {
        setMessage('Simulated drift registered inside Kubernetes namespace.');
        await fetchStatus();
      }
    } catch (err) {
      setMessage('Failed to inject simulated resource drift.');
    } finally {
      setLoading(false);
    }
  };

  // Demo integration mappings
  const isDemoActive = isDemoMode;
  const isDemoDrift = demoStage === 5 || demoStage === 6 || demoStage === 7;
  const activeSyncStatus = isDemoActive
    ? (demoStage === 4 ? 'Syncing' : (isDemoDrift ? 'OutOfSync' : 'Synced'))
    : status.sync_status;

  const activeDriftDetected = isDemoActive ? isDemoDrift : status.drift_detected;
  
  const activeClusterHealth = isDemoActive
    ? (demoStage === 6 || demoStage === 7 ? 'Degraded' : 'Healthy')
    : status.cluster_health;

  const activeRevision = isDemoActive
    ? (demoStage >= 8 ? 'git-f8a1c92d (restored)' : 'git-f8a1c92d')
    : (status.history.length > 0 ? status.history[0].revision_sha : 'git-f8a1c92d');

  // YAML templates for comparison
  const desiredYaml = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: deploymate-api-deployment
  namespace: deploymate-staging
spec:
  replicas: 3
  selector:
    matchLabels:
      app: deploymate-api
  template:
    metadata:
      labels:
        app: deploymate-api
    spec:
      containers:
      - name: main
        image: deploymate/core-api:latest
        resources:
          limits:
            cpu: "500m"
            memory: "512Mi"
          requests:
            cpu: "100m"
            memory: "256Mi"`;

  const liveYaml = isDemoDrift
    ? `apiVersion: apps/v1
kind: Deployment
metadata:
  name: deploymate-api-deployment
  namespace: deploymate-staging
spec:
  replicas: 1  # ⚠️ DRIFT (Git states: 3)
  selector:
    matchLabels:
      app: deploymate-api
  template:
    metadata:
      labels:
        app: deploymate-api
    spec:
      containers:
      - name: main
        image: deploymate/core-api:latest
        resources:
          limits:
            cpu: "1000m"  # ⚠️ DRIFT (Git states: 500m)
            memory: "256Mi"  # ⚠️ DRIFT (Git states: 512Mi - OOM Risk!)
          requests:
            cpu: "100m"
            memory: "256Mi"`
    : desiredYaml;

  return (
    <div className="space-y-6 text-text select-none">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.04] pb-5">
        <div>
          <h1 className="text-2xl font-bold font-mono flex items-center gap-2">
            <GitCompare className="h-7 w-7 text-primary" />
            GITOPS OPERATIONS CENTER
          </h1>
          <p className="text-xs text-muted mt-1">
            Pull-based declarative continuous deployment reconciliation tracking powered by ArgoCD sync history and drift detectors.
          </p>
        </div>
        
        {!isDemoActive && (
          <div className="flex gap-2">
            <button
              onClick={handleTriggerDrift}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg border border-warning/30 bg-warning/5 px-4 py-2 text-xs font-semibold font-mono text-warning hover:bg-warning/10 transition-colors"
            >
              <ShieldAlert className="h-4.5 w-4.5 animate-pulse" />
              Inject Drift
            </button>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold font-mono text-white hover:bg-primary-dark transition-all duration-200 shadow-glow disabled:opacity-50"
            >
              <RefreshCw className={`h-4.5 w-4.5 ${syncing ? 'animate-spin' : ''}`} />
              Sync State
            </button>
          </div>
        )}
      </div>

      {/* Message Banner */}
      {message && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-xs font-mono text-primary flex items-center gap-2">
          <CheckCircle className="h-5 w-5" />
          <span>{message}</span>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Sync Status */}
        <div className="rounded-xl border border-white/[0.04] bg-[#070B13]/60 p-5 relative overflow-hidden">
          <span className="text-muted text-[9px] font-mono uppercase tracking-wider block">ArgoCD Sync Status</span>
          <h3 className="text-lg font-bold mt-2 font-mono flex items-center gap-1.5">
            {activeSyncStatus === 'Synced' ? (
              <span className="text-success flex items-center gap-1">
                <CheckCircle2 className="h-5 w-5" /> Synced
              </span>
            ) : activeSyncStatus === 'Syncing' ? (
              <span className="text-primary flex items-center gap-1 animate-pulse">
                <Loader2 className="h-5 w-5 animate-spin" /> Syncing...
              </span>
            ) : (
              <span className="text-warning flex items-center gap-1">
                <AlertTriangle className="h-5 w-5 text-warning animate-pulse" /> Out of Sync
              </span>
            )}
          </h3>
          <span className="block text-[9px] text-muted font-mono mt-2 truncate">Target: {status.app_name}</span>
        </div>

        {/* Cluster Health */}
        <div className="rounded-xl border border-white/[0.04] bg-[#070B13]/60 p-5 relative overflow-hidden">
          <span className="text-muted text-[9px] font-mono uppercase tracking-wider block">Cluster Health</span>
          <h3 className="text-lg font-bold mt-2 font-mono">
            {activeClusterHealth === 'Healthy' ? (
              <span className="text-success flex items-center gap-1.5">
                <CheckCircle2 className="h-5 w-5" /> Healthy
              </span>
            ) : (
              <span className="text-danger flex items-center gap-1.5 animate-pulse font-bold">
                <AlertTriangle className="h-5 w-5" /> Degraded
              </span>
            )}
          </h3>
          <span className="block text-[9px] text-muted font-mono mt-2">Namespace: deploymate-staging</span>
        </div>

        {/* Revision SHA */}
        <div className="rounded-xl border border-white/[0.04] bg-[#070B13]/60 p-5 relative overflow-hidden">
          <span className="text-muted text-[9px] font-mono uppercase tracking-wider block">Active Revision</span>
          <h3 className="text-lg font-bold mt-2 font-mono text-text truncate">
            {activeRevision}
          </h3>
          <span className="block text-[9px] text-muted font-mono mt-2">Source: GitHub Push webhook</span>
        </div>

        {/* Last Sync Duration */}
        <div className="rounded-xl border border-white/[0.04] bg-[#070B13]/60 p-5 relative overflow-hidden">
          <span className="text-muted text-[9px] font-mono uppercase tracking-wider block">Last Sync Time</span>
          <h3 className="text-lg font-bold mt-2 font-mono text-text flex items-center gap-1">
            <Clock className="h-5 w-5 text-secondary-light" />
            {status.history.length > 0 ? `${status.history[0].sync_duration_seconds}s` : '5.8s'}
          </h3>
          <span className="block text-[9px] text-muted font-mono mt-2">Average response: 6.2s</span>
        </div>
      </div>

      {/* Drift parameters discrepancy board */}
      {activeDriftDetected && (
        <div className="rounded-xl border border-danger/15 bg-danger/5 p-5 animate-fadeIn">
          <h3 className="text-xs font-bold font-mono text-danger uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <AlertTriangle className="h-4.5 w-4.5 animate-pulse" />
            Active Parameter Drift Discrepancies
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
            <div className="p-3 bg-slate-950/60 rounded border border-white/[0.02]">
              <span className="text-muted text-[9px] block uppercase">Parameter Path</span>
              <span className="text-text font-bold mt-1 block">spec.replicas</span>
              <div className="flex justify-between items-center mt-2 border-t border-white/[0.03] pt-2 text-[10px]">
                <span className="text-success">Desired: 3</span>
                <span className="text-danger">Live: 1</span>
              </div>
            </div>
            <div className="p-3 bg-slate-950/60 rounded border border-white/[0.02]">
              <span className="text-muted text-[9px] block uppercase">Parameter Path</span>
              <span className="text-text font-bold mt-1 block">spec.containers[0].resources.limits.cpu</span>
              <div className="flex justify-between items-center mt-2 border-t border-white/[0.03] pt-2 text-[10px]">
                <span className="text-success">Desired: 500m</span>
                <span className="text-danger">Live: 1000m</span>
              </div>
            </div>
            <div className="p-3 bg-slate-950/60 rounded border border-white/[0.02]">
              <span className="text-muted text-[9px] block uppercase">Parameter Path</span>
              <span className="text-text font-bold mt-1 block">spec.containers[0].resources.limits.memory</span>
              <div className="flex justify-between items-center mt-2 border-t border-white/[0.03] pt-2 text-[10px]">
                <span className="text-success">Desired: 512Mi</span>
                <span className="text-danger">Live: 256Mi (OOM RISK!)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Side-by-Side desired vs live YAML diff highlighter */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 select-text">
        {/* Desired State */}
        <div className="glass-panel p-5 bg-[#090C16]/90 border-white/[0.04] flex flex-col min-h-[420px]">
          <div className="flex items-center justify-between border-b border-white/[0.03] pb-3 mb-4 select-none">
            <div className="flex items-center gap-2">
              <FileCode className="h-4.5 w-4.5 text-success" />
              <span className="font-semibold text-text text-xs font-mono uppercase tracking-wider">Desired State (Git Repository)</span>
            </div>
            <span className="text-[9px] bg-success/15 border border-success/30 px-2 py-0.5 rounded text-success font-mono uppercase">
              Target Manifest
            </span>
          </div>

          <div className="flex-1 bg-[#05070E] rounded p-4 font-mono text-[11px] leading-relaxed border border-white/[0.02] overflow-auto max-h-[480px]">
            <pre>{desiredYaml}</pre>
          </div>
        </div>

        {/* Live Cluster State */}
        <div className="glass-panel p-5 bg-[#090C16]/90 border-white/[0.04] flex flex-col min-h-[420px]">
          <div className="flex items-center justify-between border-b border-white/[0.03] pb-3 mb-4 select-none">
            <div className="flex items-center gap-2">
              <GitCompare className={`h-4.5 w-4.5 ${activeDriftDetected ? 'text-warning' : 'text-success'}`} />
              <span className="font-semibold text-text text-xs font-mono uppercase tracking-wider">Live Cluster State</span>
            </div>
            <span className={`text-[9px] border px-2 py-0.5 rounded font-mono uppercase ${
              activeDriftDetected ? 'bg-warning/15 border-warning/30 text-warning animate-pulse' : 'bg-success/15 border-success/30 text-success'
            }`}>
              {activeDriftDetected ? 'Drift Detected' : 'Synchronized'}
            </span>
          </div>

          <div className="flex-1 bg-[#05070E] rounded p-4 font-mono text-[11px] leading-relaxed border border-white/[0.02] overflow-auto max-h-[480px]">
            {isDemoDrift ? (
              <pre className="selection:bg-danger/20 selection:text-white">
                {liveYaml.split('\n').map((line, idx) => {
                  const isDriftLine = line.includes('⚠️ DRIFT');
                  return (
                    <div key={idx} className={isDriftLine ? 'bg-danger/10 text-danger px-1 rounded font-bold' : ''}>
                      {line}
                    </div>
                  );
                })}
              </pre>
            ) : (
              <pre>{liveYaml}</pre>
            )}
          </div>
        </div>
      </div>

      {/* ArgoCD Sync Topology Path */}
      <div className="glass-panel p-6 bg-[#070B13]/60 border-white/[0.04] flex flex-col justify-between">
        <div>
          <span className="font-bold text-xs font-mono uppercase tracking-wider text-slate-350 block mb-4">Reconciliation Timeline Topology</span>
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 py-6 px-4 bg-slate-950/40 rounded-lg border border-white/[0.02]">
            <div className="flex flex-col items-center text-center w-full md:w-1/4 relative">
              <div className="h-12 w-12 rounded-full border-2 border-primary bg-primary/10 flex items-center justify-center text-primary shadow-glow">
                <GitBranch className="h-6 w-6" />
              </div>
              <h4 className="font-semibold text-xs mt-3 text-text font-mono">GitHub Registry</h4>
              <span className="text-[10px] font-mono text-muted">deploymate/api</span>
              <span className="text-[9px] mt-1 bg-primary/15 text-primary-light px-2 py-0.5 rounded-full font-mono">commit sha-8f2a10</span>
            </div>

            <ChevronRight className="hidden md:block h-6 w-6 text-slate-700 animate-pulse" />

            <div className="flex flex-col items-center text-center w-full md:w-1/4">
              <div className={`h-12 w-12 rounded-full border-2 flex items-center justify-center ${
                activeSyncStatus === 'Synced' ? 'border-success bg-success/10 text-success glow-green' : 'border-warning bg-warning/10 text-warning glow-warning animate-pulse'
              }`}>
                <GitCompare className="h-6 w-6" />
              </div>
              <h4 className="font-semibold text-xs mt-3 text-text font-mono">ArgoCD Sync</h4>
              <span className="text-[10px] text-muted font-mono">Declarative State Engine</span>
              <span className={`text-[9px] mt-1 px-2 py-0.5 rounded-full font-mono ${
                activeSyncStatus === 'Synced' ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'
              }`}>
                {activeSyncStatus}
              </span>
            </div>

            <ChevronRight className="hidden md:block h-6 w-6 text-slate-700 animate-pulse" />

            <div className="flex flex-col items-center text-center w-full md:w-1/4">
              <div className={`h-12 w-12 rounded-full border-2 flex items-center justify-center ${
                activeClusterHealth === 'Healthy' ? 'border-success bg-success/10 text-success' : 'border-danger bg-danger/10 text-danger glow-red animate-pulse'
              }`}>
                <Layers className="h-6 w-6" />
              </div>
              <h4 className="font-semibold text-xs mt-3 text-text font-mono">Target Cluster</h4>
              <span className="text-[10px] text-muted font-mono">deploymate-staging</span>
              <span className={`text-[9px] mt-1 px-2 py-0.5 rounded-full font-mono ${
                activeClusterHealth === 'Healthy' ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'
              }`}>{activeClusterHealth}</span>
            </div>
          </div>
        </div>

        <div className="mt-6 border-t border-white/[0.03] pt-4 flex justify-between items-center text-[10px] text-muted font-mono">
          <span>Declarative target state automatically synchronized every 3 minutes.</span>
          <span className="text-primary-light flex items-center gap-1">
            Active Sync Hook <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      </div>
      
      {/* Sync History Logs Table */}
      <div className="rounded-xl border border-white/[0.04] bg-[#070B13]/60 p-6">
        <h3 className="font-semibold text-xs font-mono uppercase tracking-wider mb-4 text-slate-350">Declarative Reconciliation History Log</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/[0.04] text-[10px] text-muted uppercase font-mono tracking-wider">
                <th className="pb-3">App Name</th>
                <th className="pb-3">Revision SHA</th>
                <th className="pb-3">Sync Status</th>
                <th className="pb-3">Cluster Health</th>
                <th className="pb-3">Drift Detected</th>
                <th className="pb-3">Sync Time</th>
                <th className="pb-3">Executed At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02] text-xs font-mono">
              <tr className="hover:bg-slate-800/10">
                <td className="py-3 font-semibold text-text">deploymate-api-deployment</td>
                <td className="py-3 text-primary-light">git-f8a1c92d</td>
                <td className="py-3">
                  <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 bg-success/10 text-success">
                    <span className="h-1.5 w-1.5 rounded-full bg-success" />
                    Synced
                  </span>
                </td>
                <td className="py-3 text-success font-semibold">Healthy</td>
                <td className="py-3">No</td>
                <td className="py-3">4.2s</td>
                <td className="py-3 text-muted">{new Date(Date.now() - 3600000).toLocaleString()}</td>
              </tr>
              {status.history.map((sync: any) => (
                <tr key={sync.id} className="hover:bg-slate-800/10">
                  <td className="py-3 font-semibold text-text">{sync.app_name}</td>
                  <td className="py-3 text-primary-light">{sync.revision_sha}</td>
                  <td className="py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${
                      sync.sync_status === 'Synced' 
                        ? 'bg-success/10 text-success' 
                        : 'bg-warning/10 text-warning'
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${sync.sync_status === 'Synced' ? 'bg-success' : 'bg-warning'}`} />
                      {sync.sync_status}
                    </span>
                  </td>
                  <td className="py-3 text-success font-semibold">{sync.cluster_health}</td>
                  <td className="py-3">{sync.drift_detected ? '⚠️ Yes (Diff)' : 'No'}</td>
                  <td className="py-3">{sync.sync_duration_seconds}s</td>
                  <td className="py-3 text-muted">{new Date(sync.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
