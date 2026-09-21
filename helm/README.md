# DEPLOYMATE Helm Chart

This chart deploys the DEPLOYMATE control plane components that exist in-repo:

* backend Deployment + Service (`backend:5000`)
* frontend Deployment + Service (`frontend:80`)
* AI module Deployment + Service (`ai-module:8000`)
* Ingress for HTTP(S) routing
* Opaque Secret for runtime credentials

PostgreSQL is **not** bundled. Point `env.dbHost` at a managed database or a separately installed Postgres instance, and run `db:init`, `db:migrate`, and `db:seed` before serving traffic.

Kubernetes is a supported alternative to Docker Compose. Compose (`docker-compose.prod.yml`) remains the documented single-host production path.

## Install

```bash
helm lint ./helm
helm template deploymate ./helm
helm upgrade --install deploymate ./helm \
  --namespace deploymate \
  --create-namespace \
  --set secrets.dbAppPassword='<runtime-db-password>' \
  --set secrets.jwtSecret='<jwt-secret>' \
  --set secrets.aiInternalToken='<ai-token>' \
  --set secrets.githubWebhookSecret='<webhook-secret>'
```

Do not commit real secret values into `values.yaml`.
