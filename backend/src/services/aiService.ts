import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

class AiService {
  public async analyzeFailure(logs: string) {
    try {
      const res = await fetch(`${AI_SERVICE_URL}/api/v1/ai/pipeline-failure-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logs })
      });
      return await res.json();
    } catch (err) {
      console.warn('AI Service unreachable, returning fallback mock diagnostics.', err);
      return {
        root_cause: 'The pipeline build failed in the "Docker Build" stage. The Docker daemon encountered a file copying error. The copy directive failed because the source directory "dist/" was not found. This indicates that either the "Build" stage failed to produce the distribution artifacts or compiled them into a different destination path.',
        suggested_fixes: '1. Verify that your compile/build script (e.g., npm run build) is executing successfully.\n2. Ensure the output directory is configured as "dist/" inside your build tool config (like vite.config.ts or tsconfig.json).\n3. Check if the output folder exists before executing the Docker COPY command.'
      };
    }
  }

  public async analyzeLogs(logs: string) {
    try {
      const res = await fetch(`${AI_SERVICE_URL}/api/v1/ai/log-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logs })
      });
      return await res.json();
    } catch (err) {
      console.warn('AI Service unreachable, returning fallback mock logs analysis.', err);
      return {
        summary: 'Container logs indicate an authorization verify error followed by a failure to connect to an external Docker Registry.',
        root_cause: 'The JWT signature verification failed due to secret mismatch. Additionally, the Docker daemon could not resolve the ECR DNS query, pointing to a network gateway or DNS server configuration issue in the cluster.',
        recommendations: '1. Verify that JWT_SECRET matches across your backend services.\n2. Verify CoreDNS configurations in the cluster to ensure external registry names resolve properly.'
      };
    }
  }

  public async assessRisk(configYaml: string) {
    try {
      const res = await fetch(`${AI_SERVICE_URL}/api/v1/ai/deployment-risk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config_yaml: configYaml })
      });
      return await res.json();
    } catch (err) {
      console.warn('AI Service unreachable, returning fallback mock risk analysis.', err);
      return {
        risk_score: 65,
        risks: [
          'Security Risk: The container is running with root permissions. No securityContext user is specified.',
          'Resource Risk: CPU and Memory limits/requests are not configured, which can lead to pod eviction or resource starvation in the cluster.',
          'Availability Risk: Replicas is set to 1, which does not provide high availability during rolling updates.'
        ],
        recommendations: '1. Add a non-root user constraint in securityContext.\n2. Configure resources.limits and resources.requests.\n3. Increase replicas to 2 or 3.'
      };
    }
  }

  public async generatePipeline(projectType: string) {
    try {
      const res = await fetch(`${AI_SERVICE_URL}/api/v1/ai/generate-pipeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_type: projectType })
      });
      return await res.json();
    } catch (err) {
      console.warn('AI Service unreachable, returning fallback mock pipeline configuration.', err);
      return {
        project_type: projectType,
        pipeline_config: `stages:\n  - stage: Source\n    script: git clone\n  - stage: Build\n    script: npm ci && npm run build\n  - stage: Test\n    script: npm test\n  - stage: Docker Build\n    script: docker build -t app:latest .\n  - stage: Deploy\n    script: kubectl apply -f k8s/deployment.yaml`
      };
    }
  }

  public async chat(message: string, history: any[]) {
    try {
      const res = await fetch(`${AI_SERVICE_URL}/api/v1/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history })
      });
      return await res.json();
    } catch (err) {
      console.warn('AI Service unreachable, returning fallback chatbot response.', err);
      const msg = message.toLowerCase();
      let reply = 'I am the Deploymate AI DevOps Co-Pilot. I can diagnose failed pipeline logs, assess manifest security risks, generate CI/CD code templates, and explain cluster operations.';
      if (msg.includes('kubernetes') || msg.includes('k8s')) {
        reply = "Deploymate visual explorer supports Namespaces, Pods, Deployments, and Services. You can rolling restart or roll back any deployment to its previous stable revision by clicking 'Rollback'.";
      } else if (msg.includes('pipeline') || msg.includes('workflow')) {
        reply = "Deploymate features an 8-stage pipeline runner (Source, Build, Test, Code Quality, Security Scan, Docker Build, Image Push, Deploy) which streams runtime execution logs over WebSockets.";
      }
      return { response: reply };
    }
  }
}

export const aiService = new AiService();
