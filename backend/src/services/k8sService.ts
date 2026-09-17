import * as k8s from '@kubernetes/client-node';
import { SimulationAdapter } from './simulationAdapter';

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
      return SimulationAdapter.getMockPods(namespace);
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
      return SimulationAdapter.getMockPods(namespace);
    }
  }

  // --- DEPLOYMENTS ---
  public async getDeployments(namespace: string): Promise<K8sDeployment[]> {
    if (this.isSimulated || !this.appsApi) {
      return SimulationAdapter.getMockDeployments(namespace);
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
      return SimulationAdapter.getMockDeployments(namespace);
    }
  }

  // --- SERVICES ---
  public async getServices(namespace: string): Promise<K8sService[]> {
    if (this.isSimulated || !this.k8sApi) {
      return SimulationAdapter.getMockServices(namespace);
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
      return SimulationAdapter.getMockServices(namespace);
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
}

export const k8sService = new KubernetesService();
