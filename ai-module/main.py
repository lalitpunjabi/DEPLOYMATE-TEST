import os
import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
import google.generativeai as genai
from dotenv import load_dotenv

from fastapi import FastAPI, HTTPException, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Dict, Optional
import google.generativeai as genai
from dotenv import load_dotenv

# Load env variables
load_dotenv()

app = FastAPI(title="Deploymate AI Engine", version="1.0.0")

AI_INTERNAL_TOKEN = os.getenv("AI_INTERNAL_TOKEN")
if not AI_INTERNAL_TOKEN and os.getenv("ENVIRONMENT") == "production":
    raise RuntimeError("FATAL SECURITY ERROR: AI_INTERNAL_TOKEN environment variable is missing in production mode.")
if not AI_INTERNAL_TOKEN:
    AI_INTERNAL_TOKEN = "deploymate-internal-ai-secret-token-dev-only"

allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://backend:5000,http://localhost:5000,http://localhost:5173").split(",")

# Enable CORS restricted to internal services
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# Internal Token Middleware
@app.middleware("http")
async def verify_internal_token(request: Request, call_next):
    if request.url.path in ["/", "/health", "/docs", "/openapi.json"]:
        return await call_next(request)
    
    token = request.headers.get("X-Internal-Token")
    if token != AI_INTERNAL_TOKEN and os.getenv("ENVIRONMENT") == "production":
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=401, content={"message": "Unauthorized internal AI service request."})
    
    return await call_next(request)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
is_live_gemini = False

if GEMINI_API_KEY and GEMINI_API_KEY.strip() != "":
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        is_live_gemini = True
        print("Gemini AI Client: Successfully authenticated SDK key.")
    except Exception as e:
        print("Gemini AI Client: Authentication failed. Falling back to simulator mode.")
else:
    print("Gemini AI Client: Running in SIMULATOR mode (No API Key provided).")

# --- Models ---
class LogInput(BaseModel):
    logs: str

class RiskInput(BaseModel):
    config_yaml: str

class GeneratorInput(BaseModel):
    project_type: str

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatInput(BaseModel):
    message: str
    history: List[ChatMessage] = []

class TerraformInput(BaseModel):
    prompt: str

class PodTroubleshootInput(BaseModel):
    pod_name: str
    namespace: str
    logs: str
    events: str


# --- Helper ---
def ask_gemini(prompt: str, system_instruction: Optional[str] = None, response_json: bool = False) -> str:
    if not is_live_gemini:
        raise ValueError("Gemini is not active")
    
    try:
        generation_config = {}
        if response_json:
            generation_config["response_mime_type"] = "application/json"
            
        model = genai.GenerativeModel(
            model_name="gemini-1.5-flash",
            system_instruction=system_instruction
        )
        response = model.generate_content(
            prompt,
            generation_config=generation_config if response_json else None
        )
        return response.text
    except Exception as e:
        print(f"Gemini API invocation error: {e}")
        raise e

# --- Routes ---
@app.get("/")
def root():
    return {
        "service": "Deploymate AI Engine API",
        "status": "HEALTHY",
        "swagger_docs": "http://localhost:8000/docs",
        "health_check": "http://localhost:8000/health"
    }

@app.get("/health")
def health():
    return {
        "status": "HEALTHY",
        "ai_engine": "GEMINI_FLASH_LIVE" if is_live_gemini else "SIMULATOR_ENGINE"
    }

@app.post("/api/v1/ai/pipeline-failure-analysis")
def analyze_pipeline_failure(data: LogInput):
    if not is_live_gemini:
        return {
            "root_cause": "The pipeline build failed in the 'Docker Build' stage due to missing compilation artifacts in dist/.",
            "confidence": 0.94,
            "evidence": [
                "npm run build script exited with error code 1",
                "COPY dist/ ./dist directive failed in Dockerfile",
                "TypeScript compilation errors detected in src/services/telemetry.ts"
            ],
            "recommendations": [
                "Fix TypeScript syntax error in src/services/telemetry.ts",
                "Ensure npm run build completes before running docker build"
            ],
            "risk": "LOW",
            "requiresApproval": False,
            "suggested_fixes": "1. Verify that your compile script executes cleanly.\n2. Check if the output folder exists before executing Docker COPY."
        }
    
    system_prompt = (
        "You are an expert DevOps SRE engineer. Analyze the CI/CD pipeline failure logs. "
        "Return structured JSON matching:\n"
        "{\n"
        "  \"root_cause\": string,\n"
        "  \"confidence\": number (0.0 to 1.0),\n"
        "  \"evidence\": [string],\n"
        "  \"recommendations\": [string],\n"
        "  \"suggested_fixes\": string,\n"
        "  \"risk\": \"LOW\" | \"MEDIUM\" | \"HIGH\",\n"
        "  \"requiresApproval\": boolean\n"
        "}"
    )
    prompt = f"Analyze these pipeline failure logs:\n\n{data.logs}"
    
    try:
        raw_result = ask_gemini(prompt, system_instruction=system_prompt, response_json=True)
        res = json.loads(raw_result)
        if "suggested_fixes" not in res:
            recs = res.get("recommendations", [])
            res["suggested_fixes"] = "\n".join(recs) if isinstance(recs, list) else str(recs)
        return res
    except Exception as e:
        return {
            "root_cause": "Build failure detected during stage execution.",
            "confidence": 0.85,
            "evidence": ["Log failure traceback detected in pipeline execution."],
            "recommendations": ["Inspect step logs and retry pipeline run."],
            "suggested_fixes": "1. Inspect step logs for details.\n2. Retry pipeline execution.",
            "risk": "LOW",
            "requiresApproval": False
        }

