import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate("/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.error || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white/95 rounded-3xl border border-slate-200 shadow-[0_16px_50px_rgba(2,6,23,0.12)] p-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-1">Sign in securely</h1>
        <p className="text-slate-500 text-sm mb-7">Access your ImpactScore workspace.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sky-700 text-white py-3 rounded-xl font-semibold hover:bg-sky-800 disabled:opacity-60 transition"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="mt-6 text-sm text-slate-500 rounded-xl border border-slate-200 p-3 bg-slate-50">
          Verifier and lender accounts require admin approval before login.
        </div>

        <p className="text-center text-sm text-slate-500 mt-5">
          No account? <Link to="/signup" className="text-sky-700 font-semibold">Create one</Link>
        </p>
      </div>
    </div>
  );
}
