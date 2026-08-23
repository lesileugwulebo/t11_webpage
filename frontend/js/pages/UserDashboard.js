// ==========================================================================
// User / Staff Dashboard Component ("Today's Work", Stock & Tickets)
// ==========================================================================
function UserDashboard() {
  const { user } = window.useAuth();
  const { addToast } = window.useToast();

  const [activeTab, setActiveTab] = React.useState('inventory'); // 'inventory', 'tickets', 'activity'
  const [items, setItems] = React.useState([]);
  const [tickets, setTickets] = React.useState([]);
  const [ticketStats, setTicketStats] = React.useState({ total: 0, pending: 0, approved: 0, resolved: 0 });
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
  const [isCreateTicketOpen, setIsCreateTicketOpen] = React.useState(false);
  const [restockItem, setRestockItem] = React.useState(null);
  const [adjustItem, setAdjustItem] = React.useState(null);

  const fetchUserData = React.useCallback(async () => {
    setLoading(true);
    try {
      const [invRes, activityRes, ticketsRes, ticketStatsRes] = await Promise.all([
        window.api.getInventory(),
        window.api.getTodayActivity(),
        window.api.getTickets(),
        window.api.getTicketStats()
      ]);

      setItems(invRes.items || []);
      setTodaySummary(activityRes.summary || {});
      setTodayLogs(activityRes.logs || []);
      setTickets(ticketsRes.tickets || []);
      setTicketStats(ticketStatsRes || {});
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
            Welcome, <strong>{user?.full_name || user?.username}</strong>. Manage stock counts, raise equipment requests & review your daily progress.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={() => setIsCreateTicketOpen(true)}>
            🎫 Submit Ticket / Request
          </button>
          <button className="btn btn-user" onClick={() => setIsCreateItemOpen(true)}>
            ✨ Register New Product
          </button>
        </div>
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
            <div className="label">Total Actions</div>
          </div>
          <div className="today-stat-pill">
            <div className="num" style={{ color: '#34d399' }}>+{todaySummary.unitsAddedToday || 0}</div>
            <div className="label">Units Added</div>
          </div>
          <div className="today-stat-pill">
            <div className="num" style={{ color: '#38bdf8' }}>{todaySummary.itemsRestockedToday || 0}</div>
            <div className="label">Restock Events</div>
          </div>
          <div className="today-stat-pill">
            <div className="num" style={{ color: '#fbbf24' }}>{todaySummary.adjustmentsToday || 0}</div>
            <div className="label">Adjustments</div>
          </div>
          <div className="today-stat-pill">
            <div className="num" style={{ color: '#a78bfa' }}>{todaySummary.itemsCreatedToday || 0}</div>
            <div className="label">Items Created</div>
          </div>
          <div className="today-stat-pill">
            <div className="num" style={{ color: '#f87171' }}>{todaySummary.itemsDeletedToday || 0}</div>
            <div className="label">Items Deleted</div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="tabs" style={{ marginBottom: '1.5rem' }}>
        <button 
          className={`tab-btn ${activeTab === 'inventory' ? 'active' : ''}`}
          onClick={() => setActiveTab('inventory')}>
          📦 Inventory Catalog ({items.length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'tickets' ? 'active' : ''}`}
          onClick={() => setActiveTab('tickets')}>
          🎫 My Requests & Tickets ({tickets.length}) {ticketStats.pending > 0 && <span className="badge badge-warning" style={{ marginLeft: '0.4rem' }}>{ticketStats.pending} pending</span>}
        </button>
        <button 
          className={`tab-btn ${activeTab === 'activity' ? 'active' : ''}`}
          onClick={() => setActiveTab('activity')}>
          📋 Today's Audit Stream ({todayLogs.length})
        </button>
      </div>

      {/* TAB 1: Inventory Table */}
      {activeTab === 'inventory' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1fr)', gap: '1.5rem' }}>
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
      )}

      {/* TAB 2: Tickets & Support Requests */}
      {activeTab === 'tickets' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ fontSize: '1.2rem' }}>My Support & Stock Requisition Tickets</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Track equipment requests, damaged hardware reports, and IT support resolutions
              </p>
            </div>
            <button className="btn btn-primary" onClick={() => setIsCreateTicketOpen(true)}>
              + Raise New Ticket
            </button>
          </div>

          {tickets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', background: '#f8fafc', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🎫</div>
              <div style={{ fontWeight: 700, color: '#0f172a' }}>No tickets submitted yet</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Need equipment or support? Click "Raise New Ticket" above!</div>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ticket #</th>
                    <th>Type</th>
                    <th>Subject / Item</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Resolution / Admin Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map(t => (
                    <tr key={t.id}>
                      <td>
                        <code style={{ background: '#eef2ff', padding: '0.2rem 0.5rem', borderRadius: '4px', color: '#4f46e5', fontWeight: 700, border: '1px solid #e0e7ff' }}>
                          {t.ticket_number}
                        </code>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.5rem', borderRadius: '4px', background: '#f1f5f9', color: '#334155' }}>
                          {t.ticket_type === 'STOCK_REQUEST' ? '📦 Stock Request' : t.ticket_type === 'DAMAGE_REPORT' ? '⚠️ Damage Report' : '🔧 Maintenance'}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{t.title}</div>
                        {t.item_name && (
                          <div style={{ fontSize: '0.75rem', color: '#0284c7' }}>
                            Item: {t.item_name} ({t.quantity_requested} units)
                          </div>
                        )}
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, fontSize: '0.8rem', color: t.priority === 'URGENT' ? '#dc2626' : t.priority === 'HIGH' ? '#ea580c' : '#2563eb' }}>
                          {t.priority}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${t.status === 'APPROVED' ? 'badge-success' : t.status === 'PENDING' ? 'badge-warning' : t.status === 'REJECTED' ? 'badge-danger' : 'badge-neutral'}`}>
                          {t.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {new Date(t.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ fontSize: '0.85rem', color: '#475569' }}>
                        {t.admin_notes || <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>Pending review</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Today's Audit Stream */}
      {activeTab === 'activity' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1.2rem' }}>Detailed Audit Log for Today</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Chronological sequence of all stock and ticket operations recorded today</p>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={fetchUserData}>
              🔄 Refresh
            </button>
          </div>
          <window.ActivityFeed logs={todayLogs} emptyMessage="No transactions or actions recorded today yet." />
        </div>
      )}

      {/* Modals */}
      <window.CreateItemModal 
        isOpen={isCreateItemOpen} 
        onClose={() => setIsCreateItemOpen(false)} 
        onSuccess={fetchUserData} 
      />

      <window.CreateTicketModal 
        isOpen={isCreateTicketOpen} 
        items={items}
        onClose={() => setIsCreateTicketOpen(false)} 
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
