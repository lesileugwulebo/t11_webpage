// ==========================================================================
// User / Staff Dashboard Component ("Today's Work" & Stock Operations)
// ==========================================================================
function UserDashboard() {
  const { user } = window.useAuth();
  const { addToast } = window.useToast();

  const [items, setItems] = React.useState([]);
  const [todaySummary, setTodaySummary] = React.useState({
    totalActionsToday: 0,
    itemsCreatedToday: 0,
    itemsRestockedToday: 0,
    unitsAddedToday: 0,
    adjustmentsToday: 0,
    itemsDeletedToday: 0
  });
  const [todayLogs, setTodayLogs] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  // Modals state
  const [isCreateItemOpen, setIsCreateItemOpen] = React.useState(false);
  const [restockItem, setRestockItem] = React.useState(null);
  const [adjustItem, setAdjustItem] = React.useState(null);

  const fetchUserData = React.useCallback(async () => {
    setLoading(true);
    try {
      const [invRes, activityRes] = await Promise.all([
        window.api.getInventory(),
        window.api.getTodayActivity()
      ]);

      setItems(invRes.items || []);
      setTodaySummary(activityRes.summary || {});
      setTodayLogs(activityRes.logs || []);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  React.useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  const handleDeleteItem = async (item) => {
    if (!window.confirm(`Are you sure you want to remove "${item.name}" (${item.sku}) from stock? This will delete all ${item.quantity} units and log this action.`)) {
      return;
    }

    try {
      await window.api.deleteItem(item.id);
      addToast(`Item "${item.name}" deleted and logged in your daily record.`, 'success');
      fetchUserData();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  return (
    <div className="main-content">
      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h1 style={{ fontSize: '1.75rem' }}>Staff Workspace</h1>
            <span className="role-pill user">Operator</span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
            Welcome, <strong>{user?.full_name || user?.username}</strong>. Manage stock counts, record item movements & review your daily progress.
          </p>
        </div>

        <button className="btn btn-user" onClick={() => setIsCreateItemOpen(true)}>
          ✨ Register New Product
        </button>
      </div>

      {/* TODAY'S WORK HERO BANNER */}
      <div className="today-banner">
        <div className="today-banner-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.25rem' }}>🎯</span>
              <h2 style={{ fontSize: '1.25rem', color: '#fff' }}>What You Have Done Today</h2>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>

          <div style={{ background: 'rgba(6, 182, 212, 0.15)', padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-full)', border: '1px solid rgba(6, 182, 212, 0.3)', color: '#67e8f9', fontSize: '0.8rem', fontWeight: 600 }}>
            {todaySummary.totalActionsToday || 0} Total Actions Recorded Today
          </div>
        </div>

        <div className="today-stats-grid">
          <div className="today-stat-pill">
            <div className="num">{todaySummary.totalActionsToday || 0}</div>
            <div className="label">Total Operations</div>
          </div>
          <div className="today-stat-pill">
            <div className="num" style={{ color: '#34d399' }}>+{todaySummary.unitsAddedToday || 0}</div>
            <div className="label">Stock Units Added</div>
          </div>
          <div className="today-stat-pill">
            <div className="num" style={{ color: '#60a5fa' }}>{todaySummary.itemsRestockedToday || 0}</div>
            <div className="label">Restock Events</div>
          </div>
          <div className="today-stat-pill">
            <div className="num" style={{ color: '#fbbf24' }}>{todaySummary.adjustmentsToday || 0}</div>
            <div className="label">Stock Adjustments</div>
          </div>
          <div className="today-stat-pill">
            <div className="num" style={{ color: '#c084fc' }}>{todaySummary.itemsCreatedToday || 0}</div>
            <div className="label">New Items Created</div>
          </div>
          <div className="today-stat-pill">
            <div className="num" style={{ color: '#f87171' }}>{todaySummary.itemsDeletedToday || 0}</div>
            <div className="label">Items Deleted</div>
          </div>
        </div>
      </div>

      {/* Main Grid: Inventory Table (Left 70%) & Today's Activity Feed (Right 30%) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1fr)', gap: '1.5rem' }}>
        {/* Inventory Table */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem' }}>Warehouse Inventory Stock</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Browse items, restock, or adjust quantities</p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setIsCreateItemOpen(true)}>
              + New Item
            </button>
          </div>

          <window.InventoryTable 
            items={items}
            loading={loading}
            onRestock={(item) => setRestockItem(item)}
            onAdjust={(item) => setAdjustItem(item)}
            onDelete={handleDeleteItem}
            onRefresh={fetchUserData}
            isAdmin={false}
          />
        </div>

        {/* Today's Activity Timeline */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem' }}>Your Activity Today</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Real-time stream of your daily operations</p>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={fetchUserData} title="Refresh log">
              🔄
            </button>
          </div>

          <window.ActivityFeed 
            logs={todayLogs} 
            emptyMessage="You haven't performed any stock actions today yet. Any items you add, adjust, or delete will appear here!" 
          />
        </div>
      </div>

      {/* Modals */}
      <window.CreateItemModal 
        isOpen={isCreateItemOpen} 
        onClose={() => setIsCreateItemOpen(false)} 
        onSuccess={fetchUserData} 
      />

      <window.RestockModal 
        isOpen={!!restockItem} 
        item={restockItem} 
        onClose={() => setRestockItem(null)} 
        onSuccess={fetchUserData} 
      />

      <window.AdjustStockModal 
        isOpen={!!adjustItem} 
        item={adjustItem} 
        onClose={() => setAdjustItem(null)} 
        onSuccess={fetchUserData} 
      />
    </div>
  );
}

window.UserDashboard = UserDashboard;
