import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Doughnut, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
} from "chart.js";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";
import { formatINR } from "../utils/currency";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Award,
  CheckCircle,
  Clock,
  ListChecks,
  PlusCircle,
  Wallet,
} from "lucide-react";

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
);

const STATUS_COLORS = {
  verified: "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700",
  rejected: "bg-red-100 text-red-700",
};

const TIER_COLOR = {
  low: "text-green-600",
  medium: "text-amber-600",
  high: "text-orange-600",
  none: "text-gray-500",
};

function getNextMilestone(score) {
  if (score < 20) {
    return { label: "Loan eligibility", target: 20, remaining: 20 - score };
  }
  if (score <= 50) {
    return { label: "Medium tier", target: 51, remaining: 51 - score };
  }
  if (score <= 80) {
    return { label: "Low interest tier", target: 81, remaining: 81 - score };
  }
  return { label: "Top tier unlocked", target: score, remaining: 0 };
}

function progressToTarget(score, target) {
  if (!target || target <= 0) return 100;
  return Math.max(0, Math.min(100, Math.round((score / target) * 100)));
}

export default function Dashboard() {
  const { user } = useAuth();
  const [scoreData, setScoreData] = useState(null);
  const [activities, setActivities] = useState([]);
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [s, a, l] = await Promise.all([
          api.get("/score"),
          api.get("/activity"),
          user.role === "borrower"
            ? api.get("/loan/status")
            : Promise.resolve({ data: [] }),
        ]);
        setScoreData(s.data);
        setActivities(a.data || []);
        setLoans(l.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user.role]);

  const computed = useMemo(() => {
    const score = scoreData?.score ?? 0;
    const tier = scoreData?.tier ?? "none";
    const breakdown = scoreData?.breakdown ?? {};

    const verifiedCount = activities.filter(
      (a) => a.status === "verified",
    ).length;
    const pendingCount = activities.filter(
      (a) => a.status === "pending",
    ).length;
    const rejectedCount = activities.filter(
      (a) => a.status === "rejected",
    ).length;

    const activeLoan = loans.find((l) =>
      ["pending", "approved", "repayment_requested"].includes(l.status),
    );
    const totalBorrowed = loans
      .filter((l) =>
        ["approved", "repaid", "repayment_requested"].includes(l.status),
      )
      .reduce((sum, l) => sum + Number(l.approved_amount || l.amount || 0), 0);

    const thisMonthActivities = activities.filter((a) => {
      const d = new Date(a.created_at);
      const now = new Date();
      return (
        d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
      );
    }).length;

    const milestone = getNextMilestone(score);
    const milestoneProgress = progressToTarget(score, milestone.target);

    const checklist = {
      walletConnected: Boolean(user.wallet_address),
      atLeastOneVerified: verifiedCount > 0,
      scoreEligible: score >= 20,
    };

    const events = [
      ...activities.map((a) => ({
        id: `activity-${a.id}`,
        type: "activity",
        title: a.title,
        subtitle: `${a.category} · ${a.status}`,
        at: a.created_at,
      })),
      ...loans.map((l) => ({
        id: `loan-${l.id}`,
        type: "loan",
        title: `Loan ${formatINR(l.amount)} requested`,
        subtitle: `${l.status} · ${l.duration_days} days`,
        at: l.applied_at || l.updated_at || l.created_at,
      })),
    ]
      .sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0))
      .slice(0, 6);

    return {
      score,
      tier,
      breakdown,
      verifiedCount,
      pendingCount,
      rejectedCount,
      activeLoan,
      totalBorrowed,
      thisMonthActivities,
      milestone,
      milestoneProgress,
      checklist,
      events,
    };
  }, [activities, loans, scoreData, user.wallet_address]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 text-gray-400">
        Loading dashboard...
      </div>
    );
  }

  const donutData = {
    labels: ["Health", "Education", "Sustainability"],
    datasets: [
      {
        data: [
          computed.breakdown.health?.points ?? 0,
          computed.breakdown.education?.points ?? 0,
          computed.breakdown.sustainability?.points ?? 0,
        ],
        backgroundColor: ["#6366f1", "#06b6d4", "#22c55e"],
        borderWidth: 2,
        borderColor: "#fff",
      },
    ],
  };

  const barData = {
    labels: ["Health", "Education", "Sustainability"],
    datasets: [
      {
        label: "Verified",
        data: [
          computed.breakdown.health?.verified ?? 0,
          computed.breakdown.education?.verified ?? 0,
          computed.breakdown.sustainability?.verified ?? 0,
        ],
        backgroundColor: "#6366f1",
      },
      {
        label: "Pending",
        data: [
          computed.breakdown.health?.pending ?? 0,
          computed.breakdown.education?.pending ?? 0,
          computed.breakdown.sustainability?.pending ?? 0,
        ],
        backgroundColor: "#f59e0b",
      },
      {
        label: "Rejected",
        data: [
          computed.breakdown.health?.rejected ?? 0,
          computed.breakdown.education?.rejected ?? 0,
          computed.breakdown.sustainability?.rejected ?? 0,
        ],
        backgroundColor: "#ef4444",
      },
    ],
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Borrower Dashboard
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {user.full_name} · Track your impact progress and loan readiness
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            to="/submit-activity"
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition"
          >
            <PlusCircle size={16} /> Add Activity
          </Link>
          <Link
            to="/loan"
            className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-semibold hover:border-indigo-300"
          >
            <ArrowRight size={16} /> Loan Center
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <StatCard
          icon={<Award size={20} />}
          label="Impact Score"
          value={computed.score}
          color="indigo"
        />
        <StatCard
          icon={<Activity size={20} />}
          label="Total Activities"
          value={activities.length}
          color="teal"
        />
        <StatCard
          icon={<CheckCircle size={20} />}
          label="Verified"
          value={computed.verifiedCount}
          color="green"
        />
        <StatCard
          icon={<Clock size={20} />}
          label="Pending"
          value={computed.pendingCount}
          color="amber"
        />
        <StatCard
          icon={<Wallet size={20} />}
          label="Borrowed So Far"
          value={formatINR(computed.totalBorrowed)}
          color="blue"
        />
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">
            Eligibility Journey
          </h3>
          <p
            className={`text-3xl font-bold ${TIER_COLOR[computed.tier] || "text-gray-700"}`}
          >
            {computed.score}
          </p>
          <p className="text-xs text-gray-500 mt-1 capitalize">
            Current tier:{" "}
            {computed.tier === "none" ? "Not eligible" : computed.tier}
          </p>

          {computed.milestone.remaining > 0 ? (
            <>
              <p className="text-xs text-gray-500 mt-3">
                Need{" "}
                <span className="font-semibold text-indigo-600">
                  {computed.milestone.remaining}
                </span>{" "}
                more points for {computed.milestone.label}.
              </p>
              <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500"
                  style={{ width: `${computed.milestoneProgress}%` }}
                />
              </div>
            </>
          ) : (
            <p className="text-xs text-green-600 mt-3 font-medium">
              Great work. You are in the highest loan tier.
            </p>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">
            Loan Readiness Checklist
          </h3>
          <ChecklistItem
            ok={computed.checklist.walletConnected}
            text="Wallet connected"
          />
          <ChecklistItem
            ok={computed.checklist.atLeastOneVerified}
            text="At least one verified activity"
          />
          <ChecklistItem
            ok={computed.checklist.scoreEligible}
            text="Impact score is loan-eligible (20+)"
          />
          <Link
            to="/loan"
            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 mt-3"
          >
            Open Loan Center <ArrowRight size={12} />
          </Link>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">
            Current Loan Snapshot
          </h3>
          {computed.activeLoan ? (
            <>
              <p className="text-sm font-medium text-gray-900">
                {formatINR(computed.activeLoan.amount)} requested
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {computed.activeLoan.duration_days} days ·{" "}
                {computed.activeLoan.interest_rate || "-"}% rate
              </p>
              <span
                className={`inline-block mt-2 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[computed.activeLoan.status] || "bg-gray-100 text-gray-600"}`}
              >
                {computed.activeLoan.status.replace("_", " ")}
              </span>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-500">No active loan right now.</p>
              <p className="text-xs text-gray-400 mt-2">
                This month activities: {computed.thisMonthActivities}
              </p>
            </>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col items-center justify-center gap-3">
          <div
            className={`text-6xl font-bold ${TIER_COLOR[computed.tier] || "text-gray-700"}`}
          >
            {computed.score}
          </div>
          <div className="text-gray-500 text-sm">Impact Score</div>
          <span
            className={`text-xs px-3 py-1 rounded-full font-medium capitalize ${
              computed.tier === "low"
                ? "bg-green-100 text-green-700"
                : computed.tier === "medium"
                  ? "bg-amber-100 text-amber-700"
                  : computed.tier === "high"
                    ? "bg-orange-100 text-orange-700"
                    : "bg-gray-100 text-gray-500"
            }`}
          >
            {computed.tier === "none"
              ? "Not eligible"
              : `${computed.tier} interest tier`}
          </span>
          {scoreData?.loanEligible && (
            <div className="text-center text-sm text-gray-500">
              Max loan:{" "}
              <span className="font-semibold text-gray-800">
                {formatINR(scoreData.maxLoanAmount)}
              </span>{" "}
              at{" "}
              <span className="font-semibold">{scoreData.interestRate}%</span>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Points by Category
          </h3>
          <div className="h-48">
            <Doughnut
              data={donutData}
              options={{
                maintainAspectRatio: false,
                plugins: { legend: { position: "bottom" } },
              }}
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Category Status Mix
          </h3>
          <div className="h-48">
            <Bar
              data={barData}
              options={{
                maintainAspectRatio: false,
                scales: {
                  x: { stacked: false },
                  y: { beginAtZero: true, ticks: { stepSize: 1 } },
                },
                plugins: { legend: { position: "bottom" } },
              }}
            />
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
            <h3 className="font-semibold text-gray-800">Recent Activities</h3>
            <Link
              to="/activities"
              className="text-sm text-indigo-600 font-medium"
            >
              View all
            </Link>
          </div>

          {activities.length === 0 ? (
            <p className="text-center text-gray-400 py-10 text-sm">
              No activities yet.
            </p>
          ) : (
            <div className="divide-y divide-gray-50">
              {activities.slice(0, 5).map((a) => (
                <div
                  key={a.id}
                  className="px-6 py-4 flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="font-medium text-gray-800 text-sm">
                      {a.title}
                    </p>
                    <p className="text-xs text-gray-400 capitalize mt-0.5">
                      {a.category}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[a.status] || "bg-gray-100 text-gray-600"}`}
                  >
                    {a.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
            <h3 className="font-semibold text-gray-800">Recent Timeline</h3>
            <span className="text-xs text-gray-400">Activities + Loans</span>
          </div>

          {computed.events.length === 0 ? (
            <p className="text-center text-gray-400 py-10 text-sm">
              No recent updates.
            </p>
          ) : (
            <div className="divide-y divide-gray-50">
              {computed.events.map((e) => (
                <div key={e.id} className="px-6 py-4">
                  <p className="text-sm font-medium text-gray-800">{e.title}</p>
                  <p className="text-xs text-gray-500 mt-1">{e.subtitle}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(e.at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {computed.pendingCount > 0 && (
        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-amber-600 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              You have {computed.pendingCount} pending activities
            </p>
            <p className="text-xs text-amber-700 mt-1">
              Verification can improve your score and unlock better loan rates.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  const colors = {
    indigo: "bg-indigo-50 text-indigo-600",
    teal: "bg-teal-50 text-teal-600",
    green: "bg-green-50 text-green-600",
    amber: "bg-amber-50 text-amber-600",
    blue: "bg-blue-50 text-blue-600",
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div
        className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${colors[color]}`}
      >
        {icon}
      </div>
      <div className="text-2xl font-bold text-gray-900 truncate">{value}</div>
      <div className="text-sm text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}

function ChecklistItem({ ok, text }) {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-600 py-1">
      {ok ? (
        <CheckCircle size={15} className="text-green-600" />
      ) : (
        <ListChecks size={15} className="text-gray-400" />
      )}
      <span>{text}</span>
    </div>
  );
}
