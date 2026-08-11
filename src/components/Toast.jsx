// src/components/Toast.jsx
import '../styles/Toast.css';

const ICONES = {
  success: '✅',
  error: '⚠️',
  warning: '⚠️',
  info: 'ℹ️',
};

export const Toast = ({ toasts, onDismiss }) => {
  if (!toasts.length) return null;

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.type}`} role="status">
          <span className="toast-icon">{ICONES[toast.type] || ICONES.info}</span>
          <span className="toast-message">{toast.message}</span>
          <button
            type="button"
            className="toast-close"
            onClick={() => onDismiss(toast.id)}
            aria-label="Fechar"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
};
