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
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace("#", ""));

      const error =
        searchParams.get("error_description") ||
        searchParams.get("error") ||
        hashParams.get("error_description") ||
        hashParams.get("error");

      if (error) {
        setErrorMessage(error);
        return;
      }

      const code = searchParams.get("code");

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

        if (exchangeError) {
          setErrorMessage(exchangeError.message);
          return;
        }
      } else {
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");

        if (!accessToken || !refreshToken) {
          setErrorMessage("No authentication session was returned.");
          return;
        }

        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (sessionError) {
          setErrorMessage(sessionError.message);
          return;
        }
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
