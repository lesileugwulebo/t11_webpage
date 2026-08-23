// ==========================================================================
// App Root Component and View Router
// ==========================================================================
function MainRouter() {
  const { user, loading } = window.useAuth();
  const [view, setView] = React.useState('user-login'); // 'user-login', 'admin-login', 'user-dashboard', 'admin-dashboard'

  React.useEffect(() => {
    if (!loading) {
      if (user) {
        setView(user.role === 'admin' ? 'admin-dashboard' : 'user-dashboard');
      } else {
        // If not logged in and currently in a dashboard view, return to user-login
        if (view === 'admin-dashboard' || view === 'user-dashboard') {
          setView('user-login');
        }
      }
    }
  }, [user, loading]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main)', color: '#0f172a' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', animation: 'spin 1s linear infinite' }}>📦</div>
          <div style={{ marginTop: '1rem', color: 'var(--text-muted)', fontWeight: 600 }}>Initializing Verdad Solution InventoryApp...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <window.Navbar currentView={view} setView={setView} />
      
      <main style={{ flex: 1 }}>
        {view === 'user-login' && <window.UserLogin setView={setView} />}
        {view === 'admin-login' && <window.AdminLogin setView={setView} />}
        {view === 'user-dashboard' && <window.UserDashboard />}
        {view === 'admin-dashboard' && <window.AdminDashboard />}
      </main>

      <footer style={{ borderTop: '1px solid var(--border-subtle)', padding: '1.25rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-dim)', background: '#ffffff' }}>
        Verdad Solution InventoryApp • Built with React & MySQL REST API • Enterprise Edition
      </footer>
    </div>
  );
}

function App() {
  return (
    <window.ToastProvider>
      <window.AuthProvider>
        <MainRouter />
      </window.AuthProvider>
    </window.ToastProvider>
  );
}

// Render React App
const rootElement = document.getElementById('root');
const root = ReactDOM.createRoot(rootElement);
root.render(<App />);
