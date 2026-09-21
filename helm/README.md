# DEPLOYMATE Helm Chart

This chart deploys the DEPLOYMATE control plane components that exist in-repo:

* backend Deployment + Service (`backend:5000`)
* frontend Deployment + Service (`frontend:80`)
* AI module Deployment + Service (`ai-module:8000`)
* Ingress for HTTP(S) routing
* Opaque Secret for runtime credentials

PostgreSQL is **not** bundled. `env.dbHost` has **no default** and is a required value — the chart deliberately does not silently assume an in-cluster `postgres` service. Point it at a managed database or a separately installed Postgres instance, and run `db:init`, `db:migrate`, and `db:seed` before serving traffic.

The following values are required (`helm lint`/`template` fail without them): `env.dbHost`, `secrets.dbAppPassword`, `secrets.jwtSecret`, `secrets.aiInternalToken`, `secrets.githubWebhookSecret`. Provide them at install time rather than committing to `values.yaml`.

Kubernetes is a supported alternative to Docker Compose. Compose (`docker-compose.prod.yml`) remains the documented single-host production path. Backend replicas are stateless: WebSocket single-use tickets and live log fan-out are stored in the shared PostgreSQL database (`LISTEN/NOTIFY`), so `helm template` renders safely with `replicaCount.backend > 1`.

## Install

```bash
helm lint ./helm \
  --set env.dbHost=pg.example.com \
  --set secrets.dbAppPassword='changeme' \
  --set secrets.jwtSecret='changeme' \
  --set secrets.aiInternalToken='changeme' \
  --set secrets.githubWebhookSecret='changeme'
helm template deploymate ./helm \
  --set env.dbHost=pg.example.com \
  --set secrets.dbAppPassword='changeme' \
  --set secrets.jwtSecret='changeme' \
  --set secrets.aiInternalToken='changeme' \
  --set secrets.githubWebhookSecret='changeme'
helm upgrade --install deploymate ./helm \
  --namespace deploymate \
  --create-namespace \
  --set env.dbHost='<your-postgres-host>' \
  --set secrets.dbAppPassword='<runtime-db-password>' \
  --set secrets.jwtSecret='<jwt-secret>' \
  --set secrets.aiInternalToken='<ai-token>' \
  --set secrets.githubWebhookSecret='<webhook-secret>'
```

Do not commit real secret values into `values.yaml`.