@app.post("/api/v1/ai/log-analysis")
def analyze_app_logs(data: LogInput):
    if not is_live_gemini:
        return {
            "summary": "Container logs indicate database connection pool exhaustion followed by ECR DNS lookup timeouts.",
            "root_cause": "Express API connection leaks exhausted PostgreSQL pool max_connections limit.",
            "confidence": 0.92,
            "evidence": [
                "HTTP 500 error spikes registered on authentication routes",
                "PostgreSQL client pool idle timeout warnings",
                "Pod restart count incremented"
            ],
            "recommendations": [
                "Increase database connection pool size",
                "Implement automatic client release inside a finally block",
                "Restart application deployment"
            ],
            "risk": "MEDIUM",
            "requiresApproval": True
        }
    
    system_prompt = (
        "You are an expert Site Reliability Engineer (SRE). Review application logs and diagnose root cause. "
        "Return structured JSON matching: { summary: string, root_cause: string, confidence: number, evidence: string[], recommendations: string[], risk: string, requiresApproval: boolean }"
    )
    prompt = f"Review the following application logs:\n\n{data.logs}"
    
    try:
        raw_result = ask_gemini(prompt, system_instruction=system_prompt, response_json=True)
        return json.loads(raw_result)
    except Exception as e:
        return {
            "summary": "Log analysis completed.",
            "root_cause": "Identified operational issues from application logs.",
            "confidence": 0.80,
            "evidence": ["Error logs detected in container stream."],
            "recommendations": ["Check backend database status and connection pools."],
            "risk": "LOW",
            "requiresApproval": False
        }

@app.post("/api/v1/ai/deployment-risk")
def assess_deployment_risk(data: RiskInput):
    if not is_live_gemini:
        return {
            "risk_score": 68,
            "risks": [
                {
                    "line": 7,
                    "type": "availability",
                    "severity": "medium",
                    "title": "Single Replica Risk",
                    "message": "Deployments with replicas=1 experience downtime during rolling updates. Increase to 2+.",
                    "targetKey": "replicas: 1",
                    "fixCode": "  replicas: 3"
                },
                {
                    "line": 13,
                    "type": "security",
                    "severity": "high",
                    "title": "Container Root Permission",
                    "message": "No securityContext runAsNonRoot restriction. Enforce non-root execution permissions.",
                    "targetKey": "      containers:",
                    "fixCode": "      securityContext:\n        runAsNonRoot: true\n        runAsUser: 10001\n      containers:"
                },
                {
                    "line": 14,
                    "type": "resource",
                    "severity": "high",
                    "title": "Missing CPU/Memory Limits",
                    "message": "No pod resource limitations specified. Can trigger node out-of-memory constraints.",
                    "targetKey": "      - name: main",
                    "fixCode": "      - name: main\n        resources:\n          limits:\n            cpu: \"500m\"\n            memory: \"512Mi\"\n          requests:\n            cpu: \"100m\"\n            memory: \"256Mi\""
                }
            ],
            "recommendations": "Integrate SecurityContext and Resource Constraints directly into manifest."
        }
    
    system_prompt = (
        "You are a Kubernetes Security Auditor. Audit the provided YAML manifest, compute a risk score (0-100), "
        "list issues with exact lines, targets, and fixes. Return output as valid JSON."
    )
    prompt = f"Audit the following Kubernetes manifest:\n\n{data.config_yaml}"
    
    try:
        raw_result = ask_gemini(prompt, system_instruction=system_prompt, response_json=True)
        return json.loads(raw_result)
    except Exception as e:
        return {
            "risk_score": 50,
            "risks": [],
            "recommendations": "Review manifest security contexts and resource constraints."
        }

