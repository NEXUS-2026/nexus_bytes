import React, { useState, useEffect } from "react";
import {
  FileUp,
  CheckCircle,
  Clock,
  AlertCircle,
  X,
  Upload,
} from "lucide-react";
import api from "../utils/api";

export default function KYCUpload() {
  const [kycStatus, setKycStatus] = useState(null);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const documentTypes = [
    {
      value: "govt_id",
      label: "Government ID",
      description: "Aadhar, PAN, Passport, Driver's License",
      required: true,
    },
    {
      value: "address_proof",
      label: "Address Proof",
      description: "Electricity bill, Rent agreement, Utility bill",
      required: true,
    },
    {
      value: "employment_proof",
      label: "Employment Proof",
      description: "Salary slip, Appointment letter, Business registration",
      required: false,
    },
    {
      value: "bank_statement",
      label: "Bank Statement",
      description: "Last 3 months bank statements",
      required: false,
    },
    {
      value: "other",
      label: "Other Documents",
      description: "Any other supporting documents",
      required: false,
    },
  ];

  useEffect(() => {
    loadKYCStatus();
  }, []);

  const loadKYCStatus = async () => {
    try {
      const res = await api.get("/kyc/status");
      setKycStatus(res.data);
    } catch (err) {
      console.error("Error loading KYC status:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (e, docType) => {
    const files = Array.from(e.target.files);
    try {
      const preparedFiles = files.map((file) => ({
        id: `${docType}-${Date.now()}-${Math.random()}`,
        type: docType,
        name: file.name,
        rawFile: file,
        size: (file.size / 1024 / 1024).toFixed(2),
        status: "ready",
      }));

      setUploadedFiles((prev) => [...prev, ...preparedFiles]);
    } catch (err) {
      console.error("File processing error:", err);
      alert("Unable to read one or more selected files. Please try again.");
    }
  };

  const submitDocuments = async () => {
    if (uploadedFiles.length === 0) {
      alert("Please select at least one document");
      return;
    }

    setUploading(true);
    try {
      const shouldResetPreviousDocs =
        kycStatus?.kyc_status === "rejected" ||
        kycStatus?.kyc_status === "resubmission_required";

      for (const [index, file] of uploadedFiles.entries()) {
        const fd = new FormData();
        fd.append("document_type", file.type);
        fd.append("document", file.rawFile);
        fd.append(
          "reset_previous",
          String(shouldResetPreviousDocs && index === 0),
        );

        await api.post("/kyc/upload-document", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }
      await loadKYCStatus();
      setUploadedFiles([]);
      alert(
        "Documents uploaded successfully! Our verifiers will review them within 24-48 hours.",
      );
    } catch (err) {
      console.error("Upload error:", err);
      alert(
        "Error uploading documents: " +
          (err.response?.data?.error || err.message),
      );
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (id) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">KYC Verification</h1>
        <p className="text-gray-600 mt-2">
          Upload your documents to verify your identity and unlock loan
          eligibility
        </p>
      </div>

      {/* Status Card */}
      {kycStatus && (
        <div
          className={`rounded-2xl border-2 p-6 mb-8 ${
            kycStatus.approved
              ? "bg-green-50 border-green-300"
              : kycStatus.kyc_status === "rejected"
                ? "bg-red-50 border-red-300"
                : "bg-yellow-50 border-yellow-300"
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              {kycStatus.approved && (
                <CheckCircle
                  className="text-green-600 flex-shrink-0"
                  size={32}
                />
              )}
              {kycStatus.kyc_status === "rejected" && (
                <AlertCircle className="text-red-600 flex-shrink-0" size={32} />
              )}
              {!kycStatus.approved && kycStatus.kyc_status !== "rejected" && (
                <Clock className="text-yellow-600 flex-shrink-0" size={32} />
              )}
              <div>
                <p
                  className={`font-bold text-lg ${
                    kycStatus.approved
                      ? "text-green-700"
                      : kycStatus.kyc_status === "rejected"
                        ? "text-red-700"
                        : "text-yellow-700"
                  }`}
                >
                  {kycStatus.approved
                    ? "✓ KYC Verified"
                    : kycStatus.kyc_status === "rejected"
                      ? "❌ Rejected - Resubmit Required"
                      : kycStatus.kyc_status === "resubmission_required"
                        ? "⏳ Resubmission Requested"
                        : kycStatus.kyc_status === "pending_review"
                          ? "⏳ Under Review"
                          : "📋 Not Started"}
                </p>
                <p
                  className={`text-sm ${
                    kycStatus.approved
                      ? "text-green-600"
                      : kycStatus.kyc_status === "rejected"
                        ? "text-red-600"
                        : "text-yellow-600"
                  }`}
                >
                  {kycStatus.approved
                    ? "You are eligible to apply for loans"
                    : kycStatus.kyc_status === "pending_review"
                      ? `${kycStatus.document_count} document(s) uploaded • Awaiting verifier review`
                      : kycStatus.kyc_status === "rejected"
                        ? "Please upload corrected/required documents"
                        : kycStatus.kyc_status === "resubmission_required"
                          ? "Verifier requested new documents. Upload updated files to continue"
                          : "Upload required documents to proceed"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Section - Only show if not approved */}
      {!kycStatus?.approved && (
        <>
          {/* Document Types Grid */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              📤 Upload Document Proof
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {documentTypes.map((doc) => (
                <label
                  key={doc.value}
                  className="border-2 border-dashed border-gray-300 rounded-xl p-6 hover:border-indigo-400 hover:bg-indigo-50 transition cursor-pointer"
                >
                  <div className="flex items-start gap-3">
                    <Upload
                      size={24}
                      className="text-indigo-600 flex-shrink-0 mt-1"
                    />
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{doc.label}</p>
                      <p className="text-sm text-gray-600">{doc.description}</p>
                      {doc.required && (
                        <span className="inline-block mt-2 px-2 py-1 bg-red-100 text-red-600 text-xs font-bold rounded">
                          ⚠️ REQUIRED
                        </span>
                      )}
                    </div>
                  </div>
                  <input
                    type="file"
                    multiple
                    onChange={(e) => handleFileSelect(e, doc.value)}
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Selected Files List */}
          {uploadedFiles.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  📋 Selected Files ({uploadedFiles.length})
                </h2>
                <button
                  onClick={() => setUploadedFiles([])}
                  className="text-sm text-red-600 hover:text-red-700 font-medium"
                >
                  Clear All
                </button>
              </div>
              <div className="space-y-2 bg-gray-50 rounded-lg p-4">
                {uploadedFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between bg-white p-4 rounded-lg border border-gray-200 hover:border-indigo-300"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <FileUp
                        size={20}
                        className="text-indigo-600 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {file.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {
                            documentTypes.find((d) => d.value === file.type)
                              ?.label
                          }{" "}
                          • {file.size} MB
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFile(file.id)}
                      className="p-2 hover:bg-red-50 rounded-lg transition flex-shrink-0"
                    >
                      <X size={18} className="text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Submit Button */}
          {uploadedFiles.length > 0 && (
            <div className="flex gap-3 mb-8">
              <button
                onClick={submitDocuments}
                disabled={uploading}
                className="flex-1 px-6 py-4 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 text-lg"
              >
                {uploading ? (
                  <>
                    <div className="animate-spin">⏳</div>
                    Uploading Documents...
                  </>
                ) : (
                  <>
                    <Upload size={20} />
                    Submit {uploadedFiles.length} Document
                    {uploadedFiles.length > 1 ? "s" : ""}
                  </>
                )}
              </button>
            </div>
          )}

          {/* Info Box */}
          <div className="bg-blue-50 border-l-4 border-blue-400 p-5 rounded-lg">
            <p className="text-sm text-blue-900 font-medium mb-2">
              ℹ️ How KYC Works:
            </p>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>✓ Upload Government ID + Address Proof (both required)</li>
              <li>
                ✓ Optional: Employment proof or bank statements for better rates
              </li>
              <li>✓ Our verifiers review (24-48 hours)</li>
              <li>✓ Once approved, apply for loans at competitive rates</li>
            </ul>
          </div>
        </>
      )}

      {/* Approved State */}
      {kycStatus?.approved && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-2xl p-8 text-center">
          <div className="flex justify-center mb-4">
            <CheckCircle size={80} className="text-green-600" />
          </div>
          <h2 className="text-3xl font-bold text-green-700 mb-2">
            KYC Verified! 🎉
          </h2>
          <p className="text-green-600 mb-3 text-lg">
            Your identity has been successfully verified
          </p>
          {kycStatus.max_loan_allowed && (
            <div className="bg-white rounded-lg p-4 mb-6 inline-block">
              <p className="text-gray-600 text-sm">Maximum Loan Eligibility</p>
              <p className="text-3xl font-bold text-green-600">
                ₹{kycStatus.max_loan_allowed.toLocaleString("en-IN")}
              </p>
            </div>
          )}
          <a
            href="/loan"
            className="inline-block px-8 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition"
          >
            Apply for Loan →
          </a>
        </div>
      )}
    </div>
  );
}
