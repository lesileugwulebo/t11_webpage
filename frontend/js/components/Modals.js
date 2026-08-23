// ==========================================================================
// Modal Dialogs for Stock Operations, Items, and Users
// ==========================================================================

// 1. Quick Restock / Add Stock Modal
function RestockModal({ isOpen, onClose, item, onSuccess }) {
  const [amount, setAmount] = React.useState(10);
  const [reason, setReason] = React.useState('Supplier delivery received');
  const [loading, setLoading] = React.useState(false);
  const { addToast } = window.useToast();

  if (!isOpen || !item) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const qty = parseInt(amount);
    if (!qty || qty <= 0) {
      addToast('Please enter a valid positive quantity to add', 'error');
      return;
    }

    setLoading(true);
    try {
      await window.api.updateStock(item.id, {
        action: 'add',
        amount: qty,
        reason: reason || `Added +${qty} units`
      });
      addToast(`Successfully added ${qty} units to ${item.name}!`, 'success');
      onSuccess();
      onClose();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">📦 Add Stock / Restock</h3>
          <button className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div style={{ marginBottom: '1rem', padding: '0.875rem', background: '#f8fafc', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '1rem' }}>{item.name}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>SKU: <span style={{ color: '#0f172a', fontWeight: 600 }}>{item.sku}</span> | Current Stock: <span style={{ color: item.quantity <= item.min_threshold ? '#d97706' : '#059669', fontWeight: 700 }}>{item.quantity} units</span></div>
            </div>

            <div className="form-group">
              <label className="form-label">Units to Add (+)</label>
              <input 
                type="number" 
                className="form-control" 
                min="1" 
                value={amount} 
                onChange={(e) => setAmount(e.target.value)} 
                required 
              />
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                {[5, 10, 25, 50, 100].map(val => (
                  <button 
                    key={val} 
                    type="button" 
                    className="btn btn-secondary btn-sm" 
                    onClick={() => setAmount(val)}>
                    +{val}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Restock Reason / PO Reference</label>
              <input 
                type="text" 
                className="form-control" 
                value={reason} 
                onChange={(e) => setReason(e.target.value)} 
                placeholder="e.g. PO-8921 Restock" 
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Updating...' : `Confirm +${amount || 0} Units`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// 2. Adjust Stock Modal (Decrease / Set / Damage / Audit)
function AdjustStockModal({ isOpen, onClose, item, onSuccess }) {
  const [adjustmentType, setAdjustmentType] = React.useState('subtract'); // 'add' or 'subtract'
  const [amount, setAmount] = React.useState(1);
  const [reason, setReason] = React.useState('Dispatched / Sold');
  const [loading, setLoading] = React.useState(false);
  const { addToast } = window.useToast();

  if (!isOpen || !item) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const qty = parseInt(amount);
    if (!qty || qty <= 0) {
      addToast('Please enter a valid quantity', 'error');
      return;
    }

    const delta = adjustmentType === 'subtract' ? -qty : qty;

    if (item.quantity + delta < 0) {
      addToast(`Cannot deduct ${qty} units. Only ${item.quantity} available in stock.`, 'error');
      return;
    }

    setLoading(true);
    try {
      await window.api.updateStock(item.id, {
        action: 'adjust',
        amount: delta,
        reason: reason || `Manual adjustment: ${delta > 0 ? '+' : ''}${delta} units`
      });
      addToast(`Stock for ${item.name} adjusted to ${item.quantity + delta} units`, 'success');
      onSuccess();
      onClose();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">⚖️ Update / Adjust Stock</h3>
          <button className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div style={{ marginBottom: '1rem', padding: '0.875rem', background: '#f8fafc', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontWeight: 700, color: '#0f172a' }}>{item.name}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Current Available: <strong style={{ color: '#0f172a' }}>{item.quantity} units</strong></div>
            </div>

            <div className="form-group">
              <label className="form-label">Adjustment Type</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <button 
                  type="button" 
                  className={`btn ${adjustmentType === 'subtract' ? 'btn-danger' : 'btn-secondary'}`}
                  onClick={() => { setAdjustmentType('subtract'); setReason('Dispatched / Sold'); }}>
                  🔻 Deduct / Dispatched
                </button>
                <button 
                  type="button" 
                  className={`btn ${adjustmentType === 'add' ? 'btn-success' : 'btn-secondary'}`}
                  onClick={() => { setAdjustmentType('add'); setReason('Found during inventory count'); }}>
                  🔺 Increase / Found
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Quantity</label>
              <input 
                type="number" 
                className="form-control" 
                min="1" 
                value={amount} 
                onChange={(e) => setAmount(e.target.value)} 
                required 
              />
            </div>

            <div className="form-group">
              <label className="form-label">Reason / Notes</label>
              <select className="form-control" value={reason} onChange={(e) => setReason(e.target.value)}>
                <option value="Dispatched / Sold">Dispatched / Sold to Client</option>
                <option value="Damaged or Defective">Damaged / Written Off</option>
                <option value="Internal Office Usage">Internal Office Usage</option>
                <option value="Found during inventory audit">Found during inventory audit</option>
                <option value="Returned by customer">Returned by customer</option>
                <option value="Other Manual Adjustment">Other Manual Adjustment</option>
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Apply Stock Change'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// 3. Create New Item Modal
function CreateItemModal({ isOpen, onClose, onSuccess }) {
  const [formData, setFormData] = React.useState({
    sku: '',
    name: '',
    description: '',
    category: 'Electronics',
    unit_price: '0.00',
    quantity: '10',
    min_threshold: '5'
  });
  const [loading, setLoading] = React.useState(false);
  const { addToast } = window.useToast();

  if (!isOpen) return null;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.sku.trim() || !formData.name.trim()) {
      addToast('SKU and Item Name are required', 'error');
      return;
    }

    setLoading(true);
    try {
      await window.api.createItem({
        sku: formData.sku.trim(),
        name: formData.name.trim(),
        description: formData.description.trim(),
        category: formData.category,
        unit_price: parseFloat(formData.unit_price) || 0,
        quantity: parseInt(formData.quantity) || 0,
        min_threshold: parseInt(formData.min_threshold) || 5
      });
      addToast(`Item "${formData.name}" created successfully!`, 'success');
      onSuccess();
      onClose();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">✨ Create New Inventory Item</h3>
          <button className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">SKU / Code *</label>
                <input 
                  type="text" 
                  name="sku" 
                  className="form-control" 
                  placeholder="e.g. ELEC-LAP-01" 
                  value={formData.sku} 
                  onChange={handleChange} 
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Category</label>
                <select name="category" className="form-control" value={formData.category} onChange={handleChange}>
                  <option value="Electronics">Electronics</option>
                  <option value="Peripherals">Peripherals</option>
                  <option value="Furniture">Furniture</option>
                  <option value="Stationery">Stationery</option>
                  <option value="Tools & Hardware">Tools & Hardware</option>
                  <option value="General">General</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Item Name *</label>
              <input 
                type="text" 
                name="name" 
                className="form-control" 
                placeholder="e.g. Wireless Noise-Cancelling Headphones" 
                value={formData.name} 
                onChange={handleChange} 
                required 
              />
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea 
                name="description" 
                className="form-control" 
                placeholder="Product specifications and details..." 
                value={formData.description} 
                onChange={handleChange} 
              />
            </div>

            <div className="grid-3">
              <div className="form-group">
                <label className="form-label">Unit Price (₦)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  name="unit_price" 
                  className="form-control" 
                  value={formData.unit_price} 
                  onChange={handleChange} 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Initial Quantity</label>
                <input 
                  type="number" 
                  name="quantity" 
                  className="form-control" 
                  value={formData.quantity} 
                  onChange={handleChange} 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Low Stock Alert At</label>
                <input 
                  type="number" 
                  name="min_threshold" 
                  className="form-control" 
                  value={formData.min_threshold} 
                  onChange={handleChange} 
                />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Register Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// 4. Create New User Modal (Admin Only)
function CreateUserModal({ isOpen, onClose, onSuccess }) {
  const [formData, setFormData] = React.useState({
    username: '',
    password: '',
    full_name: '',
    email: '',
    role: 'user'
  });
  const [loading, setLoading] = React.useState(false);
  const { addToast } = window.useToast();

  if (!isOpen) return null;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.username.trim() || !formData.password.trim() || !formData.full_name.trim() || !formData.email.trim()) {
      addToast('All fields are required', 'error');
      return;
    }

    setLoading(true);
    try {
      await window.api.createUser(formData);
      addToast(`User ${formData.username} created successfully!`, 'success');
      onSuccess();
      onClose();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">👤 Create New User Account</h3>
          <button className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input 
                type="text" 
                name="full_name" 
                className="form-control" 
                placeholder="e.g. Alex Morgan" 
                value={formData.full_name} 
                onChange={handleChange} 
                required 
              />
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Username</label>
                <input 
                  type="text" 
                  name="username" 
                  className="form-control" 
                  placeholder="alex_m" 
                  value={formData.username} 
                  onChange={handleChange} 
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <input 
                  type="password" 
                  name="password" 
                  className="form-control" 
                  placeholder="••••••••" 
                  value={formData.password} 
                  onChange={handleChange} 
                  required 
                />
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input 
                  type="email" 
                  name="email" 
                  className="form-control" 
                  placeholder="alex@company.com" 
                  value={formData.email} 
                  onChange={handleChange} 
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Role Assignment</label>
                <select name="role" className="form-control" value={formData.role} onChange={handleChange}>
                  <option value="user">User / Warehouse Staff</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-admin" disabled={loading}>
              {loading ? 'Creating...' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

window.RestockModal = RestockModal;
window.AdjustStockModal = AdjustStockModal;
window.CreateItemModal = CreateItemModal;
window.CreateUserModal = CreateUserModal;
