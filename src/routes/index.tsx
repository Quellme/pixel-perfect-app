import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useSession } from "@/hooks/use-session";
import { Orb } from "@/components/Orb";

export const Route = createFileRoute("/")({
  component: IndexRedirect,
});

function IndexRedirect() {
  const { session, loading } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (session) navigate({ to: "/dashboard" });
    else navigate({ to: "/login" });
  }, [session, loading, navigate]);

  return (
    <div className="login-bg flex min-h-screen items-center justify-center">
      <Orb size="large" />
    </div>
  );
}
