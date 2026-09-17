import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDemo } from '../context/DemoContext';
import { 
  Cpu, 
  Server, 
  Layers, 
  Undo2, 
  Loader2, 
  RefreshCw, 
  Search, 
  Globe, 
  Clock, 
  AlertTriangle,
  CheckCircle2,
  Terminal,
  Activity,
  Network
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, Tooltip } from 'recharts';

interface NamespaceRes {
  namespaces: string[];
  mode: 'LIVE' | 'SIMULATED';
}

interface Pod {
  name: string;
  namespace: string;
  status: string;
  ip: string;
  node: string;
  startedAt: string;
}

interface Deployment {
  name: string;
  namespace: string;
  replicas: number;
  readyReplicas: number;
  image: string;
  status: string;
  createdAt: string;
}

interface Service {
  name: string;
  namespace: string;
  type: string;
  clusterIP: string;
  ports: string;
}

export const Deployments: React.FC = () => {
  const { token, user } = useAuth();
  const { isDemoMode, demoStage } = useDemo();
  
  // State
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [selectedNamespace, setSelectedNamespace] = useState<string>(isDemoMode ? 'deploymate-staging' : 'default');
  const [clusterMode, setClusterMode] = useState<'LIVE' | 'SIMULATED'>('SIMULATED');
  const [activeTab, setActiveTab] = useState<'topology' | 'deployments' | 'pods' | 'services' | 'progressive'>('topology');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [pods, setPods] = useState<Pod[]>([]);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isRollbackLoading, setIsRollbackLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Progressive Release State
  const [canaryWeight, setCanaryWeight] = useState(10);
  const [selectedDeploymentName, setSelectedDeploymentName] = useState('deploymate-api-deployment');
  const [selectedServiceName, setSelectedServiceName] = useState('deploymate-api-service');
  const [activeBlueGreenColor, setActiveBlueGreenColor] = useState('blue');
  const [bgSwapping, setBgSwapping] = useState(false);
  const [canaryApplying, setCanaryApplying] = useState(false);

  // Inspector Drawer State
  const [selectedPodInspector, setSelectedPodInspector] = useState<Pod | null>(null);
  const [inspectorMetrics, setInspectorMetrics] = useState<{ cpu: number; memory: number; network: string; chartData: any[] } | null>(null);
  const [isRestartingPod, setIsRestartingPod] = useState(false);
  const [inspectorLogs, setInspectorLogs] = useState<string[]>([]);
  const [hoveredNode, setHoveredNode] = useState<{ type: 'service' | 'deployment' | 'pod'; name: string } | null>(null);

  // Terminal Modal State
  const [activeTerminalPod, setActiveTerminalPod] = useState<Pod | null>(null);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [terminalInput, setTerminalInput] = useState<string>('');
  const [termWs, setTermWs] = useState<WebSocket | null>(null);

  // Fetch Namespaces
  const fetchNamespaces = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/v1/kubernetes/namespaces', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data: NamespaceRes = await res.json();
        setNamespaces(data.namespaces);
        setClusterMode(data.mode);
        if (data.namespaces.length > 0 && !selectedNamespace) {
          setSelectedNamespace(isDemoMode ? 'deploymate-staging' : data.namespaces[0]);
        }
      }
    } catch {
      setNamespaces(['default', 'kube-system', 'deploymate-staging', 'deploymate-prod']);
      setClusterMode('SIMULATED');
    }
  };

  // Fetch Resources based on selected namespace
  const fetchResources = async () => {
    if (!selectedNamespace) return;
    setIsLoading(true);
    setActionMessage(null);
    
    // Intercept with Demo Mode overrides
    if (isDemoMode && selectedNamespace === 'deploymate-staging') {
      const pod1Status = (demoStage === 6 || demoStage === 7) ? 'CrashLoopBackOff' : 'Running';
      const pod1StartedAt = (demoStage === 6 || demoStage === 7) ? new Date(Date.now() - 15000).toISOString() : new Date(Date.now() - 3600000).toISOString();
      
      setTimeout(() => {
        setPods([
          { name: 'deploymate-api-78fa2c-pod1', namespace: 'deploymate-staging', status: pod1Status, ip: '10.244.0.15', node: 'node-worker-1', startedAt: pod1StartedAt },
          { name: 'deploymate-api-78fa2c-pod2', namespace: 'deploymate-staging', status: 'Running', ip: '10.244.0.16', node: 'node-worker-2', startedAt: new Date(Date.now() - 3600000 * 2).toISOString() },
          { name: 'deploymate-ui-3b8c9d-pod1', namespace: 'deploymate-staging', status: 'Running', ip: '10.244.1.20', node: 'node-worker-2', startedAt: new Date(Date.now() - 3600000 * 6).toISOString() },
          { name: 'fastapi-copilot-88f2a-pod1', namespace: 'deploymate-staging', status: 'Running', ip: '10.244.1.21', node: 'node-worker-1', startedAt: new Date(Date.now() - 3600000 * 4).toISOString() },
        ]);
        setDeployments([
          { name: 'deploymate-api-deployment', namespace: 'deploymate-staging', replicas: 3, readyReplicas: (demoStage === 6 || demoStage === 7) ? 1 : 3, image: 'deploymate/core-api:sha-8f2a10', status: (demoStage === 6 || demoStage === 7) ? 'Degraded' : 'Available', createdAt: new Date(Date.now() - 3600000 * 24).toISOString() },
          { name: 'deploymate-ui-deployment', namespace: 'deploymate-staging', replicas: 1, readyReplicas: 1, image: 'deploymate/frontend-ui:sha-8f2a10', status: 'Available', createdAt: new Date(Date.now() - 3600000 * 48).toISOString() },
          { name: 'fastapi-copilot-deployment', namespace: 'deploymate-staging', replicas: 1, readyReplicas: 1, image: 'deploymate/fastapi-copilot:v1.0.2', status: 'Available', createdAt: new Date(Date.now() - 3600000 * 12).toISOString() }
        ]);
        setServices([
          { name: 'deploymate-api-service', namespace: 'deploymate-staging', type: 'ClusterIP', clusterIP: '10.96.14.82', ports: '5000:5000/TCP' },
          { name: 'deploymate-ui-service', namespace: 'deploymate-staging', type: 'NodePort', clusterIP: '10.96.220.101', ports: '80:31200/TCP' },
          { name: 'fastapi-copilot-service', namespace: 'deploymate-staging', type: 'ClusterIP', clusterIP: '10.96.88.5', ports: '8000:8000/TCP' }
        ]);
        setIsLoading(false);
      }, 300);
      return;
    }

    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const [podsRes, depsRes, svcsRes] = await Promise.all([
        fetch(`http://localhost:5000/api/v1/kubernetes/${selectedNamespace}/pods`, { headers }),
        fetch(`http://localhost:5000/api/v1/kubernetes/${selectedNamespace}/deployments`, { headers }),
        fetch(`http://localhost:5000/api/v1/kubernetes/${selectedNamespace}/services`, { headers }),
      ]);

      if (podsRes.ok && depsRes.ok && svcsRes.ok) {
        setPods(await podsRes.ok ? await podsRes.json() : []);
        setDeployments(await depsRes.ok ? await depsRes.json() : []);
        setServices(await svcsRes.ok ? await svcsRes.json() : []);
      } else {
        throw new Error();
      }
    } catch {
      // Fallback Mock Data
      setPods([
        { name: 'deploymate-api-5d7f8c9b-abc12', namespace: selectedNamespace, status: 'Running', ip: '10.244.0.15', node: 'node-control-plane', startedAt: new Date(Date.now() - 3600000 * 2).toISOString() },
        { name: 'deploymate-api-5d7f8c9b-def34', namespace: selectedNamespace, status: 'Running', ip: '10.244.0.16', node: 'node-worker-1', startedAt: new Date(Date.now() - 3600000 * 2).toISOString() },
        { name: 'deploymate-ui-6b9f4d7a-xyz99', namespace: selectedNamespace, status: 'Running', ip: '10.244.1.20', node: 'node-worker-2', startedAt: new Date(Date.now() - 3600000 * 6).toISOString() },
        { name: 'fastapi-copilot-7c8f9b1c-7721a', namespace: selectedNamespace, status: 'Running', ip: '10.244.1.21', node: 'node-worker-1', startedAt: new Date(Date.now() - 3600000 * 4).toISOString() },
      ]);
      setDeployments([
        { name: 'deploymate-api-deployment', namespace: selectedNamespace, replicas: 2, readyReplicas: 2, image: 'deploymate/core-api:latest', status: 'Available', createdAt: new Date(Date.now() - 3600000 * 24).toISOString() },
        { name: 'deploymate-ui-deployment', namespace: selectedNamespace, replicas: 1, readyReplicas: 1, image: 'deploymate/frontend-ui:latest', status: 'Available', createdAt: new Date(Date.now() - 3600000 * 48).toISOString() },
        { name: 'fastapi-copilot-deployment', namespace: selectedNamespace, replicas: 1, readyReplicas: 1, image: 'deploymate/fastapi-copilot:v1.0.2', status: 'Available', createdAt: new Date(Date.now() - 3600000 * 12).toISOString() }
      ]);
      setServices([
        { name: 'deploymate-api-service', namespace: selectedNamespace, type: 'ClusterIP', clusterIP: '10.96.14.82', ports: '5000:5000/TCP' },
        { name: 'deploymate-ui-service', namespace: selectedNamespace, type: 'NodePort', clusterIP: '10.96.220.101', ports: '80:31200/TCP' },
        { name: 'fastapi-copilot-service', namespace: selectedNamespace, type: 'ClusterIP', clusterIP: '10.96.88.5', ports: '8000:8000/TCP' }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNamespaces();
  }, [token]);

  useEffect(() => {
    fetchResources();
    setSelectedPodInspector(null);
  }, [selectedNamespace, token, isDemoMode, demoStage]);

  // Handle Pod Inspector Selection
  const handleOpenInspector = (pod: Pod) => {
    setSelectedPodInspector(pod);
    const isCrashed = pod.status !== 'Running';
    
    // Seed initial Recharts load data
    const chartPoints = Array.from({ length: 7 }, (_, i) => ({
      time: `${i * 10}s`,
      cpu: isCrashed ? Math.min(99, 90 + Math.floor(Math.random() * 9)) : Math.floor(Math.random() * 20) + 10,
      memory: isCrashed ? 98 : Math.floor(Math.random() * 10) + 40
    }));

    setInspectorMetrics({
      cpu: isCrashed ? 98 : Math.floor(Math.random() * 15) + 8,
      memory: isCrashed ? 99 : Math.floor(Math.random() * 8) + 42,
      network: isCrashed ? '0.01 MB/s' : `${(Math.random() * 4 + 1).toFixed(2)} MB/s`,
      chartData: chartPoints
    });

    if (isCrashed) {
      setInspectorLogs([
        `[${new Date().toLocaleTimeString()}] Running JVM configuration -Xmx768m`,
        `[${new Date().toLocaleTimeString()}] FATAL: java.lang.OutOfMemoryError: Java heap space`,
        `[${new Date().toLocaleTimeString()}] Container process exited with code 137`,
        `[${new Date().toLocaleTimeString()}] Kubelet monitoring: Liveness probe failed. Restarting pod...`,
        `[${new Date().toLocaleTimeString()}] Back-off restarting failed container main`
      ]);
    } else {
      setInspectorLogs([
        `[${new Date().toLocaleTimeString()}] Container standard output connected.`,
        `[${new Date().toLocaleTimeString()}] Listening on port 8080`,
        `[${new Date().toLocaleTimeString()}] GET /api/v1/health-check 200 OK (0.6ms)`
      ]);
    }
  };

  // Live sparkline simulation in Pod Inspector
  useEffect(() => {
    if (!selectedPodInspector) return;
    const interval = setInterval(() => {
      const isCrashed = selectedPodInspector.status !== 'Running';
      
      setInspectorMetrics(prev => {
        if (!prev) return null;
        
        const nextCpu = isCrashed ? 99 : Math.min(Math.max(prev.cpu + Math.floor(Math.random() * 7) - 3, 2), 95);
        const nextMemory = isCrashed ? 99 : Math.min(Math.max(prev.memory + Math.floor(Math.random() * 3) - 1, 30), 85);
        
        const newChartData = [
          ...prev.chartData.slice(1),
          {
            time: `${new Date().getSeconds()}s`,
            cpu: nextCpu,
            memory: nextMemory
          }
        ];
        
        return {
          cpu: nextCpu,
          memory: nextMemory,
          network: isCrashed ? '0.00 MB/s' : `${(Math.random() * 4 + 1).toFixed(2)} MB/s`,
          chartData: newChartData
        };
      });

      // Add dynamic logs
      if (!isCrashed) {
        const endPoints = ['/api/v1/projects', '/api/v1/pipelines/runs', '/api/v1/logs', '/ws/logs'];
        const randomEp = endPoints[Math.floor(Math.random() * endPoints.length)];
        setInspectorLogs(prev => [
          ...prev.slice(-15),
          `[${new Date().toLocaleTimeString()}] GET ${randomEp} 200 OK (${(Math.random() * 30 + 5).toFixed(1)}ms)`
        ]);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [selectedPodInspector]);

  // Restart Pod Simulation
  const handleRestartPod = () => {
    setIsRestartingPod(true);
    setInspectorLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] RECEIVED SIGTERM: Graceful shutdown initiated.`]);
    setTimeout(() => {
      setIsRestartingPod(false);
      setInspectorLogs(prev => [
        ...prev, 
        `[${new Date().toLocaleTimeString()}] Container stopped. Re-allocating node scheduler...`,
        `[${new Date().toLocaleTimeString()}] Node assigned to worker cluster nodes.`,
        `[${new Date().toLocaleTimeString()}] Starting new container pod workspace...`,
        `[${new Date().toLocaleTimeString()}] Container started successfully (PID 1).`
      ]);
      setInspectorMetrics(prev => prev ? {
        ...prev,
        cpu: 12,
        memory: 38,
        network: '0.12 MB/s'
      } : null);
    }, 2000);
  };

  const handleOpenTerminal = (pod: Pod) => {
    setActiveTerminalPod(pod);
    setTerminalLogs([`Connecting to pod shell terminal: ${pod.name}...`]);

    try {
      const ws = new WebSocket(`ws://localhost:5000/ws/terminal?pod=${pod.name}&namespace=${pod.namespace}`);
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.output) {
            setTerminalLogs(prev => [...prev, data.output]);
          }
        } catch {
          setTerminalLogs(prev => [...prev, event.data]);
        }
      };
      ws.onclose = () => {
        setTerminalLogs(prev => [...prev, '\r\n[Terminal session disconnected]']);
      };
      setTermWs(ws);
    } catch {
      setTerminalLogs(prev => [...prev, 'Failed to establish WebSocket terminal connection.']);
    }
  };

  const handleCloseTerminal = () => {
    if (termWs) {
      termWs.close();
      setTermWs(null);
    }
    setActiveTerminalPod(null);
  };

  const handleSendTerminalCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!terminalInput.trim() || !termWs) return;
    setTerminalLogs(prev => [...prev, `$ ${terminalInput}`]);
    termWs.send(terminalInput);
    setTerminalInput('');
  };

  const handleRollback = async (deploymentName: string) => {
    if (user?.role === 'Viewer') return;
    setIsRollbackLoading(deploymentName);
    setActionMessage(null);
    try {
      const res = await fetch('http://localhost:5000/api/v1/kubernetes/rollback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ namespace: selectedNamespace, name: deploymentName })
      });
      const data = await res.json();
      if (res.ok) {
        setActionMessage({ type: 'success', text: `Successfully triggered rollback for deployment: ${deploymentName}` });
        fetchResources();
      } else {
        throw new Error(data.message || 'Rollback failed.');
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Rollback failed.' });
    } finally {
      setIsRollbackLoading(null);
    }
  };

  const handleCanarySplit = async () => {
    if (user?.role === 'Viewer') return;
    setCanaryApplying(true);
    setActionMessage(null);
    try {
      const res = await fetch('http://localhost:5000/api/v1/kubernetes/canary-split', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ namespace: selectedNamespace, name: selectedDeploymentName, weight: canaryWeight })
      });
      const data = await res.json();
      if (res.ok) {
        setActionMessage({
          type: 'success',
          text: `Canary Split of ${canaryWeight}% traffic split successfully applied to ${selectedDeploymentName}.`
        });
      } else {
        throw new Error(data.message || 'Canary split adjustment failed.');
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to apply Canary traffic split.' });
    } finally {
      setCanaryApplying(false);
    }
  };

  const handleBlueGreenSwap = async () => {
    if (user?.role === 'Viewer') return;
    setBgSwapping(true);
    setActionMessage(null);
    const nextColor = activeBlueGreenColor === 'blue' ? 'green' : 'blue';
    try {
      const res = await fetch('http://localhost:5000/api/v1/kubernetes/blue-green-swap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ namespace: selectedNamespace, serviceName: selectedServiceName, activeColor: nextColor })
      });
      const data = await res.json();
      if (res.ok) {
        setActiveBlueGreenColor(nextColor);
        setActionMessage({
          type: 'success',
          text: `Blue-Green active backend successfully swapped to ${nextColor.toUpperCase()}.`
        });
      } else {
        throw new Error(data.message || 'Blue-Green router swap failed.');
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to swap Blue-Green backend.' });
    } finally {
      setBgSwapping(false);
    }
  };

  const isHighlighted = (nodeType: 'service' | 'deployment' | 'pod', nodeName: string) => {
    if (!hoveredNode) return false;

    if (hoveredNode.type === 'service') {
      const targetDep = hoveredNode.name.replace('-service', '-deployment');
      if (nodeType === 'service' && nodeName === hoveredNode.name) return true;
      if (nodeType === 'deployment' && nodeName === targetDep) return true;
      if (nodeType === 'pod' && nodeName.includes(targetDep.replace('-deployment', ''))) return true;
    }

    if (hoveredNode.type === 'deployment') {
      const cleanDepName = hoveredNode.name.replace('-deployment', '');
      if (nodeType === 'deployment' && nodeName === hoveredNode.name) return true;
      if (nodeType === 'service' && nodeName === cleanDepName + '-service') return true;
      if (nodeType === 'pod' && nodeName.includes(cleanDepName)) return true;
    }

    if (hoveredNode.type === 'pod') {
      if (nodeType === 'pod' && nodeName === hoveredNode.name) return true;
      const matchingDep = deployments.find(d => nodeName.includes(d.name.replace('-deployment', '')));
      if (matchingDep) {
        if (nodeType === 'deployment' && nodeName === matchingDep.name) return true;
        if (nodeType === 'service' && nodeName === matchingDep.name.replace('-deployment', '-service')) return true;
      }
    }

    return false;
  };

  return (
    <div className="space-y-6 text-text select-none">
      {/* Header Panel */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-white/[0.04] pb-5">
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-tight text-text flex items-center gap-2">
            <Network className="text-primary h-6.5 w-6.5" />
            CLUSTER ORCHESTRATOR
          </h1>
          <p className="text-xs text-muted mt-1">
            Real-time topology visualization mapping microservice links, routing nodes, and pod telemetry.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className={`inline-flex items-center gap-1 rounded px-2.5 py-0.5 text-[9px] font-bold font-mono uppercase tracking-wider ${
            clusterMode === 'LIVE' 
              ? 'bg-success/15 text-success border border-success/30' 
              : 'bg-warning/15 text-warning border border-warning/30'
          }`}>
            <Server className="h-3 w-3" /> {clusterMode} MODE
          </span>

          <select
            value={selectedNamespace}
            onChange={(e) => setSelectedNamespace(e.target.value)}
            className="rounded-lg border border-white/[0.04] bg-[#090E1A] px-3.5 py-1.5 text-xs text-text font-mono focus:outline-none focus:ring-1 focus:ring-primary/40"
          >
            {namespaces.map(ns => (
              <option key={ns} value={ns}>{ns}</option>
            ))}
          </select>

          <button onClick={fetchResources} className="rounded-lg border border-white/[0.04] p-1.5 hover:bg-slate-800 text-muted hover:text-text transition-colors">
            <RefreshCw className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>

      {/* Tabs Selector & Search */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between glass-panel p-4 bg-panel/30 select-none">
        <div className="flex rounded-lg bg-slate-950/40 p-1 border border-white/[0.02]">
          {(['topology', 'deployments', 'pods', 'services', 'progressive'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-md px-4 py-1.5 text-xs font-bold font-mono tracking-wide uppercase transition-all ${
                activeTab === tab
                  ? 'bg-primary text-white shadow-glow'
                  : 'text-muted hover:text-text'
              }`}
            >
              {tab === 'progressive' ? 'Progressive Release' : tab}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 border border-white/[0.04] bg-slate-950/40 rounded-lg px-3 py-1.5 w-full sm:max-w-xs">
          <Search className="h-4 w-4 text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search resource node..."
            className="bg-transparent text-xs font-mono text-text focus:outline-none placeholder:text-slate-650 w-full"
          />
        </div>
      </div>

      {actionMessage && (
        <div className={`flex items-center gap-3 rounded-lg border p-4 text-xs font-mono animate-fadeIn ${
          actionMessage.type === 'success'
            ? 'border-success/20 bg-success/5 text-success'
            : 'border-danger/20 bg-danger/5 text-danger'
        }`}>
          {actionMessage.type === 'success' ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
          <p>{actionMessage.text}</p>
        </div>
      )}

      {/* Resource Lists */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : activeTab === 'topology' ? (
        /* INTERACTIVE TOPOLOGY GRAPH */
        <div className="grid gap-6 lg:grid-cols-4 select-none items-start">
          {/* Node Graph Panel */}
          <div className="glass-panel p-6 bg-[#070B13]/60 border-white/[0.04] shadow-glow relative lg:col-span-3 min-h-[520px] flex flex-col justify-between overflow-x-auto">
            
            <div className="text-xs font-mono font-semibold text-muted border-b border-white/[0.03] pb-3 mb-6 flex justify-between">
              <span>Logical Namespace Topology Map</span>
              <span className="text-slate-500">Hover nodes to track logical ingress pathways</span>
            </div>

            <div className="flex items-stretch justify-between w-full gap-8 min-w-[650px] relative py-4">
              
              {/* Column 1: Services */}
              <div className="flex flex-col justify-around gap-6 w-1/3 z-10">
                <span className="block text-[10px] text-muted font-bold tracking-widest uppercase border-b border-white/[0.03] pb-1.5 mb-2 font-mono text-center">Ingress Routing</span>
                {services.map(svc => (
                  <div
                    key={svc.name}
                    onMouseEnter={() => setHoveredNode({ type: 'service', name: svc.name })}
                    onMouseLeave={() => setHoveredNode(null)}
                    className={`p-4 rounded-xl border transition-all duration-350 flex flex-col gap-1 cursor-default ${
                      hoveredNode && !isHighlighted('service', svc.name)
                        ? 'opacity-20 border-border/10 bg-[#0E1424]/10'
                        : isHighlighted('service', svc.name)
                          ? 'border-primary bg-primary/10 shadow-glow'
                          : 'border-white/[0.03] bg-[#0E1424]/40 hover:border-primary-light/30'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Globe className="h-4.5 w-4.5 text-secondary" />
                      <span className="font-semibold text-text text-xs font-mono truncate">{svc.name}</span>
                    </div>
                    <span className="font-mono text-[9px] text-muted pl-6">{svc.clusterIP} · {svc.ports.split('/')[0]}</span>
                  </div>
                ))}
              </div>

              {/* Column 2: Deployments */}
              <div className="flex flex-col justify-around gap-6 w-1/3 z-10">
                <span className="block text-[10px] text-muted font-bold tracking-widest uppercase border-b border-white/[0.03] pb-1.5 mb-2 font-mono text-center">Controllers</span>
                {deployments.map(dep => {
                  const isDegraded = dep.readyReplicas < dep.replicas;
                  return (
                    <div
                      key={dep.name}
                      onMouseEnter={() => setHoveredNode({ type: 'deployment', name: dep.name })}
                      onMouseLeave={() => setHoveredNode(null)}
                      className={`p-4 rounded-xl border transition-all duration-350 flex flex-col gap-1 cursor-default ${
                        hoveredNode && !isHighlighted('deployment', dep.name)
                          ? 'opacity-20 border-border/10 bg-[#0E1424]/10'
                          : isHighlighted('deployment', dep.name)
                            ? (isDegraded ? 'border-danger bg-danger/10 shadow-glow-danger' : 'border-primary bg-primary/10 shadow-glow')
                            : 'border-white/[0.03] bg-[#0E1424]/40 hover:border-primary-light/30'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <Layers className="h-4.5 w-4.5 text-primary-light" />
                          <span className="font-semibold text-text text-xs font-mono truncate">{dep.name}</span>
                        </div>
                        {isDegraded && <span className="h-1.5 w-1.5 rounded-full bg-danger animate-ping" />}
                      </div>
                      <span className="font-mono text-[9px] text-muted pl-6">Replicas: {dep.readyReplicas} / {dep.replicas}</span>
                    </div>
                  );
                })}
              </div>

              {/* Column 3: Pods */}
              <div className="flex flex-col justify-around gap-4 w-1/3 z-10">
                <span className="block text-[10px] text-muted font-bold tracking-widest uppercase border-b border-white/[0.03] pb-1.5 mb-2 font-mono text-center">Pod Workloads</span>
                {pods.map(pod => {
                  const isCrashed = pod.status !== 'Running';
                  
                  let dotColor = 'bg-success shadow-glow-success';
                  let borderStyle = 'border-white/[0.03] bg-[#0E1424]/40 hover:border-primary-light/30';
                  
                  if (isCrashed) {
                    dotColor = 'bg-danger shadow-glow-danger';
                    borderStyle = 'border-danger bg-danger/10 text-danger glow-red';
                  } else if (hoveredNode && isHighlighted('pod', pod.name)) {
                    borderStyle = 'border-primary bg-primary/10 shadow-glow translate-x-1';
                  }
                  
                  return (
                    <div
                      key={pod.name}
                      onMouseEnter={() => setHoveredNode({ type: 'pod', name: pod.name })}
                      onMouseLeave={() => setHoveredNode(null)}
                      onClick={() => handleOpenInspector(pod)}
                      className={`p-3.5 rounded-xl border transition-all duration-300 flex flex-col gap-1 cursor-pointer select-none ${
                        hoveredNode && !isHighlighted('pod', pod.name) && !isCrashed
                          ? 'opacity-20 border-border/10 bg-[#0E1424]/10'
                          : borderStyle
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <Cpu className={`h-4 w-4 shrink-0 ${isCrashed ? 'text-danger animate-pulse' : 'text-success'}`} />
                          <span className="font-mono text-[10px] font-semibold text-text truncate">{pod.name.split('-').slice(-2).join('-')}</span>
                        </div>
                        <span className={`h-2 w-2 rounded-full shrink-0 animate-pulse ${dotColor}`} />
                      </div>
                      <span className="block font-mono text-[8px] text-muted pl-6">{pod.ip}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="text-[9px] text-slate-650 font-mono text-center border-t border-white/[0.02] pt-3 mt-4">
              DEPLOYMATE Topology Aggregator v3.0 (Operational Node Grid)
            </div>
          </div>

          {/* SIDE INSPECTOR PANEL */}
          <div className="glass-panel p-5 bg-[#070B13]/60 border-white/[0.04] lg:col-span-1 min-h-[520px] flex flex-col justify-between">
            {selectedPodInspector ? (
              <div className="flex-1 flex flex-col justify-between space-y-5 select-text animate-in fade-in slide-in-from-right-4 duration-300">
                {/* Header */}
                <div className="border-b border-white/[0.04] pb-3">
                  <div className="flex items-center justify-between gap-1.5 mb-2">
                    <span className="text-[9px] text-primary-light font-bold font-mono tracking-widest uppercase">POD INSPECTOR</span>
                    <button
                      onClick={() => setSelectedPodInspector(null)}
                      className="text-muted hover:text-text font-mono text-[9px] uppercase tracking-wide px-2 py-0.5 rounded border border-white/[0.04] bg-slate-950"
                    >
                      Close
                    </button>
                  </div>
                  <h3 className="font-mono font-bold text-text text-[10px] break-all">{selectedPodInspector.name}</h3>
                </div>

                {/* Simulated Live stats */}
                {inspectorMetrics && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-[#05070E] p-3 rounded border border-white/[0.02]">
                        <span className="block text-[8px] font-semibold text-muted uppercase font-mono">CPU Core usage</span>
                        <div className="flex items-center gap-1.5 mt-1 font-mono">
                          <Activity className="h-3.5 w-3.5 text-primary-light animate-pulse" />
                          <span className="text-xs font-bold text-text">{inspectorMetrics.cpu}%</span>
                        </div>
                      </div>
                      <div className="bg-[#05070E] p-3 rounded border border-white/[0.02]">
                        <span className="block text-[8px] font-semibold text-muted uppercase font-mono">Memory load</span>
                        <div className="flex items-center gap-1.5 mt-1 font-mono">
                          <Layers className="h-3.5 w-3.5 text-secondary" />
                          <span className="text-xs font-bold text-text">{inspectorMetrics.memory}%</span>
                        </div>
                      </div>
                    </div>

                    {/* Sparkline Load Chart */}
                    <div className="bg-[#05070E] p-2.5 rounded border border-white/[0.02] h-[100px]">
                      <span className="block text-[8px] font-bold font-mono text-muted uppercase tracking-wider mb-2">Telemetry History (CPU / Mem)</span>
                      <ResponsiveContainer width="100%" height="80%">
                        <AreaChart data={inspectorMetrics.chartData} margin={{ top: 2, right: 2, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#6366F1" stopOpacity={0.2}/>
                              <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="time" hide />
                          <Tooltip contentStyle={{ backgroundColor: '#090E1A', borderColor: 'rgba(255,255,255,0.05)', fontSize: '8px' }} />
                          <Area type="monotone" dataKey="cpu" stroke="#6366F1" fill="url(#colorCpu)" strokeWidth={1} />
                          <Area type="monotone" dataKey="memory" stroke="#06B6D4" fill="none" strokeWidth={1} strokeDasharray="3 3" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="bg-[#05070E] p-3 rounded border border-white/[0.02] flex items-center justify-between text-[10px] font-mono">
                      <span className="text-muted uppercase font-semibold text-[8px]">Ingress Rate</span>
                      <span className="text-text font-bold">{inspectorMetrics.network}</span>
                    </div>
                  </div>
                )}

                {/* Console Output logs snippet */}
                <div className="flex-1 flex flex-col min-h-[160px] bg-[#05070E] rounded border border-white/[0.02] p-3 font-mono text-[9px] text-slate-350 select-text overflow-hidden">
                  <span className="text-[8px] text-slate-650 font-bold border-b border-white/[0.03] pb-1.5 mb-2 block flex items-center gap-1.5">
                    <Terminal className="h-3.5 w-3.5 text-primary-light" /> Console Logs Snippet
                  </span>
                  <div className="flex-1 overflow-y-auto space-y-1.5 max-h-[160px]">
                    {inspectorLogs.map((log, idx) => (
                      <div key={idx} className="break-all">{log}</div>
                    ))}
                  </div>
                </div>

                {/* Action controls */}
                <div className="pt-4 border-t border-white/[0.03] space-y-2 select-none">
                  {user?.role !== 'Viewer' && (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => selectedPodInspector && handleOpenTerminal(selectedPodInspector)}
                        className="rounded bg-primary/10 border border-primary/30 hover:bg-primary/20 py-2 text-[10px] font-bold font-mono uppercase text-primary flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Terminal className="h-3.5 w-3.5" /> Launch Pod Shell
                      </button>

                      <button
                        onClick={handleRestartPod}
                        disabled={isRestartingPod}
                        className="rounded bg-danger/10 border border-danger/30 hover:bg-danger/15 py-2 text-[10px] font-bold font-mono uppercase text-danger flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40"
                      >
                        {isRestartingPod ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Restarting...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="h-3.5 w-3.5" /> Force Terminate
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center text-muted my-auto">
                <Cpu className="h-14 w-14 mx-auto mb-4 stroke-1 text-slate-700 animate-pulse" />
                <h3 className="text-xs font-bold font-mono text-text uppercase">Audit Inspector</h3>
                <p className="text-[10px] text-muted mt-2 max-w-[180px] mx-auto font-mono">Click any pod node in the topology layout to mount resource inspector drawer and log streams.</p>
              </div>
            )}
          </div>
        </div>
      ) : activeTab === 'deployments' ? (
        /* DEPLOYMENTS TABLE */
        <div className="glass-panel overflow-hidden bg-panel/10 select-none">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/[0.04] bg-panel/30 text-[10px] font-bold uppercase tracking-wider text-muted font-mono">
                  <th className="p-4 pl-6">Name</th>
                  <th className="p-4">Replicas</th>
                  <th className="p-4">Image Target</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Created</th>
                  {user?.role !== 'Viewer' && <th className="p-4 pr-6 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.02] text-xs font-mono">
                {deployments.filter(d => d.name.toLowerCase().includes(searchQuery.toLowerCase())).map((dep) => (
                  <tr key={dep.name} className="hover:bg-slate-800/10 transition-colors">
                    <td className="p-4 pl-6 font-semibold text-text flex items-center gap-2">
                      <Layers className="h-4 w-4 text-primary-light" />
                      {dep.name}
                    </td>
                    <td className="p-4 font-mono">
                      <span className={`px-2 py-0.5 rounded text-[10px] ${
                        dep.readyReplicas === dep.replicas 
                          ? 'bg-success/15 text-success' 
                          : 'bg-warning/15 text-warning'
                      }`}>
                        {dep.readyReplicas} / {dep.replicas}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-[10px] text-muted max-w-[200px] truncate">{dep.image}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium ${dep.readyReplicas === dep.replicas ? 'text-success' : 'text-danger animate-pulse'}`}>
                        <CheckCircle2 className="h-3.5 w-3.5" /> {dep.status}
                      </span>
                    </td>
                    <td className="p-4 text-muted text-[10px] font-mono">{new Date(dep.createdAt).toLocaleString()}</td>
                    {user?.role !== 'Viewer' && (
                      <td className="p-4 pr-6 text-right">
                        <button
                          onClick={() => handleRollback(dep.name)}
                          disabled={isRollbackLoading === dep.name}
                          className="inline-flex items-center gap-1.5 rounded border border-danger/30 hover:bg-danger/10 px-2.5 py-1 text-[10px] font-bold text-danger transition-colors disabled:opacity-40"
                        >
                          {isRollbackLoading === dep.name ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Undo2 className="h-3.5 w-3.5" />
                          )}
                          Rollback
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'pods' ? (
        /* PODS LIST */
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 select-none">
          {pods.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).map((pod) => (
            <div key={pod.name} className="glass-panel p-5 bg-[#070B13]/60 hover:border-white/10 transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 max-w-[190px]">
                  <Cpu className="h-4 w-4 text-secondary-light shrink-0" />
                  <span className="font-semibold text-text text-xs truncate font-mono">{pod.name}</span>
                </div>
                <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                  pod.status === 'Running'
                    ? 'bg-success/15 text-success border border-success/30'
                    : pod.status === 'Pending'
                      ? 'bg-warning/15 text-warning border border-warning/30 animate-pulse'
                      : 'bg-danger/15 text-danger border border-danger/30'
                }`}>
                  {pod.status}
                </span>
              </div>

              <div className="space-y-2.5 pt-3 border-t border-white/[0.03] text-[10px] font-mono text-muted">
                <div className="flex items-center justify-between">
                  <span>Pod IP</span>
                  <span className="text-text">{pod.ip}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Cluster Node</span>
                  <span className="text-text">{pod.node}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Uptime</span>
                  <span className="text-text flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(pod.startedAt).toLocaleTimeString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : activeTab === 'services' ? (
        /* SERVICES TABLE */
        <div className="glass-panel overflow-hidden bg-panel/10 select-none">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/[0.04] bg-panel/30 text-[10px] font-bold uppercase tracking-wider text-muted font-mono">
                  <th className="p-4 pl-6">Name</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Cluster IP</th>
                  <th className="p-4 pr-6">External Ports</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.02] text-xs font-mono">
                {services.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase())).map((svc) => (
                  <tr key={svc.name} className="hover:bg-slate-800/10 transition-colors">
                    <td className="p-4 pl-6 font-semibold text-text flex items-center gap-2">
                      <Globe className="h-4 w-4 text-secondary" />
                      {svc.name}
                    </td>
                    <td className="p-4 text-muted text-[10px] font-mono">{svc.type}</td>
                    <td className="p-4 text-muted text-[10px] font-mono">{svc.clusterIP}</td>
                    <td className="p-4 pr-6 text-muted text-[10px] font-mono">{svc.ports}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* PROGRESSIVE RELEASES PANEL */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn select-none">
          {/* Blue-Green router */}
          <div className="rounded-xl border border-white/[0.04] bg-[#070B13]/60 p-6 space-y-4">
            <h3 className="text-xs font-bold font-mono text-text flex items-center gap-2 uppercase tracking-wider">
              <Globe className="h-5 w-5 text-secondary" />
              Blue-Green Traffic Router
            </h3>
            <p className="text-[11px] text-muted font-mono leading-relaxed">
              Instantly swap active HTTP traffic routing paths between stable Blue and green deployments.
            </p>

            <div className="space-y-4 pt-2">
              <div>
                <label className="block text-[9px] font-mono text-muted mb-1 uppercase">Target Service Router</label>
                <select
                  value={selectedServiceName}
                  onChange={(e) => setSelectedServiceName(e.target.value)}
                  className="w-full bg-[#05070E] border border-white/[0.04] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-text font-mono"
                >
                  {services.map(s => (
                    <option key={s.name} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-950/60 rounded-lg border border-white/[0.02]">
                <div className="text-center w-1/3">
                  <div className={`h-12 w-12 mx-auto rounded-full border-2 flex items-center justify-center font-mono text-xs font-bold ${
                    activeBlueGreenColor === 'blue' ? 'border-primary bg-primary/10 text-primary shadow-glow' : 'border-slate-800 text-slate-700'
                  }`}>
                    Blue
                  </div>
                  <span className="text-[9px] mt-1.5 block text-muted font-mono">v1.0.0-stable</span>
                </div>

                <div className="h-0.5 bg-white/[0.03] flex-1 mx-4 relative">
                  <span className="absolute inset-0 bg-gradient-to-r from-primary to-success" />
                </div>

                <div className="text-center w-1/3">
                  <div className={`h-12 w-12 mx-auto rounded-full border-2 flex items-center justify-center font-mono text-xs font-bold ${
                    activeBlueGreenColor === 'green' ? 'border-success bg-success/10 text-success shadow-glow-success' : 'border-slate-800 text-slate-700'
                  }`}>
                    Green
                  </div>
                  <span className="text-[9px] mt-1.5 block text-muted font-mono">v2.0.0-green</span>
                </div>
              </div>

              <div className="flex justify-between items-center text-[10px] font-mono">
                <span className="text-muted">Active Ingress Allocation:</span>
                <span className={`font-bold ${activeBlueGreenColor === 'blue' ? 'text-primary' : 'text-success'}`}>
                  {activeBlueGreenColor.toUpperCase()} DEPLOYMENT
                </span>
              </div>

              {user?.role !== 'Viewer' && (
                <button
                  onClick={handleBlueGreenSwap}
                  disabled={bgSwapping}
                  className="w-full flex items-center justify-center gap-1.5 rounded bg-primary py-2 text-xs font-bold font-mono uppercase text-white hover:bg-primary-dark transition-all duration-200 shadow-glow disabled:opacity-50"
                >
                  {bgSwapping ? 'Swapping Ingress route...' : 'Swap Traffic'}
                </button>
              )}
            </div>
          </div>

          {/* Canary Splitter */}
          <div className="rounded-xl border border-white/[0.04] bg-[#070B13]/60 p-6 space-y-4">
            <h3 className="text-xs font-bold font-mono text-text flex items-center gap-2 uppercase tracking-wider">
              <Layers className="h-5 w-5 text-primary-light" />
              Canary Traffic Selector
            </h3>
            <p className="text-[11px] text-muted font-mono leading-relaxed">
              Configure fine-grained traffic percentage rules to direct target percentages of traffic to Canary pods.
            </p>

            <div className="space-y-4 pt-2">
              <div>
                <label className="block text-[9px] font-mono text-muted mb-1 uppercase">Target Deployment</label>
                <select
                  value={selectedDeploymentName}
                  onChange={(e) => setSelectedDeploymentName(e.target.value)}
                  className="w-full bg-[#05070E] border border-white/[0.04] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-text font-mono"
                >
                  {deployments.map(d => (
                    <option key={d.name} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex justify-between text-[10px] font-mono text-muted mb-2">
                  <span>Stable: {100 - canaryWeight}%</span>
                  <span>Canary: {canaryWeight}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="10"
                  value={canaryWeight}
                  onChange={(e) => setCanaryWeight(Number(e.target.value))}
                  className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>

              <div className="p-4 bg-slate-950/40 rounded-lg border border-white/[0.02] text-[10px] font-mono text-muted space-y-2">
                <div className="flex justify-between">
                  <span>Allocated Canary pods:</span>
                  <span className="text-text font-bold">1 Replica</span>
                </div>
                <div className="flex justify-between">
                  <span>Allocated Stable pods:</span>
                  <span className="text-text font-bold">3 Replicas</span>
                </div>
              </div>

              {user?.role !== 'Viewer' && (
                <button
                  onClick={handleCanarySplit}
                  disabled={canaryApplying}
                  className="w-full flex items-center justify-center gap-1.5 rounded border border-primary/30 bg-primary/10 hover:bg-primary/20 py-2 text-xs font-bold font-mono uppercase text-primary transition-all duration-200"
                >
                  {canaryApplying ? 'Applying Canary Split...' : 'Apply Traffic Weight'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* INTERACTIVE POD TERMINAL MODAL */}
      {activeTerminalPod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-4xl bg-[#080B13] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[520px]">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-[#0A0E1A] border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/80 cursor-pointer" onClick={handleCloseTerminal} />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                </div>
                <div className="flex items-center gap-2 pl-2 border-l border-white/10">
                  <Terminal className="h-4 w-4 text-emerald-400" />
                  <span className="font-mono text-xs font-bold text-slate-200">
                    kubectl exec -it {activeTerminalPod.name} -n {activeTerminalPod.namespace} -- /bin/sh
                  </span>
                </div>
              </div>
              <button
                onClick={handleCloseTerminal}
                className="text-slate-400 hover:text-white font-mono text-xs px-2 py-1 rounded bg-white/5 hover:bg-white/10"
              >
                ESC / Close
              </button>
            </div>

            {/* Terminal Body */}
            <div className="flex-1 p-6 font-mono text-xs bg-[#05070E] text-slate-300 overflow-y-auto space-y-1">
              {terminalLogs.map((logLine, idx) => (
                <div key={idx} className="whitespace-pre-wrap leading-relaxed">
                  {logLine}
                </div>
              ))}
            </div>

            {/* Terminal Input Form */}
            <form onSubmit={handleSendTerminalCommand} className="p-3 bg-[#0A0E1A] border-t border-white/10 flex items-center gap-3">
              <span className="text-emerald-400 font-mono text-xs pl-3">$</span>
              <input
                type="text"
                value={terminalInput}
                onChange={(e) => setTerminalInput(e.target.value)}
                placeholder="Type command (e.g. ls, ps, top, env, help)..."
                className="flex-1 bg-transparent border-none text-xs font-mono text-white focus:outline-none placeholder:text-slate-600"
                autoFocus
              />
              <button
                type="submit"
                className="px-4 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded font-mono text-xs font-bold uppercase transition-colors"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
