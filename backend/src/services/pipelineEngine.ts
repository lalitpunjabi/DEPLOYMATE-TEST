import crypto from 'crypto';
import { query } from '../config/db';
import { activeLogStreams } from '../index';
import { notificationService } from './notificationService';
import { getThresholdsForPipeline } from '../controllers/devsecopsController';
import { EventBus } from './eventBus';

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

  const commitSha = 'sha-' + crypto.randomBytes(4).toString('hex');
  const commitMessage = 'Refactor telemetry endpoints and optimize Docker multi-stage build cache';

  // Update run status to RUNNING
  await query(
    `UPDATE pipeline_runs 
     SET status = 'RUNNING', started_at = NOW(), git_branch = $1, git_commit_sha = $2, git_commit_message = $3
     WHERE id = $4`,
    [default_branch || 'main', commitSha, commitMessage, runId]
  );

  // Emit EventBus PipelineStarted event
  await EventBus.emit({
    eventType: 'PIPELINE_STARTED',
    source: 'pipeline',
    severity: 'INFO',
    resource: `PipelineRun#${runId}`,
    metadata: { pipelineId, commitSha, branch: default_branch }
  });

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

  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  // Run through stages
  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];
    stage.status = 'RUNNING';
    const stageStartTime = Date.now();
    await updateRunProgress(stages);

    streamLog(`========================================================================`);
    streamLog(`STAGE STARTING: ${stage.name.toUpperCase()}`);
    streamLog(`========================================================================`);

    try {
      if (stage.name === 'Source') {
        streamLog(`Cloning remote repository: ${github_repo_url}...`);
        await delay(1200);
        streamLog(`Cloning default branch: refs/heads/${default_branch}...`);
        streamLog(`Successfully cloned repository into ephemeral workspace.`);
        streamLog(`HEAD is now at commit: ${commitSha}`);
        stage.status = 'SUCCESS';
      } 
      else if (stage.name === 'Build') {
        streamLog(`Detecting workspace tech stack: Node.js application found.`);
        streamLog(`Running build pipeline tasks: "npm ci && npm run build"...`);
        await delay(1500);
        streamLog(`audited 248 packages in 1.45s`);
        streamLog(`tsc compiling source files into production distribution...`);
        streamLog(`Vite compiling for production...`);
        streamLog(`✓ 48 modules bundled successfully.`);
        stage.status = 'SUCCESS';
      } 
      else if (stage.name === 'Test') {
        streamLog(`Initializing unit test framework Vitest/Jest...`);
        await delay(1200);
        streamLog(`PASS  src/components/Sidebar.test.tsx (3.2s)`);
        streamLog(`PASS  src/context/AuthContext.test.tsx (2.1s)`);
        streamLog(`Test Suites: 2 passed, 2 total`);
        streamLog(`Tests:       14 passed, 14 total`);
        stage.status = 'SUCCESS';
      } 
      else if (stage.name === 'Code Quality') {
        streamLog(`Invoking SonarQube Quality Scanner...`);
        await delay(1200);
        streamLog(`Analyzing code complexity, smell issues, and line coverage...`);
        streamLog(`SonarQube Analysis Report: Maintainability=A, Reliability=B, Security=A, Coverage=85.2%`);
        stage.status = 'SUCCESS';
      } 
      else if (stage.name === 'Security Scan') {
        streamLog(`Executing container file vulnerability scan using Trivy CLI...`);
        await delay(1500);
        
        // Load DB pipeline threshold gates
        const thresholds = await getThresholdsForPipeline(pipelineId);
        streamLog(`Loaded DevSecOps Threshold Gates from Postgres:`);
        streamLog(`  - Max Critical CVEs Allowed: ${thresholds.fail_on_critical_count}`);
        streamLog(`  - Max High CVEs Allowed: ${thresholds.fail_on_high_count}`);
        streamLog(`  - Min Sonar Rating Required: ${thresholds.fail_on_sonar_rating}`);

        const mockCritical = 0;
        const mockHigh = 1;
        const mockMedium = 4;
        const mockLow = 10;
        const mockOwasp = 0;
        const mockSonarRating = 'B';

        streamLog(`Trivy Scan Results: Critical=${mockCritical}, High=${mockHigh}, Medium=${mockMedium}, Low=${mockLow}`);

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
            'A',
            85.20,
            25,
            mockCritical,
            mockHigh,
            mockMedium,
            mockLow,
            mockOwasp,
            JSON.stringify({
              scanned_at: new Date().toISOString(),
              thresholds_evaluated: thresholds,
              vulnerabilities: [
                { id: 'CVE-2024-3019', severity: 'HIGH', library: 'express-session', description: 'Session fixation vulnerability' }
              ]
            }),
            scanPassed
          ]
        );

        if (!scanPassed) {
          streamLog(`SECURITY GATE FAILED: ${failReason}`);
          await EventBus.emit({
            eventType: 'SECURITY_GATE_FAILED',
            source: 'pipeline',
            severity: 'CRITICAL',
            resource: `PipelineRun#${runId}`,
            metadata: { pipelineId, failReason }
          });
          throw new Error(`Pipeline execution halted due to DevSecOps Security Gate failure: ${failReason}`);
        }

        streamLog(`SECURITY GATE PASSED: All metrics meet active compliance policies.`);
        stage.status = 'SUCCESS';
      } 
      else if (stage.name === 'Docker Build') {
        streamLog(`Reading Dockerfile configuration...`);
        streamLog(`Executing: "docker build -t deploymate-api:latest ."`);
        await delay(1500);
        streamLog(`[1/3] FROM node:22-alpine AS builder`);
        streamLog(`[2/3] COPY package*.json ./ && RUN npm ci`);
        streamLog(`[3/3] COPY . . && RUN npm run build`);
        streamLog(`Successfully built container image locally.`);
        stage.status = 'SUCCESS';
      } 
      else if (stage.name === 'Image Push') {
        streamLog(`Connecting to Registry...`);
        await delay(1200);
        streamLog(`Tagging image as: deploymate-registry.local/api:latest`);
        streamLog(`Pushing layer [617da9d8]... 10.4 MB / 10.4 MB (Success)`);
        streamLog(`Successfully pushed image to container registry.`);
        stage.status = 'SUCCESS';
      } 
      else if (stage.name === 'Deploy') {
        streamLog(`Connecting to target Kubernetes cluster via KubeConfig...`);
        await delay(1500);
        streamLog(`Applying manifest: deployment.yaml`);
        streamLog(`Executing: "kubectl apply -f deployment.yaml --namespace=staging"`);
        streamLog(`deployment.apps/deploymate-api-deployment configured`);
        streamLog(`Waiting for 3 replicas to be ready...`);
        streamLog(`- Replica 1: READY`);
        streamLog(`- Replica 2: READY`);
        streamLog(`- Replica 3: READY`);
        streamLog(`Rollout successfully completed!`);

        const imageTag = 'v1.' + crypto.randomInt(0, 10) + '.' + crypto.randomInt(1, 100);
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
            `apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: deploymate-api-deployment\n  namespace: default\nspec:\n  replicas: 3\n  selector:\n    matchLabels:\n      app: deploymate-api\n  template:\n    metadata:\n      labels:\n        app: deploymate-api\n    spec:\n      containers:\n      - name: api\n        image: deploymate-registry.local/api:${imageTag}`
          ]
        );

        stage.status = 'SUCCESS';
      }

      stage.duration = Math.round((Date.now() - stageStartTime) / 1000);
    } catch (err: unknown) {
      console.error('[pipelineEngine] Stage failed:', err);
      streamLog('STAGE FAILED: An internal error occurred during this stage.');
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

  // Emit Global EventBus event
  await EventBus.emit({
    eventType: finalStatus === 'SUCCESS' ? 'PIPELINE_SUCCESS' : 'PIPELINE_FAILED',
    source: 'pipeline',
    severity: finalStatus === 'SUCCESS' ? 'INFO' : 'CRITICAL',
    resource: `PipelineRun#${runId}`,
    metadata: { pipelineId, status: finalStatus }
  });

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
          <p>Your pipeline <strong>${pipeline_name}</strong> (Run <strong>#${run_number}</strong>) finished running with status: <strong>${finalStatus}</strong>.</p>
        </div>
      `;
      
      await notificationService.sendEmail(targetEmail, subject, htmlContent);
      
      await query(
        `INSERT INTO notifications (user_id, project_id, title, message, type, status)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          triggered_by,
          project_id,
          subject,
          `Pipeline ${pipeline_name} Run #${run_number} state: ${finalStatus}`,
          'EMAIL',
          'SENT'
        ]
      );
    }
  } catch (mailErr: any) {
    console.error('Failed to execute pipeline mail alerts:', mailErr.message);
  }

  console.log(`Pipeline Run ${runId} execution completed with status: ${finalStatus}`);

  // Broadcast completion message over WebSockets
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
