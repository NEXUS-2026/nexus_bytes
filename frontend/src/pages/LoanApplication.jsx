// src/pages/LoanApplication.jsx
import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import api from "../utils/api";
import {
  Coins,
  AlertCircle,
  CheckCircle,
  Clock,
  Calculator,
  XCircle,
} from "lucide-react";
import { formatINR, formatINRWithPaise } from "../utils/currency";

const STATUS_COLORS = {
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  pending: "bg-yellow-100 text-yellow-700",
  repaid: "bg-blue-100 text-blue-700",
  repayment_requested: "bg-purple-100 text-purple-700",
};

const STATUS_ICONS = {
  approved: <CheckCircle size={14} />,
  rejected: <XCircle size={14} />,
  pending: <Clock size={14} />,
  repaid: <CheckCircle size={14} />,
  repayment_requested: <Clock size={14} />,
};

export default function LoanApplication() {
  const [scoreData, setScoreData] = useState(null);
  const [loans, setLoans] = useState([]);
  const [form, setForm] = useState({
    amount: "",
    duration_days: 30,
    purpose: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [repaying, setRepaying] = useState(null);

  const load = async () => {
    try {
      const [s, l] = await Promise.all([
        api.get("/score"),
        api.get("/loan/status"),
      ]);
      setScoreData(s.data);
      setLoans(l.data);
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleApply = async (e) => {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0)
      return toast.error("Enter a valid amount");
    setApplying(true);
    try {
      const { data } = await api.post("/loan/apply", {
        amount: Number(form.amount),
        duration_days: Number(form.duration_days),
        purpose: form.purpose,
      });
      toast.success(data.message);
      setSubmitted(true);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || "Application failed");
    } finally {
      setApplying(false);
    }
  };

  const requestRepayment = async (loanId) => {
    setRepaying(loanId);
    try {
      const { data } = await api.post(`/loan/${loanId}/repay`);
      toast.success(data.message);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed");
    } finally {
      setRepaying(null);
    }
  };

  // EMI calculation: P * r * (1+r)^n / ((1+r)^n - 1)
  const calcEMI = (amount, rate, days) => {
    if (!amount || !rate) return 0;
    const months = Math.ceil(days / 30);
    const r = rate / 100 / 12;
    if (r === 0) return amount / months;
    return (
      (amount * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1)
    );
  };

  if (loading)
    return <div className="text-center py-20 text-gray-400">Loading…</div>;

  const score = scoreData?.score ?? 0;
  const eligible = scoreData?.loanEligible;
  const maxAmt = scoreData?.maxLoanAmount ?? 0;
  const rate = scoreData?.interestRate ?? 0;
  const tier = scoreData?.tier ?? "none";

  const activeLoan = loans.find((l) =>
    ["pending", "approved", "repayment_requested"].includes(l.status),
  );
  const emi =
    form.amount && rate
      ? calcEMI(Number(form.amount), rate, Number(form.duration_days))
      : 0;
  const totalPayback = form.amount ? Number(form.amount) * (1 + rate / 100) : 0;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">
        Loan Application
      </h1>

      {/* Score summary */}
      <div
        className={`rounded-2xl border p-5 mb-6 flex items-center gap-4
        ${eligible ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}
      >
        {eligible ? (
          <CheckCircle size={32} className="text-green-500 shrink-0" />
        ) : (
          <AlertCircle size={32} className="text-red-400 shrink-0" />
        )}
        <div className="flex-1">
          <div className="font-semibold text-gray-900">
            Impact Score: <span className="text-2xl font-bold">{score}</span>
            <span
              className={`ml-2 text-xs px-2 py-0.5 rounded-full capitalize
              ${
                tier === "low"
                  ? "bg-green-200 text-green-800"
                  : tier === "medium"
                    ? "bg-amber-100 text-amber-700"
                    : tier === "high"
                      ? "bg-red-100 text-red-700"
                      : "bg-gray-100 text-gray-500"
              }`}
            >
              {tier} tier
            </span>
          </div>
          {eligible ? (
            <p className="text-sm text-gray-600 mt-1">
              You qualify for up to <strong>{formatINR(maxAmt)}</strong> at{" "}
              <strong>{rate}% interest</strong>. Loans are reviewed and approved
              by a lender.
            </p>
          ) : (
            <p className="text-sm text-gray-500 mt-1">
              Score below 20. Submit and verify more activities to qualify.
            </p>
          )}
        </div>
      </div>

      {/* Active loan banner */}
      {activeLoan && (
        <div
          className={`rounded-2xl border p-5 mb-6
          ${activeLoan.status === "approved" ? "bg-blue-50 border-blue-200" : "bg-yellow-50 border-yellow-200"}`}
        >
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="font-semibold text-gray-800">
                Active Loan #{activeLoan.id} —
                <span
                  className={`ml-2 text-xs px-2 py-0.5 rounded-full font-medium capitalize
                  ${STATUS_COLORS[activeLoan.status]}`}
                >
                  {activeLoan.status.replace("_", " ")}
                </span>
              </p>
              <p className="text-sm text-gray-500 mt-0.5">
                {formatINR(activeLoan.amount)} requested
                {activeLoan.approved_amount &&
                  ` · ${formatINR(activeLoan.approved_amount)} approved`}
                {activeLoan.interest_rate &&
                  ` · ${activeLoan.interest_rate}% interest`}
              </p>
              {activeLoan.lender_note && (
                <p className="text-xs text-indigo-600 mt-1">
                  Lender note: "{activeLoan.lender_note}"
                </p>
              )}
              {activeLoan.status === "pending" && (
                <p className="text-xs text-gray-400 mt-1">
                  ⏳ Awaiting lender review…
                </p>
              )}
            </div>
            {activeLoan.status === "approved" && (
              <button
                onClick={() => requestRepayment(activeLoan.id)}
                disabled={repaying === activeLoan.id}
                className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {repaying === activeLoan.id ? "…" : "Request Repayment"}
              </button>
            )}
            {activeLoan.status === "repayment_requested" && (
              <p className="text-xs text-purple-600 font-medium">
                Repayment confirmation pending from lender
              </p>
            )}
          </div>
        </div>
      )}

      {/* Application form */}
      {eligible && !activeLoan && !submitted && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 mb-6">
          <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Coins size={18} className="text-indigo-500" /> Apply for a Loan
          </h2>

          <form onSubmit={handleApply} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Loan Amount (INR){" "}
                  <span className="text-gray-400 text-xs">
                    max {formatINR(maxAmt)}
                  </span>
                </label>
                <input
                  type="number"
                  min="1"
                  max={maxAmt}
                  step="1"
                  value={form.amount}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, amount: e.target.value }))
                  }
                  placeholder={`Up to ${formatINR(maxAmt)}`}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Repayment Period
                </label>
                <select
                  value={form.duration_days}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, duration_days: e.target.value }))
                  }
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  {[7, 14, 30, 60, 90, 180, 365].map((d) => (
                    <option key={d} value={d}>
                      {d} days ({Math.ceil(d / 30)} month{d > 30 ? "s" : ""})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Purpose{" "}
                <span className="text-gray-400 text-xs">
                  (optional — helps lender approve faster)
                </span>
              </label>
              <input
                type="text"
                value={form.purpose}
                onChange={(e) =>
                  setForm((f) => ({ ...f, purpose: e.target.value }))
                }
                placeholder="e.g. Stock for my vegetable stall, School fees, Medical expenses…"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>

            {/* EMI Calculator */}
            {form.amount > 0 && (
              <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                <div className="flex items-center gap-2 mb-3 text-sm font-medium text-indigo-700">
                  <Calculator size={15} /> EMI Preview
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-sm">
                  <div className="bg-white rounded-lg p-3">
                    <div className="font-bold text-gray-900">
                      {formatINR(form.amount)}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      Principal
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-3">
                    <div className="font-bold text-gray-900">{rate}%</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      Annual Rate
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-3">
                    <div className="font-bold text-indigo-600">
                      {formatINRWithPaise(emi)}/mo
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      Monthly EMI
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-3">
                    <div className="font-bold text-gray-900">
                      {formatINRWithPaise(totalPayback)}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      Total Payback
                    </div>
                  </div>
                </div>
                <p className="text-xs text-indigo-500 mt-2">
                  * Final terms may be adjusted by the lender at time of
                  approval.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={applying}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
            >
              <Coins size={18} />
              {applying ? "Submitting application…" : "Submit Loan Application"}
            </button>
          </form>
        </div>
      )}

      {/* Submitted confirmation */}
      {submitted && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-6 mb-6 text-center">
          <CheckCircle size={40} className="mx-auto mb-3 text-green-500" />
          <h2 className="font-bold text-lg text-gray-900 mb-1">
            Application Submitted!
          </h2>
          <p className="text-sm text-gray-500">
            A lender will review your application and respond shortly. Check the
            status below.
          </p>
        </div>
      )}

      {/* Loan history */}
      {loans.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50">
            <h3 className="font-semibold text-gray-800">My Loan History</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {loans.map((l) => (
              <div key={l.id} className="px-6 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-800 text-sm">
                        {formatINR(l.amount)} requested
                      </span>
                      {l.approved_amount && l.approved_amount !== l.amount && (
                        <span className="text-xs text-green-600">
                          → {formatINR(l.approved_amount)} approved
                        </span>
                      )}
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize flex items-center gap-1 ${STATUS_COLORS[l.status] || ""}`}
                      >
                        {STATUS_ICONS[l.status]} {l.status.replace("_", " ")}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mt-1 flex flex-wrap gap-3">
                      <span>{l.duration_days} days</span>
                      <span>{l.interest_rate}% interest</span>
                      <span className="capitalize">{l.tier} tier</span>
                      {l.purpose && <span>"{l.purpose}"</span>}
                    </div>
                    {l.rejection_reason && (
                      <p className="text-xs text-red-500 mt-1">
                        Reason: {l.rejection_reason}
                      </p>
                    )}
                    {l.lender_note && l.status === "approved" && (
                      <p className="text-xs text-indigo-600 mt-1">
                        Lender note: "{l.lender_note}"
                      </p>
                    )}
                  </div>
                  {l.status === "approved" && (
                    <button
                      onClick={() => requestRepayment(l.id)}
                      disabled={repaying === l.id}
                      className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 shrink-0"
                    >
                      {repaying === l.id ? "…" : "Repay"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
