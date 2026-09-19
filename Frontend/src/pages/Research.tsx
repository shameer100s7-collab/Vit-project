import React, { useState } from 'react';
import { MarketState } from './MarketState';
import { Behavior } from './Behavior';
import { Features } from './Features';
import { RiskDashboard } from './RiskDashboard';
import { RiskHistory } from './RiskHistory';
import { Optimization } from './Optimization';

type Tab = 'outlook' | 'activity' | 'analysis' | 'risk' | 'history' | 'optimization';

export const Research: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('outlook');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'outlook', label: 'Market Outlook' },
    { id: 'activity', label: 'Market Activity' },
    { id: 'analysis', label: 'Market Analysis' },
    { id: 'risk', label: 'Risk Metrics' },
    { id: 'history', label: 'Risk History' },
    { id: 'optimization', label: 'Optimization' },
  ];

  return (
    <div className="space-y-6">
      {/* Research Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-ghost-border/50 pb-px mb-6 px-4 pt-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-[1px] ${
              activeTab === tab.id
                ? 'border-ghost-sand text-ghost-sand'
                : 'border-transparent text-ghost-textMuted hover:text-ghost-textPrimary hover:border-ghost-border'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div>
        {activeTab === 'outlook' && <MarketState />}
        {activeTab === 'activity' && <Behavior />}
        {activeTab === 'analysis' && <Features />}
        {activeTab === 'risk' && <RiskDashboard />}
        {activeTab === 'history' && <RiskHistory />}
        {activeTab === 'optimization' && <Optimization />}
      </div>
    </div>
  );
};
