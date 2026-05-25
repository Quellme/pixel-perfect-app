import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { toast } from "sonner";
import {
  listEmailThreads,
  syncGmail,
} from "@/lib/google-oauth.functions";
import { GoogleConnectCard } from "@/components/dashboard/GoogleConnectCard";
import { Orb } from "@/components/Orb";

export const Route = createFileRoute("/_authenticated/dashboard/check")({
  component: CheckView,
});

type EmailRow = {
  id: string;
  subject: string | null;
  from_address: string | null;
  snippet: string | null;
  short_summary: string | null;
  category: "action" | "aware" | "delivery" | "promo" | "other" | null;
  action_required: boolean | null;
  received_at: string | null;
};

function classifyFallback(e: EmailRow): EmailRow["category"] {
  if (e.category) return e.category;
  if (e.action_required) return "action";
  const text = `${e.subject ?? ""} ${e.from_address ?? ""} ${e.snippet ?? ""}`.toLowerCase();
  if (/shipp|deliver|tracking|order|dispatch|arriving|parcel|amazon\.|royal mail|dpd|fedex|ups\.|hermes|evri/.test(text)) {
    return "delivery";
  }
  if (/unsubscribe|newsletter|% off|sale|deal|promo|marketing|webinar/.test(text)) {
    return "promo";
  }
  return "other";
}

function senderName(addr: string | null): string {
  if (!addr) return "Unknown";
  const m = addr.match(/^"?([^"<]+?)"?\s*<.+>$/);
  if (m) return m[1].trim();
  return addr.split("@")[0];
}

