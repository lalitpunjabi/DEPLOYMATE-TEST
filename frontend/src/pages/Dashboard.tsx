import React, { useEffect, useState } from 'react';
import { useDemo } from '../context/DemoContext';
import { 
  GitBranch, 
  ShieldAlert, 
  Terminal, 
  Cpu, 
  Activity, 
  Flame, 
  AlertTriangle,
  Server,
  Layers,
  TrendingUp,
  DollarSign
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

export const Dashboard: React.FC = () => {
  const { 
    demoStage, 
    demoLogs, 
    isSimulating
  } = useDemo();

  const [simulatedMetrics, setSimulatedMetrics] = useState({
    cpu: 45,
    memory: 62,
    latency: 85,
    budget: 85.4
  });

  // Dynamic simulation telemetry shifts
  useEffect(() => {
    if (!isSimulating) return;
    const interval = setInterval(() => {
      setSimulatedMetrics(prev => {
        // CPU spikes on Docker build, latency spikes on K8s deploy failure
        let targetCpu = 40 + Math.floor(Math.random() * 15);
        let targetLat = 70 + Math.floor(Math.random() * 20);
        let budget = prev.budget;

        if (demoStage === 2) targetCpu = 85 + Math.floor(Math.random() * 10);
        if (demoStage === 6) {
          targetLat = 380 + Math.floor(Math.random() * 40);
          budget = Math.max(10.0, prev.budget - 4.5);
        }
        if (demoStage === 8) {
          targetLat = 82 + Math.floor(Math.random() * 10);
          budget = prev.budget;
        }

        return {
          cpu: targetCpu,
          memory: 55 + Math.floor(Math.random() * 10),
          latency: targetLat,
          budget: Number(budget.toFixed(3))
        };
      });
    }, 1500);
    return () => clearInterval(interval);
  }, [isSimulating, demoStage]);

  // Centerpiece Workflow Stages Metadata
  const centerpieceStages = [
    { label: 'Push', desc: 'GitHub Webhook', icon: GitBranch },
    { label: 'Scan', desc: 'Trivy CVE / Sonar', icon: ShieldAlert },
    { label: 'Build', desc: 'Docker Containerize', icon: Server },
    { label: 'Sync', desc: 'ArgoCD Reconciliation', icon: Layers },
    { label: 'Deploy', desc: 'Kubernetes Rollout', icon: Cpu },
    { label: 'SLI Alert', desc: 'Error Latency Peak', icon: Activity },
    { label: 'AI Diagnose', desc: 'Gemini Root Cause', icon: SparklesIcon },
    { label: 'Healing', desc: 'Pod Rollback Restore', icon: Flame }
  ];

  function SparklesIcon(props: any) {
    return <Cpu {...props} className={props.className + " text-primary-light animate-pulse"} />;
  }

  // Get active color configuration for centerpiece workflow nodes
  const getStageColor = (idx: number) => {
    const stageNum = idx + 1;
    
    // Healing Recovery Stage Success
    if (demoStage === 8 && stageNum === 8) return 'border-success bg-success/10 text-success glow-green';
    
    // Stage is running/active
    if (demoStage === stageNum) {
      // Stage 6 and 7 represent the failure and diagnosis
      if (stageNum === 6 || stageNum === 7) return 'border-danger bg-danger/10 text-danger glow-red animate-pulse';
      return 'border-primary bg-primary/10 text-primary glow-blue animate-pulse';
    }
    
    // Stage completed
    if (demoStage > stageNum) {
      if (stageNum === 6 && demoStage >= 7) return 'border-danger/60 bg-danger/5 text-danger'; // Remain red-bordered for failure audit
      return 'border-success bg-success/10 text-success glow-green';
    }
    
    // Pending
    return 'border-white/[0.04] bg-slate-900/40 text-slate-600';
  };

  const metricChartData = [
    { time: '00:00', latency: 85 },
    { time: '04:00', latency: 92 },
    { time: '08:00', latency: 88 },
    { time: '12:00', latency: demoStage === 6 ? 420 : 95 },
    { time: '16:00', latency: demoStage === 6 ? 380 : 86 },
    { time: '20:00', latency: 84 },
    { time: '24:00', latency: 85 },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 text-text select-none animate-fadeIn relative z-10">
      
      {/* ========================================================
          LEFT PANEL: INFRASTRUCTURE OVERVIEW DOCK
          ======================================================== */}
      <div className="lg:col-span-1 space-y-6">
        <div className="glass-panel p-5 bg-[#070B13]/80 border-white/[0.04]">
          <span className="text-muted text-[9px] font-mono uppercase tracking-wider block mb-1">OPERATIONAL CLUSTER</span>
          <h2 className="text-sm font-bold text-text font-mono uppercase">Telemetry Docks</h2>
          
          <div className="space-y-5 mt-6">
            {/* CPU Gauge */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-muted">Node CPU Util</span>
                <span className={simulatedMetrics.cpu > 80 ? 'text-danger font-bold' : 'text-text'}>
                  {simulatedMetrics.cpu}%
                </span>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-1 border border-white/[0.04]">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    simulatedMetrics.cpu > 80 ? 'bg-danger shadow-glow-danger' : 'bg-primary'
                  }`}
                  style={{ width: `${simulatedMetrics.cpu}%` }}
                />
              </div>
            </div>

            {/* Memory Gauge */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-muted">Node Memory Load</span>
                <span className="text-text">{simulatedMetrics.memory}%</span>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-1 border border-white/[0.04]">
                <div 
                  className="h-full bg-secondary rounded-full transition-all duration-500" 
                  style={{ width: `${simulatedMetrics.memory}%` }}
                />
              </div>
            </div>

            {/* Error Budget Gauge */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-muted">SLO Availability</span>
                <span className={`font-bold ${simulatedMetrics.budget < 30 ? 'text-danger animate-pulse' : 'text-success'}`}>
                  {simulatedMetrics.budget}%
                </span>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-1 border border-white/[0.04]">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    simulatedMetrics.budget < 30 ? 'bg-danger' : 'bg-success'
                  }`} 
                  style={{ width: `${simulatedMetrics.budget}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mt-8 border-t border-white/[0.03] pt-4 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-muted">Active Namespaces</span>
              <span className="text-text">4</span>
            </div>
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-muted">Healthy Replicas</span>
              <span className={demoStage === 6 ? 'text-danger font-bold' : 'text-success'}>
                {demoStage === 6 ? '1 / 4' : '4 / 4'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-muted">Core DNS Health</span>
              <span className="text-success">OK</span>
            </div>
          </div>
        </div>

        {/* Cloud Footprint Costs optimizer summary */}
        <div className="glass-panel p-5 bg-[#070B13]/80 border-white/[0.04]">
          <div className="flex items-center gap-1.5 text-muted text-[9px] font-mono uppercase tracking-wider mb-3">
            <DollarSign className="h-3.5 w-3.5 text-secondary" />
            FinOps Optimizer
          </div>
          <div className="text-2xl font-black font-mono tracking-tight">$1,420<span className="text-xs text-muted font-normal">/mo</span></div>
          <p className="text-muted text-[10px] mt-1">Projected AWS deployment footprint based on current cluster usage.</p>
          <div className="mt-4 p-3 rounded-lg border border-success/15 bg-success/5 flex items-center justify-between">
            <div>
              <span className="block text-[9px] text-success font-bold font-mono">ESTIMATED SAVINGS</span>
              <span className="text-xs font-bold text-text mt-0.5 block">$380/month</span>
            </div>
            <TrendingUp className="h-5 w-5 text-success" />
          </div>
        </div>
      </div>

      {/* ========================================================
          CENTER PANEL: LIVE ACTIVITY CENTERPIECE WORKFLOW
          ======================================================== */}
      <div className="lg:col-span-2 space-y-6">
        
        {/* Centerpiece visual timeline */}
        <div className="glass-panel p-6 bg-[#070B13]/90 border-white/[0.05] relative scan-effect min-h-[350px] flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-sm font-bold font-mono uppercase tracking-wider text-text">E2E Deployment Centerpiece Pipeline</h3>
                <p className="text-xs text-muted">Handcrafted continuous delivery engine tracking commits to healing loops.</p>
              </div>
              {isSimulating && (
                <span className="flex items-center gap-1 border border-primary/20 bg-primary/5 px-2.5 py-1 rounded-full text-[10px] font-bold font-mono text-primary-light">
                  RUNNING SIMULATION
                </span>
              )}
            </div>

            {/* Redesigned Piece Graph */}
            <div className="grid grid-cols-4 gap-4 py-4">
              {centerpieceStages.map((stage, idx) => {
                const Icon = stage.icon;
                return (
                  <div 
                    key={idx}
                    className={`p-3 rounded-lg border transition-all duration-300 relative flex flex-col items-center justify-center text-center ${getStageColor(idx)}`}
                  >
                    <div className="h-8 w-8 rounded-full border border-white/5 bg-slate-950 flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="font-bold text-xs mt-2 text-text font-mono truncate max-w-full">{stage.label}</span>
                    <span className="text-[9px] text-muted truncate max-w-full hidden md:block">{stage.desc}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Real-time live activity logs slider */}
          <div className="border-t border-white/[0.03] pt-4 mt-4">
            <span className="text-[10px] text-slate-500 font-mono block mb-2">Live Timeline Events feed:</span>
            <div className="bg-slate-950/80 border border-white/[0.04] p-3 rounded-lg font-mono text-[10px] text-slate-350 max-h-[100px] overflow-y-auto space-y-1">
              {demoLogs.slice(-3).map((log, idx) => (
                <div key={idx} className="flex gap-2">
                  <span className="text-primary-light font-bold shrink-0">──</span>
                  <span className="break-all">{log}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Latency graphs charts */}
        <div className="glass-panel p-5 bg-[#070B13]/60 border-white/[0.04]">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-bold font-mono text-text uppercase tracking-wider">HTTP Request Latency Telemetry</h3>
            <span className="font-mono text-[10px] text-muted">95th Percentile: {simulatedMetrics.latency}ms</span>
          </div>
          <div className="h-[140px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metricChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorLat" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={demoStage === 6 ? '#F43F5E' : '#6366F1'} stopOpacity={0.15}/>
                    <stop offset="95%" stopColor={demoStage === 6 ? '#F43F5E' : '#6366F1'} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" stroke="#475569" fontSize={9} tickLine={false} />
                <YAxis stroke="#475569" fontSize={9} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#090E1A', borderColor: 'rgba(255,255,255,0.05)', fontSize: '10px' }} />
                <Area 
                  type="monotone" 
                  dataKey="latency" 
                  stroke={demoStage === 6 ? '#F43F5E' : '#6366F1'} 
                  strokeWidth={1.5} 
                  fillOpacity={1} 
                  fill="url(#colorLat)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* ========================================================
          RIGHT PANEL: AIOPS INSIGHTS BOARD
          ======================================================== */}
      <div className="lg:col-span-1 space-y-6">
        
        {/* Gemini Diagnostics */}
        <div className="glass-panel p-5 bg-[#070B13]/80 border-white/[0.04]">
          <div className="flex items-center justify-between border-b border-white/[0.03] pb-3 mb-4">
            <span className="text-sm font-bold font-mono uppercase text-text">AI Copilot Analysis</span>
            <span className="h-1.5 w-1.5 rounded-full bg-success shadow-glow-success animate-pulse" />
          </div>

          <div className="space-y-4">
            {demoStage >= 7 ? (
              <div className="space-y-3 animate-in fade-in duration-300">
                <div className="p-3 rounded-lg border border-danger/20 bg-danger/5 text-xs space-y-1.5">
                  <span className="font-bold text-danger flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" /> ROOT CAUSE CLASSIFIED
                  </span>
                  <p className="text-muted text-[10px] leading-relaxed">
                    OutOfMemory (OOM) limits check failed. Target container JVM heap settings exceed resource.limits parameters inside manifest.
                  </p>
                </div>

                <div className="p-3 rounded bg-slate-950/60 border border-white/[0.04] text-[10px] font-mono text-muted space-y-2">
                  <div className="flex justify-between">
                    <span>Confidence Score:</span>
                    <span className="text-text font-bold">98.4%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Estimated Recovery:</span>
                    <span className="text-text font-bold">12 seconds</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Remediation Route:</span>
                    <span className="text-primary-light font-bold">Pod Tag Rollback</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-muted text-xs font-mono">
                AI Diagnostics idle. Waiting for logs anomalies checks...
              </div>
            )}
          </div>
        </div>

        {/* Security Gates widget */}
        <div className="glass-panel p-5 bg-[#070B13]/80 border-white/[0.04]">
          <span className="text-muted text-[9px] font-mono uppercase tracking-wider block mb-1">DevSecOps Compliance</span>
          <h4 className="font-semibold text-xs text-text font-mono">GATES COMPLIANCE STATUS</h4>
          
          <div className="mt-4 space-y-3 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-muted">Sonar Code Quality:</span>
              <span className="text-success font-semibold">Passed (A)</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted">Trivy CVE critical count:</span>
              <span className="text-text font-bold">0</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted">OWASP dependency check:</span>
              <span className="text-success font-semibold">Clean</span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================
          BOTTOM PANEL: REAL-TIME CONSOLE logs
          ======================================================== */}
      <div className="lg:col-span-4 glass-panel p-5 bg-panel/30 border-white/[0.04]">
        <div className="flex items-center justify-between mb-3 border-b border-white/[0.03] pb-2">
          <span className="text-xs font-bold font-mono text-text flex items-center gap-1.5">
            <Terminal className="h-4 w-4 text-primary-light" />
            Global Platform Output Terminal
          </span>
          <span className="text-[10px] text-muted font-mono">Connected over secure WebSockets</span>
        </div>

        <div className="bg-slate-950 p-4 rounded-lg font-mono text-[10px] leading-relaxed text-slate-350 max-h-[160px] overflow-y-auto select-text">
          {demoLogs.length > 0 ? (
            demoLogs.map((log, idx) => (
              <div key={idx} className="mb-0.5">
                {log}
              </div>
            ))
          ) : (
            <div className="text-muted py-2">Waiting for output streams...</div>
          )}
        </div>
      </div>

    </div>
  );
};
