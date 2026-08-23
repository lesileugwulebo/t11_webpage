// ==========================================================================
// Admin Login Page Component
// ==========================================================================
function AdminLogin({ setView }) {
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const { loginUser } = window.useAuth();
  const { addToast } = window.useToast();

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      addToast('Please enter administrator credentials', 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await window.api.adminLogin(username.trim(), password.trim());
      loginUser(res.token, res.user);
      addToast(`Welcome Administrator, ${res.user.full_name || res.user.username}!`, 'success');
      setView('admin-dashboard');
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div className="card" style={{ maxWidth: '440px', width: '100%', padding: '2.25rem', boxShadow: 'var(--shadow-lg)', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ 
            width: '56px', 
            height: '56px', 
            borderRadius: 'var(--radius-md)', 
            background: 'linear-gradient(135deg, var(--admin-accent) 0%, #4f46e5 100%)', 
            display: 'inline-flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            fontSize: '1.75rem', 
            marginBottom: '1rem',
            boxShadow: '0 8px 24px rgba(139, 92, 246, 0.4)'
          }}>
            🛡️
          </div>
          <div style={{ display: 'inline-block', padding: '0.2rem 0.6rem', background: 'rgba(139, 92, 246, 0.2)', color: '#c084fc', borderRadius: 'var(--radius-full)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
            Elevated Access
          </div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.35rem' }}>Admin Control Portal</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Manage inventory stock, create users, restock & inspect full system audits
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleAdminLogin}>
          <div className="form-group">
            <label className="form-label">Administrator Username</label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="e.g. admin" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              required 
            />
          </div>

          <div className="form-group">
            <label className="form-label">Master Password</label>
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
            className="btn btn-admin" 
            style={{ width: '100%', padding: '0.8rem', marginTop: '0.5rem' }} 
            disabled={loading}>
            {loading ? 'Authenticating...' : 'Sign In as Administrator'}
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
                window.entraAuth.loginWithMicrosoftEntra('admin', (res) => {
                  login(res.token, res.user);
                  addToast(`Welcome, ${res.user.full_name}! (Microsoft Entra Admin SSO)`, 'success');
                  setView('admin-dashboard');
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
          Looking for standard staff access?{' '}
          <button 
            type="button" 
            style={{ background: 'none', border: 'none', color: '#0284c7', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }} 
            onClick={() => setView('user-login')}>
            Go to User Login &rarr;
          </button>
        </div>
      </div>
    </div>
  );
}

window.AdminLogin = AdminLogin;
