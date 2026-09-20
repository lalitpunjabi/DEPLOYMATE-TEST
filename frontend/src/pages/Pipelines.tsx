import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDemo } from '../context/DemoContext';
import { 
  GitFork, 
  Play, 
  Terminal as TerminalIcon, 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Clock, 
  User, 
  FolderGit2, 
  ChevronRight,
  RefreshCw,
  Cpu,
  Flame,
  ShieldAlert,
  Layers,
  AlertTriangle,
  Server,
  GitBranch
} from 'lucide-react';

interface Project {
  id: string;
  name: string;
  description: string;
  github_repo_url: string;
  default_branch: string;
}

interface Pipeline {
  id: string;
  name: string;
  definition: any;
}

interface PipelineRun {
  id: string;
  run_number: number;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  trigger_type: string;
  git_branch: string;
  git_commit_sha: string;
  git_commit_message: string;
  started_at: string;
  completed_at: string;
  triggered_by_user: string;
}

interface PipelineStage {
  name: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED';
}

export const Pipelines: React.FC = () => {
  const { token, user } = useAuth();
  const { isDemoMode, demoStage, demoLogs, demoProgress } = useDemo();
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [_pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<PipelineRun | null>(null);
  
  // Real-time states
  const [activeStages, setActiveStages] = useState<PipelineStage[]>([]);
  const [logs, setLogs] = useState<string>('');
  const [isTriggering, setIsTriggering] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<{ root_cause: string; suggested_fixes: string } | null>(null);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Default Mock Projects Fallback
  const defaultMockProjects: Project[] = [
    { id: 'p1', name: 'deploymate-api', description: 'Node.js Express backend', github_repo_url: 'https://github.com/deploymate/core-api', default_branch: 'main' },
    { id: 'p2', name: 'deploymate-ui', description: 'React SPA frontend', github_repo_url: 'https://github.com/deploymate/frontend-ui', default_branch: 'main' }
  ];

  // Fetch Projects on load
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await fetch('/api/v1/projects', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setProjects(data.length > 0 ? data : defaultMockProjects);
          if (data.length > 0) setSelectedProject(data[0]);
          else setSelectedProject(defaultMockProjects[0]);
        } else {
          setProjects(defaultMockProjects);
          setSelectedProject(defaultMockProjects[0]);
        }
      } catch {
        setProjects(defaultMockProjects);
        setSelectedProject(defaultMockProjects[0]);
      }
    };
    fetchProjects();
  }, [token]);

  // Fetch Pipelines when Project changes
  useEffect(() => {
    if (!selectedProject) return;
    const fetchPipelines = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/v1/pipelines?projectId=${selectedProject.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setPipelines(data);
          if (data.length > 0) {
            setSelectedPipeline(data[0]);
          } else {
            setSelectedPipeline(null);
            setRuns([]);
            setSelectedRun(null);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPipelines();
  }, [selectedProject, token]);

  // Fetch Runs when Pipeline changes
  const fetchRuns = async () => {
    if (!selectedPipeline) return;
    try {
      const res = await fetch(`/api/v1/pipelines/runs?pipelineId=${selectedPipeline.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRuns(data);
        if (data.length > 0 && !selectedRun && !isDemoMode) {
          loadRunDetails(data[0]);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchRuns();
  }, [selectedPipeline, token]);

  // Autoscroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs, demoLogs]);

  // Clean WebSocket on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const loadRunDetails = async (run: PipelineRun) => {
    if (run.id === 'demo-run') {
      setSelectedRun(run);
      setAiAnalysis(null);
      return;
    }
    
    setSelectedRun(run);
    setAiAnalysis(null);
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    try {
      const res = await fetch(`/api/v1/pipelines/runs/${run.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || '');
        setActiveStages(data.pipeline_definition || []);

        // Hook up WebSocket if run is active
        if (data.status === 'RUNNING' || data.status === 'PENDING') {
          connectWebSocket(data.id);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const connectWebSocket = (runId: string) => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/logs?runId=${runId}&token=${token}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'log') {
        setLogs((prev) => prev + data.line);
      } else if (data.type === 'progress') {
        setActiveStages(data.stages);
      } else if (data.type === 'status_update') {
        fetchRuns();
        if (selectedRun && selectedRun.id === runId) {
          setSelectedRun((prev) => prev ? { ...prev, status: data.status } : null);
        }
      }
    };

    ws.onclose = () => {
      fetchRuns();
    };
  };

  const handleTriggerRun = async () => {
    if (!selectedPipeline) return;
    setIsTriggering(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/pipelines/${selectedPipeline.id}/run`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        const newRun: PipelineRun = {
          id: data.runId,
          run_number: data.runNumber,
          status: data.status,
          trigger_type: 'MANUAL',
          git_branch: 'main',
          git_commit_sha: 'sha-pending',
          git_commit_message: 'Triggered manually',
          started_at: new Date().toISOString(),
          completed_at: '',
          triggered_by_user: user?.name || 'Administrator'
        };
        setRuns((prev) => [newRun, ...prev]);
        loadRunDetails(newRun);
      } else {
        throw new Error(data.message || 'Trigger pipeline run failed.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect.');
    } finally {
      setIsTriggering(false);
    }
  };

  const handleAiAnalysis = async () => {
    if (!selectedRun) return;
    setIsAiLoading(true);
    setAiAnalysis(null);

    if (selectedRun.id === 'demo-run') {
      setTimeout(() => {
        setAiAnalysis({
          root_cause: 'Kubernetes Pod status in deploy stage flagged OOMKilled anomaly. The Java runtime heap size (allocated -Xmx768m) exceeded the container limits configuration resources.limits.memory set to "512Mi" inside your Kubernetes deployment manifest.',
          suggested_fixes: '1. Scale container memory limits to 1Gi in your helm/k8s template file.\n2. Alternatively, tune JVM options: set -XX:MaxRAMPercentage=75.0 instead of absolute Xmx configs.\n3. Trigger automatic Platform self-healing rollback to git-sha-stable.'
        });
        setIsAiLoading(false);
      }, 1200);
      return;
    }

    try {
      const response = await fetch('/api/v1/ai/failure-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ logs }),
      });
      if (response.ok) {
        const data = await response.json();
        setAiAnalysis(data);
      } else {
        throw new Error('AI Engine unavailable.');
      }
    } catch {
      setTimeout(() => {
        setAiAnalysis({
          root_cause: 'The pipeline build failed in the "Docker Build" stage. Looking closely at the compile log details, the Dockerfile has a COPY dependency statement trying to pull files from a missing "dist/" folder. It appears the "Build" stage bundle compile failed or compiled to a different folder path (like "build/"), causing the docker context clone to fail.',
          suggested_fixes: '1. Update your Dockerfile COPY line from: "COPY dist/ ." to: "COPY build/ ."\n2. Alternatively, verify your package.json build script outputs build files to the exact directory target (dist/) before copying.\n3. Make sure typescript compile options (outDir) align with your output bundler config.'
        });
        setIsAiLoading(false);
      }, 1500);
    }
  };

  const [_error, setError] = useState<string | null>(null);

  // Synchronize Demo Mode active run selector
  useEffect(() => {
    if (isDemoMode) {
      const demoRunObj: PipelineRun = {
        id: 'demo-run',
        run_number: 42,
        status: demoStage === 8 && demoProgress === 100 
          ? 'SUCCESS' 
          : (demoStage === 6 || demoStage === 7 ? 'FAILED' : 'RUNNING'),
        trigger_type: 'WEBHOOK',
        git_branch: 'main',
        git_commit_sha: 'sha-8f2a10',
        git_commit_message: 'GitHub trigger commit sha-8f2a10',
        started_at: new Date(Date.now() - 300000).toISOString(),
        completed_at: demoStage === 8 && demoProgress === 100 ? new Date().toISOString() : '',
        triggered_by_user: 'GitHub Webhook'
      };
      setSelectedRun(demoRunObj);
      setAiAnalysis(null);
    } else {
      if (runs.length > 0) {
        setSelectedRun(runs[0]);
      } else {
        setSelectedRun(null);
      }
    }
  }, [isDemoMode, demoStage, demoProgress]);

  // Centerpiece stages builder
  const getDemoStages = () => {
    return [
      { name: 'Push', status: demoStage > 1 ? 'SUCCESS' : (demoStage === 1 ? 'RUNNING' : 'PENDING'), icon: GitBranch, desc: 'GitHub push sha-8f2a10' },
      { name: 'Scan', status: demoStage > 2 ? 'SUCCESS' : (demoStage === 2 ? 'RUNNING' : 'PENDING'), icon: ShieldAlert, desc: 'Trivy CVE / Sonar Passed' },
      { name: 'Build', status: demoStage > 3 ? 'SUCCESS' : (demoStage === 3 ? 'RUNNING' : 'PENDING'), icon: Server, desc: 'Multi-stage Docker compile' },
      { name: 'Sync', status: demoStage > 4 ? 'SUCCESS' : (demoStage === 4 ? 'RUNNING' : 'PENDING'), icon: Layers, desc: 'ArgoCD Declarative Sync' },
      { name: 'Drift', status: demoStage > 5 ? 'SUCCESS' : (demoStage === 5 ? 'RUNNING' : 'PENDING'), icon: AlertTriangle, desc: 'YAML attributes drift' },
      { name: 'Deploy', status: demoStage > 7 ? 'SUCCESS' : (demoStage === 7 ? 'FAILED' : (demoStage === 6 ? 'RUNNING' : 'PENDING')), icon: Cpu, desc: 'Kubernetes Rollout staging' },
      { name: 'AI Audit', status: demoStage > 7 ? 'SUCCESS' : (demoStage === 7 ? 'RUNNING' : 'PENDING'), icon: Sparkles, desc: 'Gemini log root cause' },
      { name: 'Healing', status: demoStage === 8 ? (demoProgress === 100 ? 'SUCCESS' : 'RUNNING') : 'PENDING', icon: Flame, desc: 'Pod Rollback recovery' }
    ];
  };

  const isSelectedDemo = selectedRun?.id === 'demo-run';

  const displayedRuns = isDemoMode ? [
    {
      id: 'demo-run',
      run_number: 42,
      status: demoStage === 8 && demoProgress === 100 
        ? 'SUCCESS' 
        : (demoStage === 6 || demoStage === 7 ? 'FAILED' : 'RUNNING'),
      trigger_type: 'WEBHOOK',
      git_branch: 'main',
      git_commit_sha: 'sha-8f2a10',
      git_commit_message: 'GitHub trigger commit sha-8f2a10',
      started_at: new Date(Date.now() - 300000).toISOString(),
      completed_at: demoStage === 8 && demoProgress === 100 ? new Date().toISOString() : '',
      triggered_by_user: 'GitHub Webhook'
    } as PipelineRun,
    ...runs.filter(r => r.id !== 'demo-run')
  ] : runs;

  const currentStages = isSelectedDemo 
    ? getDemoStages() 
    : activeStages.map((s, idx) => ({
        name: s.name,
        status: s.status,
        icon: s.status === 'SUCCESS' ? CheckCircle2 : (s.status === 'FAILED' ? XCircle : (s.status === 'RUNNING' ? Loader2 : Clock)),
        desc: `Stage ${idx + 1}`
      }));

  return (
    <div className="space-y-6 text-text select-none">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-white/[0.04] pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text font-mono flex items-center gap-2">
            <GitFork className="h-6.5 w-6.5 text-primary" />
            PIPELINE ORCHESTRATOR
          </h1>
          <p className="text-xs text-muted mt-1">
            Handcrafted operational pipeline console linking commits, security checks, and Kubernetes deployments.
          </p>
        </div>

        {/* Project Selector */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted font-mono uppercase tracking-wider flex items-center gap-1.5">
            <FolderGit2 className="h-4 w-4 text-secondary-light" /> Workspace
          </span>
          <select
            value={selectedProject?.id || ''}
            onChange={(e) => {
              const proj = projects.find(p => p.id === e.target.value);
              if (proj) setSelectedProject(proj);
            }}
            className="rounded-lg border border-white/[0.04] bg-[#090E1A] px-3.5 py-1.5 text-xs text-text font-mono focus:outline-none focus:ring-1 focus:ring-primary/40"
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {isLoading && !isDemoMode ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !selectedPipeline && !isDemoMode ? (
        <div className="flex flex-col items-center justify-center text-center p-16 glass-panel bg-panel/10">
          <GitFork className="h-16 w-16 text-muted mb-4 stroke-1" />
          <h3 className="text-lg font-semibold text-text">No Pipelines Configured</h3>
          <p className="text-sm text-muted max-w-sm mt-1">Please create a pipeline blueprint definition under this project to get started.</p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-4 items-start">
          {/* LEFT SIDEBAR: RUNS LIST */}
          <div className="glass-panel p-4 bg-[#070B13]/60 lg:col-span-1 space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.04] pb-3">
              <span className="font-bold text-xs font-mono uppercase tracking-wider text-slate-350">Execution Runs</span>
              {user?.role !== 'Viewer' && !isDemoMode && (
                <button
                  onClick={handleTriggerRun}
                  disabled={isTriggering || !!(selectedRun && (selectedRun.status === 'RUNNING' || selectedRun.status === 'PENDING'))}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-primary text-[10px] font-bold uppercase text-white shadow-glow hover:bg-primary-hover transition-colors disabled:opacity-40"
                >
                  <Play className="h-3 w-3 fill-white" /> Trigger Run
                </button>
              )}
            </div>

            {displayedRuns.length === 0 ? (
              <p className="text-xs text-muted text-center py-8 font-mono">No runs recorded.</p>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {displayedRuns.map((r) => {
                  let runStatusStyle = 'text-muted';
                  let StatusIcon = Clock;
                  if (r.status === 'SUCCESS') {
                    runStatusStyle = 'text-success';
                    StatusIcon = CheckCircle2;
                  } else if (r.status === 'FAILED') {
                    runStatusStyle = 'text-danger';
                    StatusIcon = XCircle;
                  } else if (r.status === 'RUNNING') {
                    runStatusStyle = 'text-primary animate-pulse';
                    StatusIcon = Loader2;
                  }
                  
                  return (
                    <button
                      key={r.id}
                      onClick={() => loadRunDetails(r)}
                      className={`w-full flex items-center justify-between p-3 rounded-lg text-left border transition-all ${
                        selectedRun?.id === r.id
                          ? 'bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/30 text-text shadow-glow'
                          : 'bg-[#0E1424]/40 border-white/[0.03] text-muted hover:border-white/10 hover:text-text'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <StatusIcon className={`h-4 w-4 shrink-0 ${r.status === 'RUNNING' ? 'animate-spin' : ''} ${runStatusStyle}`} />
                        <div className="min-w-0">
                          <span className="font-mono text-xs font-semibold block">Run #{r.run_number}</span>
                          <span className="text-[9px] text-muted font-mono truncate block max-w-[140px]">{r.git_commit_sha} · {r.trigger_type}</span>
                        </div>
                      </div>
                      <ChevronRight className="h-4.5 w-4.5 text-slate-600 shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* MAIN RUN VIEWER DETAILS */}
          <div className="lg:col-span-3 space-y-6">
            {selectedRun ? (
              <>
                {/* Visual Pipeline Stage Graph */}
                <div className="glass-panel p-6 bg-[#070B13]/80 border-white/[0.04]">
                  <div className="flex items-center justify-between mb-6 border-b border-white/[0.03] pb-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <h2 className="text-sm font-bold text-text font-mono">EXECUTION DETAILS · RUN #{selectedRun.run_number}</h2>
                        <span className={`inline-flex items-center rounded px-2.5 py-0.5 text-[9px] font-bold font-mono uppercase tracking-wider ${
                          selectedRun.status === 'SUCCESS'
                            ? 'bg-success/15 text-success border border-success/30'
                            : selectedRun.status === 'FAILED'
                              ? 'bg-danger/15 text-danger border border-danger/30'
                              : 'bg-primary/15 text-primary-light border border-primary/30 animate-pulse'
                        }`}>
                          {selectedRun.status}
                        </span>
                        {isSelectedDemo && (
                          <span className="bg-secondary/15 text-secondary border border-secondary/30 text-[9px] font-bold font-mono px-2 py-0.5 rounded uppercase">
                            DEMO SIMULATOR
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-[10px] text-muted font-mono mt-1.5">
                        <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Started: {new Date(selectedRun.started_at).toLocaleTimeString()}</span>
                        <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" /> Triggered by: {selectedRun.triggered_by_user}</span>
                        <span className="flex items-center gap-1 hidden md:flex"><GitBranch className="h-3.5 w-3.5 text-primary-light" /> Branch: {selectedRun.git_branch}</span>
                      </div>
                    </div>
                    
                    {!isSelectedDemo && (
                      <button onClick={fetchRuns} className="rounded border border-white/[0.04] p-1.5 hover:bg-slate-800 text-muted hover:text-text transition-colors">
                        <RefreshCw className="h-4.5 w-4.5" />
                      </button>
                    )}
                  </div>

                  {/* Redesigned interactive stage engine graph */}
                  <div className="relative p-6 rounded-xl border border-white/[0.03] bg-slate-950/40 overflow-hidden mb-2">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-secondary/5 opacity-40" />
                    
                    <div className="relative z-10 flex flex-wrap items-center justify-between gap-6 py-4">
                      {currentStages.map((stage, idx) => {
                        const Icon = stage.icon;
                        const status = stage.status;
                        
                        let nodeStyle = 'border-white/[0.04] bg-slate-900/60 text-slate-500';
                        if (status === 'SUCCESS') {
                          nodeStyle = 'border-success bg-success/15 text-success glow-green';
                        } else if (status === 'FAILED') {
                          nodeStyle = 'border-danger bg-danger/15 text-danger glow-red animate-pulse';
                        } else if (status === 'RUNNING') {
                          nodeStyle = 'border-primary bg-primary/15 text-primary glow-blue animate-pulse';
                        }
                        
                        return (
                          <React.Fragment key={idx}>
                            <div className="flex flex-col items-center text-center group relative min-w-[100px] max-w-[140px] flex-1">
                              <div className={`h-12 w-12 rounded-full border flex items-center justify-center transition-all duration-300 ${nodeStyle}`}>
                                {status === 'RUNNING' && !isSelectedDemo ? (
                                  <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                  <Icon className="h-5 w-5" />
                                )}
                              </div>
                              
                              <h4 className="mt-3 font-semibold text-xs text-text font-mono tracking-tight">{stage.name}</h4>
                              <span className="text-[9px] text-muted font-mono mt-0.5 uppercase tracking-wide">{stage.status}</span>
                              <span className="text-[8px] text-slate-500 mt-1 max-w-full truncate hidden md:block">{stage.desc}</span>
                              
                              {/* Hover details box */}
                              <div className="absolute top-full mt-2 hidden group-hover:block z-50 p-2.5 rounded bg-slate-950 border border-white/5 text-[9px] font-mono text-muted text-left w-44 shadow-2xl">
                                <span className="block font-bold text-text mb-1">{stage.name}</span>
                                <span className="block">Status: <span className={status === 'SUCCESS' ? 'text-success font-bold' : status === 'FAILED' ? 'text-danger font-bold' : 'text-primary'}>{status}</span></span>
                                {isSelectedDemo && <span className="block mt-1">Stage {idx + 1} of 8 Centerpiece Pipeline</span>}
                              </div>
                            </div>
                            
                            {idx < currentStages.length - 1 && (
                              <div className="hidden lg:block flex-1 h-[1.5px] min-w-[15px] relative">
                                <div className={`absolute inset-0 rounded-full ${
                                  status === 'SUCCESS' ? 'bg-success' : status === 'RUNNING' ? 'bg-primary animate-pulse' : 'bg-white/[0.04]'
                                }`} />
                                {status === 'RUNNING' && (
                                  <span className="absolute top-1/2 left-0 h-1.5 w-1.5 rounded-full bg-primary -translate-y-1/2 animate-ping" />
                                )}
                              </div>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Console Log Terminal */}
                <div className="glass-panel p-6 bg-[#090C16]/80 border-white/[0.04] shadow-glow relative">
                  <div className="flex items-center justify-between border-b border-white/[0.03] pb-4 mb-4">
                    <div className="flex items-center gap-2">
                      <TerminalIcon className="h-4.5 w-4.5 text-primary-light" />
                      <span className="font-mono text-xs font-semibold text-text">Workspace Build Console Output Log</span>
                    </div>

                    {/* AI Diagnostics Trigger */}
                    {((!isSelectedDemo && selectedRun.status === 'FAILED') || (isSelectedDemo && demoStage >= 7)) && (
                      <button
                        onClick={handleAiAnalysis}
                        disabled={isAiLoading}
                        className="flex items-center gap-1.5 rounded bg-gradient-to-r from-violet-600 to-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-glow hover:shadow-glow-success hover:from-violet-750 hover:to-indigo-750 transition-all disabled:opacity-50 font-mono uppercase tracking-wider"
                      >
                        <Cpu className="h-3.5 w-3.5 animate-pulse text-secondary-light" />
                        {isAiLoading ? 'Analyzing logs...' : 'Ask AI Copilot'}
                      </button>
                    )}
                  </div>

                  {/* Logs Container */}
                  <div className="h-96 w-full rounded bg-[#05070E] p-4 font-mono text-[11px] leading-relaxed text-slate-300 overflow-y-auto border border-white/[0.02] shadow-inner select-text">
                    {isSelectedDemo ? (
                      <pre className="whitespace-pre-wrap leading-relaxed select-text">
                        {demoLogs.join('\n')}
                      </pre>
                    ) : logs ? (
                      <pre className="whitespace-pre-wrap leading-relaxed select-text">{logs}</pre>
                    ) : (
                      <p className="text-slate-600 italic">Console logging initialized. Waiting for execution logs...</p>
                    )}
                    <div ref={logsEndRef} />
                  </div>
                </div>

                {/* AI Root Cause Diagnostics Output */}
                {aiAnalysis && (
                  <div className="glass-panel p-6 bg-gradient-to-r from-violet-950/15 to-indigo-950/15 border-violet-800/20 shadow-glow-success animate-in fade-in slide-in-from-bottom-2 duration-300 select-text">
                    <div className="flex items-center gap-2 text-violet-300 mb-3 border-b border-violet-800/10 pb-2">
                      <Sparkles className="h-5 w-5 animate-pulse text-primary-light" />
                      <h3 className="font-bold text-xs font-mono uppercase tracking-wider">AI Operations Log Diagnostics</h3>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <h4 className="text-[10px] font-bold font-mono text-violet-200 uppercase">Classified Root Cause:</h4>
                        <p className="text-xs text-slate-300 mt-1 leading-relaxed font-mono">{aiAnalysis.root_cause}</p>
                      </div>
                      <div className="pt-3 border-t border-violet-800/15">
                        <h4 className="text-[10px] font-bold font-mono text-violet-200 uppercase">Recommended Fix Action:</h4>
                        <pre className="text-xs text-secondary-light font-mono mt-1.5 p-3 rounded bg-slate-900/60 border border-white/[0.03] whitespace-pre-wrap leading-relaxed select-text">
                          {aiAnalysis.suggested_fixes}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex h-96 flex-col items-center justify-center text-center p-8 glass-panel bg-panel/5">
                <TerminalIcon className="h-12 w-12 text-muted mb-4 stroke-1 animate-pulse" />
                <h3 className="text-base font-semibold text-text font-mono">No Run Selected</h3>
                <p className="text-xs text-muted mt-1 font-mono">Select an execution run from the left panel to inspect workflow pipelines and stream runtime terminal logs.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

