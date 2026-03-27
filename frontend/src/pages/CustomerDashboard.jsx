import { useState, useEffect } from "react";
import { useAuth } from "../App";

const TABS = ["🔍 Browse Vehicles", "📅 My Bookings", "🤖 AI Recommend"];

export default function CustomerDashboard() {
  const { user, logout, apiCall } = useAuth();
  const [tab, setTab] = useState(0);
  const [vehicles, setVehicles] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [filters, setFilters] = useState({ type: "", fuel_type: "", max_price: "", seats: "" });
  const [loading, setLoading] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [bookingForm, setBookingForm] = useState({ start_time: "", end_time: "", coupon_code: "" });
  const [paymentVehicle, setPaymentVehicle] = useState(null);
  const [msg, setMsg] = useState("");
  const [recommend, setRecommend] = useState({ destination: "Goa", days: 3, people: 2, budget: 8000 });
  const [aiPlan, setAiPlan] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => { fetchVehicles(); fetchBookings(); }, []);

  const fetchVehicles = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: "available" });
      if (filters.type) params.set("type", filters.type);
      if (filters.fuel_type) params.set("fuel_type", filters.fuel_type);
      if (filters.max_price) params.set("max_price", filters.max_price);
      if (filters.seats) params.set("seats", filters.seats);
      const data = await apiCall(`/vehicles?${params}`);
      setVehicles(data);
    } catch (e) { setMsg("Failed to load vehicles") }
    finally { setLoading(false); }
  };

  const fetchBookings = async () => {
    try {
      const data = await apiCall(`/bookings/user/${user.id}`);
      setBookings(data);
    } catch (e) {}
  };

  const handleBook = async () => {
    if (!bookingForm.start_time || !bookingForm.end_time) { setMsg("Please select start and end time"); return; }
    try {
      const data = await apiCall("/bookings", {
        method: "POST",
        body: JSON.stringify({ vehicle_id: selectedVehicle.id, ...bookingForm })
      });
      setMsg(`✅ Booking confirmed! Total: ₹${data.total_cost}. Please pay to confirm.`);
      setPaymentVehicle(data);
      setSelectedVehicle(null);
      fetchBookings();
    } catch (e) { setMsg("❌ " + e.message); }
  };

  const loadRazorpayScript = () => new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

  const handlePayment = async (bookingId) => {
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error("Unable to load Razorpay Checkout");

      const order = await apiCall("/payments/create-order", {
        method: "POST",
        body: JSON.stringify({ booking_id: bookingId })
      });

      const options = {
        key: order.key_id || order.key,
        amount: order.amount,
        currency: order.currency,
        name: order.name,
        description: order.description,
        order_id: order.order_id,
        prefill: {
          name: user.name,
          email: user.email
        },
        theme: { color: "#4f46e5" },
        handler: async function (response) {
          try {
            const verified = await apiCall("/payments/verify", {
              method: "POST",
              body: JSON.stringify({
                booking_id: bookingId,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              })
            });
            setMsg(`✅ Payment successful! Txn: ${verified.transaction_id}`);
            setPaymentVehicle(null);
            fetchBookings();
          } catch (e) {
            setMsg("❌ Payment verification failed: " + e.message);
          }
        }
      };

      const rz = new window.Razorpay(options);
      rz.on("payment.failed", (res) => {
        setMsg("❌ Payment failed: " + (res.error?.description || "Try again"));
      });
      rz.open();
    } catch (e) {
      setMsg("❌ " + e.message);
    }
  };

  const handleReturn = async (bookingId) => {
    try {
      const data = await apiCall(`/bookings/${bookingId}/return`, { method: "PUT" });
      setMsg(`✅ Vehicle returned! ${data.late_fee > 0 ? `Late fee: ₹${data.late_fee}` : "No late fee."}`);
      fetchBookings();
    } catch (e) { setMsg("❌ " + e.message); }
  };

  const toText = (value, fallback = "") => {
    if (value === null || value === undefined) return fallback;
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    if (Array.isArray(value)) return value.map((v) => toText(v)).filter(Boolean).join(", ");
    try { return JSON.stringify(value); } catch { return fallback; }
  };

  const normalizeAiPlan = (data) => {
    let raw = data;
    if (typeof data === "string") {
      try { raw = JSON.parse(data); } catch { raw = { reason: data }; }
    }
    raw = raw || {};

    const itineraryRaw = Array.isArray(raw.itinerary)
      ? raw.itinerary
      : typeof raw.itinerary === "string" && raw.itinerary.trim()
        ? raw.itinerary.split("\n").filter(Boolean)
        : [];

    const itinerary = itineraryRaw.map((item, idx) => {
      const text = toText(item, `Plan item ${idx + 1}`)
        .replace(/^Day\s*\d+\s*:\s*/i, "")
        .trim();
      return text || `Plan item ${idx + 1}`;
    });

    const estimated = Number(raw.estimated_cost);
    return {
      vehicle_type: toText(raw.vehicle_type, "Recommended Vehicle"),
      vehicle_example: toText(raw.vehicle_example, ""),
      reason: toText(raw.reason, "Based on your trip details and budget."),
      estimated_cost: Number.isFinite(estimated) ? estimated : 0,
      fuel_type: toText(raw.fuel_type, "petrol"),
      itinerary
    };
  };

  const getRecommendations = async () => {
    setAiLoading(true);
    setMsg("");
    try {
      const data = await apiCall("/vehicles/ai-recommend", {
        method: "POST",
        body: JSON.stringify({
          destination: recommend.destination,
          days: parseInt(recommend.days),
          people: parseInt(recommend.people),
          budget: parseFloat(recommend.budget)
        })
      });
      setAiPlan(normalizeAiPlan(data));
    } catch (e) {
      setAiPlan(null);
      setMsg("Failed to get AI recommendation: " + e.message);
    } finally {
      setAiLoading(false);
    }
  };

  const statusColor = { booked: "#f59e0b", picked_up: "#3b82f6", returned: "#10b981", cancelled: "#ef4444" };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #eef2ff 0%, #f8fafc 44%, #edf7ff 100%)", fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(120deg, #0b2447, #3c2a7a)", color: "white", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 10px 26px rgba(15,23,42,0.22)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 24 }}>🚗</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>VehicleRent Pro</div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Welcome, {user.name}</div>
          </div>
        </div>
        <button onClick={logout} style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "white", padding: "8px 16px", borderRadius: 8, cursor: "pointer" }}>Logout</button>
      </div>

      {/* Tabs */}
      <div style={{ background: "rgba(255,255,255,0.82)", borderBottom: "1px solid #dbe3ef", display: "flex", paddingLeft: 24, backdropFilter: "blur(10px)", position: "sticky", top: 0, zIndex: 10 }}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)} style={{
            padding: "14px 20px", border: "none", background: "none", cursor: "pointer",
            borderBottom: tab === i ? "3px solid #3730a3" : "3px solid transparent",
            color: tab === i ? "#1e1b4b" : "#64748b", fontWeight: tab === i ? 700 : 500, fontSize: 14
          }}>{t}</button>
        ))}
      </div>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: 24 }}>
        {msg && <div style={{ background: msg.startsWith("✅") ? "#d1fae5" : "#fee2e2", color: msg.startsWith("✅") ? "#065f46" : "#991b1b", padding: "12px 16px", borderRadius: 8, marginBottom: 16 }}>{msg}<button onClick={() => setMsg("")} style={{ float: "right", border: "none", background: "none", cursor: "pointer" }}>×</button></div>}

        {/* BROWSE VEHICLES */}
        {tab === 0 && <>
          <div style={{ background: "white", borderRadius: 12, padding: 20, marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.1)" }}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
              {[
                { label: "Type", key: "type", opts: ["", "car", "bike", "van"] },
                { label: "Fuel", key: "fuel_type", opts: ["", "petrol", "diesel", "electric", "cng"] },
              ].map(f => (
                <div key={f.key}>
                  <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>{f.label}</div>
                  <select value={filters[f.key]} onChange={e => setFilters({ ...filters, [f.key]: e.target.value })} style={selStyle}>
                    {f.opts.map(o => <option key={o} value={o}>{o || `All ${f.label}s`}</option>)}
                  </select>
                </div>
              ))}
              <div>
                <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Max Price/Day (₹)</div>
                <input type="number" placeholder="Any" value={filters.max_price} onChange={e => setFilters({ ...filters, max_price: e.target.value })} style={{ ...selStyle, width: 100 }} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Min Seats</div>
                <input type="number" placeholder="Any" value={filters.seats} onChange={e => setFilters({ ...filters, seats: e.target.value })} style={{ ...selStyle, width: 80 }} />
              </div>
              <button onClick={fetchVehicles} style={btnStyle}>Search</button>
            </div>
          </div>

          {loading ? <div style={{ textAlign: "center", padding: 40, color: "#666" }}>Loading vehicles...</div> : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
              {vehicles.map(v => (
                <div key={v.id} style={{ background: "white", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.1)" }}>
                  <div style={{ background: "linear-gradient(135deg, #0f3460, #16213e)", height: 120, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 60 }}>
                    {v.type === "car" ? "🚗" : v.type === "bike" ? "🏍️" : "🚐"}
                  </div>
                  <div style={{ padding: 16 }}>
                    <div style={{ fontWeight: 700, fontSize: 17 }}>{v.brand} {v.model}</div>
                    <div style={{ color: "#666", fontSize: 13, marginBottom: 10 }}>{v.fuel_type} • {v.seating_capacity} seats • ⭐ {v.rating}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                      <div><div style={{ fontSize: 11, color: "#888" }}>Per Hour</div><div style={{ fontWeight: 700, color: "#0f3460" }}>₹{v.price_per_hour}</div></div>
                      <div><div style={{ fontSize: 11, color: "#888" }}>Per Day</div><div style={{ fontWeight: 700, color: "#0f3460" }}>₹{v.price_per_day}</div></div>
                    </div>
                    <button onClick={() => setSelectedVehicle(v)} style={{ ...btnStyle, width: "100%" }}>Book Now</button>
                  </div>
                </div>
              ))}
              {vehicles.length === 0 && <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 40, color: "#888" }}>No vehicles found with current filters.</div>}
            </div>
          )}
        </>}

        {/* BOOKINGS */}
        {tab === 1 && <div>
          <h2 style={{ margin: "0 0 20px" }}>My Bookings ({bookings.length})</h2>
          {bookings.length === 0 ? <div style={{ textAlign: "center", padding: 60, color: "#888" }}>No bookings yet. Browse vehicles to get started!</div> : (
            bookings.map(b => (
              <div key={b.id} style={{ background: "white", borderRadius: 12, padding: 20, marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.1)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{b.vehicle?.brand} {b.vehicle?.model}</div>
                    <div style={{ color: "#666", fontSize: 13 }}>Booking #{b.id}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <span style={{ background: statusColor[b.status] + "22", color: statusColor[b.status], padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{b.status.toUpperCase()}</span>
                    <span style={{ background: b.payment_status === "paid" ? "#d1fae5" : "#fef3c7", color: b.payment_status === "paid" ? "#065f46" : "#92400e", padding: "4px 12px", borderRadius: 20, fontSize: 12 }}>{b.payment_status}</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 24, fontSize: 13, color: "#666", marginBottom: 12 }}>
                  <div>📅 {new Date(b.start_time).toLocaleString()}</div>
                  <div>→ {new Date(b.end_time).toLocaleString()}</div>
                  <div>💰 ₹{b.total_cost}</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {b.payment_status === "pending" && b.status === "booked" && (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => handlePayment(b.id)} style={{ ...btnSmall, background: "#10b981" }}>Pay Now</button>
                    </div>
                  )}
                  {b.status === "picked_up" && (
                    <button onClick={() => handleReturn(b.id)} style={{ ...btnSmall, background: "#0f3460" }}>Return Vehicle</button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>}

        {/* AI RECOMMENDATIONS */}
        {tab === 2 && <div>
          <div style={{ background: "linear-gradient(135deg, #0f3460, #533483)", borderRadius: 16, padding: 24, marginBottom: 24, color: "white" }}>
            <h2 style={{ margin: "0 0 8px" }}>🤖 AI Travel + Vehicle Assistant</h2>
            <p style={{ margin: "0 0 20px", opacity: 0.8 }}>Get a complete travel plan with best vehicle, fuel choice, estimated cost and day-wise itinerary.</p>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <div><label style={{ fontSize: 12, opacity: 0.8 }}>Destination</label>
                <input value={recommend.destination} onChange={e => setRecommend({ ...recommend, destination: e.target.value })} style={{ ...selStyle, display: "block", marginTop: 4, width: 180 }} /></div>
              <div><label style={{ fontSize: 12, opacity: 0.8 }}>Days</label>
                <input type="number" min="1" value={recommend.days} onChange={e => setRecommend({ ...recommend, days: e.target.value })} style={{ ...selStyle, display: "block", marginTop: 4, width: 80 }} /></div>
              <div><label style={{ fontSize: 12, opacity: 0.8 }}>People</label>
                <input type="number" min="1" value={recommend.people} onChange={e => setRecommend({ ...recommend, people: e.target.value })} style={{ ...selStyle, display: "block", marginTop: 4, width: 80 }} /></div>
              <div><label style={{ fontSize: 12, opacity: 0.8 }}>Total Budget (₹)</label>
                <input type="number" min="1" value={recommend.budget} onChange={e => setRecommend({ ...recommend, budget: e.target.value })} style={{ ...selStyle, display: "block", marginTop: 4, width: 150 }} /></div>
              <div style={{ alignSelf: "flex-end" }}>
                <button onClick={getRecommendations} style={{ ...btnStyle, background: "white", color: "#0f3460" }}>Generate Plan →</button>
              </div>
            </div>
          </div>
          {aiLoading && <div style={{ color: "white", padding: "8px 0" }}>Generating your travel plan...</div>}
          {aiPlan && (
            <div style={{ background: "white", borderRadius: 14, padding: 20, boxShadow: "0 1px 6px rgba(0,0,0,0.1)" }}>
              <h3 style={{ margin: "0 0 14px" }}>Recommended Plan</h3>
              <div style={{ display: "grid", gap: 10, marginBottom: 14 }}>
                <div><b>Best Vehicle Type:</b> {aiPlan.vehicle_type}</div>
                <div><b>Vehicle Example:</b> {aiPlan.vehicle_example || "Will be suggested based on availability"}</div>
                <div><b>Why this is best:</b> {aiPlan.reason}</div>
                <div><b>Estimated Total Rental Cost:</b> ₹{aiPlan.estimated_cost}</div>
                <div><b>Suggested Fuel Type:</b> {aiPlan.fuel_type}</div>
              </div>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Day-wise Itinerary</div>
              <div style={{ display: "grid", gap: 8 }}>
                {(aiPlan.itinerary || []).length > 0 ? aiPlan.itinerary.map((item, idx) => (
                  <div key={idx} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 10px", fontSize: 14 }}>
                    Day {idx + 1}: {item}
                  </div>
                )) : <div style={{ color: "#64748b" }}>No itinerary generated. Please try again.</div>}
              </div>
            </div>
          )}
        </div>}
      </div>

      {/* Booking Modal */}
      {selectedVehicle && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "white", borderRadius: 16, padding: 32, width: 440, maxWidth: "90vw" }}>
            <h3 style={{ margin: "0 0 4px" }}>Book {selectedVehicle.brand} {selectedVehicle.model}</h3>
            <p style={{ color: "#666", margin: "0 0 20px", fontSize: 14 }}>₹{selectedVehicle.price_per_hour}/hr or ₹{selectedVehicle.price_per_day}/day</p>
            <label style={{ fontSize: 13, color: "#444" }}>Start Date & Time</label>
            <input type="datetime-local" value={bookingForm.start_time} onChange={e => setBookingForm({ ...bookingForm, start_time: e.target.value })} style={{ ...selStyle, display: "block", width: "100%", marginBottom: 12, marginTop: 4 }} />
            <label style={{ fontSize: 13, color: "#444" }}>End Date & Time</label>
            <input type="datetime-local" value={bookingForm.end_time} onChange={e => setBookingForm({ ...bookingForm, end_time: e.target.value })} style={{ ...selStyle, display: "block", width: "100%", marginBottom: 12, marginTop: 4 }} />
            <label style={{ fontSize: 13, color: "#444" }}>Coupon Code (optional)</label>
            <input placeholder="e.g. WELCOME10 or FLAT200" value={bookingForm.coupon_code} onChange={e => setBookingForm({ ...bookingForm, coupon_code: e.target.value })} style={{ ...selStyle, display: "block", width: "100%", marginBottom: 20, marginTop: 4 }} />
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={handleBook} style={{ ...btnStyle, flex: 1 }}>Confirm Booking</button>
              <button onClick={() => setSelectedVehicle(null)} style={{ flex: 1, padding: "10px", border: "1px solid #ddd", borderRadius: 8, cursor: "pointer", background: "white" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const selStyle = { padding: "9px 12px", border: "1px solid #d8e1ef", borderRadius: 10, fontSize: 14, outline: "none", background: "rgba(255,255,255,0.96)", boxShadow: "0 2px 8px rgba(15,23,42,0.04)" };
const btnStyle = { padding: "10px 20px", background: "linear-gradient(135deg, #2563eb, #4f46e5)", color: "white", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 14, boxShadow: "0 8px 20px rgba(37,99,235,0.3)" };
const btnSmall = { padding: "7px 12px", background: "linear-gradient(135deg, #1d4ed8, #4338ca)", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 };
