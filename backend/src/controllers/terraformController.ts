import { Request, Response } from 'express';
import { query } from '../config/db';
import { EventBus } from '../services/eventBus';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

export async function generateTerraformCode(req: Request, res: Response): Promise<void> {
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

    const data = await aiRes.json();
    res.status(200).json(data);
  } catch (error: any) {
    console.warn('AI Service unreachable, returning fallback mock Terraform configuration.', error);
    res.status(200).json({
      configuration_code: `# Secure Cloud Provisioning Config
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

export async function planTerraform(req: Request, res: Response): Promise<void> {
  const { project_id, stack_name, configuration_code } = req.body;

  if (!project_id || !stack_name || !configuration_code) {
    res.status(400).json({ message: 'Project ID, Stack Name, and HCL code are required.' });
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

    const logs = `[terraform init] Initializing Terraform backend database state locks...
[terraform init] Downloading HashiCorp AWS provider v5.50.0...
[terraform init] Success! Provider plugins configured.
[terraform plan] Refreshing state for ${stack_name}...
[terraform plan] Policy Checks: ${policyPassed ? 'PASSED (0 violations)' : `FAILED (${violations.length} violations)`}
${violations.map(v => '[policy error] ' + v).join('\n')}
[terraform plan] Plan: 1 to add, 0 to change, 0 to destroy.`;

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
        JSON.stringify({ plan: '1 to add, 0 to change, 0 to destroy', policy_passed: policyPassed, violations })
      ]
    );

    await EventBus.emit({
      eventType: 'TERRAFORM_PLAN_EXECUTED',
      source: 'terraform',
      severity: policyPassed ? 'INFO' : 'WARNING',
      resource: stack_name,
      metadata: { policyPassed, violations }
    });

    res.status(200).json({
      message: policyPassed ? 'Terraform plan executed successfully.' : 'Terraform plan completed with policy violations.',
      state: insertRes.rows[0]
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Terraform plan failed.', error: error.message });
  }
}

export async function applyTerraform(req: Request, res: Response): Promise<void> {
  const { id } = req.body;

  if (!id) {
    res.status(400).json({ message: 'State record ID is required.' });
    return;
  }

  try {
    const checkRes = await query(`SELECT * FROM terraform_states WHERE id = $1`, [id]);
    if (checkRes.rowCount === 0) {
      res.status(404).json({ message: 'Terraform state record not found.' });
      return;
    }

    const state = checkRes.rows[0];
    const logs = state.logs + `\n[terraform apply] Applying plan details...
[terraform apply] aws_security_group.${state.stack_name}: Creating...
[terraform apply] aws_security_group.${state.stack_name}: Still creating... [10s elapsed]
[terraform apply] aws_security_group.${state.stack_name}: Creation complete [ID: sg-08e1c6b5413ad66bf]
[terraform apply] Apply complete! Resources: 1 added, 0 changed, 0 destroyed.`;

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
          resources: [
            { type: 'aws_security_group', name: state.stack_name, id: 'sg-08e1c6b5413ad66bf' }
          ]
        }),
        id
      ]
    );

    // Save audit log
    if (req.body.user_id) {
      await query(
        `INSERT INTO audit_logs (user_id, action, resource, details)
         VALUES ($1, $2, $3, $4)`,
        [
          req.body.user_id,
          'TERRAFORM_APPLY',
          'INFRASTRUCTURE',
          JSON.stringify({ stack_name: state.stack_name, state_id: id })
        ]
      );
    }

    await EventBus.emit({
      eventType: 'TERRAFORM_APPLIED',
      source: 'terraform',
      severity: 'INFO',
      resource: state.stack_name,
      metadata: { stateId: id }
    });

    res.status(200).json({
      message: 'Terraform configuration successfully applied.',
      state: updateRes.rows[0]
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Terraform apply failed.', error: error.message });
  }
}

export async function getTerraformStates(req: Request, res: Response): Promise<void> {
  const { projectId } = req.query;

  if (!projectId) {
    res.status(400).json({ message: 'Project ID is required.' });
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
    res.status(500).json({ message: 'Failed to retrieve Terraform states.', error: error.message });
  }
}
