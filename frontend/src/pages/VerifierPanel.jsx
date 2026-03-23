// src/pages/VerifierPanel.jsx
import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import api from "../utils/api";
import { CheckCircle, XCircle, ExternalLink, Clock, Search, AlertTriangle, History } from "lucide-react";

export default function VerifierPanel() {
  const [activities, setActivities] = useState([]);
  const [total,      setTotal]      = useState(0);
  const [limit,      setLimit]      = useState(10);
  const [offset,     setOffset]     = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [processing, setProcessing] = useState(null);
  const [note,       setNote]       = useState({});
  const [rejectId,   setRejectId]   = useState(null);
  const [filters,    setFilters]    = useState({
    q: "",
    category: "all",
    sortOrder: "asc",
  });
  const [auditLogs,  setAuditLogs]  = useState([]);
  const [auditLoading, setAuditLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [contextById, setContextById] = useState({});
  const [contextLoadingId, setContextLoadingId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const params = {
        q: filters.q || undefined,
        category: filters.category !== "all" ? filters.category : undefined,
        sortOrder: filters.sortOrder,
        limit,
        offset,
      };
      const { data } = await api.get("/verify/pending", { params });
      if (Array.isArray(data)) {
        setActivities(data);
        setTotal(data.length);
      } else {
        setActivities(data.items || []);
        setTotal(data.total || 0);
      }
    } catch { toast.error("Failed to load activities"); }
    finally  { setLoading(false); }
  };

  const loadAudit = async () => {
    setAuditLoading(true);
    try {
      const { data } = await api.get("/verify/audit", { params: { limit: 8, offset: 0 } });
      setAuditLogs(data || []);
    } catch {
      toast.error("Failed to load verification history");
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => { load(); }, [filters.q, filters.category, filters.sortOrder, limit, offset]);
  useEffect(() => { loadAudit(); }, []);

  const approve = async (id) => {
    setProcessing(id);
    try {
      const { data } = await api.post("/verify", { activity_id: id, action: "approve" });
      toast.success(`Approved! Tx: ${data.txHash ? data.txHash.slice(0, 10) + "…" : "recorded"}`);
      setActivities((prev) => prev.filter((a) => a.id !== id));
      setTotal((t) => Math.max(0, t - 1));
      loadAudit();
    } catch (err) {
      toast.error(err.response?.data?.error || "Approval failed");
    } finally { setProcessing(null); }
  };

  const reject = async (id) => {
    if (!note[id]?.trim()) return toast.error("Please enter a rejection reason");
    setProcessing(id);
    try {
      await api.post("/verify", { activity_id: id, action: "reject", rejection_note: note[id] });
      toast.success("Activity rejected");
      setActivities((prev) => prev.filter((a) => a.id !== id));
      setTotal((t) => Math.max(0, t - 1));
      setRejectId(null);
      setNote((prev) => ({ ...prev, [id]: "" }));
      loadAudit();
    } catch (err) {
      toast.error(err.response?.data?.error || "Rejection failed");
    } finally { setProcessing(null); }
  };

  const loadContext = async (activityId) => {
    if (contextById[activityId]) return;
    setContextLoadingId(activityId);
    try {
      const { data } = await api.get(`/verify/context/${activityId}`);
      setContextById((prev) => ({ ...prev, [activityId]: data }));
    } catch {
      toast.error("Failed to load review context");
    } finally {
      setContextLoadingId(null);
    }
  };

  const toggleReview = (activityId) => {
    if (expandedId === activityId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(activityId);
    loadContext(activityId);
  };

  const catColors = {
    health:         "bg-pink-50 text-pink-700",
    education:      "bg-blue-50 text-blue-700",
    sustainability: "bg-green-50 text-green-700",
  };

  if (loading) return <div className="text-center py-20 text-gray-400">Loading…</div>;

  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Clock size={22} className="text-amber-500" />
        <h1 className="text-2xl font-bold text-gray-900">Pending Verifications</h1>
        <span className="bg-amber-100 text-amber-700 text-xs font-medium px-2.5 py-1 rounded-full">
          {total}
        </span>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm mb-5">
        <div className="grid md:grid-cols-4 gap-2">
          <div className="md:col-span-2 relative">
            <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
            <input
              value={filters.q}
              onChange={(e) => { setOffset(0); setFilters((f) => ({ ...f, q: e.target.value })); }}
              placeholder="Search title, borrower, or email"
              className="w-full text-sm border border-gray-200 rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
          </div>
          <select
            value={filters.category}
            onChange={(e) => { setOffset(0); setFilters((f) => ({ ...f, category: e.target.value })); }}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          >
            <option value="all">All categories</option>
            <option value="health">Health</option>
            <option value="education">Education</option>
            <option value="sustainability">Sustainability</option>
          </select>
          <select
            value={`${filters.sortOrder}:${limit}`}
            onChange={(e) => {
              const [sortOrder, selectedLimit] = e.target.value.split(":");
              setOffset(0);
              setFilters((f) => ({ ...f, sortOrder }));
              setLimit(Number(selectedLimit));
            }}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          >
            <option value="asc:10">Oldest first · 10/page</option>
            <option value="desc:10">Newest first · 10/page</option>
            <option value="asc:20">Oldest first · 20/page</option>
            <option value="desc:20">Newest first · 20/page</option>
          </select>
        </div>
      </div>

      {activities.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <CheckCircle size={40} className="mx-auto mb-3 text-green-300" />
          All caught up! No pending activities.
        </div>
      ) : (
        <div className="space-y-4">
          {activities.map((a) => (
            <div key={a.id} className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-6 py-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${catColors[a.category] || "bg-gray-100 text-gray-600"}`}>
                        {a.category}
                      </span>
                      <span className="text-xs text-gray-400">#{a.id}</span>
                    </div>
                    <h3 className="font-semibold text-gray-900">{a.title}</h3>
                    {a.description && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{a.description}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-2">
                      By <span className="font-medium">{a.full_name}</span> ({a.email})
                      {a.wallet_address && (
                        <span className="ml-2 font-mono">{a.wallet_address.slice(0, 10)}…</span>
                      )}
                    </p>
                    {a.data_hash && (
                      <p className="text-xs text-gray-300 font-mono mt-1">Hash: {a.data_hash.slice(0, 20)}…</p>
                    )}

                    {a.fraud && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${a.fraud.riskLevel === "high" ? "bg-red-100 text-red-700" : a.fraud.riskLevel === "medium" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>
                          Risk {a.fraud.riskLevel} ({a.fraud.riskScore})
                        </span>
                        {a.fraud.flags.map((flag) => (
                          <span key={flag} className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                            {flag.replaceAll("_", " ")}
                          </span>
                        ))}
                        {a.fraud.reasons?.map((reason) => (
                          <span key={reason.key} className="text-[11px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-700">
                            {String(reason.key).replaceAll("_", " ")} (+{reason.weight})
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {rejectId !== a.id && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => toggleReview(a.id)}
                        className="flex items-center gap-1 text-xs border border-gray-200 px-3 py-2 rounded-lg hover:border-indigo-400 transition"
                      >
                        {expandedId === a.id ? "Hide Review" : "Review"}
                      </button>
                      {a.ipfs_hash && (
                        <a href={`https://gateway.pinata.cloud/ipfs/${a.ipfs_hash}`}
                          target="_blank" rel="noreferrer"
                          className="flex items-center gap-1 text-xs border border-gray-200 px-3 py-2 rounded-lg hover:border-indigo-400 transition">
                          <ExternalLink size={12} /> Document
                        </a>
                      )}
                      <button
                        onClick={() => setRejectId(a.id)}
                        className="flex items-center gap-1 text-xs border border-red-200 text-red-600 px-3 py-2 rounded-lg hover:bg-red-50 transition">
                        <XCircle size={14} /> Reject
                      </button>
                      <button
                        onClick={() => approve(a.id)}
                        disabled={processing === a.id}
                        className="flex items-center gap-1 text-xs bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 transition">
                        <CheckCircle size={14} /> {processing === a.id ? "…" : "Approve"}
                      </button>
                    </div>
                  )}
                </div>

                {/* Reject form */}
                {rejectId === a.id && (
                  <div className="mt-4 flex gap-2">
                    <input
                      placeholder="Rejection reason…"
                      value={note[a.id] || ""}
                      onChange={(e) => setNote((prev) => ({ ...prev, [a.id]: e.target.value }))}
                      className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-400"
                    />
                    <button
                      onClick={() => reject(a.id)}
                      disabled={processing === a.id}
                      className="text-xs bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50">
                      {processing === a.id ? "…" : "Confirm"}
                    </button>
                    <button onClick={() => { setRejectId(null); setNote((prev) => ({ ...prev, [a.id]: "" })); }}
                      className="text-xs border border-gray-200 px-3 py-2 rounded-lg">
                      Cancel
                    </button>
                  </div>
                )}

                {expandedId === a.id && (
                  <div className="mt-4 border border-gray-100 rounded-xl bg-gray-50 p-3">
                    {contextLoadingId === a.id ? (
                      <p className="text-xs text-gray-400">Loading review context...</p>
                    ) : !contextById[a.id] ? (
                      <p className="text-xs text-gray-400">Context unavailable.</p>
                    ) : (
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Embedded Evidence</p>
                          {a.ipfs_hash ? (
                            <>
                              <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                                <iframe
                                  title={`evidence-${a.id}`}
                                  src={`https://gateway.pinata.cloud/ipfs/${a.ipfs_hash}`}
                                  className="w-full h-72"
                                />
                              </div>
                              <a
                                href={`https://gateway.pinata.cloud/ipfs/${a.ipfs_hash}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-indigo-600 hover:text-indigo-700"
                              >
                                Open document in new tab
                              </a>
                            </>
                          ) : (
                            <p className="text-xs text-gray-500">No evidence file attached for this activity.</p>
                          )}
                        </div>

                        <div className="space-y-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Borrower Context Snapshot</p>
                          <div className="bg-white border border-gray-100 rounded-lg p-3">
                            <p className="text-sm font-medium text-gray-800">{contextById[a.id].borrower.full_name}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{contextById[a.id].borrower.email}</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">Score {contextById[a.id].score}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${contextById[a.id].borrower.kyc_status === "approved" ? "bg-green-100 text-green-700" : contextById[a.id].borrower.kyc_status === "rejected" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                                KYC {contextById[a.id].borrower.kyc_status}
                              </span>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                                Repayment {contextById[a.id].loan_summary.repayment_rate ?? "N/A"}%
                              </span>
                            </div>
                          </div>

                          <div className="bg-white border border-gray-100 rounded-lg p-3">
                            <p className="text-xs font-semibold text-gray-600 mb-2">Loan Summary</p>
                            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                              <p>Total: {contextById[a.id].loan_summary.total}</p>
                              <p>Approved: {contextById[a.id].loan_summary.approved}</p>
                              <p>Repaid: {contextById[a.id].loan_summary.repaid}</p>
                              <p>Pending: {contextById[a.id].loan_summary.pending}</p>
                            </div>
                          </div>

                          <div className="bg-white border border-gray-100 rounded-lg p-3">
                            <p className="text-xs font-semibold text-gray-600 mb-2">Recent Activities</p>
                            {contextById[a.id].recent_activities.slice(0, 5).map((item) => (
                              <div key={item.id} className="flex items-center justify-between text-xs py-1 border-b border-gray-50 last:border-0">
                                <span className="text-gray-700 truncate pr-2">{item.title}</span>
                                <span className={`px-1.5 py-0.5 rounded-full ${item.status === "verified" ? "bg-green-100 text-green-700" : item.status === "rejected" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                                  {item.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-gray-500">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setOffset((o) => Math.max(0, o - limit))}
                disabled={offset === 0}
                className="text-xs border border-gray-200 px-3 py-1.5 rounded-lg disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setOffset((o) => (o + limit >= total ? o : o + limit))}
                disabled={offset + limit >= total}
                className="text-xs border border-gray-200 px-3 py-1.5 rounded-lg disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <History size={15} className="text-indigo-500" />
          <h2 className="text-sm font-semibold text-gray-800">Recent Verification History</h2>
        </div>

        {auditLoading ? (
          <p className="text-sm text-gray-400">Loading history...</p>
        ) : auditLogs.length === 0 ? (
          <p className="text-sm text-gray-400">No verification history yet.</p>
        ) : (
          <div className="space-y-2">
            {auditLogs.map((log) => (
              <div key={log.id} className="border border-gray-100 rounded-lg p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-gray-800">{log.activity_title}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${log.action === "approve" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {log.action}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  By {log.verifier_name} at {new Date(log.created_at).toLocaleString()}
                </p>
                {log.rejection_note && (
                  <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                    <AlertTriangle size={12} /> {log.rejection_note}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
