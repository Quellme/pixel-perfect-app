import { useState, useRef, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Settings, Palette, LogOut, Sparkles, HelpCircle } from "lucide-react";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";

type TopBarProps = {
  updatedAt?: Date | null;
};

export function TopBar({ updatedAt }: TopBarProps) {
  const { session } = useSession();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const email = session?.user?.email ?? "";
  const initial = (email[0] ?? "U").toUpperCase();

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  return (
    <div
      style={{
        position: "absolute",
        top: 16,
        right: 20,
        display: "flex",
        alignItems: "center",
        gap: 8,
        zIndex: 30,
      }}
    >
      {updatedAt && (
        <div
          style={{
            background: "rgba(255,255,255,0.9)",
            border: "1px solid var(--navy-line)",
            borderRadius: 999,
            padding: "6px 14px",
            fontSize: 12,
            fontWeight: 600,
            color: "var(--ink)",
            fontFamily: "var(--font-ui)",
          }}
          title={updatedAt.toLocaleString()}
        >
          Updated{" "}
          {updatedAt.toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      )}

      <button
        className="topbar-icon-btn"
        title="Arelo Agent"
        aria-label="Agent"
        onClick={() => navigate({ to: "/dashboard/agent" })}
      >
        <Sparkles size={14} />
      </button>

      <button
        className="topbar-icon-btn"
        title="Help"
        aria-label="Help"
        onClick={() => window.open("https://docs.lovable.dev", "_blank")}
      >
        <HelpCircle size={14} />
      </button>

      <div ref={ref} style={{ position: "relative" }}>
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label="Account menu"
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "var(--navy)",
            color: "#fff",
            border: "none",
            cursor: "pointer",
            fontWeight: 700,
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-ui)",
          }}
        >
          {initial}
        </button>

        {open && (
          <div
            style={{
              position: "absolute",
              top: 40,
              right: 0,
              minWidth: 200,
              background: "var(--navy)",
              borderRadius: 12,
              padding: 8,
              boxShadow: "0 12px 32px rgba(0,0,0,0.25)",
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            {email && (
              <div
                style={{
                  padding: "8px 12px",
                  fontSize: 11,
                  color: "rgba(255,255,255,0.55)",
                  fontFamily: "var(--font-ui)",
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                  marginBottom: 4,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {email}
              </div>
            )}
            <MenuItem
              icon={<Settings size={14} />}
              label="Preferences"
              onClick={() => {
                setOpen(false);
                navigate({ to: "/dashboard/preferences" });
              }}
            />
            <MenuItem
              icon={<Palette size={14} />}
              label="Display"
              onClick={() => {
                setOpen(false);
                navigate({ to: "/dashboard/display" });
              }}
            />
            <div
              style={{
                height: 1,
                background: "rgba(255,255,255,0.08)",
                margin: "4px 8px",
              }}
            />
            <MenuItem
              icon={<LogOut size={14} />}
              label="Sign out"
              danger
              onClick={signOut}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        background: "transparent",
        border: "none",
        color: danger ? "#ff6b6b" : "#fff",
        cursor: "pointer",
        fontSize: 13,
        fontWeight: 600,
        fontFamily: "var(--font-ui)",
        borderRadius: 8,
        textAlign: "left",
        width: "100%",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,0.06)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
