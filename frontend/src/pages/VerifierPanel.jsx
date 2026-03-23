import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import api from "../utils/api";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  ExternalLink,
  Filter,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react";

const CAT_COLORS = {
  health: "bg-pink-50 text-pink-700",
  education: "bg-blue-50 text-blue-700",
  sustainability: "bg-green-50 text-green-700",
};

const STATUS_COLORS = {
  verified: "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700",
  rejected: "bg-red-100 text-red-700",
};

function hoursSince(dateInput) {
  if (!dateInput) return null;
  const diffMs = Date.now() - new Date(dateInput).getTime();
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60)));
}

export default function VerifierPanel() {
  const [pending, setPending] = useState([]);
  const [allActivities, setAllActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [docLoadingId, setDocLoadingId] = useState(null);
  const [rejectId, setRejectId] = useState(null);
  const [noteById, setNoteById] = useState({});

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [docFilter, setDocFilter] = useState("all");

  const load = async () => {
    try {
      const [p, a] = await Promise.all([
        api.get("/verify/pending"),
        api.get("/activity"),
      ]);
      setPending(p.data || []);
      setAllActivities(a.data || []);
    } catch {
      toast.error("Failed to load verifier data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const approve = async (id) => {
    setProcessing(id);
    try {
      const { data } = await api.post("/verify", {
        activity_id: id,
        action: "approve",
      });
      toast.success(
        `Approved${data.txHash ? ` · Tx ${data.txHash.slice(0, 10)}...` : ""}`,
      );
      setPending((prev) => prev.filter((a) => a.id !== id));
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || "Approval failed");
    } finally {
      setProcessing(null);
    }
  };

  const reject = async (id) => {
    const note = (noteById[id] || "").trim();
    if (!note) {
      toast.error("Please enter a rejection reason");
      return;
    }

    setProcessing(id);
    try {
      await api.post("/verify", {
        activity_id: id,
        action: "reject",
        rejection_note: note,
      });
      toast.success("Activity rejected");
      setPending((prev) => prev.filter((a) => a.id !== id));
      setRejectId(null);
      setNoteById((prev) => ({ ...prev, [id]: "" }));
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || "Rejection failed");
    } finally {
      setProcessing(null);
    }
  };

  const hasDocument = (activity) =>
    Boolean(activity.document_url || activity.ipfs_hash);

  const fileNameFromDisposition = (headerValue, fallbackName) => {
    if (!headerValue) return fallbackName;
    const match = /filename=\"?([^\";]+)\"?/i.exec(headerValue);
    return match?.[1] || fallbackName;
  };

  const openBlobInNewTab = (blob) => {
    const objectUrl = URL.createObjectURL(blob);
    window.open(objectUrl, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  };

  const saveBlob = (blob, fileName) => {
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  };

  const viewDocument = async (activity) => {
    if (activity.document_url && /^https?:\/\//i.test(activity.document_url)) {
      window.open(activity.document_url, "_blank", "noopener,noreferrer");
      return;
    }

    if (!activity.document_url && activity.ipfs_hash) {
      const gatewayBase =
        process.env.REACT_APP_IPFS_GATEWAY_BASE ||
        "https://gateway.pinata.cloud/ipfs";
      const url = `${gatewayBase.replace(/\/$/, "")}/${activity.ipfs_hash}`;
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }

    setDocLoadingId(activity.id);
    try {
      const response = await api.get(`/activity/${activity.id}/document`, {
        responseType: "blob",
      });
      openBlobInNewTab(response.data);
    } catch (err) {
      toast.error(err.response?.data?.error || "Unable to open document");
    } finally {
      setDocLoadingId(null);
    }
  };

  const downloadDocument = async (activity) => {
    if (activity.document_url && /^https?:\/\//i.test(activity.document_url)) {
      const link = document.createElement("a");
      link.href = activity.document_url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.click();
      return;
    }

    if (!activity.document_url && activity.ipfs_hash) {
      const gatewayBase =
        process.env.REACT_APP_IPFS_GATEWAY_BASE ||
        "https://gateway.pinata.cloud/ipfs";
      const link = document.createElement("a");
      link.href = `${gatewayBase.replace(/\/$/, "")}/${activity.ipfs_hash}`;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.click();
      return;
    }

    setDocLoadingId(activity.id);
    try {
      const response = await api.get(
        `/activity/${activity.id}/document?download=true`,
        {
          responseType: "blob",
        },
      );
      const filename = fileNameFromDisposition(
        response.headers["content-disposition"],
        `${activity.title || "activity-document"}.bin`,
      );
      saveBlob(response.data, filename);
    } catch (err) {
      toast.error(err.response?.data?.error || "Unable to download document");
    } finally {
      setDocLoadingId(null);
    }
  };

  const stats = useMemo(() => {
    const reviewedCount = allActivities.filter(
      (a) => a.status === "verified" || a.status === "rejected",
    ).length;
    const rejectedCount = allActivities.filter(
      (a) => a.status === "rejected",
    ).length;

    const todayStr = new Date().toDateString();
    const todayVerified = allActivities.filter(
      (a) =>
        a.status === "verified" &&
        a.verified_at &&
        new Date(a.verified_at).toDateString() === todayStr,
    ).length;

    const avgWaitHours = pending.length
      ? Math.round(
          pending.reduce((sum, a) => sum + (hoursSince(a.created_at) || 0), 0) /
            pending.length,
        )
      : 0;

    return {
      queue: pending.length,
      reviewedCount,
      todayVerified,
      rejectionRate: reviewedCount
        ? Math.round((rejectedCount / reviewedCount) * 100)
        : 0,
      avgWaitHours,
    };
  }, [allActivities, pending]);

  const filteredPending = useMemo(() => {
    const q = search.trim().toLowerCase();

    return pending
      .filter((a) => {
        const matchesSearch =
          !q ||
          (a.title || "").toLowerCase().includes(q) ||
          (a.full_name || "").toLowerCase().includes(q) ||
          (a.email || "").toLowerCase().includes(q);

        const matchesCategory = category === "all" || a.category === category;
        const hasDoc = hasDocument(a);
        const matchesDoc =
          docFilter === "all" ||
          (docFilter === "hasDoc" && hasDoc) ||
          (docFilter === "noDoc" && !hasDoc);

        return matchesSearch && matchesCategory && matchesDoc;
      })
      .sort(
        (a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0),
      );
  }, [pending, search, category, docFilter]);

  const recentDecisions = useMemo(() => {
    return allActivities
      .filter((a) => a.status === "verified" || a.status === "rejected")
      .sort(
        (a, b) =>
          new Date(b.verified_at || b.updated_at || 0) -
          new Date(a.verified_at || a.updated_at || 0),
      )
      .slice(0, 6);
  }, [allActivities]);

  if (loading)
    return <div className="text-center py-20 text-gray-400">Loading...</div>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Verifier Dashboard
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Validate activities, manage queue aging, and keep decisions
            consistent.
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-indigo-600 border border-gray-200 px-3 py-2 rounded-lg"
        >
          <Clock size={14} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <StatCard label="Pending Queue" value={stats.queue} tone="amber" />
        <StatCard
          label="Total Reviewed"
          value={stats.reviewedCount}
          tone="indigo"
        />
        <StatCard
          label="Verified Today"
          value={stats.todayVerified}
          tone="green"
        />
        <StatCard
          label="Avg Wait"
          value={`${stats.avgWaitHours}h`}
          tone="blue"
        />
        <StatCard
          label="Rejection Rate"
          value={`${stats.rejectionRate}%`}
          tone="red"
        />
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 mb-4">
        <div className="grid md:grid-cols-4 gap-3">
          <label className="md:col-span-2 flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2">
            <Search size={15} className="text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, borrower name, email"
              className="w-full outline-none text-sm"
            />
          </label>

          <label className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2">
            <Filter size={14} className="text-gray-400" />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full text-sm outline-none bg-transparent"
            >
              <option value="all">All categories</option>
              <option value="health">Health</option>
              <option value="education">Education</option>
              <option value="sustainability">Sustainability</option>
            </select>
          </label>

          <label className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2">
            <ShieldCheck size={14} className="text-gray-400" />
            <select
              value={docFilter}
              onChange={(e) => setDocFilter(e.target.value)}
              className="w-full text-sm outline-none bg-transparent"
            >
              <option value="all">All evidence</option>
              <option value="hasDoc">Has document</option>
              <option value="noDoc">No document</option>
            </select>
          </label>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">
                Verification Queue
              </h3>
              <span className="text-xs text-gray-500">
                {filteredPending.length} items
              </span>
            </div>

            {filteredPending.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <CheckCircle
                  size={36}
                  className="mx-auto mb-3 text-green-300"
                />
                Queue is clear for current filters.
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {filteredPending.map((a) => {
                  const documentAvailable = hasDocument(a);
                  const waitHours = hoursSince(a.created_at);
                  const note = noteById[a.id] || "";

                  return (
                    <div key={a.id} className="px-6 py-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${CAT_COLORS[a.category] || "bg-gray-100 text-gray-600"}`}
                            >
                              {a.category}
                            </span>
                            <span className="text-xs text-gray-400">
                              #{a.id}
                            </span>
                            {waitHours !== null && waitHours > 48 && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600">
                                Aging: {waitHours}h
                              </span>
                            )}
                          </div>

                          <p className="font-semibold text-gray-900">
                            {a.title}
                          </p>
                          {a.description && (
                            <p className="text-sm text-gray-500 mt-1">
                              {a.description}
                            </p>
                          )}

                          <p className="text-xs text-gray-400 mt-2">
                            Borrower:{" "}
                            <span className="font-medium text-gray-600">
                              {a.full_name || "Unknown"}
                            </span>
                            {a.email ? ` (${a.email})` : ""}
                          </p>

                          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 flex-wrap">
                            <span>
                              Submitted:{" "}
                              {new Date(a.created_at).toLocaleString()}
                            </span>
                            {a.data_hash && (
                              <span className="font-mono">
                                Hash: {a.data_hash.slice(0, 18)}...
                              </span>
                            )}
                            <span
                              className={`px-2 py-0.5 rounded-full ${documentAvailable ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-500"}`}
                            >
                              {documentAvailable
                                ? "Document available"
                                : "No document"}
                            </span>
                          </div>
                        </div>

                        <div className="flex gap-2 shrink-0">
                          {documentAvailable && (
                            <>
                              <button
                                type="button"
                                onClick={() => viewDocument(a)}
                                disabled={docLoadingId === a.id}
                                className="flex items-center gap-1 text-xs border border-gray-200 px-3 py-2 rounded-lg hover:border-indigo-400 transition"
                              >
                                <ExternalLink size={12} />
                                {docLoadingId === a.id
                                  ? "Opening..."
                                  : "Document"}
                              </button>
                              <button
                                type="button"
                                onClick={() => downloadDocument(a)}
                                disabled={docLoadingId === a.id}
                                className="flex items-center gap-1 text-xs border border-blue-200 text-blue-700 px-3 py-2 rounded-lg hover:bg-blue-50 transition"
                              >
                                {docLoadingId === a.id ? "..." : "Download"}
                              </button>
                            </>
                          )}

                          {rejectId !== a.id && (
                            <>
                              <button
                                onClick={() => setRejectId(a.id)}
                                className="flex items-center gap-1 text-xs border border-red-200 text-red-600 px-3 py-2 rounded-lg hover:bg-red-50 transition"
                              >
                                <XCircle size={14} /> Reject
                              </button>
                              <button
                                onClick={() => approve(a.id)}
                                disabled={processing === a.id}
                                className="flex items-center gap-1 text-xs bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
                              >
                                <CheckCircle size={14} />{" "}
                                {processing === a.id
                                  ? "Processing..."
                                  : "Approve"}
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {rejectId === a.id && (
                        <div className="mt-4 flex gap-2">
                          <input
                            placeholder="Rejection reason..."
                            value={note}
                            onChange={(e) =>
                              setNoteById((prev) => ({
                                ...prev,
                                [a.id]: e.target.value,
                              }))
                            }
                            className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-400"
                          />
                          <button
                            onClick={() => reject(a.id)}
                            disabled={processing === a.id}
                            className="text-xs bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
                          >
                            {processing === a.id ? "..." : "Confirm"}
                          </button>
                          <button
                            onClick={() => {
                              setRejectId(null);
                              setNoteById((prev) => ({ ...prev, [a.id]: "" }));
                            }}
                            className="text-xs border border-gray-200 px-3 py-2 rounded-lg"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50">
              <h3 className="font-semibold text-gray-800">Recent Decisions</h3>
              <p className="text-xs text-gray-500 mt-1">
                Latest verified or rejected activities
              </p>
            </div>

            {recentDecisions.length === 0 ? (
              <p className="text-sm text-gray-400 px-5 py-8">
                No decisions yet.
              </p>
            ) : (
              <div className="divide-y divide-gray-50">
                {recentDecisions.map((a) => (
                  <div key={`decision-${a.id}`} className="px-5 py-4">
                    <p className="text-sm font-medium text-gray-800 line-clamp-1">
                      {a.title}
                    </p>
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[a.status] || "bg-gray-100 text-gray-600"}`}
                      >
                        {a.status}
                      </span>
                      <span className="text-xs text-gray-400 capitalize">
                        {a.category}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(
                        a.verified_at || a.updated_at || a.created_at,
                      ).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="text-amber-600 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">
                  Verification quality tip
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  Add clear rejection notes to reduce re-submissions and improve
                  queue turnaround.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, tone }) {
  const tones = {
    amber: "text-amber-600",
    indigo: "text-indigo-600",
    green: "text-green-600",
    blue: "text-blue-600",
    red: "text-red-600",
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
