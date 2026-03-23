import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  Phone,
  FileText,
  DollarSign,
  Clock,
  CheckCircle,
} from "lucide-react";
import api from "../utils/api";
import { formatINR } from "../utils/currency";

export default function DefaultManagement() {
  const [stats, setStats] = useState(null);
  const [defaults, setDefaults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDefault, setSelectedDefault] = useState(null);

  useEffect(() => {
    loadDefaults();
  }, []);

  const loadDefaults = async () => {
    try {
      const res = await api.get("/default/status");
      setStats(res.data.stats);
      setDefaults(res.data.defaults);
    } catch (err) {
      console.error("Error loading defaults:", err);
    } finally {
      setLoading(false);
    }
  };

  const getStageColor = (stage) => {
    const colors = {
      "0-30": "bg-amber-50 text-amber-700 border-amber-300",
      "30-60": "bg-orange-50 text-orange-700 border-orange-300",
      "60-90": "bg-red-50 text-red-700 border-red-300",
      "90+": "bg-red-100 text-red-800 border-red-400",
    };
    return colors[stage] || "bg-gray-50";
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Loan Default Management
        </h1>
        <p className="text-gray-600 mt-2">
          Track and manage overdue loans and recovery actions
        </p>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <p className="text-gray-600 text-sm">Active Defaults</p>
            <p className="text-4xl font-bold text-red-600 mt-2">
              {stats.total_active_defaults}
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <p className="text-gray-600 text-sm">Capital At Risk</p>
            <p className="text-2xl font-bold text-red-600 mt-2">
              {formatINR(stats.total_amount_at_risk)}
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <p className="text-gray-600 text-sm">30+ Days Overdue</p>
            <p className="text-4xl font-bold text-orange-600 mt-2">
              {(stats.by_delinquency_stage["30-60"] || 0) +
                (stats.by_delinquency_stage["60-90"] || 0) +
                (stats.by_delinquency_stage["90+"] || 0)}
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <p className="text-gray-600 text-sm">Critical (90+ Days)</p>
            <p className="text-4xl font-bold text-red-800 mt-2">
              {stats.by_delinquency_stage["90+"] || 0}
            </p>
          </div>
        </div>
      )}

      {/* Delinquency Breakdown */}
      {stats && (
        <div className="grid md:grid-cols-5 gap-3 mb-8">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-xs text-amber-700 font-semibold">0-30 Days</p>
            <p className="text-2xl font-bold text-amber-700 mt-2">
              {stats.by_delinquency_stage["0-30"] || 0}
            </p>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <p className="text-xs text-orange-700 font-semibold">30-60 Days</p>
            <p className="text-2xl font-bold text-orange-700 mt-2">
              {stats.by_delinquency_stage["30-60"] || 0}
            </p>
          </div>
          <div className="bg-red-50 border border-red-300 rounded-lg p-4">
            <p className="text-xs text-red-700 font-semibold">60-90 Days</p>
            <p className="text-2xl font-bold text-red-700 mt-2">
              {stats.by_delinquency_stage["60-90"] || 0}
            </p>
          </div>
          <div className="bg-red-100 border border-red-400 rounded-lg p-4">
            <p className="text-xs text-red-800 font-semibold">90+ Days</p>
            <p className="text-2xl font-bold text-red-800 mt-2">
              {stats.by_delinquency_stage["90+"] || 0}
            </p>
          </div>
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
            <p className="text-xs text-indigo-700 font-semibold">Total</p>
            <p className="text-2xl font-bold text-indigo-700 mt-2">
              {stats.total_active_defaults}
            </p>
          </div>
        </div>
      )}

      {/* Defaults List */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="font-semibold text-gray-900">Active Defaults</h2>
        </div>

        {defaults.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No active defaults
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {defaults.map((defaultRecord) => (
              <div
                key={defaultRecord.default_id}
                className="p-6 hover:bg-gray-50 transition cursor-pointer"
                onClick={() => setSelectedDefault(defaultRecord)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <AlertTriangle size={18} className="text-red-600" />
                      <p className="font-medium text-gray-900">
                        {defaultRecord.borrower?.full_name ||
                          "Unknown Borrower"}
                      </p>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStageColor(defaultRecord.delinquency_stage)}`}
                      >
                        {defaultRecord.delinquency_stage} days
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm mt-3">
                      <div>
                        <p className="text-gray-600">Days Overdue</p>
                        <p className="font-semibold text-gray-900 mt-0.5">
                          {defaultRecord.days_overdue}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Amount Outstanding</p>
                        <p className="font-semibold text-gray-900 mt-0.5">
                          {formatINR(defaultRecord.amount_outstanding)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Actions Taken</p>
                        <p className="font-semibold text-gray-900 mt-0.5">
                          {defaultRecord.recovery_actions_taken}
                        </p>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedDefault(defaultRecord);
                    }}
                    className="px-4 py-2 bg-red-50 text-red-600 rounded-lg font-medium hover:bg-red-100 transition"
                  >
                    Manage
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Management Modal */}
      {selectedDefault && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-red-600 to-red-700 text-white p-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">Default Management</h2>
                <p className="text-red-100 text-sm mt-1">
                  {selectedDefault.borrower?.full_name || "Unknown Borrower"}
                </p>
              </div>
              <button
                onClick={() => setSelectedDefault(null)}
                className="text-white hover:bg-red-500 p-2 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Status */}
              <div className="bg-red-50 border border-red-300 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-red-900 mb-1">
                      {selectedDefault.days_overdue} Days Overdue
                    </p>
                    <p className="text-sm text-red-700">
                      Outstanding:{" "}
                      {formatINR(selectedDefault.amount_outstanding)}
                    </p>
                  </div>
                  <span
                    className={`px-4 py-2 rounded-lg font-bold border ${getStageColor(selectedDefault.delinquency_stage)}`}
                  >
                    {selectedDefault.delinquency_stage}
                  </span>
                </div>
              </div>

              {/* Recovery Actions Taken */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">
                  Recovery Actions
                </h3>
                <div className="space-y-2">
                  {selectedDefault.recovery_actions_taken > 0 ? (
                    <p className="text-sm text-gray-600">
                      {selectedDefault.recovery_actions_taken} action(s) taken
                      so far
                    </p>
                  ) : (
                    <p className="text-sm text-gray-500 italic">
                      No actions recorded yet
                    </p>
                  )}
                </div>
              </div>

              {/* Action Options */}
              <div className="pt-4 border-t border-gray-200 space-y-2">
                <button className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition">
                  <Phone size={18} />
                  Log Reminder Call
                </button>
                <button className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition">
                  <FileText size={18} />
                  Send Legal Notice
                </button>
                <button className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition">
                  <CheckCircle size={18} />
                  Mark Settled
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
