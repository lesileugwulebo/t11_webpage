// ==========================================================================
// Admin Login Page Component
// ==========================================================================
function AdminLogin({ setView }) {
  const [username, setUsername] = React.useState('admin');
  const [password, setPassword] = React.useState('admin123');
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

        {/* Demo Fast-Fill */}
        <div style={{ marginTop: '1.5rem', padding: '0.875rem', background: '#f8fafc', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 700 }}>ADMIN CREDENTIALS:</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <code style={{ fontSize: '0.85rem', color: '#6d28d9', fontWeight: 600 }}>admin / admin123</code>
            <button 
              type="button" 
              className="btn btn-secondary btn-sm" 
              onClick={() => { setUsername('admin'); setPassword('admin123'); }}>
              Auto-Fill
            </button>
          </div>
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
