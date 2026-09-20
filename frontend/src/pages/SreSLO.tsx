import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDemo } from '../context/DemoContext';
import { 
  HeartPulse, 
  AlertTriangle, 
  CheckCircle, 
  Sparkles, 
  Activity,
  Plus,
  Loader2
} from 'lucide-react';

interface SloTarget {
  id: string;
  service_name: string;
  metric_type: string;
  slo_target_percentage: string;
  sli_value_current: string;
  error_budget_remaining_percentage: string;
}

interface SreIncident {
  id: string;
  severity: string;
  title: string;
  description: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
  postmortem_report: string | null;
}

interface SelfHealingAction {
  id: string;
  pod_name: string;
  namespace: string;
  anomaly_detected: string;
  action_taken: string;
  status: string;
  created_at: string;
}

export const SreSLO: React.FC = () => {
  const { token } = useAuth();
  const { isDemoMode, demoStage } = useDemo();
  
  const [slos, setSlos] = useState<SloTarget[]>([]);
  const [incidents, setIncidents] = useState<SreIncident[]>([]);
  const [healingActions, setHealingActions] = useState<SelfHealingAction[]>([]);

  // Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [severity, setSeverity] = useState('P2');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Postmortem inspection state
  const [viewingIncident, setViewingIncident] = useState<SreIncident | null>(null);
  const [buildingPostmortem, setBuildingPostmortem] = useState(false);

  const fetchSreData = async () => {
    try {
      const sloRes = await fetch('/api/v1/sre/slo-health', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const incRes = await fetch('/api/v1/sre/incidents', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const healingRes = await fetch('/api/v1/sre/self-healing-actions', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (sloRes.ok) setSlos(await sloRes.json());
      if (incRes.ok) setIncidents(await incRes.json());
      if (healingRes.ok) setHealingActions(await healingRes.json());
    } catch (err) {
      console.error('Failed to load SRE telemetry data', err);
    }
  };

  useEffect(() => {
    fetchSreData();
  }, [token]);

  const handleOpenIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description) return;
    setSubmitting(true);
    try {
      const response = await fetch('/api/v1/sre/incidents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ severity, title, description })
      });
      if (response.ok) {
        setIsModalOpen(false);
        setTitle('');
        setDescription('');
        await fetchSreData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGeneratePostmortem = async (id: string) => {
    if (id === 'demo-incident') {
      setViewingIncident(demoIncidentObj);
      return;
    }
    
    setBuildingPostmortem(true);
    try {
      const response = await fetch(`/api/v1/sre/incidents/${id}/postmortem`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setViewingIncident(data.incident);
        await fetchSreData();
      }
    } catch (err) {
      console.error('Failed to generate postmortem', err);
    } finally {
      setBuildingPostmortem(false);
    }
  };

  const getSeverityColor = (sev: string) => {
    if (sev === 'P1') return 'bg-danger/10 text-danger border-danger/20';
    if (sev === 'P2') return 'bg-warning/10 text-warning border-warning/20';
    return 'bg-primary/10 text-primary border-primary/20';
  };

  // Demo seed data
  const isDemo = isDemoMode;
  
  const demoSloData: SloTarget[] = [
    {
      id: 'slo-1',
      service_name: 'deploymate-api-service',
      metric_type: 'Availability',
      slo_target_percentage: '99.90',
      sli_value_current: (demoStage === 6 || demoStage === 7) ? '94.20' : '99.95',
      error_budget_remaining_percentage: (demoStage === 6 || demoStage === 7) ? '12.45' : '94.80'
    },
    {
      id: 'slo-2',
      service_name: 'deploymate-api-service',
      metric_type: 'Latency (P95)',
      slo_target_percentage: '95.00',
      sli_value_current: (demoStage === 6 || demoStage === 7) ? '72.10' : '98.50',
      error_budget_remaining_percentage: (demoStage === 6 || demoStage === 7) ? '18.20' : '96.20'
    },
    {
      id: 'slo-3',
      service_name: 'deploymate-ui-service',
      metric_type: 'Availability',
      slo_target_percentage: '99.00',
      sli_value_current: '99.98',
      error_budget_remaining_percentage: '99.10'
    },
    {
      id: 'slo-4',
      service_name: 'fastapi-copilot-service',
      metric_type: 'Availability',
      slo_target_percentage: '99.00',
      sli_value_current: '99.90',
      error_budget_remaining_percentage: '98.50'
    }
  ];

  const demoIncidentObj: SreIncident = {
    id: 'demo-incident',
    severity: 'P1',
    title: 'Staging Pod OutOfMemory Crash',
    description: 'OutOfMemory (OOM) limit constraint threshold violated. deploymate-api container process crashed with liveness failures. ExitCode: 137.',
    status: demoStage >= 8 ? 'RESOLVED' : 'OPEN',
    created_at: new Date(Date.now() - 300000).toISOString(),
    resolved_at: demoStage >= 8 ? new Date().toISOString() : null,
    postmortem_report: `### SRE INCIDENT POSTMORTEM REPORT
**Incident Identifier:** INC-90022
**Severity Target:** P1 - Critical Staging Outage
**Microservice Target:** deploymate-api-deployment

**1. Incident Narrative Timeline (UTC):**
- 13:30:10 - Commit sha-8f2a10 pushed. Webhook pipeline compile initialized.
- 13:31:05 - Trivy scan verified. ArgoCD reconciled manifest.
- 13:31:40 - Container limits memory set to 512Mi. JVM heap allocated Xmx768m.
- 13:32:00 - Memory usage spiked to limits threshold under stress queries.
- 13:32:15 - Kernel OOM-killer triggered. Container main exited with ExitCode: 137.
- 13:32:20 - SLO availability dropped to 94.20%. P1 Incident ticket auto-opened.
- 13:32:45 - AI Diagnostics analyzed raw stack traces and classified heap mismatch.
- 13:33:10 - Automated Platform self-healing rollback to git-sha-stable executed.
- 13:33:15 - Stable replicas initialized. Staging status: STABILIZED.

**2. Core Root Cause Analysis:**
Java virtual machine heap allocation parameters (-Xmx768m) exceeded the container limits specifications (limits.memory: "512Mi") inside Kubernetes deployment configurations.

**3. Action Actions / Preventive Actions:**
- Standardize helm chart limits to 1Gi memory limits.
- Integrate resources checks in pipeline audit scans.`
  };

  const demoIncidentsList = demoStage >= 6 ? [demoIncidentObj] : [];

  const demoHealingActions: SelfHealingAction[] = demoStage >= 8 ? [
    {
      id: 'heal-1',
      pod_name: 'deploymate-api-78fa2c-pod1',
      namespace: 'deploymate-staging',
      anomaly_detected: 'Liveness probes failing (CrashLoopBackOff: OOMKilled)',
      action_taken: 'ArgoCD state reconciliation. Rolled back manifest to stable git revision git-sha-stable.',
      status: 'SUCCESS',
      created_at: new Date(Date.now() - 60000).toISOString()
    }
  ] : (demoStage === 7 ? [
    {
      id: 'heal-1',
      pod_name: 'deploymate-api-78fa2c-pod1',
      namespace: 'deploymate-staging',
      anomaly_detected: 'Liveness probes failing (CrashLoopBackOff: OOMKilled)',
      action_taken: 'Anomaly detected. Ingesting error logs and triggering AI diagnostics...',
      status: 'RUNNING',
      created_at: new Date(Date.now() - 30000).toISOString()
    }
  ] : []);

  const activeSlos = isDemo ? demoSloData : slos;
  const activeIncidents = isDemo ? demoIncidentsList : incidents;
  const activeHealingActions = isDemo ? demoHealingActions : healingActions;

  return (
    <div className="space-y-6 text-text select-none animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.04] pb-5">
        <div>
          <h1 className="text-2xl font-bold font-mono flex items-center gap-2">
            <HeartPulse className="h-7 w-7 text-primary" />
            SRE OPERATIONS CENTER
          </h1>
          <p className="text-xs text-muted mt-1">
            Track real-time availability budgets, capture log anomalies, and audit automated self-healing events.
          </p>
        </div>
        
        {!isDemo && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-xs font-semibold font-mono text-white hover:bg-primary-dark transition-all duration-200 shadow-glow"
          >
            <Plus className="h-4 w-4" /> Open SRE Ticket
          </button>
        )}
      </div>

      {/* SLO Gauges */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {activeSlos.map((slo) => {
          const target = parseFloat(slo.slo_target_percentage);
          const current = parseFloat(slo.sli_value_current);
          const budget = parseFloat(slo.error_budget_remaining_percentage);
          const hasBroken = current < target;

          return (
            <div key={slo.id} className="rounded-xl border border-white/[0.04] bg-[#070B13]/60 p-5 relative overflow-hidden">
              <span className="text-muted text-[9px] font-mono uppercase tracking-wider">{slo.metric_type}</span>
              <h4 className="font-semibold text-xs mt-1 text-slate-350 truncate font-mono">{slo.service_name}</h4>
              
              <div className="mt-4 flex items-baseline justify-between font-mono">
                <div>
                  <span className={`text-xl font-bold ${hasBroken ? 'text-danger animate-pulse' : 'text-text'}`}>{current}%</span>
                  <span className="text-[9px] text-muted ml-1.5">SLI (Target: {target}%)</span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-[#05070E] rounded-full h-1 mt-3 overflow-hidden border border-white/[0.02]">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${hasBroken ? 'bg-danger shadow-glow-danger' : 'bg-success'}`}
                  style={{ width: `${Math.max(10, Math.min(100, current))}%` }}
                />
              </div>

              <div className="mt-3 flex justify-between items-center text-[9px] font-mono">
                <span className="text-muted">Error Budget Left:</span>
                <span className={`font-bold ${budget < 30 ? 'text-danger animate-pulse' : 'text-success'}`}>{budget}%</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main SRE Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left Column: Incidents List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-white/[0.04] bg-[#070B13]/60 p-6">
            <h3 className="text-xs font-bold font-mono text-slate-350 uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <AlertTriangle className="h-4.5 w-4.5 text-warning" />
              SRE Incident Tickets Registry
            </h3>

            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {activeIncidents.length > 0 ? (
                activeIncidents.map((inc) => (
                  <div key={inc.id} className="p-4 rounded-lg border border-white/[0.03] bg-slate-950/20 space-y-3">
                    <div className="flex flex-wrap justify-between items-start gap-2 select-none">
                      <div className="flex items-center gap-2">
                        <span className={`border px-2 py-0.5 rounded text-[9px] font-mono font-bold ${getSeverityColor(inc.severity)}`}>
                          {inc.severity}
                        </span>
                        <h4 className="font-semibold text-xs text-text font-mono">{inc.title}</h4>
                      </div>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-mono font-bold ${
                        inc.status === 'RESOLVED' ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${inc.status === 'RESOLVED' ? 'bg-success' : 'bg-warning animate-pulse'}`} />
                        {inc.status}
                      </span>
                    </div>

                    <p className="text-muted text-xs leading-relaxed font-mono select-text">{inc.description}</p>

                    <div className="flex justify-between items-center text-[9px] text-muted border-t border-white/[0.03] pt-3 font-mono">
                      <span>Opened: {new Date(inc.created_at).toLocaleString()}</span>
                      
                      <div className="flex gap-2">
                        {inc.postmortem_report ? (
                          <button
                            onClick={() => handleGeneratePostmortem(inc.id)}
                            className="text-primary hover:underline font-semibold flex items-center gap-0.5"
                          >
                            View Postmortem <CheckCircle className="h-3 w-3 text-success" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleGeneratePostmortem(inc.id)}
                            disabled={buildingPostmortem}
                            className="text-primary hover:underline font-semibold flex items-center gap-1"
                          >
                            {buildingPostmortem ? (
                              <>
                                <Loader2 className="h-3 w-3 animate-spin" /> Compiling SRE Postmortem...
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-3 w-3 text-primary animate-pulse" /> AI Postmortem
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 text-muted text-xs font-mono select-none">
                  No active SRE incidents registered. System healthy.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Self-Healing Audit Logs */}
        <div className="rounded-xl border border-white/[0.04] bg-[#070B13]/60 p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold font-mono text-slate-350 uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <Activity className="h-4.5 w-4.5 text-success" />
              Self-Healing Actions Audit
            </h3>
            <p className="text-muted text-[11px] font-mono leading-relaxed mb-4">
              Audits of platform self-healing actions executed dynamically on Kubernetes pod targets.
            </p>

            <div className="space-y-3 overflow-y-auto max-h-[450px] pr-1">
              {activeHealingActions.length > 0 ? (
                activeHealingActions.map((act) => (
                  <div key={act.id} className="p-3 bg-slate-950/40 rounded border border-white/[0.03] text-xs space-y-2">
                    <div className="flex justify-between font-mono">
                      <span className="text-primary-light font-bold text-[9px] truncate max-w-[150px]">{act.pod_name}</span>
                      <span className={`font-bold font-mono text-[9px] ${act.status === 'SUCCESS' ? 'text-success' : 'text-primary animate-pulse'}`}>
                        {act.status}
                      </span>
                    </div>
                    <div className="text-text text-[10px] font-mono">
                      <span className="text-muted block text-[8px] uppercase">Anomaly Trigger</span> 
                      {act.anomaly_detected}
                    </div>
                    <div className="text-text text-[10px] font-mono bg-slate-950 p-2.5 rounded text-slate-300 border border-white/[0.02]">
                      <span className="text-muted block text-[8px] uppercase mb-1">Mitigation Action Taken</span>
                      {act.action_taken}
                    </div>
                    <div className="text-[8px] text-muted text-right font-mono">
                      {new Date(act.created_at).toLocaleString()}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 text-muted text-xs font-mono select-none">
                  No healing events audited.
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Incident Postmortem Modal View */}
      {viewingIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-panel border border-white/[0.05] rounded-xl shadow-glow overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-white/[0.04] bg-slate-900/60 select-none">
              <h3 className="text-xs font-bold font-mono flex items-center gap-1.5">
                <Sparkles className="h-4.5 w-4.5 text-primary-light animate-pulse" />
                AI Postmortem Analysis: {viewingIncident.title}
              </h3>
              <button
                onClick={() => setViewingIncident(null)}
                className="text-muted hover:text-text font-mono text-[10px] border border-white/[0.04] rounded px-2 py-1 bg-slate-950 uppercase"
              >
                Close
              </button>
            </div>
            <div className="p-6 overflow-y-auto text-xs leading-relaxed font-mono whitespace-pre-wrap text-slate-350 bg-[#05070E] select-text">
              {viewingIncident.postmortem_report}
            </div>
          </div>
        </div>
      )}

      {/* Manual SRE incident creator modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-panel border border-white/[0.05] rounded-xl shadow-glow overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-white/[0.04] bg-slate-900/60 select-none">
              <h3 className="text-xs font-bold font-mono uppercase">Register SRE incident ticket</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-muted hover:text-text text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleOpenIncident} className="p-6 space-y-4 font-mono text-xs">
              <div>
                <label className="block text-[9px] text-muted mb-1 uppercase">Severity Category</label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                  className="w-full bg-[#05070E] border border-white/[0.04] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-text font-mono"
                >
                  <option value="P1">P1 - Critical Outage (Triggers Self-Healing)</option>
                  <option value="P2">P2 - Significant Degradation</option>
                  <option value="P3">P3 - Minor Incident</option>
                  <option value="P4">P4 - Low Priority Alarm</option>
                </select>
              </div>

              <div>
                <label className="block text-[9px] text-muted mb-1 uppercase">Incident Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Describe incident trigger..."
                  className="w-full bg-[#05070E] border border-white/[0.04] rounded-lg px-3 py-2 text-xs text-text focus:outline-none focus:border-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-[9px] text-muted mb-1 uppercase">Incident Log Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Paste error dump or log anomaly snippet..."
                  className="w-full bg-[#05070E] border border-white/[0.04] rounded-lg p-3 text-xs text-text focus:outline-none focus:border-primary leading-relaxed"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 select-none font-sans">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-white/[0.04] rounded-lg text-xs hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary-dark transition-all duration-200"
                >
                  {submitting ? 'Creating ticket...' : 'Open SRE Incident'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
