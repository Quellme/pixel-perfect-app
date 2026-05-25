import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPanel,
});

function SettingsPanel() {
  const navigate = useNavigate();
  const { user } = useSession();

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 flex justify-end">
      <aside className="w-full max-w-[540px] h-full bg-surface overflow-y-auto shadow-xl">
        <header className="sticky top-0 bg-surface border-b border-navy-line px-6 py-4 flex items-center justify-between z-10">
          <h1 className="font-display text-2xl text-ink">Settings</h1>
          <button
            onClick={() => navigate({ to: "/dashboard" })}
            className="p-2 rounded-lg hover:bg-navy-soft text-muted-foreground"
            aria-label="Close settings"
          >
            <X size={18} />
          </button>
        </header>

        <div className="px-6 py-6 space-y-8">
          <Section title="Profile">
            <Field label="Email" value={user?.email ?? ""} disabled />
            <Field label="Name" placeholder="Your name" />
          </Section>

          <Section title="Arelo's personality">
            <div className="grid grid-cols-3 gap-2">
              {(["Calm", "Warm", "Direct"] as const).map((p, i) => (
                <button
                  key={p}
                  className={`py-3 rounded-xl border text-sm font-ui font-semibold transition ${
                    i === 0
                      ? "border-teal bg-teal-soft text-teal-dark"
                      : "border-navy-line text-muted-foreground hover:border-navy-mid"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </Section>

          <Section title="Quiet hours">
            <div className="grid grid-cols-2 gap-3">
              <Field label="From" value="22:00" />
              <Field label="To" value="07:00" />
            </div>
          </Section>

          <Section title="Accessibility">
            <Field label="Font" value="Atkinson Hyperlegible (default)" disabled />
            <Field label="Text size" value="Medium" disabled />
          </Section>
        </div>
      </aside>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-ui font-bold text-xs uppercase tracking-wider text-teal-dark mb-3">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({
  label, value, placeholder, disabled,
}: { label: string; value?: string; placeholder?: string; disabled?: boolean }) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground font-ui">{label}</span>
      <input
        defaultValue={value}
        placeholder={placeholder}
        disabled={disabled}
        className="mt-1 w-full rounded-xl border border-navy-line bg-page px-3.5 py-2.5 text-sm text-ink disabled:opacity-60 focus:outline-none focus:border-teal"
      />
    </label>
  );
}
