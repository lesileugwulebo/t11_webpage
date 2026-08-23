// ==========================================================================
// Authentication Context
// ==========================================================================
const AuthContext = React.createContext();

function AuthProvider({ children }) {
  const [user, setUser] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    // Check existing stored session
    const token = localStorage.getItem('inventory_token');
    const storedUser = localStorage.getItem('inventory_user');

    if (token && storedUser) {
      try {
        setUser(JSON.parse(storedUser));
        // Verify with server in background
        window.api.getProfile()
          .then(res => {
            if (res.user) {
              setUser(res.user);
              localStorage.setItem('inventory_user', JSON.stringify(res.user));
            }
          })
          .catch(() => {
            // If token invalid, clear
            localStorage.removeItem('inventory_token');
            localStorage.removeItem('inventory_user');
            setUser(null);
          })
          .finally(() => setLoading(false));
        return;
      } catch (e) {
        localStorage.removeItem('inventory_token');
        localStorage.removeItem('inventory_user');
      }
    }
    setLoading(false);
  }, []);

  const loginUser = (token, userData) => {
    localStorage.setItem('inventory_token', token);
    localStorage.setItem('inventory_user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('inventory_token');
    localStorage.removeItem('inventory_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

function useAuth() {
  return React.useContext(AuthContext);
}

window.AuthProvider = AuthProvider;
window.useAuth = useAuth;
