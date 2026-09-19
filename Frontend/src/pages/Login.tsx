import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Lock, Mail, ArrowRight } from 'lucide-react';
import { ErrorState } from '../components/common/ErrorState';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
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
      await login({ email, password });
      navigate('/');
    } catch (err) {
      setError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-ghost-card border border-ghost-border rounded-2xl p-6 sm:p-8 shadow-2xl">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-ghost-darkest border border-ghost-border flex items-center justify-center mb-3">
            <ShieldCheck className="w-6 h-6 text-ghost-cyan" />
          </div>
          <h2 className="text-xl font-mono font-bold text-ghost-textPrimary tracking-wider uppercase">
            Authentication Gate
          </h2>
          <p className="text-xs font-mono text-ghost-textMuted mt-1">
            Access institutional quantitative intelligence and risk systems
          </p>
        </div>

        {error && (
          <div className="mb-5">
            <ErrorState error={error} title="Authentication Error" minHeight="min-h-[140px]" />
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 font-mono text-xs">
          <div>
            <label className="block text-ghost-textMuted uppercase text-2xs mb-1.5 tracking-wider">
              Operator Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-ghost-textMuted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@ghost.ai"
                className="w-full pl-9 pr-3 py-2 bg-ghost-darkest border border-ghost-border rounded-lg text-ghost-textPrimary placeholder:text-ghost-textMuted/60 focus:outline-none focus:border-ghost-cyan transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-ghost-textMuted uppercase text-2xs mb-1.5 tracking-wider">
              Secret Passphrase
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-ghost-textMuted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-9 pr-3 py-2 bg-ghost-darkest border border-ghost-border rounded-lg text-ghost-textPrimary placeholder:text-ghost-textMuted/60 focus:outline-none focus:border-ghost-cyan transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 bg-ghost-cyan text-ghost-darkest font-semibold rounded-lg hover:bg-ghost-cyan/90 transition-colors flex items-center justify-center gap-2 mt-2 disabled:opacity-50 tracking-wider uppercase text-xs shadow-lg shadow-ghost-cyan/10"
          >
            {isSubmitting ? (
              <span>Verifying Credentials...</span>
            ) : (
              <>
                <span>Sign In Session</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-ghost-border/60 text-center font-mono text-2xs text-ghost-textMuted">
          <span>Need platform authorization? </span>
          <Link to="/register" className="text-ghost-cyan hover:underline font-semibold">
            Register Operator Account
          </Link>
        </div>
      </div>
    </div>
  );
};
