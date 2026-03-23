import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  TrendingUp,
  Activity,
  Users,
  Search,
} from "lucide-react";
import api from "../utils/api";

export default function FraudAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [riskDetails, setRiskDetails] = useState(null);

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    try {
      const res = await api.get("/fraud/alerts");
      setAlerts(res.data.high_risk_borrowers || []);
    } catch (err) {
      console.error("Error loading fraud alerts:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadRiskDetails = async (userId) => {
    setDetailsLoading(true);
    try {
      const res = await api.get(`/fraud/check/${userId}`);
      setRiskDetails(res.data);
    } catch (err) {
      console.error("Error loading risk details:", err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const getRiskColor = (score) => {
    if (score > 80) return "bg-red-100 text-red-700 border-red-300";
    if (score > 60) return "bg-orange-100 text-orange-700 border-orange-300";
    if (score > 40) return "bg-amber-100 text-amber-700 border-amber-300";
    return "bg-yellow-100 text-yellow-700 border-yellow-300";
  };

  const getRiskLabel = (score) => {
    if (score > 80) return "🔴 Critical";
    if (score > 60) return "🟠 High";
    if (score > 40) return "🟡 Medium";
    return "🟢 Low";
  };

  if (loading) {
    return (
      <div className="text-center py-8 text-gray-500">
        Loading fraud alerts...
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Fraud Detection Dashboard
        </h1>
        <p className="text-gray-600 mt-2">
          Monitor suspicious borrower activity patterns
        </p>
      </div>

      {/* Alert Stats */}
      <div className="grid md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="w-10 h-10 rounded-lg bg-red-100 text-red-600 flex items-center justify-center mb-3">
            <AlertTriangle size={20} />
          </div>
          <p className="text-gray-600 text-sm">Critical Risk (≥80)</p>
          <p className="text-4xl font-bold text-red-600 mt-2">
            {alerts.filter((a) => a.risk_score >= 80).length}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="w-10 h-10 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center mb-3">
            <TrendingUp size={20} />
          </div>
          <p className="text-gray-600 text-sm">High Risk (60-80)</p>
          <p className="text-4xl font-bold text-orange-600 mt-2">
            {
              alerts.filter((a) => a.risk_score >= 60 && a.risk_score < 80)
                .length
            }
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center mb-3">
            <Activity size={20} />
          </div>
          <p className="text-gray-600 text-sm">Total Alerts</p>
          <p className="text-4xl font-bold text-amber-600 mt-2">
            {alerts.length}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center mb-3">
            <Users size={20} />
          </div>
          <p className="text-gray-600 text-sm">Avg Risk Score</p>
          <p className="text-4xl font-bold text-indigo-600 mt-2">
            {alerts.length > 0
              ? (
                  alerts.reduce((sum, a) => sum + a.risk_score, 0) /
                  alerts.length
                ).toFixed(0)
              : 0}
          </p>
        </div>
      </div>

      {/* Alerts List */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="font-semibold text-gray-900">High-Risk Borrowers</h2>
        </div>

        {alerts.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No fraud alerts detected
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {alerts.map((alert) => (
              <div
                key={alert.user_id}
                className="p-6 hover:bg-gray-50 transition cursor-pointer"
                onClick={() => {
                  setSelectedAlert(alert);
                  loadRiskDetails(alert.user_id);
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <p className="font-medium text-gray-900">
                        User ID: {alert.user_id.slice(0, 8)}...
                      </p>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${getRiskColor(alert.risk_score)}`}
                      >
                        {getRiskLabel(alert.risk_score)} ({alert.risk_score})
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {alert.flags.slice(0, 3).map((flag) => (
                        <span
                          key={flag}
                          className="px-2 py-1 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200"
                        >
                          🚨 {flag}
                        </span>
                      ))}
                      {alert.flags.length > 3 && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-lg">
                          +{alert.flags.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedAlert(alert);
                      loadRiskDetails(alert.user_id);
                    }}
                    className="px-4 py-2 bg-red-50 text-red-600 rounded-lg font-medium hover:bg-red-100 transition"
                  >
                    Investigate
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Details Modal */}
      {selectedAlert && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-red-600 to-red-700 text-white p-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">Fraud Risk Analysis</h2>
                <p className="text-red-100 text-sm mt-1">
                  User: {selectedAlert.user_id.slice(0, 12)}...
                </p>
              </div>
              <button
                onClick={() => setSelectedAlert(null)}
                className="text-white hover:bg-red-500 p-2 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6">
              {detailsLoading ? (
                <div className="text-center py-8 text-gray-500">
                  Loading details...
                </div>
              ) : riskDetails ? (
                <>
                  {/* Risk Score */}
                  <div
                    className={`rounded-lg p-4 border ${getRiskColor(riskDetails.risk_score)}`}
                  >
                    <p className="font-semibold mb-2">
                      Risk Score: {riskDetails.risk_score}/100
                    </p>
                    <p className="text-sm">
                      This borrower shows{" "}
                      {getRiskLabel(riskDetails.risk_score).toLowerCase()} risk
                      patterns
                    </p>
                  </div>

                  {/* Fraud Flags */}
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3">
                      Detected Issues
                    </h3>
                    <div className="space-y-2">
                      {riskDetails.flags.length > 0 ? (
                        riskDetails.flags.map((flag) => (
                          <div
                            key={flag}
                            className="flex items-center gap-2 p-2 bg-red-50 rounded-lg border border-red-200"
                          >
                            <AlertTriangle
                              size={16}
                              className="text-red-600 flex-shrink-0"
                            />
                            <span className="text-sm text-red-700">{flag}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-gray-600">
                          No specific flags detected
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Fraud Check Details */}
                  {riskDetails.checks && (
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-3">
                        Detailed Checks
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between p-2 bg-gray-50 rounded">
                          <span className="text-gray-700">
                            Duplicates Found:
                          </span>
                          <span className="font-medium">
                            {riskDetails.checks.duplicates?.duplicate_count ||
                              0}
                          </span>
                        </div>
                        <div className="flex justify-between p-2 bg-gray-50 rounded">
                          <span className="text-gray-700">
                            Velocity Anomaly:
                          </span>
                          <span className="font-medium">
                            {riskDetails.checks.velocity?.isAnomalous
                              ? "Yes"
                              : "No"}
                          </span>
                        </div>
                        <div className="flex justify-between p-2 bg-gray-50 rounded">
                          <span className="text-gray-700">Collusion Risk:</span>
                          <span className="font-medium">
                            {riskDetails.checks.collusion?.found
                              ? "Detected"
                              : "Clear"}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="pt-4 border-t border-gray-200 space-y-2">
                    <button className="w-full px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition">
                      Block Borrower
                    </button>
                    <button className="w-full px-4 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition">
                      Require Re-Verification
                    </button>
                    <button className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition">
                      Mark as Reviewed
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  Error loading details
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
