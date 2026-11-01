import { useEffect, useMemo, useState } from "react";
import { TbSearch } from "react-icons/tb";
import { useProducts } from "@/features/products";


const USERS_STORAGE_KEY = "ecommerce.admin.users.v1";
const BOOKINGS_STORAGE_KEY = "ecommerce.admin.bookings.v1";

const TABS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "orders", label: "Orders" },
  { id: "products", label: "Products" },
  { id: "customers", label: "Customers" },
  { id: "analytics", label: "Analytics" },
  { id: "notifications", label: "Notifications" },
  { id: "settings", label: "Settings" },
];

const currency = (value) =>
  `Tk ${new Intl.NumberFormat("en-BD", { maximumFractionDigits: 0 }).format(
    Number(value) || 0
  )}`;

const applyDiscountPrice = (price, discountPercent) => {
  const safePrice = Number(price) || 0;
  const safeDiscount = Math.max(0, Math.min(95, Number(discountPercent) || 0));
  if (!safeDiscount) return safePrice;
  return Math.round(safePrice * (1 - safeDiscount / 100));
};

const readStorage = (key) => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeStorage = (key, value) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
};

const StatusPill = ({ label, tone = "neutral" }) => (
  <span className={`status-pill status-${tone}`}>{label}</span>
);

