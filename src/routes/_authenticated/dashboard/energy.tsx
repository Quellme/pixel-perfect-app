import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Zap, Flame, Wind } from "lucide-react";
import { TaskCard } from "@/components/dashboard/TaskCard";
import { listTasks, toggleTask, deleteTask } from "@/lib/tasks.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/dashboard/energy")({
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: EnergyView,
});

function bucketOf(due_at: string | null): "now" | "today" | "week" | "later" {
  if (!due_at) return "later";
  const diffH = (new Date(due_at).getTime() - Date.now()) / 36e5;
  if (diffH < 3) return "now";
  if (diffH < 24) return "today";
  if (diffH < 24 * 7) return "week";
  return "later";
}

function EnergyView() {
  const qc = useQueryClient();
  const list = useServerFn(listTasks);
  const toggle = useServerFn(toggleTask);
  const remove = useServerFn(deleteTask);
  const { data: tasks = [] } = useQuery({ queryKey: ["tasks"], queryFn: () => list() });

  const toggleMut = useMutation({
    mutationFn: (v: { id: string; done: boolean }) => toggle({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const open = tasks.filter((t) => t.status !== "done");
  const groups = [
    { label: "High focus needed", icon: Flame, energy: "high" as const, tone: "text-[#c0392b]" },
    { label: "Medium effort", icon: Zap, energy: "medium" as const, tone: "text-navy" },
    { label: "Quick wins", icon: Wind, energy: "low" as const, tone: "text-teal-dark" },
  ];

  return (
    <div className="max-w-[860px] mx-auto px-6 lg:px-10 py-8">
      <header className="mb-8 fade-in">
        <h1 className="font-display text-[32px] leading-tight text-ink">By Energy</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Match the task to the energy you have right now.
        </p>
      </header>
      {groups.map(({ label, icon: Icon, energy, tone }) => {
        const items = open.filter((t) => t.energy === energy);
        return (
          <section key={label} className="mb-8">
            <div className={`flex items-center gap-2 mb-3 ${tone}`}>
              <Icon size={16} />
              <h2 className="font-ui font-bold text-sm uppercase tracking-wider">{label}</h2>
              <span className="text-xs text-muted-foreground">{items.length}</span>
            </div>
            <div className="space-y-3">
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground italic px-1">Nothing here.</p>
              ) : (
                items.map((t) => (
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
                      done: false,
                    }}
                    onToggle={(done) => toggleMut.mutate({ id: t.id, done })}
                    onDelete={() => deleteMut.mutate(t.id)}
                  />
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
