export interface RbacRoleSeed {
  name: string;
  permissions: Record<string, boolean | string[]>;
}

// Permission category keys MUST match the runtime checks in the routes
// (`authorize('projects','create')` / `checkPermission('pipelines.run')`, etc.).
// A previous singular/plural mismatch (e.g. seed `project` vs route `projects`,
// seed verb `execute` vs route verb `run`) caused non-admin grants to silently
// fail closed. These keys are now aligned so the documented least-privilege
// model is actually enforced. Capability levels are intentionally preserved.
export const RBAC_ROLES: RbacRoleSeed[] = [
  {
    name: 'Super Admin',
    permissions: {
      all: true,
      projects: ['read', 'create', 'delete'],
      pipelines: ['read', 'create', 'run', 'cancel'],
      deployments: ['read', 'create', 'promote', 'rollback'],
      terraform: ['read', 'plan', 'apply'],
      gitops: ['read', 'sync', 'rollback'],
      incident: ['read', 'create', 'resolve'],
      chaos: ['read', 'execute'],
      security: ['read', 'override'],
      logs: ['read'],
      ai: ['remediation.approve'],
      users: ['manage'],
      settings: ['manage'],
    },
  },
  {
    name: 'DevOps Engineer',
    permissions: {
      projects: ['read', 'create'],
      pipelines: ['read', 'create', 'run'],
      deployments: ['read', 'create', 'promote', 'rollback'],
      terraform: ['read', 'plan', 'apply'],
      gitops: ['read', 'sync', 'rollback'],
      incident: ['read', 'create', 'resolve'],
      chaos: ['read', 'execute'],
      security: ['read'],
      logs: ['read'],
      ai: ['remediation.approve'],
    },
  },
  {
    name: 'Developer',
    permissions: {
      projects: ['read'],
      pipelines: ['read', 'run'],
      deployments: ['read'],
      gitops: ['read'],
      terraform: ['read', 'plan'],
      incident: ['read', 'create'],
      security: ['read'],
      logs: ['read'],
    },
  },
  {
    name: 'Viewer',
    permissions: {
      projects: ['read'],
      pipelines: ['read'],
      deployments: ['read'],
      gitops: ['read'],
      terraform: ['read'],
      incident: ['read'],
      security: ['read'],
      logs: ['read'],
    },
  },
];
