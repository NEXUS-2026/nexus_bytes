// src/pages/LoanApplication.jsx
import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import api from "../utils/api";
import { Coins, TrendingUp, AlertCircle, CheckCircle } from "lucide-react";

export default function LoanApplication() {
  const [scoreData, setScoreData] = useState(null);
  const [loans,     setLoans]     = useState([]);
  const [form,      setForm]      = useState({ amount: "", duration_days: 30 });
  const [result,    setResult]    = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [applying,  setApplying]  = useState(false);

  useEffect(() => {
    Promise.all([api.get("/score"), api.get("/loan/status")])
      .then(([s, l]) => { setScoreData(s.data); setLoans(l.data); })
      .catch(() => toast.error("Failed to load data"))
      .finally(() => setLoading(false));
  }, []);

  const handleApply = async (e) => {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) return toast.error("Enter a valid amount");
    setApplying(true);
    try {
      const { data } = await api.post("/loan/apply", {
        amount:       Number(form.amount),
        duration_days: Number(form.duration_days),
      });
      setResult(data);
      toast.success("Application submitted!");
      const updated = await api.get("/loan/status");
      setLoans(updated.data);
    } catch (err) {
      toast.error(err.response?.data?.error || "Application failed");
    } finally {
      setApplying(false);
    }
  };

  if (loading) return <div className="text-center py-20 text-gray-400">Loading…</div>;

  const score    = scoreData?.score ?? 0;
  const eligible = scoreData?.loanEligible;
  const maxAmt   = scoreData?.maxLoanAmount ?? 0;
  const rate     = scoreData?.interestRate  ?? 0;
  const tier     = scoreData?.tier          ?? "none";

  const statusColors = {
    approved: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
    pending:  "bg-yellow-100 text-yellow-700",
    repaid:   "bg-blue-100 text-blue-700",
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Loan Application</h1>

      {/* Score summary */}
      <div className={`rounded-2xl border p-5 mb-8 flex items-center gap-5
        ${eligible ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
        {eligible
          ? <CheckCircle size={32} className="text-green-500 shrink-0" />
          : <AlertCircle size={32} className="text-red-400 shrink-0" />
        }
        <div className="flex-1">
          <div className="font-semibold text-gray-900">
            Impact Score: <span className="text-2xl font-bold">{score}</span>
            <span className={`ml-2 text-sm px-2 py-0.5 rounded-full capitalize
              ${tier === "low" ? "bg-green-200 text-green-800" :
                tier === "medium" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
              {tier} tier
            </span>
          </div>
          {eligible
            ? <p className="text-sm text-gray-600 mt-1">
                You qualify for up to <strong>${maxAmt.toLocaleString()}</strong> at <strong>{rate}% interest</strong>.
              </p>
            : <p className="text-sm text-gray-500 mt-1">
                Your score is too low. Submit and verify more activities to qualify.
              </p>
          }
        </div>
      </div>

      {/* Application form */}
      {eligible && !result && (
        <form onSubmit={handleApply} className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 mb-8">
          <h2 className="font-semibold text-gray-800 mb-4">Apply Now</h2>

          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Loan Amount (USD)</label>
              <input type="number" min="1" max={maxAmt} step="1"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder={`Max $${maxAmt}`}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Repayment Period</label>
              <select
                value={form.duration_days}
                onChange={(e) => setForm((f) => ({ ...f, duration_days: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
                {[7, 14, 30, 60, 90, 180, 365].map((d) => (
                  <option key={d} value={d}>{d} days</option>
                ))}
              </select>
            </div>
          </div>

          {form.amount > 0 && (
            <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600 mb-4 grid grid-cols-3 gap-3 text-center">
              <div><div className="font-bold text-gray-900">${Number(form.amount).toLocaleString()}</div><div className="text-xs text-gray-400">Requested</div></div>
              <div><div className="font-bold text-gray-900">{rate}%</div><div className="text-xs text-gray-400">Interest</div></div>
              <div><div className="font-bold text-gray-900">${(Number(form.amount) * (1 + rate / 100)).toFixed(2)}</div><div className="text-xs text-gray-400">Total Payback</div></div>
            </div>
          )}

          <button type="submit" disabled={applying}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 transition flex items-center justify-center gap-2">
            <Coins size={18} />
            {applying ? "Processing on blockchain…" : "Apply for Loan"}
          </button>
        </form>
      )}

      {/* Result */}
      {result && (
        <div className={`rounded-2xl border p-6 mb-8 ${result.loan.status === "approved" ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
          <h2 className="font-bold text-lg mb-3">
            {result.loan.status === "approved" ? "🎉 Loan Approved!" : "❌ Loan Rejected"}
          </h2>
          {result.loan.status === "approved" && (
            <div className="grid sm:grid-cols-3 gap-4 text-sm">
              <div><div className="text-gray-500">Approved Amount</div><div className="font-bold text-gray-900">${result.loan.approved_amount?.toLocaleString()}</div></div>
              <div><div className="text-gray-500">Interest Rate</div><div className="font-bold text-gray-900">{result.loan.interest_rate}%</div></div>
              <div><div className="text-gray-500">Duration</div><div className="font-bold text-gray-900">{result.loan.duration_days} days</div></div>
            </div>
          )}
          {result.loan.blockchain_tx && (
            <p className="text-xs text-gray-400 mt-3 font-mono">Tx: {result.loan.blockchain_tx}</p>
          )}
        </div>
      )}

      {/* Loan history */}
      {loans.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50">
            <h3 className="font-semibold text-gray-800">My Loans</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {loans.map((l) => (
              <div key={l.id} className="px-6 py-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-800 text-sm">${Number(l.amount).toLocaleString()} requested</p>
                  <p className="text-xs text-gray-400 mt-0.5">{l.duration_days} days · {l.tier} tier · {l.interest_rate}%</p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${statusColors[l.status] || "bg-gray-100 text-gray-600"}`}>
                  {l.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
