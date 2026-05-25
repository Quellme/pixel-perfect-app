import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTasks } from "@/lib/tasks.functions";
import { listNotes } from "@/lib/notes.functions";
import { listEmailThreads } from "@/lib/google-oauth.functions";

type NavDef = {
  to: string;
  label: string;
  emoji: string;
  end?: boolean;
  countKey?: "focus" | "tasks" | "notes" | "check";
};

const NAV: NavDef[] = [
  { to: "/dashboard", label: "Focus", emoji: "🎯", end: true, countKey: "focus" },
  { to: "/dashboard/tasks", label: "My Tasks", emoji: "✏️", countKey: "tasks" },
  { to: "/dashboard/notes", label: "My Notes", emoji: "📋", countKey: "notes" },
  { to: "/dashboard/check", label: "Arelo's Check", emoji: "🔍", countKey: "check" },
];

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const now = useNow();

  const list = useServerFn(listTasks);
  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => list(),
  });

  const listNotesFn = useServerFn(listNotes);
  const { data: notes = [] } = useQuery({
    queryKey: ["notes", "sidebar"],
    queryFn: () => listNotesFn(),
  });

  const listEmailsFn = useServerFn(listEmailThreads);
  const { data: emails = [] } = useQuery({
    queryKey: ["email-threads", "all"],
    queryFn: () => listEmailsFn({ data: { category: "all" } }),
  });

  const open = tasks.filter((t) => t.status !== "done");
  const dueSoon = open.filter(
    (t) => t.due_at && new Date(t.due_at).getTime() - now.getTime() < 24 * 3600 * 1000,
  ).length;
  const actionEmails = emails.filter(
    (e) => e.category === "action" || e.action_required,
  ).length;
  const focusCount = dueSoon + actionEmails;

  const counts = {
    focus: focusCount,
    tasks: open.length,
    notes: notes.length,
    check: actionEmails,
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  const dateStr = now.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const timeStr = now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="sidebar-logo">
        <Link to="/dashboard" className="logo-mark">
          <div className="logo-orb-mini" />
          <span className="logo-text">Arelo</span>
        </Link>
        <button
          className="collapse-btn"
          onClick={() => setCollapsed((c) => !c)}
          title="Toggle sidebar"
          aria-label="Toggle sidebar"
        >
          {collapsed ? "›" : "‹"}
        </button>
      </div>

      <div className="sidebar-scroll">
        {/* Date/time home row */}
        <div className="sidebar-section">
          <Link
            to="/dashboard"
            className="nav-item"
            style={{ flexDirection: "column", alignItems: "flex-start", gap: 2, padding: "10px 12px" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14, width: "100%" }}>
              <div className="nav-icon" style={{ width: 28, height: 28, flexShrink: 0 }}>
                <span style={{ fontSize: 16 }}>🏡</span>
              </div>
              {!collapsed && (
                <div className="nav-label" style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>
                    {dateStr}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--teal)",
                      lineHeight: 1.2,
                      fontWeight: 700,
                    }}
                  >
                    {timeStr}
                  </div>
                </div>
              )}
            </div>
          </Link>
        </div>

        {/* Quick capture */}
        <div className="sidebar-section">
          <Link
            to="/dashboard/dump"
            className={`nav-item ${pathname === "/dashboard/dump" ? "active" : ""}`}
            title="Unload — quick capture"
            style={{
              background:
                pathname === "/dashboard/dump"
                  ? undefined
                  : "linear-gradient(135deg, rgba(45,212,168,0.18), rgba(45,212,168,0.06))",
              border: "1px solid rgba(45,212,168,0.25)",
            }}
          >
            <div className="nav-icon">
              <span style={{ fontSize: 16 }}>＋</span>
            </div>
            <span className="nav-label" style={{ color: "var(--teal)", fontWeight: 700 }}>
              Unload
            </span>
          </Link>
        </div>

        <div className="sidebar-section">
          {NAV.map((item) => {
            const active = item.end ? pathname === item.to : pathname.startsWith(item.to);
            const count = item.countKey ? counts[item.countKey] : 0;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`nav-item ${active ? "active" : ""}`}
                title={item.label}
              >
                <div className="nav-icon">
                  <span style={{ fontSize: 16 }}>{item.emoji}</span>
                </div>
                <span className="nav-label">{item.label}</span>
                {count > 0 && <span className="nav-count">{count}</span>}
              </Link>
            );
          })}

          <Link
            to="/dashboard/agent"
            className={`nav-item ${pathname === "/dashboard/agent" ? "active" : ""}`}
            title="Arelo Agent"
          >
            <div className="nav-icon" style={{ background: "transparent", padding: 0 }}>
              <div className="logo-orb-mini" style={{ width: 26, height: 26 }} />
            </div>
            <span className="nav-label">Arelo Agent</span>
          </Link>
        </div>
      </div>

      <div className="sidebar-upcoming">
        <button className="sign-out-btn" onClick={signOut}>
          <span style={{ fontSize: 14 }}>↩</span>
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </aside>
  );
}
