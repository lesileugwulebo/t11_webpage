// ==========================================================================
// User Login Page Component
// ==========================================================================
function UserLogin({ setView }) {
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const { loginUser } = window.useAuth();
  const { addToast } = window.useToast();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      addToast('Please enter both username and password', 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await window.api.login(username.trim(), password.trim());
      loginUser(res.token, res.user);
      addToast(`Welcome back, ${res.user.full_name || res.user.username}!`, 'success');
      setView(res.user.role === 'admin' ? 'admin-dashboard' : 'user-dashboard');
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div className="card" style={{ maxWidth: '440px', width: '100%', padding: '2.25rem', boxShadow: 'var(--shadow-lg)' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ 
            width: '56px', 
            height: '56px', 
            borderRadius: 'var(--radius-md)', 
            background: 'linear-gradient(135deg, var(--user-accent) 0%, #2563eb 100%)', 
            display: 'inline-flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            fontSize: '1.75rem', 
            marginBottom: '1rem',
            boxShadow: '0 8px 20px rgba(6, 182, 212, 0.3)'
          }}>
            👤
          </div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.35rem' }}>Staff & User Login</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Access inventory, track stock operations & view your daily activity
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="e.g. username" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              required 
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input 
              type="password" 
              className="form-control" 
              placeholder="••••••••" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-user" 
            style={{ width: '100%', padding: '0.8rem', marginTop: '0.5rem' }} 
            disabled={loading}>
            {loading ? 'Authenticating...' : 'Sign In to Staff Portal'}
          </button>
        </form>

        {/* Microsoft Entra ID SSO */}
        <div style={{ marginTop: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', margin: '1rem 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
            <span style={{ padding: '0 0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>OR SINGLE SIGN-ON</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
          </div>

          <button 
            type="button" 
            className="btn btn-secondary" 
            style={{ width: '100%', padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.65rem', fontWeight: 600, border: '1px solid #cbd5e1' }}
            onClick={() => {
              if (window.entraAuth) {
                window.entraAuth.loginWithMicrosoftEntra('user', (res) => {
                  login(res.token, res.user);
                  addToast(`Welcome, ${res.user.full_name}! (Microsoft Entra SSO)`, 'success');
                  setView('user-dashboard');
                }, (err) => {
                  addToast(err, 'error');
                });
              }
            }}>
            <svg width="18" height="18" viewBox="0 0 21 21">
              <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
              <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
              <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
              <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
            </svg>
            Sign in with Microsoft Entra ID
          </button>
        </div>

        {/* Switch Link */}
        <div style={{ textAlign: 'center', marginTop: '1.75rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Are you a System Administrator?{' '}
          <button 
            type="button" 
            style={{ background: 'none', border: 'none', color: '#7c3aed', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }} 
            onClick={() => setView('admin-login')}>
            Switch to Admin Login &rarr;
          </button>
        </div>
      </div>
    </div>
  );
}

window.UserLogin = UserLogin;
