import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { TaskCard } from "@/components/dashboard/TaskCard";
import { UpcomingEventsCard } from "@/components/dashboard/UpcomingEventsCard";
import { listTasks, createTask, toggleTask, deleteTask } from "@/lib/tasks.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: FocusView,
});

type Bucket = "now" | "today" | "week" | "later";

function bucketOf(due_at: string | null): Bucket {
  if (!due_at) return "later";
  const due = new Date(due_at).getTime();
  const now = Date.now();
  const diffH = (due - now) / 36e5;
  if (diffH < 3) return "now";
  if (diffH < 24) return "today";
  if (diffH < 24 * 7) return "week";
  return "later";
}

function greetingFor(now: Date) {
  const h = now.getHours();
  if (h < 5) return "Late night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Winding down";
}

function FocusView() {
  const qc = useQueryClient();
  const list = useServerFn(listTasks);
  const create = useServerFn(createTask);
  const toggle = useServerFn(toggleTask);
  const remove = useServerFn(deleteTask);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => list(),
  });

  const createMut = useMutation({
    mutationFn: (vars: { title: string }) =>
      create({ data: { title: vars.title, priority: "medium", energy: "medium" } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const toggleMut = useMutation({
    mutationFn: (vars: { id: string; done: boolean }) => toggle({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const [tab, setTab] = useState<"focus" | "today" | "all">("focus");
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const now = new Date();
  const open = tasks.filter((t) => t.status !== "done");
  const done = tasks.filter((t) => t.status === "done");
  const doNow = open.filter((t) => bucketOf(t.due_at) === "now" || t.priority === "high");
  const doToday = open.filter((t) => bucketOf(t.due_at) === "today" && !doNow.includes(t));
  const comingUp = open.filter((t) => !doNow.includes(t) && !doToday.includes(t));

  const totalForProgress = open.length + done.length;
  const pct = totalForProgress === 0 ? 0 : Math.round((done.length / totalForProgress) * 100);

  const greeting = greetingFor(now);
  const subline =
    isLoading
      ? "Gathering your day…"
      : doNow.length > 0
        ? `${doNow.length} need${doNow.length === 1 ? "s" : ""} you now. The rest can wait.`
        : open.length === 0
          ? "Nothing on your plate. A calm afternoon."
          : `${open.length} open. None urgent.`;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    createMut.mutate({ title: newTitle.trim() });
    setNewTitle("");
    setShowAdd(false);
  };

  return (
    <>
      <div className="main-header">
        <div className="main-header-left">
          <h1>Focus</h1>
          <div className="main-header-sub">Focus on what matters most</div>
          <div className="header-progress-bar">
            <div className="header-progress-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="header-actions">
          <button className="icon-btn" title="Sort">⇅</button>
          <button className="icon-btn" title="Refresh" onClick={() => qc.invalidateQueries({ queryKey: ["tasks"] })}>↻</button>
          <button className="icon-btn" title="How are you feeling?">✦</button>
          <button className="icon-btn" title="Help" style={{ fontSize: 13 }}>?</button>
          <div className="avatar-btn">SR</div>
        </div>
      </div>

      <div className="main-body">
        {/* Greeting strip */}
        <div className="greeting-strip" onClick={() => setShowAdd(true)}>
          <div className="greeting-orb-small" />
          <div className="greeting-text">
            <strong>{greeting}</strong>
            <span>{subline}</span>
          </div>
          <button
            type="button"
            className="greeting-cta"
            onClick={(e) => {
              e.stopPropagation();
              setShowAdd((s) => !s);
            }}
          >
            + Add task
          </button>
        </div>

        {showAdd && (
          <form
            onSubmit={submit}
            className="surface-card fade-in"
            style={{ padding: 14, marginBottom: 16, display: "flex", gap: 8 }}
          >
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="What needs doing?"
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                fontSize: 14,
                color: "var(--ink)",
                fontFamily: "inherit",
              }}
            />
            <button
              type="submit"
              className="btn-done"
              disabled={createMut.isPending || !newTitle.trim()}
            >
              {createMut.isPending ? "Adding…" : "Add"}
            </button>
            <button
              type="button"
              className="btn-done"
              style={{ background: "var(--navy-soft)", color: "var(--muted)" }}
              onClick={() => setShowAdd(false)}
            >
              Cancel
            </button>
          </form>
        )}

        {/* View tabs */}
        <div className="view-tabs">
          {(["focus", "today", "all"] as const).map((t) => (
            <button
              key={t}
              className={`view-tab ${tab === t ? "active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t === "focus" ? "Focus" : t === "today" ? "Today" : "All"}
            </button>
          ))}
        </div>

        <UpcomingEventsCard />

        <Section
          label="Do now"
          dotColor="var(--urgent)"
          tasks={tab === "all" ? open : doNow}
          empty="Nothing urgent. Breathe."
          onToggle={(id, d) => toggleMut.mutate({ id, done: d })}
          onDelete={(id) => deleteMut.mutate(id)}
        />
        {tab !== "focus" && (
          <Section
            label="Do today"
            dotColor="var(--teal)"
            tasks={doToday}
            empty="Nothing else queued for today."
            onToggle={(id, d) => toggleMut.mutate({ id, done: d })}
            onDelete={(id) => deleteMut.mutate(id)}
          />
        )}
        {tab !== "focus" && (
          <Section
            label="Coming up"
            dotColor="var(--navy-mid)"
            tasks={comingUp}
            empty="Nothing waiting in the wings."
            onToggle={(id, d) => toggleMut.mutate({ id, done: d })}
            onDelete={(id) => deleteMut.mutate(id)}
          />
        )}
      </div>
    </>
  );
}

type TaskRow = {
  id: string;
  title: string;
  notes: string | null;
  priority: "high" | "medium" | "low";
  energy: "high" | "medium" | "low";
  status: "todo" | "done" | "snoozed";
  due_at: string | null;
  estimated_minutes?: number | null;
};

function Section({
  label,
  dotColor,
  tasks,
  empty,
  onToggle,
  onDelete,
}: {
  label: string;
  dotColor: string;
  tasks: TaskRow[];
  empty: string;
  onToggle: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <section className="task-section fade-in">
      <div className="task-section-head">
        <div className="task-section-dot" style={{ background: dotColor }} />
        <span className="task-section-label">{label}</span>
        <span className="task-section-count">{tasks.length}</span>
      </div>
      {tasks.length === 0 ? (
        <div className="empty-state">{empty}</div>
      ) : (
        <div className="task-list">
          {tasks.map((t) => (
            <TaskCard
              key={t.id}
              task={{
                id: t.id,
                title: t.title,
                notes: t.notes ?? undefined,
                priority: t.priority,
                energy: t.energy,
                dueBucket:
                  bucketOf(t.due_at) === "now"
                    ? "now"
                    : bucketOf(t.due_at) === "today"
                      ? "today"
                      : bucketOf(t.due_at) === "week"
                        ? "week"
                        : "later",
                dueAt: t.due_at,
                done: t.status === "done",
                estimatedMinutes: t.estimated_minutes,
              }}
              onToggle={(d) => onToggle(t.id, d)}
              onDelete={() => onDelete(t.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
