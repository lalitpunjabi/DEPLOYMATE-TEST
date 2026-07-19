import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  FileCode, 
  Play, 
  Terminal, 
  CheckCircle, 
  Lock, 
  Sparkles, 
  Database,
  ArrowRight,
  Code
} from 'lucide-react';

interface TerraformState {
  id: string;
  stack_name: string;
  configuration_code: string;
  last_action: string;
  last_status: string;
  logs: string;
  updated_at: string;
}

export const Terraform: React.FC = () => {
  const { token, user } = useAuth();
  const [projectId] = useState('p1');
  const [stackName, setStackName] = useState('aws-s3-secure-bucket');
  const [prompt, setPrompt] = useState('Create an AWS S3 bucket with KMS encryption, versioning, and private ACL enabled in us-west-2 region.');
  const [hclCode, setHclCode] = useState('');
  const [generating, setGenerating] = useState(false);
  const [running, setRunning] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState('');
  const [states, setStates] = useState<TerraformState[]>([]);
  const [activeStateId, setActiveStateId] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  const fetchStates = async () => {
    try {
      const response = await fetch(`http://localhost:5000/api/v1/terraform/states?projectId=${projectId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setStates(data);
      }
    } catch (err) {
      console.error('Failed to load Terraform states', err);
    }
  };

  useEffect(() => {
    fetchStates();
  }, [token]);

  const handleGenerate = async () => {
    if (!prompt) return;
    setGenerating(true);
    try {
      const response = await fetch('http://localhost:5000/api/v1/terraform/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ prompt })
      });
      if (response.ok) {
        const data = await response.json();
        setHclCode(data.configuration_code);
      }
    } catch (err) {
      console.error('Error generating IaC', err);
    } finally {
      setGenerating(false);
    }
  };

  const handlePlan = async () => {
    if (!hclCode || !stackName) return;
    setRunning(true);
    setIsLocked(true);
    setConsoleLogs('[terraform init] Initializing provider plugins...\n');
    try {
      const response = await fetch('http://localhost:5000/api/v1/terraform/plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ project_id: projectId, stack_name: stackName, configuration_code: hclCode })
      });
      if (response.ok) {
        const data = await response.json();
        setConsoleLogs(data.state.logs);
        setActiveStateId(data.state.id);
        await fetchStates();
      }
    } catch (err) {
      setConsoleLogs((prev) => prev + '\n[ERROR] Terraform Plan failed to run.');
    } finally {
      setRunning(false);
      setIsLocked(false);
    }
  };

  const handleApply = async () => {
    if (!activeStateId) return;
    setRunning(true);
    setIsLocked(true);
    setConsoleLogs((prev) => prev + '\n\n[terraform apply] Acquiring state lock inside Postgres...\n');
    try {
      const response = await fetch('http://localhost:5000/api/v1/terraform/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ id: activeStateId, user_id: user?.id })
      });
      if (response.ok) {
        const data = await response.json();
        setConsoleLogs(data.state.logs);
        await fetchStates();
      }
    } catch (err) {
      setConsoleLogs((prev) => prev + '\n\n[ERROR] Terraform Apply failed.');
    } finally {
      setRunning(false);
      setIsLocked(false);
    }
  };

  const loadHistoricalState = (st: TerraformState) => {
    setStackName(st.stack_name);
    setHclCode(st.configuration_code);
    setConsoleLogs(st.logs);
    setActiveStateId(st.id);
  };

  return (
    <div className="space-y-6 text-text animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileCode className="h-7 w-7 text-primary" />
            Infrastructure as Code (Terraform)
          </h1>
          <p className="text-muted text-sm mt-1">
            Programmatically design, compile with Gemini AI, and safely apply Terraform cloud state stacks.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isLocked ? (
            <span className="flex items-center gap-1 text-xs text-danger border border-danger/20 bg-danger/5 px-2.5 py-1 rounded-full font-mono font-medium animate-pulse">
              <Lock className="h-3.5 w-3.5" /> STATE LOCK ACTIVE
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-success border border-success/20 bg-success/5 px-2.5 py-1 rounded-full font-mono font-medium">
              <CheckCircle className="h-3.5 w-3.5" /> STATE AVAILABLE
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left pane: Generator Form & Stack Config */}
        <div className="lg:col-span-1 space-y-6">
          <div className="rounded-xl border border-border bg-panel/40 p-5 backdrop-blur-md space-y-4">
            <h3 className="text-base font-semibold flex items-center gap-1.5">
              <Sparkles className="h-4.5 w-4.5 text-primary" />
              AI Prompt Compiler
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-muted font-mono mb-1">Stack/Resource Name</label>
                <input
                  type="text"
                  value={stackName}
                  onChange={(e) => setStackName(e.target.value)}
                  placeholder="e.g. secure-s3-bucket"
                  className="w-full bg-slate-900 border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-primary font-mono"
                />
              </div>

              <div>
                <label className="block text-xs text-muted font-mono mb-1">Infrastructure Prompt</label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={4}
                  placeholder="Describe the cloud configuration you wish to build..."
                  className="w-full bg-slate-900 border border-border rounded-lg p-3 text-xs text-text focus:outline-none focus:border-primary leading-relaxed"
                />
              </div>

              <button
                onClick={handleGenerate}
                disabled={generating}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-primary/20 border border-primary/40 px-4 py-2.5 text-xs font-semibold text-primary hover:bg-primary/30 transition-all duration-200"
              >
                {generating ? 'Compiling HCL...' : 'Generate HCL Code'}
                <Sparkles className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Stacks Registry */}
          <div className="rounded-xl border border-border bg-panel/40 p-5 backdrop-blur-md">
            <h3 className="text-base font-semibold mb-3 flex items-center gap-1.5">
              <Database className="h-4.5 w-4.5 text-secondary" />
              Stack State Registry
            </h3>

            <div className="space-y-2 max-h-[250px] overflow-y-auto">
              {states.length > 0 ? (
                states.map((st) => (
                  <div
                    key={st.id}
                    onClick={() => loadHistoricalState(st)}
                    className={`p-3 rounded-lg border text-left cursor-pointer transition-all duration-200 ${
                      activeStateId === st.id 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border/60 hover:border-border bg-slate-900/40'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-mono text-xs font-bold text-text truncate max-w-[150px] block">
                        {st.stack_name}
                      </span>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                        st.last_status === 'SUCCESS' ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'
                      }`}>
                        {st.last_action}: {st.last_status}
                      </span>
                    </div>
                    <div className="mt-2 text-[10px] text-muted flex justify-between">
                      <span>Updated: {new Date(st.updated_at).toLocaleDateString()}</span>
                      <span className="text-primary hover:underline flex items-center gap-0.5">
                        Inspect <ArrowRight className="h-2.5 w-2.5" />
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-muted text-xs py-6">
                  No states generated yet.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right pane: Code Editor Gutter and Console logs */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* HCL Editor */}
          <div className="rounded-xl border border-border bg-panel/40 p-5 backdrop-blur-md flex flex-col min-h-[350px]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-semibold flex items-center gap-1.5">
                <Code className="h-5 w-5 text-primary-light" />
                Terraform Configuration Workspace (main.tf)
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={handlePlan}
                  disabled={running || !hclCode}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 text-text border border-border text-xs rounded-lg font-semibold hover:bg-slate-750 transition-colors disabled:opacity-50"
                >
                  <Play className="h-3 w-3" /> Dry-Run Plan
                </button>
                <button
                  onClick={handleApply}
                  disabled={running || !activeStateId}
                  className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white text-xs rounded-lg font-semibold hover:bg-primary-dark transition-all duration-200 disabled:opacity-50 shadow-glow"
                >
                  <CheckCircle className="h-3 w-3" /> Apply State
                </button>
              </div>
            </div>

            <div className="flex-1 bg-slate-950/80 border border-border/80 rounded-lg p-4 font-mono text-xs leading-relaxed text-slate-350 min-h-[220px]">
              {hclCode ? (
                <pre className="whitespace-pre-wrap">{hclCode}</pre>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-muted gap-2 py-10">
                  <FileCode className="h-10 w-10 text-muted opacity-30" />
                  <span className="text-center text-xs">HCL config is blank. Generate code using the AI Prompt Compiler or select a stack from the registry.</span>
                </div>
              )}
            </div>
          </div>

          {/* Console Output */}
          <div className="rounded-xl border border-border bg-panel/40 p-5 backdrop-blur-md">
            <h3 className="text-base font-semibold mb-3 flex items-center gap-1.5">
              <Terminal className="h-4.5 w-4.5 text-secondary" />
              Terraform Execution Output Stream
            </h3>

            <div className="bg-slate-950 rounded-lg p-4 font-mono text-[11px] leading-relaxed text-slate-300 border border-border/60 min-h-[150px] max-h-[250px] overflow-y-auto">
              {consoleLogs ? (
                <pre className="whitespace-pre-wrap">{consoleLogs}</pre>
              ) : (
                <div className="text-center text-muted py-6 flex flex-col items-center justify-center h-full gap-1">
                  <Terminal className="h-5 w-5 opacity-40" />
                  <span>Execution logs will stream here during Plan/Apply processes...</span>
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
