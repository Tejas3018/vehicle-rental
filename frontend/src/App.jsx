import { useState, useEffect, createContext, useContext } from "react";
import Auth from "./pages/Auth";
import CustomerDashboard from "./pages/CustomerDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import FleetDashboard from "./pages/FleetDashboard";

export const AuthContext = createContext(null);
export const API_BASE = "http://localhost:8000";

export function useAuth() { return useContext(AuthContext); }

export default function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token"));

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser && token) setUser(JSON.parse(savedUser));
  }, [token]);

  const login = (userData, accessToken) => {
    setUser(userData);
    setToken(accessToken);
    localStorage.setItem("token", accessToken);
    localStorage.setItem("user", JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  };

  const apiCall = async (endpoint, options = {}) => {
    const headers = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers };
    const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Request failed" }));
      throw new Error(err.detail || "Request failed");
    }
    return res.json();
  };

  if (!user) return (
    <AuthContext.Provider value={{ user, token, login, logout, apiCall }}>
      <Auth />
    </AuthContext.Provider>
  );

  return (
    <AuthContext.Provider value={{ user, token, login, logout, apiCall }}>
      {user.role === "admin" && <AdminDashboard />}
      {user.role === "fleet_manager" && <FleetDashboard />}
      {user.role === "customer" && <CustomerDashboard />}
    </AuthContext.Provider>
  );
}
