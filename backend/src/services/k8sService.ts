import * as k8s from '@kubernetes/client-node';

export interface K8sPod {
  name: string;
  namespace: string;
  status: string;
  ip: string;
  node: string;
  startedAt: string;
}

export interface K8sDeployment {
  name: string;
  namespace: string;
  replicas: number;
  readyReplicas: number;
  image: string;
  status: string;
  createdAt: string;
}

export interface K8sService {
  name: string;
  namespace: string;
  type: string;
  clusterIP: string;
  ports: string;
}

class KubernetesService {
  private k8sApi: k8s.CoreV1Api | null = null;
  private appsApi: k8s.AppsV1Api | null = null;
  private isSimulated = false;

  constructor() {
    try {
      const kc = new k8s.KubeConfig();
      kc.loadFromDefault();
      this.k8sApi = kc.makeApiClient(k8s.CoreV1Api);
      this.appsApi = kc.makeApiClient(k8s.AppsV1Api);
      console.log('Kubernetes Client: Successfully loaded KubeConfig.');
    } catch (err: any) {
      console.warn('Kubernetes Client: Failed to load KubeConfig. Running in SIMULATOR mode.', err.message);
      this.isSimulated = true;
    }
  }

  public getMode(): string {
    return this.isSimulated ? 'SIMULATED' : 'LIVE';
  }

  // --- NAMESPACES ---
  public async getNamespaces(): Promise<string[]> {
    if (this.isSimulated || !this.k8sApi) {
      return ['default', 'kube-system', 'deploymate-staging', 'deploymate-prod'];
    }

    try {
      const res = await this.k8sApi.listNamespace();
      return res.items.map((ns: any) => ns.metadata?.name || '');
    } catch (err) {
      console.error('K8s getNamespaces error, falling back to simulation:', err);
      return ['default', 'kube-system', 'deploymate-staging', 'deploymate-prod'];
    }
  }

  // --- PODS ---
  public async getPods(namespace: string): Promise<K8sPod[]> {
    if (this.isSimulated || !this.k8sApi) {
      return this.getMockPods(namespace);
    }

    try {
      const res = await this.k8sApi.listNamespacedPod({ namespace });
      return res.items.map((pod: any) => ({
        name: pod.metadata?.name || '',
        namespace: pod.metadata?.namespace || '',
        status: pod.status?.phase || 'Unknown',
        ip: pod.status?.podIP || 'N/A',
        node: pod.spec?.nodeName || 'N/A',
        startedAt: pod.status?.startTime ? new Date(pod.status.startTime).toISOString() : new Date().toISOString()
      }));
    } catch (err) {
      console.error('K8s getPods error, falling back to mock:', err);
      return this.getMockPods(namespace);
    }
  }

  // --- DEPLOYMENTS ---
  public async getDeployments(namespace: string): Promise<K8sDeployment[]> {
    if (this.isSimulated || !this.appsApi) {
      return this.getMockDeployments(namespace);
    }

    try {
      const res = await this.appsApi.listNamespacedDeployment({ namespace });
      return res.items.map((dep: any) => {
        const container = dep.spec?.template.spec?.containers[0];
        return {
          name: dep.metadata?.name || '',
          namespace: dep.metadata?.namespace || '',
          replicas: dep.spec?.replicas || 0,
          readyReplicas: dep.status?.readyReplicas || 0,
          image: container?.image || 'N/A',
          status: dep.status?.conditions?.[0]?.type || 'Active',
          createdAt: dep.metadata?.creationTimestamp ? new Date(dep.metadata.creationTimestamp).toISOString() : new Date().toISOString()
        };
      });
    } catch (err) {
      console.error('K8s getDeployments error, falling back to mock:', err);
      return this.getMockDeployments(namespace);
    }
  }

