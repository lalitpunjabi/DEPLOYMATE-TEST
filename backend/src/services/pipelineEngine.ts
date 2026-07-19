import { query } from '../config/db';
import { activeLogStreams } from '../index';
import { notificationService } from './notificationService';
import { getThresholdsForPipeline } from '../controllers/devsecopsController';

interface PipelineStep {
  name: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED';
  duration?: number;
}

export async function executePipelineRun(runId: string, pipelineId: string): Promise<void> {
  console.log(`Starting execution for Pipeline Run: ${runId}`);

  // Fetch pipeline definition and repository details
  const pipelineRes = await query(
    `SELECT p.definition, p.project_id, r.github_repo_url, r.default_branch 
     FROM pipelines p
     JOIN projects proj ON p.project_id = proj.id
     JOIN repositories r ON r.project_id = proj.id
     WHERE p.id = $1`,
    [pipelineId]
  );

  if (pipelineRes.rowCount === 0) {
    console.error(`Pipeline ${pipelineId} not found.`);
    return;
  }

  const { definition, project_id, github_repo_url, default_branch } = pipelineRes.rows[0];
  const stages: PipelineStep[] = Array.isArray(definition) 
    ? definition 
    : [
        { name: 'Source', status: 'PENDING' },
        { name: 'Build', status: 'PENDING' },
        { name: 'Test', status: 'PENDING' },
        { name: 'Code Quality', status: 'PENDING' },
        { name: 'Security Scan', status: 'PENDING' },
        { name: 'Docker Build', status: 'PENDING' },
        { name: 'Image Push', status: 'PENDING' },
        { name: 'Deploy', status: 'PENDING' }
      ];

  // Update run status to RUNNING
  await query(
    `UPDATE pipeline_runs 
     SET status = 'RUNNING', started_at = NOW(), git_branch = $1, git_commit_sha = $2, git_commit_message = $3
     WHERE id = $4`,
    [
      default_branch || 'main',
      'sha-' + Math.random().toString(16).substring(2, 10),
      'Refactor telemetry endpoints and optimize Docker multi-stage build cache',
      runId
    ]
  );

  let accumulatedLogs = '';
  let runFailed = false;

  const streamLog = (line: string) => {
    const timestampedLine = `[${new Date().toISOString()}] ${line}\n`;
    accumulatedLogs += timestampedLine;

    // Send log to connected WebSocket clients for this run ID
    const clients = activeLogStreams.get(runId);
    if (clients) {
      const payload = JSON.stringify({ type: 'log', line: timestampedLine });
      clients.forEach((ws) => {
        try {
          ws.send(payload);
        } catch {
          // Socket closed or error
        }
      });
    }
  };

  const updateRunProgress = async (currentStages: PipelineStep[]) => {
    await query(
      `UPDATE pipeline_runs 
       SET logs = $1 
       WHERE id = $2`,
      [accumulatedLogs, runId]
    );

    // Broadcast current stages status
    const clients = activeLogStreams.get(runId);
    if (clients) {
      const payload = JSON.stringify({ type: 'progress', stages: currentStages });
      clients.forEach((ws) => {
        try {
          ws.send(payload);
        } catch {
          // Socket closed
        }
      });
    }
  };

  // Helper delay
  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  // Run through stages
  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];
    stage.status = 'RUNNING';
    await updateRunProgress(stages);

    streamLog(`========================================================================`);
    streamLog(`STAGE STARTING: ${stage.name.toUpperCase()}`);
    streamLog(`========================================================================`);

    try {
      if (stage.name === 'Source') {
        streamLog(`Cloning remote repository: ${github_repo_url}...`);
        await delay(1500);
        streamLog(`Cloning default branch: refs/heads/${default_branch}...`);
        streamLog(`Successfully cloned repository into ephemeral workspace.`);
        streamLog(`HEAD is now at commit: sha-${Math.random().toString(16).substring(2, 10)}`);
        stage.status = 'SUCCESS';
      } 
      else if (stage.name === 'Build') {
        streamLog(`Detecting workspace tech stack: Node.js application found.`);
        streamLog(`Running build pipeline tasks: "npm ci && npm run build"...`);
        await delay(2000);
        streamLog(`audited 248 packages in 1.45s`);
        streamLog(`tsc compiling source files into production distribution...`);
        streamLog(`Vite v5.2.0 compiling for production...`);
        streamLog(`✓ 48 modules bundled.`);
        streamLog(`dist/index.html                     0.45 KiB │ gzip: 0.28 KiB`);
        streamLog(`dist/assets/index-D721A041.js     142.20 KiB │ gzip: 44.50 KiB`);
        streamLog(`Build command completed successfully.`);
        stage.status = 'SUCCESS';
      } 
      else if (stage.name === 'Test') {
        streamLog(`Initializing unit test framework Jest/Vitest...`);
        await delay(1500);
        streamLog(`PASS  src/components/Sidebar.test.tsx (4.2s)`);
        streamLog(`PASS  src/context/AuthContext.test.tsx (3.1s)`);
        streamLog(`PASS  src/services/telemetry.test.ts (2.0s)`);
        streamLog(`Test Suites: 3 passed, 3 total`);
        streamLog(`Tests:       18 passed, 18 total`);
        streamLog(`Snapshots:   0 total`);
        streamLog(`Time:        9.84s, estimated 10s`);
        streamLog(`All unit testing scenarios successfully validated.`);
        stage.status = 'SUCCESS';
      } 
      else if (stage.name === 'Code Quality') {
        streamLog(`Invoking SonarQube Quality Scanner...`);
        await delay(1500);
        streamLog(`Analyzing code complexity, smell issues, and line coverage...`);
        streamLog(`SonarQube Analysis Report:`);
        streamLog(`  - Maintainability Rating: A`);
        streamLog(`  - Reliability Rating: B`);
        streamLog(`  - Security Rating: B`);
        streamLog(`  - Code Smells: 4 detected (Minor)`);
        streamLog(`  - Technical Debt: 45 mins`);
        streamLog(`  - Code Coverage: 85.2%`);
        streamLog(`Quality Gate check successfully compiled.`);
        stage.status = 'SUCCESS';
      } 
      else if (stage.name === 'Security Scan') {
        streamLog(`Executing container file vulnerability scan using Trivy CLI...`);
        await delay(1800);
        streamLog(`Scanning local directory dependencies and configuration files...`);
        
        // Load pipeline threshold gates
        const thresholds = getThresholdsForPipeline(pipelineId);
        streamLog(`Loaded DevSecOps Threshold Gates:`);
        streamLog(`  - Max Critical CVEs Allowed: ${thresholds.fail_on_critical_count}`);
        streamLog(`  - Max High CVEs Allowed: ${thresholds.fail_on_high_count}`);
        streamLog(`  - Min Sonar Rating Required: ${thresholds.fail_on_sonar_rating}`);

        const mockCritical = 0;
        const mockHigh = 2;
        const mockMedium = 6;
        const mockLow = 15;
        const mockOwasp = 0;
        const mockSonarRating = 'B'; // Maps to 2 (A=1, B=2, C=3, D=4, F=5)

        streamLog(`Trivy Scan Results:`);
        streamLog(`  - Critical Vulnerabilities: ${mockCritical}`);
        streamLog(`  - High Vulnerabilities: ${mockHigh}`);
        streamLog(`  - Medium Vulnerabilities: ${mockMedium}`);
        streamLog(`  - Low Vulnerabilities: ${mockLow}`);
        streamLog(`  - OWASP Top 10 CVEs: ${mockOwasp}`);

        const ratingWeight = (r: string) => {
          if (r === 'A') return 1;
          if (r === 'B') return 2;
          if (r === 'C') return 3;
          if (r === 'D') return 4;
          return 5;
        };

        const thresholdWeight = ratingWeight(thresholds.fail_on_sonar_rating);
        const actualWeight = ratingWeight(mockSonarRating);

        let failed = false;
        let failReason = '';

        if (mockCritical > thresholds.fail_on_critical_count) {
          failed = true;
          failReason += `Critical CVE count (${mockCritical}) exceeds threshold (${thresholds.fail_on_critical_count}). `;
        }
        if (mockHigh > thresholds.fail_on_high_count) {
          failed = true;
          failReason += `High CVE count (${mockHigh}) exceeds threshold (${thresholds.fail_on_high_count}). `;
        }
        if (actualWeight > thresholdWeight) {
          failed = true;
          failReason += `Sonar Quality rating (${mockSonarRating}) is worse than allowed threshold (${thresholds.fail_on_sonar_rating}). `;
        }

        const scanPassed = !failed;

        // Insert scan record to Postgres
        await query(
          `INSERT INTO pipeline_security_scans (
             pipeline_run_id, 
             sonar_maintainability_score, 
             sonar_reliability_score, 
             sonar_security_score, 
             sonar_coverage_percentage, 
             sonar_technical_debt_minutes, 
             trivy_critical_count, 
             trivy_high_count, 
             trivy_medium_count, 
             trivy_low_count, 
             owasp_cve_count, 
             scan_report_json, 
             is_passed
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            runId,
            'A',
            'B',
            'B',
            85.20,
            45,
            mockCritical,
            mockHigh,
            mockMedium,
            mockLow,
            mockOwasp,
            JSON.stringify({
              scanned_at: new Date().toISOString(),
              thresholds_evaluated: thresholds,
              vulnerabilities: [
                { id: 'CVE-2024-3019', severity: 'HIGH', library: 'express-session', description: 'Session fixation vulnerability' },
                { id: 'CVE-2024-2101', severity: 'HIGH', library: 'jsonwebtoken', description: 'Key confusion signature bypass' },
                { id: 'CVE-2023-3001', severity: 'MEDIUM', library: 'pg', description: 'Socket leaks leading to DoS' }
              ]
            }),
            scanPassed
          ]
        );

        if (!scanPassed) {
          streamLog(`SECURITY GATE FAILED: ${failReason}`);
          throw new Error(`Pipeline execution halted due to DevSecOps Security Gate failure: ${failReason}`);
        }

        streamLog(`Trivy Scan result: OK (Vulnerability threshold not crossed)`);
        streamLog(`SECURITY GATE PASSED: All metrics meet compliance policies.`);
        stage.status = 'SUCCESS';
      } 
      else if (stage.name === 'Docker Build') {
        streamLog(`Reading Dockerfile configuration...`);
        streamLog(`Executing: "docker build -t deploymate-api:latest ."`);
        await delay(2000);
        streamLog(`[1/3] FROM node:22-alpine AS builder`);
        streamLog(`[2/3] COPY package*.json ./ && RUN npm ci`);
        streamLog(`[3/3] COPY . . && RUN npm run build`);
        streamLog(`Successfully built container image locally.`);
        streamLog(`Image ID: sha256:06ff2d7a22ef45b5c92c90c76db36a8cb1e5b89a8ff4a390eb1`);
        stage.status = 'SUCCESS';
      } 
      else if (stage.name === 'Image Push') {
        streamLog(`Connecting to AWS ECR / Docker Hub Registry...`);
        await delay(1500);
        streamLog(`Tagging image as: deploymate-registry.amazonaws.com/api:latest`);
        streamLog(`Pushing layer [617da9d8]... 10.4 MB / 10.4 MB (Success)`);
        streamLog(`Pushing layer [a7df2b8f]... 42.2 MB / 42.2 MB (Success)`);
        streamLog(`Successfully pushed image to AWS ECR registry.`);
        stage.status = 'SUCCESS';
      } 
      else if (stage.name === 'Deploy') {
        streamLog(`Connecting to target Kubernetes cluster via KubeConfig...`);
        await delay(2000);
        streamLog(`Checking namespace environment configurations...`);
        streamLog(`Applying configuration manifest: deployment.yaml`);
        streamLog(`Executing: "kubectl apply -f deployment.yaml --namespace=staging"`);
        streamLog(`deployment.apps/deploymate-api-deployment configured`);
        streamLog(`service/deploymate-api-service configured`);
        streamLog(`Verifying rollout status: "kubectl rollout status deployment/deploymate-api-deployment"...`);
        streamLog(`Waiting for 3 replicas to be ready...`);
        streamLog(`- Replica 1: READY`);
        streamLog(`- Replica 2: READY`);
        streamLog(`- Replica 3: READY`);
        streamLog(`Rollout successfully completed!`);

        // Save a mock Deployment record in database
        const imageTag = 'v' + Math.floor(Math.random() * 10) + '.' + Math.floor(Math.random() * 10) + '.' + Math.floor(Math.random() * 100);
        await query(
          `INSERT INTO deployments (project_id, pipeline_run_id, environment, namespace, deployment_name, image_tag, status, config_yaml)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            project_id,
            runId,
            'staging',
            'default',
            'deploymate-api-deployment',
            imageTag,
            'DEPLOYED',
            `apiVersion: apps/v1
kind: Deployment
metadata:
  name: deploymate-api-deployment
  namespace: default
spec:
  replicas: 3
  selector:
    matchLabels:
      app: deploymate-api
  template:
    metadata:
      labels:
        app: deploymate-api
    spec:
      containers:
      - name: api
        image: deploymate-registry.amazonaws.com/api:${imageTag}
        ports:
        - containerPort: 5000`
          ]
        );

        stage.status = 'SUCCESS';
      }
    } catch (err: any) {
      streamLog(`STAGE FAILED: ${err.message}`);
      stage.status = 'FAILED';
      runFailed = true;
    }

    await updateRunProgress(stages);

    if (runFailed) {
      break;
    }
  }

  // Update pipeline_runs status with final results
  const finalStatus = runFailed ? 'FAILED' : 'SUCCESS';
  await query(
    `UPDATE pipeline_runs 
     SET status = $1, completed_at = NOW() 
     WHERE id = $2`,
    [finalStatus, runId]
  );

  // Send email notification alert
  try {
    const runDetails = await query(
      `SELECT pr.run_number, p.name as pipeline_name, u.email as user_email, u.name as user_name, pr.triggered_by
       FROM pipeline_runs pr
       JOIN pipelines p ON pr.pipeline_id = p.id
       LEFT JOIN users u ON pr.triggered_by = u.id
       WHERE pr.id = $1`,
      [runId]
    );

    if (runDetails.rowCount && runDetails.rowCount > 0) {
      const { run_number, pipeline_name, user_email, user_name, triggered_by } = runDetails.rows[0];
      const targetEmail = user_email || 'admin@deploymate.com';
      const targetName = user_name || 'Administrator';
      
      const subject = `[DEPLOYMATE] Pipeline ${pipeline_name} Run #${run_number} - ${finalStatus}`;
      const htmlContent = `
        <div style="font-family: sans-serif; padding: 20px; background-color: #0B0F19; color: #F8FAFC; border-radius: 8px;">
          <h2 style="color: ${finalStatus === 'SUCCESS' ? '#10B981' : '#F43F5E'}">
            DEPLOYMATE Alert: Pipeline Execution ${finalStatus}
          </h2>
          <p>Hello ${targetName},</p>
          <p>Your pipeline <strong>${pipeline_name}</strong> (Run <strong>#${run_number}</strong>) has finished running with status: <strong>${finalStatus}</strong>.</p>
          <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.08); margin: 20px 0;" />
          <p style="font-size: 11px; color: #94A3B8; font-family: monospace;">This is an automated notification from the DEPLOYMATE CI/CD Platform.</p>
        </div>
      `;
      
      await notificationService.sendEmail(targetEmail, subject, htmlContent);
      
      // Save notification log record in database
      await query(
        `INSERT INTO notifications (user_id, project_id, title, message, type, status)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          triggered_by,
          project_id,
          subject,
          `Pipeline ${pipeline_name} Run #${run_number} execution state: ${finalStatus}`,
          'EMAIL',
          'SENT'
        ]
      );
    }
  } catch (mailErr: any) {
    console.error('Failed to execute pipeline mail alerts:', mailErr.message);
  }

  console.log(`Pipeline Run ${runId} execution completed with status: ${finalStatus}`);

  // Broadcast completion message
  const finalClients = activeLogStreams.get(runId);
  if (finalClients) {
    const payload = JSON.stringify({ type: 'status_update', status: finalStatus });
    finalClients.forEach((ws) => {
      try {
        ws.send(payload);
      } catch {
        // Socket closed
      }
    });
  }
}
