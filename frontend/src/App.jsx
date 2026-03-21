// src/App.jsx
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import LenderDashboard  from "./pages/LenderDashboard";

import { AuthProvider, useAuth } from "./context/AuthContext";
import Navbar          from "./components/Navbar";
import Landing         from "./pages/Landing";
import Login           from "./pages/Login";
import Signup          from "./pages/Signup";
import Dashboard       from "./pages/Dashboard";
import SubmitActivity  from "./pages/SubmitActivity";
import VerifierPanel   from "./pages/VerifierPanel";
import LoanApplication from "./pages/LoanApplication";
import AdminPanel      from "./pages/AdminPanel";

// ── Guards ────────────────────────────────────────────────────────────────────

function PrivateRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen text-gray-500">Loading…</div>;
  if (!user)   return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Navbar />
        <main className="min-h-screen bg-gray-50">
          <Routes>
            <Route path="/"        element={<Landing />} />
            <Route path="/login"   element={<Login />} />
            <Route path="/signup"  element={<Signup />} />

            <Route path="/dashboard" element={
              <PrivateRoute><Dashboard /></PrivateRoute>
            }/>

            <Route path="/submit-activity" element={
              <PrivateRoute roles={["borrower"]}><SubmitActivity /></PrivateRoute>
            }/>

            <Route path="/verify" element={
              <PrivateRoute roles={["verifier", "admin"]}><VerifierPanel /></PrivateRoute>
            }/>

            <Route path="/loan" element={
              <PrivateRoute roles={["borrower"]}><LoanApplication /></PrivateRoute>
            }/>

            <Route path="/lender" element={
              <PrivateRoute roles={["lender","admin"]}><LenderDashboard /></PrivateRoute>
            }/>

            <Route path="/admin" element={
              <PrivateRoute roles={["admin"]}><AdminPanel /></PrivateRoute>
            }/>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <ToastContainer position="top-right" autoClose={4000} />
      </BrowserRouter>
    </AuthProvider>
  );
}
