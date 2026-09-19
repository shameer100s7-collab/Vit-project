import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { Dashboard } from './pages/Dashboard';
import { Market } from './pages/Market';
import { Signals } from './pages/Signals';
import { PortfolioRisk } from './pages/PortfolioRisk';
import { ApiConsole } from './pages/ApiConsole';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { Onboarding } from './pages/Onboarding';
import { Research } from './pages/Research';

export const App: React.FC = () => {
  return (
    <Routes>
      {/* Standalone Authentication Pages */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Protected Routes */}
      <Route element={<ProtectedRoute />}>
        <Route path="/onboarding" element={<Onboarding />} />
        
        {/* Main Quantitative Application with Layout */}
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/market" element={<Market />} />
          <Route path="/features" element={<Navigate to="/research" replace />} />
          <Route path="/market-state" element={<Navigate to="/research" replace />} />
          <Route path="/signals" element={<Signals />} />
          <Route path="/behavior" element={<Navigate to="/research" replace />} />
          <Route path="/risk" element={<Navigate to="/research" replace />} />
          <Route path="/portfolio-risk" element={<PortfolioRisk />} />
          <Route path="/risk-history" element={<Navigate to="/research" replace />} />
          <Route path="/optimization" element={<Navigate to="/research" replace />} />
          <Route path="/research" element={<Research />} />
          <Route path="/console" element={<ApiConsole />} />
          <Route path="/settings" element={<div className="p-8">Settings coming soon</div>} />
        </Route>
      </Route>

      {/* Fallback route */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
