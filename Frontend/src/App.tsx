import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { Dashboard } from './pages/Dashboard';
import { Market } from './pages/Market';
import { Features } from './pages/Features';
import { MarketState } from './pages/MarketState';
import { Signals } from './pages/Signals';
import { Behavior } from './pages/Behavior';
import { RiskDashboard } from './pages/RiskDashboard';
import { PortfolioRisk } from './pages/PortfolioRisk';
import { RiskHistory } from './pages/RiskHistory';
import { Optimization } from './pages/Optimization';
import { ApiConsole } from './pages/ApiConsole';
import { Login } from './pages/Login';
import { Register } from './pages/Register';

export const App: React.FC = () => {
  return (
    <Routes>
      {/* Standalone Authentication Pages */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Main Quantitative Application with Layout */}
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/market" element={<Market />} />
        <Route path="/features" element={<Features />} />
        <Route path="/market-state" element={<MarketState />} />
        <Route path="/signals" element={<Signals />} />
        <Route path="/behavior" element={<Behavior />} />
        <Route path="/risk" element={<RiskDashboard />} />
        <Route path="/portfolio-risk" element={<PortfolioRisk />} />
        <Route path="/risk-history" element={<RiskHistory />} />
        <Route path="/optimization" element={<Optimization />} />
        <Route path="/console" element={<ApiConsole />} />
      </Route>

      {/* Fallback route */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