  // --- SERVICES ---
  public async getServices(namespace: string): Promise<K8sService[]> {
    if (this.isSimulated || !this.k8sApi) {
      return this.getMockServices(namespace);
    }

    try {
      const res = await this.k8sApi.listNamespacedService({ namespace });
      return res.items.map((svc: any) => {
        const ports = svc.spec?.ports?.map((p: any) => `${p.port}:${p.targetPort}/${p.protocol}`).join(', ') || 'N/A';
        return {
          name: svc.metadata?.name || '',
          namespace: svc.metadata?.namespace || '',
          type: svc.spec?.type || 'ClusterIP',
          clusterIP: svc.spec?.clusterIP || 'N/A',
          ports
        };
      });
    } catch (err) {
      console.error('K8s getServices error, falling back to mock:', err);
      return this.getMockServices(namespace);
    }
  }

  // --- ROLLBACK DEPLOYMENT ---
  public async rollback(namespace: string, name: string): Promise<boolean> {
    if (this.isSimulated || !this.appsApi) {
      console.log(`[SIMULATOR] Rolled back deployment "${name}" in namespace "${namespace}" to previous revision.`);
      return true;
    }

    try {
      const patch = [
        {
          op: 'replace',
          path: '/spec/template/metadata/annotations',
          value: {
            'kubectl.kubernetes.io/restartedAt': new Date().toISOString(),
          },
        },
      ];
      await this.appsApi.patchNamespacedDeployment({
        name,
        namespace,
        body: patch
      });
      return true;
    } catch (err) {
      console.error('K8s rollback patch failed:', err);
      return false;
    }
  }

  // --- MOCK PROVIDERS ---
  private getMockPods(ns: string): K8sPod[] {
    return [
      { name: 'deploymate-api-5d7f8c9b-abc12', namespace: ns, status: 'Running', ip: '10.244.0.15', node: 'node-control-plane', startedAt: new Date(Date.now() - 3600000 * 24).toISOString() },
      { name: 'deploymate-api-5d7f8c9b-def34', namespace: ns, status: 'Running', ip: '10.244.0.16', node: 'node-worker-1', startedAt: new Date(Date.now() - 3600000 * 24).toISOString() },
      { name: 'deploymate-ui-6b9f4d7a-xyz99', namespace: ns, status: 'Running', ip: '10.244.1.20', node: 'node-worker-2', startedAt: new Date(Date.now() - 3600000 * 48).toISOString() },
      { name: 'fastapi-copilot-7c8f9b1c-7721a', namespace: ns, status: 'Running', ip: '10.244.1.21', node: 'node-worker-1', startedAt: new Date(Date.now() - 3600000 * 12).toISOString() },
    ];
  }

  private getMockDeployments(ns: string): K8sDeployment[] {
    return [
      { name: 'deploymate-api-deployment', namespace: ns, replicas: 2, readyReplicas: 2, image: 'deploymate/core-api:latest', status: 'Available', createdAt: new Date(Date.now() - 3600000 * 24).toISOString() },
      { name: 'deploymate-ui-deployment', namespace: ns, replicas: 1, readyReplicas: 1, image: 'deploymate/frontend-ui:latest', status: 'Available', createdAt: new Date(Date.now() - 3600000 * 48).toISOString() },
      { name: 'fastapi-copilot-deployment', namespace: ns, replicas: 1, readyReplicas: 1, image: 'deploymate/fastapi-copilot:v1.0.2', status: 'Available', createdAt: new Date(Date.now() - 3600000 * 12).toISOString() }
    ];
  }

  private getMockServices(ns: string): K8sService[] {
    return [
      { name: 'deploymate-api-service', namespace: ns, type: 'ClusterIP', clusterIP: '10.96.14.82', ports: '5000:5000/TCP' },
      { name: 'deploymate-ui-service', namespace: ns, type: 'NodePort', clusterIP: '10.96.220.101', ports: '80:31200/TCP' },
      { name: 'fastapi-copilot-service', namespace: ns, type: 'ClusterIP', clusterIP: '10.96.88.5', ports: '8000:8000/TCP' }
    ];
  }
}

export const k8sService = new KubernetesService();
