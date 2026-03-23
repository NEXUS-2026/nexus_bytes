import React, { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  AlertCircle,
  TrendingUp,
  Activity,
  CheckCircle,
  XCircle,
} from "lucide-react";
import api from "../utils/api";

const COLORS = {
  healthy: "text-green-600",
  warning: "text-amber-600",
  critical: "text-red-600",
};

export default function VerifierPortfolio() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get("/verifier/analytics");
        setAnalytics(res.data);
      } catch (err) {
        console.error("Error loading verifier analytics:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="text-center py-8 text-gray-500">Loading analytics...</div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-8 text-gray-500">
        Could not load analytics
      </div>
    );
  }

  const categoryChartData = [
    {
      name: "Health",
      verified: analytics.category_breakdown.health.verified,
      rejected: analytics.category_breakdown.health.rejected,
    },
    {
      name: "Education",
      verified: analytics.category_breakdown.education.verified,
      rejected: analytics.category_breakdown.education.rejected,
    },
    {
      name: "Sustainability",
      verified: analytics.category_breakdown.sustainability.verified,
      rejected: analytics.category_breakdown.sustainability.rejected,
    },
  ];

  const queueStatusColors = {
    healthy: "bg-green-100 text-green-700 border-green-200",
    warning_aging: "bg-amber-100 text-amber-700 border-amber-200",
    critical_overdue: "bg-red-100 text-red-700 border-red-200",
  };

  const queueStatusLabel = {
    healthy: "✓ Healthy",
    warning_aging: "⚠ Aging",
    critical_overdue: "✕ Critical",
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Verifier Portfolio</h1>
        <p className="text-gray-600 mt-2">
          Track your verification impact and queue health
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid md:grid-cols-4 gap-4 mb-8">
        <KPICard
          icon={<CheckCircle size={20} />}
          label="Verified This Month"
          value={analytics.summary.verified_this_month}
          color="green"
        />
        <KPICard
          icon={<XCircle size={20} />}
          label="Rejection Rate"
          value={`${analytics.summary.rejection_rate_percent}%`}
          color="red"
        />
        <KPICard
          icon={<Activity size={20} />}
          label="Avg Verification Time"
          value={`${analytics.summary.avg_verification_hours}h`}
          color="blue"
        />
        <KPICard
          icon={<TrendingUp size={20} />}
          label="Borrowers Impacted"
          value={analytics.borrower_impact.borrowers_positively_impacted}
          color="indigo"
        />
      </div>

      {/* Queue Status */}
      <div className="grid md:grid-cols-2 gap-4 mb-8">
        <div
          className={`rounded-2xl border p-6 ${queueStatusColors[analytics.queue_health.queue_status] || queueStatusColors.healthy}`}
        >
          <h3 className="font-semibold mb-3">Queue Status</h3>
          <p className="text-2xl font-bold mb-2">
            {analytics.queue_health.pending_in_queue} pending
          </p>
          <p className="text-sm">
            {queueStatusLabel[analytics.queue_health.queue_status]}
            {analytics.queue_health.oldest_pending_hours > 0 && (
              <span>
                {" "}
                • Oldest: {analytics.queue_health.oldest_pending_hours}h
              </span>
            )}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-3">Borrower Impact</h3>
          <p className="text-3xl font-bold text-indigo-600">
            {analytics.borrower_impact.average_score_of_verified_borrowers}
          </p>
          <p className="text-sm text-gray-600 mt-1">
            Avg score of verified borrowers
          </p>
        </div>
      </div>

      {/* Category Breakdown Chart */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-8">
        <h3 className="font-semibold text-gray-900 mb-4">
          Verification by Category
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={categoryChartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="verified" fill="#10b981" />
            <Bar dataKey="rejected" fill="#ef4444" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary Stats */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h3 className="text-sm font-semibold text-gray-600 mb-2">
            Overall Metrics
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-700">Total Verified:</span>
              <span className="font-bold text-green-600">
                {analytics.summary.total_activities_verified}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-700">Total Rejected:</span>
              <span className="font-bold text-red-600">
                {analytics.summary.total_activities_rejected}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-700">Borrower Trust:</span>
              <span className="font-bold text-indigo-600">
                {analytics.quality_indicators.estimated_borrower_trust}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h3 className="text-sm font-semibold text-gray-600 mb-2">
            Quality Indicators
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-700">Consistency:</span>
              <span className="font-bold capitalize text-amber-600">
                {analytics.quality_indicators.verification_consistency}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-700">Time Tracking:</span>
              <span className="font-bold">
                {analytics.quality_indicators.activity_time_tracking}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h3 className="text-sm font-semibold text-gray-600 mb-2">
            Top Scores Created
          </h3>
          <div className="space-y-1">
            {analytics.borrower_impact.top_contributors?.length > 0 ? (
              analytics.borrower_impact.top_contributors.map((score, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span className="text-gray-600">#{idx + 1}</span>
                  <span className="font-bold text-indigo-600">{score}</span>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-sm">No scores yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function KPICard({ icon, label, value, color }) {
  const colors = {
    green: "bg-green-50 text-green-600",
    red: "bg-red-50 text-red-600",
    blue: "bg-blue-50 text-blue-600",
    indigo: "bg-indigo-50 text-indigo-600",
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <div
        className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${colors[color]}`}
      >
        {icon}
      </div>
      <p className="text-gray-600 text-sm">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  );
}
