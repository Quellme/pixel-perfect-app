import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listEmailThreads } from "@/lib/google-oauth.functions";
import { GoogleConnectCard } from "@/components/dashboard/GoogleConnectCard";
import { CategoryFilter, type AccountCategory } from "@/components/dashboard/CategoryFilter";

export const Route = createFileRoute("/_authenticated/dashboard/emails")({
  component: EmailsView,
});

function EmailsView() {
  const list = useServerFn(listEmailThreads);
  const [category, setCategory] = useState<AccountCategory>("all");
  const { data: threads = [] } = useQuery({
    queryKey: ["email-threads", category],
    queryFn: () => list({ data: { category } }),
  });

  const lastUpdated = threads.reduce<Date | null>((latest, t) => {
    const d = t.updated_at ? new Date(t.updated_at) : null;
    if (!d) return latest;
    return !latest || d > latest ? d : latest;
  }, null);

  return (
    <div className="max-w-[860px] mx-auto px-6 lg:px-10 py-8">
      <header className="mb-6 fade-in flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[32px] leading-tight text-ink">Emails</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Recent threads from your inbox.
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

      {threads.length === 0 ? (
        <div className="surface-card p-12 text-center">
          <p className="text-sm text-muted-foreground">
            No emails yet. Connect Google and sync.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {threads.map((t) => (
            <div key={t.id} className="surface-card p-4">
              <div className="flex items-baseline justify-between gap-3 mb-1">
                <div className="font-ui font-semibold text-ink truncate">
                  {t.subject ?? "(no subject)"}
                </div>
                {t.received_at && (
                  <div className="text-xs text-muted-foreground shrink-0">
                    {new Date(t.received_at).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                    })}
                  </div>
                )}
              </div>
              <div className="text-xs text-muted-foreground truncate mb-1">
                {t.from_address}
              </div>
              {t.snippet && (
                <div className="text-sm text-ink/70 line-clamp-2">{t.snippet}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
