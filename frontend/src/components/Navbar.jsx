// src/components/Navbar.jsx
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Wallet, LogOut, LayoutDashboard, Menu, X } from "lucide-react";
import { useState } from "react";

export default function Navbar() {
  const { user, wallet, connectWallet, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const navLinks = user
    ? [
        {
          to: "/dashboard",
          label: "Dashboard",
          roles: ["borrower", "lender", "verifier"],
        },
        {
          to: "/submit-activity",
          label: "Submit Activity",
          roles: ["borrower"],
        },
        { to: "/activities", label: "My Activities", roles: ["borrower"] },
        { to: "/kyc/upload", label: "Upload KYC", roles: ["borrower"] },
        { to: "/loan", label: "Apply Loan", roles: ["borrower"] },
        { to: "/lender", label: "Loan Reviews", roles: ["lender"] },
        { to: "/lender/portfolio", label: "Portfolio", roles: ["lender"] },
        {
          to: "/default/management",
          label: "Defaults",
          roles: ["lender"],
        },
        { to: "/verify", label: "Verify", roles: ["verifier"] },
        { to: "/verifier/portfolio", label: "Portfolio", roles: ["verifier"] },
        { to: "/kyc/dashboard", label: "KYC Review", roles: ["verifier"] },
      ].filter((l) => l.roles.includes(user.role))
    : [];

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-16">
        {/* Logo */}
        <Link
          to="/"
          className="flex items-center gap-2 font-bold text-xl text-indigo-600"
        >
          <span className="bg-indigo-600 text-white rounded-lg px-2 py-1 text-sm">
            IS
          </span>
          ImpactScore
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6">
          {navLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="text-sm text-gray-600 hover:text-indigo-600 transition-colors font-medium"
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* Actions */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <>
              {/* Wallet button for borrowers only */}
              {user.role === "borrower" && (
                <button
                  onClick={connectWallet}
                  className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg border transition-colors
                    ${
                      wallet
                        ? "bg-green-50 border-green-300 text-green-700"
                        : "border-gray-300 text-gray-600 hover:border-indigo-400 hover:text-indigo-600"
                    }`}
                >
                  <Wallet size={15} />
                  {wallet
                    ? wallet.slice(0, 6) + "…" + wallet.slice(-4)
                    : "Connect Wallet"}
                </button>
              )}

              {/* Role badge */}
              <span className="text-xs px-2 py-1 bg-indigo-50 text-indigo-700 rounded-full capitalize font-medium">
                {user.role}
              </span>

              <button
                onClick={handleLogout}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-red-500 transition-colors"
              >
                <LogOut size={15} /> Logout
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="text-sm text-gray-600 hover:text-indigo-600"
              >
                Login
              </Link>
              <Link
                to="/signup"
                className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
              >
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
        <div className="md:hidden bg-white border-t border-gray-100 px-4 pb-4 flex flex-col gap-3">
          {user?.role === "borrower" && (
            <button
              onClick={connectWallet}
              className={`text-sm px-3 py-2 rounded-lg border text-left ${
                wallet
                  ? "bg-green-50 border-green-300 text-green-700"
                  : "border-gray-300 text-gray-600"
              }`}
            >
              {wallet
                ? wallet.slice(0, 6) + "..." + wallet.slice(-4)
                : "Connect Wallet"}
            </button>
          )}

          {navLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              onClick={() => setOpen(false)}
              className="text-sm text-gray-700 py-2 border-b border-gray-50"
            >
              {l.label}
            </Link>
          ))}
          {user ? (
            <button
              onClick={handleLogout}
              className="text-sm text-red-500 text-left py-2"
            >
              Logout
            </button>
          ) : (
            <Link
              to="/login"
              onClick={() => setOpen(false)}
              className="text-sm text-indigo-600 py-2"
            >
              Login
            </Link>
          )}
        </div>
      )}
    </nav>
  );
}
