import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import api from "../utils/api";
import { ShieldCheck, UploadCloud } from "lucide-react";

const DOC_TYPES = [
  { id: "aadhaar", label: "Aadhaar" },
  { id: "passport", label: "Passport" },
  { id: "drivers_license", label: "Driver License" },
  { id: "voter_id", label: "Voter ID" },
  { id: "other", label: "Other" },
];

export default function BorrowerKYC() {
  const [status, setStatus] = useState("pending");
  const [latest, setLatest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [file, setFile] = useState(null);
  const [form, setForm] = useState({
    document_type: "aadhaar",
    document_number: "",
    notes: "",
  });

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/auth/kyc/status");
      setStatus(data.kyc_status || "pending");
      setLatest(data.latestSubmission || null);
    } catch {
      toast.error("Failed to load KYC status");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.document_number.trim()) {
      toast.error("Document number is required");
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("document_type", form.document_type);
      fd.append("document_number", form.document_number.trim());
      fd.append("notes", form.notes.trim());
      if (file) fd.append("document", file);

      const { data } = await api.post("/auth/kyc/submit", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success(data.message || "KYC submitted");
      setFile(null);
      setForm((f) => ({ ...f, notes: "", document_number: "" }));
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to submit KYC");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="text-center py-20 text-gray-400">Loading...</div>;

  const canSubmit = !(latest && latest.status === "pending");

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Borrower KYC</h1>
        <p className="text-sm text-gray-500 mt-1">
          Optional KYC can improve lender confidence and loan approval chances.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className={`h-5 w-5 ${status === "approved" ? "text-green-600" : status === "rejected" ? "text-red-600" : "text-amber-600"}`} />
          <p className="text-sm">
            Current KYC status: <span className={`font-semibold capitalize ${status === "approved" ? "text-green-700" : status === "rejected" ? "text-red-700" : "text-amber-700"}`}>{status}</span>
          </p>
        </div>

        {latest && (
          <div className="mt-3 text-xs text-gray-500 space-y-1">
            <p>Latest submission: {new Date(latest.created_at).toLocaleString()}</p>
            <p>Document type: <span className="uppercase">{latest.document_type}</span></p>
            <p>Review note: {latest.review_note || "Pending review"}</p>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        {!canSubmit && (
          <div className="text-sm rounded-lg border border-amber-200 bg-amber-50 text-amber-700 px-3 py-2">
            You already have a pending KYC submission. Wait for review before sending a new one.
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Document Type</label>
            <select
              value={form.document_type}
              onChange={(e) => setForm((f) => ({ ...f, document_type: e.target.value }))}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
              disabled={!canSubmit}
            >
              {DOC_TYPES.map((d) => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Document Number</label>
            <input
              value={form.document_number}
              onChange={(e) => setForm((f) => ({ ...f, document_number: e.target.value }))}
              placeholder="Enter ID number"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
              disabled={!canSubmit}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Notes (optional)</label>
          <textarea
            rows={3}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Any supporting context for reviewer"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none"
            disabled={!canSubmit}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Document Upload (optional)</label>
          <label className={`flex items-center gap-3 border border-dashed rounded-lg px-3 py-4 cursor-pointer ${canSubmit ? "border-indigo-300 bg-indigo-50" : "border-gray-200 bg-gray-50 cursor-not-allowed"}`}>
            <UploadCloud size={16} className="text-indigo-500" />
            <span className="text-xs text-gray-600">{file ? file.name : "Upload proof document (image/pdf, max 10MB)"}</span>
            <input
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              disabled={!canSubmit}
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={submitting || !canSubmit}
          className="bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {submitting ? "Submitting..." : "Submit KYC"}
        </button>
      </form>
    </div>
  );
}
