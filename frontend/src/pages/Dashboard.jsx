// src/pages/Dashboard.jsx
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Doughnut, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend,
  CategoryScale, LinearScale, BarElement, Title,
} from "chart.js";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";
import {
  Activity, Award, TrendingUp, Clock, CheckCircle,
  XCircle, PlusCircle, ArrowRight, Search, ShieldAlert,
} from "lucide-react";
import { formatINR } from "../utils/currency";

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

const STATUS_COLORS = {
  verified: "bg-green-100 text-green-700",
  pending:  "bg-yellow-100 text-yellow-700",
  rejected: "bg-red-100 text-red-700",
};

export default function Dashboard() {
  const { user } = useAuth();
  const [scoreData,    setScoreData]    = useState(null);
  const [activities,   setActivities]   = useState([]);
  const [loans,        setLoans]        = useState([]);
  const [pendingVerifications, setPendingVerifications] = useState([]);
  const [verificationAudit, setVerificationAudit] = useState([]);
  const [pendingLoansForLender, setPendingLoansForLender] = useState([]);
  const [borrowersForLender, setBorrowersForLender] = useState([]);
  const [loading,      setLoading]      = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        if (user.role === "borrower") {
          const [s, a, l] = await Promise.all([
            api.get("/score"),
            api.get("/activity"),
            api.get("/loan/status"),
          ]);
          setScoreData(s.data);
          setActivities(a.data);
          setLoans(l.data);
        } else if (user.role === "verifier") {
          const [p, audit] = await Promise.all([
            api.get("/verify/pending", { params: { limit: 20, offset: 0, sortOrder: "asc" } }),
            api.get("/verify/audit", { params: { limit: 20, offset: 0 } }),
          ]);
          setPendingVerifications(Array.isArray(p.data) ? p.data : (p.data.items || []));
          setVerificationAudit(audit.data || []);
        } else if (user.role === "lender" || user.role === "admin") {
          const [pending, borrowers, allStatus] = await Promise.all([
            api.get("/loan/pending", { params: { sortBy: "applied_at", sortOrder: "asc" } }),
            api.get("/loan/borrowers", { params: { limit: 20, offset: 0, sortBy: "score", sortOrder: "desc" } }),
            api.get("/loan/status"),
          ]);
          setPendingLoansForLender(pending.data || []);
          setBorrowersForLender(borrowers.data?.items || []);
          setLoans(allStatus.data || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user.role]);

  if (loading) return (
    <div className="flex items-center justify-center py-32 text-gray-400">Loading dashboard…</div>
  );

  if (user.role === "verifier") {
    const highRisk = pendingVerifications.filter((a) => a.fraud?.riskLevel === "high").length;
    const avgRisk = pendingVerifications.length
      ? Math.round(
          pendingVerifications.reduce((sum, a) => sum + Number(a.fraud?.riskScore || 0), 0) /
          pendingVerifications.length
        )
      : 0;
    const approvedRecent = verificationAudit.filter((l) => l.action === "approve").length;
    const rejectedRecent = verificationAudit.filter((l) => l.action === "reject").length;

    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Verifier Dashboard</h1>
            <p className="text-gray-500 text-sm mt-1">Queue health, risk signals, and recent verification decisions.</p>
          </div>
          <Link to="/verify" className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition">
            Open Verification Queue <ArrowRight size={14} />
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard icon={<Clock size={20} />} label="Pending Queue" value={pendingVerifications.length} color="amber" />
          <StatCard icon={<ShieldAlert size={20} />} label="High Risk" value={highRisk} color="red" />
          <StatCard icon={<TrendingUp size={20} />} label="Avg Risk Score" value={avgRisk} color="indigo" />
          <StatCard icon={<CheckCircle size={20} />} label="Recent Decisions" value={verificationAudit.length} color="green" />
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">Risk Focus</h3>
              <span className="text-xs text-gray-400">Top pending items</span>
            </div>
            {pendingVerifications.length === 0 ? (
              <p className="text-center text-gray-400 py-10 text-sm">No pending verifications.</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {pendingVerifications
                  .slice()
                  .sort((a, b) => Number(b.fraud?.riskScore || 0) - Number(a.fraud?.riskScore || 0))
                  .slice(0, 6)
                  .map((a) => (
                    <div key={a.id} className="px-6 py-4">
                      <p className="font-medium text-gray-800 text-sm">{a.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{a.full_name} · {a.category}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${a.fraud?.riskLevel === "high" ? "bg-red-100 text-red-700" : a.fraud?.riskLevel === "medium" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>
                          {a.fraud?.riskLevel || "low"} risk ({a.fraud?.riskScore || 0})
                        </span>
                        {a.fraud?.flags?.slice(0, 2).map((f) => (
                          <span key={f} className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                            {String(f).replaceAll("_", " ")}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">Recent History</h3>
              <span className="text-xs text-gray-400">Approved {approvedRecent} · Rejected {rejectedRecent}</span>
            </div>
            {verificationAudit.length === 0 ? (
              <p className="text-center text-gray-400 py-10 text-sm">No verification history yet.</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {verificationAudit.slice(0, 6).map((log) => (
                  <div key={log.id} className="px-6 py-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-800 text-sm">{log.activity_title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{new Date(log.created_at).toLocaleString()}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${log.action === "approve" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {log.action}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (user.role === "lender" || user.role === "admin") {
    const highRiskBorrowers = borrowersForLender.filter((b) => b.risk_level === "high").length;
    const approvedLoans = loans.filter((l) => l.status === "approved").length;

    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Lender Dashboard</h1>
            <p className="text-gray-500 text-sm mt-1">Portfolio overview, borrower risk signals, and pending decisions.</p>
          </div>
          <Link to="/lender" className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition">
            Open Loan Reviews <ArrowRight size={14} />
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          <StatCard icon={<Clock size={20} />} label="Pending Loans" value={pendingLoansForLender.length} color="amber" />
          <StatCard icon={<Search size={20} />} label="Borrowers Tracked" value={borrowersForLender.length} color="teal" />
          <StatCard icon={<ShieldAlert size={20} />} label="High Risk Borrowers" value={highRiskBorrowers} color="red" />
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">Pending Loan Queue</h3>
              <span className="text-xs text-gray-400">Approved total {approvedLoans}</span>
            </div>
            {pendingLoansForLender.length === 0 ? (
              <p className="text-center text-gray-400 py-10 text-sm">No pending loans right now.</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {pendingLoansForLender.slice(0, 6).map((loan) => (
                  <div key={loan.id} className="px-6 py-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-800 text-sm">{loan.full_name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{formatINR(loan.amount)} · score {loan.current_score ?? loan.score_at_apply}</p>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700">pending</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-50">
              <h3 className="font-semibold text-gray-800">Borrower Risk Watchlist</h3>
            </div>
            {borrowersForLender.length === 0 ? (
              <p className="text-center text-gray-400 py-10 text-sm">No borrower data yet.</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {borrowersForLender
                  .slice()
                  .sort((a, b) => Number(b.risk_score || 0) - Number(a.risk_score || 0))
                  .slice(0, 6)
                  .map((b) => (
                    <div key={b.id} className="px-6 py-4">
                      <p className="font-medium text-gray-800 text-sm">{b.full_name}</p>
                      <div className="mt-1 flex items-center gap-2 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${b.risk_level === "high" ? "bg-red-100 text-red-700" : b.risk_level === "medium" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>
                          {b.risk_level} risk ({b.risk_score || 0})
                        </span>
                        <span className="text-xs text-gray-500">score {b.current_score}</span>
                        <span className="text-xs text-gray-500">repayment {b.repayment_rate ?? "N/A"}%</span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const score      = scoreData?.score ?? 0;
  const tier       = scoreData?.tier  ?? "none";
  const breakdown  = scoreData?.breakdown ?? {};
  const tierColors = { low: "#22c55e", medium: "#f59e0b", high: "#ef4444", none: "#94a3b8" };

  // Donut chart data
  const donutData = {
    labels: ["Health", "Education", "Sustainability"],
    datasets: [{
      data: [
        (breakdown.health?.points         ?? 0),
        (breakdown.education?.points      ?? 0),
        (breakdown.sustainability?.points ?? 0),
      ],
      backgroundColor: ["#6366f1", "#06b6d4", "#22c55e"],
      borderWidth: 2,
      borderColor: "#fff",
    }],
  };

  // Bar chart (activity counts)
  const barData = {
    labels: ["Health", "Education", "Sustainability"],
    datasets: [
      { label: "Verified", data: [breakdown.health?.verified ?? 0, breakdown.education?.verified ?? 0, breakdown.sustainability?.verified ?? 0], backgroundColor: "#6366f1" },
      { label: "Pending",  data: [breakdown.health?.pending  ?? 0, breakdown.education?.pending  ?? 0, breakdown.sustainability?.pending  ?? 0], backgroundColor: "#f59e0b" },
      { label: "Rejected", data: [breakdown.health?.rejected ?? 0, breakdown.education?.rejected ?? 0, breakdown.sustainability?.rejected ?? 0], backgroundColor: "#ef4444" },
    ],
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome, {user.full_name?.split(" ")[0]}</h1>
          <p className="text-gray-500 text-sm mt-1">{user.email} · <span className="capitalize">{user.role}</span></p>
        </div>
        {user.role === "borrower" && (
          <Link to="/submit-activity"
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition">
            <PlusCircle size={16} /> Add Activity
          </Link>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard icon={<Award size={20} />}    label="Impact Score"  value={score}                  color="indigo" />
        <StatCard icon={<Activity size={20} />} label="Total Activities" value={activities.length}   color="teal" />
        <StatCard icon={<CheckCircle size={20}/>} label="Verified"    value={activities.filter(a=>a.status==="verified").length} color="green" />
        <StatCard icon={<Clock size={20} />}    label="Pending"       value={activities.filter(a=>a.status==="pending").length}  color="amber" />
      </div>

      {/* Score + charts */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        {/* Score card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col items-center justify-center gap-3">
          <div className="text-6xl font-bold" style={{ color: tierColors[tier] }}>{score}</div>
          <div className="text-gray-500 text-sm">Impact Score</div>
          <span className={`text-xs px-3 py-1 rounded-full font-medium capitalize
            ${tier === "low" ? "bg-green-100 text-green-700" :
              tier === "medium" ? "bg-amber-100 text-amber-700" :
              tier === "high"   ? "bg-orange-100 text-orange-700" :
                                  "bg-gray-100 text-gray-500"}`}>
            {tier === "none" ? "Not eligible" : `${tier} interest tier`}
          </span>
          {scoreData?.loanEligible && (
            <div className="text-center text-sm text-gray-500">
              Max loan: <span className="font-semibold text-gray-800">{formatINR(scoreData.maxLoanAmount)}</span>
              {" "}at <span className="font-semibold">{scoreData.interestRate}%</span>
            </div>
          )}
          {user.role === "borrower" && (
            <Link to="/loan" className="text-indigo-600 text-sm font-medium flex items-center gap-1 mt-1">
              Apply for loan <ArrowRight size={14} />
            </Link>
          )}
        </div>

        {/* Donut */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Score Breakdown</h3>
          <div className="h-48">
            <Doughnut data={donutData} options={{ maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } }} />
          </div>
        </div>

        {/* Bar */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Activity Status</h3>
          <div className="h-48">
            <Bar data={barData} options={{
              maintainAspectRatio: false,
              scales: { x: { stacked: false }, y: { beginAtZero: true, ticks: { stepSize: 1 } } },
              plugins: { legend: { position: "bottom" } },
            }} />
          </div>
        </div>
      </div>

      {/* Recent activities */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
          <h3 className="font-semibold text-gray-800">Recent Activities</h3>
          <Link to="/activities" className="text-sm text-indigo-600 font-medium">View all</Link>
        </div>
        {activities.length === 0
          ? <p className="text-center text-gray-400 py-10 text-sm">No activities yet.</p>
          : (
            <div className="divide-y divide-gray-50">
              {activities.slice(0, 5).map((a) => (
                <div key={a.id} className="px-6 py-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-800 text-sm">{a.title}</p>
                    <p className="text-xs text-gray-400 capitalize mt-0.5">{a.category}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[a.status] || ""}`}>
                    {a.status}
                  </span>
                </div>
              ))}
            </div>
          )
        }
      </div>

      {/* Recent loans */}
      {user.role === "borrower" && loans.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">Loan History</h3>
            <Link to="/loan" className="text-sm text-indigo-600 font-medium">Apply</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {loans.slice(0, 3).map((l) => (
              <div key={l.id} className="px-6 py-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-800 text-sm">{formatINR(l.amount)} requested</p>
                  <p className="text-xs text-gray-400 mt-0.5">{l.duration_days} days · {l.tier} tier</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[l.status] || "bg-gray-100 text-gray-600"}`}>
                  {l.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {user.role === "borrower" && (
        <div className="mt-6 bg-indigo-50 border border-indigo-100 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-indigo-800">Optional KYC can improve loan approval chances</p>
            <p className="text-xs text-indigo-700 mt-1">Lenders use KYC status as part of borrower confidence checks.</p>
          </div>
          <Link to="/kyc" className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
            Manage KYC
          </Link>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  const colors = {
    indigo: "bg-indigo-50 text-indigo-600",
    teal:   "bg-teal-50 text-teal-600",
    green:  "bg-green-50 text-green-600",
    amber:  "bg-amber-50 text-amber-600",
    red:    "bg-red-50 text-red-600",
  };
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${colors[color]}`}>
        {icon}
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-sm text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}
