// src/pages/AdminPanel.jsx
import React, { useEffect, useState } from "react";
import api from "../utils/api";
import { Users, Activity, Coins, TrendingUp } from "lucide-react";

export default function AdminPanel() {
  const [users,       setUsers]      = useState([]);
  const [activities,  setActivities] = useState([]);
  const [loans,       setLoans]      = useState([]);
  const [tab,         setTab]        = useState("users");
  const [loading,     setLoading]    = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/activity"),
      api.get("/loan/status"),
    ]).then(([a, l]) => {
      setActivities(a.data);
      setLoans(l.data);
    }).finally(() => setLoading(false));
  }, []);

  const stats = [
    { label: "Total Activities", value: activities.length,                          icon: <Activity size={18} />, color: "indigo" },
    { label: "Verified",         value: activities.filter(a=>a.status==="verified").length, icon: <TrendingUp size={18} />, color: "green" },
    { label: "Total Loans",      value: loans.length,                               icon: <Coins size={18} />, color: "amber" },
    { label: "Approved Loans",   value: loans.filter(l=>l.status==="approved").length, icon: <Users size={18} />, color: "teal" },
  ];

  const catColor = { health: "bg-pink-50 text-pink-700", education: "bg-blue-50 text-blue-700", sustainability: "bg-green-50 text-green-700" };
  const statusColor = { verified: "bg-green-100 text-green-700", pending: "bg-yellow-100 text-yellow-700", rejected: "bg-red-100 text-red-700", approved: "bg-green-100 text-green-700" };
  const colors = { indigo: "bg-indigo-50 text-indigo-600", green: "bg-green-50 text-green-600", amber: "bg-amber-50 text-amber-600", teal: "bg-teal-50 text-teal-600" };

  if (loading) return <div className="text-center py-20 text-gray-400">Loading…</div>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Admin Panel</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <div key={s.label} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${colors[s.color]}`}>{s.icon}</div>
            <div className="text-2xl font-bold text-gray-900">{s.value}</div>
            <div className="text-sm text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {["activities", "loans"].map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`text-sm px-4 py-2 rounded-lg font-medium capitalize transition
              ${tab === t ? "bg-indigo-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-indigo-300"}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Activities table */}
      {tab === "activities" && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs font-medium">
              <tr>
                {["ID", "User", "Title", "Category", "Status", "Submitted"].map((h) => (
                  <th key={h} className="px-5 py-3 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {activities.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 text-gray-400">#{a.id}</td>
                  <td className="px-5 py-3 font-medium text-gray-700">{a.user_name || a.user_email}</td>
                  <td className="px-5 py-3 text-gray-700">{a.title}</td>
                  <td className="px-5 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${catColor[a.category] || ""}`}>{a.category}</span></td>
                  <td className="px-5 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[a.status] || ""}`}>{a.status}</span></td>
                  <td className="px-5 py-3 text-gray-400">{new Date(a.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Loans table */}
      {tab === "loans" && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs font-medium">
              <tr>
                {["ID", "User", "Amount", "Approved", "Tier", "Rate", "Status"].map((h) => (
                  <th key={h} className="px-5 py-3 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loans.map((l) => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 text-gray-400">#{l.id}</td>
                  <td className="px-5 py-3 font-medium text-gray-700">{l.full_name || l.email}</td>
                  <td className="px-5 py-3">${Number(l.amount).toLocaleString()}</td>
                  <td className="px-5 py-3">{l.approved_amount ? `$${Number(l.approved_amount).toLocaleString()}` : "—"}</td>
                  <td className="px-5 py-3 capitalize">{l.tier}</td>
                  <td className="px-5 py-3">{l.interest_rate}%</td>
                  <td className="px-5 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[l.status] || ""}`}>{l.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
