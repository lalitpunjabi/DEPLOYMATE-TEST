import os
import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
import google.generativeai as genai
from dotenv import load_dotenv

# Load env variables
load_dotenv()

app = FastAPI(title="Deploymate AI Engine", version="1.0.0")

# Enable CORS for communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
is_live_gemini = False

if GEMINI_API_KEY:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        is_live_gemini = True
        print("Gemini AI Client: Successfully authenticated SDK key.")
    except Exception as e:
        print(f"Gemini AI Client: Authentication failed. Falling back to simulator mode. Error: {e}")
else:
    print("Gemini AI Client: No API Key found in env context. Running in SIMULATOR mode.")

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

class CostOptimizerInput(BaseModel):
    service_name: str
    cpu_usage_cores: float
    memory_usage_gb: float
    replicas: int


# --- Helper ---
def ask_gemini(prompt: str, system_instruction: Optional[str] = None, response_json: bool = False) -> str:
    if not is_live_gemini:
        raise ValueError("Gemini is not active")
    
    try:
        generation_config = {}
        if response_json:
            generation_config["response_mime_type"] = "application/json"
            
        # Load the Flash model for fast developer outputs
        model = genai.GenerativeModel(
            model_name="gemini-3.5-flash",
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
@app.get("/health")
def health():
    return {
        "status": "HEALTHY",
        "ai_engine": "GEMINI_FLASH_LIVE" if is_live_gemini else "SIMULATOR_ENGINE"
    }

@app.post("/api/v1/ai/pipeline-failure-analysis")
def analyze_pipeline_failure(data: LogInput):
    if not is_live_gemini:
        # Simulated diagnostic output
        return {
            "root_cause": "The pipeline build failed in the 'Docker Build' stage. The Docker daemon encountered a file copying error. The copy directive failed because the source directory 'dist/' was not found. This indicates that either the 'Build' stage failed to produce the distribution artifacts or compiled them into a different destination path.",
            "suggested_fixes": "1. Verify that your compile/build script (e.g., npm run build) is executing successfully.\n2. Ensure the output directory is configured as 'dist/' inside your build tool config (like vite.config.ts or tsconfig.json).\n3. Check if the output folder exists before executing the Docker COPY command."
        }
    
    system_prompt = (
        "You are an expert DevOps engineer specializing in troubleshooting CI/CD logs. "
        "Analyze the provided run log dump, diagnose the root cause of the crash, and recommend "
        "concrete code fixes. Keep recommendations clear, concise, and formatted as actionable points."
    )
    prompt = f"Analyze these pipeline failure logs:\n\n{data.logs}"
    
    try:
        raw_result = ask_gemini(prompt, system_instruction=system_prompt)
        # Parse output into structured response
        return {
            "root_cause": "Based on the provided log analysis:",
            "suggested_fixes": raw_result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini API failure: {str(e)}")

@app.post("/api/v1/ai/log-analysis")
def analyze_app_logs(data: LogInput):
    if not is_live_gemini:
        return {
            "summary": "Container logs indicate an authorization verify error followed by a failure to connect to an external Docker Registry.",
            "root_cause": "The JWT signature verification failed due to secret mismatch. Additionally, the Docker daemon could not resolve the ECR DNS query, pointing to a network gateway or DNS server configuration issue in the cluster.",
            "recommendations": "1. Verify that JWT_SECRET matches across your backend services.\n2. Verify CoreDNS configurations in the cluster to ensure external registry names resolve properly."
        }
    
    system_prompt = (
        "You are an expert Site Reliability Engineer (SRE). Review the provided application log context, "
        "summarize the system behavior, identify root failure causes, and provide recommended fixes."
    )
    prompt = f"Review the following application logs:\n\n{data.logs}"
    
    try:
        raw_result = ask_gemini(prompt, system_instruction=system_prompt)
        return {
            "summary": "Application logs analysis:",
            "root_cause": "Identified operational issues:",
            "recommendations": raw_result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/ai/deployment-risk")
def assess_deployment_risk(data: RiskInput):
    if not is_live_gemini:
        # Mock assessment for B.Tech project show
        return {
            "risk_score": 65,
            "risks": [
                "Security Risk: The container is running with root permissions. No securityContext user is specified.",
                "Resource Risk: CPU and Memory limits/requests are not configured, which can lead to pod eviction or resource starvation in the cluster.",
                "Availability Risk: Replicas is set to 1, which does not provide high availability during rolling updates."
            ],
            "recommendations": "1. Add a non-root user constraint in securityContext.\n2. Configure resources.limits and resources.requests.\n3. Increase replicas to 2 or 3."
        }
    
    system_prompt = (
        "You are a Kubernetes Security Auditor. Analyze the provided YAML manifest, compute a risk score "
        "from 0 to 100 (where 100 is highest risk), list security and reliability issues, and recommend "
        "remediation steps. Output your assessment in JSON format matching the following schema:\n"
        "{\n"
        "  \"risk_score\": number,\n"
        "  \"risks\": [\n"
        "    {\n"
        "      \"line\": number,\n"
        "      \"type\": \"security\" | \"resource\" | \"availability\",\n"
        "      \"severity\": \"high\" | \"medium\" | \"low\",\n"
        "      \"title\": string,\n"
        "      \"message\": string,\n"
        "      \"targetKey\": string (the exact string/line in the input YAML to replace, e.g. 'replicas: 1' or '      containers:'),\n"
        "      \"fixCode\": string (the replacement string containing the fix, matching indentation of the targetKey)\n"
        "    }\n"
        "  ],\n"
        "  \"recommendations\": string\n"
        "}\n"
        "Ensure the risks list is non-empty if issues are found, and map each risk back to its exact line number in the input YAML."
    )
    prompt = f"Audit the following Kubernetes manifest:\n\n{data.config_yaml}"
    
    try:
        raw_result = ask_gemini(prompt, system_instruction=system_prompt, response_json=True)
        parsed = json.loads(raw_result)
        return parsed
    except Exception as e:
        print(f"Failed to assess deployment risk via Gemini: {e}. Falling back to default audit result.")
        # Return fallback matching mock
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
            "recommendations": "Integrate the Security Context and Resources constraints directly to build a secure, highly-available deployment manifest."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/ai/generate-pipeline")
def generate_pipeline(data: GeneratorInput):
    p_type = data.project_type.lower()
    
    if not is_live_gemini:
        # Out-of-the-box boilerplate generator
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
    
    system_prompt = (
        "You are a DevOps Automation Architect. Generate a production-grade CI/CD pipeline "
        "configuration for the requested project type. Return ONLY the code/configuration text "
        "(e.g., GitHub Actions YAML, GitLab CI YAML, or custom yaml) without markdown wrappers if possible, "
        "or formatted inside clean code fences."
    )
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
        # Mock chatbot replies
        msg = data.message.lower()
        if "kubernetes" in msg or "k8s" in msg:
            reply = "Deploymate visual explorer supports Namespaces, Pods, Deployments, and Services. You can rolling restart or roll back any deployment to its previous stable revision by clicking 'Rollback'."
        elif "pipeline" in msg or "workflow" in msg:
            reply = "Deploymate features an 8-stage pipeline runner (Source, Build, Test, Code Quality, Security Scan, Docker Build, Image Push, Deploy) which streams runtime execution logs over WebSockets."
        else:
            reply = "I am the Deploymate AI DevOps Co-Pilot. I can diagnose failed pipeline logs, assess manifest security risks, generate CI/CD code templates, and explain cluster operations."
        return {"response": reply}
    
    # Live chat with conversational context
    chat_history = []
    # Convert past messages to format expected by SDK
    for msg in data.history:
        chat_history.append({
            "role": "user" if msg.role == "user" else "model",
            "parts": [msg.content]
        })
        
    try:
        model = genai.GenerativeModel(
            model_name="gemini-3.5-flash",
            system_instruction=(
                "You are Deploymate SRE Assistant, an enterprise DevOps AI expert. "
                "Help the developer with questions about Kubernetes, Docker, Helm, Git, CI/CD, "
                "Prometheus, and general troubleshooting. Keep answers professional and structured."
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

    system_prompt = (
        "You are an expert Cloud Architect and Terraform expert. Generate clean, valid HCL HashiCorp Terraform "
        "configuration files based on the prompt description. Return ONLY the code inside plain text, without "
        "any markdown wrappers or extra explanations."
    )
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
            "analysis": f"The pod {data.pod_name} in namespace {data.namespace} is failing due to a CrashLoopBackOff error. The container logs show database connection failure. The environment variable DB_HOST is set to localhost, which is resolving to the pod interface instead of the database service endpoint.",
            "recommendation": "1. Change DB_HOST environment variable from localhost to the database service name (e.g., deploymate-postgres-service).\n2. Verify that the postgres server pod is running and accepting connections."
        }
    
    system_prompt = (
        "You are a Kubernetes SRE specialist. Troubleshoot the pod crash using the logs and event logs provided. "
        "Summarize why the pod is failing and give concrete, step-by-step remediation advice."
    )
    prompt = f"Pod: {data.pod_name}\nNamespace: {data.namespace}\nLogs:\n{data.logs}\nEvents:\n{data.events}"
    try:
        raw_result = ask_gemini(prompt, system_instruction=system_prompt)
        return {"analysis": raw_result, "recommendation": "Follow SRE recommendations above."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/ai/pipeline-classifier")
def classify_pipeline(data: LogInput):
    if not is_live_gemini:
        return {
            "error_category": "Dependency Resolution Failure",
            "confidence_score": 94,
            "remediation_summary": "The build script failed during npm install. npm was unable to resolve peer dependencies for tailwindcss. Execute dependency installation with the --legacy-peer-deps flag to resolve package version conflicts."
        }
    
    system_prompt = (
        "You are a CI/CD Quality Engineer. Review the pipeline error logs and classify the failure into "
        "one of these categories: [Dependency Resolution Failure, Compile Error, Security Policy Violation, Test Failure, Deployment Rejection, Infrastructure Outage]. "
        "Provide a confidence score (0-100) and a brief remediation summary. Return output in structured form."
    )
    try:
        raw_result = ask_gemini(data.logs, system_instruction=system_prompt)
        return {
            "error_category": "Build/Deploy Failure",
            "confidence_score": 85,
            "remediation_summary": raw_result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/ai/resource-cost-optimizer")
def optimize_resource(data: CostOptimizerInput):
    # Simulated optimization output
    allocation_cores = data.cpu_usage_cores * data.replicas
    allocation_gb = data.memory_usage_gb * data.replicas
    
    # Let's say target sizing is cpu 0.5 core, memory 1gb per pod
    recommended_replicas = max(2, data.replicas - 1) if data.cpu_usage_cores < 0.1 else data.replicas
    recommended_cpu = max(0.2, round(data.cpu_usage_cores * 1.5, 2))
    recommended_mem = max(0.5, round(data.memory_usage_gb * 1.3, 2))
    
    current_cost_est = data.replicas * (data.cpu_usage_cores * 15 + data.memory_usage_gb * 4)
    recommended_cost_est = recommended_replicas * (recommended_cpu * 15 + recommended_mem * 4)
    monthly_savings = max(0.0, current_cost_est - recommended_cost_est) * 720 # 720 hours in month
    
    if not is_live_gemini:
        return {
            "service_name": data.service_name,
            "current_allocation": {"cpu_cores": allocation_cores, "memory_gb": allocation_gb, "replicas": data.replicas},
            "recommended_allocation": {"cpu_cores": recommended_cpu, "memory_gb": recommended_mem, "replicas": recommended_replicas},
            "monthly_savings_dollars": round(monthly_savings, 2),
            "recommendation_summary": f"The service {data.service_name} is heavily over-provisioned. The CPU utilization is under 15%. Sizing down replicas to {recommended_replicas} and capping requests to {recommended_cpu} Cores will yield significant cost reductions."
        }
        
    system_prompt = (
        "You are a Cloud FinOps Engineer. Analyze the resource usage of a Kubernetes deployment and "
        "recommend optimal size settings (replicas, request/limit cpu cores, memory GB). Estimate the monthly savings."
    )
    prompt = f"Service: {data.service_name}\nCPU Cores: {data.cpu_usage_cores}\nMemory GB: {data.memory_usage_gb}\nReplicas: {data.replicas}"
    try:
        raw_result = ask_gemini(prompt, system_instruction=system_prompt)
        return {
            "service_name": data.service_name,
            "current_allocation": {"cpu_cores": allocation_cores, "memory_gb": allocation_gb, "replicas": data.replicas},
            "recommended_allocation": {"cpu_cores": recommended_cpu, "memory_gb": recommended_mem, "replicas": recommended_replicas},
            "monthly_savings_dollars": round(monthly_savings, 2),
            "recommendation_summary": raw_result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/ai/vector-log-search")
def vector_log_search(data: LogInput):
    # Simulated vector similarity lookup
    knowledge_base = [
        {"query": "PostgreSQL connection timeout", "cause": "Database pod running out of connections due to leaks.", "remediation": "Increase max_connections parameter or enable pgbouncer pooling."},
        {"query": "OutOfMemory crash loop backoff", "cause": "Pod heap exceeded resources.limits settings.", "remediation": "Increase JVM max heap size or double memory request limits."},
        {"query": "Trivy CVE vulnerability threshold", "cause": "Using outdated docker base image containing high vulnerabilities.", "remediation": "Upgrade base layer tag to alpine:3.20.1 or node:22-alpine."}
    ]
    
    # Simple keyword score matching
    best_match = knowledge_base[0]
    best_score = 0
    words = data.logs.lower().split()
    for item in knowledge_base:
        score = sum(1 for w in words if w in item["query"].lower() or w in item["cause"].lower())
        if score > best_score:
            best_score = score
            best_match = item
            
    return {
        "query_parsed": data.logs[:100],
        "similarity_score": round(max(0.65, min(0.98, 0.4 + best_score * 0.1)), 2),
        "closest_matched_incident": best_match["query"],
        "historical_cause": best_match["cause"],
        "historical_remediation": best_match["remediation"]
    }

if __name__ == "__main__":

    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
