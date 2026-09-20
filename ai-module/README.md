# DEPLOYMATE AI Microservice (AIOps Engine)

### Python 3.11+ + FastAPI + Google GenAI SDK (`gemini-1.5-flash`)

The **DEPLOYMATE AI Microservice** provides intelligent AIOps capabilities to the platform. It executes structured log analysis, pipeline failure diagnostics, Kubernetes manifest security risk auditing, automated Terraform HCL generation, and interactive SRE co-pilot assistance.

---

## 1. Features & Endpoints

| Endpoint | Method | Input Model | Purpose |
| :--- | :---: | :--- | :--- |
| `/` | `GET` | — | Service title, status, and OpenAPI Swagger link (`/docs`) |
| `/health` | `GET` | — | Health check indicating active engine mode (`GEMINI_FLASH_LIVE` vs `SIMULATOR_ENGINE`) |
| `/api/v1/ai/pipeline-failure-analysis` | `POST` | `LogInput` | Parses CI/CD build failure logs, returns structured JSON root cause, confidence %, evidence list, recommendations, and suggested fixes |
| `/api/v1/ai/log-analysis` | `POST` | `LogInput` | Diagnoses runtime application & container logs |
| `/api/v1/ai/deployment-risk` | `POST` | `RiskInput` | Audits Kubernetes YAML specs for security risks (missing CPU/RAM limits, non-root execution, single replica) |
| `/api/v1/ai/generate-pipeline` | `POST` | `GeneratorInput` | Generates declarative CI/CD YAML configurations |
| `/api/v1/ai/chat` | `POST` | `ChatInput` | Interactive DevOps & SRE conversational co-pilot with history support |
| `/api/v1/ai/terraform-generate` | `POST` | `TerraformInput` | Generates HashiCorp HCL infrastructure code |
| `/api/v1/ai/pod-troubleshoot` | `POST` | `PodTroubleshootInput` | Analyzes pod crash loops using container logs and event streams |

---

## 2. Environment Setup

Create `.env` inside `ai-module/`:

```env
PORT=8000
GEMINI_API_KEY=<your_gemini_api_key_here>
```

> **Note:** If `GEMINI_API_KEY` is omitted or empty, the microservice gracefully operates in **SIMULATOR mode**, returning pre-cached structured SRE diagnostic outputs without throwing errors.

---

## 3. Development Commands

```bash
# Install dependencies
pip install -r requirements.txt

# Start FastAPI server with live reload
python main.py

# Check Python syntax
python -m py_compile main.py
```
