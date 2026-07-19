import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, KeyRound, User, Users, AlertTriangle } from 'lucide-react';

export const Register: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleName, setRoleName] = useState('Developer');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      const response = await fetch('http://localhost:5000/api/v1/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password, roleName }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Registration failed.');
      }

      setSuccess('Account created successfully! Redirecting to login...');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to connect to the backend server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#070A13] px-4 relative overflow-hidden">
      {/* Background Decorative Rings */}
      <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-primary/10 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-secondary/10 blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-md glass-panel p-8 shadow-2xl relative z-10 border-white/5 bg-panel/40">
        {/* Brand */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-secondary shadow-glow">
            <span className="text-xl font-bold text-white">DM</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-text">Create Account</h1>
          <p className="mt-1.5 text-sm text-muted">Join the DEPLOYMATE DevOps platform</p>
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-lg border border-danger/20 bg-danger/5 p-4 text-sm text-danger animate-pulse">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 flex items-center gap-3 rounded-lg border border-success/20 bg-success/5 p-4 text-sm text-success">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
            </span>
            <p>{success}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Full Name */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-2">Full Name</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted">
                <User className="h-5 w-5" />
              </span>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                className="w-full rounded-lg border border-border bg-[#0E1424] py-2.5 pl-10 pr-4 text-sm text-text placeholder:text-slate-600 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all font-sans"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-2">Email Address</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted">
                <Mail className="h-5 w-5" />
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john.doe@company.com"
                className="w-full rounded-lg border border-border bg-[#0E1424] py-2.5 pl-10 pr-4 text-sm text-text placeholder:text-slate-600 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all font-sans"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-2">Password</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted">
                <KeyRound className="h-5 w-5" />
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-border bg-[#0E1424] py-2.5 pl-10 pr-4 text-sm text-text placeholder:text-slate-600 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all font-sans"
              />
            </div>
          </div>

          {/* Role selection for easy testing */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-2">Platform Role</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted">
                <Users className="h-5 w-5" />
              </span>
              <select
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
                className="w-full rounded-lg border border-border bg-[#0E1424] py-2.5 pl-10 pr-4 text-sm text-text focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all font-sans appearance-none"
              >
                <option value="Developer" className="bg-[#0E1424] text-text">Developer</option>
                <option value="DevOps Engineer" className="bg-[#0E1424] text-text">DevOps Engineer</option>
                <option value="Viewer" className="bg-[#0E1424] text-text">Viewer</option>
              </select>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 rounded-lg bg-gradient-to-r from-primary to-secondary py-2.5 text-sm font-semibold text-white shadow-glow hover:shadow-glow-success hover:from-primary-hover hover:to-secondary-hover focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-muted">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-primary-light hover:underline hover:text-primary transition-colors">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};
