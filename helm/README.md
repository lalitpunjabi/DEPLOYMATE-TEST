# DEPLOYMATE Kubernetes Helm Chart

### Production Kubernetes Deployment Chart

This directory contains the official **Helm 3** chart for deploying the complete **DEPLOYMATE Control Plane** onto Kubernetes (EKS, GKE, AKS, or Minikube/K3s).

---

## 1. Chart Structure

```text
helm/
├── Chart.yaml          # Helm chart metadata
├── values.yaml         # Configuration values (images, replicas, ports, envs)
└── templates/          # Kubernetes resource templates
    ├── deployment.yaml # Deployments for Frontend, Backend, and AI Module
    ├── service.yaml    # ClusterIP & LoadBalancer services
    └── ingress.yaml    # Ingress routing controller rules
```

---

## 2. Deployment Instructions

### Install or Upgrade Helm Release
```bash
helm upgrade --install deploymate ./helm --namespace deploymate --create-namespace
```

### Verify Deployed Pods
```bash
kubectl get pods -n deploymate
```

### Uninstall Release
```bash
helm uninstall deploymate -n deploymate
```
