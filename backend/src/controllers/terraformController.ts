import { Response } from 'express';
import { query } from '../config/db';
import { EventBus } from '../services/eventBus';
import { AuthenticatedRequest } from '../middleware/auth';
import { sendSafeError, isValidUuid } from '../utils/securityUtils';
import { insertAuditLog } from '../services/auditService';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

export async function generateTerraformCode(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { prompt } = req.body;

  if (!prompt) {
    res.status(400).json({ message: 'Description prompt is required.' });
    return;
  }

  try {
    const aiRes = await fetch(`${AI_SERVICE_URL}/api/v1/ai/terraform-generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });

    const data = (await aiRes.json()) as { engine?: string } | null;
    // Propagate the AI module's honest engine label (LIVE when Gemini really ran, SIMULATED otherwise)
    const engine = data && (data.engine === 'LIVE' || data.engine === 'SIMULATED') ? data.engine : 'SIMULATED';
    res.status(200).json(typeof data === 'object' && data !== null ? { ...data, execution_mode: engine } : { execution_mode: engine, data });
  } catch (error: any) {
    // Honest degraded mode: AI generator unreachable — never pass unlabeled mock output off as generated.
    console.warn('AI Service unreachable, returning DEGRADED fallback Terraform sample.', error);
    res.status(503).json({
      execution_mode: 'DEGRADED',
      message: 'AI Terraform generator is temporarily unavailable. The sample below is a static reference template, not AI-generated output.',
      configuration_code: `# Static reference sample (DEGRADED - AI generator unavailable, not AI-generated)
provider "aws" {
  region = "us-east-1"
}

resource "aws_security_group" "deploymate_sg" {
  name        = "deploymate-secure-sg"
  description = "Managed by Deploymate Platform Engine"

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"]
  }
}`
    });
  }
}

export async function planTerraform(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { project_id, stack_name, configuration_code } = req.body;

  if (!project_id || !stack_name || !configuration_code) {
    res.status(400).json({ message: 'Project ID, Stack Name, and HCL code are required.' });
    return;
  }

  if (!isValidUuid(project_id)) {
    res.status(400).json({ message: 'Invalid project ID format.' });
    return;
  }

  if (String(stack_name).length > 128 || String(stack_name).length < 2) {
    res.status(400).json({ message: 'Stack name must be between 2 and 128 characters.' });
    return;
  }

  try {
    // Policy check for dangerous configurations
    const violations: string[] = [];
    if (configuration_code.includes('0.0.0.0/0') && configuration_code.includes('22')) {
      violations.push('Policy Violation: Public SSH access (port 22 open to 0.0.0.0/0) is strictly prohibited.');
    }
    if (configuration_code.includes('acl = "public-read"')) {
      violations.push('Policy Violation: Public S3 bucket access is forbidden by enterprise compliance.');
    }

    const policyPassed = violations.length === 0;

    const logs = `[terraform init] Initializing Terraform state locks (SIMULATED)...
[terraform init] Provider plugins configured.
[terraform plan] Refreshing state for ${stack_name}...
[terraform plan] Policy Checks: ${policyPassed ? 'PASSED (0 violations)' : `FAILED (${violations.length} violations)`}
${violations.map(v => '[policy error] ' + v).join('\n')}
[terraform plan] Simulated Plan: 1 to add, 0 to change, 0 to destroy.`;

    const insertRes = await query(
      `INSERT INTO terraform_states (
         project_id, 
         stack_name, 
         configuration_code, 
         last_action, 
         last_status, 
         logs, 
         state_json
       ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        project_id,
        stack_name,
        configuration_code,
        'PLAN',
        policyPassed ? 'SUCCESS' : 'POLICY_BLOCKED',
        logs,
        JSON.stringify({ plan: '1 to add, 0 to change, 0 to destroy', policy_passed: policyPassed, violations, execution_mode: 'SIMULATED' })
      ]
    );

    await EventBus.emit({
      eventType: 'TERRAFORM_PLAN_EXECUTED',
      source: 'terraform',
      severity: policyPassed ? 'INFO' : 'WARNING',
      resource: stack_name,
      metadata: { policyPassed, violations, execution_mode: 'SIMULATED' }
    });

    res.status(200).json({
      message: policyPassed ? 'Simulated Terraform plan executed successfully.' : 'Simulated Terraform plan completed with policy violations.',
      execution_mode: 'SIMULATED',
      state: insertRes.rows[0]
    });
  } catch (error: any) {
    sendSafeError(res, error, 'Terraform plan failed.');
  }
}

export async function applyTerraform(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.body;

  if (!id) {
    res.status(400).json({ message: 'State record ID is required.' });
    return;
  }

  if (!isValidUuid(id)) {
    res.status(400).json({ message: 'Invalid state record ID format.' });
    return;
  }

  try {
    const checkRes = await query(`SELECT * FROM terraform_states WHERE id = $1`, [id]);
    if (checkRes.rowCount === 0) {
      res.status(404).json({ message: 'Terraform state record not found.' });
      return;
    }

    const state = checkRes.rows[0];
    const logs = state.logs + `\n[terraform apply] Applying simulated plan details...
[terraform apply] aws_security_group.${state.stack_name}: Simulated creation in progress...
[terraform apply] aws_security_group.${state.stack_name}: Simulated creation complete.
[terraform apply] Apply complete (SIMULATED MODE).`;

    const updateRes = await query(
      `UPDATE terraform_states 
       SET last_action = $1, last_status = $2, logs = $3, state_json = $4, updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [
        'APPLY',
        'SUCCESS',
        logs,
        JSON.stringify({
          applied_at: new Date().toISOString(),
          execution_mode: 'SIMULATED',
          resources: [
            { type: 'aws_security_group', name: state.stack_name, status: 'SIMULATED' }
          ]
        }),
        id
      ]
    );

    // Save audit log using authenticated user ID (project-scoped for tenant isolation)
    if (req.user?.id) {
      await insertAuditLog({
        userId: req.user.id,
        action: 'TERRAFORM_APPLY',
        resource: 'INFRASTRUCTURE',
        resourceId: state.id,
        projectId: state.project_id,
        details: { stack_name: state.stack_name, state_id: id, execution_mode: 'SIMULATED' },
        req,
      });
    }

    await EventBus.emit({
      eventType: 'TERRAFORM_APPLIED',
      source: 'terraform',
      severity: 'INFO',
      resource: state.stack_name,
      metadata: { stateId: id, execution_mode: 'SIMULATED' }
    });

    res.status(200).json({
      message: 'Simulated Terraform configuration applied.',
      execution_mode: 'SIMULATED',
      state: updateRes.rows[0]
    });
  } catch (error: any) {
    sendSafeError(res, error, 'Terraform apply failed.');
  }
}

export async function getTerraformStates(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { projectId } = req.query;

  if (!projectId) {
    res.status(400).json({ message: 'Project ID is required.' });
    return;
  }

  if (!isValidUuid(String(projectId))) {
    res.status(400).json({ message: 'Invalid project ID format.' });
    return;
  }

  try {
    const listRes = await query(
      `SELECT * FROM terraform_states 
       WHERE project_id = $1 
       ORDER BY updated_at DESC`,
      [projectId]
    );
    res.status(200).json(listRes.rows);
  } catch (error: any) {
    sendSafeError(res, error, 'Failed to retrieve Terraform states.');
  }
}
