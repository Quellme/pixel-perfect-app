import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listCalendarEvents, syncCalendar } from "@/lib/google-oauth.functions";

export function UpcomingEventsCard() {
  const qc = useQueryClient();
  const list = useServerFn(listCalendarEvents);
  const doSync = useServerFn(syncCalendar);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["calendar-events"],
    queryFn: () => list(),
  });

  const syncMut = useMutation({
    mutationFn: () => doSync(),
    onSuccess: (r) => {
      toast.success(`Calendar synced — ${r.count} events`);
      qc.invalidateQueries({ queryKey: ["calendar-events"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const next10 = events.slice(0, 10);

  return (
    <section className="surface-card p-5 fade-in" style={{ marginBottom: 16 }}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-display text-lg text-ink leading-tight">Next on your calendar</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            The next 10, in the order they happen.
          </p>
        </div>
        <button
          onClick={() => syncMut.mutate()}
          disabled={syncMut.isPending}
          className="px-3 py-1.5 rounded-xl border border-border text-xs font-ui font-semibold hover:bg-muted transition disabled:opacity-50 shrink-0"
        >
          {syncMut.isPending ? "Syncing…" : "Sync Calendar Now"}
        </button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-4">Loading…</div>
      ) : next10.length === 0 ? (
        <div className="text-sm text-muted-foreground py-4">
          Nothing on the calendar yet. Tap Sync when you're ready.
        </div>
      ) : (
        <ul className="space-y-2">
          {next10.map((ev) => {
            const start = new Date(ev.starts_at);
            const day = start.toLocaleDateString(undefined, {
              weekday: "short",
              day: "numeric",
              month: "short",
            });
            const time = start.toLocaleTimeString(undefined, {
              hour: "2-digit",
              minute: "2-digit",
            });
            return (
              <li
                key={ev.id}
                className="flex gap-3 items-baseline py-1.5 border-b border-navy-line last:border-b-0"
              >
                <div className="w-28 shrink-0 text-xs font-ui font-semibold text-teal">
                  {day} · {time}
                </div>
                <div className="flex-1 min-w-0 text-sm text-ink truncate">{ev.title}</div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
