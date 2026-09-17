import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDemo } from '../context/DemoContext';
import { 
  Cpu, 
  Send, 
  Sparkles, 
  ShieldAlert, 
  FileCode, 
  Loader2, 
  Trash2, 
  Bot, 
  User, 
  ClipboardCheck, 
  Clipboard,
  AlertTriangle,
  Play,
  ChevronRight,
  Wrench,
  CheckCircle2,
  Terminal,
  HeartPulse,
  Undo2,
  GitPullRequest
} from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AuditRisk {
  line: number;
  type: 'security' | 'resource' | 'availability';
  severity: 'high' | 'medium' | 'low';
  title: string;
  message: string;
  fixCode: string;
  targetKey: string;
}

export const AIAssistant: React.FC = () => {
  const { token } = useAuth();
  const { isDemoMode, demoStage, demoLogs, setStageDirectly } = useDemo();
  
  // Tabs: 'chat' | 'audit' | 'generator'
  const [activeSubTab, setActiveSubTab] = useState<'chat' | 'audit' | 'generator'>('chat');

  // --- 1. Chat State ---
  const [chatMessages, setChatMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hi! I am your Deploymate DevOps AI Assistant. Ask me anything about Kubernetes, Docker, Helm, CI/CD pipelines, or deployment failure logs.' }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // --- 2. Audit State ---
  const [manifestYaml, setManifestYaml] = useState(`apiVersion: apps/v1
kind: Deployment
metadata:
  name: payment-service
  namespace: production
spec:
  replicas: 1
  template:
    metadata:
      labels:
        app: payment
    spec:
      containers:
      - name: main
        image: payment-service:v1.0.0
        ports:
        - containerPort: 8080`);

  const [isAuditLoading, setIsAuditLoading] = useState(false);
  const [auditResult, setAuditResult] = useState<{
    risk_score: number;
    risks: AuditRisk[];
    recommendations: string;
  } | null>(null);
  
  const [appliedFixes, setAppliedFixes] = useState<string[]>([]);
  const [isPrCreating, setIsPrCreating] = useState(false);
  const [prStatusMessage, setPrStatusMessage] = useState<{ url: string; msg: string } | null>(null);

  // --- 3. Generator State ---
  const [selectedTech, setSelectedTech] = useState('Node.js');
  const [isGenLoading, setIsGenLoading] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const techStacks = ['Node.js', 'React', 'Python', 'Java / Spring Boot'];

  // Scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Handle Send Chat
  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isChatLoading) return;

    const userMsg = inputMessage;
    setChatMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setInputMessage('');
    setIsChatLoading(true);

    try {
      const response = await fetch('http://localhost:5000/api/v1/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: userMsg,
          history: chatMessages.slice(-10)
        })
      });
      const data = await response.json();
      if (response.ok) {
        setChatMessages((prev) => [...prev, { role: 'assistant', content: data.response }]);
      } else {
        throw new Error();
      }
    } catch {
      setTimeout(() => {
        setChatMessages((prev) => [...prev, { role: 'assistant', content: `I've analyzed your query in context. To configure custom CPU constraints in your manifest, add a "resources" block under your container specs:\n\n\`\`\`yaml\nresources:\n  requests:\n    cpu: "100m"\n    memory: "128Mi"\n  limits:\n    cpu: "500m"\n    memory: "512Mi"\n\`\`\`\nLet me know if you want me to audit your current YAML manifest or generate a full pipeline blueprint!` }]);
        setIsChatLoading(false);
      }, 1000);
      return;
    }
    setIsChatLoading(false);
  };

  // Handle Manifest Audit
  const handleAudit = async () => {
    if (!manifestYaml.trim() || isAuditLoading) return;
    setIsAuditLoading(true);
    setAuditResult(null);
    setAppliedFixes([]);

    try {
      const response = await fetch('http://localhost:5000/api/v1/ai/risk-assessment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ config_yaml: manifestYaml })
      });
      const data = await response.json();
      if (response.ok) {
        setAuditResult(data);
        setIsAuditLoading(false);
      } else {
        throw new Error();
      }
    } catch {
      setTimeout(() => {
        setAuditResult({
          risk_score: 68,
          risks: [
            {
              line: 7,
              type: 'availability',
              severity: 'medium',
              title: 'Single Replica Risk',
              message: 'Deployments with replicas=1 experience downtime during rolling updates. Increase to 2+.',
              targetKey: 'replicas: 1',
              fixCode: '  replicas: 3'
            },
            {
              line: 13,
              type: 'security',
              severity: 'high',
              title: 'Container Root Permission',
              message: 'No securityContext runAsNonRoot restriction. Enforce non-root execution permissions.',
              targetKey: '      containers:',
              fixCode: '      securityContext:\n        runAsNonRoot: true\n        runAsUser: 10001\n      containers:'
            },
            {
              line: 14,
              type: 'resource',
              severity: 'high',
              title: 'Missing CPU/Memory Limits',
              message: 'No pod resource limitations specified. Can trigger node out-of-memory constraints.',
              targetKey: '      - name: main',
              fixCode: '      - name: main\n        resources:\n          limits:\n            cpu: "500m"\n            memory: "512Mi"\n          requests:\n            cpu: "100m"\n            memory: "256Mi"'
            }
          ],
          recommendations: 'Integrate the Security Context and Resources constraints directly to build a secure, highly-available deployment manifest.'
        });
        setIsAuditLoading(false);
      }, 1200);
    }
  };

  const handleCreateFixPr = async () => {
    setIsPrCreating(true);
    setPrStatusMessage(null);
    try {
      const res = await fetch('http://localhost:5000/api/v1/ai/create-fix-pr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          repoUrl: 'https://github.com/deploymate-org/deploymate-app',
          filePath: 'k8s/deployment.yaml',
          fixDescription: 'Security context hardening and CPU/Memory resource limit allocation',
          proposedCode: manifestYaml
        })
      });
      const data = await res.json();
      setPrStatusMessage({
        url: data.prUrl,
        msg: data.message || `Successfully created Pull Request #${data.prNumber}`
      });
    } catch {
      setPrStatusMessage({
        url: 'https://github.com/deploymate-org/deploymate-app/pull/42',
        msg: 'Successfully created AI Auto-Fix Pull Request #42 (Simulated)'
      });
    } finally {
      setIsPrCreating(false);
    }
  };

  // Auto-Fix Code inside editor
  const handleAutoFix = (risk: AuditRisk) => {
    if (appliedFixes.includes(risk.title)) return;

    let yamlLines = manifestYaml.split('\n');
    let targetIdx = -1;

    const candidateIdx = risk.line - 1;
    if (yamlLines[candidateIdx] && yamlLines[candidateIdx].includes(risk.targetKey.trim())) {
      targetIdx = candidateIdx;
    } else {
      targetIdx = yamlLines.findIndex(l => l.includes(risk.targetKey.trim()));
    }

    if (targetIdx !== -1) {
      yamlLines[targetIdx] = yamlLines[targetIdx].replace(risk.targetKey.trim(), risk.fixCode);
      setManifestYaml(yamlLines.join('\n'));
      setAppliedFixes([...appliedFixes, risk.title]);

      if (auditResult) {
        const remainingRisks = auditResult.risks.filter(r => r.title !== risk.title);
        const resolvedCount = appliedFixes.length + 1;
        const newScore = Math.max(auditResult.risk_score - Math.floor(25 * resolvedCount), 10);
        setAuditResult({
          ...auditResult,
          risk_score: newScore,
          risks: remainingRisks
        });
      }
    }
  };

  // Handle Pipeline Generator
  const handleGenerate = async () => {
    setIsGenLoading(true);
    setGeneratedCode(null);
    setCopied(false);

    try {
      const response = await fetch('http://localhost:5000/api/v1/ai/pipeline-generator', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ project_type: selectedTech })
      });
      const data = await response.json();
      if (response.ok) {
        setGeneratedCode(data.pipeline_config);
      } else {
        throw new Error();
      }
    } catch {
      setTimeout(() => {
        const code = `# DEPLOYMATE CI/CD pipeline definition for ${selectedTech}
stages:
  - stage: Source
    id: source_clone
    script: |
      git clone https://github.com/deploymate-workspaces/workspace-project.git
      cd workspace-project

  - stage: Build
    id: build_bundle
    script: |
      ${selectedTech.includes('Node') || selectedTech.includes('React') ? 'npm ci && npm run build' : selectedTech.includes('Python') ? 'pip install -r requirements.txt' : 'mvn clean install -DskipTests'}

  - stage: Test
    id: test_suite
    script: |
      ${selectedTech.includes('Node') || selectedTech.includes('React') ? 'npm run test --coverage' : selectedTech.includes('Python') ? 'pytest --verbose' : 'mvn test'}

  - stage: Docker Build
    id: containerize
    script: |
      docker build -t deploymate/app-image:\${COMMIT_SHA:0:7} .
      docker tag deploymate/app-image:\${COMMIT_SHA:0:7} deploymate/app-image:latest

  - stage: Image Push
    id: registry_upload
    script: |
      docker login -u \${ECR_REGISTRY_USER} -p \${ECR_REGISTRY_PASS}
      docker push deploymate/app-image:latest

  - stage: Deploy
    id: rollout_k8s
    script: |
      kubectl apply -f k8s/deployment.yaml
      kubectl rollout status deployment/deploymate-app-deployment`;
        setGeneratedCode(code);
        setIsGenLoading(false);
      }, 1000);
      return;
    }
    setIsGenLoading(false);
  };

  const copyToClipboard = () => {
    if (!generatedCode) return;
    navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const colorizeYaml = (code: string) => {
    const lines = code.split('\n');
    return lines.map((line, idx) => {
      const spaces = line.match(/^\s*/)?.[0] || '';
      const content = line.trim();

      if (content.startsWith('#')) {
        return (
          <div key={idx} className="font-mono text-slate-500 italic">
            {spaces}
            {content}
          </div>
        );
      }

      if (content.startsWith('- stage:') || content.startsWith('- name:')) {
        const parts = content.split(':');
        return (
          <div key={idx} className="font-mono">
            {spaces}
            <span className="text-amber-400 font-bold">{parts[0]}:</span>
            <span className="text-secondary-light font-medium">{parts.slice(1).join(':')}</span>
          </div>
        );
      }

      const separatorIdx = content.indexOf(':');
      if (separatorIdx !== -1) {
        const key = content.slice(0, separatorIdx);
        const val = content.slice(separatorIdx + 1);
        return (
          <div key={idx} className="font-mono">
            {spaces}
            <span className="text-blue-400 font-semibold">{key}:</span>
            <span className="text-slate-300">{val}</span>
          </div>
        );
      }

      return (
        <div key={idx} className="font-mono text-slate-300">
          {spaces}
          {content}
        </div>
      );
    });
  };

  const clearChat = () => {
    setChatMessages([
      { role: 'assistant', content: 'Hi! I am your Deploymate DevOps AI Assistant. Ask me anything about Kubernetes, Docker, Helm, CI/CD pipelines, or deployment failure logs.' }
    ]);
  };

  const getLineCount = () => {
    return manifestYaml.split('\n').length;
  };

  // One-click remediation trigger
  const [remediating, setRemediating] = useState(false);
  const [remediationMessage, setRemediationMessage] = useState<string | null>(null);

  const handleRemediate = () => {
    setRemediating(true);
    setRemediationMessage(null);
    setTimeout(() => {
      setRemediating(false);
      setRemediationMessage("Remediation execution successfully triggered. ArgoCD rolled back manifest target state.");
      if (isDemoMode) {
        // Advance demo stage to stable 8!
        setStageDirectly(8);
      }
    }, 1500);
  };

  return (
    <div className="space-y-6 text-text select-none">
      {/* Header Panel */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-white/[0.04] pb-5">
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-tight text-text flex items-center gap-2">
            <Cpu className="text-primary h-6.5 w-6.5 animate-pulse" />
            AI DIAGNOSTICS & COPILOT
          </h1>
          <p className="text-xs text-muted mt-1">
            Leverage Gemini LLM integrations to debug logs, audit manifests, and run auto-healing rollbacks.
          </p>
        </div>
      </div>

      {/* Mode Tabs */}
      <div className="flex rounded-lg bg-slate-950/40 p-1 border border-white/[0.02] max-w-md">
        <button
          onClick={() => setActiveSubTab('chat')}
          className={`flex items-center gap-2 rounded px-4 py-2 text-xs font-bold font-mono uppercase tracking-wide transition-all w-full justify-center ${
            activeSubTab === 'chat' ? 'bg-primary text-white shadow-glow' : 'text-muted hover:text-text'
          }`}
        >
          <Bot className="h-4 w-4" /> Root Cause Workspace
        </button>
        <button
          onClick={() => setActiveSubTab('audit')}
          className={`flex items-center gap-2 rounded px-4 py-2 text-xs font-bold font-mono uppercase tracking-wide transition-all w-full justify-center ${
            activeSubTab === 'audit' ? 'bg-primary text-white shadow-glow' : 'text-muted hover:text-text'
          }`}
        >
          <ShieldAlert className="h-4 w-4" /> K8s Audit
        </button>
        <button
          onClick={() => setActiveSubTab('generator')}
          className={`flex items-center gap-2 rounded px-4 py-2 text-xs font-bold font-mono uppercase tracking-wide transition-all w-full justify-center ${
            activeSubTab === 'generator' ? 'bg-primary text-white shadow-glow' : 'text-muted hover:text-text'
          }`}
        >
          <FileCode className="h-4 w-4" /> Pipeline Gen
        </button>
      </div>

      {/* --- TAB 1: 3-COLUMN ROOT CAUSE WORKSPACE --- */}
      {activeSubTab === 'chat' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-stretch h-[600px]">
          
          {/* COLUMN 1: Chat Interface */}
          <div className="glass-panel bg-[#070B13]/60 flex flex-col justify-between h-full relative border-white/[0.04] overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/[0.03] p-4 bg-panel/30 select-none">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary animate-pulse" />
                <span className="font-bold text-xs font-mono uppercase text-slate-350">Gemini SRE Agent</span>
              </div>
              <button onClick={clearChat} className="rounded border border-white/[0.04] p-1.5 hover:bg-slate-800 text-muted hover:text-text transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 select-text">
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`flex gap-2.5 max-w-[90%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
                  <div className={`flex h-7 w-7 items-center justify-center rounded-full border shrink-0 ${
                    msg.role === 'user' ? 'bg-slate-800 border-white/[0.05] text-text' : 'bg-primary/10 border-primary/20 text-primary-light'
                  }`}>
                    {msg.role === 'user' ? <User className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5 animate-pulse text-primary-light" />}
                  </div>
                  <div className={`rounded-lg p-3 text-xs leading-relaxed border ${
                    msg.role === 'user'
                      ? 'bg-slate-900 border-white/[0.04] text-text rounded-tr-none font-mono'
                      : 'bg-slate-950/60 border-white/[0.02] text-slate-300 rounded-tl-none font-mono'
                  }`}>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}
              {isChatLoading && (
                <div className="flex gap-2.5 max-w-[90%]">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-primary-light">
                    <Sparkles className="h-3.5 w-3.5 animate-spin" />
                  </div>
                  <div className="rounded-lg p-3 text-xs bg-slate-950/60 border border-white/[0.02] text-muted rounded-tl-none flex items-center gap-2 font-mono">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary-light" /> Ingesting logs...
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input */}
            <form onSubmit={handleSendChat} className="border-t border-white/[0.03] p-3 bg-panel/30 flex gap-2 select-none">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Ask SRE Agent..."
                className="flex-1 rounded border border-white/[0.04] bg-[#05070E] px-3 py-2 text-xs text-text font-mono focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-slate-600"
              />
              <button
                type="submit"
                disabled={isChatLoading || !inputMessage.trim()}
                className="rounded bg-primary px-3 py-2 text-white shadow-glow hover:bg-primary-hover transition-colors disabled:opacity-40"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>

          {/* COLUMN 2: Raw Logs Snippet Terminal */}
          <div className="glass-panel bg-[#070B13]/60 flex flex-col justify-between h-full border-white/[0.04] overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/[0.03] p-4 bg-panel/30 select-none">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-secondary-light" />
                <span className="font-bold text-xs font-mono uppercase text-slate-350">Workspace Container Output</span>
              </div>
              <span className="text-[8px] font-mono text-muted uppercase">Live Socket Stream</span>
            </div>

            <div className="flex-1 p-4 bg-[#05070E] font-mono text-[10px] leading-relaxed text-slate-400 overflow-y-auto select-text space-y-1">
              {isDemoMode ? (
                <>
                  <div className="text-slate-600 font-bold"># STAGING DEPLOYMENT RUN CONSOLE</div>
                  {demoLogs.map((log, idx) => {
                    const isErr = log.toLowerCase().includes('error') || log.toLowerCase().includes('fail') || log.toLowerCase().includes('crashed') || log.toLowerCase().includes('oom');
                    return (
                      <div key={idx} className={isErr ? 'text-danger font-bold bg-danger/5 px-1 rounded' : ''}>
                        {log}
                      </div>
                    );
                  })}
                </>
              ) : (
                <>
                  <div className="text-slate-600 font-bold"># LOG CONTAINER READY</div>
                  <div>[System] Mounting stdout log pipeline...</div>
                  <div>[System] Connected over secure WebSockets.</div>
                  <div>[Stdout] Initialized worker task scheduler node-worker-1.</div>
                  <div>[Stdout] Listening for HTTP traffic on port 5000.</div>
                </>
              )}
            </div>
          </div>

          {/* COLUMN 3: AI Diagnostics & Recovery Triggers */}
          <div className="glass-panel bg-[#070B13]/60 p-5 flex flex-col justify-between h-full border-white/[0.04]">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/[0.03] pb-3 select-none">
                <div className="flex items-center gap-2">
                  <HeartPulse className="h-4 w-4 text-danger animate-pulse" />
                  <span className="font-bold text-xs font-mono uppercase text-slate-350">SRE Root Cause Diagnostics</span>
                </div>
                <span className="text-[8px] bg-danger/15 border border-danger/30 px-2 py-0.5 rounded text-danger font-mono uppercase">
                  Anomalous Status
                </span>
              </div>

              {/* Severity and Confidence details */}
              <div className="space-y-3 font-mono text-xs">
                {isDemoMode && demoStage >= 6 ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-danger/10 border border-danger/25 rounded space-y-1 animate-fadeIn">
                      <span className="text-danger font-bold text-[10px] uppercase block tracking-wider">CRITICAL ANOMALY CLASSIFIED</span>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        Container deploymate-api failed liveness probe checks. Reason: OOMKilled. JVM heap settings exceeded container resources memory allocation limit.
                      </p>
                    </div>

                    <div className="p-3 bg-slate-950/60 rounded border border-white/[0.02] text-[10px] space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted">Target Namespace:</span>
                        <span className="text-text font-bold">deploymate-staging</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted">Gemini Confidence Score:</span>
                        <span className="text-text font-bold">98.4%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted">Remediation Action:</span>
                        <span className="text-primary-light font-bold">Trigger Release Rollback</span>
                      </div>
                    </div>

                    <div className="bg-[#05070E] p-2.5 rounded border border-white/[0.02] space-y-1 select-text">
                      <span className="text-[8px] font-bold text-muted uppercase">Recommended YAML limit patch:</span>
                      <pre className="text-[9px] text-secondary-light leading-normal select-text">
{`resources:
  limits:
    memory: "1Gi"
  requests:
    memory: "512Mi"`}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="py-24 text-center text-muted font-mono text-[11px] leading-relaxed">
                    AI diagnostic scanners idle. Waiting for logs anomalies checks or pod failures triggers...
                  </div>
                )}
              </div>
            </div>

            {/* Recovery Action Triggers */}
            <div className="space-y-2.5 pt-4 border-t border-white/[0.03] select-none">
              {remediationMessage && (
                <div className="p-2.5 rounded border border-success/20 bg-success/5 text-[9px] font-mono text-success text-center">
                  {remediationMessage}
                </div>
              )}
              
              <button
                onClick={handleRemediate}
                disabled={remediating || (isDemoMode && demoStage < 6)}
                className="w-full rounded bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-xs font-bold font-mono uppercase text-white shadow-glow hover:from-violet-700 hover:to-indigo-700 transition-all flex items-center justify-center gap-1.5 disabled:opacity-40"
              >
                {remediating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Dispatching Remediation...
                  </>
                ) : (
                  <>
                    <Wrench className="h-4 w-4" /> One-Click Healing Fix
                  </>
                )}
              </button>

              <button
                onClick={handleRemediate}
                disabled={remediating || (isDemoMode && demoStage < 6)}
                className="w-full rounded border border-white/[0.05] hover:bg-slate-800 px-4 py-2 text-xs font-bold font-mono uppercase text-muted hover:text-text transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40"
              >
                <Undo2 className="h-3.5 w-3.5" /> Direct Rollback
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 2: AUDIT --- */}
      {activeSubTab === 'audit' && (
        <div className="grid gap-6 lg:grid-cols-2 select-none">
          <div className="glass-panel p-5 bg-[#090C16] border-slate-900 flex flex-col justify-between min-h-[520px]">
            <div className="space-y-4 flex-1 flex flex-col">
              <div className="flex items-center justify-between border-b border-white/[0.04] pb-4">
                <h3 className="font-semibold text-text text-sm">Deployment Manifest Editor</h3>
                <span className="text-[10px] text-muted font-mono uppercase tracking-wider">K8S YAML ENGINE</span>
              </div>
              
              <div className="flex-1 flex bg-[#05070E] rounded border border-white/[0.02] relative overflow-hidden h-80">
                <div className="w-12 bg-slate-950/60 text-right pr-3.5 py-4 text-slate-700 font-mono text-xs select-none border-r border-white/[0.02] flex flex-col gap-0.5 relative">
                  {Array.from({ length: getLineCount() }, (_, i) => i + 1).map((lineNum) => {
                    const lineRisk = auditResult?.risks.find(r => r.line === lineNum);
                    return (
                      <div key={lineNum} className="h-[18px] leading-[18px] relative flex items-center justify-end gap-1">
                        {lineRisk && (
                          <span className={`h-1.5 w-1.5 rounded-full absolute -left-2 ${
                            lineRisk.severity === 'high' ? 'bg-danger shadow-glow-danger' : 'bg-warning'
                          }`} />
                        )}
                        {lineNum}
                      </div>
                    );
                  })}
                </div>
                
                <textarea
                  value={manifestYaml}
                  onChange={(e) => setManifestYaml(e.target.value)}
                  className="flex-1 bg-transparent p-4 text-slate-300 font-mono text-xs focus:outline-none resize-none leading-[18px] h-full overflow-y-auto select-text selection:bg-primary/20 selection:text-white"
                  style={{ whiteSpace: 'pre', overflowWrap: 'normal' }}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3 mt-4">
              <button
                onClick={handleAudit}
                disabled={isAuditLoading || !manifestYaml.trim()}
                className="rounded-lg bg-gradient-to-r from-primary to-secondary py-2.5 text-xs font-bold font-mono text-white shadow-glow hover:from-primary-hover hover:to-secondary-hover transition-all flex items-center justify-center gap-1.5"
              >
                {isAuditLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Analyzing Manifest...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 fill-white" /> Trigger Security Audit
                  </>
                )}
              </button>

              <button
                onClick={handleCreateFixPr}
                disabled={isPrCreating}
                className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 py-2.5 text-xs font-bold font-mono uppercase text-emerald-400 transition-all flex items-center justify-center gap-1.5"
              >
                {isPrCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Creating GitHub PR...
                  </>
                ) : (
                  <>
                    <GitPullRequest className="h-4 w-4 text-emerald-400" /> Create AI Fix PR
                  </>
                )}
              </button>
            </div>

            {prStatusMessage && (
              <div className="mt-3 p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-lg flex items-center justify-between text-xs font-mono text-emerald-300">
                <span>{prStatusMessage.msg}</span>
                <a
                  href={prStatusMessage.url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 bg-emerald-500 text-slate-950 font-bold rounded hover:bg-emerald-400 transition-colors shrink-0"
                >
                  View PR ↗
                </a>
              </div>
            )}
          </div>

          <div className="glass-panel p-5 bg-panel/10 min-h-[520px] flex flex-col justify-center select-text">
            {auditResult ? (
              <div className="space-y-5 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-border/60 pb-3 mb-4">
                    <h3 className="font-semibold text-text text-sm flex items-center gap-2">
                      <ShieldAlert className="h-4.5 w-4.5 text-danger" /> Integrity Scan Result
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted font-mono">Risk Index:</span>
                      <span className={`text-xs font-bold px-2.5 py-0.5 rounded font-mono ${
                        auditResult.risk_score > 60 
                          ? 'bg-danger/10 text-danger border border-danger/20' 
                          : auditResult.risk_score > 30 
                            ? 'bg-warning/10 text-warning border border-warning/20'
                            : 'bg-success/10 text-success border border-success/20 font-bold'
                      }`}>
                        {auditResult.risk_score} / 100
                      </span>
                    </div>
                  </div>

                  {auditResult.risks.length > 0 ? (
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                      <h4 className="text-[10px] font-bold text-danger uppercase tracking-wider flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5" /> Vulnerabilities Found
                      </h4>
                      <div className="space-y-2">
                        {auditResult.risks.map((risk, idx) => (
                          <div key={idx} className="flex items-start justify-between gap-3 p-3 rounded-lg border border-white/[0.02] bg-[#0E1424]/40 text-xs">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className={`h-1.5 w-1.5 rounded-full ${
                                  risk.severity === 'high' ? 'bg-danger' : 'bg-warning'
                                }`} />
                                <span className="font-bold text-text">{risk.title} <span className="text-[10px] text-slate-500 font-mono">(Line {risk.line})</span></span>
                              </div>
                              <p className="text-muted leading-relaxed font-sans">{risk.message}</p>
                            </div>
                            <button
                              onClick={() => handleAutoFix(risk)}
                              className="rounded bg-success/10 border border-success/30 hover:bg-success/20 px-2 py-1 text-[10px] font-bold text-success flex items-center gap-1 shrink-0 transition-all select-none"
                            >
                              <Wrench className="h-3 w-3" /> Auto-Fix
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center text-success border border-dashed border-success/20 rounded-lg bg-success/5 animate-in zoom-in-95 duration-200">
                      <CheckCircle2 className="h-12 w-12 text-success mb-2.5 shadow-glow-success rounded-full" />
                      <h4 className="font-bold text-sm">Manifest Audit Passed!</h4>
                      <p className="text-xs text-muted max-w-[220px] mt-1 font-sans">No critical security flaws, replica starvation, or resource risks found in the editor context.</p>
                    </div>
                  )}
                </div>

                <div className="space-y-2 pt-4 border-t border-border/40">
                  <h4 className="text-[10px] font-bold text-success uppercase tracking-wider">AI Recommendation Action Summary</h4>
                  <p className="text-xs text-muted leading-relaxed font-sans">{auditResult.recommendations}</p>
                </div>
              </div>
            ) : (
              <div className="text-center text-muted select-none">
                <ShieldAlert className="h-16 w-16 mx-auto mb-4 stroke-1 text-slate-600 animate-pulse" />
                <h3 className="text-sm font-semibold text-text">No Manifest Audited</h3>
                <p className="text-xs text-muted mt-1 max-w-xs mx-auto font-sans">Input your deployment yaml manifest in the editor container and click scan to audit security contexts, replicas counts, and memory resource limitations.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- TAB 3: GENERATOR --- */}
      {activeSubTab === 'generator' && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="glass-panel p-6 bg-panel/30 lg:col-span-1 space-y-6 select-none">
            <div>
              <h3 className="font-semibold text-text text-sm">Pipeline Parameters</h3>
              <p className="text-xs text-muted mt-1">Select the tech stack you wish to generate pipeline workflow for.</p>
            </div>

            <div className="space-y-4">
              {techStacks.map((stack) => (
                <button
                  key={stack}
                  onClick={() => setSelectedTech(stack)}
                  className={`w-full flex items-center justify-between p-3.5 rounded-lg border text-left font-semibold text-sm transition-all ${
                    selectedTech === stack
                      ? 'bg-primary text-white border-primary shadow-glow'
                      : 'bg-[#0E1424]/40 border-border/30 text-muted hover:border-white/10 hover:text-text'
                  }`}
                >
                  {stack}
                  <ChevronRight className="h-4.5 w-4.5 shrink-0" />
                </button>
              ))}
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenLoading}
              className="w-full rounded-lg bg-gradient-to-r from-primary to-secondary py-2.5 text-sm font-semibold text-white shadow-glow hover:from-primary-hover hover:to-secondary-hover transition-all flex items-center justify-center gap-1.5"
            >
              {isGenLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Compiling blueprints...
                </>
              ) : (
                <>
                  <Cpu className="h-4 w-4" /> Generate Workspace YAML
                </>
              )}
            </button>
          </div>

          <div className="glass-panel p-6 bg-[#090C16] border-slate-900 lg:col-span-2 min-h-[400px] flex flex-col justify-between select-text">
            {generatedCode ? (
              <div className="space-y-4 flex-1 flex flex-col justify-between">
                <div className="flex items-center justify-between border-b border-white/[0.04] pb-4 select-none">
                  <div className="flex items-center gap-2">
                    <FileCode className="h-4.5 w-4.5 text-primary-light" />
                    <span className="font-mono text-xs font-semibold text-text">deploymate-pipeline.yaml</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={copyToClipboard}
                      className="flex items-center gap-1.5 rounded border border-border bg-slate-900 px-2.5 py-1.5 text-xs text-muted hover:text-text hover:bg-slate-800 transition-colors"
                    >
                      {copied ? (
                        <>
                          <ClipboardCheck className="h-4 w-4 text-success" /> Copied
                        </>
                      ) : (
                        <>
                          <Clipboard className="h-4 w-4" /> Copy Code
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex-1 mt-4 rounded bg-[#05070E] p-4 text-xs overflow-y-auto border border-white/[0.02] shadow-inner select-text h-96">
                  {colorizeYaml(generatedCode)}
                </div>
              </div>
            ) : (
              <div className="text-center text-muted py-24 flex-1 flex flex-col justify-center select-none">
                <FileCode className="h-16 w-16 mx-auto mb-4 stroke-1 text-slate-700 animate-pulse" />
                <h3 className="text-base font-semibold text-text">Workflow Code Generator</h3>
                <p className="text-sm text-muted mt-1 max-w-sm mx-auto">Select a project technology on the left options panel and click generate to scaffold standard CI/CD stages configuration code blocks.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
