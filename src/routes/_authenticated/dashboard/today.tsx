import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listTodayCarousel, enrichTask, enrichEmail } from "@/lib/enrichment.functions";
import { toggleTask } from "@/lib/tasks.functions";

export const Route = createFileRoute("/_authenticated/dashboard/today")({
  component: TodayCarousel,
});

type Mood = "calm" | "overwhelmed";

type CardItem = {
  kind: "task" | "email";
  id: string;
  title: string;
  short_summary: string | null;
  estimated_minutes: number | null;
  micro_steps: string[] | null;
  due_at: string | null;
  meta: string | null;
};

function minutesChip(m: number | null | undefined) {
  if (!m) return null;
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}

function dueLabel(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

function TodayCarousel() {
  const qc = useQueryClient();
  const listFn = useServerFn(listTodayCarousel);
  const enrichTaskFn = useServerFn(enrichTask);
  const enrichEmailFn = useServerFn(enrichEmail);
  const toggleFn = useServerFn(toggleTask);

  const [mood, setMood] = useState<Mood>(() => {
    if (typeof window === "undefined") return "calm";
    return (localStorage.getItem("arelo_mood") as Mood) || "calm";
  });
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("arelo_mood", mood);
  }, [mood]);

  const { data } = useQuery({
    queryKey: ["today-carousel"],
    queryFn: () => listFn(),
  });

  const items: CardItem[] = useMemo(() => {
    if (!data) return [];
    const tasks: CardItem[] = data.tasks.map((t) => ({
      kind: "task",
      id: t.id,
      title: t.title,
      short_summary: t.short_summary,
      estimated_minutes: t.estimated_minutes,
      micro_steps: (t.micro_steps as string[] | null) ?? null,
      due_at: t.due_at,
      meta: t.priority === "high" ? "High priority" : null,
    }));
    const emails: CardItem[] = data.emails.map((e) => ({
      kind: "email",
      id: e.id,
      title: e.subject ?? "(no subject)",
      short_summary: e.short_summary ?? e.snippet,
      estimated_minutes: e.estimated_minutes,
      micro_steps: (e.micro_steps as string[] | null) ?? null,
      due_at: e.received_at,
      meta: e.from_address,
    }));
    // In overwhelmed mode: restrict tasks strictly to today/tomorrow (drop priority-only items without due dates)
    const filtered =
      mood === "overwhelmed"
        ? [...tasks.filter((t) => !!t.due_at), ...emails]
        : [...tasks, ...emails];
    return filtered;
  }, [data, mood]);

  const total = items.length;
  const current = items[index];

  // Reset index when items change
  useEffect(() => {
    if (index >= total) setIndex(0);
  }, [total, index]);

  // Lazy enrich current card
  useEffect(() => {
    if (!current) return;
    const needsBase = !current.short_summary || !current.estimated_minutes;
    const needsSteps =
      mood === "overwhelmed" && (!current.micro_steps || current.micro_steps.length === 0);
    if (!needsBase && !needsSteps) return;

    const run = current.kind === "task" ? enrichTaskFn : enrichEmailFn;
    run({ data: { id: current.id, withBreakdown: mood === "overwhelmed" } })
      .then(() => qc.invalidateQueries({ queryKey: ["today-carousel"] }))
      .catch(() => {
        // silent
      });
  }, [current?.id, mood]);

  const toggleMut = useMutation({
    mutationFn: (vars: { id: string; done: boolean }) => toggleFn({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["today-carousel"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Marked done");
      if (index >= total - 1) setIndex(0);
      else setIndex((i) => i + 1);
    },
  });

  return (
    <div className="max-w-[860px] mx-auto px-6 lg:px-10 py-8">
      <header className="mb-6 fade-in flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[32px] leading-tight text-ink">Today</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mood === "overwhelmed"
              ? "Just today and tomorrow. One small step at a time."
              : "Start with one thing."}
          </p>
        </div>
        <div
          className="inline-flex rounded-full border border-navy-line bg-surface p-1 text-xs font-ui font-semibold"
          role="tablist"
        >
          {(["calm", "overwhelmed"] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMood(m);
                setIndex(0);
              }}
              className={`px-3 py-1.5 rounded-full transition ${
                mood === m ? "bg-navy text-white" : "text-muted-foreground hover:text-ink"
              }`}
            >
              {m === "calm" ? "Calm" : "Overwhelmed"}
            </button>
          ))}
        </div>
      </header>

      {total === 0 ? (
        <div className="surface-card p-12 text-center">
          <p className="text-sm text-muted-foreground">
            {mood === "overwhelmed"
              ? "Nothing pressing for today or tomorrow. Breathe."
              : "Nothing on your plate. A calm day ahead."}
          </p>
        </div>
      ) : (
        <>
          <article className="surface-card p-8 fade-in" style={{ minHeight: 320 }}>
            <div className="flex items-start justify-between gap-4 mb-4">
              <span
                className="text-[11px] font-ui font-bold uppercase tracking-wider px-2 py-1 rounded-md"
                style={{
                  background: current.kind === "email" ? "#eef4ff" : "#e7f7f3",
                  color: current.kind === "email" ? "#2849a0" : "#0f6b58",
                }}
              >
                {current.kind === "email" ? "Email" : "Task"}
              </span>
              {current.due_at && (
                <span className="text-[11px] font-ui font-semibold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full">
                  Due {dueLabel(current.due_at)}
                </span>
              )}
            </div>

            <h2 className="font-display text-[26px] leading-snug text-ink mb-3">
              {current.title}
            </h2>

            {current.short_summary ? (
              <p className="text-[15px] text-ink/75 mb-4 leading-relaxed">
                {current.short_summary}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground italic mb-4">Thinking…</p>
            )}

            <div className="flex items-center gap-2 flex-wrap mb-6">
              {current.estimated_minutes && (
                <span className="chip due">⏱ {minutesChip(current.estimated_minutes)}</span>
              )}
              {current.meta && (
                <span className="chip" title={current.meta}>
                  {current.meta.length > 40 ? current.meta.slice(0, 40) + "…" : current.meta}
                </span>
              )}
            </div>

            {mood === "overwhelmed" && current.micro_steps && current.micro_steps.length > 0 && (
              <div className="mb-6">
                <div className="text-xs font-ui font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Tiny steps
                </div>
                <ol className="space-y-1.5">
                  {current.micro_steps.map((s, i) => (
                    <li
                      key={i}
                      className="text-sm text-ink flex gap-2 items-start"
                      style={{ paddingLeft: 4 }}
                    >
                      <span className="text-teal font-bold shrink-0">{i + 1}.</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {current.kind === "task" && (
                <button
                  className="btn-done"
                  onClick={() =>
                    toggleMut.mutate({ id: current.id, done: true })
                  }
                >
                  Mark done →
                </button>
              )}
              {mood === "calm" && current.kind === "task" && (
                <button
                  className="btn-done"
                  style={{ background: "var(--navy-soft)", color: "var(--muted)" }}
                  onClick={() => {
                    enrichTaskFn({ data: { id: current.id, withBreakdown: true } })
                      .then(() => qc.invalidateQueries({ queryKey: ["today-carousel"] }));
                  }}
                >
                  Break it down
                </button>
              )}
            </div>
          </article>

          <div className="flex items-center justify-between mt-6">
            <button
              className="btn-done"
              style={{ background: "var(--navy-soft)", color: "var(--ink)" }}
              onClick={() => setIndex((i) => (i - 1 + total) % total)}
              disabled={total < 2}
            >
              ← Back
            </button>
            <div className="text-sm font-ui font-semibold text-muted-foreground">
              {index + 1} of {total}
            </div>
            <button
              className="btn-done"
              onClick={() => setIndex((i) => (i + 1) % total)}
              disabled={total < 2}
            >
              Next →
            </button>
          </div>

          <div className="flex justify-center gap-1.5 mt-4">
            {items.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                aria-label={`Go to ${i + 1}`}
                style={{
                  width: i === index ? 18 : 6,
                  height: 6,
                  borderRadius: 999,
                  background: i === index ? "var(--teal)" : "var(--navy-line)",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
