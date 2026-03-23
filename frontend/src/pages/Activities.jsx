import React, { useEffect, useState } from "react";
import api from "../utils/api";

const STATUS_COLORS = {
  verified: "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700",
  rejected: "bg-red-100 text-red-700",
};

export default function Activities() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get("/activity");
        setItems(data || []);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = items.filter((a) => (filter === "all" ? true : a.status === filter));

  if (loading) return <div className="text-center py-20 text-gray-400">Loading...</div>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold text-gray-900">All Activities</h1>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2"
        >
          <option value="all">All</option>
          <option value="verified">Verified</option>
          <option value="pending">Pending</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No activities found.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => (
            <div key={a.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-gray-900">{a.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5 capitalize">{a.category}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[a.status] || "bg-gray-100 text-gray-600"}`}>
                  {a.status}
                </span>
              </div>
              {a.description && <p className="text-sm text-gray-500 mt-2">{a.description}</p>}
              <p className="text-xs text-gray-400 mt-2">{new Date(a.created_at).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
