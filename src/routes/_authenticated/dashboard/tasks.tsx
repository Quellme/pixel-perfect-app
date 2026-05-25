import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { TaskCard } from "@/components/dashboard/TaskCard";
import { listTasks, toggleTask, deleteTask } from "@/lib/tasks.functions";
import { supabase } from "@/integrations/supabase/client";

const TABS = ["All", "Active", "Done"] as const;

export const Route = createFileRoute("/_authenticated/dashboard/tasks")({
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: TasksView,
});

function bucketOf(due_at: string | null): "now" | "today" | "week" | "later" {
  if (!due_at) return "later";
  const diffH = (new Date(due_at).getTime() - Date.now()) / 36e5;
  if (diffH < 3) return "now";
  if (diffH < 24) return "today";
  if (diffH < 24 * 7) return "week";
  return "later";
}

function TasksView() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Active");
  const list = useServerFn(listTasks);
  const toggle = useServerFn(toggleTask);
  const remove = useServerFn(deleteTask);
  const { data: all = [], isLoading } = useQuery({ queryKey: ["tasks"], queryFn: () => list() });

  const toggleMut = useMutation({
    mutationFn: (v: { id: string; done: boolean }) => toggle({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const tasks = all.filter((t) => {
    if (tab === "All") return true;
    if (tab === "Active") return t.status === "todo";
    return t.status === "done";
  });

  return (
    <div className="max-w-[860px] mx-auto px-6 lg:px-10 py-8">
      <header className="mb-6 fade-in">
        <h1 className="font-display text-[32px] leading-tight text-ink">My Tasks</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Everything Arelo's been holding for you.
        </p>
      </header>
      <div className="flex gap-1 mb-6 border-b border-navy-line">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-ui font-semibold border-b-2 transition ${
              tab === t
                ? "border-teal text-ink"
                : "border-transparent text-muted-foreground hover:text-ink"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : tasks.length === 0 ? (
          <EmptyState />
        ) : (
          tasks.map((t) => (
            <TaskCard
              key={t.id}
              task={{
                id: t.id,
                title: t.title,
                notes: t.notes ?? undefined,
                priority: t.priority,
                energy: t.energy,
                dueBucket: bucketOf(t.due_at),
                dueAt: t.due_at,
                done: t.status === "done",
              }}
              onToggle={(done) => toggleMut.mutate({ id: t.id, done })}
              onDelete={() => deleteMut.mutate(t.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-16">
      <div className="orb-mini mx-auto mb-4" />
      <p className="text-sm text-muted-foreground max-w-sm mx-auto">
        Your task list is clear. Arelo will let you know if anything needs attention.
      </p>
    </div>
  );
}
