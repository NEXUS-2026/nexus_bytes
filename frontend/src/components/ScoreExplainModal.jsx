import React, { useEffect, useState } from "react";
import { X, TrendingUp, Zap, Award, AlertCircle } from "lucide-react";
import api from "../utils/api";

function formatScore(value) {
  const num = Number(value || 0);
  if (Number.isNaN(num)) return "0";
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
}

export default function ScoreExplainModal({ userId, isOpen, onClose }) {
  const [explanation, setExplanation] = useState(null);
  const [trajectory, setTrajectory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("breakdown");

  useEffect(() => {
    if (!isOpen || !userId) return;

    const load = async () => {
      setLoading(true);
      try {
        const [exp, traj] = await Promise.all([
          api.get(`/score/explain/${userId}`),
          api.get(`/score/trajectory/${userId}`),
        ]);
        setExplanation(exp.data);
        setTrajectory(traj.data);
      } catch (err) {
        console.error("Error loading score explanation:", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [isOpen, userId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white p-6 flex items-center justify-between border-b border-indigo-500">
          <div className="flex items-center gap-3">
            <Award size={24} />
            <div>
              <h2 className="text-xl font-bold">Score Explanation</h2>
              <p className="text-indigo-100 text-sm">
                Understand how your impact score is calculated
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-indigo-500 rounded-lg transition"
          >
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : !explanation ? (
          <div className="p-8 text-center text-gray-500">
            Could not load score explanation
          </div>
        ) : (
          <>
            {/* Tab Navigation */}
            <div className="border-b border-gray-200 flex">
              <button
                onClick={() => setTab("breakdown")}
                className={`flex-1 px-6 py-3 font-medium text-sm transition ${
                  tab === "breakdown"
                    ? "text-indigo-600 border-b-2 border-indigo-600"
                    : "text-gray-600 hover:text-gray-800"
                }`}
              >
                Score Breakdown
              </button>
              <button
                onClick={() => setTab("trajectory")}
                className={`flex-1 px-6 py-3 font-medium text-sm transition ${
                  tab === "trajectory"
                    ? "text-indigo-600 border-b-2 border-indigo-600"
                    : "text-gray-600 hover:text-gray-800"
                }`}
              >
                Score Trend
              </button>
              <button
                onClick={() => setTab("factors")}
                className={`flex-1 px-6 py-3 font-medium text-sm transition ${
                  tab === "factors"
                    ? "text-indigo-600 border-b-2 border-indigo-600"
                    : "text-gray-600 hover:text-gray-800"
                }`}
              >
                Key Factors
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {tab === "breakdown" && (
                <div className="space-y-6">
                  {/* Score Summary */}
                  <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl p-6 border border-indigo-100">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-gray-600 text-sm font-medium">
                          Current Score
                        </p>
                        <p className="text-5xl font-bold text-indigo-600 mt-1">
                          {formatScore(explanation.current_score)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-gray-600 text-sm">Loan Tier</p>
                        <p className="text-2xl font-bold text-indigo-600 capitalize mt-1">
                          {explanation.tier}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-gray-600">Interest Rate</p>
                        <p className="font-semibold text-gray-800">
                          {explanation.interest_rate}%
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Max Loan Amount</p>
                        <p className="font-semibold text-gray-800">
                          ₹{explanation.max_loan_amount.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Components */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Score Components
                    </h3>
                    <div className="space-y-3">
                      {[
                        "base_points",
                        "recency_points",
                        "consistency_bonus",
                      ].map((key) => (
                        <div
                          key={key}
                          className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <p className="font-medium text-gray-900 capitalize">
                              {key.replace(/_/g, " ")}
                            </p>
                            <p className="text-lg font-bold text-indigo-600">
                              {formatScore(explanation.components.values[key])}
                            </p>
                          </div>
                          <p className="text-sm text-gray-600">
                            {explanation.components.description[key]}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recent Activities */}
                  {explanation.recent_activities?.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        Recent Verified Activities
                      </h3>
                      <div className="space-y-2">
                        {explanation.recent_activities
                          .slice(0, 5)
                          .map((act) => (
                            <div
                              key={act.id}
                              className="bg-gray-50 rounded-lg p-3 border border-gray-200 flex items-start gap-3"
                            >
                              <div className="w-2 h-2 bg-green-500 rounded-full mt-1.5 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900">
                                  {act.category}
                                </p>
                                <p className="text-xs text-gray-600">
                                  {act.description}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                  {new Date(
                                    act.verified_at,
                                  ).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {tab === "trajectory" && (
                <div>
                  <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200 flex gap-3">
                    <TrendingUp className="text-blue-600 flex-shrink-0" />
                    <p className="text-sm text-blue-900">
                      Score snapshots from last 90 days. More recent activities
                      increase your score through recency factors.
                    </p>
                  </div>

                  {trajectory?.trajectory?.length > 0 ? (
                    <div className="space-y-3">
                      {trajectory.trajectory
                        .slice()
                        .reverse()
                        .map((entry, idx) => (
                          <div
                            key={idx}
                            className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <p className="font-medium text-gray-900">
                                Score:{" "}
                                <span className="text-indigo-600">
                                  {formatScore(entry.score)}
                                </span>
                              </p>
                              <p className="text-xs text-gray-600">
                                {new Date(entry.synced_at).toLocaleDateString()}
                              </p>
                            </div>
                            {entry.trend_label && (
                              <p className="text-sm text-gray-700">
                                {entry.trend_label}
                              </p>
                            )}
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No score history available yet
                    </div>
                  )}
                </div>
              )}

              {tab === "factors" && (
                <div className="space-y-4">
                  {Object.entries(explanation.key_factors || {}).map(
                    ([key, desc]) => (
                      <div
                        key={key}
                        className="bg-amber-50 rounded-lg p-4 border border-amber-200 flex gap-3"
                      >
                        <Zap className="text-amber-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-gray-900 capitalize">
                            {key.replace(/_/g, " ")}
                          </p>
                          <p className="text-sm text-gray-700 mt-1">{desc}</p>
                        </div>
                      </div>
                    ),
                  )}

                  <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200 flex gap-3 mt-6">
                    <AlertCircle className="text-indigo-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-gray-900">Model Version</p>
                      <p className="text-sm text-gray-700 mt-1">
                        Your score uses{" "}
                        <span className="font-mono font-semibold">
                          {explanation.model_version}
                        </span>
                        . This version locks once set and ensures consistent
                        evaluation across your account lifecycle.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
