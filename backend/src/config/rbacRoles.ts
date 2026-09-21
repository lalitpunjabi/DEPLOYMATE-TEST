export interface RbacRoleSeed {
  name: string;
  permissions: Record<string, boolean | string[]>;
}

export const RBAC_ROLES: RbacRoleSeed[] = [
  {
    name: 'Super Admin',
    permissions: {
      all: true,
      project: ['read', 'write', 'delete'],
      pipeline: ['read', 'create', 'execute', 'cancel'],
      deployment: ['read', 'create', 'promote', 'rollback'],
      terraform: ['read', 'plan', 'apply'],
      gitops: ['read', 'sync', 'rollback'],
      incident: ['read', 'create', 'resolve'],
      chaos: ['read', 'execute'],
      security: ['read', 'override'],
      ai: ['remediation.approve'],
      users: ['manage'],
      settings: ['manage'],
    },
  },
  {
    name: 'DevOps Engineer',
    permissions: {
      project: ['read', 'write'],
      pipeline: ['read', 'create', 'execute'],
      deployment: ['read', 'create', 'promote', 'rollback'],
      terraform: ['read', 'plan', 'apply'],
      gitops: ['read', 'sync', 'rollback'],
      incident: ['read', 'create', 'resolve'],
      chaos: ['read', 'execute'],
      security: ['read'],
      ai: ['remediation.approve'],
    },
  },
  {
    name: 'Developer',
    permissions: {
      project: ['read'],
      pipeline: ['read', 'execute'],
      deployment: ['read'],
      gitops: ['read'],
      terraform: ['read', 'plan'],
      incident: ['read', 'create'],
      security: ['read'],
    },
  },
  {
    name: 'Viewer',
    permissions: {
      project: ['read'],
      pipeline: ['read'],
      deployment: ['read'],
      gitops: ['read'],
      terraform: ['read'],
      incident: ['read'],
      security: ['read'],
    },
  },
];
