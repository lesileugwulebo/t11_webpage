// ==========================================================================
// Inventory Data Table with Search, Filter, and Action Buttons
// ==========================================================================
function InventoryTable({ 
  items, 
  loading, 
  onRestock, 
  onAdjust, 
  onDelete, 
  onRefresh,
  isAdmin = false 
}) {
  const [search, setSearch] = React.useState('');
  const [categoryFilter, setCategoryFilter] = React.useState('All');
  const [filterLowStock, setFilterLowStock] = React.useState(false);

  // Extract unique categories
  const categories = React.useMemo(() => {
    const set = new Set(items.map(i => i.category).filter(Boolean));
    return ['All', ...Array.from(set)];
  }, [items]);

  // Filter items
  const filteredItems = React.useMemo(() => {
    return items.filter(item => {
      const matchesSearch = !search || 
        item.name.toLowerCase().includes(search.toLowerCase()) || 
        item.sku.toLowerCase().includes(search.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(search.toLowerCase()));

      const matchesCat = categoryFilter === 'All' || item.category === categoryFilter;
      const matchesLowStock = !filterLowStock || item.quantity <= item.min_threshold;

      return matchesSearch && matchesCat && matchesLowStock;
    });
  }, [items, search, categoryFilter, filterLowStock]);

  const getStockBadge = (quantity, minThreshold) => {
    if (quantity <= 0) {
      return <span className="badge out-of-stock">● Out of Stock</span>;
    }
    if (quantity <= minThreshold) {
      return <span className="badge low-stock">⚠️ Low Stock ({quantity})</span>;
    }
    return <span className="badge in-stock">✓ In Stock ({quantity})</span>;
  };

  return (
    <div>
      {/* Controls Bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flex: '1', minWidth: '280px', maxWidth: '600px' }}>
          <input 
            type="text" 
            className="form-control" 
            placeholder="🔍 Search items by name, SKU..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
          />
          <select 
            className="form-control" 
            style={{ maxWidth: '180px' }} 
            value={categoryFilter} 
            onChange={(e) => setCategoryFilter(e.target.value)}>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button 
            type="button" 
            className={`btn btn-sm ${filterLowStock ? 'btn-danger' : 'btn-secondary'}`}
            onClick={() => setFilterLowStock(!filterLowStock)}>
            {filterLowStock ? '⚠️ Showing Low Stock Only' : 'Filter Low Stock'}
          </button>

          <button 
            type="button" 
            className="btn btn-secondary btn-sm"
            onClick={onRefresh}
            title="Refresh Inventory">
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="table-responsive">
        <table className="table">
          <thead>
            <tr>
              <th>SKU / Code</th>
              <th>Product Details</th>
              <th>Category</th>
              <th>Unit Price</th>
              <th>Available Stock</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  Loading inventory catalog...
                </td>
              </tr>
            ) : filteredItems.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  No inventory items match your search criteria.
                </td>
              </tr>
            ) : (
              filteredItems.map(item => (
                <tr key={item.id}>
                  <td>
                    <code style={{ background: '#eef2ff', padding: '0.2rem 0.5rem', borderRadius: '4px', color: '#4f46e5', fontWeight: 700, border: '1px solid #e0e7ff' }}>
                      {item.sku}
                    </code>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{item.name}</div>
                    {item.description && (
                      <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                        {item.description}
                      </div>
                    )}
                  </td>
                  <td>
                    <span style={{ fontSize: '0.8rem', color: '#334155', background: '#f1f5f9', padding: '0.25rem 0.6rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                      {item.category}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontWeight: 700, color: '#059669' }}>
                      ₦{parseFloat(item.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: item.quantity <= item.min_threshold ? '#d97706' : '#0f172a' }}>
                      {item.quantity} <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-dim)' }}>units</span>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Threshold: {item.min_threshold}</div>
                  </td>
                  <td>
                    {getStockBadge(item.quantity, item.min_threshold)}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                      <button 
                        className="btn btn-sm btn-success" 
                        onClick={() => onRestock(item)}
                        title="Add more stock">
                        + Restock
                      </button>
                      <button 
                        className="btn btn-sm btn-secondary" 
                        onClick={() => onAdjust(item)}
                        title="Update or deduct stock">
                        ⚖️ Adjust
                      </button>
                      <button 
                        className="btn btn-sm btn-outline-danger" 
                        onClick={() => onDelete(item)}
                        title="Delete this stock item">
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
        <span>Showing {filteredItems.length} of {items.length} items</span>
        <span>Catalog automatically synchronized</span>
      </div>
    </div>
  );
}

window.InventoryTable = InventoryTable;
