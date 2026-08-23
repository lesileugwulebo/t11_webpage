// ==========================================================================
// Admin Dashboard Component
// ==========================================================================
function AdminDashboard() {
  const { user } = window.useAuth();
  const { addToast } = window.useToast();

  const [activeTab, setActiveTab] = React.useState('inventory'); // 'inventory', 'tickets', 'users', 'logs'
  const [stats, setStats] = React.useState({
    totalItems: 0,
    totalUnits: 0,
    totalValuation: 0,
    lowStockCount: 0,
    todayTransactions: 0
  });
  const [ticketStats, setTicketStats] = React.useState({ total: 0, pending: 0, approved: 0, resolved: 0, urgentPending: 0 });

  const [items, setItems] = React.useState([]);
  const [users, setUsers] = React.useState([]);
  const [tickets, setTickets] = React.useState([]);
  const [logs, setLogs] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  // Modals state
  const [isCreateItemOpen, setIsCreateItemOpen] = React.useState(false);
  const [isCreateUserOpen, setIsCreateUserOpen] = React.useState(false);
  const [selectedTicket, setSelectedTicket] = React.useState(null);
  const [restockItem, setRestockItem] = React.useState(null);
  const [adjustItem, setAdjustItem] = React.useState(null);

  const fetchAllData = React.useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, invRes, logsRes, ticketsRes, ticketStatsRes] = await Promise.all([
        window.api.getStats(),
        window.api.getInventory(),
        window.api.getAllActivity(50, 0),
        window.api.getTickets(),
        window.api.getTicketStats()
      ]);

      setStats(statsRes);
      setItems(invRes.items || []);
      setLogs(logsRes.logs || []);
      setTickets(ticketsRes.tickets || []);
      setTicketStats(ticketStatsRes || {});

      if (activeTab === 'users') {
        const usersRes = await window.api.getUsers();
        setUsers(usersRes.users || []);
      }
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [activeTab, addToast]);

  React.useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const handleTabChange = async (tab) => {
    setActiveTab(tab);
    if (tab === 'users') {
      try {
        const res = await window.api.getUsers();
        setUsers(res.users || []);
      } catch (err) {
        addToast(err.message, 'error');
      }
    }
  };

  const handleDeleteItem = async (item) => {
    if (!window.confirm(`Are you sure you want to delete "${item.name}" (${item.sku})? This will also remove remaining ${item.quantity} units from inventory.`)) {
      return;
    }

    try {
      await window.api.deleteItem(item.id);
      addToast(`Item "${item.name}" deleted successfully`, 'success');
      fetchAllData();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleToggleUserStatus = async (targetUser) => {
    const nextStatus = targetUser.status === 'active' ? 'inactive' : 'active';
    try {
      await window.api.toggleUserStatus(targetUser.id, nextStatus);
      addToast(`User ${targetUser.username} set to ${nextStatus}`, 'success');
      const res = await window.api.getUsers();
      setUsers(res.users || []);
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleQuickApprove = async (ticket) => {
    try {
      await window.api.updateTicketStatus(ticket.id, {
        status: 'APPROVED',
        admin_notes: 'Approved and dispatched by System Administrator',
        deduct_stock: true
      });
      addToast(`Ticket ${ticket.ticket_number} approved and stock deducted!`, 'success');
      fetchAllData();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  return (
    <div className="main-content">
      {/* Top Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h1 style={{ fontSize: '1.75rem' }}>Administrator Dashboard</h1>
            <span className="role-pill admin">Admin Mode</span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
            Full control over catalog stock, IT requisition tickets, user accounts, and system-wide inventory audit trails.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-admin" onClick={() => setIsCreateUserOpen(true)}>
            👤 Create New User
          </button>
          <button className="btn btn-primary" onClick={() => setIsCreateItemOpen(true)}>
            ✨ Add New Item
          </button>
        </div>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid-4" style={{ marginBottom: '2rem' }}>
        <window.StatsCard 
          title="Total Stock Items" 
          value={stats.totalItems} 
          sub={`${stats.totalUnits} total units in storage`}
          icon="📦" 
          variant="primary" 
        />
        <window.StatsCard 
          title="Total Valuation" 
          value={`₦${stats.totalValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
          sub="Estimated inventory cost"
          icon="💎" 
          variant="success" 
        />
        <window.StatsCard 
          title="Pending Helpdesk Requests" 
          value={ticketStats.pending || 0} 
          sub={`${ticketStats.urgentPending || 0} marked as URGENT`}
          icon="🎫" 
          variant={ticketStats.pending > 0 ? "warning" : "primary"} 
        />
        <window.StatsCard 
          title="Today's Global Activity" 
          value={stats.todayTransactions} 
          sub="Stock operations recorded"
          icon="⚡" 
          variant="info" 
        />
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: '1.5rem' }}>
        <button 
          className={`tab-btn ${activeTab === 'inventory' ? 'active' : ''}`}
          onClick={() => handleTabChange('inventory')}>
          📦 Inventory Management ({items.length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'tickets' ? 'active' : ''}`}
          onClick={() => handleTabChange('tickets')}>
          🎫 Helpdesk & Stock Approvals ({tickets.length}) {ticketStats.pending > 0 && <span className="badge badge-warning" style={{ marginLeft: '0.4rem' }}>{ticketStats.pending} pending</span>}
        </button>
        <button 
          className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => handleTabChange('users')}>
          👥 User Accounts Management
        </button>
        <button 
          className={`tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => handleTabChange('logs')}>
          📜 System Audit Trail ({logs.length})
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'inventory' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.15rem' }}>Current Stock Inventory</h3>
            <button className="btn btn-primary btn-sm" onClick={() => setIsCreateItemOpen(true)}>
              + Register New Product
            </button>
          </div>

          <window.InventoryTable 
            items={items}
            loading={loading}
            onRestock={(item) => setRestockItem(item)}
            onAdjust={(item) => setAdjustItem(item)}
            onDelete={handleDeleteItem}
            onRefresh={fetchAllData}
            isAdmin={true}
          />
        </div>
      )}

      {activeTab === 'tickets' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ fontSize: '1.2rem' }}>Helpdesk & Stock Requisition Queue</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Review employee hardware requests, approve automatic stock deductions, or resolve IT support tickets
              </p>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={fetchAllData}>
              🔄 Refresh Queue
            </button>
          </div>

          {tickets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', background: '#f8fafc', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🎉</div>
              <div style={{ fontWeight: 700, color: '#0f172a' }}>All tickets resolved! Queue is empty.</div>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ticket #</th>
                    <th>Requested By</th>
                    <th>Type</th>
                    <th>Subject & Details</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
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
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{t.user_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.user_email}</div>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.5rem', borderRadius: '4px', background: '#f1f5f9', color: '#334155' }}>
                          {t.ticket_type === 'STOCK_REQUEST' ? '📦 Stock Requisition' : t.ticket_type === 'DAMAGE_REPORT' ? '⚠️ Damage Report' : '🔧 Maintenance'}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{t.title}</div>
                        {t.item_name && (
                          <div style={{ fontSize: '0.75rem', color: '#0284c7', fontWeight: 600 }}>
                            Requested: {t.quantity_requested}x {t.item_name}
                          </div>
                        )}
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.15rem' }}>
                          {t.description?.length > 70 ? `${t.description.slice(0, 70)}...` : t.description}
                        </div>
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
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                          {t.status === 'PENDING' && (
                            <button 
                              className="btn btn-success btn-sm" 
                              onClick={() => handleQuickApprove(t)}
                              title="Approve & automatically deduct stock">
                              ✓ Approve
                            </button>
                          )}
                          <button 
                            className="btn btn-secondary btn-sm" 
                            onClick={() => setSelectedTicket(t)}>
                            Manage &rarr;
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'users' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem' }}>System Users & Roles</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Manage staff credentials and access permissions</p>
            </div>
            <button className="btn btn-admin btn-sm" onClick={() => setIsCreateUserOpen(true)}>
              + Create New User
            </button>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Full Name</th>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>#{u.id}</td>
                    <td><strong style={{ color: '#0f172a' }}>{u.full_name}</strong></td>
                    <td><code>{u.username}</code></td>
                    <td>{u.email}</td>
                    <td>
                      <span className={`role-pill ${u.role}`}>{u.role}</span>
                    </td>
                    <td>
                      <span className={`badge ${u.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                        {u.status === 'active' ? '● Active' : '○ Deactivated'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {u.id !== user.id ? (
                        <button 
                          className={`btn btn-sm ${u.status === 'active' ? 'btn-danger' : 'btn-success'}`}
                          onClick={() => handleToggleUserStatus(u)}>
                          {u.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Current User</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="card">
          <div style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.15rem' }}>Global Stock & Ticket Audit Log</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Complete chronological log of all creations, restocks, ticket approvals, and deductions</p>
          </div>

          <window.ActivityFeed logs={logs} emptyMessage="No transactions in the audit log yet." />
        </div>
      )}

      {/* Modals */}
      <window.CreateItemModal 
        isOpen={isCreateItemOpen} 
        onClose={() => setIsCreateItemOpen(false)} 
        onSuccess={fetchAllData} 
      />

      <window.CreateUserModal 
        isOpen={isCreateUserOpen} 
        onClose={() => setIsCreateUserOpen(false)} 
        onSuccess={fetchAllData} 
      />

      <window.TicketDetailsModal 
        isOpen={!!selectedTicket}
        ticket={selectedTicket}
        onClose={() => setSelectedTicket(null)}
        onStatusUpdate={fetchAllData}
      />

      <window.RestockModal 
        isOpen={!!restockItem} 
        item={restockItem} 
        onClose={() => setRestockItem(null)} 
        onSuccess={fetchAllData} 
      />

      <window.AdjustStockModal 
        isOpen={!!adjustItem} 
        item={adjustItem} 
        onClose={() => setAdjustItem(null)} 
        onSuccess={fetchAllData} 
      />
    </div>
  );
}

window.AdminDashboard = AdminDashboard;
