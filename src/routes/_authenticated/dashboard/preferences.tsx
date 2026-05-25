import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/preferences")({
  component: PreferencesView,
});

function PreferencesView() {
  const { session } = useSession();
  const [displayName, setDisplayName] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!session?.user) return;
    supabase
      .from("profiles")
      .select("display_name, timezone")
      .eq("user_id", session.user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setDisplayName(data.display_name ?? "");
          setTimezone(data.timezone ?? "UTC");
        }
      });
  }, [session?.user]);

  const save = async () => {
    if (!session?.user) return;
    setLoading(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName, timezone })
      .eq("user_id", session.user.id);
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success("Preferences saved");
  };

  return (
    <div className="max-w-[640px] mx-auto px-6 lg:px-10 py-8">
      <header className="mb-6 fade-in">
        <h1 className="font-display text-[32px] leading-tight text-ink">Preferences</h1>
        <p className="text-sm text-muted-foreground mt-1">Your account details.</p>
      </header>

      <div className="surface-card p-6 space-y-5">
        <div>
          <label className="block text-xs font-ui font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
            Email
          </label>
          <div className="text-sm text-ink">{session?.user?.email}</div>
        </div>

        <div>
          <label className="block text-xs font-ui font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
            Display name
          </label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-navy-line bg-surface text-sm focus:outline-none focus:border-teal text-ink"
          />
        </div>

        <div>
          <label className="block text-xs font-ui font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
            Timezone
          </label>
          <input
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            placeholder="e.g. Europe/London"
            className="w-full px-3 py-2 rounded-xl border border-navy-line bg-surface text-sm focus:outline-none focus:border-teal text-ink"
          />
        </div>

        <button
          onClick={save}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-navy text-white text-sm font-ui font-semibold hover:bg-navy-dark transition disabled:opacity-50"
        >
          {loading ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
