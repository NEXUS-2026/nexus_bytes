import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../utils/api";

const STATUS_COLORS = {
  verified: "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700",
  rejected: "bg-red-100 text-red-700",
};

export default function ActivityHistory() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/activity")
      .then(({ data }) => setActivities(data))
      .catch(() => setActivities([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="text-center py-20 text-gray-400">
        Loading activities...
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Activities</h1>
        <Link
          to="/submit-activity"
          className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
        >
          Submit New
        </Link>
      </div>

      {activities.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center text-gray-400">
          No activities yet.
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-50">
            {activities.map((a) => (
              <div
                key={a.id}
                className="px-6 py-4 flex items-start justify-between gap-4"
              >
                <div>
                  <p className="font-medium text-gray-900">{a.title}</p>
                  <p className="text-xs text-gray-400 capitalize mt-1">
                    {a.category}
                  </p>
                  {a.description && (
                    <p className="text-sm text-gray-500 mt-2">
                      {a.description}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-2">
                    {new Date(a.created_at).toLocaleString()}
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
        </div>
      )}
    </div>
  );
}
