// src/pages/SubmitActivity.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../utils/api";
import { Upload, Heart, BookOpen, Leaf } from "lucide-react";

const CATEGORIES = [
  { id: "health",         label: "Health",         icon: <Heart size={20} />,     desc: "+10 pts — Vaccinations, checkups, wellness" },
  { id: "education",      label: "Education",       icon: <BookOpen size={20} />,  desc: "+20 pts — Courses, certificates, training" },
  { id: "sustainability", label: "Sustainability",  icon: <Leaf size={20} />,      desc: "+15 pts — NGO work, environmental activities" },
];

export default function SubmitActivity() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: "", description: "", category: "health" });
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error("Title is required");

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("title",       form.title);
      fd.append("description", form.description);
      fd.append("category",    form.category);
      if (file) fd.append("document", file);

      await api.post("/activity", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success("Activity submitted! Awaiting verification.");
      navigate("/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.error || "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Submit Activity</h1>
      <p className="text-gray-500 text-sm mb-8">
        Add a verified real-world activity to build your Impact Score.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Category selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">Category</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {CATEGORIES.map((c) => (
              <button key={c.id} type="button"
                onClick={() => setForm((f) => ({ ...f, category: c.id }))}
                className={`p-4 rounded-xl border-2 text-left transition-all
                  ${form.category === c.id
                    ? "border-indigo-500 bg-indigo-50"
                    : "border-gray-200 hover:border-indigo-300 bg-white"}`}>
                <div className={`mb-2 ${form.category === c.id ? "text-indigo-600" : "text-gray-400"}`}>
                  {c.icon}
                </div>
                <div className="font-medium text-gray-800 text-sm">{c.label}</div>
                <div className="text-xs text-gray-400 mt-0.5">{c.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
          <input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="e.g. Completed First Aid Training"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Briefly describe the activity…"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm resize-none"
          />
        </div>

        {/* Document upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Supporting Document <span className="text-gray-400">(optional)</span>
          </label>
          <label className={`flex items-center justify-center gap-3 border-2 border-dashed rounded-xl p-6 cursor-pointer transition
            ${file ? "border-indigo-400 bg-indigo-50" : "border-gray-300 hover:border-indigo-300 bg-gray-50"}`}>
            <Upload size={20} className={file ? "text-indigo-500" : "text-gray-400"} />
            <span className="text-sm text-gray-500">
              {file ? file.name : "Click to upload PDF, image, or certificate (max 10 MB)"}
            </span>
            <input type="file" className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              onChange={(e) => setFile(e.target.files[0] || null)} />
          </label>
        </div>

        {/* Submit */}
        <button type="submit" disabled={submitting}
          className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 transition">
          {submitting ? "Submitting…" : "Submit Activity"}
        </button>
      </form>
    </div>
  );
}
