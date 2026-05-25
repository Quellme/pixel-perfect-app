import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

export const Route = createFileRoute("/_authenticated/dashboard/display")({
  component: DisplayView,
});

function DisplayView() {
  const [theme, setTheme] = useState<Theme>(
    () => (typeof window !== "undefined" && (localStorage.getItem("arelo-theme") as Theme)) || "system",
  );

  useEffect(() => {
    localStorage.setItem("arelo-theme", theme);
    const root = document.documentElement;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = theme === "dark" || (theme === "system" && prefersDark);
    root.classList.toggle("dark", isDark);
  }, [theme]);

  const options: { value: Theme; label: string; desc: string }[] = [
    { value: "light", label: "Light", desc: "Bright and crisp." },
    { value: "dark", label: "Dark", desc: "Easier on the eyes at night." },
    { value: "system", label: "System", desc: "Match your device setting." },
  ];

  return (
    <div className="max-w-[640px] mx-auto px-6 lg:px-10 py-8">
      <header className="mb-6 fade-in">
        <h1 className="font-display text-[32px] leading-tight text-ink">Display</h1>
        <p className="text-sm text-muted-foreground mt-1">How Arelo looks to you.</p>
      </header>

      <div className="space-y-3">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setTheme(opt.value)}
            className={`w-full text-left surface-card p-4 transition ${
              theme === opt.value ? "ring-2 ring-teal" : "hover:shadow-md"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-ui font-bold text-ink">{opt.label}</div>
                <div className="text-sm text-muted-foreground mt-0.5">{opt.desc}</div>
              </div>
              {theme === opt.value && <span className="text-teal text-lg">●</span>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
