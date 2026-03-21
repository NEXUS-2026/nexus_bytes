// src/pages/VerifierPanel.jsx
import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import api from "../utils/api";
import { CheckCircle, XCircle, ExternalLink, Clock } from "lucide-react";

export default function VerifierPanel() {
  const [activities, setActivities] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [processing, setProcessing] = useState(null);
  const [note,       setNote]       = useState("");
  const [rejectId,   setRejectId]   = useState(null);

  const load = async () => {
    try {
      const { data } = await api.get("/verify/pending");
      setActivities(data);
    } catch { toast.error("Failed to load activities"); }
    finally  { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const approve = async (id) => {
    setProcessing(id);
    try {
      const { data } = await api.post("/verify", { activity_id: id, action: "approve" });
      toast.success(`Approved! Tx: ${data.txHash ? data.txHash.slice(0, 10) + "…" : "recorded"}`);
      setActivities((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      toast.error(err.response?.data?.error || "Approval failed");
    } finally { setProcessing(null); }
  };

  const reject = async (id) => {
    if (!note.trim()) return toast.error("Please enter a rejection reason");
    setProcessing(id);
    try {
      await api.post("/verify", { activity_id: id, action: "reject", rejection_note: note });
      toast.success("Activity rejected");
      setActivities((prev) => prev.filter((a) => a.id !== id));
      setRejectId(null);
      setNote("");
    } catch (err) {
      toast.error(err.response?.data?.error || "Rejection failed");
    } finally { setProcessing(null); }
  };

  const catColors = {
    health:         "bg-pink-50 text-pink-700",
    education:      "bg-blue-50 text-blue-700",
    sustainability: "bg-green-50 text-green-700",
  };

  if (loading) return <div className="text-center py-20 text-gray-400">Loading…</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Clock size={22} className="text-amber-500" />
        <h1 className="text-2xl font-bold text-gray-900">Pending Verifications</h1>
        <span className="bg-amber-100 text-amber-700 text-xs font-medium px-2.5 py-1 rounded-full">
          {activities.length}
        </span>
      </div>

      {activities.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <CheckCircle size={40} className="mx-auto mb-3 text-green-300" />
          All caught up! No pending activities.
        </div>
      ) : (
        <div className="space-y-4">
          {activities.map((a) => (
            <div key={a.id} className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-6 py-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${catColors[a.category] || "bg-gray-100 text-gray-600"}`}>
                        {a.category}
                      </span>
                      <span className="text-xs text-gray-400">#{a.id}</span>
                    </div>
                    <h3 className="font-semibold text-gray-900">{a.title}</h3>
                    {a.description && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{a.description}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-2">
                      By <span className="font-medium">{a.full_name}</span> ({a.email})
                      {a.wallet_address && (
                        <span className="ml-2 font-mono">{a.wallet_address.slice(0, 10)}…</span>
                      )}
                    </p>
                    {a.data_hash && (
                      <p className="text-xs text-gray-300 font-mono mt-1">Hash: {a.data_hash.slice(0, 20)}…</p>
                    )}
                  </div>

                  {/* Actions */}
                  {rejectId !== a.id && (
                    <div className="flex gap-2 shrink-0">
                      {a.ipfs_hash && (
                        <a href={`https://gateway.pinata.cloud/ipfs/${a.ipfs_hash}`}
                          target="_blank" rel="noreferrer"
                          className="flex items-center gap-1 text-xs border border-gray-200 px-3 py-2 rounded-lg hover:border-indigo-400 transition">
                          <ExternalLink size={12} /> Document
                        </a>
                      )}
                      <button
                        onClick={() => setRejectId(a.id)}
                        className="flex items-center gap-1 text-xs border border-red-200 text-red-600 px-3 py-2 rounded-lg hover:bg-red-50 transition">
                        <XCircle size={14} /> Reject
                      </button>
                      <button
                        onClick={() => approve(a.id)}
                        disabled={processing === a.id}
                        className="flex items-center gap-1 text-xs bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 transition">
                        <CheckCircle size={14} /> {processing === a.id ? "…" : "Approve"}
                      </button>
                    </div>
                  )}
                </div>

                {/* Reject form */}
                {rejectId === a.id && (
                  <div className="mt-4 flex gap-2">
                    <input
                      placeholder="Rejection reason…"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-400"
                    />
                    <button
                      onClick={() => reject(a.id)}
                      disabled={processing === a.id}
                      className="text-xs bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50">
                      {processing === a.id ? "…" : "Confirm"}
                    </button>
                    <button onClick={() => { setRejectId(null); setNote(""); }}
                      className="text-xs border border-gray-200 px-3 py-2 rounded-lg">
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
