import React from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, BarChart3, Coins, Users } from "lucide-react";

const features = [
  {
    icon: <ShieldCheck size={26} />,
    title: "Verified Activities",
    desc: "NGOs and institutions verify real-world achievements across health, education, and sustainability.",
  },
  {
    icon: <BarChart3 size={26} />,
    title: "Dynamic Impact Score",
    desc: "A transparent score engine updates borrower strength from validated social contribution data.",
  },
  {
    icon: <Coins size={26} />,
    title: "Smarter Loan Pricing",
    desc: "Borrowers receive automatic suggested terms while lenders can still fine-tune approvals.",
  },
  {
    icon: <Users size={26} />,
    title: "Inclusion-first Lending",
    desc: "Designed for workers and communities with limited formal credit history but real impact.",
  },
];

const tierCards = [
  {
    tier: "Low Risk Band",
    rate: "~7% to 11%",
    max: "up to INR 5,00,000",
    score: "Higher dynamic impact score",
    style: "text-green-700 bg-green-50 border-green-100",
  },
  {
    tier: "Medium Risk Band",
    rate: "~11% to 16%",
    max: "up to INR 2,00,000",
    score: "Balanced score and repayment profile",
    style: "text-amber-700 bg-amber-50 border-amber-100",
  },
  {
    tier: "High Risk Band",
    rate: "~16% to 26%",
    max: "up to INR 75,000",
    score: "Entry score with risk premium",
    style: "text-orange-700 bg-orange-50 border-orange-100",
  },
];

export default function Landing() {
  return (
    <div className="max-w-6xl mx-auto px-4">
      <section className="pt-16 pb-14">
        <div className="rounded-[2rem] overflow-hidden border border-slate-200 bg-[linear-gradient(130deg,#0f766e_0%,#0369a1_42%,#0f172a_100%)] text-white shadow-[0_25px_50px_rgba(2,6,23,0.25)]">
          <div className="px-7 py-12 md:px-12 md:py-14 grid lg:grid-cols-2 gap-8 items-center">
            <div>
              <div className="inline-flex items-center bg-white/15 border border-white/20 rounded-full px-4 py-1.5 text-xs tracking-[0.16em] uppercase font-semibold mb-5">
                Blockchain-Enabled Micro-Finance
              </div>
              <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-4">
                Your Impact is Your
                <span className="block text-cyan-200">Credit Signal</span>
              </h1>
              <p className="text-slate-200 text-base md:text-lg max-w-xl mb-7">
                ImpactScore helps underserved borrowers access fairer credit by turning verified social impact into lending trust.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  to="/signup"
                  className="bg-white text-slate-900 px-6 py-3 rounded-xl font-semibold hover:bg-slate-100 transition"
                >
                  Get Started
                </Link>
                <Link
                  to="/login"
                  className="border border-white/35 text-white px-6 py-3 rounded-xl font-semibold hover:bg-white/10 transition"
                >
                  Sign In
                </Link>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {tierCards.map((t) => (
                <div key={t.tier} className={`rounded-2xl border p-4 ${t.style}`}>
                  <p className="text-sm font-semibold mb-1">{t.tier}</p>
                  <p className="text-2xl font-bold">{t.rate}</p>
                  <p className="text-xs mt-1">{t.score}</p>
                  <p className="text-xs mt-2 opacity-85">{t.max}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid md:grid-cols-2 gap-6 mb-16">
        {features.map((f, i) => (
          <div
            key={f.title}
            className={`rounded-2xl p-6 border shadow-sm ${
              i % 2 === 0 ? "bg-white border-slate-200" : "bg-slate-900 text-white border-slate-800"
            }`}
          >
            <div className={`${i % 2 === 0 ? "text-sky-700" : "text-cyan-300"} mb-3`}>{f.icon}</div>
            <h3 className="font-semibold text-lg mb-1">{f.title}</h3>
            <p className={`${i % 2 === 0 ? "text-slate-600" : "text-slate-300"} text-sm leading-relaxed`}>{f.desc}</p>
          </div>
        ))}
      </section>

      <section className="rounded-3xl bg-white border border-slate-200 px-7 py-12 md:px-12 mb-16 text-center shadow-sm">
        <h2 className="text-3xl font-bold text-slate-900 mb-3">Ready to build your Impact Score?</h2>
        <p className="text-slate-600 mb-6">Join the platform as a borrower, verifier, lender, or admin and run inclusive finance with real transparency.</p>
        <Link to="/signup" className="bg-sky-700 text-white font-semibold px-8 py-3 rounded-xl hover:bg-sky-800 transition">
          Create Account
        </Link>
      </section>
    </div>
  );
}
