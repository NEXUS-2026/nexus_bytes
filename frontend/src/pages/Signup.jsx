// src/pages/Signup.jsx
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";

const ROLES = [
  { id: "borrower",  label: "Borrower",  desc: "Access micro-loans using your impact score" },
  { id: "verifier",  label: "Verifier",  desc: "NGO / Institution — approve activities" },
  { id: "lender",    label: "Lender",    desc: "Bank / MFI — review loan applications" },
];

export default function Signup() {
  const { signup } = useAuth();
  const navigate   = useNavigate();
  const [form, setForm] = useState({
    email: "", password: "", full_name: "", phone: "", role: "borrower",
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) return toast.error("Password must be at least 8 characters");
    setLoading(true);
    try {
      await signup(form);
      toast.success("Account created!");
      navigate("/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Create account</h1>
        <p className="text-gray-400 text-sm mb-6">Join ImpactScore — free and open to all</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Role selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">I am a…</label>
            <div className="grid grid-cols-3 gap-2">
              {ROLES.map((r) => (
                <button key={r.id} type="button"
                  onClick={() => setForm((f) => ({ ...f, role: r.id }))}
                  className={`p-3 rounded-xl border-2 text-center transition text-sm
                    ${form.role === r.id ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-gray-300"}`}>
                  <div className="font-medium text-gray-800">{r.label}</div>
                  <div className="text-xs text-gray-400 mt-0.5 hidden sm:block leading-tight">{r.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input required value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone (optional)</label>
              <input type="tel" value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" required value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password (min 8 chars)</label>
            <input type="password" required minLength={8} value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 transition">
            {loading ? "Creating account…" : "Create Account"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-5">
          Already have an account? <Link to="/login" className="text-indigo-600 font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
