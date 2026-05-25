import { createFileRoute } from "@tanstack/react-router";
import { Orb } from "@/components/Orb";

export const Route = createFileRoute("/_authenticated/dashboard/agent")({
  component: AgentView,
});

function AgentView() {
  return (
    <div className="max-w-[720px] mx-auto px-6 lg:px-10 py-10">
      <header className="mb-8 flex items-center gap-4 fade-in">
        <Orb size="large" />
        <div>
          <h1 className="font-display text-[32px] leading-tight text-ink">Arelo Agent</h1>
          <p className="text-sm text-muted-foreground mt-1">
            The full conversation. The companion on the right is the same agent — this is just more room.
          </p>
        </div>
      </header>
      <div className="surface-card p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Agent conversation history will appear here once we wire up the Claude integration.
        </p>
      </div>
    </div>
  );
}
