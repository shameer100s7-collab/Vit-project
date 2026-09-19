import React, { useState } from 'react';
import { AlertTriangle, RefreshCw, ChevronDown, ChevronUp, Terminal } from 'lucide-react';
import { ApiError } from '../../api/client';

interface ErrorStateProps {
  error: Error | ApiError | string | null;
  onRetry?: () => void;
  title?: string;
  minHeight?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  error,
  onRetry,
  title = 'Service Query Notice',
  minHeight = 'min-h-[220px]',
}) => {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  if (!error) return null;

  const isApiError = error instanceof ApiError;
  const status = isApiError ? error.status : undefined;
  const code = isApiError ? error.code : 'CLIENT_ERROR';
  const requestId = isApiError ? error.requestId : undefined;
  const rawMessage = typeof error === 'string' ? error : error.message;

  // Map to friendly, professional explanation
  const getFriendlyMessage = (): string => {
    if (status === 401) return 'Your session has expired or requires authentication. Please log in again.';
    if (status === 403) return 'You do not have permission to access this quantitative resource.';
    if (status === 404) return 'The requested market asset or quantitative record was not found in the active universe.';
    if (status === 422) return 'Some input parameters or timeframe filters are invalid. Please check request values.';
    if (status === 500) return 'The backend analytical engine encountered an internal processing condition.';
    if (code === 'NETWORK_ERROR' || status === 0) return 'Unable to connect to the GHOST backend service. Verify server operational status.';
    if (status === 408) return 'The quantitative analytical query timed out before the backend responded.';
    return rawMessage;
  };

  return (
    <div
      className={`flex flex-col items-center justify-center p-6 bg-ghost-card border border-rose-500/30 rounded-xl ${minHeight} text-center shadow-lg`}
    >
      <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-3">
        <AlertTriangle className="w-6 h-6" />
      </div>

      <h4 className="text-sm font-semibold font-mono text-ghost-textPrimary uppercase tracking-wider mb-1">
        {title}
      </h4>

      <p className="text-xs font-mono text-ghost-textMuted max-w-md mb-4 leading-relaxed">
        {getFriendlyMessage()}
      </p>

      <div className="flex items-center gap-3">
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-ghost-border hover:bg-ghost-borderLight text-xs font-mono font-medium text-ghost-textPrimary transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-ghost-cyan" />
            Retry Query
          </button>
        )}

        <button
          onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-mono text-ghost-textMuted hover:text-ghost-textPrimary hover:bg-ghost-border/40 transition-colors"
        >
          <Terminal className="w-3.5 h-3.5" />
          Technical Diagnostic
          {showTechnicalDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {showTechnicalDetails && (
        <div className="mt-4 w-full max-w-lg p-3 bg-ghost-darkest border border-ghost-border rounded-lg text-left text-xs font-mono overflow-x-auto text-slate-300">
          <div className="flex justify-between border-b border-ghost-border/60 pb-1 mb-1.5 text-2xs text-ghost-textMuted">
            <span>STATUS: {status || 'N/A'}</span>
            <span>CODE: {code}</span>
            {requestId && <span>REQ-ID: {requestId.slice(0, 8)}...</span>}
          </div>
          <p className="text-rose-400/90 break-words">{rawMessage}</p>
          {isApiError && error.details && (
            <pre className="mt-2 p-1.5 bg-black/40 rounded text-2xs text-slate-400 overflow-x-auto">
              {JSON.stringify(error.details, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};
