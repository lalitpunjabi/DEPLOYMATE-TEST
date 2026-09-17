export interface PolicyRule {
  id: string;
  name: string;
  category: 'SECURITY' | 'RELIABILITY' | 'COMPLIANCE' | 'COST';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
}

export interface PolicyViolation {
  ruleId: string;
  ruleName: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
  remediation: string;
}

export interface EvaluationResult {
  score: number; // 0 - 100
  totalRulesEvaluated: number;
  passedCount: number;
  violationsCount: number;
  violations: PolicyViolation[];
  status: 'COMPLIANT' | 'WARNING' | 'NON_COMPLIANT';
}

export class PolicyEngine {
  private rules: PolicyRule[] = [
    { id: 'POL-001', name: 'Disallow Latest Tag', category: 'SECURITY', severity: 'HIGH', description: 'Container images must specify explicit version tags instead of :latest' },
    { id: 'POL-002', name: 'Resource Limits Required', category: 'RELIABILITY', severity: 'HIGH', description: 'Deployments must specify CPU and Memory requests and limits' },
    { id: 'POL-003', name: 'Run As Non-Root', category: 'SECURITY', severity: 'HIGH', description: 'Pod securityContext must enforce runAsNonRoot: true' },
    { id: 'POL-004', name: 'Ingress TLS Enforcement', category: 'SECURITY', severity: 'MEDIUM', description: 'Ingress routing rules must enforce TLS encryption' },
    { id: 'POL-005', name: 'No Unrestricted SSH Ingress', category: 'SECURITY', severity: 'HIGH', description: 'Terraform security groups must not expose SSH (22) to 0.0.0.0/0' },
    { id: 'POL-006', name: 'Mandatory Resource Tags', category: 'COMPLIANCE', severity: 'LOW', description: 'Infrastructure resources must include Environment and Owner tags' },
  ];

  public getRules(): PolicyRule[] {
    return this.rules;
  }

  public evaluate(content: string, type: 'k8s' | 'terraform'): EvaluationResult {
    const violations: PolicyViolation[] = [];

    if (type === 'k8s') {
      if (content.includes(':latest')) {
        violations.push({
          ruleId: 'POL-001',
          ruleName: 'Disallow Latest Tag',
          severity: 'HIGH',
          message: 'Image uses :latest tag which causes unpredictable deployments.',
          remediation: 'Pin container image to explicit semver tag (e.g. app:v1.2.4).'
        });
      }

      if (!content.includes('resources:') || !content.includes('limits:')) {
        violations.push({
          ruleId: 'POL-002',
          ruleName: 'Resource Limits Required',
          severity: 'HIGH',
          message: 'Missing pod resource requests/limits.',
          remediation: 'Specify resources.limits.cpu and resources.limits.memory in manifest.'
        });
      }

      if (!content.includes('runAsNonRoot: true')) {
        violations.push({
          ruleId: 'POL-003',
          ruleName: 'Run As Non-Root',
          severity: 'HIGH',
          message: 'Container executes as root user by default.',
          remediation: 'Add securityContext.runAsNonRoot: true to pod spec.'
        });
      }

      if (content.includes('kind: Ingress') && !content.includes('tls:')) {
        violations.push({
          ruleId: 'POL-004',
          ruleName: 'Ingress TLS Enforcement',
          severity: 'MEDIUM',
          message: 'Ingress manifest lacks TLS certificate block.',
          remediation: 'Configure tls spec with secretName.'
        });
      }
    } else {
      // Terraform checks
      if (content.includes('0.0.0.0/0') && (content.includes('22') || content.includes('ssh'))) {
        violations.push({
          ruleId: 'POL-005',
          ruleName: 'No Unrestricted SSH Ingress',
          severity: 'HIGH',
          message: 'Security group exposes port 22 to public internet (0.0.0.0/0).',
          remediation: 'Restrict ingress cidr_blocks to specific bastion or VPN IP ranges.'
        });
      }

      if (!content.includes('Environment') && !content.includes('tags')) {
        violations.push({
          ruleId: 'POL-006',
          ruleName: 'Mandatory Resource Tags',
          severity: 'LOW',
          message: 'Resource lacks required tags.',
          remediation: 'Add tags = { Environment = "Production", Owner = "DevOps" }.'
        });
      }
    }

    const totalRulesEvaluated = this.rules.length;
    const violationsCount = violations.length;
    const passedCount = totalRulesEvaluated - violationsCount;
    const score = Math.round((passedCount / totalRulesEvaluated) * 100);

    let status: 'COMPLIANT' | 'WARNING' | 'NON_COMPLIANT' = 'COMPLIANT';
    if (score < 60 || violations.some(v => v.severity === 'HIGH')) {
      status = 'NON_COMPLIANT';
    } else if (score < 90) {
      status = 'WARNING';
    }

    return {
      score,
      totalRulesEvaluated,
      passedCount,
      violationsCount,
      violations,
      status
    };
  }
}

export const policyEngine = new PolicyEngine();
