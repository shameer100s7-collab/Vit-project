import React, { useState } from 'react';
import { Terminal, Send, Copy, Check, Clock, ShieldCheck, AlertCircle, RefreshCw, Zap } from 'lucide-react';

interface PresetEndpoint {
  category: string;
  name: string;
  method: 'GET' | 'POST';
  path: string;
  body?: string;
}

const PRESETS: PresetEndpoint[] = [
  { category: 'System', name: 'Root Health', method: 'GET', path: '/health' },
  { category: 'System', name: 'API v1 Health', method: 'GET', path: '/api/v1/health' },
  { category: 'Auth', name: 'Current User (Me)', method: 'GET', path: '/api/v1/auth/me' },
  { category: 'Market', name: 'Market Overview', method: 'GET', path: '/api/v1/market/overview' },
  { category: 'Market', name: 'Asset Summary (BTC-USDT)', method: 'GET', path: '/api/v1/market/BTC-USDT' },
  { category: 'Market', name: 'OHLCV Candles (BTC-USDT)', method: 'GET', path: '/api/v1/market/BTC-USDT/ohlcv?timeframe=1h&limit=50' },
  { category: 'Market', name: 'Order Book (BTC-USDT)', method: 'GET', path: '/api/v1/market/BTC-USDT/orderbook?depth=20' },
  { category: 'Market', name: 'Volume Profile (BTC-USDT)', method: 'GET', path: '/api/v1/market/BTC-USDT/volume' },
  { category: 'Market', name: 'Asset Metadata (BTC-USDT)', method: 'GET', path: '/api/v1/market/BTC-USDT/metadata' },
  { category: 'Intelligence', name: 'Market State & Regime (BTC-USDT)', method: 'GET', path: '/api/v1/intelligence/BTC-USDT/state' },
  { category: 'Signals', name: 'Consensus Signals (BTC-USDT)', method: 'GET', path: '/api/v1/signals/BTC-USDT' },
  { category: 'Signals', name: 'Signal History (BTC-USDT)', method: 'GET', path: '/api/v1/signals/BTC-USDT/history?limit=20' },
  { category: 'Behavior', name: 'Behavior & Archetypes (BTC-USDT)', method: 'GET', path: '/api/v1/behavior/BTC-USDT' },
  { category: 'Risk', name: 'Single Asset Risk (BTC-USDT)', method: 'GET', path: '/api/v1/risk/BTC-USDT' },
  { category: 'Risk', name: 'Risk History (BTC-USDT)', method: 'GET', path: '/api/v1/risk/BTC-USDT/history?limit=20' },
  {
    category: 'Risk',
    name: 'Portfolio Risk Assessment',
    method: 'POST',
    path: '/api/v1/risk/portfolio',
    body: JSON.stringify(
      {
        positions: [
          { symbol: 'BTC-USDT', weight: 0.5, current_value: 50000 },
          { symbol: 'ETH-USDT', weight: 0.3, current_value: 30000 },
          { symbol: 'SOL-USDT', weight: 0.2, current_value: 20000 }
        ],
        total_value: 100000,
        benchmark: 'BTC-USDT',
        risk_free_rate: 0.04
      },
      null,
      2
    )
  }
];

