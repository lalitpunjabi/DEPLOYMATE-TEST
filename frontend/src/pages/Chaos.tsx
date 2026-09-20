import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Flame, 
  Play, 
  Terminal, 
  CheckCircle, 
  AlertTriangle, 
  RefreshCw, 
  Activity, 
  ShieldAlert,
  Server,
  Layers,
  ArrowRight
} from 'lucide-react';

interface ChaosExperiment {
  id: string;
  name: string;
  scenario_type: string;
  target_resource: string;
  duration_seconds: number;
  status: string;
  resilience_score: number;
  report_json: {
    execution_log: string[];
    findings: string;
    resilience_indicators: {
      http_availability: string;
      avg_latency_ms: string;
    };
  };
  executed_at: string;
}

export const Chaos: React.FC = () => {
  const { token } = useAuth();
  const [experiments, setExperiments] = useState<ChaosExperiment[]>([]);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Form State
  const [experimentName, setExperimentName] = useState('canary-pod-kill-test');
  const [scenarioType, setScenarioType] = useState('POD_KILL');
  const [targetResource, setTargetResource] = useState('deploymate-api-deployment');
  const [duration, setDuration] = useState(30);

  // active inspection report state
  const [selectedExperiment, setSelectedExperiment] = useState<ChaosExperiment | null>(null);

  const fetchChaosHistory = async () => {
    try {
      const response = await fetch('/api/v1/chaos/history', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setExperiments(data);
        if (data.length > 0 && !selectedExperiment) {
          setSelectedExperiment(data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load chaos history', err);
    }
  };

  useEffect(() => {
    fetchChaosHistory();
  }, [token]);

  const handleInject = async (e: React.FormEvent) => {
    e.preventDefault();
    setRunning(true);
    setMessage(null);
    try {
      const response = await fetch('/api/v1/chaos/inject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: experimentName,
          scenario_type: scenarioType,
          target_resource: targetResource,
          duration_seconds: duration
        })
      });

      if (response.ok) {
        const data = await response.json();
        setMessage(`Chaos Monkey stress agent successfully injected into target pod.`);
        setSelectedExperiment(data.experiment);
        await fetchChaosHistory();
      }
    } catch (err) {
      setMessage('Failed to register chaos injection command.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6 text-text animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Flame className="h-7 w-7 text-primary" />
            Chaos Monkey Resilience Injector
          </h1>
          <p className="text-muted text-sm mt-1">
            Evaluate cluster durability and SLO recovery patterns by scheduling CPU, network, or pod-termination failure scenarios.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {running ? (
            <span className="flex items-center gap-1.5 text-xs text-warning border border-warning/20 bg-warning/5 px-3 py-1.5 rounded-full font-mono font-medium animate-pulse">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" /> INJECTING FAILURE STRESSORS...
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-muted border border-border bg-slate-900/40 px-3 py-1.5 rounded-full font-mono font-medium">
              <Server className="h-3.5 w-3.5 text-success" /> SYSTEM RESTORED
            </span>
          )}
        </div>
      </div>

      {/* Message Banner */}
      {message && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm text-primary flex items-center gap-2">
          <CheckCircle className="h-5 w-5" />
          <span>{message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Form Settings */}
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-panel/40 p-5 backdrop-blur-md">
            <h3 className="text-base font-semibold mb-4 flex items-center gap-1.5">
              <ShieldAlert className="h-5 w-5 text-primary" />
              Schedule Stressor
            </h3>

            <form onSubmit={handleInject} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-muted mb-1">Experiment Name</label>
                <input
                  type="text"
                  value={experimentName}
                  onChange={(e) => setExperimentName(e.target.value)}
                  className="w-full bg-slate-900 border border-border rounded-lg px-3 py-2 text-xs text-text focus:outline-none focus:border-primary font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-muted mb-1">Stressor Scenario</label>
                <select
                  value={scenarioType}
                  onChange={(e) => setScenarioType(e.target.value)}
                  className="w-full bg-slate-900 border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-text font-mono"
                >
                  <option value="POD_KILL">POD_KILL (Delete random pod replicas)</option>
                  <option value="CPU_STRESS">CPU_STRESS (Consume 100% compute threads)</option>
                  <option value="NETWORK_DELAY">NETWORK_DELAY (Inject 150ms network latency)</option>
                  <option value="NODE_FAILURE">NODE_FAILURE (Simulate cluster node dropout)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono text-muted mb-1">Target Deployment Resource</label>
                <input
                  type="text"
                  value={targetResource}
                  onChange={(e) => setTargetResource(e.target.value)}
                  className="w-full bg-slate-900 border border-border rounded-lg px-3 py-2 text-xs text-text focus:outline-none focus:border-primary font-mono"
                  required
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-mono text-muted mb-1">
                  <span>Stress Duration</span>
                  <span>{duration} seconds</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="120"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>

              <button
                type="submit"
                disabled={running}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-xs font-semibold text-white hover:bg-primary-dark transition-all duration-200 shadow-glow disabled:opacity-50"
              >
                <Play className="h-4 w-4" /> Inject Simulated Faults
              </button>
            </form>
          </div>

          {/* Resilience History selector */}
          <div className="rounded-xl border border-border bg-panel/40 p-5 backdrop-blur-md">
            <h3 className="text-base font-semibold mb-3 flex items-center gap-1.5">
              <Layers className="h-4.5 w-4.5 text-secondary" />
              Experiments Audits
            </h3>
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {experiments.length > 0 ? (
                experiments.map((exp) => (
                  <div
                    key={exp.id}
                    onClick={() => setSelectedExperiment(exp)}
                    className={`p-3 rounded-lg border text-left cursor-pointer transition-all duration-200 ${
                      selectedExperiment?.id === exp.id 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border/60 hover:border-border bg-slate-900/40'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-xs font-bold text-text truncate max-w-[150px]">{exp.name}</span>
                      <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full ${
                        exp.resilience_score > 85 ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'
                      }`}>
                        Score: {exp.resilience_score}%
                      </span>
                    </div>
                    <div className="mt-2 text-[10px] text-muted flex justify-between">
                      <span>Scenario: {exp.scenario_type}</span>
                      <span className="text-primary hover:underline flex items-center gap-0.5">
                        Inspect <ArrowRight className="h-2.5 w-2.5" />
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-muted text-xs font-mono">
                  No chaos audits found.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Columns: Inspection Details */}
        <div className="lg:col-span-2 space-y-6">
          {selectedExperiment ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Telemetry Report */}
              <div className="rounded-xl border border-border bg-panel/40 p-5 backdrop-blur-md flex flex-col justify-between">
                <div>
                  <h3 className="text-base font-semibold mb-4 flex items-center gap-1">
                    <Activity className="h-5 w-5 text-primary-light" />
                    Experiment Diagnostic Report
                  </h3>

                  <div className="space-y-4">
                    <div className="p-4 bg-slate-950/60 rounded-lg border border-border/80 space-y-3">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted">Target Resource:</span>
                        <span className="font-mono text-text">{selectedExperiment.target_resource}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted">Stressor Type:</span>
                        <span className="font-mono text-text">{selectedExperiment.scenario_type}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted">Duration Limit:</span>
                        <span className="font-mono text-text">{selectedExperiment.duration_seconds} seconds</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-slate-900/60 rounded-lg border border-border text-center">
                        <div className="text-muted text-[10px] uppercase font-mono tracking-wider">Availability</div>
                        <div className="text-lg font-bold mt-1 text-success">
                          {selectedExperiment.report_json?.resilience_indicators?.http_availability || '100%'}
                        </div>
                      </div>
                      <div className="p-3 bg-slate-900/60 rounded-lg border border-border text-center">
                        <div className="text-muted text-[10px] uppercase font-mono tracking-wider">Avg Latency</div>
                        <div className="text-lg font-bold mt-1 text-slate-200">
                          {selectedExperiment.report_json?.resilience_indicators?.avg_latency_ms || '45ms'}
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-900/30 rounded-lg border border-border text-xs leading-relaxed">
                      <div className="font-semibold text-text mb-1 flex items-center gap-1">
                        <CheckCircle className="h-4 w-4 text-success" />
                        Monkey Findings Summary
                      </div>
                      <span className="text-muted">{selectedExperiment.report_json?.findings}</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-border/60 pt-4 mt-6 text-xs text-muted flex justify-between">
                  <span>Status: COMPLETED</span>
                  <span>Executed: {new Date(selectedExperiment.executed_at).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Stressor Logs */}
              <div className="rounded-xl border border-border bg-panel/40 p-5 backdrop-blur-md flex flex-col justify-between">
                <div>
                  <h3 className="text-base font-semibold mb-3 flex items-center gap-1.5">
                    <Terminal className="h-4.5 w-4.5 text-secondary" />
                    Monkey Execution Console
                  </h3>
                  <div className="bg-slate-950 rounded-lg p-4 font-mono text-[10px] leading-relaxed text-slate-350 border border-border/80 min-h-[260px] max-h-[300px] overflow-y-auto">
                    {selectedExperiment.report_json?.execution_log?.map((log, idx) => (
                      <div key={idx} className="mb-1 text-slate-300">
                        {log}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          ) : (
            <div className="rounded-xl border border-border bg-panel/40 p-10 backdrop-blur-md text-center text-muted text-xs flex flex-col items-center justify-center gap-2">
              <AlertTriangle className="h-8 w-8 text-muted opacity-40 animate-pulse" />
              <span>Select an experiment run from the audit registry or schedule a new chaos injection target.</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
