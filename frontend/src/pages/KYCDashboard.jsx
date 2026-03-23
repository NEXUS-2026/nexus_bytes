import React, { useEffect, useState } from "react";
import {
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Download,
  ExternalLink,
} from "lucide-react";
import api from "../utils/api";

export default function KYCDashboard() {
  const [pending, setPending] = useState([]);
  const [selectedKYC, setSelectedKYC] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [documentLoadingId, setDocumentLoadingId] = useState(null);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    loadPending();
  }, []);

  const loadPending = async () => {
    try {
      const res = await api.get("/kyc/pending");
      setPending(res.data.pending_kyc_reviews || []);
    } catch (err) {
      console.error("Error loading pending KYC:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (kycId, action, verificationNotes) => {
    setActionLoading(true);
    try {
      const reviewKYC = pending.find((k) => k.kyc_id === kycId);
      const userId = reviewKYC.borrower.id || reviewKYC.borrower._id;

      await api.post(`/kyc/verify/${userId}`, {
        action,
        notes: verificationNotes,
        risk_factors: [],
        risk_score: 30,
        max_loan_amount: 5000,
      });

      await loadPending();
      setSelectedKYC(null);
      setNotes("");
      alert(
        `KYC ${action === "approved" ? "approved" : action.replace(/_/g, " ")} successfully!`,
      );
    } catch (err) {
      console.error("Error verifying KYC:", err);
      alert(`Error: ${err.response?.data?.error || err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const formatDateTime = (value) => {
    if (!value) return "-";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "-";
    return parsed.toLocaleString();
  };

  const getDocumentTypeLabel = (type) => {
    const labels = {
      govt_id: "Government ID",
      address_proof: "Address Proof",
      employment_proof: "Employment Proof",
      bank_statement: "Bank Statement",
      other: "Other Document",
    };
    return labels[type] || type;
  };

  const getDocumentId = (doc) => doc?._id || doc?.id;

  const readFileNameFromDisposition = (headerValue) => {
    if (!headerValue) return null;
    const match = /filename=\"?([^\";]+)\"?/i.exec(headerValue);
    return match?.[1] || null;
  };

  const downloadBlob = (blob, fileName) => {
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  };

  const handleViewDocument = async (doc) => {
    if (doc.file_url && /^https?:\/\//i.test(doc.file_url)) {
      window.open(doc.file_url, "_blank", "noopener,noreferrer");
      return;
    }

    const docId = getDocumentId(doc);
    if (!selectedKYC?.kyc_id || !docId) {
      alert("Unable to open document: invalid document reference");
      return;
    }

    setDocumentLoadingId(docId);
    try {
      const response = await api.get(
        `/kyc/document/${selectedKYC.kyc_id}/${docId}`,
        { responseType: "blob" },
      );
      const objectUrl = URL.createObjectURL(response.data);
      window.open(objectUrl, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (err) {
      console.error("Error opening document:", err);
      alert(
        `Unable to open document: ${err.response?.data?.error || err.message}`,
      );
    } finally {
      setDocumentLoadingId(null);
    }
  };

  const handleDownloadDocument = async (doc) => {
    if (doc.file_url && /^https?:\/\//i.test(doc.file_url)) {
      const link = document.createElement("a");
      link.href = doc.file_url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.click();
      return;
    }

    const docId = getDocumentId(doc);
    if (!selectedKYC?.kyc_id || !docId) {
      alert("Unable to download document: invalid document reference");
      return;
    }

    setDocumentLoadingId(docId);
    try {
      const response = await api.get(
        `/kyc/document/${selectedKYC.kyc_id}/${docId}?download=true`,
        { responseType: "blob" },
      );
      const serverName = readFileNameFromDisposition(
        response.headers["content-disposition"],
      );
      const fallbackName = `${doc.document_type || "document"}-${docId}`;
      downloadBlob(response.data, serverName || fallbackName);
    } catch (err) {
      console.error("Error downloading document:", err);
      alert(
        `Unable to download document: ${err.response?.data?.error || err.message}`,
      );
    } finally {
      setDocumentLoadingId(null);
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          KYC Verification Queue
        </h1>
        <p className="text-gray-600 mt-2">
          Review borrower documents and approve/reject KYC
        </p>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-2 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <p className="text-gray-600 text-sm">Pending Reviews</p>
          <p className="text-4xl font-bold text-amber-600 mt-2">
            {pending.length}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <p className="text-gray-600 text-sm">Total Documents</p>
          <p className="text-4xl font-bold text-blue-600 mt-2">
            {pending.reduce(
              (sum, k) =>
                sum + (k.evidence?.length || k.documents_submitted || 0),
              0,
            )}
          </p>
        </div>
      </div>

      {/* KYC Queue */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="font-semibold text-gray-900">Pending KYC Reviews</h2>
        </div>

        {pending.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No pending KYC reviews
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {pending.map((kyc) => (
              <div
                key={kyc.kyc_id}
                className="p-6 hover:bg-gray-50 transition cursor-pointer"
                onClick={() => setSelectedKYC(kyc)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      {kyc.borrower.full_name}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      {kyc.borrower.email}
                    </p>
                    <div className="flex items-center gap-4 mt-3 text-sm">
                      <span className="flex items-center gap-1 text-indigo-600">
                        <FileText size={16} />
                        {kyc.evidence?.length ||
                          kyc.documents_submitted ||
                          0}{" "}
                        documents
                      </span>
                      <span className="text-gray-500">
                        Submitted: {formatDateTime(kyc.submitted_at)}
                      </span>
                      {kyc.status === "resubmission_required" && (
                        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                          Resubmission Required
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedKYC(kyc);
                    }}
                    className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg font-medium hover:bg-indigo-100 transition"
                  >
                    Review
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Review Modal */}
      {selectedKYC && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white p-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">
                  {selectedKYC.borrower.full_name}
                </h2>
                <p className="text-indigo-100 text-sm mt-1">
                  {selectedKYC.borrower.email}
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedKYC(null);
                  setNotes("");
                }}
                className="text-white hover:bg-indigo-500 p-2 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Documents */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <FileText size={20} />
                  Submitted Documents ({selectedKYC.evidence?.length || 0})
                </h3>
                <div className="space-y-3">
                  {selectedKYC.evidence && selectedKYC.evidence.length > 0 ? (
                    selectedKYC.evidence.map((doc, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <FileText
                            size={20}
                            className="text-indigo-600 flex-shrink-0"
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              {getDocumentTypeLabel(doc.document_type)}
                            </p>
                            <p className="text-xs text-gray-500">
                              Uploaded at {formatDateTime(doc.uploaded_at)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {doc.file_url ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleViewDocument(doc)}
                                disabled={
                                  documentLoadingId === getDocumentId(doc)
                                }
                                className="p-2 bg-indigo-100 text-indigo-600 rounded-lg hover:bg-indigo-200 transition flex items-center gap-1"
                                title="View document in new tab"
                              >
                                <ExternalLink size={16} />
                                <span className="text-xs font-medium">
                                  {documentLoadingId === getDocumentId(doc)
                                    ? "Opening..."
                                    : "View"}
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDownloadDocument(doc)}
                                disabled={
                                  documentLoadingId === getDocumentId(doc)
                                }
                                className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition"
                                title="Download document"
                              >
                                <Download size={16} />
                              </button>
                            </>
                          ) : (
                            <span className="text-xs text-red-600 font-medium">
                              Document URL missing
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 italic">
                      No documents submitted yet
                    </p>
                  )}
                </div>
              </div>

              {/* Verification Notes */}
              <div className="border-t border-gray-200 pt-4">
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Verification Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes about your review decision..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  rows="4"
                />
              </div>

              {/* Actions */}
              <div className="space-y-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() =>
                    handleVerify(
                      selectedKYC.kyc_id,
                      "approved",
                      notes || "Documents verified and approved",
                    )
                  }
                  disabled={actionLoading}
                  className="w-full flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle size={18} />
                  {actionLoading ? "Processing..." : "✓ Approve KYC"}
                </button>
                <button
                  onClick={() =>
                    handleVerify(
                      selectedKYC.kyc_id,
                      "resubmission_requested",
                      notes || "Please resubmit clearer documents",
                    )
                  }
                  disabled={actionLoading}
                  className="w-full flex items-center justify-center gap-2 bg-amber-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-amber-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Clock size={18} />
                  {actionLoading ? "Processing..." : "⏳ Request Resubmission"}
                </button>
                <button
                  onClick={() =>
                    handleVerify(
                      selectedKYC.kyc_id,
                      "rejected",
                      notes || "Documents do not meet requirements",
                    )
                  }
                  disabled={actionLoading}
                  className="w-full flex items-center justify-center gap-2 bg-red-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <XCircle size={18} />
                  {actionLoading ? "Processing..." : "❌ Reject KYC"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
