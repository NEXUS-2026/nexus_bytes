import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";

const ROLES = [
  { id: "borrower", label: "Borrower", desc: "Access loans through impact history" },
  { id: "verifier", label: "Verifier", desc: "Requires admin approval before login" },
  { id: "lender", label: "Lender", desc: "Requires admin approval before login" },
];

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: "",
    verification_code: "",
    password: "",
    full_name: "",
    phone: "",
    alternate_phone: "",
    role: "borrower",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    country: "India",
    pincode: "",
    organization_name: "",
    government_id: "",
  });

  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);

  const sendCode = async () => {
    if (!form.email.trim()) return toast.error("Enter email first");
    setSendingCode(true);
    try {
      const { data } = await api.post("/auth/request-email-code", { email: form.email.trim() });
      setCodeSent(true);
      if (data.dev_code) {
        toast.info(`Dev code: ${data.dev_code}`);
      } else {
        toast.success("Verification code sent to your email");
      }
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to send code");
    } finally {
      setSendingCode(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) return toast.error("Password must be at least 8 characters");
    if (!form.phone.trim()) return toast.error("Primary phone is required");
    if (!form.verification_code.trim()) return toast.error("Verification code is required");

    setLoading(true);
    try {
      const data = await signup(form);
      if (data.pendingApproval) {
        toast.info(data.message || "Account created. Wait for admin approval before login.");
        navigate("/login");
        return;
      }
      toast.success("Account created and verified!");
      navigate("/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-3xl bg-white/95 rounded-3xl border border-slate-200 shadow-[0_16px_50px_rgba(2,6,23,0.12)] p-8 md:p-10">
        <h1 className="text-3xl font-bold text-slate-900 mb-1">Create secure account</h1>
        <p className="text-slate-500 text-sm mb-7">Registration requires a real email verification code.</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">I am joining as</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {ROLES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, role: r.id }))}
                  className={`p-3 rounded-xl border-2 text-left transition ${form.role === r.id ? "border-sky-600 bg-sky-50" : "border-slate-200 hover:border-slate-300"}`}
                >
                  <div className="font-semibold text-slate-800 text-sm">{r.label}</div>
                  <div className="text-xs text-slate-500 mt-0.5 leading-tight">{r.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
              />
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={sendCode}
                disabled={sendingCode}
                className="w-full bg-slate-900 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-800 disabled:opacity-60"
              >
                {sendingCode ? "Sending..." : codeSent ? "Resend Code" : "Send Code"}
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Verification Code</label>
              <input
                required
                value={form.verification_code}
                onChange={(e) => setForm((f) => ({ ...f, verification_code: e.target.value }))}
                placeholder="6-digit code"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <Field label="Full Name" required value={form.full_name} onChange={(v) => setForm((f) => ({ ...f, full_name: v }))} />
            <Field label="Primary Phone" required value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} />
            <Field label="Alternate Phone" value={form.alternate_phone} onChange={(v) => setForm((f) => ({ ...f, alternate_phone: v }))} />
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Address Line 1" value={form.address_line1} onChange={(v) => setForm((f) => ({ ...f, address_line1: v }))} />
            <Field label="Address Line 2" value={form.address_line2} onChange={(v) => setForm((f) => ({ ...f, address_line2: v }))} />
          </div>

          <div className="grid md:grid-cols-4 gap-3">
            <Field label="City" value={form.city} onChange={(v) => setForm((f) => ({ ...f, city: v }))} />
            <Field label="State" value={form.state} onChange={(v) => setForm((f) => ({ ...f, state: v }))} />
            <Field label="Country" value={form.country} onChange={(v) => setForm((f) => ({ ...f, country: v }))} />
            <Field label="Pincode" value={form.pincode} onChange={(v) => setForm((f) => ({ ...f, pincode: v }))} />
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Organization (optional)" value={form.organization_name} onChange={(v) => setForm((f) => ({ ...f, organization_name: v }))} />
            <Field label="Govt ID (optional)" value={form.government_id} onChange={(v) => setForm((f) => ({ ...f, government_id: v }))} />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sky-700 text-white py-3 rounded-xl font-semibold hover:bg-sky-800 disabled:opacity-60"
          >
            {loading ? "Creating account..." : "Create Verified Account"}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-6">
          Already have an account? <Link to="/login" className="text-sky-700 font-semibold">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, required = false }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <input
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
      />
    </div>
  );
}