export const ApiConsole: React.FC = () => {
  const [method, setMethod] = useState<'GET' | 'POST' | 'PUT' | 'DELETE'>('GET');
  const [endpoint, setEndpoint] = useState<string>('/api/v1/health');
  const [requestBody, setRequestBody] = useState<string>('');
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [responseLatency, setResponseLatency] = useState<number | null>(null);
  const [responseData, setResponseData] = useState<string | null>(null);
  const [responseHeaders, setResponseHeaders] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const applyPreset = (preset: PresetEndpoint) => {
    setMethod(preset.method);
    setEndpoint(preset.path);
    setRequestBody(preset.body || '');
    setResponseData(null);
    setResponseStatus(null);
    setResponseLatency(null);
    setErrorMsg(null);
  };

  const handleSend = async () => {
    setLoading(true);
    setErrorMsg(null);
    setResponseData(null);
    setResponseStatus(null);
    setResponseLatency(null);
    setResponseHeaders({});

    const startTime = performance.now();

    try {
      let parsedBody: any = undefined;
      if (['POST', 'PUT'].includes(method) && requestBody.trim()) {
        try {
          parsedBody = JSON.parse(requestBody);
        } catch (e: any) {
          setErrorMsg(`Invalid JSON body: ${e.message}`);
          setLoading(false);
          return;
        }
      }

      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
      const cleanPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
      const fullUrl = `${baseUrl}${cleanPath}`;
      
      const token = localStorage.getItem('ghost_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(fullUrl, {
        method,
        headers,
        body: parsedBody ? JSON.stringify(parsedBody) : undefined,
      });

      const endTime = performance.now();
      setResponseLatency(Math.round(endTime - startTime));
      setResponseStatus(res.status);

      const headerObj: Record<string, string> = {};
      res.headers.forEach((val, key) => {
        headerObj[key] = val;
      });
      setResponseHeaders(headerObj);

      const text = await res.text();
      try {
        const json = JSON.parse(text);
        setResponseData(JSON.stringify(json, null, 2));
      } catch {
        setResponseData(text || '(Empty response body)');
      }
    } catch (err: any) {
      const endTime = performance.now();
      setResponseLatency(Math.round(endTime - startTime));
      setErrorMsg(err.message || 'Network request failed. Is the backend server running?');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (responseData) {
      navigator.clipboard.writeText(responseData);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const categories = Array.from(new Set(PRESETS.map((p) => p.category)));

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center space-x-2 text-indigo-400 text-sm font-semibold tracking-wider uppercase mb-1">
          <Terminal className="w-4 h-4" />
          <span>Interactive Testing Tool</span>
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
          Developer API Console
          <span className="text-xs px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded font-mono font-normal">
            Direct Backend Harness
          </span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Directly execute queries against GHOST backend endpoints. Inspect live response latency, HTTP status codes, security headers, and JSON payloads.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Presets Sidebar */}
        <div className="lg:col-span-1 bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              API Presets
            </h2>
            <span className="text-xs font-mono text-slate-500">{PRESETS.length} routes</span>
          </div>

          <div className="space-y-4 max-h-[680px] overflow-y-auto pr-1">
            {categories.map((category) => (
              <div key={category} className="space-y-1.5">
                <div className="text-[11px] font-semibold text-slate-400 tracking-wider uppercase px-2">
                  {category}
                </div>
                <div className="space-y-1">
                  {PRESETS.filter((p) => p.category === category).map((preset, idx) => (
                    <button
                      key={idx}
                      onClick={() => applyPreset(preset)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center justify-between group ${
                        endpoint === preset.path && method === preset.method
                          ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 font-medium'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                      }`}
                    >
                      <span className="truncate mr-2">{preset.name}</span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          preset.method === 'GET'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {preset.method}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Request / Response Panel */}
        <div className="lg:col-span-3 space-y-4">
          {/* Query Bar */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as any)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono font-bold text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
              </select>

              <div className="flex-1 relative">
                <input
                  type="text"
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  placeholder="/api/v1/..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button
                onClick={handleSend}
                disabled={loading || !endpoint}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>Send Request</span>
              </button>
            </div>

            {/* Request Body Editor for POST/PUT */}
            {['POST', 'PUT'].includes(method) && (
              <div className="space-y-1 pt-2">
                <label className="text-xs font-semibold text-slate-400">JSON Request Body:</label>
                <textarea
                  value={requestBody}
                  onChange={(e) => setRequestBody(e.target.value)}
                  rows={6}
                  placeholder='{"key": "value"}'
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}
          </div>

          {/* Response Metadata Bar */}
          {(responseStatus !== null || errorMsg) && (
            <div className="bg-slate-900/40 border border-slate-800 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
              <div className="flex items-center gap-4">
                {responseStatus !== null && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">Status:</span>
                    <span
                      className={`px-2 py-0.5 rounded font-bold ${
                        responseStatus >= 200 && responseStatus < 300
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : responseStatus >= 400
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      {responseStatus}
                    </span>
                  </div>
                )}
                {responseLatency !== null && (
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <Clock className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{responseLatency} ms</span>
                  </div>
                )}
                {responseHeaders['x-request-id'] && (
                  <div className="flex items-center gap-1.5 text-slate-400 truncate max-w-xs">
                    <span>Req ID:</span>
                    <span className="text-slate-300">{responseHeaders['x-request-id']}</span>
                  </div>
                )}
              </div>

              {responseData && (
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Payload</span>
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Error Banner */}
          {errorMsg && (
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 flex items-start gap-3 text-rose-300 text-sm">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Request Execution Error</p>
                <p className="text-xs text-rose-400/90 mt-1 font-mono">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Response Payload Viewer */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-mono text-slate-400 flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                Response Payload
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                {responseData ? `${(new Blob([responseData]).size / 1024).toFixed(2)} KB` : 'Idle'}
              </span>
            </div>
            <div className="p-4 bg-slate-950 min-h-[380px] max-h-[580px] overflow-auto">
              {responseData ? (
                <pre className="text-xs font-mono text-slate-300 whitespace-pre leading-relaxed">
                  {responseData}
                </pre>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-2 py-24">
                  <Terminal className="w-8 h-8 stroke-1" />
                  <p className="text-xs font-mono">Select a preset or enter an endpoint and click Send Request</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
