import { useState, useEffect } from "react";
import { useAuth } from "../App";

export default function AdminDashboard() {
  const { user, logout, apiCall } = useAuth();
  const [tab, setTab] = useState(0);
  const [stats, setStats] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [pricingRules, setPricingRules] = useState([]);
  const [msg, setMsg] = useState("");
  const [vehicleForm, setVehicleForm] = useState({ type: "car", brand: "", model: "", fuel_type: "petrol", seating_capacity: 5, price_per_hour: "", price_per_day: "", registration_number: "", city: "Mumbai" });
  const [ruleForm, setRuleForm] = useState({ rule_type: "weekend", name: "", value: "", is_percentage: true, conditions: {} });
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [bookingStatusFilter, setBookingStatusFilter] = useState("all");

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const [s, v, b, r] = await Promise.all([
        apiCall("/admin/stats"),
        apiCall("/vehicles?status="),
        apiCall("/bookings/all"),
        apiCall("/pricing-rules")
      ]);
      setStats(s); setVehicles(v); setBookings(b); setPricingRules(r);
    } catch (e) { setMsg("Failed to load data: " + e.message); }
  };

  const addVehicle = async () => {
    try {
      await apiCall("/vehicles", { method: "POST", body: JSON.stringify({ ...vehicleForm, seating_capacity: parseInt(vehicleForm.seating_capacity), price_per_hour: parseFloat(vehicleForm.price_per_hour), price_per_day: parseFloat(vehicleForm.price_per_day) }) });
      setMsg("✅ Vehicle added!");
      fetchAll();
    } catch (e) { setMsg("❌ " + e.message); }
  };

  const deleteVehicle = async (id) => {
    if (!confirm("Delete this vehicle?")) return;
    try {
      await apiCall(`/vehicles/${id}`, { method: "DELETE" });
      setMsg("✅ Vehicle deleted");
      fetchAll();
    } catch (e) { setMsg("❌ " + e.message); }
  };

  const addRule = async () => {
    try {
      const body = { ...ruleForm, value: parseFloat(ruleForm.value), is_percentage: ruleForm.is_percentage === true || ruleForm.is_percentage === "true" };
      if (ruleForm.rule_type === "coupon") body.conditions = { code: ruleForm.coupon_code || "COUPON" };
      else if (ruleForm.rule_type === "seasonal") body.conditions = { season: ruleForm.season || "summer" };
      await apiCall("/pricing-rules", { method: "POST", body: JSON.stringify(body) });
      setMsg("✅ Pricing rule added!");
      fetchAll();
    } catch (e) { setMsg("❌ " + e.message); }
  };

  const deleteRule = async (id) => {
    try {
      await apiCall(`/pricing-rules/${id}`, { method: "DELETE" });
      setMsg("✅ Rule removed");
      fetchAll();
    } catch (e) { setMsg("❌ " + e.message); }
  };

  const statCards = stats ? [
    { label: "Total Revenue", value: `₹${stats.total_revenue}`, icon: "💰", color: "#10b981" },
    { label: "Active Rentals", value: stats.active_rentals, icon: "🚗", color: "#3b82f6" },
    { label: "Total Vehicles", value: stats.total_vehicles, icon: "🏢", color: "#8b5cf6" },
    { label: "Available", value: stats.available_vehicles, icon: "✅", color: "#6ee7b7" },
    { label: "In Maintenance", value: stats.maintenance_vehicles, icon: "🔧", color: "#f59e0b" },
    { label: "Customers", value: stats.total_customers, icon: "👥", color: "#ec4899" },
  ] : [];

  const TABS = ["📊 Dashboard", "🚗 Vehicles", "📅 All Bookings", "💰 Pricing Rules"];
  const statusColors = { available: "#10b981", booked: "#f59e0b", maintenance: "#ef4444" };

  const filteredVehicles = vehicles.filter(v => {
    const q = vehicleSearch.trim().toLowerCase();
    if (!q) return true;
    return `${v.brand} ${v.model} ${v.registration_number || ""} ${v.city || ""}`.toLowerCase().includes(q);
  });

  const filteredBookings = bookings.filter(b => bookingStatusFilter === "all" || b.status === bookingStatusFilter);

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #eef2ff 0%, #f8fafc 45%, #f1f5f9 100%)", fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ background: "linear-gradient(120deg, #111827, #312e81)", color: "white", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 10px 24px rgba(15,23,42,0.2)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 24 }}>👑</span>
          <div><div style={{ fontWeight: 700, fontSize: 18 }}>Admin Dashboard</div><div style={{ fontSize: 12, opacity: 0.7 }}>{user.name}</div></div>
        </div>
        <button onClick={logout} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "white", padding: "8px 16px", borderRadius: 8, cursor: "pointer" }}>Logout</button>
      </div>

      <div style={{ background: "rgba(255,255,255,0.82)", borderBottom: "1px solid #dbe3ef", display: "flex", paddingLeft: 24, backdropFilter: "blur(10px)", position: "sticky", top: 0, zIndex: 10 }}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)} style={{ padding: "14px 20px", border: "none", background: "none", cursor: "pointer", borderBottom: tab === i ? "3px solid #4338ca" : "3px solid transparent", color: tab === i ? "#312e81" : "#64748b", fontWeight: tab === i ? 700 : 500, fontSize: 14 }}>{t}</button>
        ))}
      </div>

      <div style={{ maxWidth: 1320, margin: "0 auto", padding: 24 }}>
        {msg && <div style={{ background: msg.startsWith("✅") ? "#d1fae5" : "#fee2e2", color: msg.startsWith("✅") ? "#065f46" : "#991b1b", padding: "12px 16px", borderRadius: 8, marginBottom: 16 }}>{msg}<button onClick={() => setMsg("")} style={{ float: "right", border: "none", background: "none", cursor: "pointer" }}>×</button></div>}

        {tab === 0 && <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 16, marginBottom: 24 }}>
            {statCards.map(c => (
              <div key={c.label} style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(248,250,252,0.95))", borderRadius: 18, padding: 20, boxShadow: "0 14px 30px rgba(15,23,42,0.1)", border: "1px solid #dbe3ef", borderLeft: `4px solid ${c.color}` }}>
                <div style={{ fontSize: 28 }}>{c.icon}</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: c.color }}>{c.value}</div>
                <div style={{ color: "#666", fontSize: 13 }}>{c.label}</div>
              </div>
            ))}
          </div>
          <div style={{ background: "rgba(255,255,255,0.95)", borderRadius: 18, padding: 20, boxShadow: "0 14px 30px rgba(15,23,42,0.1)", border: "1px solid #dbe3ef" }}>
            <h3 style={{ margin: "0 0 16px" }}>Recent Bookings</h3>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr style={{ background: "#f9fafb" }}>
                {["ID", "Customer", "Vehicle", "Cost", "Status", "Payment"].map(h => (
                  <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: 13, color: "#666" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {bookings.slice(0, 10).map(b => (
                  <tr key={b.id} style={{ borderTop: "1px solid #f3f4f6" }}>
                    <td style={td}>#{b.id}</td>
                    <td style={td}>User #{b.user_id}</td>
                    <td style={td}>{b.vehicle?.brand} {b.vehicle?.model}</td>
                    <td style={td}>₹{b.total_cost}</td>
                    <td style={td}><span style={{ background: "#f59e0b22", color: "#f59e0b", padding: "2px 8px", borderRadius: 12, fontSize: 12 }}>{b.status}</span></td>
                    <td style={td}><span style={{ background: b.payment_status === "paid" ? "#d1fae5" : "#fef3c7", color: b.payment_status === "paid" ? "#065f46" : "#92400e", padding: "2px 8px", borderRadius: 12, fontSize: 12 }}>{b.payment_status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>}

        {tab === 1 && <>
          <div style={{ background: "white", borderRadius: 12, padding: 24, marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.1)" }}>
            <h3 style={{ margin: "0 0 16px" }}>Add New Vehicle</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
              {[
                { label: "Type", key: "type", type: "select", opts: ["car", "bike", "van"] },
                { label: "Brand", key: "brand" }, { label: "Model", key: "model" },
                { label: "Fuel Type", key: "fuel_type", type: "select", opts: ["petrol", "diesel", "electric", "cng"] },
                { label: "Seats", key: "seating_capacity", numType: "number" },
                { label: "Price/Hour", key: "price_per_hour", numType: "number" },
                { label: "Price/Day", key: "price_per_day", numType: "number" },
                { label: "Reg Number", key: "registration_number" },
                { label: "City", key: "city" },
              ].map(f => (
                <div key={f.key}>
                  <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>{f.label}</div>
                  {f.type === "select" ? (
                    <select value={vehicleForm[f.key]} onChange={e => setVehicleForm({ ...vehicleForm, [f.key]: e.target.value })} style={selS}>
                      {f.opts.map(o => <option key={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input type={f.numType || "text"} value={vehicleForm[f.key]} onChange={e => setVehicleForm({ ...vehicleForm, [f.key]: e.target.value })} style={selS} />
                  )}
                </div>
              ))}
            </div>
            <button onClick={addVehicle} style={{ marginTop: 16, ...btnS }}>+ Add Vehicle</button>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 10, flexWrap: "wrap" }}>
            <input placeholder="Search vehicle, reg no, city..." value={vehicleSearch} onChange={e => setVehicleSearch(e.target.value)} style={{ ...selS, minWidth: 260 }} />
            <div style={{ color: "#64748b", fontSize: 13 }}>Showing {filteredVehicles.length} of {vehicles.length} vehicles</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {filteredVehicles.map(v => (
              <div key={v.id} style={{ background: "white", borderRadius: 12, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.1)" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div style={{ fontWeight: 700 }}>{v.brand} {v.model}</div>
                  <span style={{ background: statusColors[v.status] + "22", color: statusColors[v.status], padding: "2px 10px", borderRadius: 12, fontSize: 12 }}>{v.status}</span>
                </div>
                <div style={{ color: "#666", fontSize: 13, margin: "6px 0" }}>{v.type} • {v.fuel_type} • {v.seating_capacity} seats</div>
                <div style={{ fontSize: 13 }}>₹{v.price_per_hour}/hr • ₹{v.price_per_day}/day</div>
                <div style={{ color: "#888", fontSize: 12, marginTop: 4 }}>Reg: {v.registration_number} | {v.city}</div>
                <button onClick={() => deleteVehicle(v.id)} style={{ marginTop: 12, padding: "6px 12px", background: "#fee2e2", color: "#ef4444", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>Remove</button>
              </div>
            ))}
          </div>
        </>}

        {tab === 2 && <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 10, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0 }}>All Bookings ({filteredBookings.length})</h2>
            <select value={bookingStatusFilter} onChange={e => setBookingStatusFilter(e.target.value)} style={selS}>
              <option value="all">All Statuses</option>
              <option value="booked">Booked</option>
              <option value="picked_up">Picked Up</option>
              <option value="returned">Returned</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div style={{ background: "white", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.1)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr style={{ background: "#f9fafb" }}>
                {["ID", "User", "Vehicle", "Start", "End", "Cost", "Status", "Payment"].map(h => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 13, color: "#666" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filteredBookings.map(b => (
                  <tr key={b.id} style={{ borderTop: "1px solid #f3f4f6" }}>
                    <td style={td}>#{b.id}</td>
                    <td style={td}>#{b.user_id}</td>
                    <td style={td}>{b.vehicle?.brand} {b.vehicle?.model}</td>
                    <td style={td}>{new Date(b.start_time).toLocaleDateString()}</td>
                    <td style={td}>{new Date(b.end_time).toLocaleDateString()}</td>
                    <td style={td}>₹{b.total_cost}</td>
                    <td style={td}><span style={{ background: "#fef3c7", color: "#92400e", padding: "2px 8px", borderRadius: 10, fontSize: 12 }}>{b.status}</span></td>
                    <td style={td}><span style={{ background: b.payment_status === "paid" ? "#d1fae5" : "#fee2e2", color: b.payment_status === "paid" ? "#065f46" : "#991b1b", padding: "2px 8px", borderRadius: 10, fontSize: 12 }}>{b.payment_status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>}

        {tab === 3 && <>
          <div style={{ background: "white", borderRadius: 12, padding: 24, marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.1)" }}>
            <h3 style={{ margin: "0 0 16px" }}>Add Pricing Rule</h3>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Rule Type</div>
                <select value={ruleForm.rule_type} onChange={e => setRuleForm({ ...ruleForm, rule_type: e.target.value })} style={selS}>
                  {["weekend", "seasonal", "coupon", "late_fee"].map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div><div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Name</div>
                <input value={ruleForm.name} onChange={e => setRuleForm({ ...ruleForm, name: e.target.value })} style={selS} placeholder="e.g. Weekend Surcharge" /></div>
              <div><div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Value</div>
                <input type="number" value={ruleForm.value} onChange={e => setRuleForm({ ...ruleForm, value: e.target.value })} style={{ ...selS, width: 80 }} /></div>
              <div><div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Type</div>
                <select value={ruleForm.is_percentage} onChange={e => setRuleForm({ ...ruleForm, is_percentage: e.target.value === "true" })} style={selS}>
                  <option value="true">Percentage (%)</option>
                  <option value="false">Flat (₹)</option>
                </select></div>
              {ruleForm.rule_type === "coupon" && <div><div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Coupon Code</div>
                <input value={ruleForm.coupon_code || ""} onChange={e => setRuleForm({ ...ruleForm, coupon_code: e.target.value })} style={selS} placeholder="CODE" /></div>}
              {ruleForm.rule_type === "seasonal" && <div><div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Season</div>
                <select value={ruleForm.season || "summer"} onChange={e => setRuleForm({ ...ruleForm, season: e.target.value })} style={selS}>
                  {["summer", "winter", "monsoon", "autumn"].map(s => <option key={s}>{s}</option>)}
                </select></div>}
              <div style={{ alignSelf: "flex-end" }}>
                <button onClick={addRule} style={btnS}>+ Add Rule</button>
              </div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {pricingRules.map(r => (
              <div key={r.id} style={{ background: "white", borderRadius: 12, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.1)" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div style={{ fontWeight: 700 }}>{r.name}</div>
                  <span style={{ background: "#f0f9ff", color: "#0369a1", padding: "2px 10px", borderRadius: 12, fontSize: 12 }}>{r.type}</span>
                </div>
                <div style={{ margin: "8px 0", color: "#0f3460", fontWeight: 700, fontSize: 20 }}>{r.value}{r.is_percentage ? "%" : "₹"}</div>
                {r.conditions && Object.keys(r.conditions).length > 0 && <div style={{ color: "#888", fontSize: 12 }}>{JSON.stringify(r.conditions)}</div>}
                <button onClick={() => deleteRule(r.id)} style={{ marginTop: 12, padding: "6px 12px", background: "#fee2e2", color: "#ef4444", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>Remove</button>
              </div>
            ))}
          </div>
        </>}
      </div>
    </div>
  );
}

const selS = { padding: "10px 12px", border: "1px solid #d6deea", borderRadius: 10, fontSize: 14, background: "rgba(255,255,255,0.97)", boxShadow: "0 2px 8px rgba(15,23,42,0.05)" };
const btnS = { padding: "10px 20px", background: "linear-gradient(135deg, #2563eb, #4f46e5)", color: "white", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 700, boxShadow: "0 10px 24px rgba(37,99,235,0.32)" };
const td = { padding: "12px 16px", fontSize: 13, color: "#334155", borderTop: "1px solid #edf2f7" };
