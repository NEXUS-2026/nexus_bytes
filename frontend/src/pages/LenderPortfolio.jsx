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
  DollarSign,
  CheckCircle,
  XCircle,
} from "lucide-react";
import api from "../utils/api";
import { formatINR } from "../utils/currency";

export default function LenderPortfolio() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get("/lender/analytics");
        setAnalytics(res.data);
      } catch (err) {
        console.error("Error loading lender analytics:", err);
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

  const riskTierData = [
    { name: "Low Tier", value: analytics.risk_segmentation.low_tier_loans },
    {
      name: "Medium Tier",
      value: analytics.risk_segmentation.medium_tier_loans,
    },
    { name: "High Tier", value: analytics.risk_segmentation.high_tier_loans },
    {
      name: "Not Eligible",
      value: analytics.risk_segmentation.not_eligible_loans,
    },
  ];

  const toTitleCase = (value) =>
    String(value || "")
      .split(" ")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");

  const repaymentData = Object.entries(analytics.repayment_by_tier || {}).map(
    ([tier, rate]) => ({
      tier: toTitleCase(tier.replace(/_/g, " ")),
      rate,
    }),
  );

  const COLORS = ["#10b981", "#f59e0b", "#ef4444", "#9ca3af"];

  const portfolioHealthStatus = {
    healthy: "text-green-600 bg-green-50 border-green-200",
    warning_elevated_risk: "text-amber-600 bg-amber-50 border-amber-200",
    critical_high_defaults: "text-red-600 bg-red-50 border-red-200",
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Lender Portfolio</h1>
        <p className="text-gray-600 mt-2">
          Monitor your loan portfolio and risk metrics
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid md:grid-cols-4 gap-4 mb-8">
        <KPICard
          icon={<DollarSign size={20} />}
          label="Capital Deployed"
          value={formatINR(analytics.capital_metrics.total_deployed)}
          color="blue"
        />
        <KPICard
          icon={<CheckCircle size={20} />}
          label="Approval Rate"
          value={`${analytics.decision_metrics.approval_rate_percent}%`}
          color="green"
        />
        <KPICard
          icon={<TrendingUp size={20} />}
          label="Active Loans"
          value={analytics.portfolio_summary.active_loans}
          color="indigo"
        />
        <KPICard
          icon={<XCircle size={20} />}
          label="Default Rate"
          value={`${analytics.decision_metrics.default_rate_percent}%`}
          color="red"
        />
      </div>

      {/* Portfolio Health Alert */}
      <div
        className={`rounded-2xl border p-6 mb-8 ${portfolioHealthStatus[analytics.portfolio_health.status] || portfolioHealthStatus.healthy}`}
      >
        <div className="flex items-start gap-3">
          <AlertCircle size={20} className="mt-0.5" />
          <div>
            <h3 className="font-semibold mb-1">Portfolio Health</h3>
            <p className="text-sm">
              {analytics.portfolio_health.recommendation}
            </p>
          </div>
        </div>
      </div>

      {/* Capital Metrics */}
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <MetricCard
          title="Outstanding Balance"
          value={formatINR(analytics.capital_metrics.outstanding_balance)}
          subtitle={`of ${formatINR(analytics.capital_metrics.total_deployed)} deployed`}
        />
        <MetricCard
          title="Repaid So Far"
          value={formatINR(analytics.capital_metrics.total_repaid)}
          subtitle={`${analytics.portfolio_summary.repaid_loans} loans completed`}
        />
        <MetricCard
          title="Avg Loan Amount"
          value={formatINR(analytics.capital_metrics.avg_loan_amount)}
          subtitle={`${analytics.capital_metrics.avg_loan_duration_days}d avg duration`}
        />
      </div>

      {/* Risk Segmentation */}
      <div className="grid md:grid-cols-2 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">
            Loan Distribution by Score Tier
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={riskTierData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {COLORS.map((color, index) => (
                  <Cell key={`cell-${index}`} fill={color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">
            Repayment Rate by Tier
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={repaymentData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="tier" />
              <YAxis domain={[0, 100]} />
              <Tooltip formatter={(value) => `${value}%`} />
              <Bar dataKey="rate" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Decision Analytics */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h3 className="text-sm font-semibold text-gray-600 mb-4">
            Portfolio Status
          </h3>
          <div className="space-y-3">
            <StatRow
              label="Total Loans"
              value={analytics.portfolio_summary.total_loans}
            />
            <StatRow
              label="Pending Decisions"
              value={analytics.portfolio_summary.pending_decisions}
            />
            <StatRow
              label="Rejected"
              value={analytics.portfolio_summary.rejected_loans}
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h3 className="text-sm font-semibold text-gray-600 mb-4">
            Decision Metrics
          </h3>
          <div className="space-y-3">
            <StatRow
              label="Override Rate"
              value={`${analytics.decision_metrics.override_rate_percent}%`}
            />
            <StatRow
              label="Total Overridden"
              value={analytics.decision_insights.total_overridden_approvals}
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h3 className="text-sm font-semibold text-gray-600 mb-4">
            Risk Profile
          </h3>
          <div className="space-y-3">
            <StatRow
              label="Low Risk (Low Tier)"
              value={analytics.risk_segmentation.low_tier_loans}
            />
            <StatRow
              label="Medium Risk"
              value={analytics.risk_segmentation.medium_tier_loans}
            />
            <StatRow
              label="High Risk"
              value={analytics.risk_segmentation.high_tier_loans}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function KPICard({ icon, label, value, color }) {
  const colors = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    indigo: "bg-indigo-50 text-indigo-600",
    red: "bg-red-50 text-red-600",
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

function MetricCard({ title, value, subtitle }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <p className="text-gray-600 text-sm font-medium">{title}</p>
      <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
      <p className="text-xs text-gray-500 mt-2">{subtitle}</p>
    </div>
  );
}

function StatRow({ label, value }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-700 text-sm">{label}</span>
      <span className="font-bold text-indigo-600">{value}</span>
    </div>
  );
}
