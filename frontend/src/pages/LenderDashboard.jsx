import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import api from "../utils/api";
import { formatINR } from "../utils/currency";
import {
  CheckCircle,
  XCircle,
  User,
  TrendingUp,
  Clock,
  ChevronDown,
  ChevronUp,
  Coins,
  RefreshCw,
  Search,
  ShieldCheck,
  Download,
} from "lucide-react";

const TIER_COLORS = {
  low: "bg-green-100 text-green-700",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-orange-100 text-orange-700",
  none: "bg-gray-100 text-gray-500",
};

const STATUS_COLORS = {
  pending: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  repaid: "bg-blue-100 text-blue-700",
  repayment_requested: "bg-purple-100 text-purple-700",
};

export default function LenderDashboard() {
  const [pendingLoans, setPendingLoans] = useState([]);
  const [allLoans, setAllLoans] = useState([]);
  const [tab, setTab] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [profile, setProfile] = useState({});
  const [deciding, setDeciding] = useState(null);
  const [form, setForm] = useState({});
  const [loanFilters, setLoanFilters] = useState({
    q: "",
    minScore: "",
    tier: "all",
    sortBy: "applied_at",
    sortOrder: "asc",
  });

  const load = async () => {
    setLoading(true);
    try {
      const [p, a] = await Promise.all([api.get("/loan/pending"), api.get("/loan/status")]);
      setPendingLoans(p.data);
      setAllLoans(a.data);
    } catch {
      toast.error("Failed to load loans");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const loadProfile = async (userId) => {
    if (profile[userId]) return;
    try {
      const { data } = await api.get(`/loan/borrower/${userId}`);
      setProfile((p) => ({ ...p, [userId]: data }));
    } catch {
      toast.error("Failed to load profile");
    }
  };

  const toggleExpand = (loanId, userId) => {
    if (expanded === loanId) {
      setExpanded(null);
      return;
    }
    setExpanded(loanId);
    loadProfile(userId);
    setForm((f) => ({
      ...f,
      [loanId]: { lender_note: "", approved_amount: "", interest_rate: "" },
    }));
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
        if (f.interest_rate) payload.interest_rate = Number(f.interest_rate);
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

  const downloadCsvBlob = (blobData, filename) => {
    const blob = new Blob([blobData], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const exportCsv = async () => {
    const filename = `loan-export-${tab}-${new Date().toISOString().slice(0, 10)}.csv`;
    try {
      const primary = await api.get("/loan/export", {
        params: { status: tab === "all" ? undefined : tab },
        responseType: "blob",
      });

      const primaryText = await primary.data.text();
      const lineCount = primaryText.split("\n").filter((l) => l.trim().length > 0).length;

      if (lineCount <= 1 && tab !== "all") {
        const fallback = await api.get("/loan/export", {
          responseType: "blob",
        });
        const fallbackText = await fallback.data.text();
        const fallbackLines = fallbackText.split("\n").filter((l) => l.trim().length > 0).length;

        if (fallbackLines <= 1) {
          toast.info("No loan rows available to export yet.");
          return;
        }

        downloadCsvBlob(fallback.data, filename.replace(`${tab}`, "all"));
        toast.info("No rows in selected tab, exported all loans instead.");
        return;
      }

      downloadCsvBlob(primary.data, filename);
      toast.success("CSV exported");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to export CSV");
    }
  };

  const stats = [
    { label: "Pending Review", value: pendingLoans.length, color: "amber" },
    {
      label: "Approved",
      value: allLoans.filter((l) => l.status === "approved").length,
      color: "green",
    },
    {
      label: "Repaid",
      value: allLoans.filter((l) => l.status === "repaid").length,
      color: "blue",
    },
    {
      label: "Rejected",
      value: allLoans.filter((l) => l.status === "rejected").length,
      color: "red",
    },
  ];

  const colorMap = {
    amber: "text-amber-600",
    green: "text-green-600",
    blue: "text-blue-600",
    red: "text-red-600",
  };

  const displayLoans = tab === "pending" ? pendingLoans : allLoans.filter((l) => tab === "all" || l.status === tab);

  const filteredLoans = displayLoans
    .filter((loan) => {
      const q = loanFilters.q.trim().toLowerCase();
      if (!q) return true;
      return [loan.full_name, loan.email, loan.purpose]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    })
    .filter((loan) => {
      if (!loanFilters.minScore) return true;
      return Number(loan.current_score ?? loan.score_at_apply ?? 0) >= Number(loanFilters.minScore);
    })
    .filter((loan) => {
      if (loanFilters.tier === "all") return true;
      return String(loan.tier || "").toLowerCase() === loanFilters.tier;
    })
    .sort((a, b) => {
      const direction = loanFilters.sortOrder === "desc" ? -1 : 1;
      if (loanFilters.sortBy === "amount") return (Number(a.amount) - Number(b.amount)) * direction;
      if (loanFilters.sortBy === "score") {
        return (
          Number(a.current_score ?? a.score_at_apply ?? 0) - Number(b.current_score ?? b.score_at_apply ?? 0)
        ) * direction;
      }
      if (loanFilters.sortBy === "name") {
        return String(a.full_name || "").localeCompare(String(b.full_name || "")) * direction;
      }
      return (new Date(a.applied_at).getTime() - new Date(b.applied_at).getTime()) * direction;
    });

  if (loading) return <div className="text-center py-20 text-gray-400">Loading...</div>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="rounded-3xl border border-slate-200 bg-white/90 backdrop-blur px-6 py-5 shadow-[0_12px_40px_rgba(2,6,23,0.08)] mb-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs tracking-[0.18em] uppercase text-slate-500 font-semibold">Lender Workspace</p>
            <h1 className="text-2xl font-bold text-slate-900">Loan Review Center</h1>
            <p className="text-sm text-slate-500 mt-1">Approve, reject, and monitor repayments from one workflow.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportCsv}
              className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-sky-700 border border-slate-200 px-3 py-2 rounded-lg"
            >
              <Download size={14} /> Export CSV
            </button>
            <button
              onClick={load}
              className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-sky-700 border border-slate-200 px-3 py-2 rounded-lg"
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {stats.map((s) => (
          <div key={s.label} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
            <div className={`text-2xl font-bold mb-1 ${colorMap[s.color]}`}>{s.value}</div>
            <div className="text-sm text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-5 flex-wrap">
        {["pending", "approved", "repayment_requested", "repaid", "rejected", "all"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium capitalize transition ${
              tab === t
                ? "bg-sky-700 text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:border-sky-300"
            }`}
          >
            {t.replace("_", " ")}
          </button>
        ))}
      </div>

      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-4 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck size={15} className="text-sky-600" />
          <p className="text-sm font-semibold text-slate-700">Loan Review Filters</p>
        </div>
        <div className="grid md:grid-cols-5 gap-2">
          <div className="md:col-span-2 relative">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              value={loanFilters.q}
              onChange={(e) => setLoanFilters((f) => ({ ...f, q: e.target.value }))}
              placeholder="Search by borrower, email, purpose"
              className="w-full text-sm border border-slate-200 rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>
          <input
            type="number"
            min="0"
            max="1000"
            value={loanFilters.minScore}
            onChange={(e) => setLoanFilters((f) => ({ ...f, minScore: e.target.value }))}
            placeholder="Min score"
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
          <select
            value={loanFilters.tier}
            onChange={(e) => setLoanFilters((f) => ({ ...f, tier: e.target.value }))}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            <option value="all">All tiers</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <select
            value={`${loanFilters.sortBy}:${loanFilters.sortOrder}`}
            onChange={(e) => {
              const [sortBy, sortOrder] = e.target.value.split(":");
              setLoanFilters((f) => ({ ...f, sortBy, sortOrder }));
            }}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            <option value="applied_at:asc">Oldest First</option>
            <option value="applied_at:desc">Newest First</option>
            <option value="score:desc">Highest Score</option>
            <option value="amount:desc">Highest Amount</option>
            <option value="name:asc">Name A-Z</option>
          </select>
        </div>
      </div>

      {filteredLoans.length === 0 ? (
        <div className="text-center py-16 text-slate-400 border border-dashed border-slate-300 rounded-2xl bg-white">
          <Coins size={36} className="mx-auto mb-3 text-slate-300" />
          No {tab} loans found.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLoans.map((loan) => {
            const p = profile[loan.user_id];
            const isOpen = expanded === loan.id;
            const f = form[loan.id] || {};

            return (
              <div key={loan.id} className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 flex flex-wrap items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900">{loan.full_name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${TIER_COLORS[loan.tier] || ""}`}>
                        {loan.tier} tier
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[loan.status] || ""}`}>
                        {loan.status.replace("_", " ")}
                      </span>
                    </div>
                    <div className="text-sm text-slate-500 mt-0.5 flex flex-wrap gap-3">
                      <span>{formatINR(loan.amount)} requested</span>
                      <span>{loan.duration_days} days</span>
                      <span className="font-medium text-sky-700">Score: {loan.current_score ?? loan.score_at_apply}</span>
                      {loan.purpose && <span className="italic">"{loan.purpose}"</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {loan.status === "repayment_requested" && (
                      <button
                        onClick={() => confirmRepayment(loan.id)}
                        className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700"
                      >
                        Confirm Repaid
                      </button>
                    )}
                    <button
                      onClick={() => toggleExpand(loan.id, loan.user_id)}
                      className="flex items-center gap-1 text-xs border border-slate-200 px-3 py-1.5 rounded-lg hover:border-sky-400 text-slate-600"
                    >
                      {loan.status === "pending" ? "Review" : isOpen ? "Hide" : "View Profile"}
                      {loan.status === "pending" && (isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />)}
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-slate-50 px-5 py-4 bg-slate-50">
                    {p ? (
                      <div className="grid md:grid-cols-3 gap-4 mb-4">
                        <div className="bg-white rounded-xl border border-slate-100 p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <User size={14} className="text-slate-400" />
                            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Borrower</span>
                          </div>
                          <p className="font-medium text-slate-800">{p.user.full_name}</p>
                          <p className="text-xs text-slate-400">{p.user.email}</p>
                          {p.user.phone && <p className="text-xs text-slate-400">{p.user.phone}</p>}
                          <p className="text-xs mt-1">
                            KYC:{" "}
                            <span
                              className={`font-medium ${
                                p.user.kyc_status === "approved" ? "text-green-600" : "text-amber-600"
                              }`}
                            >
                              {p.user.kyc_status}
                            </span>
                          </p>
                          {p.repaymentRate !== null && (
                            <p className="text-xs mt-1">
                              Repayment rate: <span className="font-semibold text-sky-700">{p.repaymentRate}%</span>
                            </p>
                          )}
                          {p.riskScore !== null && (
                            <p className="text-xs mt-1">
                              Risk score: <span className="font-semibold text-rose-600">{p.riskScore}</span>
                            </p>
                          )}
                        </div>

                        <div className="bg-white rounded-xl border border-slate-100 p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <TrendingUp size={14} className="text-slate-400" />
                            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Impact Score</span>
                          </div>
                          <p className="text-3xl font-bold text-sky-700">{p.score}</p>
                          <div className="mt-2 space-y-1">
                            {["health", "education", "sustainability"].map((cat) => {
                              const count = p.activities.filter(
                                (a) => a.category === cat && a.status === "verified"
                              ).length;
                              return (
                                <div key={cat} className="flex justify-between text-xs text-slate-500">
                                  <span className="capitalize">{cat}</span>
                                  <span>{count} verified</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div className="bg-white rounded-xl border border-slate-100 p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Clock size={14} className="text-slate-400" />
                            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Loan History</span>
                          </div>
                          {p.loans.length === 0 ? (
                            <p className="text-xs text-slate-400">First-time borrower</p>
                          ) : (
                            p.loans.slice(0, 4).map((l) => (
                              <div
                                key={l.id}
                                className="flex justify-between text-xs text-slate-600 py-1 border-b border-slate-50 last:border-0"
                              >
                                <span>{formatINR(l.amount)}</span>
                                <span className={`px-1.5 rounded capitalize ${STATUS_COLORS[l.status] || ""}`}>
                                  {l.status}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center text-slate-400 text-sm py-4">Loading borrower profile...</div>
                    )}

                    {loan.status === "pending" && (
                      <div className="bg-white rounded-xl border border-slate-100 p-4">
                        <p className="text-sm font-semibold text-slate-700 mb-3">Your Decision</p>
                        <div className="grid sm:grid-cols-3 gap-3 mb-3">
                          <div>
                            <label className="text-xs text-slate-500 block mb-1">
                              Approved Amount <span className="text-slate-300">(leave blank to match request)</span>
                            </label>
                            <input
                              type="number"
                              placeholder={`${loan.amount}`}
                              value={f.approved_amount || ""}
                              onChange={(e) =>
                                setForm((prev) => ({
                                  ...prev,
                                  [loan.id]: { ...f, approved_amount: e.target.value },
                                }))
                              }
                              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-sky-500"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-slate-500 block mb-1">
                              Interest Rate % <span className="text-slate-300">(suggested: {loan.interest_rate}%)</span>
                            </label>
                            <input
                              type="number"
                              placeholder={loan.interest_rate}
                              value={f.interest_rate || ""}
                              onChange={(e) =>
                                setForm((prev) => ({
                                  ...prev,
                                  [loan.id]: { ...f, interest_rate: e.target.value },
                                }))
                              }
                              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-sky-500"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-slate-500 block mb-1">Note to borrower</label>
                            <input
                              type="text"
                              placeholder="Optional note or rejection reason..."
                              value={f.lender_note || ""}
                              onChange={(e) =>
                                setForm((prev) => ({
                                  ...prev,
                                  [loan.id]: { ...f, lender_note: e.target.value },
                                }))
                              }
                              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-sky-500"
                            />
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => decide(loan.id, "approve")}
                            disabled={deciding === loan.id}
                            className="flex items-center gap-1.5 bg-green-600 text-white text-sm px-5 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
                          >
                            <CheckCircle size={15} /> {deciding === loan.id ? "Processing..." : "Approve Loan"}
                          </button>
                          <button
                            onClick={() => decide(loan.id, "reject")}
                            disabled={deciding === loan.id}
                            className="flex items-center gap-1.5 border border-red-200 text-red-600 text-sm px-5 py-2 rounded-lg hover:bg-red-50 disabled:opacity-50 transition"
                          >
                            <XCircle size={15} /> Reject
                          </button>
                        </div>
                      </div>
                    )}

                    {loan.status === "rejected" && loan.rejection_reason && (
                      <div className="bg-red-50 rounded-xl border border-red-100 p-3 text-sm text-red-700 mt-3">
                        <span className="font-medium">Rejection reason:</span> {loan.rejection_reason}
                      </div>
                    )}

                    {(loan.status === "approved" || loan.status === "rejected" || loan.status === "repaid") && (
                      <div className="bg-sky-50 rounded-xl border border-sky-100 p-3 text-sm text-sky-700 mt-3">
                        <span className="font-medium">Decision history:</span>{" "}
                        {loan.decided_at ? new Date(loan.decided_at).toLocaleString() : "Not available"}
                        {loan.lender_note ? ` - ${loan.lender_note}` : ""}
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