@app.post("/api/v1/ai/generate-pipeline")
def generate_pipeline(data: GeneratorInput):
    p_type = data.project_type.lower()
    
    if not is_live_gemini:
        if "node" in p_type or "react" in p_type:
            pipeline_code = (
                "stages:\n"
                "  - stage: Source\n"
                "    script: git clone https://github.com/org/repo.git\n"
                "  - stage: Build\n"
                "    script: npm ci && npm run build\n"
                "  - stage: Test\n"
                "    script: npm test\n"
                "  - stage: Docker Build\n"
                "    script: docker build -t app:latest .\n"
                "  - stage: Deploy\n"
                "    script: kubectl apply -f k8s/deployment.yaml"
            )
        else:
            pipeline_code = (
                "stages:\n"
                "  - stage: Source\n"
                "    script: git clone\n"
                "  - stage: Build\n"
                "    script: mvn clean install\n"
                "  - stage: Test\n"
                "    script: mvn test\n"
                "  - stage: Docker Build\n"
                "    script: docker build -t app-java:latest .\n"
                "  - stage: Deploy\n"
                "    script: helm upgrade --install app-release ./charts"
            )
        return {
            "project_type": data.project_type,
            "pipeline_config": pipeline_code
        }
    
    system_prompt = "You are a DevOps Automation Architect. Generate production-grade CI/CD YAML configuration."
    prompt = f"Create a pipeline workflow file for a {data.project_type} application."
    
    try:
        raw_result = ask_gemini(prompt, system_instruction=system_prompt)
        return {
            "project_type": data.project_type,
            "pipeline_config": raw_result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/ai/chat")
def chat_assistant(data: ChatInput):
    if not is_live_gemini:
        msg = data.message.lower()
        if "kubernetes" in msg or "k8s" in msg:
            reply = "Deploymate visual explorer supports Namespaces, Pods, Deployments, and Services. You can rolling restart or roll back any deployment to its previous stable revision."
        elif "pipeline" in msg or "workflow" in msg:
            reply = "Deploymate features an 8-stage pipeline runner (Source, Build, Test, Code Quality, Security Scan, Docker Build, Image Push, Deploy) streaming execution logs over WebSockets."
        else:
            reply = "I am the Deploymate AI DevOps Co-Pilot. I can diagnose failed pipeline logs, assess manifest security risks, generate Terraform code, and explain cluster operations."
        return {"response": reply}
    
    chat_history = []
    for msg in data.history:
        chat_history.append({
            "role": "user" if msg.role == "user" else "model",
            "parts": [msg.content]
        })
        
    try:
        model = genai.GenerativeModel(
            model_name="gemini-1.5-flash",
            system_instruction=(
                "You are Deploymate SRE Assistant, an enterprise DevOps AI expert. "
                "Help developers with Kubernetes, Docker, Helm, Git, CI/CD, Prometheus, and troubleshooting."
            )
        )
        chat = model.start_chat(history=chat_history)
        response = chat.send_message(data.message)
        return {"response": response.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/ai/terraform-generate")
def generate_terraform(data: TerraformInput):
    if not is_live_gemini:
        return {
            "configuration_code": (
                "provider \"aws\" {\n"
                "  region = \"us-west-2\"\n"
                "}\n\n"
                "resource \"aws_s3_bucket\" \"deploymate_bucket\" {\n"
                "  bucket = \"deploymate-enterprise-storage-bucket\"\n"
                "  tags = {\n"
                "    Name        = \"Deploymate Storage\"\n"
                "    Environment = \"Production\"\n"
                "  }\n"
                "}\n\n"
                "resource \"aws_s3_bucket_server_side_encryption_configuration\" \"encryption\" {\n"
                "  bucket = aws_s3_bucket.deploymate_bucket.id\n"
                "  rule {\n"
                "    apply_server_side_encryption_by_default {\n"
                "      sse_algorithm = \"AES256\"\n"
                "    }\n"
                "  }\n"
                "}"
            )
        }

    system_prompt = "You are an expert Cloud Architect. Generate HashiCorp HCL configuration based on the prompt description."
    try:
        raw_result = ask_gemini(data.prompt, system_instruction=system_prompt)
        clean_code = raw_result.replace("```hcl", "").replace("```terraform", "").replace("```", "").strip()
        return {"configuration_code": clean_code}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/ai/pod-troubleshoot")
def troubleshoot_pod(data: PodTroubleshootInput):
    if not is_live_gemini:
        return {
            "analysis": f"The pod {data.pod_name} in namespace {data.namespace} is failing due to a CrashLoopBackOff error. The container logs show database connection failure because DB_HOST is set to localhost.",
            "recommendation": "1. Change DB_HOST from localhost to the database service name (e.g., deploymate-postgres-service).\n2. Verify that postgres server pod is running and accepting connections."
        }
    
    system_prompt = "You are a Kubernetes SRE specialist. Troubleshoot the pod crash using the logs and event logs provided."
    prompt = f"Pod: {data.pod_name}\nNamespace: {data.namespace}\nLogs:\n{data.logs}\nEvents:\n{data.events}"
    try:
        raw_result = ask_gemini(prompt, system_instruction=system_prompt)
        return {"analysis": raw_result, "recommendation": "Follow SRE recommendations above."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    is_prod = os.getenv("ENVIRONMENT") == "production" or os.getenv("NODE_ENV") == "production"
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=not is_prod, workers=4 if is_prod else 1)