function CheckView() {
  const qc = useQueryClient();
  const listFn = useServerFn(listEmailThreads);
  const syncFn = useServerFn(syncGmail);

  const { data: emails = [], isLoading } = useQuery({
    queryKey: ["email-threads", "all"],
    queryFn: () => listFn({ data: { category: "all" } }) as Promise<EmailRow[]>,
  });

  const syncMut = useMutation({
    mutationFn: () => syncFn(),
    onSuccess: (r) => {
      toast.success(`Synced ${r.count} emails`);
      qc.invalidateQueries({ queryKey: ["email-threads"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const groups = useMemo(() => {
    const g: Record<"action" | "aware" | "delivery" | "promo", EmailRow[]> = {
      action: [],
      aware: [],
      delivery: [],
      promo: [],
    };
    for (const e of emails) {
      const cat = classifyFallback(e);
      if (!cat || cat === "other") g.aware.push(e);
      else g[cat].push(e);
    }
    return g;
  }, [emails]);

  // Promo sender clustering for unsubscribe suggestions
  const unsubscribeClusters = useMemo(() => {
    const byDomain = new Map<string, EmailRow[]>();
    for (const e of groups.promo) {
      const dom =
        e.from_address?.match(/@([^>\s]+)/)?.[1]?.toLowerCase() ?? "unknown";
      if (!byDomain.has(dom)) byDomain.set(dom, []);
      byDomain.get(dom)!.push(e);
    }
    return Array.from(byDomain.entries())
      .map(([domain, items]) => ({ domain, items }))
      .sort((a, b) => b.items.length - a.items.length);
  }, [groups.promo]);

  const lastUpdated = emails.reduce<Date | null>((latest, e) => {
    const d = e.received_at ? new Date(e.received_at) : null;
    if (!d) return latest;
    return !latest || d > latest ? d : latest;
  }, null);

  return (
    <div className="max-w-[860px] mx-auto px-6 lg:px-10 py-8">
      <header className="mb-6 fade-in flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Orb size="large" />
          <div>
            <h1 className="font-display text-[32px] leading-tight text-ink">
              Arelo's Check
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Your inbox, sorted into what matters and what doesn't.
            </p>
          </div>
        </div>
        <button
          onClick={() => syncMut.mutate()}
          disabled={syncMut.isPending}
          className="px-3 py-1.5 rounded-xl bg-navy text-white text-xs font-ui font-semibold hover:bg-navy-dark transition disabled:opacity-50 shrink-0"
        >
          {syncMut.isPending ? "Syncing…" : "Sync now"}
        </button>
      </header>

      {!emails.length && !isLoading ? (
        <>
          <div className="mb-4">
            <GoogleConnectCard />
          </div>
          <div className="surface-card p-12 text-center">
            <p className="text-sm text-muted-foreground">
              Connect Google and sync to see your inbox grouped.
            </p>
          </div>
        </>
      ) : (
        <>
          {lastUpdated && (
            <div className="text-xs text-muted-foreground mb-4 font-ui">
              Last email received {lastUpdated.toLocaleString()}
            </div>
          )}

          <Group
            title="Needs doing"
            subtitle="Reply, decide, click, pay"
            tone="amber"
            items={groups.action}
            renderItem={(e) => <EmailRowView key={e.id} e={e} showSummary />}
            emptyMsg="Nothing waiting on you. Nice."
          />

          <Group
            title="Just so you know"
            subtitle="Updates, FYIs, notifications"
            tone="navy"
            items={groups.aware}
            renderItem={(e) => <EmailRowView key={e.id} e={e} />}
            emptyMsg="All quiet."
          />

          <Group
            title="Deliveries & orders"
            subtitle="Shipping, tracking, receipts"
            tone="teal"
            items={groups.delivery}
            renderItem={(e) => <EmailRowView key={e.id} e={e} />}
            emptyMsg="Nothing on the way."
          />

          {unsubscribeClusters.length > 0 && (
            <section className="mb-8">
              <div className="mb-3">
                <h2 className="font-ui font-bold text-sm uppercase tracking-wider text-muted-foreground">
                  Senders you could unsubscribe from
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Newsletters and promos — grouped by sender.
                </p>
              </div>
              <div className="space-y-2">
                {unsubscribeClusters.map((c) => (
                  <div
                    key={c.domain}
                    className="surface-card p-4 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-ui font-semibold text-ink truncate">
                        {senderName(c.items[0].from_address)}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {c.domain} · {c.items.length} email
                        {c.items.length > 1 ? "s" : ""}
                      </div>
                    </div>
                    <a
                      href={`https://mail.google.com/mail/u/0/#search/from%3A${encodeURIComponent(c.domain)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-ui font-semibold text-teal hover:text-teal-dark transition shrink-0"
                    >
                      Open in Gmail →
                    </a>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="mt-8">
            <Link
              to="/dashboard/emails"
              className="text-sm font-ui font-semibold text-muted-foreground hover:text-ink transition"
            >
              See everything in Emails →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

function Group({
  title,
  subtitle,
  tone,
  items,
  renderItem,
  emptyMsg,
}: {
  title: string;
  subtitle: string;
  tone: "amber" | "navy" | "teal";
  items: EmailRow[];
  renderItem: (e: EmailRow) => React.ReactNode;
  emptyMsg: string;
}) {
  const dotColor =
    tone === "amber" ? "#d97706" : tone === "teal" ? "var(--teal)" : "var(--navy)";
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-baseline gap-2">
        <span
          className="inline-block rounded-full"
          style={{ width: 8, height: 8, background: dotColor }}
        />
        <h2 className="font-ui font-bold text-sm uppercase tracking-wider text-ink">
          {title}
        </h2>
        <span className="text-xs text-muted-foreground">{items.length}</span>
        <span className="text-xs text-muted-foreground ml-2 normal-case font-normal">
          {subtitle}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground italic px-1">{emptyMsg}</p>
      ) : (
        <div className="space-y-2">{items.map(renderItem)}</div>
      )}
    </section>
  );
}

function EmailRowView({ e, showSummary }: { e: EmailRow; showSummary?: boolean }) {
  return (
    <div className="surface-card p-4">
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <div className="font-ui font-semibold text-ink truncate">
          {e.subject ?? "(no subject)"}
        </div>
        {e.received_at && (
          <div className="text-xs text-muted-foreground shrink-0">
            {new Date(e.received_at).toLocaleDateString(undefined, {
              day: "numeric",
              month: "short",
            })}
          </div>
        )}
      </div>
      <div className="text-xs text-muted-foreground truncate mb-1">
        {senderName(e.from_address)}
      </div>
      {showSummary && e.short_summary ? (
        <div className="text-sm text-ink/75 line-clamp-2">{e.short_summary}</div>
      ) : e.snippet ? (
        <div className="text-sm text-ink/60 line-clamp-1">{e.snippet}</div>
      ) : null}
    </div>
  );
}
