// src/context/ToastContext.jsx
import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { Toast } from '../components/Toast.jsx';

const ToastContext = createContext({});

const DURACAO_PADRAO_MS = 4000;

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast deve ser usado dentro de ToastProvider');
  }
  return context;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const proximoId = useRef(0);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message, type = 'info', duracao = DURACAO_PADRAO_MS) => {
    const id = proximoId.current++;
    setToasts((prev) => [...prev, { id, message, type }]);

    if (duracao > 0) {
      setTimeout(() => dismissToast(id), duracao);
    }

    return id;
  }, [dismissToast]);

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
};
