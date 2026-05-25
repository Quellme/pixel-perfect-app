type Priority = "high" | "medium" | "low";
type Energy = "high" | "medium" | "low";

export type TaskCardData = {
  id: string;
  title: string;
  notes?: string;
  source?: string;
  priority: Priority;
  energy: Energy;
  dueBucket: "now" | "today" | "week" | "later";
  dueAt?: string | null;
  done: boolean;
  estimatedMinutes?: number | null;
};

const BUCKET_LABEL: Record<TaskCardData["dueBucket"], string> = {
  now: "Now",
  today: "Today",
  week: "This week",
  later: "Later",
};

function formatDue(iso?: string | null): { short: string; full: string; overdue: boolean } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;
  const time = hasTime
    ? d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : "";
  let short: string;
  if (sameDay) short = time ? `Today · ${time}` : "Today";
  else if (isTomorrow) short = time ? `Tomorrow · ${time}` : "Tomorrow";
  else {
    const sameYear = d.getFullYear() === now.getFullYear();
    short = d.toLocaleDateString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
      ...(sameYear ? {} : { year: "numeric" }),
    });
    if (time) short += ` · ${time}`;
  }
  const full = d.toLocaleString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    ...(hasTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
  return { short, full, overdue: d.getTime() < now.getTime() };
}

export function TaskCard({
  task,
  onToggle,
  onDelete,
}: {
  task: TaskCardData;
  onToggle?: (done: boolean) => void;
  onDelete?: () => void;
}) {
  const due = formatDue(task.dueAt);
  const urgent = task.priority === "high" || due?.overdue;
  const quick = task.energy === "low" && task.priority !== "high";

  const cardClass = [
    "task-card",
    task.done ? "is-done" : "",
    task.priority === "high" ? "priority-high" : "",
    quick && !task.done ? "quick-win" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const dueLabel = due?.short ?? BUCKET_LABEL[task.dueBucket];

  return (
    <article className={cardClass} onClick={() => onDelete && undefined}>
      <div className="task-card-indicator" />
      <div className="task-card-body">
        {task.source && <div className="task-card-source">{task.source}</div>}
        <div className="task-card-title">{task.title}</div>
        {task.notes && <div className="task-card-note">{task.notes}</div>}
        <div className="task-card-chips">
          {urgent && <span className="chip urgent">⚡ Urgent</span>}
          {dueLabel && (
            <span className="chip due" title={due?.full ?? undefined}>
              📅 {dueLabel}
            </span>
          )}
          {task.estimatedMinutes && (
            <span className="chip">
              ⏱ {task.estimatedMinutes < 60 ? `${task.estimatedMinutes} min` : `${Math.round(task.estimatedMinutes / 60)}h`}
            </span>
          )}
          {quick && <span className="chip quick">✨ Quick win</span>}
          <span className="chip">{task.energy} energy</span>
        </div>
      </div>
      <div className="task-card-action">
        <button
          className="btn-done"
          onClick={(e) => {
            e.stopPropagation();
            onToggle?.(!task.done);
          }}
          title={task.done ? "Reopen" : "Mark done"}
        >
          {task.done ? "Reopen" : "Done"}
        </button>
      </div>
    </article>
  );
}
