import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const error = params.get("error_description") || params.get("error");

      if (error) {
        setErrorMessage(error);
        return;
      }

      if (!code) {
        setErrorMessage("No authentication code was returned.");
        return;
      }

      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

      if (exchangeError) {
        setErrorMessage(exchangeError.message);
        return;
      }

      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        setErrorMessage("Session was not created after Google sign-in.");
        return;
      }

      navigate({ to: "/dashboard", replace: true });
    };

    run();
  }, [navigate]);

  if (errorMessage) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#142638] text-white p-6">
        <div className="max-w-lg rounded-2xl bg-white/10 p-6 text-center">
          <h1 className="text-xl font-bold mb-3">Sign-in failed</h1>
          <p className="text-sm text-white/80">{errorMessage}</p>
          <a href="/login" className="mt-5 inline-block underline">
            Back to login
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#142638] text-white">
      Signing you in...
    </main>
  );
}
