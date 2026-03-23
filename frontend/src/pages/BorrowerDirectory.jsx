import React, { useEffect, useState } from "react";
import { Search, RefreshCw, UserRound, ShieldCheck } from "lucide-react";
import { toast } from "react-toastify";
import api from "../utils/api";

const STATUS_COLORS = {
  verified: "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700",
  rejected: "bg-red-100 text-red-700",
};

export default function BorrowerDirectory() {
  const [borrowers, setBorrowers] = useState([]);
  const [meta, setMeta] = useState({ total: 0 });
  const [loading, setLoading] = useState(true);
  const [expandedBorrower, setExpandedBorrower] = useState(null);
  const [profile, setProfile] = useState({});
  const [filters, setFilters] = useState({
    q: "",
    minScore: "",
    kyc: "all",
    sortBy: "last_applied_at",
    sortOrder: "desc",
  });

  const loadBorrowers = async () => {
    setLoading(true);
    try {
      const params = {
        q: filters.q || undefined,
        minScore: filters.minScore || undefined,
        kyc: filters.kyc !== "all" ? filters.kyc : undefined,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
        limit: 40,
        offset: 0,
      };
      const { data } = await api.get("/loan/borrowers", { params });
      setBorrowers(data.items || []);
      setMeta({ total: data.total || 0 });
    } catch {
      toast.error("Failed to load borrower directory");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBorrowers();
  }, [filters.q, filters.minScore, filters.kyc, filters.sortBy, filters.sortOrder]);

  const loadProfile = async (userId) => {
    if (profile[userId]) return;
    try {
      const { data } = await api.get(`/loan/borrower/${userId}`);
      setProfile((prev) => ({ ...prev, [userId]: data }));
    } catch {
      toast.error("Failed to load borrower details");
    }
  };

  const toggleBorrowerExpand = (userId) => {
    if (expandedBorrower === userId) {
      setExpandedBorrower(null);
      return;
    }
    setExpandedBorrower(userId);
    loadProfile(userId);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="rounded-3xl border border-slate-200 bg-white/90 backdrop-blur px-6 py-5 shadow-[0_12px_40px_rgba(2,6,23,0.08)] mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs tracking-[0.18em] uppercase text-slate-500 font-semibold">Lender Workspace</p>
            <h1 className="text-2xl font-bold text-slate-900">Borrower Directory</h1>
            <p className="text-sm text-slate-500 mt-1">Review borrower risk, repayment behavior, and verified evidence before loan decisions.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 font-medium">
              {meta.total} borrowers
            </span>
            <button
              onClick={loadBorrowers}
              className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-sky-700 border border-slate-200 px-3 py-2 rounded-lg"
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 mb-5">
        <div className="grid md:grid-cols-5 gap-2">
          <div className="md:col-span-2 relative">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
              placeholder="Search borrower name or email"
              className="w-full text-sm border border-slate-200 rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>
          <input
            type="number"
            min="0"
            max="1000"
            value={filters.minScore}
            onChange={(e) => setFilters((f) => ({ ...f, minScore: e.target.value }))}
            placeholder="Min score"
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
          <select
            value={filters.kyc}
            onChange={(e) => setFilters((f) => ({ ...f, kyc: e.target.value }))}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            <option value="all">All KYC</option>
            <option value="approved">KYC Approved</option>
            <option value="pending">KYC Pending</option>
            <option value="rejected">KYC Rejected</option>
          </select>
          <select
            value={`${filters.sortBy}:${filters.sortOrder}`}
            onChange={(e) => {
              const [sortBy, sortOrder] = e.target.value.split(":");
              setFilters((f) => ({ ...f, sortBy, sortOrder }));
            }}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            <option value="last_applied_at:desc">Latest Application</option>
            <option value="score:desc">Highest Score</option>
            <option value="repaid:desc">Most Repaid Loans</option>
            <option value="pending:desc">Most Pending Loans</option>
            <option value="name:asc">Name A-Z</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-400">Loading borrower directory...</div>
      ) : borrowers.length === 0 ? (
        <div className="text-center py-16 text-slate-400 border border-dashed border-slate-300 rounded-2xl bg-white">No borrowers match these filters.</div>
      ) : (
        <div className="space-y-3">
          {borrowers.map((b) => {
            const open = expandedBorrower === b.id;
            const p = profile[b.id];
            return (
              <div key={b.id} className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                <div className="px-4 py-3 flex flex-wrap items-center gap-3 bg-slate-50">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900">{b.full_name}</p>
                    <p className="text-xs text-slate-500">{b.email}</p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 font-medium">
                    Score {b.current_score}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${b.risk_level === "low" ? "bg-green-50 text-green-700" : b.risk_level === "high" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
                    Risk {b.risk_level} ({b.risk_score ?? 0})
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">
                    {b.loan_count} loans
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${b.kyc_status === "approved" ? "bg-green-50 text-green-700" : b.kyc_status === "rejected" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
                    KYC {b.kyc_status}
                  </span>
                  <button
                    onClick={() => toggleBorrowerExpand(b.id)}
                    className="text-xs border border-slate-200 px-3 py-1.5 rounded-lg hover:border-sky-400 text-slate-600"
                  >
                    {open ? "Hide Details" : "View Details"}
                  </button>
                </div>

                {open && (
                  <div className="px-4 py-4 bg-white border-t border-slate-100">
                    {!p ? (
                      <div className="text-sm text-slate-400">Loading borrower details...</div>
                    ) : (
                      <div className="space-y-4">
                        <div className="grid md:grid-cols-5 gap-3">
                          <Info label="Repayment Rate" value={p.repaymentRate === null ? "N/A" : `${p.repaymentRate}%`} />
                          <Info label="Risk Score" value={p.riskScore === null ? "N/A" : p.riskScore} />
                          <Info label="Risk Level" value={p.riskLevel || "N/A"} />
                          <Info label="Verified Activities" value={p.activities.filter((a) => a.status === "verified").length} />
                          <Info label="Pending Activities" value={p.activities.filter((a) => a.status === "pending").length} />
                        </div>

                        {Array.isArray(p.riskFactors) && p.riskFactors.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2 inline-flex items-center gap-1">
                              <ShieldCheck size={12} /> Risk Factors
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {p.riskFactors.map((factor) => (
                                <span key={factor} className="text-[11px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-700">
                                  {String(factor).replaceAll("_", " ")}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        <div>
                          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2 inline-flex items-center gap-1">
                            <UserRound size={12} /> Activity Details
                          </p>
                          {p.activities.length === 0 ? (
                            <p className="text-xs text-slate-400">No activities yet.</p>
                          ) : (
                            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                              {p.activities.slice(0, 8).map((a) => (
                                <div key={a.id} className="border border-slate-100 rounded-lg p-3">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-sm font-medium text-slate-800">{a.title}</p>
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[a.status] || "bg-slate-100 text-slate-600"}`}>
                                      {a.status}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-500 capitalize mt-1">{a.category}</p>
                                  {a.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{a.description}</p>}
                                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                                    {a.ipfs_hash && (
                                      <a
                                        href={`https://gateway.pinata.cloud/ipfs/${a.ipfs_hash}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-sky-700 hover:text-sky-800"
                                      >
                                        View Evidence
                                      </a>
                                    )}
                                    {a.verified_by_name && <span>Verified by {a.verified_by_name}</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
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

function Info({ label, value }) {
  return (
    <div className="border border-slate-100 rounded-lg px-3 py-2 bg-slate-50">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm font-semibold text-slate-900 mt-0.5">{value}</p>
    </div>
  );
}
