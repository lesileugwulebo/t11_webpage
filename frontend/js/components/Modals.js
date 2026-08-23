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

// 5. Create Support / Stock Request Ticket Modal
function CreateTicketModal({ isOpen, onClose, items = [], onSuccess }) {
  const [formData, setFormData] = React.useState({
    title: '',
    ticket_type: 'STOCK_REQUEST',
    item_id: '',
    quantity_requested: 1,
    priority: 'MEDIUM',
    description: ''
  });
  const [loading, setLoading] = React.useState(false);
  const { addToast } = window.useToast();

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleItemSelect = (e) => {
    const itemId = e.target.value;
    const selected = items.find(i => String(i.id) === String(itemId));
    setFormData(prev => ({
      ...prev,
      item_id: itemId,
      title: selected ? `Stock Requisition: ${selected.name} (${selected.sku})` : prev.title
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.description) {
      addToast('Please provide a title and detailed description', 'error');
      return;
    }

    setLoading(true);
    try {
      const selected = items.find(i => String(i.id) === String(formData.item_id));
      await window.api.createTicket({
        title: formData.title,
        ticket_type: formData.ticket_type,
        item_id: formData.item_id ? parseInt(formData.item_id) : null,
        item_name: selected ? selected.name : null,
        quantity_requested: parseInt(formData.quantity_requested) || 0,
        priority: formData.priority,
        description: formData.description
      });
      addToast('Support ticket / stock request submitted successfully!', 'success');
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
          <h3 className="modal-title">🎫 Submit Stock Request / Support Ticket</h3>
          <button className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Ticket Type *</label>
                <select name="ticket_type" className="form-control" value={formData.ticket_type} onChange={handleChange} required>
                  <option value="STOCK_REQUEST">📦 Stock Requisition / Hardware Request</option>
                  <option value="DAMAGE_REPORT">⚠️ Report Damaged Equipment</option>
                  <option value="MAINTENANCE">🔧 IT Maintenance / Repair</option>
                  <option value="GENERAL_SUPPORT">💬 General IT / Inventory Support</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Priority Level</label>
                <select name="priority" className="form-control" value={formData.priority} onChange={handleChange}>
                  <option value="LOW">🟢 Low</option>
                  <option value="MEDIUM">🔵 Medium</option>
                  <option value="HIGH">🟠 High</option>
                  <option value="URGENT">🔴 Urgent (Immediate Action)</option>
                </select>
              </div>
            </div>

            {formData.ticket_type === 'STOCK_REQUEST' && (
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Select Catalog Product (Optional)</label>
                  <select name="item_id" className="form-control" value={formData.item_id} onChange={handleItemSelect}>
                    <option value="">-- Choose an item to request --</option>
                    {items.map(i => (
                      <option key={i.id} value={i.id}>
                        {i.name} ({i.sku}) - {i.quantity} in stock
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Quantity Needed</label>
                  <input 
                    type="number" 
                    name="quantity_requested" 
                    className="form-control" 
                    min="1" 
                    value={formData.quantity_requested} 
                    onChange={handleChange} 
                  />
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Subject / Ticket Title *</label>
              <input 
                type="text" 
                name="title" 
                className="form-control" 
                placeholder="e.g. Request new monitor for workstation setup" 
                value={formData.title} 
                onChange={handleChange} 
                required 
              />
            </div>

            <div className="form-group">
              <label className="form-label">Detailed Request Notes / Justification *</label>
              <textarea 
                name="description" 
                className="form-control" 
                rows="3" 
                placeholder="Explain what is needed, which department or user it is for, and any relevant deadlines..." 
                value={formData.description} 
                onChange={handleChange} 
                required 
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Submitting...' : 'Submit Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// 6. Admin Ticket Status / Approval Modal
function TicketDetailsModal({ isOpen, onClose, ticket, onStatusUpdate }) {
  const [status, setStatus] = React.useState('APPROVED');
  const [adminNotes, setAdminNotes] = React.useState('');
  const [deductStock, setDeductStock] = React.useState(true);
  const [loading, setLoading] = React.useState(false);
  const { addToast } = window.useToast();

  React.useEffect(() => {
    if (ticket) {
      setStatus(ticket.status === 'PENDING' ? 'APPROVED' : ticket.status);
      setAdminNotes(ticket.admin_notes || '');
    }
  }, [ticket]);

  if (!isOpen || !ticket) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await window.api.updateTicketStatus(ticket.id, {
        status,
        admin_notes: adminNotes,
        deduct_stock: status === 'APPROVED' && deductStock
      });
      addToast(`Ticket ${ticket.ticket_number} marked as ${status}`, 'success');
      if (onStatusUpdate) onStatusUpdate();
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
          <h3 className="modal-title">🎫 Manage Ticket: {ticket.ticket_number}</h3>
          <button className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div style={{ marginBottom: '1rem', padding: '0.875rem', background: '#f8fafc', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '1.05rem' }}>{ticket.title}</span>
                <span className={`badge ${ticket.status === 'APPROVED' ? 'badge-success' : ticket.status === 'PENDING' ? 'badge-warning' : 'badge-neutral'}`}>
                  {ticket.status}
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Requested by: <strong>{ticket.user_name}</strong> ({ticket.user_email}) • Priority: <strong style={{ color: ticket.priority === 'URGENT' ? '#dc2626' : '#2563eb' }}>{ticket.priority}</strong>
              </div>
              {ticket.item_name && (
                <div style={{ fontSize: '0.8rem', color: '#0284c7', marginTop: '0.25rem', fontWeight: 600 }}>
                  Item: {ticket.item_name} ({ticket.quantity_requested} units requested)
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Request Description</label>
              <div style={{ padding: '0.75rem', background: '#f1f5f9', borderRadius: '4px', fontSize: '0.85rem', color: '#334155', lineHeight: 1.5 }}>
                {ticket.description}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Update Status</label>
              <select className="form-control" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="APPROVED">✅ Approve Request</option>
                <option value="IN_PROGRESS">⚙️ In Progress / Processing</option>
                <option value="RESOLVED">🎉 Mark as Resolved</option>
                <option value="REJECTED">❌ Reject Request</option>
                <option value="PENDING">⏳ Keep Pending</option>
              </select>
            </div>

            {status === 'APPROVED' && ticket.item_id && ticket.quantity_requested > 0 && (
              <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 'var(--radius-sm)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: '#065f46', fontWeight: 600 }}>
                  <input 
                    type="checkbox" 
                    checked={deductStock} 
                    onChange={(e) => setDeductStock(e.target.checked)} 
                  />
                  Automatically deduct {ticket.quantity_requested} units of {ticket.item_name} from inventory stock upon approval
                </label>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Admin Notes / Resolution Remarks</label>
              <textarea 
                className="form-control" 
                rows="2" 
                placeholder="Notes for the user or fulfillment details..." 
                value={adminNotes} 
                onChange={(e) => setAdminNotes(e.target.value)} 
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-admin" disabled={loading}>
              {loading ? 'Saving...' : 'Update Ticket'}
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
window.CreateTicketModal = CreateTicketModal;
window.TicketDetailsModal = TicketDetailsModal;
