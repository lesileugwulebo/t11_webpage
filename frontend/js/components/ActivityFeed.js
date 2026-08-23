// ==========================================================================
// Activity Feed & Audit Timeline Component
// ==========================================================================
function ActivityFeed({ logs = [], emptyMessage = "No activities recorded for today yet." }) {
  if (!logs || logs.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2.5rem 1rem', background: '#f8fafc', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📋</div>
        <div style={{ fontWeight: 600, color: '#334155' }}>{emptyMessage}</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>Stock transactions and creations will appear here in real-time.</div>
      </div>
    );
  }

  const formatTime = (dateStr) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  const getActionTag = (type, qtyChange) => {
    switch (type) {
      case 'CREATE':
        return { label: 'Created Item', icon: '✨', changeText: `+${qtyChange} initial units` };
      case 'RESTOCK':
        return { label: 'Restocked Item', icon: '📥', changeText: `+${qtyChange} units added` };
      case 'ADJUSTMENT':
        return { 
          label: qtyChange < 0 ? 'Deducted / Dispatched' : 'Stock Adjusted', 
          icon: qtyChange < 0 ? '📤' : '⚖️', 
          changeText: `${qtyChange > 0 ? '+' : ''}${qtyChange} units` 
        };
      case 'DELETE':
        return { label: 'Deleted Item', icon: '🗑️', changeText: 'Item removed' };
      case 'UPDATE':
        return { label: 'Updated Details', icon: '✏️', changeText: 'Info changed' };
      default:
        return { label: type, icon: '📝', changeText: '' };
    }
  };

  return (
    <div className="timeline">
      {logs.map((log) => {
        const actionInfo = getActionTag(log.transaction_type, log.quantity_change);
        return (
          <div key={log.id} className="timeline-item">
            <div className={`timeline-icon ${log.transaction_type}`}>
              {actionInfo.icon}
            </div>
            <div className="timeline-content">
              <div className="timeline-header">
                <span className="timeline-title">
                  {actionInfo.label}: <span style={{ color: '#0284c7' }}>{log.item_name}</span>
                </span>
                <span className="timeline-time">{formatTime(log.created_at)}</span>
              </div>
              <div className="timeline-meta">
                <span style={{ fontWeight: 700, color: log.quantity_change < 0 ? '#dc2626' : '#059669' }}>
                  {actionInfo.changeText}
                </span>
                {log.previous_quantity !== undefined && log.new_quantity !== undefined && log.transaction_type !== 'DELETE' && (
                  <span style={{ marginLeft: '0.5rem', color: 'var(--text-dim)' }}>
                    ({log.previous_quantity} → {log.new_quantity} stock)
                  </span>
                )}
                {log.reason && (
                  <span style={{ marginLeft: '0.5rem', fontStyle: 'italic', color: 'var(--text-muted)' }}>
                    • "{log.reason}"
                  </span>
                )}
              </div>
              {log.user_name && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
                  By: <strong>{log.user_name}</strong> ({log.user_role})
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

window.ActivityFeed = ActivityFeed;
