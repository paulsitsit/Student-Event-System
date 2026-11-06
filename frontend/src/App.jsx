import React, { useEffect, useState } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";

import { api, setToken, getToken } from "./services/api";

import Login from "./pages/Login";
import MainLayout from "./components/layout/MainLayout";
import Dashboard from "./pages/Dashboard";
import Students from "./pages/Students";
import Events from "./pages/Events";
import Archive from "./pages/Archive";
import AttendanceScanner from "./pages/AttendanceScanner";
import AttendanceRecords from "./pages/AttendanceRecords";
import Reports from "./pages/Reports";
import AuditLogs from "./pages/AuditLogs";
import Settings from "./pages/Settings";

export default function App() {
  const [admin, setAdmin] = useState(null);
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    async function checkAuthentication() {
      if (!getToken()) {
        if (active) setChecking(false);
        return;
      }
      try {
        const data = await api("/auth/me");
        if (active) setAdmin(data.admin);
      } catch (error) {
        setToken("");
        if (active) setAdmin(null);
      } finally {
        if (active) setChecking(false);
      }
    }
    checkAuthentication();
    return () => { active = false; };
  }, []);

  function logout() {
    setToken("");
    setAdmin(null);
    navigate("/");
  }

  if (checking) return <div className="loading-screen">Loading secure workspace…</div>;
  if (!admin) return <Login onLogin={setAdmin} />;

  return (
    <MainLayout admin={admin} onLogout={logout}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/students" element={<Students />} />
        <Route path="/events" element={<Events />} />
        <Route path="/archive" element={<Archive />} />
        <Route path="/scanner" element={<AttendanceScanner />} />
        <Route path="/attendance" element={<AttendanceRecords />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/audit" element={<AuditLogs />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Dashboard />} />
      </Routes>
    </MainLayout>
  );
}
