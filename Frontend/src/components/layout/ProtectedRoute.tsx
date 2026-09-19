import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useProfile } from '../../context/ProfileContext';

export const ProtectedRoute: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { profile, isLoading: profileLoading } = useProfile();
  const location = useLocation();

  if (authLoading) return <div className="min-h-screen bg-ghost-bg text-ghost-sand p-8 flex items-center justify-center">Authenticating...</div>;
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (profileLoading) return <div className="min-h-screen bg-ghost-bg text-ghost-sand p-8 flex items-center justify-center">Loading profile...</div>;

  // If authenticated but no profile, force them to onboarding
  // Unless they are already on /onboarding
  if (!profile && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
};
