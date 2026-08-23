// ==========================================================================
// StatsCard Component
// ==========================================================================
function StatsCard({ title, value, sub, icon, variant = 'primary' }) {
  return (
    <div className="stats-card">
      <div className={`stats-icon-box ${variant}`}>
        {icon}
      </div>
      <div className="stats-info">
        <div className="stats-label">{title}</div>
        <div className="stats-value">{value}</div>
        {sub && <div className="stats-sub">{sub}</div>}
      </div>
    </div>
  );
}

window.StatsCard = StatsCard;
