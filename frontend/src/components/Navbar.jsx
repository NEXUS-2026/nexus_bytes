// src/components/Navbar.jsx
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LogOut, Menu, X } from "lucide-react";
import { useState } from "react";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleLogout = () => { logout(); navigate("/"); };

  const navLinks = user ? [
    { to: "/dashboard",        label: "Dashboard",       roles: ["borrower", "lender", "admin", "verifier"] },
    { to: "/submit-activity",  label: "Submit Activity", roles: ["borrower"] },
    { to: "/loan",             label: "Apply Loan",      roles: ["borrower"] },
    { to: "/kyc",              label: "KYC",             roles: ["borrower"] },
    { to: "/borrowers",        label: "Borrowers",       roles: ["lender","admin"] },
    { to: "/lender",           label: "Loan Review",     roles: ["lender","admin"] },
    { to: "/verify",           label: "Verify",          roles: ["verifier", "admin"] },
    { to: "/admin",            label: "Admin",           roles: ["admin"] },
  ].filter((l) => l.roles.includes(user.role)) : [];

  return (
    <nav className="bg-white/85 border-b border-slate-200 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-16">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 font-bold text-xl text-slate-900">
          <span className="bg-gradient-to-br from-teal-600 to-sky-600 text-white rounded-lg px-2 py-1 text-sm">IS</span>
          ImpactScore
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6">
          {navLinks.map((l) => (
            <Link key={l.to} to={l.to}
              className="text-sm text-slate-600 hover:text-sky-700 transition-colors font-medium">
              {l.label}
            </Link>
          ))}
        </div>

        {/* Actions */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <>
              {/* Role badge */}
              <span className="text-xs px-2 py-1 bg-sky-50 text-sky-700 rounded-full capitalize font-medium">
                {user.role}
              </span>

              <button onClick={handleLogout}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-red-500 transition-colors">
                <LogOut size={15} /> Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login"  className="text-sm text-slate-600 hover:text-sky-700">Login</Link>
              <Link to="/signup" className="text-sm bg-sky-700 text-white px-4 py-2 rounded-lg hover:bg-sky-800">
                Get Started
              </Link>
            </>
          )}
        </div>

        {/* Mobile menu toggle */}
        <button className="md:hidden" onClick={() => setOpen(!open)}>
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden bg-white border-t border-slate-100 px-4 pb-4 flex flex-col gap-3">
          {navLinks.map((l) => (
            <Link key={l.to} to={l.to} onClick={() => setOpen(false)}
              className="text-sm text-slate-700 py-2 border-b border-slate-50">
              {l.label}
            </Link>
          ))}
          {user
            ? <button onClick={handleLogout} className="text-sm text-red-500 text-left py-2">Logout</button>
            : <Link to="/login" onClick={() => setOpen(false)} className="text-sm text-sky-700 py-2">Login</Link>
          }
        </div>
      )}
    </nav>
  );
}
