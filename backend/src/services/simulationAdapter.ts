import { K8sPod, K8sDeployment, K8sService } from './k8sService';

export class SimulationAdapter {
  public static getMockPods(ns: string): K8sPod[] {
    return [
      { 
        name: 'deploymate-api-5d7f8c9b-abc12', 
        namespace: ns, 
        status: 'Running', 
        ip: '10.244.0.15', 
        node: 'node-control-plane', 
        startedAt: new Date(Date.now() - 3600000 * 24).toISOString() 
      },
      { 
        name: 'deploymate-api-5d7f8c9b-def34', 
        namespace: ns, 
        status: 'Running', 
        ip: '10.244.0.16', 
        node: 'node-worker-1', 
        startedAt: new Date(Date.now() - 3600000 * 24).toISOString() 
      },
      { 
        name: 'deploymate-ui-6b9f4d7a-xyz99', 
        namespace: ns, 
        status: 'Running', 
        ip: '10.244.1.20', 
        node: 'node-worker-2', 
        startedAt: new Date(Date.now() - 3600000 * 48).toISOString() 
      },
      { 
        name: 'fastapi-copilot-7c8f9b1c-7721a', 
        namespace: ns, 
        status: 'Running', 
        ip: '10.244.1.21', 
        node: 'node-worker-1', 
        startedAt: new Date(Date.now() - 3600000 * 12).toISOString() 
      },
    ];
  }

  public static getMockDeployments(ns: string): K8sDeployment[] {
    return [
      { 
        name: 'deploymate-api-deployment', 
        namespace: ns, 
        replicas: 2, 
        readyReplicas: 2, 
        image: 'deploymate/core-api:latest', 
        status: 'Available', 
        createdAt: new Date(Date.now() - 3600000 * 24).toISOString() 
      },
      { 
        name: 'deploymate-ui-deployment', 
        namespace: ns, 
        replicas: 1, 
        readyReplicas: 1, 
        image: 'deploymate/frontend-ui:latest', 
        status: 'Available', 
        createdAt: new Date(Date.now() - 3600000 * 48).toISOString() 
      },
      { 
        name: 'fastapi-copilot-deployment', 
        namespace: ns, 
        replicas: 1, 
        readyReplicas: 1, 
        image: 'deploymate/fastapi-copilot:v1.0.2', 
        status: 'Available', 
        createdAt: new Date(Date.now() - 3600000 * 12).toISOString() 
      }
    ];
  }

  public static getMockServices(ns: string): K8sService[] {
    return [
      { 
        name: 'deploymate-api-service', 
        namespace: ns, 
        type: 'ClusterIP', 
        clusterIP: '10.96.14.82', 
        ports: '5000:5000/TCP' 
      },
      { 
        name: 'deploymate-ui-service', 
        namespace: ns, 
        type: 'NodePort', 
        clusterIP: '10.96.220.101', 
        ports: '80:31200/TCP' 
      },
      { 
        name: 'fastapi-copilot-service', 
        namespace: ns, 
        type: 'ClusterIP', 
        clusterIP: '10.96.88.5', 
        ports: '8000:8000/TCP' 
      }
    ];
  }
}
