import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { FolderGit2, Plus, GitBranch, Terminal, Globe, Search, Loader2, Sparkles, Code, AlertTriangle } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  description: string;
  github_repo_url: string;
  default_branch: string;
  environment: string;
  created_at: string;
}

export const Projects: React.FC = () => {
  const { token, user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [environment, setEnvironment] = useState('dev');
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Default Mock Projects for out-of-the-box B.Tech showcase
  const mockProjects: Project[] = [
    {
      id: 'p1',
      name: 'deploymate-api',
      description: 'Node.js Express microservice backend for core orchestration and webhook ingestion.',
      github_repo_url: 'https://github.com/deploymate/core-api',
      default_branch: 'main',
      environment: 'staging',
      created_at: new Date(Date.now() - 3600000 * 24 * 5).toISOString(),
    },
    {
      id: 'p2',
      name: 'deploymate-ui',
      description: 'React SPA dashboard featuring ShadCN components and Tailwind styling.',
      github_repo_url: 'https://github.com/deploymate/frontend-ui',
      default_branch: 'main',
      environment: 'prod',
      created_at: new Date(Date.now() - 3600000 * 24 * 10).toISOString(),
    },
    {
      id: 'p3',
      name: 'fastapi-copilot',
      description: 'Python FastAPI service connecting to Gemini Pro for pipeline diagnostics.',
      github_repo_url: 'https://github.com/deploymate/fastapi-copilot',
      default_branch: 'develop',
      environment: 'dev',
      created_at: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
    }
  ];

  const fetchProjects = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/v1/projects', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setProjects(data.length > 0 ? data : mockProjects);
      } else {
        setProjects(mockProjects);
      }
    } catch {
      // Fallback to mocks if backend is down or not implemented yet
      setProjects(mockProjects);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [token]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !repoUrl) {
      setError('Project Name and GitHub Repository URL are required.');
      return;
    }

    setError(null);
    setIsCreating(true);

    try {
      const response = await fetch('http://localhost:5000/api/v1/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name, description, github_repo_url: repoUrl, default_branch: branch, environment }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create project.');
      }

      // Refresh list
      fetchProjects();
      setIsModalOpen(false);
      // Reset form
      setName('');
      setDescription('');
      setRepoUrl('');
      setBranch('main');
      setEnvironment('dev');
    } catch (err: any) {
      // If backend post fails (e.g. mock mode), create locally in UI list to keep demo working
      const localNew: Project = {
        id: `p-${Date.now()}`,
        name,
        description,
        github_repo_url: repoUrl,
        default_branch: branch,
        environment,
        created_at: new Date().toISOString()
      };
      setProjects([localNew, ...projects]);
      setIsModalOpen(false);
      setName('');
      setDescription('');
      setRepoUrl('');
      setBranch('main');
      setEnvironment('dev');
    } finally {
      setIsCreating(false);
    }
  };

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text">Workspace Projects</h1>
          <p className="text-sm text-muted">Create, configure, and connect your source repositories to pipelines.</p>
        </div>
        {user?.role !== 'Viewer' && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-secondary px-4 py-2 text-sm font-semibold text-white shadow-glow hover:shadow-glow-success hover:from-primary-hover hover:to-secondary-hover transition-all"
          >
            <Plus className="h-4 w-4" />
            Create Project
          </button>
        )}
      </div>

      {/* Search Filter */}
      <div className="flex items-center gap-3 glass-panel px-4 py-3 bg-panel/30">
        <Search className="h-5 w-5 text-muted" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter projects by name or description..."
          className="flex-1 bg-transparent text-sm text-text focus:outline-none placeholder:text-slate-600"
        />
      </div>

      {/* Projects Grid */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center p-16 glass-panel bg-panel/10">
          <FolderGit2 className="h-16 w-16 text-muted mb-4 stroke-1" />
          <h3 className="text-lg font-semibold text-text">No Projects Found</h3>
          <p className="text-sm text-muted max-w-sm mt-1">Get started by creating your first project container and linking it to GitHub.</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => (
            <div key={project.id} className="glass-panel glass-panel-hover p-6 flex flex-col justify-between min-h-[220px]">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1D283F] border border-border text-primary-light">
                      <Code className="h-5 w-5" />
                    </div>
                    <h3 className="font-semibold text-text text-base truncate max-w-[150px]">{project.name}</h3>
                  </div>
                  <span className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${
                    project.environment === 'prod' 
                      ? 'bg-danger/10 text-danger border border-danger/20' 
                      : project.environment === 'staging' 
                        ? 'bg-warning/10 text-warning border border-warning/20'
                        : 'bg-primary/10 text-primary-light border border-primary/20'
                  }`}>
                    {project.environment}
                  </span>
                </div>
                <p className="text-sm text-muted line-clamp-3 mb-6 font-sans leading-relaxed">{project.description}</p>
              </div>

              <div className="space-y-3 pt-4 border-t border-border/50">
                <div className="flex items-center justify-between text-xs text-muted font-mono">
                  <span className="flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5" /> Source Repo
                  </span>
                  <a href={project.github_repo_url} target="_blank" rel="noopener noreferrer" className="text-primary-light hover:underline truncate max-w-[140px]">
                    {project.github_repo_url.replace('https://github.com/', '')}
                  </a>
                </div>
                <div className="flex items-center justify-between text-xs text-muted font-mono">
                  <span className="flex items-center gap-1.5">
                    <GitBranch className="h-3.5 w-3.5" /> Default Branch
                  </span>
                  <span className="text-text">{project.default_branch}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted font-mono">
                  <span className="flex items-center gap-1.5">
                    <Terminal className="h-3.5 w-3.5" /> Created
                  </span>
                  <span className="text-text">{new Date(project.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Project Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg glass-panel p-8 shadow-2xl border-white/5 bg-panel/90 relative animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-xl font-bold text-text mb-2 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary-light" />
              Create New Project
            </h2>
            <p className="text-sm text-muted mb-6">Setup repository configurations to link CI/CD workflow triggers.</p>

            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-danger/20 bg-danger/5 p-3 text-xs text-danger">
                <AlertTriangle className="h-4 w-4" />
                <p>{error}</p>
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Project Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. payment-gateway"
                  className="w-full rounded-lg border border-border bg-[#0E1424] py-2 px-3 text-sm text-text focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all font-sans"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Summarize the project's purpose..."
                  rows={3}
                  className="w-full rounded-lg border border-border bg-[#0E1424] py-2 px-3 text-sm text-text focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all font-sans resize-none"
                />
              </div>

              {/* Repository URL */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">GitHub Repository URL</label>
                <input
                  type="url"
                  required
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="https://github.com/username/repo"
                  className="w-full rounded-lg border border-border bg-[#0E1424] py-2 px-3 text-sm text-text focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all font-sans"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Branch */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Branch</label>
                  <input
                    type="text"
                    required
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    placeholder="main"
                    className="w-full rounded-lg border border-border bg-[#0E1424] py-2 px-3 text-sm text-text focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all font-sans"
                  />
                </div>

                {/* Target Environment */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Environment</label>
                  <select
                    value={environment}
                    onChange={(e) => setEnvironment(e.target.value)}
                    className="w-full rounded-lg border border-border bg-[#0E1424] py-2 px-3 text-sm text-text focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all font-sans"
                  >
                    <option value="dev">dev</option>
                    <option value="staging">staging</option>
                    <option value="prod">prod</option>
                  </select>
                </div>
              </div>

              {/* Controls */}
              <div className="flex justify-end gap-3 pt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg border border-border bg-transparent px-4 py-2 text-sm font-semibold text-muted hover:text-text hover:bg-slate-800/40 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="rounded-lg bg-gradient-to-r from-primary to-secondary px-4 py-2 text-sm font-semibold text-white shadow-glow hover:shadow-glow-success hover:from-primary-hover hover:to-secondary-hover transition-all flex items-center gap-1.5"
                >
                  {isCreating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Create'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
