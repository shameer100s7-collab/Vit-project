import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserPlus, Lock, Mail, User, ArrowRight } from 'lucide-react';
import { ErrorState } from '../components/common/ErrorState';

export const Register: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'USER' | 'ANALYST' | 'ADMIN'>('ANALYST');
  const [error, setError] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await register({
        email,
        password,
        full_name: fullName || undefined,
        role,
      });
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
            <UserPlus className="w-6 h-6 text-ghost-sand" />
          </div>
          <h2 className="text-xl font-bold text-ghost-textPrimary tracking-tight">
            Create your GHOST Account
          </h2>
          <p className="text-xs text-ghost-textMuted mt-1">
            Join GHOST for human-centered investment intelligence and evidence-based risk analysis
          </p>
        </div>

        {error && (
          <div className="mb-5">
            <ErrorState error={error} title="Registration Error" minHeight="min-h-[140px]" />
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-ghost-textMuted uppercase text-2xs mb-1.5 tracking-wider font-semibold">
              Full Name
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-ghost-textMuted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="John Doe"
                className="w-full pl-9 pr-3 py-2.5 bg-ghost-bg border border-ghost-border rounded-lg text-ghost-textPrimary placeholder:text-ghost-textMuted/60 focus:outline-none focus:border-ghost-sand transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-ghost-textMuted uppercase text-2xs mb-1.5 tracking-wider font-semibold">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-ghost-textMuted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="trader@ghost.ai"
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
                placeholder="Minimum 8 characters"
                className="w-full pl-9 pr-3 py-2.5 bg-ghost-bg border border-ghost-border rounded-lg text-ghost-textPrimary placeholder:text-ghost-textMuted/60 focus:outline-none focus:border-ghost-sand transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-ghost-textMuted uppercase text-2xs mb-1.5 tracking-wider font-semibold">
              Account Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as any)}
              className="w-full px-3 py-2.5 bg-ghost-bg border border-ghost-border rounded-lg text-ghost-textPrimary focus:outline-none focus:border-ghost-sand transition-colors"
            >
              <option value="ANALYST">Analyst (Full Telemetry & Courtroom)</option>
              <option value="USER">Standard User (Portfolio & Signals)</option>
              <option value="ADMIN">System Administrator</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 bg-ghost-burgundy hover:bg-[#6c1219] text-ghost-sand font-semibold rounded-lg border border-ghost-sand/30 transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-50 text-xs shadow-md shadow-ghost-burgundy/20"
          >
            {isSubmitting ? (
              <span>Creating Account...</span>
            ) : (
              <>
                <span>Complete Registration</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-ghost-border/60 text-center text-xs text-ghost-textMuted">
          <span>Already have an account? </span>
          <Link to="/login" className="text-ghost-sand hover:underline font-semibold">
            Sign In Here
          </Link>
        </div>
      </div>
    </div>
  );
};
