import React, { useEffect, useMemo, useState } from "react";
import { Activity, Coins, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { toast } from "react-toastify";
import api from "../utils/api";
import { formatINR } from "../utils/currency";

const STATUS_COLORS = {
  verified: "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700",
  rejected: "bg-red-100 text-red-700",
  approved: "bg-green-100 text-green-700",
  repaid: "bg-blue-100 text-blue-700",
  repayment_requested: "bg-purple-100 text-purple-700",
};

const CAT_COLORS = {
  health: "bg-pink-50 text-pink-700",
  education: "bg-blue-50 text-blue-700",
  sustainability: "bg-green-50 text-green-700",
};

const ACCESS_COLORS = {
  approved: "bg-green-100 text-green-700",
  pending: "bg-amber-100 text-amber-700",
  rejected: "bg-red-100 text-red-700",
};

export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loans, setLoans] = useState([]);
  const [kyc, setKyc] = useState([]);
  const [stats, setStats] = useState(null);
  const [verifiers, setVerifiers] = useState([]);
  const [lenders, setLenders] = useState([]);
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(true);

  const [userQuery, setUserQuery] = useState("");
  const [kycFilter, setKycFilter] = useState("pending");
  const [reviewNote, setReviewNote] = useState({});
  const [accessNote, setAccessNote] = useState({});

  const loadAll = async () => {
    setLoading(true);
    try {
      const [u, a, l, k, s, v, ld] = await Promise.allSettled([
        api.get("/admin/users"),
        api.get("/activity"),
        api.get("/loan/status"),
        api.get("/admin/kyc/submissions", { params: { status: kycFilter } }),
        api.get("/admin/stats"),
        api.get("/admin/verifiers"),
        api.get("/admin/lenders"),
      ]);
      setUsers(u.status === "fulfilled" ? (u.value.data || []) : []);
      setActivities(a.status === "fulfilled" ? (a.value.data || []) : []);
      setLoans(l.status === "fulfilled" ? (l.value.data || []) : []);
      setKyc(k.status === "fulfilled" ? (k.value.data || []) : []);
      setStats(s.status === "fulfilled" ? (s.value.data || null) : null);
      setVerifiers(v.status === "fulfilled" ? (v.value.data || []) : []);
      setLenders(ld.status === "fulfilled" ? (ld.value.data || []) : []);

      const failedCount = [u, a, l, k, s, v, ld].filter((r) => r.status === "rejected").length;
      if (failedCount > 0) toast.warning(`Loaded admin panel with ${failedCount} partial fetch issue(s).`);
    } catch {
      toast.error("Failed to load admin data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const loadKyc = async (status = kycFilter) => {
    try {
      const res = await api.get("/admin/kyc/submissions", { params: { status } });
      setKyc(res.data || []);
    } catch {
      toast.error("Failed to load KYC queue");
    }
  };

  const updateRole = async (userId, role) => {
    try {
      await api.patch(`/admin/users/${userId}/role`, { role });
      toast.success("Role updated");
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to update role");
    }
  };

  const reviewAccess = async (userId, status) => {
    try {
      await api.patch(`/admin/users/${userId}/access`, {
        status,
        review_note: accessNote[userId] || "",
      });
      toast.success(`Access ${status}`);
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to update access");
    }
  };

  const reviewKyc = async (submissionId, status) => {
    try {
      await api.patch(`/admin/kyc/${submissionId}`, {
        status,
        review_note: reviewNote[submissionId] || "",
      });
      toast.success(`KYC ${status}`);
      loadKyc();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to update KYC");
    }
  };

  const recalculateScores = async () => {
    try {
      const { data } = await api.post("/admin/score/recalculate-all");
      toast.success(`Recalculated ${data.recalculated} borrower scores`);
      loadAll();
    } catch {
      toast.error("Failed to recalculate scores");
    }
  };

  const moderateActivity = async (activityId, action) => {
    try {
      let rejection_note = "";
      if (action === "reject") rejection_note = window.prompt("Enter rejection reason") || "Not approved by admin";
      await api.post("/verify", {
        activity_id: activityId,
        action,
        rejection_note,
        decision_note: `Admin ${action}`,
      });
      toast.success(`Activity ${action}d`);
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.error || `Failed to ${action} activity`);
    }
  };

  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => [u.full_name, u.email, u.role].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)));
  }, [users, userQuery]);

  const cards = [
    { label: "Total Users", value: stats?.totalUsers ?? users.length, icon: <Users size={18} />, color: "bg-sky-50 text-sky-700" },
    { label: "Verified Activities", value: stats?.activities?.verified ?? activities.filter((a) => a.status === "verified").length, icon: <Activity size={18} />, color: "bg-green-50 text-green-700" },
    { label: "Active Loans", value: stats?.loans?.reduce((sum, r) => sum + (r.count || 0), 0) ?? loans.length, icon: <Coins size={18} />, color: "bg-amber-50 text-amber-700" },
  ];

  if (loading) return <div className="text-center py-20 text-slate-400">Loading...</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="rounded-3xl border border-slate-200 bg-white/90 backdrop-blur px-6 py-5 shadow-[0_12px_40px_rgba(2,6,23,0.08)] mb-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs tracking-[0.18em] uppercase text-slate-500 font-semibold">Admin Console</p>
            <h1 className="text-2xl font-bold text-slate-900">Platform Operations</h1>
            <p className="text-sm text-slate-500 mt-1">Approve lender/verifier access, monitor risk patterns, and control verification quality.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={recalculateScores} className="inline-flex items-center gap-2 text-sm text-indigo-700 bg-indigo-50 border border-indigo-100 px-3 py-2 rounded-lg hover:bg-indigo-100">
              <ShieldCheck size={14} /> Recalculate Scores
            </button>
            <button onClick={loadAll} className="inline-flex items-center gap-2 text-sm text-slate-600 border border-slate-200 px-3 py-2 rounded-lg hover:text-sky-700">
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {cards.map((s) => (
          <div key={s.label} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${s.color}`}>{s.icon}</div>
            <div className="text-2xl font-bold text-slate-900">{s.value}</div>
            <div className="text-sm text-slate-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-5 flex-wrap">
        {["overview", "users", "verifiers", "lenders", "kyc", "activities", "loans"].map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`text-sm px-4 py-2 rounded-lg font-medium capitalize transition ${tab === t ? "bg-sky-700 text-white" : "bg-white border border-slate-200 text-slate-600 hover:border-sky-300"}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5">
            <p className="text-sm font-semibold text-slate-800 mb-3">Activity Status Mix</p>
            <div className="space-y-2">
              {Object.entries(stats?.activities || {}).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between text-sm">
                  <span className={`px-2 py-0.5 rounded-full ${STATUS_COLORS[status] || "bg-slate-100 text-slate-700"}`}>{status}</span>
                  <span className="font-semibold text-slate-800">{count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5">
            <p className="text-sm font-semibold text-slate-800 mb-3">Loan Book Snapshot</p>
            <div className="space-y-2">
              {(stats?.loans || []).map((row) => (
                <div key={row.status} className="flex items-center justify-between text-sm">
                  <span className={`px-2 py-0.5 rounded-full ${STATUS_COLORS[row.status] || "bg-slate-100 text-slate-700"}`}>{row.status}</span>
                  <span className="font-semibold text-slate-800">{row.count} ({formatINR(row.total || 0)})</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "users" && (
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <input value={userQuery} onChange={(e) => setUserQuery(e.target.value)} placeholder="Search by name, email, role" className="w-full max-w-sm text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-sky-500" />
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs font-medium">
              <tr>
                {["Name", "Email", "Role", "Score", "Access", "Change Role", "Access Review"].map((h) => <th key={h} className="px-5 py-3 text-left">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 text-slate-700 font-medium">{u.full_name}</td>
                  <td className="px-5 py-3 text-slate-700">{u.email}</td>
                  <td className="px-5 py-3 capitalize">{u.role}</td>
                  <td className="px-5 py-3">{u.score}</td>
                  <td className="px-5 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${ACCESS_COLORS[u.access_status] || "bg-slate-100 text-slate-700"}`}>{u.access_status}</span></td>
                  <td className="px-5 py-3">
                    <select value={u.role} onChange={(e) => updateRole(u.id, e.target.value)} className="text-xs border border-slate-200 rounded px-2 py-1">
                      <option value="borrower">borrower</option>
                      <option value="verifier">verifier</option>
                      <option value="lender">lender</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td className="px-5 py-3">
                    {["verifier", "lender"].includes(u.role) ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <input value={accessNote[u.id] || ""} onChange={(e) => setAccessNote((p) => ({ ...p, [u.id]: e.target.value }))} placeholder="Review note" className="text-xs border border-slate-200 rounded px-2 py-1 w-28" />
                        <button onClick={() => reviewAccess(u.id, "approved")} className="text-xs px-2 py-1 rounded bg-green-100 text-green-700">Approve</button>
                        <button onClick={() => reviewAccess(u.id, "rejected")} className="text-xs px-2 py-1 rounded bg-red-100 text-red-700">Reject</button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">N/A</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "verifiers" && (
        <RoleAuditTable title="Verifier Audit" rows={verifiers} type="verifier" />
      )}

      {tab === "lenders" && (
        <RoleAuditTable title="Lender Audit" rows={lenders} type="lender" />
      )}

      {tab === "kyc" && (
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">KYC Review Queue</p>
            <select value={kycFilter} onChange={(e) => { setKycFilter(e.target.value); loadKyc(e.target.value); }} className="text-xs border border-slate-200 rounded-lg px-2 py-1">
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs font-medium">
              <tr>
                {["Borrower", "Doc Type", "Doc #", "Status", "Submitted", "Review Note", "Actions"].map((h) => <th key={h} className="px-5 py-3 text-left">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {kyc.map((k) => (
                <tr key={k.id} className="hover:bg-slate-50 align-top">
                  <td className="px-5 py-3"><p className="text-slate-700 font-medium">{k.full_name}</p><p className="text-xs text-slate-400">{k.email}</p></td>
                  <td className="px-5 py-3 uppercase">{k.document_type}</td>
                  <td className="px-5 py-3">{k.document_number}</td>
                  <td className="px-5 py-3 capitalize">{k.status}</td>
                  <td className="px-5 py-3 text-slate-500">{new Date(k.created_at).toLocaleDateString()}</td>
                  <td className="px-5 py-3"><input value={reviewNote[k.id] || ""} onChange={(e) => setReviewNote((prev) => ({ ...prev, [k.id]: e.target.value }))} placeholder="Optional review note" className="text-xs border border-slate-200 rounded px-2 py-1 w-44" /></td>
                  <td className="px-5 py-3"><div className="flex items-center gap-2 flex-wrap">{k.document_ipfs_hash && <a href={`https://gateway.pinata.cloud/ipfs/${k.document_ipfs_hash}`} target="_blank" rel="noreferrer" className="text-xs text-sky-700">Document</a>}{k.status === "pending" && <><button onClick={() => reviewKyc(k.id, "approved")} className="text-xs px-2 py-1 rounded bg-green-100 text-green-700">Approve</button><button onClick={() => reviewKyc(k.id, "rejected")} className="text-xs px-2 py-1 rounded bg-red-100 text-red-700">Reject</button></>}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "activities" && (
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs font-medium">
              <tr>
                {["User", "Title", "Category", "Status", "Submitted", "Actions"].map((h) => <th key={h} className="px-5 py-3 text-left">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {activities.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-700">{a.user_name || a.user_email}</td>
                  <td className="px-5 py-3 text-slate-700">{a.title}</td>
                  <td className="px-5 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${CAT_COLORS[a.category] || "bg-slate-100 text-slate-700"}`}>{a.category}</span></td>
                  <td className="px-5 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[a.status] || "bg-slate-100 text-slate-700"}`}>{a.status}</span></td>
                  <td className="px-5 py-3 text-slate-400">{new Date(a.created_at).toLocaleDateString()}</td>
                  <td className="px-5 py-3">{a.status === "pending" ? <div className="flex items-center gap-2"><button onClick={() => moderateActivity(a.id, "approve")} className="text-xs px-2 py-1 rounded bg-green-100 text-green-700">Approve</button><button onClick={() => moderateActivity(a.id, "reject")} className="text-xs px-2 py-1 rounded bg-red-100 text-red-700">Reject</button></div> : <span className="text-xs text-slate-400">No action</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "loans" && (
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs font-medium">
              <tr>
                {["User", "Amount", "Approved", "Tier", "Rate", "Status", "Applied"].map((h) => <th key={h} className="px-5 py-3 text-left">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loans.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-700">{l.full_name || l.email}</td>
                  <td className="px-5 py-3">{formatINR(l.amount)}</td>
                  <td className="px-5 py-3">{l.approved_amount ? formatINR(l.approved_amount) : "-"}</td>
                  <td className="px-5 py-3 capitalize">{l.tier}</td>
                  <td className="px-5 py-3">{l.interest_rate}%</td>
                  <td className="px-5 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[l.status] || "bg-slate-100 text-slate-700"}`}>{l.status}</span></td>
                  <td className="px-5 py-3 text-slate-500">{new Date(l.applied_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RoleAuditTable({ title, rows, type }) {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <p className="text-sm font-semibold text-slate-800">{title}</p>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-500 text-xs font-medium">
          <tr>
            <th className="px-5 py-3 text-left">Name</th>
            <th className="px-5 py-3 text-left">Email</th>
            <th className="px-5 py-3 text-left">Access</th>
            <th className="px-5 py-3 text-left">Total</th>
            <th className="px-5 py-3 text-left">Approvals</th>
            <th className="px-5 py-3 text-left">Rejections</th>
            {type === "verifier" ? <th className="px-5 py-3 text-left">24h Reviews</th> : <th className="px-5 py-3 text-left">Avg Interest</th>}
            <th className="px-5 py-3 text-left">Risk</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50">
              <td className="px-5 py-3 font-medium text-slate-700">{r.full_name}</td>
              <td className="px-5 py-3 text-slate-700">{r.email}</td>
              <td className="px-5 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${ACCESS_COLORS[r.access_status] || "bg-slate-100 text-slate-700"}`}>{r.access_status}</span></td>
              <td className="px-5 py-3">{r.total_reviews ?? r.total_decisions ?? 0}</td>
              <td className="px-5 py-3">{r.approvals ?? 0}</td>
              <td className="px-5 py-3">{r.rejections ?? 0}</td>
              {type === "verifier" ? <td className="px-5 py-3">{r.reviews_last_24h ?? 0}</td> : <td className="px-5 py-3">{r.avg_interest_rate ?? 0}%</td>}
              <td className="px-5 py-3">
                <span className={`text-xs px-2 py-0.5 rounded-full ${r.risk_level === "high" ? "bg-red-100 text-red-700" : r.risk_level === "medium" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>
                  {r.risk_level}
                </span>
                {Array.isArray(r.risk_flags) && r.risk_flags.length > 0 && (
                  <p className="text-[11px] text-slate-500 mt-1">{r.risk_flags.join(", ")}</p>
                )}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} className="px-5 py-8 text-center text-slate-400">No data available.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