const AdminPanelPage = () => {
  const {
    products,
    isLoading,
    isError,
    addProduct,
    updateProduct,
    deleteProduct,
    toggleProductStock,
    applyDiscount,
    searchProducts,
  } = useProducts();

  const [activeTab, setActiveTab] = useState("dashboard");
  const [users, setUsers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [globalSearch, setGlobalSearch] = useState("");
  const [adminSearch, setAdminSearch] = useState("");
  const [discountDrafts, setDiscountDrafts] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [productDrafts, setProductDrafts] = useState({});
  const [confirmDialog, setConfirmDialog] = useState(null);

  const [addForm, setAddForm] = useState({
    title: "",
    category: "Beauty",
    price: "",
    image: "",
    stock: "",
    discountPercent: "",
  });

  const [userForm, setUserForm] = useState({ name: "", email: "", avatar: "" });
  const [bookingForm, setBookingForm] = useState({
    userName: "",
    product: "",
    quantity: "1",
    total: "",
    status: "Pending",
  });

  const closeConfirm = () => setConfirmDialog(null);
  const openConfirm = (config) => setConfirmDialog(config);
  const runConfirm = () => {
    if (!confirmDialog) return;
    confirmDialog.onConfirm?.();
    closeConfirm();
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const storedUsers = readStorage(USERS_STORAGE_KEY);
        const storedBookings = readStorage(BOOKINGS_STORAGE_KEY);

        if (Array.isArray(storedUsers)) setUsers(storedUsers);
        if (Array.isArray(storedBookings)) setBookings(storedBookings);
        if (Array.isArray(storedUsers) && Array.isArray(storedBookings)) return;

        const [usersRes, bookingsRes] = await Promise.all([
          fetch("/users.json"),
          fetch("/bookings.json"),
        ]);
        const [usersJson, bookingsJson] = await Promise.all([
          usersRes.json(),
          bookingsRes.json(),
        ]);

        if (!active) return;
        const safeUsers = Array.isArray(usersJson) ? usersJson : [];
        const safeBookings = Array.isArray(bookingsJson) ? bookingsJson : [];

        if (!Array.isArray(storedUsers)) {
          setUsers(safeUsers);
          writeStorage(USERS_STORAGE_KEY, safeUsers);
        }
        if (!Array.isArray(storedBookings)) {
          setBookings(safeBookings);
          writeStorage(BOOKINGS_STORAGE_KEY, safeBookings);
        }
      } catch {
        if (!active) return;
        setUsers((prev) => prev || []);
        setBookings((prev) => prev || []);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  const persistUsers = (next) => {
    setUsers(next);
    writeStorage(USERS_STORAGE_KEY, next);
  };

  const persistBookings = (next) => {
    setBookings(next);
    writeStorage(BOOKINGS_STORAGE_KEY, next);
  };

  const filteredProducts = useMemo(
    () => searchProducts(adminSearch),
    [searchProducts, adminSearch]
  );

  const dashboardSearchResults = useMemo(() => {
    const query = globalSearch.trim().toLowerCase();
    if (!query) {
      return {
        products: filteredProducts.slice(0, 4),
        users: users.slice(0, 4),
        bookings: bookings.slice(0, 4),
      };
    }

    return {
      products: filteredProducts.filter((product) => {
        const text = `${product?.title || ""} ${product?.category || ""} ${product?.sku || ""}`.toLowerCase();
        return text.includes(query);
      }),
      users: users.filter((user) => {
        const text = `${user?.name || ""} ${user?.email || ""}`.toLowerCase();
        return text.includes(query);
      }),
      bookings: bookings.filter((booking) => {
        const text = `${booking?.id || ""} ${booking?.userName || ""} ${booking?.product || ""}`.toLowerCase();
        return text.includes(query);
      }),
    };
  }, [bookings, filteredProducts, globalSearch, users]);

  const revenue = useMemo(
    () =>
      products.reduce((sum, item) => {
        const unitPrice = applyDiscountPrice(item?.price, item?.discountPercent);
        const qty = Math.max(Number(item?.stock) || 1, 1);
        return sum + unitPrice * qty;
      }, 0),
    [products]
  );

  const outOfStockCount = useMemo(
    () =>
      products.filter((item) => !(item?.inStock ?? (Number(item?.stock) || 0) > 0)).length,
    [products]
  );

  const lowStockCount = useMemo(
    () =>
      products.filter((item) => {
        const isInStock = item?.inStock ?? (Number(item?.stock) || 0) > 0;
        return isInStock && (Number(item?.stock) || 0) > 0 && Number(item?.stock) < 5;
      }).length,
    [products]
  );

  const onAddProduct = (e) => {
    e.preventDefault();
    addProduct({
      ...addForm,
      price: Number(addForm.price) || 0,
      stock: Number(addForm.stock) || 0,
      discountPercent: Number(addForm.discountPercent) || 0,
      inStock: (Number(addForm.stock) || 0) > 0,
    });
    setAddForm({
      title: "",
      category: "Beauty",
      price: "",
      image: "",
      stock: "",
      discountPercent: "",
    });
  };

  const onAddUser = (e) => {
    e.preventDefault();
    const next = [
      {
        id: Date.now(),
        name: userForm.name,
        email: userForm.email,
        avatar:
          userForm.avatar ||
          "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=180&q=80",
        orders: 0,
        spent: 0,
        tag: "New",
      },
      ...users,
    ];
    persistUsers(next);
    setUserForm({ name: "", email: "", avatar: "" });
  };

  const onAddBooking = (e) => {
    e.preventDefault();
    const id = `BK-${Math.floor(9000 + Math.random() * 900)}`;
    const next = [
      {
        id,
        userName: bookingForm.userName,
        product: bookingForm.product,
        quantity: Number(bookingForm.quantity) || 1,
        total: Number(bookingForm.total) || 0,
        status: bookingForm.status,
        date: new Date().toISOString().slice(0, 10),
      },
      ...bookings,
    ];
    persistBookings(next);
    setBookingForm({
      userName: "",
      product: "",
      quantity: "1",
      total: "",
      status: "Pending",
    });
  };

  const renderMetric = (label, value, hint) => (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      {hint && <div className="metric-hint">{hint}</div>}
    </div>
  );

  const chartPoints = [42, 58, 36, 66, 54, 72, 48];

  const topOrders = bookings.slice(0, 6);

  return (
    <div className="admin-console">
      <div className="admin-layout">
        <aside className="admin-sidebar">
          <div className="brand-block">
            <div className="brand-mark">E</div>
            <div>
              <div className="brand-title">Enterprise Admin</div>
              <div className="brand-sub">Operations console</div>
            </div>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-label">Navigation</div>
            <div className="sidebar-nav">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`sidebar-link ${activeTab === tab.id ? "active" : ""}`}
                >
                  <span>{tab.label}</span>
                  <span className="sidebar-dot" />
                </button>
              ))}
            </div>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-label">Today</div>
            <div className="sidebar-stats">
              <div>
                <span>Revenue</span>
                <strong>{currency(revenue)}</strong>
              </div>
              <div>
                <span>Orders</span>
                <strong>{bookings.length}</strong>
              </div>
              <div>
                <span>Products</span>
                <strong>{products.length}</strong>
              </div>
            </div>
          </div>

          <div className="sidebar-section sidebar-footnote">
            <StatusPill label="Live sync" tone="success" />
            <StatusPill label="Draft edits" tone="info" />
          </div>
        </aside>

        <main className="admin-main">
          <header className="admin-topbar">
            <div>
              <div className="eyebrow">Store operations</div>
              <h1>Enterprise control center</h1>
              <p>
                Search, update, publish, and monitor every core store workflow from a single workspace.
              </p>
            </div>

            <div className="topbar-actions">
              <div className="search-shell">
                <TbSearch aria-hidden="true" />
                <input
                  type="search"
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                  placeholder="Search records"
                />
              </div>
              <button type="button" className="action-button secondary" onClick={() => setActiveTab("products")}>
                Add product
              </button>
              <button type="button" className="action-button primary" onClick={() => setActiveTab("dashboard")}>
                Overview
              </button>
            </div>
          </header>

          <section className="hero-panel">
            <div>
              <div className="hero-kicker">Modern admin stack</div>
              <h2>Focused workflows, cleaner hierarchy, and faster actions.</h2>
              <p>
                Built for operational clarity: product management, booking handling, analytics, and customer records.
              </p>
            </div>
            <div className="hero-actions">
              <button type="button" className="action-button primary" onClick={() => setActiveTab("products")}>
                Manage catalog
              </button>
              <button type="button" className="action-button secondary" onClick={() => setActiveTab("orders")}>
                Review bookings
              </button>
            </div>
          </section>

          <section className="kpi-grid">
            {renderMetric("Total Revenue", currency(revenue), "Discounted and stock-aware")}
            {renderMetric("Orders", bookings.length, "Live booking records")}
            {renderMetric("Customers", users.length, "Editable local records")}
            {renderMetric("Low Stock", lowStockCount, `${outOfStockCount} out of stock`)}
          </section>

          {activeTab === "dashboard" && (
            <section className="dashboard-grid">
              <div className="panel-card">
                <div className="panel-head">
                  <h3>Recent orders</h3>
                  <span className="panel-subtitle">Latest activity stream</span>
                </div>
                <div className="chart-panel">
                  <div className="chart-header">
                    <div>
                      <strong>Weekly revenue</strong>
                      <span>Snapshot of the current store movement</span>
                    </div>
                    <StatusPill label="+12.4%" tone="success" />
                  </div>
                  <div className="bar-chart" aria-label="Weekly revenue chart">
                    {chartPoints.map((point, index) => (
                      <div key={`${index}-${point}`} className="bar-column">
                        <div className="bar-track">
                          <div className="bar-fill" style={{ height: `${point}%` }} />
                        </div>
                        <span>{["M", "T", "W", "T", "F", "S", "S"][index]}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="table-list">
                  {topOrders.map((booking) => (
                    <div key={booking.id} className="table-row">
                      <div>
                        <strong>{booking.userName}</strong>
                        <span>{booking.id} · {booking.date}</span>
                      </div>
                      <div className="align-right">
                        <strong>{currency(booking.total)}</strong>
                        <StatusPill label={booking.status} tone={booking.status === "Delivered" ? "success" : booking.status === "Cancelled" ? "danger" : "info"} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="panel-card">
                <div className="panel-head">
                  <h3>Search pulse</h3>
                  <span className="panel-subtitle">Global query results</span>
                </div>
                <div className="pulse-grid">
                  <div className="pulse-card">
                    <span>Products</span>
                    <strong>{dashboardSearchResults.products.length}</strong>
                  </div>
                  <div className="pulse-card">
                    <span>Users</span>
                    <strong>{dashboardSearchResults.users.length}</strong>
                  </div>
                  <div className="pulse-card">
                    <span>Bookings</span>
                    <strong>{dashboardSearchResults.bookings.length}</strong>
                  </div>
                </div>
                <div className="mini-list">
                  {dashboardSearchResults.products.map((product) => (
                    <div key={product.id} className="mini-row">
                      <span>{product.title}</span>
                      <strong>{currency(applyDiscountPrice(product.price, product.discountPercent))}</strong>
                    </div>
                  ))}
                </div>
                <div className="search-meta-grid">
                  <div className="search-meta-card">
                    <span>Matching users</span>
                    <strong>{dashboardSearchResults.users.length}</strong>
                  </div>
                  <div className="search-meta-card">
                    <span>Matching bookings</span>
                    <strong>{dashboardSearchResults.bookings.length}</strong>
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeTab === "orders" && (
            <section className="content-grid">
              <div className="panel-card">
                <div className="panel-head">
                  <h3>Create booking</h3>
                  <span className="panel-subtitle">Add and manage bookings locally</span>
                </div>
                <form className="stacked-form" onSubmit={onAddBooking}>
                  <div className="form-grid">
                    <input className="field" placeholder="User name" value={bookingForm.userName} onChange={(e) => setBookingForm((prev) => ({ ...prev, userName: e.target.value }))} required />
                    <input className="field" placeholder="Product" value={bookingForm.product} onChange={(e) => setBookingForm((prev) => ({ ...prev, product: e.target.value }))} required />
                    <input className="field" type="number" min="1" placeholder="Qty" value={bookingForm.quantity} onChange={(e) => setBookingForm((prev) => ({ ...prev, quantity: e.target.value }))} required />
                    <input className="field" type="number" min="0" placeholder="Total" value={bookingForm.total} onChange={(e) => setBookingForm((prev) => ({ ...prev, total: e.target.value }))} required />
                  </div>
                  <select className="field" value={bookingForm.status} onChange={(e) => setBookingForm((prev) => ({ ...prev, status: e.target.value }))}>
                    <option>Pending</option>
                    <option>Confirmed</option>
                    <option>Shipped</option>
                    <option>Delivered</option>
                    <option>Cancelled</option>
                  </select>
                  <button type="submit" className="action-button primary">Add booking</button>
                </form>
              </div>

              <div className="panel-card">
                <div className="panel-head">
                  <h3>Booking queue</h3>
                  <span className="panel-subtitle">Inline status control</span>
                </div>
                <div className="table-list">
                  {bookings.map((booking) => (
                    <div key={booking.id} className="table-row table-row-stack">
                      <div>
                        <strong>{booking.userName}</strong>
                        <span>{booking.id} · {booking.product}</span>
                      </div>
                      <div className="row-actions">
                        <select
                          className="field compact"
                          value={booking.status}
                          onChange={(e) => {
                            const next = bookings.map((item) =>
                              item.id === booking.id ? { ...item, status: e.target.value } : item
                            );
                            persistBookings(next);
                          }}
                        >
                          <option>Pending</option>
                          <option>Confirmed</option>
                          <option>Shipped</option>
                          <option>Delivered</option>
                          <option>Cancelled</option>
                        </select>
                        <button
                          type="button"
                          className="action-button danger"
                          onClick={() =>
                            openConfirm({
                              title: "Delete booking?",
                              message: `This will remove booking ${booking.id}.`,
                              confirmLabel: "Delete",
                              tone: "danger",
                              onConfirm: () => persistBookings(bookings.filter((item) => item.id !== booking.id)),
                            })
                          }
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {activeTab === "products" && (
            <section className="content-grid products-grid">
              <div className="panel-card">
                <div className="panel-head">
                  <h3>Add product</h3>
                  <span className="panel-subtitle">Catalog intake and pricing</span>
                </div>
                <form className="stacked-form" onSubmit={onAddProduct}>
                  <input className="field" value={addForm.title} onChange={(e) => setAddForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="Product title" required />
                  <div className="form-grid">
                    <input className="field" value={addForm.category} onChange={(e) => setAddForm((prev) => ({ ...prev, category: e.target.value }))} placeholder="Category" required />
                    <input className="field" type="number" min="0" value={addForm.price} onChange={(e) => setAddForm((prev) => ({ ...prev, price: e.target.value }))} placeholder="Price" required />
                    <input className="field" type="number" min="0" value={addForm.stock} onChange={(e) => setAddForm((prev) => ({ ...prev, stock: e.target.value }))} placeholder="Stock" required />
                    <input className="field" type="number" min="0" max="95" value={addForm.discountPercent} onChange={(e) => setAddForm((prev) => ({ ...prev, discountPercent: e.target.value }))} placeholder="Discount %" />
                  </div>
                  <input className="field" value={addForm.image} onChange={(e) => setAddForm((prev) => ({ ...prev, image: e.target.value }))} placeholder="Image URL" />
                  <button type="submit" className="action-button primary">Add item</button>
                </form>
              </div>

              <div className="panel-card panel-scroll">
                <div className="panel-head">
                  <h3>Product management</h3>
                  <div className="search-inline">
                    <input value={adminSearch} onChange={(e) => setAdminSearch(e.target.value)} placeholder="Search products" />
                  </div>
                </div>

                <div className="product-table">
                  {filteredProducts.map((product) => {
                    const inStock = product?.inStock ?? (Number(product?.stock) || 0) > 0;
                    const currentDiscount = discountDrafts[product.id] ?? product?.discountPercent ?? 0;
                    const discountedPrice = applyDiscountPrice(product?.price, currentDiscount);
                    const isEditing = editingId === product.id;
                    const draft = productDrafts[product.id] || {
                      title: product.title,
                      price: product.price,
                      stock: product.stock,
                      category: product.category,
                    };

                    return (
                      <div key={product.id} className="product-row">
                        <div className="product-meta">
                          <div className="product-thumb">{(product.title || "").slice(0, 1)}</div>
                          <div>
                            {isEditing ? (
                              <input
                                className="field compact title-field"
                                value={draft.title}
                                onChange={(e) =>
                                  setProductDrafts((prev) => ({
                                    ...prev,
                                    [product.id]: { ...draft, title: e.target.value },
                                  }))
                                }
                              />
                            ) : (
                              <>
                                <strong>{product.title}</strong>
                                <span>{product.category}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="product-stats">
                          <div>
                            <span>Price</span>
                            <strong>{currency(discountedPrice)}</strong>
                          </div>
                          <div>
                            <span>Stock</span>
                            <strong>{inStock ? product.stock || 0 : 0}</strong>
                          </div>
                          <StatusPill label={inStock ? "In stock" : "Stock out"} tone={inStock ? "success" : "danger"} />
                        </div>

                        {isEditing && (
                          <div className="product-edit-grid">
                            <input
                              className="field compact"
                              type="number"
                              value={draft.price}
                              onChange={(e) =>
                                setProductDrafts((prev) => ({
                                  ...prev,
                                  [product.id]: { ...draft, price: e.target.value },
                                }))
                              }
                            />
                            <input
                              className="field compact"
                              type="number"
                              value={draft.stock || 0}
                              onChange={(e) =>
                                setProductDrafts((prev) => ({
                                  ...prev,
                                  [product.id]: { ...draft, stock: e.target.value },
                                }))
                              }
                            />
                          </div>
                        )}

                        <div className="row-actions">
                          <button type="button" className="action-button secondary" onClick={() => toggleProductStock(product.id)}>
                            {inStock ? "Set Out" : "Set In"}
                          </button>
                          {isEditing ? (
                            <button
                              type="button"
                              className="action-button primary"
                              onClick={() =>
                                openConfirm({
                                  title: "Confirm update",
                                  message: `Apply changes to ${draft.title}?`,
                                  confirmLabel: "Update",
                                  tone: "primary",
                                  onConfirm: () => {
                                    updateProduct(product.id, {
                                      title: draft.title,
                                      price: Number(draft.price) || 0,
                                      stock: Number(draft.stock) || 0,
                                      category: draft.category || product.category,
                                    });
                                    setEditingId(null);
                                    setProductDrafts((prev) => {
                                      const next = { ...prev };
                                      delete next[product.id];
                                      return next;
                                    });
                                  },
                                })
                              }
                            >
                              Save
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="action-button secondary"
                              onClick={() => {
                                setProductDrafts((prev) => ({
                                  ...prev,
                                  [product.id]: {
                                    title: product.title,
                                    price: product.price,
                                    stock: product.stock,
                                    category: product.category,
                                  },
                                }));
                                setEditingId(product.id);
                              }}
                            >
                              Update
                            </button>
                          )}
                          <button
                            type="button"
                            className="action-button danger"
                            onClick={() =>
                              openConfirm({
                                title: "Delete product?",
                                message: `This will permanently remove ${product.title}.`,
                                confirmLabel: "Delete",
                                tone: "danger",
                                onConfirm: () => deleteProduct(product.id),
                              })
                            }
                          >
                            Delete
                          </button>
                          <input
                            className="field compact discount-field"
                            type="number"
                            min="0"
                            max="95"
                            value={currentDiscount}
                            onChange={(e) =>
                              setDiscountDrafts((prev) => ({
                                ...prev,
                                [product.id]: e.target.value,
                              }))
                            }
                          />
                          <button type="button" className="action-button good" onClick={() => applyDiscount(product.id, Number(currentDiscount) || 0)}>
                            Discount
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          {activeTab === "customers" && (
            <section className="content-grid customers-grid">
              <div className="panel-card">
                <div className="panel-head">
                  <h3>Add user</h3>
                  <span className="panel-subtitle">Editable customer records</span>
                </div>
                <form className="stacked-form" onSubmit={onAddUser}>
                  <input className="field" placeholder="Name" value={userForm.name} onChange={(e) => setUserForm((prev) => ({ ...prev, name: e.target.value }))} required />
                  <input className="field" type="email" placeholder="Email" value={userForm.email} onChange={(e) => setUserForm((prev) => ({ ...prev, email: e.target.value }))} required />
                  <input className="field" placeholder="Avatar URL" value={userForm.avatar} onChange={(e) => setUserForm((prev) => ({ ...prev, avatar: e.target.value }))} />
                  <button type="submit" className="action-button primary">Add user</button>
                </form>
              </div>

              <div className="panel-card panel-scroll">
                <div className="panel-head">
                  <h3>Customer directory</h3>
                  <span className="panel-subtitle">Persistent local list</span>
                </div>
                <div className="table-list">
                  {users.map((user) => (
                    <div key={user.id} className="table-row table-row-stack">
                      <div className="customer-meta">
                        <div className="avatar">{(user.name || "").slice(0, 1)}</div>
                        <div>
                          <input className="field compact title-field" value={user.name} onChange={(e) => {
                            const next = users.map((item) => item.id === user.id ? { ...item, name: e.target.value } : item);
                            persistUsers(next);
                          }} />
                          <input className="field compact subtitle-field" value={user.email} onChange={(e) => {
                            const next = users.map((item) => item.id === user.id ? { ...item, email: e.target.value } : item);
                            persistUsers(next);
                          }} />
                        </div>
                      </div>
                      <div className="row-actions">
                        <span className="customer-meta-line">{user.orders} orders · {currency(user.spent)}</span>
                        <button
                          type="button"
                          className="action-button danger"
                          onClick={() =>
                            openConfirm({
                              title: "Delete user?",
                              message: `This will remove ${user.name} from local storage.`,
                              confirmLabel: "Delete",
                              tone: "danger",
                              onConfirm: () => persistUsers(users.filter((item) => item.id !== user.id)),
                            })
                          }
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {activeTab === "analytics" && (
            <section className="content-grid analytics-grid">
              <div className="panel-card">
                <div className="panel-head">
                  <h3>Revenue & conversion</h3>
                  <span className="panel-subtitle">Executive summary</span>
                </div>
                <div className="analytics-box">
                  <div>
                    <span>Revenue</span>
                    <strong>{currency(revenue)}</strong>
                  </div>
                  <div>
                    <span>Conversion</span>
                    <strong>3.8%</strong>
                  </div>
                </div>
              </div>

              <div className="panel-card">
                <div className="panel-head">
                  <h3>Top products</h3>
                  <span className="panel-subtitle">By discounted value</span>
                </div>
                <div className="table-list">
                  {products
                    .map((item) => ({ ...item, finalPrice: applyDiscountPrice(item.price, item.discountPercent) }))
                    .sort((a, b) => b.finalPrice - a.finalPrice)
                    .slice(0, 6)
                    .map((item, idx) => (
                      <div key={item.id} className="table-row">
                        <div>
                          <strong>
                            {idx + 1}. {item.title}
                          </strong>
                          <span>{item.category}</span>
                        </div>
                        <strong>{currency(item.finalPrice)}</strong>
                      </div>
                    ))}
                </div>
              </div>
            </section>
          )}

          {activeTab === "notifications" && (
            <section className="content-grid">
              <div className="panel-card">
                <div className="panel-head">
                  <h3>Notifications</h3>
                  <span className="panel-subtitle">Operational alerts</span>
                </div>
                <div className="table-list">
                  <div className="table-row"><span>New order placed by Rahim Khan for {currency(12400)}.</span></div>
                  <div className="table-row"><span>Low stock alert: {lowStockCount} products need refill.</span></div>
                  <div className="table-row"><span>Revenue milestone crossed this month.</span></div>
                </div>
              </div>
            </section>
          )}

          {activeTab === "settings" && (
            <section className="content-grid settings-grid">
              <div className="panel-card">
                <div className="panel-head">
                  <h3>Store profile</h3>
                  <span className="panel-subtitle">Basic configuration</span>
                </div>
                <div className="table-list">
                  <div className="table-row"><span>Admin User</span><strong>Administrator</strong></div>
                  <div className="table-row"><span>Store name</span><strong>ShopCo Global</strong></div>
                  <div className="table-row"><span>Currency</span><strong>BDT (Tk)</strong></div>
                  <div className="table-row"><span>Timezone</span><strong>Asia/Dhaka</strong></div>
                </div>
              </div>
            </section>
          )}

          {(isLoading || isError) && (
            <section className="panel-card alert-card">
              {isLoading ? "Loading product store from local storage and JSON..." : "Could not load product dataset."}
            </section>
          )}
        </main>
      </div>

      {confirmDialog && (
        <div className="confirm-backdrop" onClick={closeConfirm}>
          <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
            <p className="confirm-title">{confirmDialog.title}</p>
            <p className="confirm-message">{confirmDialog.message}</p>
            <div className="confirm-actions">
              <button type="button" className="action-button secondary" onClick={closeConfirm}>
                Cancel
              </button>
              <button
                type="button"
                className={`action-button ${confirmDialog.tone === "danger" ? "danger" : "primary"}`}
                onClick={runConfirm}
              >
                {confirmDialog.confirmLabel || "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanelPage;
