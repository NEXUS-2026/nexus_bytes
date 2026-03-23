// src/context/AuthContext.jsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import api from "../utils/api";
import { toast } from "react-toastify";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState(null);

  // ── Restore session ───────────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get("/auth/me")
      .then(({ data }) => setUser(data))
      .catch(() => localStorage.removeItem("token"))
      .finally(() => setLoading(false));
  }, []);

  // ── Auth actions ──────────────────────────────────────────────────────────
  const signup = async (payload) => {
    const { data } = await api.post("/auth/signup", payload);
    localStorage.setItem("token", data.token);
    setUser(data.user);
    return data;
  };

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("token", data.token);
    setUser(data.user);
    return data;
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
    setWallet(null);
  };

  // ── MetaMask ──────────────────────────────────────────────────────────────
  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      toast.error("MetaMask not found. Please install it.");
      return;
    }
    try {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      const address = accounts[0];
      setWallet(address);

      // Persist to backend if logged in
      if (user) {
        await api.put("/auth/wallet", { wallet_address: address });
        setUser((u) => ({ ...u, wallet_address: address }));
        toast.success("Wallet connected!");
      }
      return address;
    } catch (err) {
      toast.error("Wallet connection failed: " + err.message);
    }
  }, [user]);

  // Listen for account changes
  useEffect(() => {
    if (!window.ethereum) return;

    const syncWallet = async () => {
      try {
        const accounts = await window.ethereum.request({
          method: "eth_accounts",
        });
        setWallet(accounts[0] || null);
      } catch {
        setWallet(null);
      }
    };

    syncWallet();

    const handleChange = (accounts) => {
      setWallet(accounts[0] || null);
    };
    window.ethereum.on("accountsChanged", handleChange);
    return () =>
      window.ethereum.removeListener("accountsChanged", handleChange);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, wallet, signup, login, logout, connectWallet }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
};
