import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Lock, User, ArrowRight } from 'lucide-react';
import { ErrorState } from '../components/common/ErrorState';

export const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login({ email: username.trim(), username: username.trim(), password });
      navigate('/');
    } catch (err) {
      setError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-ghost-card border border-ghost-border rounded-2xl p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-ghost-burgundy/20 border border-ghost-sand/30 flex items-center justify-center mb-3">
            <ShieldCheck className="w-6 h-6 text-ghost-sand" />
          </div>
          <h2 className="text-xl font-bold text-ghost-textPrimary tracking-tight">
            Welcome to GHOST
          </h2>
          <p className="text-xs text-ghost-textMuted mt-1">
            Investment intelligence that challenges your thinking
          </p>
        </div>

        {error && (
          <div className="mb-5">
            <ErrorState error={error} title="Authentication Error" minHeight="min-h-[140px]" />
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label htmlFor="username" className="block text-ghost-textMuted uppercase text-2xs mb-1.5 tracking-wider font-semibold">
              Username
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-ghost-textMuted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="test"
                className="w-full pl-9 pr-3 py-2.5 bg-ghost-bg border border-ghost-border rounded-lg text-ghost-textPrimary placeholder:text-ghost-textMuted/60 focus:outline-none focus:border-ghost-sand transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-ghost-textMuted uppercase text-2xs mb-1.5 tracking-wider font-semibold">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-ghost-textMuted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-9 pr-3 py-2.5 bg-ghost-bg border border-ghost-border rounded-lg text-ghost-textPrimary placeholder:text-ghost-textMuted/60 focus:outline-none focus:border-ghost-sand transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 bg-ghost-burgundy hover:bg-[#6c1219] text-ghost-sand font-semibold rounded-lg border border-ghost-sand/30 transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-50 text-xs shadow-md shadow-ghost-burgundy/20"
          >
            {isSubmitting ? (
              <span>Verifying credentials...</span>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-ghost-border/60 text-center text-xs text-ghost-textMuted">
          <span>Don't have an account? </span>
          <Link to="/register" className="text-ghost-sand hover:underline font-semibold">
            Create an account
          </Link>
          <div className="mt-4 pt-4 border-t border-ghost-border/40 text-2xs font-mono">
            <span className="block text-ghost-textMuted mb-0.5">Demo Account</span>
            <span className="block font-semibold text-ghost-textPrimary">Username: test &nbsp;|&nbsp; Password: 12345678</span>
          </div>
        </div>
      </div>
    </div>
  );
};
