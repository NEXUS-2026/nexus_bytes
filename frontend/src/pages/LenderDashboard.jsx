// src/pages/LenderDashboard.jsx
import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import api from "../utils/api";
import {
  CheckCircle, XCircle, User, TrendingUp,
  Clock, ChevronDown, ChevronUp, Coins, RefreshCw
} from "lucide-react";

const TIER_COLORS = {
  low:    "bg-green-100 text-green-700",
  medium: "bg-amber-100 text-amber-700",
  high:   "bg-orange-100 text-orange-700",
  none:   "bg-gray-100 text-gray-500",
};

const STATUS_COLORS = {
  pending:               "bg-yellow-100 text-yellow-700",
  approved:              "bg-green-100 text-green-700",
  rejected:              "bg-red-100 text-red-700",
  repaid:                "bg-blue-100 text-blue-700",
  repayment_requested:   "bg-purple-100 text-purple-700",
};

export default function LenderDashboard() {
  const [pendingLoans,  setPendingLoans]  = useState([]);
  const [allLoans,      setAllLoans]      = useState([]);
  const [tab,           setTab]           = useState("pending");
  const [loading,       setLoading]       = useState(true);
  const [expanded,      setExpanded]      = useState(null);
  const [profile,       setProfile]       = useState({});
  const [deciding,      setDeciding]      = useState(null);
  const [form,          setForm]          = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const [p, a] = await Promise.all([
        api.get("/loan/pending"),
        api.get("/loan/status"),
      ]);
      setPendingLoans(p.data);
      setAllLoans(a.data);
    } catch { toast.error("Failed to load loans"); }
    finally  { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const loadProfile = async (userId) => {
    if (profile[userId]) return;
    try {
      const { data } = await api.get(`/loan/borrower/${userId}`);
      setProfile((p) => ({ ...p, [userId]: data }));
    } catch { toast.error("Failed to load profile"); }
  };

  const toggleExpand = (loanId, userId) => {
    if (expanded === loanId) {
      setExpanded(null);
    } else {
      setExpanded(loanId);
      loadProfile(userId);
      setForm((f) => ({ ...f, [loanId]: { lender_note: "", approved_amount: "", interest_rate: "" } }));
    }
  };

  const decide = async (loanId, action) => {
    const f = form[loanId] || {};
    if (action === "reject" && !f.lender_note?.trim()) {
      return toast.error("Please enter a rejection reason");
    }
    setDeciding(loanId);
    try {
      const payload = { action, lender_note: f.lender_note };
      if (action === "approve") {
        if (f.approved_amount) payload.approved_amount = Number(f.approved_amount);
        if (f.interest_rate)   payload.interest_rate   = Number(f.interest_rate);
      }
      const { data } = await api.post(`/loan/${loanId}/decide`, payload);
      toast.success(data.message);
      setExpanded(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || "Action failed");
    } finally {
      setDeciding(null);
    }
  };

  const confirmRepayment = async (loanId) => {
    try {
      const { data } = await api.post(`/loan/${loanId}/repay`);
      toast.success(data.message);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed");
    }
  };

  const stats = [
    { label: "Pending Review",  value: pendingLoans.length,                                  color: "amber" },
    { label: "Approved",        value: allLoans.filter(l => l.status === "approved").length,  color: "green" },
    { label: "Repaid",          value: allLoans.filter(l => l.status === "repaid").length,    color: "blue"  },
    { label: "Rejected",        value: allLoans.filter(l => l.status === "rejected").length,  color: "red"   },
  ];

  const colorMap = { amber: "bg-amber-50 text-amber-600", green: "bg-green-50 text-green-600", blue: "bg-blue-50 text-blue-600", red: "bg-red-50 text-red-600" };

  const displayLoans = tab === "pending"
    ? pendingLoans
    : allLoans.filter(l => tab === "all" || l.status === tab);

  if (loading) return <div className="text-center py-20 text-gray-400">Loading…</div>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Lender Dashboard</h1>
        <button onClick={load} className="flex items-center gap-2 text-sm text-gray-500 hover:text-indigo-600 border border-gray-200 px-3 py-2 rounded-lg">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {stats.map((s) => (
          <div key={s.label} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
            <div className={`text-2xl font-bold mb-1 ${colorMap[s.color].split(" ")[1]}`}>{s.value}</div>
            <div className="text-sm text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {["pending", "approved", "repayment_requested", "repaid", "rejected", "all"].map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium capitalize transition
              ${tab === t ? "bg-indigo-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-indigo-300"}`}>
            {t.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* Loan list */}
      {displayLoans.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Coins size={36} className="mx-auto mb-3 text-gray-200" />
          No {tab} loans found.
        </div>
      ) : (
        <div className="space-y-3">
          {displayLoans.map((loan) => {
            const p = profile[loan.user_id];
            const isOpen = expanded === loan.id;
            const f = form[loan.id] || {};

            return (
              <div key={loan.id} className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                {/* Loan summary row */}
                <div className="px-5 py-4 flex flex-wrap items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{loan.full_name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${TIER_COLORS[loan.tier] || ""}`}>
                        {loan.tier} tier
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[loan.status] || ""}`}>
                        {loan.status.replace("_", " ")}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 mt-0.5 flex flex-wrap gap-3">
                      <span>${Number(loan.amount).toLocaleString()} requested</span>
                      <span>{loan.duration_days} days</span>
                      <span className="font-medium text-indigo-600">Score: {loan.current_score ?? loan.score_at_apply}</span>
                      {loan.purpose && <span className="italic">"{loan.purpose}"</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Repayment confirm */}
                    {loan.status === "repayment_requested" && (
                      <button onClick={() => confirmRepayment(loan.id)}
                        className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700">
                        Confirm Repaid
                      </button>
                    )}
                    {/* Expand for pending */}
                    {loan.status === "pending" && (
                      <button onClick={() => toggleExpand(loan.id, loan.user_id)}
                        className="flex items-center gap-1 text-xs border border-gray-200 px-3 py-1.5 rounded-lg hover:border-indigo-400 text-gray-600">
                        Review {isOpen ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
                      </button>
                    )}
                    {/* View profile for any loan */}
                    {loan.status !== "pending" && (
                      <button onClick={() => toggleExpand(loan.id, loan.user_id)}
                        className="text-xs border border-gray-200 px-3 py-1.5 rounded-lg hover:border-indigo-400 text-gray-600">
                        {isOpen ? "Hide" : "View Profile"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded review panel */}
                {isOpen && (
                  <div className="border-t border-gray-50 px-5 py-4 bg-gray-50">
                    {/* Borrower profile */}
                    {p ? (
                      <div className="grid md:grid-cols-3 gap-4 mb-4">
                        {/* Identity */}
                        <div className="bg-white rounded-xl border border-gray-100 p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <User size={14} className="text-gray-400"/>
                            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Borrower</span>
                          </div>
                          <p className="font-medium text-gray-800">{p.user.full_name}</p>
                          <p className="text-xs text-gray-400">{p.user.email}</p>
                          {p.user.phone && <p className="text-xs text-gray-400">{p.user.phone}</p>}
                          <p className="text-xs mt-1">
                            KYC: <span className={`font-medium ${p.user.kyc_status === "approved" ? "text-green-600" : "text-amber-600"}`}>
                              {p.user.kyc_status}
                            </span>
                          </p>
                          {p.repaymentRate !== null && (
                            <p className="text-xs mt-1">Repayment rate: <span className="font-semibold text-indigo-600">{p.repaymentRate}%</span></p>
                          )}
                        </div>

                        {/* Score breakdown */}
                        <div className="bg-white rounded-xl border border-gray-100 p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <TrendingUp size={14} className="text-gray-400"/>
                            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Impact Score</span>
                          </div>
                          <p className="text-3xl font-bold text-indigo-600">{p.score}</p>
                          <div className="mt-2 space-y-1">
                            {["health", "education", "sustainability"].map((cat) => {
                              const count = p.activities.filter(a => a.category === cat && a.status === "verified").length;
                              return (
                                <div key={cat} className="flex justify-between text-xs text-gray-500">
                                  <span className="capitalize">{cat}</span>
                                  <span>{count} verified</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Loan history */}
                        <div className="bg-white rounded-xl border border-gray-100 p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Clock size={14} className="text-gray-400"/>
                            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Loan History</span>
                          </div>
                          {p.loans.length === 0
                            ? <p className="text-xs text-gray-400">First-time borrower</p>
                            : p.loans.slice(0, 4).map((l) => (
                              <div key={l.id} className="flex justify-between text-xs text-gray-600 py-1 border-b border-gray-50 last:border-0">
                                <span>${Number(l.amount).toLocaleString()}</span>
                                <span className={`px-1.5 rounded capitalize ${STATUS_COLORS[l.status] || ""}`}>{l.status}</span>
                              </div>
                            ))
                          }
                        </div>
                      </div>
                    ) : (
                      <div className="text-center text-gray-400 text-sm py-4">Loading borrower profile…</div>
                    )}

                    {/* Decision form (only for pending) */}
                    {loan.status === "pending" && (
                      <div className="bg-white rounded-xl border border-gray-100 p-4">
                        <p className="text-sm font-semibold text-gray-700 mb-3">Your Decision</p>
                        <div className="grid sm:grid-cols-3 gap-3 mb-3">
                          <div>
                            <label className="text-xs text-gray-500 block mb-1">
                              Approved Amount <span className="text-gray-300">(leave blank to match request)</span>
                            </label>
                            <input type="number" placeholder={`$${loan.amount}`}
                              value={f.approved_amount || ""}
                              onChange={(e) => setForm((prev) => ({ ...prev, [loan.id]: { ...f, approved_amount: e.target.value } }))}
                              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 block mb-1">
                              Interest Rate % <span className="text-gray-300">(suggested: {loan.interest_rate}%)</span>
                            </label>
                            <input type="number" placeholder={loan.interest_rate}
                              value={f.interest_rate || ""}
                              onChange={(e) => setForm((prev) => ({ ...prev, [loan.id]: { ...f, interest_rate: e.target.value } }))}
                              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 block mb-1">Note to borrower</label>
                            <input type="text" placeholder="Optional note or rejection reason…"
                              value={f.lender_note || ""}
                              onChange={(e) => setForm((prev) => ({ ...prev, [loan.id]: { ...f, lender_note: e.target.value } }))}
                              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                            />
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button onClick={() => decide(loan.id, "approve")}
                            disabled={deciding === loan.id}
                            className="flex items-center gap-1.5 bg-green-600 text-white text-sm px-5 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 transition">
                            <CheckCircle size={15}/> {deciding === loan.id ? "Processing…" : "Approve Loan"}
                          </button>
                          <button onClick={() => decide(loan.id, "reject")}
                            disabled={deciding === loan.id}
                            className="flex items-center gap-1.5 border border-red-200 text-red-600 text-sm px-5 py-2 rounded-lg hover:bg-red-50 disabled:opacity-50 transition">
                            <XCircle size={15}/> Reject
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Rejection reason display */}
                    {loan.status === "rejected" && loan.rejection_reason && (
                      <div className="bg-red-50 rounded-xl border border-red-100 p-3 text-sm text-red-700">
                        <span className="font-medium">Rejection reason:</span> {loan.rejection_reason}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
