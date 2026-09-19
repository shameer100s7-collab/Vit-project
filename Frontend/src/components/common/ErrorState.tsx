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
  title = 'Something went wrong',
  minHeight = 'min-h-[220px]',
}) => {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  if (!error) return null;

  const isApiError = error instanceof ApiError;
  const status = isApiError ? error.status : undefined;
  const code = isApiError ? error.code : 'CLIENT_ERROR';
  const requestId = isApiError ? error.requestId : undefined;
  const rawMessage = typeof error === 'string' ? error : error.message;

  // Map to friendly, human-centered explanation
  const getFriendlyMessage = (): string => {
    if (status === 401) return 'Your session has expired. Please sign in again to continue.';
    if (status === 403) return 'You do not have permission to perform this action.';
    if (status === 404) return 'The requested market record could not be found.';
    if (status === 422) return 'Some input values are invalid. Please check your request.';
    if (status === 500) return 'Something went wrong while processing your request on our servers.';
    if (code === 'NETWORK_ERROR' || status === 0) return 'Unable to connect to the backend server. Please check your connection.';
    if (status === 408) return 'The request timed out before receiving a response.';
    return rawMessage;
  };

  return (
    <div
      className={`flex flex-col items-center justify-center p-6 bg-ghost-card border border-rose-500/30 rounded-2xl ${minHeight} text-center shadow-lg`}
    >
      <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-3">
        <AlertTriangle className="w-6 h-6" />
      </div>

      <h4 className="text-sm font-bold text-ghost-textPrimary tracking-tight mb-1">
        {title}
      </h4>

      <p className="text-xs text-ghost-textMuted max-w-md mb-4 leading-relaxed">
        {getFriendlyMessage()}
      </p>

      <div className="flex items-center gap-3">
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-ghost-burgundy hover:bg-ghost-burgundyLight text-xs font-semibold text-ghost-sand transition-colors shadow"
          >
            <RefreshCw className="w-3.5 h-3.5 text-ghost-sand" />
            <span>Try again</span>
          </button>
        )}

        <button
          onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs text-ghost-textMuted hover:text-ghost-textPrimary hover:bg-ghost-border/40 transition-colors"
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>Details</span>
          {showTechnicalDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {showTechnicalDetails && (
        <div className="mt-4 w-full max-w-lg p-3.5 bg-ghost-darkest border border-ghost-border rounded-xl text-left text-xs font-mono overflow-x-auto text-slate-300">
          <div className="flex justify-between border-b border-ghost-border/60 pb-1 mb-1.5 text-[11px] text-ghost-textMuted">
            <span>STATUS: {status || 'N/A'}</span>
            <span>CODE: {code}</span>
            {requestId && <span>REQ-ID: {requestId.slice(0, 8)}...</span>}
          </div>
          <p className="text-rose-400/90 break-words">{rawMessage}</p>
          {isApiError && error.details && (
            <pre className="mt-2 p-1.5 bg-black/40 rounded text-[11px] text-slate-400 overflow-x-auto">
              {JSON.stringify(error.details, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};
