import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { Orb } from "@/components/Orb";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Arelo" },
      { name: "description", content: "Sign in to Arelo, your calm email companion." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { session, loading } = useSession();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/dashboard" });
  }, [session, loading, navigate]);

  const signInGoogle = async () => {
    setGoogleLoading(true);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      toast.error("Couldn't start Google sign-in. Try again in a moment.");
      setGoogleLoading(false);
    }
  };

  const sendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSending(true);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    setSending(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Check your inbox for a sign-in link.");
  };

  return (
    <main className="login-bg flex min-h-screen items-center justify-center p-4">
      <div className="glass-card w-[min(420px,100%)] rounded-3xl p-8 fade-in">
        <div className="flex flex-col items-center gap-3 text-center">
          <Orb size="large" />
          <h1 className="font-ui text-white text-[28px]" style={{ fontWeight: 800 }}>
            Arelo
          </h1>
          <p className="text-white/70 text-sm">Your calm in the inbox</p>
        </div>

        <div className="mt-8 space-y-4">
          <button
            type="button"
            onClick={signInGoogle}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 rounded-xl bg-white text-[#1e2e3e] font-ui font-semibold py-3 text-sm shadow-md hover:bg-white/95 transition disabled:opacity-60"
          >
            <GoogleIcon />
            {googleLoading ? "Opening Google…" : "Sign in with Google"}
          </button>

          <div className="flex items-center gap-3 text-white/40 text-xs">
            <div className="h-px flex-1 bg-white/15" />
            or
            <div className="h-px flex-1 bg-white/15" />
          </div>

          <form onSubmit={sendMagicLink} className="space-y-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl bg-white/8 border border-white/15 text-white placeholder:text-white/40 px-4 py-3 text-sm focus:outline-none focus:border-[#5bbfbf]/60"
            />
            <button
              type="submit"
              disabled={sending}
              className="w-full rounded-xl border border-[#5bbfbf]/50 text-[#5bbfbf] font-ui font-semibold py-3 text-sm hover:bg-[#5bbfbf]/10 transition disabled:opacity-60"
            >
              {sending ? "Sending…" : "Send sign-in link"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-[11px] text-white/40">
          By signing in you agree to be treated with care.
        </p>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 01-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.32A9 9 0 009 18z" />
      <path fill="#FBBC05" d="M3.97 10.72A5.41 5.41 0 013.68 9c0-.6.1-1.18.29-1.72V4.96H.96A9 9 0 000 9c0 1.45.35 2.83.96 4.04l3.01-2.32z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.89 11.43 0 9 0A9 9 0 00.96 4.96L3.97 7.28C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}
