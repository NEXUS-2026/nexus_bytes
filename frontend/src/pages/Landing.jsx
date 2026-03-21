// src/pages/Landing.jsx
import React from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, BarChart3, Coins, Users } from "lucide-react";

const features = [
  { icon: <ShieldCheck size={28} />, title: "Verified Activities",
    desc: "NGOs and institutions verify your real-world achievements — health, education, and sustainability." },
  { icon: <BarChart3 size={28} />,   title: "Impact Score",
    desc: "A dynamic blockchain-backed score replaces traditional credit history for underserved communities." },
  { icon: <Coins size={28} />,       title: "Smart Loan Decisions",
    desc: "Solidity smart contracts automatically calculate interest rates and loan eligibility in seconds." },
  { icon: <Users size={28} />,       title: "For Everyone",
    desc: "Designed for street vendors, gig workers, and anyone without formal credit history." },
];

export default function Landing() {
  return (
    <div className="max-w-5xl mx-auto px-4">
      {/* Hero */}
      <section className="text-center py-20">
        <div className="inline-block bg-indigo-50 text-indigo-700 text-sm font-medium px-4 py-1.5 rounded-full mb-6">
          Blockchain-Enabled Micro-Finance
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight mb-5">
          Your Impact is Your<br />
          <span className="text-indigo-600">Credit Score</span>
        </h1>
        <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-8">
          ImpactScore enables street vendors and underserved communities to access micro-loans
          using verified real-world activities stored on the Polygon blockchain.
        </p>
        <div className="flex flex-wrap gap-4 justify-center">
          <Link to="/signup"
            className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-700 transition">
            Get Started Free
          </Link>
          <Link to="/login"
            className="border border-gray-300 text-gray-700 px-6 py-3 rounded-xl font-semibold hover:border-indigo-400 transition">
            Sign In
          </Link>
        </div>
      </section>

      {/* Score tiers */}
      <section className="grid md:grid-cols-3 gap-4 mb-16">
        {[
          { tier: "Low Interest", rate: "5%", score: "Score > 80", color: "green", max: "$5,000" },
          { tier: "Medium Interest", rate: "12%", score: "Score 51–80", color: "amber", max: "$2,000" },
          { tier: "High Interest", rate: "20%", score: "Score 20–50", color: "orange", max: "$500" },
        ].map((t) => (
          <div key={t.tier} className="bg-white border border-gray-200 rounded-2xl p-5 text-center shadow-sm">
            <div className={`text-3xl font-bold text-${t.color}-600 mb-1`}>{t.rate}</div>
            <div className="font-semibold text-gray-800">{t.tier}</div>
            <div className="text-sm text-gray-400 mt-1">{t.score} · up to {t.max}</div>
          </div>
        ))}
      </section>

      {/* Features */}
      <section className="grid md:grid-cols-2 gap-6 mb-20">
        {features.map((f) => (
          <div key={f.title} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex gap-4">
            <div className="text-indigo-500 shrink-0 mt-1">{f.icon}</div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          </div>
        ))}
      </section>

      {/* CTA */}
      <section className="bg-indigo-600 rounded-3xl text-white text-center py-14 px-6 mb-16">
        <h2 className="text-3xl font-bold mb-3">Ready to build your Impact Score?</h2>
        <p className="text-indigo-200 mb-6">Join thousands of borrowers already on the platform.</p>
        <Link to="/signup"
          className="bg-white text-indigo-600 font-semibold px-8 py-3 rounded-xl hover:bg-indigo-50 transition">
          Create Account
        </Link>
      </section>
    </div>
  );
}
