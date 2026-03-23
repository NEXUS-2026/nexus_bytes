import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import api from "../utils/api";
import { formatINR } from "../utils/currency";
import {
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Filter,
  HandCoins,
  RefreshCw,
  Search,
  User,
  XCircle,
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
  const [profileByUser, setProfileByUser] = useState({});
  const [deciding, setDeciding] = useState(null);
  const [form, setForm] = useState({});

  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");

  const load = async () => {
    setLoading(true);
    try {
      const [p, a] = await Promise.all([
        api.get("/loan/pending"),
        api.get("/loan/status"),
      ]);
      setPendingLoans(p.data || []);
      setAllLoans(a.data || []);
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
    if (!userId || profileByUser[userId]) return;
    try {
      const { data } = await api.get(`/loan/borrower/${userId}`);
      setProfileByUser((prev) => ({ ...prev, [userId]: data }));
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to load profile");
    }
  };

  const toggleExpand = (loanId, userId) => {
    if (expanded === loanId) {
      setExpanded(null);
      return;
    }

    setExpanded(loanId);
    loadProfile(userId);
    setForm((prev) => ({
      ...prev,
      [loanId]: {
        lender_note: prev[loanId]?.lender_note || "",
        approved_amount: prev[loanId]?.approved_amount || "",
        interest_rate: prev[loanId]?.interest_rate || "",
      },
    }));
  };

  const decide = async (loan, action) => {
    const loanId = loan.id;
    const draft = form[loanId] || {};
    const baselineAmount = Number(loan.amount || 0);
    const baselineRate = Number(loan.interest_rate || 0);
    const finalAmount = Number(draft.approved_amount || baselineAmount);
    const finalRate = Number(draft.interest_rate || baselineRate);
    const hasOverride =
      action === "approve" &&
      (finalAmount !== baselineAmount || finalRate !== baselineRate);

    if (action === "reject" && !draft.lender_note?.trim()) {
      toast.error("Please enter a rejection reason");
      return;
    }

    if (hasOverride && !draft.lender_note?.trim()) {
      toast.error("Please provide a reason when overriding amount or rate");
      return;
    }

    setDeciding(loanId);
    try {
      const payload = { action, lender_note: draft.lender_note };
      if (action === "approve") {
        if (draft.approved_amount)
          payload.approved_amount = Number(draft.approved_amount);
        if (draft.interest_rate)
          payload.interest_rate = Number(draft.interest_rate);
      }

      const { data } = await api.post(`/loan/${loanId}/decide`, payload);
      toast.success(data.message || "Updated");
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
      toast.success(data.message || "Repayment confirmed");
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed");
    }
  };

  const portfolio = useMemo(() => {
    const totalRequested = allLoans.reduce(
      (sum, l) => sum + Number(l.amount || 0),
      0,
    );
    const totalApproved = allLoans
      .filter(
        (l) =>
          l.status === "approved" ||
          l.status === "repaid" ||
          l.status === "repayment_requested",
      )
      .reduce((sum, l) => sum + Number(l.approved_amount || l.amount || 0), 0);
    const outstanding = allLoans
      .filter(
        (l) => l.status === "approved" || l.status === "repayment_requested",
      )
      .reduce((sum, l) => sum + Number(l.approved_amount || l.amount || 0), 0);

    const approvalBase = allLoans.filter((l) => l.status !== "pending").length;
    const approvedCount = allLoans.filter((l) =>
      ["approved", "repaid", "repayment_requested"].includes(l.status),
    ).length;

    return {
      totalRequested,
      totalApproved,
      outstanding,
      approvedCount,
      approvalRate: approvalBase
        ? Math.round((approvedCount / approvalBase) * 100)
        : 0,
      repaymentRequests: allLoans.filter(
        (l) => l.status === "repayment_requested",
      ).length,
      pending: pendingLoans.length,
    };
  }, [allLoans, pendingLoans]);

  const actionableQueue = useMemo(() => {
    return allLoans
      .filter(
        (l) => l.status === "repayment_requested" || l.status === "pending",
      )
      .sort((a, b) => new Date(a.applied_at || 0) - new Date(b.applied_at || 0))
      .slice(0, 5);
  }, [allLoans]);

  const rawLoans =
    tab === "pending"
      ? pendingLoans
      : allLoans.filter((l) => tab === "all" || l.status === tab);

  const displayLoans = useMemo(() => {
    const q = search.trim().toLowerCase();

    let list = rawLoans.filter((l) => {
      const matchesSearch =
        !q ||
        (l.full_name || "").toLowerCase().includes(q) ||
        (l.email || "").toLowerCase().includes(q) ||
        String(l.id || "")
          .toLowerCase()
          .includes(q);

      const matchesTier =
        tierFilter === "all" || (l.tier || "none") === tierFilter;
      return matchesSearch && matchesTier;
    });

    list = [...list].sort((a, b) => {
      if (sortBy === "amount_desc")
        return Number(b.amount || 0) - Number(a.amount || 0);
      if (sortBy === "amount_asc")
        return Number(a.amount || 0) - Number(b.amount || 0);
      if (sortBy === "oldest")
        return new Date(a.applied_at || 0) - new Date(b.applied_at || 0);
      return new Date(b.applied_at || 0) - new Date(a.applied_at || 0);
    });

    return list;
  }, [rawLoans, search, tierFilter, sortBy]);

  if (loading) {
    return (
      <div className="text-center py-20 text-gray-400">
        Loading lender dashboard...
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Lender Command Center
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Review applications, monitor exposure, and close repayments.
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-indigo-600 border border-gray-200 px-3 py-2 rounded-lg"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Pending Review"
          value={portfolio.pending}
          tone="amber"
        />
        <StatCard
          label="Repayment Requests"
          value={portfolio.repaymentRequests}
          tone="purple"
        />
        <StatCard
          label="Approval Rate"
          value={`${portfolio.approvalRate}%`}
          tone="green"
        />
        <StatCard
          label="Outstanding Exposure"
          value={formatINR(portfolio.outstanding)}
          tone="blue"
        />
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <SummaryCard
          title="Total Requested"
          value={formatINR(portfolio.totalRequested)}
        />
        <SummaryCard
          title="Total Approved"
          value={formatINR(portfolio.totalApproved)}
        />
        <SummaryCard
          title="Action Queue"
          value={String(actionableQueue.length)}
          subtitle="Needs your attention"
        />
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 mb-6">
        <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-gray-700">
          <AlertCircle size={15} className="text-amber-500" /> Priority Actions
        </div>
        {actionableQueue.length === 0 ? (
          <p className="text-sm text-gray-400">No urgent actions right now.</p>
        ) : (
          <div className="space-y-2">
            {actionableQueue.map((l) => (
              <button
                key={`q-${l.id}`}
                onClick={() => toggleExpand(l.id, l.user_id)}
                className="w-full text-left border border-gray-100 rounded-xl px-3 py-2 hover:border-indigo-300 transition"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {l.full_name || "Borrower"}
                    </p>
                    <p className="text-xs text-gray-500">
                      Loan #{l.id} · {formatINR(l.amount)} · {l.duration_days}{" "}
                      days
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[l.status] || "bg-gray-100 text-gray-600"}`}
                  >
                    {l.status.replace("_", " ")}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {[
          "pending",
          "approved",
          "repayment_requested",
          "repaid",
          "rejected",
          "all",
        ].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium capitalize transition ${
              tab === t
                ? "bg-indigo-600 text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:border-indigo-300"
            }`}
          >
            {t.replace("_", " ")}
          </button>
        ))}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 mb-4">
        <div className="grid md:grid-cols-4 gap-3">
          <label className="md:col-span-2 flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2">
            <Search size={15} className="text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by borrower name, email, or loan id"
              className="w-full outline-none text-sm"
            />
          </label>

          <label className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2">
            <Filter size={14} className="text-gray-400" />
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              className="w-full text-sm outline-none bg-transparent"
            >
              <option value="all">All tiers</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="none">None</option>
            </select>
          </label>

          <label className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2">
            <Clock size={14} className="text-gray-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full text-sm outline-none bg-transparent"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="amount_desc">Highest amount</option>
              <option value="amount_asc">Lowest amount</option>
            </select>
          </label>
        </div>
      </div>

      {displayLoans.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white border border-gray-100 rounded-2xl shadow-sm">
          <HandCoins size={36} className="mx-auto mb-3 text-gray-200" />
          No loans found for current filters.
        </div>
      ) : (
        <div className="space-y-3">
          {displayLoans.map((loan) => {
            const userId = loan.user_id;
            const p = userId ? profileByUser[userId] : null;
            const isOpen = expanded === loan.id;
            const f = form[loan.id] || {};

            return (
              <div
                key={loan.id}
                className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden"
              >
                <div className="px-5 py-4 flex flex-wrap items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">
                        {loan.full_name || "Borrower"}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${TIER_COLORS[loan.tier] || "bg-gray-100 text-gray-600"}`}
                      >
                        {loan.tier || "none"} tier
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[loan.status] || "bg-gray-100 text-gray-600"}`}
                      >
                        {loan.status.replace("_", " ")}
                      </span>
                      {loan.policy_version && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-indigo-50 text-indigo-700">
                          {loan.policy_version}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 mt-0.5 flex flex-wrap gap-3">
                      <span>{formatINR(loan.amount)} requested</span>
                      <span>{loan.duration_days} days</span>
                      <span>
                        {loan.interest_rate
                          ? `${loan.interest_rate}% rate`
                          : "Rate pending"}
                      </span>
                      {loan.purpose && (
                        <span className="italic">"{loan.purpose}"</span>
                      )}
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
                      onClick={() => toggleExpand(loan.id, userId)}
                      className="flex items-center gap-1 text-xs border border-gray-200 px-3 py-1.5 rounded-lg hover:border-indigo-400 text-gray-600"
                    >
                      {loan.status === "pending" ? "Review" : "View Profile"}
                      {isOpen ? (
                        <ChevronUp size={13} />
                      ) : (
                        <ChevronDown size={13} />
                      )}
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-gray-50 px-5 py-4 bg-gray-50">
                    {!userId ? (
                      <div className="text-sm text-red-500">
                        Borrower reference missing for this loan.
                      </div>
                    ) : p ? (
                      <div className="space-y-4">
                        <div className="grid md:grid-cols-3 gap-4">
                          <div className="bg-white rounded-xl border border-gray-100 p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <User size={14} className="text-gray-400" />
                              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                Borrower Profile
                              </span>
                            </div>
                            <p className="font-medium text-gray-800">
                              {p.user.full_name}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              {p.user.email}
                            </p>
                            {p.user.phone && (
                              <p className="text-xs text-gray-400">
                                {p.user.phone}
                              </p>
                            )}
                            {p.user.wallet_address && (
                              <p className="text-xs text-gray-400 mt-1 font-mono">
                                {p.user.wallet_address}
                              </p>
                            )}
                            <p className="text-xs mt-2">
                              KYC:{" "}
                              <span
                                className={`font-medium ${p.user.kyc_status === "approved" ? "text-green-600" : "text-amber-600"}`}
                              >
                                {p.user.kyc_status}
                              </span>
                            </p>
                            {p.repaymentRate !== null && (
                              <p className="text-xs mt-1">
                                Repayment rate:{" "}
                                <span className="font-semibold text-indigo-600">
                                  {p.repaymentRate}%
                                </span>
                              </p>
                            )}
                          </div>

                          <div className="bg-white rounded-xl border border-gray-100 p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <CheckCircle
                                size={14}
                                className="text-gray-400"
                              />
                              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                Activity Intelligence
                              </span>
                            </div>
                            <p className="text-2xl font-bold text-indigo-600">
                              {p.score}
                            </p>
                            <p className="text-xs text-gray-400 mb-2">
                              Current impact score snapshot
                            </p>
                            {["health", "education", "sustainability"].map(
                              (cat) => {
                                const verified = p.activities.filter(
                                  (a) =>
                                    a.category === cat &&
                                    a.status === "verified",
                                ).length;
                                const pending = p.activities.filter(
                                  (a) =>
                                    a.category === cat &&
                                    a.status === "pending",
                                ).length;
                                return (
                                  <div
                                    key={cat}
                                    className="flex justify-between text-xs text-gray-500 py-0.5"
                                  >
                                    <span className="capitalize">{cat}</span>
                                    <span>
                                      {verified} verified · {pending} pending
                                    </span>
                                  </div>
                                );
                              },
                            )}
                          </div>

                          <div className="bg-white rounded-xl border border-gray-100 p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Clock size={14} className="text-gray-400" />
                              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                Loan Performance
                              </span>
                            </div>
                            {p.loans.length === 0 ? (
                              <p className="text-xs text-gray-400">
                                First-time borrower
                              </p>
                            ) : (
                              <div className="space-y-1">
                                {p.loans.slice(0, 5).map((l) => (
                                  <div
                                    key={l.id}
                                    className="flex justify-between text-xs text-gray-600 py-1 border-b border-gray-50 last:border-0"
                                  >
                                    <span>{formatINR(l.amount)}</span>
                                    <span
                                      className={`px-1.5 rounded capitalize ${STATUS_COLORS[l.status] || "bg-gray-100 text-gray-600"}`}
                                    >
                                      {l.status}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {(loan.factor_adjustments?.length > 0 ||
                          loan.eligibility_reason ||
                          loan.effective_max_amount ||
                          loan.effective_interest_rate) && (
                          <div className="bg-white rounded-xl border border-indigo-100 p-4">
                            <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-2">
                              Underwriting Factors
                            </p>
                            <div className="text-sm text-gray-700 space-y-1">
                              {loan.effective_max_amount && (
                                <p>
                                  Effective max amount:{" "}
                                  {formatINR(loan.effective_max_amount)}
                                </p>
                              )}
                              {loan.effective_interest_rate && (
                                <p>
                                  Effective baseline rate:{" "}
                                  {loan.effective_interest_rate}%
                                </p>
                              )}
                              {loan.factor_adjustments?.length > 0 && (
                                <p>
                                  Applied factors:{" "}
                                  {loan.factor_adjustments.join(", ")}
                                </p>
                              )}
                              {loan.eligibility_reason && (
                                <p>{loan.eligibility_reason}</p>
                              )}
                            </div>
                          </div>
                        )}

                        {loan.status === "pending" && (
                          <div className="bg-white rounded-xl border border-gray-100 p-4">
                            <p className="text-sm font-semibold text-gray-700 mb-3">
                              Decision Panel
                            </p>
                            <div className="mb-3 rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-xs text-indigo-700">
                              Standard terms for this application:{" "}
                              {formatINR(
                                loan.effective_max_amount || loan.amount,
                              )}{" "}
                              at{" "}
                              {loan.effective_interest_rate ||
                                loan.interest_rate}
                              %. Add a reason if you override either value.
                            </div>
                            <div className="grid sm:grid-cols-3 gap-3 mb-3">
                              <div>
                                <label className="text-xs text-gray-500 block mb-1">
                                  Approved Amount
                                </label>
                                <input
                                  type="number"
                                  placeholder={String(loan.amount || "")}
                                  value={f.approved_amount || ""}
                                  onChange={(e) =>
                                    setForm((prev) => ({
                                      ...prev,
                                      [loan.id]: {
                                        ...f,
                                        approved_amount: e.target.value,
                                      },
                                    }))
                                  }
                                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                />
                              </div>

                              <div>
                                <label className="text-xs text-gray-500 block mb-1">
                                  Interest Rate %
                                </label>
                                <input
                                  type="number"
                                  placeholder={String(loan.interest_rate || "")}
                                  value={f.interest_rate || ""}
                                  onChange={(e) =>
                                    setForm((prev) => ({
                                      ...prev,
                                      [loan.id]: {
                                        ...f,
                                        interest_rate: e.target.value,
                                      },
                                    }))
                                  }
                                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                />
                              </div>

                              <div>
                                <label className="text-xs text-gray-500 block mb-1">
                                  Decision reason
                                </label>
                                <input
                                  type="text"
                                  placeholder="Required for reject or override"
                                  value={f.lender_note || ""}
                                  onChange={(e) =>
                                    setForm((prev) => ({
                                      ...prev,
                                      [loan.id]: {
                                        ...f,
                                        lender_note: e.target.value,
                                      },
                                    }))
                                  }
                                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                />
                              </div>
                            </div>

                            <div className="flex gap-2">
                              <button
                                onClick={() => decide(loan, "approve")}
                                disabled={deciding === loan.id}
                                className="flex items-center gap-1.5 bg-green-600 text-white text-sm px-5 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
                              >
                                <CheckCircle size={15} />{" "}
                                {deciding === loan.id
                                  ? "Processing..."
                                  : "Approve Loan"}
                              </button>
                              <button
                                onClick={() => decide(loan, "reject")}
                                disabled={deciding === loan.id}
                                className="flex items-center gap-1.5 border border-red-200 text-red-600 text-sm px-5 py-2 rounded-lg hover:bg-red-50 disabled:opacity-50 transition"
                              >
                                <XCircle size={15} /> Reject
                              </button>
                            </div>
                          </div>
                        )}

                        {loan.status === "rejected" &&
                          loan.rejection_reason && (
                            <div className="bg-red-50 rounded-xl border border-red-100 p-3 text-sm text-red-700">
                              <span className="font-medium">
                                Rejection reason:
                              </span>{" "}
                              {loan.rejection_reason}
                            </div>
                          )}
                      </div>
                    ) : (
                      <div className="text-center text-gray-400 text-sm py-4">
                        Loading borrower profile...
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

function StatCard({ label, value, tone }) {
  const tones = {
    amber: "text-amber-600",
    green: "text-green-600",
    blue: "text-blue-600",
    purple: "text-purple-600",
  };

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
      <div
        className={`text-2xl font-bold mb-1 ${tones[tone] || "text-gray-800"}`}
      >
        {value}
      </div>
      <div className="text-sm text-gray-500">{label}</div>
    </div>
  );
}

function SummaryCard({ title, value, subtitle }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-gray-400">
        {title}
      </div>
      <div className="text-lg font-semibold text-gray-900 mt-1">{value}</div>
      {subtitle && <div className="text-xs text-gray-400 mt-1">{subtitle}</div>}
    </div>
  );
}
