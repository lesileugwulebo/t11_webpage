// ==========================================================================
// Toast Notification Context & Component
// ==========================================================================
const ToastContext = React.createContext();

function ToastProvider({ children }) {
  const [toasts, setToasts] = React.useState([]);

  const addToast = React.useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {t.type === 'success' && <span style={{ color: 'var(--success)' }}>✓</span>}
              {t.type === 'error' && <span style={{ color: 'var(--danger)' }}>✕</span>}
              {t.type === 'info' && <span style={{ color: 'var(--info)' }}>ℹ</span>}
              <span>{t.message}</span>
            </div>
            <button 
              onClick={() => removeToast(t.id)} 
              style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '1rem' }}>
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function useToast() {
  return React.useContext(ToastContext);
}

window.ToastProvider = ToastProvider;
window.useToast = useToast;
