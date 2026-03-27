import { useState, useEffect } from "react";
import { useAuth } from "../App";

export default function FleetDashboard() {
  const { user, logout, apiCall } = useAuth();
  const [tab, setTab] = useState(0);
  const [vehicles, setVehicles] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [msg, setMsg] = useState("");
  const [maintForm, setMaintForm] = useState({ vehicle_id: "", maintenance_type: "", description: "", cost: "", next_due_date: "" });

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const [v, m] = await Promise.all([
        apiCall("/vehicles?status="),
        apiCall("/maintenance")
      ]);
      setVehicles(v); setMaintenance(m);
    } catch (e) { setMsg("Failed to load: " + e.message); }
  };

  const updateStatus = async (id, status) => {
    try {
      await apiCall(`/vehicles/${id}`, { method: "PUT", body: JSON.stringify({ status }) });
      setMsg(`✅ Vehicle status updated to ${status}`);
      fetchAll();
    } catch (e) { setMsg("❌ " + e.message); }
  };

  const logMaintenance = async () => {
    try {
      await apiCall("/maintenance", {
        method: "POST",
        body: JSON.stringify({ ...maintForm, vehicle_id: parseInt(maintForm.vehicle_id), cost: parseFloat(maintForm.cost) })
      });
      setMsg("✅ Maintenance logged! Vehicle status set to maintenance.");
      setMaintForm({ vehicle_id: "", maintenance_type: "", description: "", cost: "", next_due_date: "" });
      fetchAll();
    } catch (e) { setMsg("❌ " + e.message); }
  };

  const statusColors = { available: "#10b981", booked: "#f59e0b", maintenance: "#ef4444" };
  const TABS = ["🚗 Vehicle Status", "🔧 Log Maintenance", "📋 Maintenance History"];

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #ecfdf5 0%, #f8fafc 40%, #f1f5f9 100%)", fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ background: "linear-gradient(120deg, #065f46, #0f766e)", color: "white", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 10px 24px rgba(6,95,70,0.25)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 24 }}>🔧</span>
          <div><div style={{ fontWeight: 700, fontSize: 18 }}>Fleet Manager Dashboard</div><div style={{ fontSize: 12, opacity: 0.7 }}>{user.name}</div></div>
        </div>
        <button onClick={logout} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "white", padding: "8px 16px", borderRadius: 8, cursor: "pointer" }}>Logout</button>
      </div>

      <div style={{ background: "rgba(255,255,255,0.84)", borderBottom: "1px solid #dbe3ea", display: "flex", paddingLeft: 24, backdropFilter: "blur(8px)" }}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)} style={{ padding: "14px 20px", border: "none", background: "none", cursor: "pointer", borderBottom: tab === i ? "3px solid #0f766e" : "3px solid transparent", color: tab === i ? "#065f46" : "#64748b", fontWeight: tab === i ? 700 : 500, fontSize: 14 }}>{t}</button>
        ))}
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
        {msg && <div style={{ background: msg.startsWith("✅") ? "#d1fae5" : "#fee2e2", color: msg.startsWith("✅") ? "#065f46" : "#991b1b", padding: "12px 16px", borderRadius: 8, marginBottom: 16 }}>{msg}<button onClick={() => setMsg("")} style={{ float: "right", border: "none", background: "none", cursor: "pointer" }}>×</button></div>}

        {/* Vehicle Status */}
        {tab === 0 && <>
          <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
            {["available", "booked", "maintenance"].map(s => {
              const count = vehicles.filter(v => v.status === s).length;
              return (
                <div key={s} style={{ background: "rgba(255,255,255,0.93)", borderRadius: 16, padding: "16px 24px", boxShadow: "0 10px 24px rgba(15,23,42,0.08)", border: "1px solid #d9e7df", borderLeft: `4px solid ${statusColors[s]}` }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: statusColors[s] }}>{count}</div>
                  <div style={{ color: "#666", fontSize: 14, textTransform: "capitalize" }}>{s}</div>
                </div>
              );
            })}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
            {vehicles.map(v => (
              <div key={v.id} style={{ background: "rgba(255,255,255,0.94)", borderRadius: 16, padding: 16, boxShadow: "0 10px 24px rgba(15,23,42,0.08)", border: "1px solid #d9e7df" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{v.brand} {v.model}</div>
                    <div style={{ color: "#888", fontSize: 12 }}>{v.registration_number} • {v.city}</div>
                  </div>
                  <span style={{ background: statusColors[v.status] + "22", color: statusColors[v.status], padding: "4px 12px", borderRadius: 12, fontSize: 12, fontWeight: 700, alignSelf: "flex-start" }}>{v.status}</span>
                </div>
                <div style={{ color: "#666", fontSize: 13, marginBottom: 12 }}>{v.type} • {v.fuel_type} • {v.seating_capacity} seats</div>
                {v.insurance_expiry && <div style={{ color: "#f59e0b", fontSize: 12, marginBottom: 8 }}>🛡️ Insurance: {v.insurance_expiry}</div>}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {["available", "maintenance"].filter(s => s !== v.status).map(s => (
                    <button key={s} onClick={() => updateStatus(v.id, s)} style={{
                      padding: "6px 12px", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 500,
                      background: s === "available" ? "#d1fae5" : "#fee2e2",
                      color: s === "available" ? "#065f46" : "#991b1b"
                    }}>Set {s}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>}

        {/* Log Maintenance */}
        {tab === 1 && (
          <div style={{ background: "rgba(255,255,255,0.95)", borderRadius: 16, padding: 24, maxWidth: 600, boxShadow: "0 10px 24px rgba(15,23,42,0.08)", border: "1px solid #d9e7df" }}>
            <h2 style={{ margin: "0 0 20px" }}>Log Maintenance Event</h2>
            <div style={{ display: "grid", gap: 14 }}>
              <div>
                <label style={lbl}>Vehicle</label>
                <select value={maintForm.vehicle_id} onChange={e => setMaintForm({ ...maintForm, vehicle_id: e.target.value })} style={inp}>
                  <option value="">Select Vehicle</option>
                  {vehicles.map(v => <option key={v.id} value={v.id}>{v.brand} {v.model} ({v.registration_number})</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Maintenance Type</label>
                <select value={maintForm.maintenance_type} onChange={e => setMaintForm({ ...maintForm, maintenance_type: e.target.value })} style={inp}>
                  <option value="">Select Type</option>
                  {["Oil Change", "Tire Replacement", "Brake Service", "Engine Service", "AC Repair", "Battery Replacement", "Inspection", "Other"].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Description</label>
                <textarea value={maintForm.description} onChange={e => setMaintForm({ ...maintForm, description: e.target.value })} style={{ ...inp, height: 80, resize: "vertical" }} placeholder="Describe the maintenance work..." />
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={lbl}>Cost (₹)</label>
                  <input type="number" value={maintForm.cost} onChange={e => setMaintForm({ ...maintForm, cost: e.target.value })} style={inp} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={lbl}>Next Due Date</label>
                  <input type="date" value={maintForm.next_due_date} onChange={e => setMaintForm({ ...maintForm, next_due_date: e.target.value })} style={inp} />
                </div>
              </div>
              <button onClick={logMaintenance} style={{ padding: "12px", background: "#065f46", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 16 }}>Log Maintenance</button>
            </div>
          </div>
        )}

        {/* Maintenance History */}
        {tab === 2 && (
          <div>
            <h2 style={{ margin: "0 0 20px" }}>Maintenance History ({maintenance.length} records)</h2>
            {maintenance.length === 0 ? <div style={{ textAlign: "center", padding: 60, color: "#888" }}>No maintenance records yet.</div> : (
              <div style={{ display: "grid", gap: 12 }}>
                {maintenance.map(m => (
                  <div key={m.id} style={{ background: "white", borderRadius: 12, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.1)", display: "flex", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>Vehicle #{m.vehicle_id} — {m.type}</div>
                      <div style={{ color: "#666", fontSize: 13, marginTop: 4 }}>Date: {new Date(m.date).toLocaleDateString()}</div>
                      {m.next_due_date && <div style={{ color: "#f59e0b", fontSize: 13 }}>Next due: {m.next_due_date}</div>}
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 700, color: "#0f3460", fontSize: 18 }}>₹{m.cost}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const lbl = { fontSize: 13, color: "#334155", fontWeight: 600, display: "block", marginBottom: 4 };
const inp = { width: "100%", padding: "10px 12px", border: "1px solid #cde1d7", borderRadius: 10, fontSize: 14, boxSizing: "border-box", background: "#fff" };
