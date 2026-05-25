import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  disconnectIntegration,
  getGoogleAuthUrl,
  listIntegrations,
  syncCalendar,
  syncGmail,
  updateIntegration,
} from "@/lib/google-oauth.functions";

type Category = "work" | "personal";

export function GoogleConnectCard() {
  const qc = useQueryClient();
  const list = useServerFn(listIntegrations);
  const getUrl = useServerFn(getGoogleAuthUrl);
  const update = useServerFn(updateIntegration);
  const disconnect = useServerFn(disconnectIntegration);
  const doSyncGmail = useServerFn(syncGmail);
  const doSyncCal = useServerFn(syncCalendar);

  const [pickerOpen, setPickerOpen] = useState(false);

  const { data: accounts = [] } = useQuery({
    queryKey: ["integrations-google"],
    queryFn: () => list(),
  });

  const connectMut = useMutation({
    mutationFn: async (category: Category) => {
      const { url } = await getUrl({
        data: { origin: window.location.origin, category },
      });
      window.location.href = url;
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const syncMut = useMutation({
    mutationFn: async () => {
      const [g, c] = await Promise.all([doSyncGmail(), doSyncCal()]);
      return { gmail: g.count, calendar: c.count };
    },
    onSuccess: (r) => {
      toast.success(`Synced ${r.gmail} emails and ${r.calendar} events`);
      qc.invalidateQueries({ queryKey: ["email-threads"] });
      qc.invalidateQueries({ queryKey: ["calendar-events"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: (vars: { id: string; category: Category }) =>
      update({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["integrations-google"] });
      qc.invalidateQueries({ queryKey: ["email-threads"] });
      qc.invalidateQueries({ queryKey: ["calendar-events"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const disconnectMut = useMutation({
    mutationFn: (id: string) => disconnect({ data: { id } }),
    onSuccess: () => {
      toast.success("Account removed");
      qc.invalidateQueries({ queryKey: ["integrations-google"] });
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "google") {
      toast.success("Google connected");
      window.history.replaceState({}, "", window.location.pathname);
      qc.invalidateQueries({ queryKey: ["integrations-google"] });
      syncMut.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!accounts.length) {
    return (
      <div className="surface-card p-6">
        <h3 className="font-display text-xl text-ink mb-1">Connect Google</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Pull in your Gmail inbox and Google Calendar events. You can connect
          multiple accounts and tag each one Work or Personal.
        </p>
        <CategoryPicker
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          onPick={(cat) => connectMut.mutate(cat)}
          pending={connectMut.isPending}
          triggerLabel="Connect Gmail + Calendar"
        />
      </div>
    );
  }

  return (
    <div className="surface-card p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="font-display text-xl text-ink mb-1">Connected accounts</h3>
          <p className="text-sm text-muted-foreground">
            Tag each account so you can filter Work and Personal separately.
          </p>
        </div>
        <button
          onClick={() => syncMut.mutate()}
          disabled={syncMut.isPending}
          className="px-3 py-1.5 rounded-xl bg-navy text-white text-xs font-ui font-semibold hover:bg-navy-dark transition disabled:opacity-50 shrink-0"
        >
          {syncMut.isPending ? "Syncing…" : "Sync all"}
        </button>
      </div>

      <ul className="space-y-2 mb-4">
        {accounts.map((a) => (
          <li
            key={a.id}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-navy-line bg-surface"
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm font-ui font-semibold text-ink truncate">
                {a.account_email ?? "Google account"}
              </div>
            </div>
            <div className="flex items-center gap-1 rounded-lg bg-muted p-0.5">
              {(["personal", "work"] as Category[]).map((c) => (
                <button
                  key={c}
                  onClick={() => updateMut.mutate({ id: a.id, category: c })}
                  className={`px-2.5 py-1 rounded-md text-xs font-ui font-semibold capitalize transition ${
                    a.category === c
                      ? "bg-white text-ink shadow-sm"
                      : "text-muted-foreground hover:text-ink"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            <button
              onClick={() => disconnectMut.mutate(a.id)}
              className="text-xs font-ui text-muted-foreground hover:text-ink transition px-2"
              title="Remove account"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      <CategoryPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onPick={(cat) => connectMut.mutate(cat)}
        pending={connectMut.isPending}
        triggerLabel="Add another account"
        variant="ghost"
      />
    </div>
  );
}

function CategoryPicker({
  open,
  onOpenChange,
  onPick,
  pending,
  triggerLabel,
  variant = "primary",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPick: (c: Category) => void;
  pending: boolean;
  triggerLabel: string;
  variant?: "primary" | "ghost";
}) {
  if (!open) {
    return (
      <button
        onClick={() => onOpenChange(true)}
        disabled={pending}
        className={
          variant === "primary"
            ? "px-4 py-2 rounded-xl bg-navy text-white text-sm font-ui font-semibold hover:bg-navy-dark transition disabled:opacity-50"
            : "px-4 py-2 rounded-xl border border-navy-line text-sm font-ui font-semibold text-ink hover:bg-muted transition disabled:opacity-50"
        }
      >
        {pending ? "Redirecting…" : triggerLabel}
      </button>
    );
  }
  return (
    <div className="rounded-xl border border-navy-line p-3 bg-surface">
      <div className="text-xs font-ui font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        Tag this account as
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onPick("personal")}
          disabled={pending}
          className="flex-1 px-3 py-2 rounded-lg bg-navy text-white text-sm font-ui font-semibold hover:bg-navy-dark transition disabled:opacity-50"
        >
          Personal
        </button>
        <button
          onClick={() => onPick("work")}
          disabled={pending}
          className="flex-1 px-3 py-2 rounded-lg bg-teal text-white text-sm font-ui font-semibold hover:opacity-90 transition disabled:opacity-50"
        >
          Work
        </button>
        <button
          onClick={() => onOpenChange(false)}
          className="px-3 py-2 rounded-lg text-sm font-ui text-muted-foreground hover:text-ink transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
