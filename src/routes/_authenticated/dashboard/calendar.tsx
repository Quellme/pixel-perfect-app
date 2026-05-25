import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listCalendarEvents } from "@/lib/google-oauth.functions";
import { GoogleConnectCard } from "@/components/dashboard/GoogleConnectCard";
import { CategoryFilter, type AccountCategory } from "@/components/dashboard/CategoryFilter";

export const Route = createFileRoute("/_authenticated/dashboard/calendar")({
  component: CalendarView,
});

function CalendarView() {
  const list = useServerFn(listCalendarEvents);
  const [category, setCategory] = useState<AccountCategory>("all");
  const { data: events = [] } = useQuery({
    queryKey: ["calendar-events", category],
    queryFn: () => list({ data: { category } }),
  });

  // group by date
  const groups = new Map<string, typeof events>();
  for (const ev of events) {
    const d = new Date(ev.starts_at).toLocaleDateString(undefined, {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    if (!groups.has(d)) groups.set(d, []);
    groups.get(d)!.push(ev);
  }

  const lastUpdated = events.reduce<Date | null>((latest, e) => {
    const d = e.updated_at ? new Date(e.updated_at) : null;
    if (!d) return latest;
    return !latest || d > latest ? d : latest;
  }, null);

  return (
    <div className="max-w-[860px] mx-auto px-6 lg:px-10 py-8">
      <header className="mb-6 fade-in flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[32px] leading-tight text-ink">Calendar</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your week, with tasks alongside events.
          </p>
        </div>
        {lastUpdated && (
          <span className="text-xs font-ui font-semibold text-muted-foreground px-3 py-1.5 rounded-full bg-surface border border-navy-line shrink-0">
            Updated {lastUpdated.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </header>

      <div className="mb-6">
        <GoogleConnectCard />
      </div>

      <div className="mb-4">
        <CategoryFilter value={category} onChange={setCategory} />
      </div>

      {events.length === 0 ? (
        <div className="surface-card p-12 text-center">
          <p className="text-sm text-muted-foreground">
            No upcoming events. Connect Google and sync to see your week.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(groups.entries()).map(([day, list]) => (
            <section key={day}>
              <h2 className="text-xs font-ui font-bold uppercase tracking-wider text-muted-foreground mb-2">
                {day}
              </h2>
              <div className="space-y-2">
                {list.map((ev) => {
                  const start = new Date(ev.starts_at);
                  const end = new Date(ev.ends_at);
                  return (
                    <div key={ev.id} className="surface-card p-4 flex gap-4">
                      <div className="w-20 shrink-0 text-sm font-ui font-semibold text-teal">
                        {start.toLocaleTimeString(undefined, {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        <div className="text-xs font-normal text-muted-foreground">
                          {end.toLocaleTimeString(undefined, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-ui font-semibold text-ink">{ev.title}</div>
                        {ev.location && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            📍 {ev.location}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
