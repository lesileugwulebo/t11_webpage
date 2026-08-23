// ==========================================================================
// Navbar Component
// ==========================================================================
function Navbar({ currentView, setView }) {
  const { user, logout } = window.useAuth();

  if (!user) {
    return (
      <header className="navbar">
        <div className="navbar-inner">
          <div className="brand-logo" style={{ cursor: 'pointer' }} onClick={() => setView('user-login')}>
            <div className="brand-icon">📦</div>
            <span>Verdad Solution <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600 }}>InventoryApp</span></span>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button 
              className={`btn btn-sm ${currentView === 'user-login' ? 'btn-user' : 'btn-secondary'}`}
              onClick={() => setView('user-login')}>
              👤 User Portal
            </button>
            <button 
              className={`btn btn-sm ${currentView === 'admin-login' ? 'btn-admin' : 'btn-secondary'}`}
              onClick={() => setView('admin-login')}>
              🛡️ Admin Portal
            </button>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <div className="brand-logo">
          <div className="brand-icon">📦</div>
          <span>Verdad Solution <span style={{ fontSize: '0.8rem', color: user.role === 'admin' ? 'var(--admin-accent)' : 'var(--user-accent)', fontWeight: 700 }}>
            {user.role === 'admin' ? 'Admin Portal' : 'Staff Portal'}
          </span></span>
        </div>

        <div className="nav-user-panel">
          <div className="user-badge">
            <span style={{ color: '#fff', fontWeight: 600 }}>{user.full_name || user.username}</span>
            <span className={`role-pill ${user.role}`}>{user.role}</span>
          </div>

          <button 
            className="btn btn-secondary btn-sm"
            onClick={logout}
            title="Sign Out">
            <span>🚪 Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}

window.Navbar = Navbar;
