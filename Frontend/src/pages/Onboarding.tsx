import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext';
import { TradingProfile } from '../api/profileService';
import { ChevronRight, ChevronLeft, Check } from 'lucide-react';

export const Onboarding: React.FC = () => {
  const navigate = useNavigate();
  const { updateProfile, profile } = useProfile();
  
  const [step, setStep] = useState(1);
  const totalSteps = 8;
  
  const [formData, setFormData] = useState<Partial<TradingProfile>>({
    capital: 10000,
    currency: 'USD',
    riskPerTrade: 1,
    dailyLossLimit: 2,
    riskRewardPreference: '1 : 2',
    experienceLevel: 'Intermediate',
    markets: ['BTC', 'ETH'],
    tradingStyle: 'Swing trading'
  });

  useEffect(() => {
    // If they already have a profile, skip onboarding
    if (profile) {
      navigate('/', { replace: true });
    }
  }, [profile, navigate]);

  const updateForm = (key: keyof TradingProfile, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleNext = () => {
    if (step < totalSteps) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleComplete = async () => {
    try {
      await updateProfile(formData as TradingProfile);
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Failed to complete onboarding', error);
    }
  };

  // Common UI classes
  const btnClass = "w-full py-3 px-4 rounded-xl border transition-all text-left flex items-center justify-between";
  const activeBtnClass = "bg-ghost-sand/10 border-ghost-sand text-ghost-sand";
  const inactiveBtnClass = "bg-ghost-bg border-ghost-border/50 text-ghost-textMuted hover:border-ghost-sand/50 hover:text-ghost-textPrimary";

  return (
    <div className="min-h-screen bg-ghost-bg flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg bg-ghost-card border border-ghost-border rounded-2xl shadow-xl overflow-hidden flex flex-col">
        {/* Header & Progress */}
        <div className="p-6 border-b border-ghost-border/40">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-ghost-textPrimary tracking-tight">
              Let's set up your trading profile
            </h1>
            <span className="text-xs font-mono text-ghost-sand bg-ghost-sand/10 border border-ghost-sand/20 px-2 py-1 rounded">
              {step} / {totalSteps}
            </span>
          </div>
          <p className="text-sm text-ghost-textMuted">
            A few questions help us make the information and risk settings relevant to you.
          </p>
          
          <div className="w-full bg-ghost-bg h-1.5 rounded-full mt-5 overflow-hidden border border-ghost-border/30">
            <div 
              className="bg-ghost-sand h-full rounded-full transition-all duration-300"
              style={{ width: `${(step / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        {/* Content Area */}
        <div className="p-6 flex-1 min-h-[320px]">
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div>
                <h2 className="text-base font-semibold text-ghost-textPrimary mb-2">How much capital are you planning to trade with?</h2>
                <p className="text-xs text-ghost-textMuted">Capital allocated for trading, not your total net worth.</p>
              </div>
              <div className="flex gap-4 items-center">
                <select 
                  value={formData.currency}
                  onChange={(e) => updateForm('currency', e.target.value)}
                  className="bg-ghost-bg border border-ghost-border/80 rounded-lg px-4 py-3 text-ghost-textPrimary focus:border-ghost-sand outline-none"
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
                <div className="relative flex-1">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ghost-textMuted">$</span>
                  <input
                    type="number"
                    value={formData.capital}
                    onChange={(e) => updateForm('capital', parseFloat(e.target.value))}
                    className="w-full bg-ghost-bg border border-ghost-border/80 rounded-lg pl-8 pr-4 py-3 text-ghost-textPrimary font-mono text-lg focus:border-ghost-sand outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div>
                <h2 className="text-base font-semibold text-ghost-textPrimary mb-2">How much are you comfortable losing on a trade?</h2>
                <p className="text-xs text-ghost-textMuted leading-relaxed">
                  This is the maximum amount you want to put at risk on one trade. It helps determine position sizing and stop-loss planning. This is a planned maximum loss, not a guaranteed stop.
                </p>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'Conservative', val: 0.5 },
                  { label: 'Balanced', val: 1 },
                  { label: 'Growth', val: 2 },
                  { label: 'Aggressive', val: 3 }
                ].map(opt => (
                  <button
                    key={opt.val}
                    onClick={() => updateForm('riskPerTrade', opt.val)}
                    className={`${btnClass} ${formData.riskPerTrade === opt.val ? activeBtnClass : inactiveBtnClass}`}
                  >
                    <span className="font-medium">{opt.label}</span>
                    <span className="font-mono">{opt.val}%</span>
                  </button>
                ))}
              </div>
              <div className="mt-4 p-4 bg-ghost-darkest/50 rounded-lg border border-ghost-border/30">
                <p className="text-xs text-ghost-textDim">
                  Example: On a ${formData.capital?.toLocaleString()} account, a {formData.riskPerTrade}% risk means a planned maximum loss of 
                  <strong className="text-ghost-textPrimary ml-1 font-mono">${((formData.capital || 0) * (formData.riskPerTrade || 0) / 100).toLocaleString()}</strong> per trade.
                </p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div>
                <h2 className="text-base font-semibold text-ghost-textPrimary mb-2">What's the most you're willing to lose in a day?</h2>
                <p className="text-xs text-ghost-textMuted">
                  If your planned losses reach this level, GHOST can flag that you may want to stop taking new trades for the day.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[0.5, 1, 2, 3, 5, 10].map(val => (
                  <button
                    key={val}
                    onClick={() => updateForm('dailyLossLimit', val)}
                    className={`py-3 px-4 rounded-xl border transition-all text-center font-mono ${formData.dailyLossLimit === val ? activeBtnClass : inactiveBtnClass}`}
                  >
                    {val}%
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div>
                <h2 className="text-base font-semibold text-ghost-textPrimary mb-2">What type of trading outcome are you targeting?</h2>
                <p className="text-xs text-ghost-textMuted mb-4">
                  Risk/reward compares the amount you could potentially lose with the potential target. It does not guarantee a profitable trade.
                </p>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'Steady growth', val: '1 : 1.5' },
                  { label: 'Balanced growth', val: '1 : 2' },
                  { label: 'Higher-risk growth', val: '1 : 3' },
                  { label: 'No preference', val: 'Any' }
                ].map(opt => (
                  <button
                    key={opt.val}
                    onClick={() => updateForm('riskRewardPreference', opt.val)}
                    className={`${btnClass} ${formData.riskRewardPreference === opt.val ? activeBtnClass : inactiveBtnClass}`}
                  >
                    <span className="font-medium">{opt.label}</span>
                    <span className="font-mono text-xs">{opt.val}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div>
                <h2 className="text-base font-semibold text-ghost-textPrimary mb-2">How would you describe your trading experience?</h2>
                <p className="text-xs text-ghost-textMuted">This helps us present information at the right complexity level.</p>
              </div>
              <div className="space-y-3">
                {[
                  { label: "I'm new to trading", val: 'Beginner', desc: 'Simple signals and explanations' },
                  { label: "I've traded occasionally", val: 'Intermediate', desc: 'Detailed risk metrics and portfolio analytics' },
                  { label: "I'm an experienced trader", val: 'Advanced', desc: 'Full quantitative features and historical research' }
                ].map(opt => (
                  <button
                    key={opt.val}
                    onClick={() => updateForm('experienceLevel', opt.val)}
                    className={`w-full p-4 rounded-xl border transition-all text-left ${formData.experienceLevel === opt.val ? activeBtnClass : inactiveBtnClass}`}
                  >
                    <div className="font-medium mb-1">{opt.label}</div>
                    <div className={`text-xs ${formData.experienceLevel === opt.val ? 'text-ghost-sand/80' : 'text-ghost-textDim'}`}>
                      {opt.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div>
                <h2 className="text-base font-semibold text-ghost-textPrimary mb-2">What markets are you interested in?</h2>
                <p className="text-xs text-ghost-textMuted">Select the primary markets you trade.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {['BTC', 'ETH', 'SOL', 'Other Crypto', 'Forex', 'Stocks', 'Commodities'].map(market => {
                  const isSelected = formData.markets?.includes(market);
                  return (
                    <button
                      key={market}
                      onClick={() => {
                        const m = formData.markets || [];
                        if (isSelected) {
                          updateForm('markets', m.filter(x => x !== market));
                        } else {
                          updateForm('markets', [...m, market]);
                        }
                      }}
                      className={`py-3 px-4 rounded-xl border transition-all text-center flex items-center justify-center gap-2 ${isSelected ? activeBtnClass : inactiveBtnClass}`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 text-ghost-sand" />}
                      <span className="font-medium text-sm">{market}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 7 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div>
                <h2 className="text-base font-semibold text-ghost-textPrimary mb-2">What's your usual trading timeframe?</h2>
                <p className="text-xs text-ghost-textMuted">This influences signal horizons and risk calculations.</p>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'Short term', desc: 'Minutes → Hours' },
                  { label: 'Day trading', desc: 'Hours → 1 Day' },
                  { label: 'Swing trading', desc: 'Several Days → Weeks' },
                  { label: 'Long term', desc: 'Weeks → Months' }
                ].map(opt => (
                  <button
                    key={opt.label}
                    onClick={() => updateForm('tradingStyle', opt.label)}
                    className={`${btnClass} ${formData.tradingStyle === opt.label ? activeBtnClass : inactiveBtnClass}`}
                  >
                    <span className="font-medium">{opt.label}</span>
                    <span className="text-xs opacity-70">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 8 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="text-center pb-2">
                <div className="w-16 h-16 bg-ghost-sand/10 text-ghost-sand rounded-full flex items-center justify-center mx-auto mb-4 border border-ghost-sand/20">
                  <Check className="w-8 h-8" />
                </div>
                <h2 className="text-lg font-bold text-ghost-textPrimary">Profile Complete</h2>
                <p className="text-xs text-ghost-textMuted mt-1">Review your trading profile below.</p>
              </div>
              
              <div className="bg-ghost-bg/60 border border-ghost-border/40 rounded-xl p-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-ghost-textMuted">Trading capital</span>
                  <span className="font-mono font-medium">${formData.capital?.toLocaleString()} {formData.currency}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ghost-textMuted">Risk per trade</span>
                  <span className="font-mono font-medium">{formData.riskPerTrade}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ghost-textMuted">Daily loss limit</span>
                  <span className="font-mono font-medium">{formData.dailyLossLimit}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ghost-textMuted">Pref. risk/reward</span>
                  <span className="font-mono font-medium">{formData.riskRewardPreference}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ghost-textMuted">Experience</span>
                  <span className="font-medium">{formData.experienceLevel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ghost-textMuted">Trading style</span>
                  <span className="font-medium">{formData.tradingStyle}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ghost-textMuted">Markets</span>
                  <span className="font-medium">{formData.markets?.join(', ')}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-ghost-border/40 bg-ghost-bg/40 flex items-center justify-between">
          <button
            onClick={handleBack}
            className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-1 ${step === 1 ? 'opacity-0 pointer-events-none' : 'text-ghost-textMuted hover:text-ghost-textPrimary'}`}
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          
          {step < totalSteps ? (
            <button
              onClick={handleNext}
              className="px-6 py-2 bg-ghost-sand text-ghost-bg rounded-lg text-sm font-bold hover:bg-ghost-sand/90 transition-colors flex items-center gap-1 shadow-sm"
            >
              <span>Continue</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleComplete}
              className="px-6 py-2 bg-ghost-burgundy hover:bg-[#6c1219] text-ghost-sand rounded-lg text-sm font-bold border border-ghost-sand/30 transition-all shadow-md shadow-ghost-burgundy/20"
            >
              Create my trading profile
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
