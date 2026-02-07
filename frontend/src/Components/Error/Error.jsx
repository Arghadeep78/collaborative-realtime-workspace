// Components/Error/Error.jsx
import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

const Error = ({ 
  error, 
  onRetry, 
  onGoHome,
  title = "Something went wrong",
  showHomeButton = true 
}) => {
  return (
    <div className="h-full min-h-full overflow-auto flex items-center justify-center bg-gray-950 text-white font-sans p-6">
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-2xl bg-red-900/30 border border-red-800/50 flex items-center justify-center text-red-400">
            <AlertTriangle size={40} />
          </div>
        </div>
        
        <h2 className="text-xl font-bold text-white mb-2">{title}</h2>
        <p className="text-gray-400 text-sm mb-8">
          {error || "An unexpected error occurred. Please try again."}
        </p>
        
        <div className="flex items-center justify-center gap-3">
          {onRetry && (
            <button 
              onClick={onRetry}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-colors"
            >
              <RefreshCw size={16} />
              Try Again
            </button>
          )}
          
          {showHomeButton && onGoHome && (
            <button 
              onClick={onGoHome}
              className="flex items-center gap-2 px-5 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white text-sm font-medium rounded-xl transition-colors"
            >
              <Home size={16} />
              Go Home
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Error;