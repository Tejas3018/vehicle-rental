import { useState } from "react";
import { useAuth } from "../App";

export default function Auth() {
  const { login, apiCall } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "customer", license_number: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const endpoint = isLogin ? "/auth/login" : "/auth/signup";
      const body = isLogin ? { email: form.email, password: form.password } : form;
      const data = await apiCall(endpoint, {
        method: "POST",
        body: JSON.stringify(body)
      });
      login(data.user, data.access_token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const demoLogin = async (email, password) => {
    setForm({ ...form, email, password });
    setError(""); setLoading(true);
    try {
      const data = await apiCall("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      login(data.user, data.access_token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(circle at 10% 10%, #2c5cff 0%, transparent 35%), radial-gradient(circle at 90% 20%, #8b5cf6 0%, transparent 30%), linear-gradient(160deg, #0b1220 0%, #101a34 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, system-ui, sans-serif", padding: 24 }}>
      <div style={{ background: "rgba(255,255,255,0.94)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.6)", borderRadius: 24, padding: 36, width: 440, boxShadow: "0 20px 60px rgba(11,18,32,0.35)" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🚗</div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#1a1a2e" }}>VehicleRent Pro</h1>
          <p style={{ color: "#666", margin: "4px 0 0" }}>Smart Vehicle Rental Platform</p>
        </div>

        <div style={{ display: "flex", marginBottom: 24, background: "#eef2ff", borderRadius: 12, padding: 4 }}>
          {["Login", "Sign Up"].map((t, i) => (
            <button key={t} onClick={() => setIsLogin(i === 0)} style={{
              flex: 1, padding: "8px 0", border: "none", borderRadius: 6, cursor: "pointer",
              background: (i === 0) === isLogin ? "white" : "transparent",
              fontWeight: (i === 0) === isLogin ? 700 : 500,
              color: (i === 0) === isLogin ? "#1d4ed8" : "#64748b",
              boxShadow: (i === 0) === isLogin ? "0 4px 12px rgba(29,78,216,0.15)" : "none"
            }}>{t}</button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          {!isLogin && <>
            <input placeholder="Full Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              required style={inputStyle} />
            <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} style={inputStyle}>
              <option value="customer">Customer</option>
              <option value="admin">Admin</option>
              <option value="fleet_manager">Fleet Manager</option>
            </select>
            {form.role === "customer" && (
              <input placeholder="Driving License Number" value={form.license_number}
                onChange={e => setForm({ ...form, license_number: e.target.value })} style={inputStyle} />
            )}
          </>}
          <input type="email" placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
            required style={inputStyle} />
          <input type="password" placeholder="Password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
            required style={inputStyle} />
          {error && <div style={{ color: "red", fontSize: 14, marginBottom: 12 }}>{error}</div>}
          <button type="submit" disabled={loading} style={{
            width: "100%", padding: "12px", background: "linear-gradient(135deg, #2563eb, #7c3aed)", color: "white",
            border: "none", borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: "pointer", boxShadow: "0 10px 24px rgba(37,99,235,0.28)"
          }}>{loading ? "Please wait..." : isLogin ? "Login" : "Create Account"}</button>
        </form>

        <div style={{ marginTop: 20, borderTop: "1px solid #eee", paddingTop: 16 }}>
          <p style={{ color: "#888", fontSize: 13, marginBottom: 8, textAlign: "center" }}>Quick Demo Login:</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              { label: "👑 Admin", email: "admin@rental.com", pass: "admin123" },
              { label: "🚗 Fleet", email: "fleet@rental.com", pass: "fleet123" },
              { label: "👤 Customer", email: "john@example.com", pass: "john123" },
            ].map(d => (
              <button key={d.label} onClick={() => demoLogin(d.email, d.pass)} style={{
                flex: 1, padding: "8px 4px", border: "1px solid #dbeafe", borderRadius: 10,
                background: "#f8faff", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#1e3a8a"
              }}>{d.label}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "11px 13px", border: "1px solid #dbe3f0", borderRadius: 12,
  fontSize: 14, marginBottom: 12, boxSizing: "border-box", outline: "none", background: "#fff", color: "#0f172a"
};
