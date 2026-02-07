// utils/toast.js
import toast from 'react-hot-toast';

// Professional styling constants
const baseStyle = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontSize: '14px',
  fontWeight: '500',
  borderRadius: '8px',
  padding: '12px 16px',
  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  backdropFilter: 'blur(8px)',
  maxWidth: '400px',
};

const iconStyle = {
  fontSize: '16px',
  marginRight: '2px',
};

// Success toast
export const showSuccess = (message, options = {}) => {
  return toast.success(message, {
    duration: 3000,
    icon: '✓',
    style: {
      ...baseStyle,
      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      color: '#ffffff',
      border: '1px solid rgba(16, 185, 129, 0.3)',
    },
    iconTheme: {
      primary: '#ffffff',
      secondary: '#10b981',
    },
    ...options
  });
};

// Error toast
export const showError = (message, options = {}) => {
  return toast.error(message, {
    duration: 4000,
    icon: '✕',
    style: {
      ...baseStyle,
      background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
      color: '#ffffff',
      border: '1px solid rgba(239, 68, 68, 0.3)',
    },
    iconTheme: {
      primary: '#ffffff',
      secondary: '#ef4444',
    },
    ...options
  });
};

// Warning toast
export const showWarning = (message, options = {}) => {
  return toast(message, {
    duration: 3500,
    icon: '⚠',
    style: {
      ...baseStyle,
      background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      color: '#ffffff',
      border: '1px solid rgba(245, 158, 11, 0.3)',
    },
    ...options
  });
};

// Info toast
export const showInfo = (message, options = {}) => {
  return toast(message, {
    duration: 3000,
    icon: 'ℹ',
    style: {
      ...baseStyle,
      background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
      color: '#ffffff',
      border: '1px solid rgba(59, 130, 246, 0.3)',
    },
    ...options
  });
};

// Loading toast
export const showLoading = (message, options = {}) => {
  return toast.loading(message, {
    style: {
      ...baseStyle,
      background: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
      color: '#ffffff',
      border: '1px solid rgba(107, 114, 128, 0.3)',
    },
    ...options
  });
};

// Promise toast - useful for async operations
export const showPromise = (promise, messages, options = {}) => {
  return toast.promise(
    promise,
    {
      loading: messages.loading || 'Processing...',
      success: messages.success || 'Completed successfully!',
      error: messages.error || 'An error occurred',
    },
    {
      loading: {
        style: {
          ...baseStyle,
          background: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
          color: '#ffffff',
          border: '1px solid rgba(107, 114, 128, 0.3)',
        },
      },
      success: {
        duration: 3000,
        style: {
          ...baseStyle,
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          color: '#ffffff',
          border: '1px solid rgba(16, 185, 129, 0.3)',
        },
        iconTheme: {
          primary: '#ffffff',
          secondary: '#10b981',
        },
      },
      error: {
        duration: 4000,
        style: {
          ...baseStyle,
          background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
          color: '#ffffff',
          border: '1px solid rgba(239, 68, 68, 0.3)',
        },
        iconTheme: {
          primary: '#ffffff',
          secondary: '#ef4444',
        },
      },
      ...options
    }
  );
};

// Custom toast with professional styling
export const showCustom = (message, options = {}) => {
  return toast(message, {
    duration: 4000,
    style: {
      ...baseStyle,
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
      color: '#1e293b',
      border: '1px solid rgba(148, 163, 184, 0.2)',
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    },
    ...options
  });
};

// Notification with action button
export const showNotificationWithAction = (message, actionText, actionHandler, options = {}) => {
  return toast.custom((t) => (
    <div
      style={{
        ...baseStyle,
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
        color: '#1e293b',
        border: '1px solid rgba(148, 163, 184, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        minWidth: '300px',
      }}
    >
      <span style={{ flex: 1, marginRight: '12px' }}>{message}</span>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={() => {
            actionHandler();
            toast.dismiss(t.id);
          }}
          style={{
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '6px 12px',
            fontSize: '12px',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
          }}
        >
          {actionText}
        </button>
        <button
          onClick={() => toast.dismiss(t.id)}
          style={{
            background: 'transparent',
            color: '#6b7280',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            padding: '6px 8px',
            fontSize: '12px',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          ✕
        </button>
      </div>
    </div>
  ), {
    duration: 6000,
    ...options
  });
};

// Dismiss all toasts
export const dismissAll = () => {
  toast.dismiss();
};

// Dismiss specific toast
export const dismissToast = (toastId) => {
  toast.dismiss(toastId);
};

// Configure global toast options for consistent professional appearance
export const configureToasts = () => {
  return {
    position: 'top-right',
    containerStyle: {
      top: '20px',
      right: '20px',
    },
    toastOptions: {
      style: baseStyle,
      className: 'professional-toast',
    },
  };
};

// Default export for basic usage
export default {
  success: showSuccess,
  error: showError,
  warning: showWarning,
  info: showInfo,
  loading: showLoading,
  promise: showPromise,
  custom: showCustom,
  withAction: showNotificationWithAction,
  dismiss: dismissToast,
  dismissAll: dismissAll,
  configure: configureToasts,
};