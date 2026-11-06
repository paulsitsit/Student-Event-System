
import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import PccLogo from "../../assets/pcc-logo.jpg";

import {
  LayoutDashboard,
  Users,
  CalendarDays,
  ScanFace,
  ClipboardList,
  FileDown,
  ScrollText,
  LogOut,
  Menu,
  Settings as SettingsIcon,
  ShieldCheck,
  X
} from "lucide-react";

export default function MainLayout({ admin, onLogout, children }) {
  const [open, setOpen] = useState(false);

  const links = [
    ["/", "Overview", LayoutDashboard],
    ["/students", "Students", Users],
    ["/events", "Events", CalendarDays],
    ["/scanner", "Attendance Scanner", ScanFace],
    ["/attendance", "Attendance Records", ClipboardList],
    ["/reports", "Reports", FileDown],
    ["/audit", "Audit Trail", ScrollText],
    ["/settings", "Settings", SettingsIcon]
  ];

  return (
    <div className="app-shell">

      {/* Mobile sidebar backdrop */}
      {open && (
        <div
          className="sidebar-backdrop"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={open ? "sidebar open" : "sidebar"}>

        <div className="side-brand">
          <div className="side-brand-logo">
            <img
              src={PccLogo}
              alt="Passi City College logo"
              className="side-brand-logo-image"
            />
          </div>

          <div>
            <b>PCC Campus</b>
            <span>Attendance System</span>
          </div>

          <button
            className="sidebar-close"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav>
          {links.map(([to, label, Icon]) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={() => setOpen(false)}
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Sidebar bottom */}
        <div className="side-bottom">

          <div className="admin-chip">
            <div className="avatar">
              {admin?.name?.[0]?.toUpperCase() || "A"}
            </div>

            <div>
              <b>{admin?.name || "Administrator"}</b>
              <span>Administrator</span>
            </div>
          </div>

          <button
            className="logout"
            onClick={onLogout}
            type="button"
          >
            <LogOut size={17} />
            <span>Sign out</span>
          </button>

        </div>
      </aside>

      {/* Main content */}
      <main className="main-area">

        {/* Topbar */}
        <header className="topbar">

          <button
            className="mobile-menu"
            onClick={() => setOpen(!open)}
            aria-label="Toggle navigation"
            type="button"
          >
            {open ? <X size={21} /> : <Menu size={21} />}
          </button>

          <div className="topbar-brand">
            <span className="eyebrow">
              PASSI CITY COLLEGE
            </span>

            <b>Student Event Attendance</b>
          </div>

          <div className="top-right">
            <ShieldCheck size={17} />
            <span>Secure admin workspace</span>
          </div>

        </header>

        {/* Page content */}
        <div className="page-content">
          {children}
        </div>

      </main>
    </div>
  );
}
