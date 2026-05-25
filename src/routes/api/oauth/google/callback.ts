import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyState } from "@/lib/google-oauth.server";

export const Route = createFileRoute("/api/oauth/google/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const err = url.searchParams.get("error");

        const fail = (msg: string) =>
          new Response(
            `<html><body style="font-family:sans-serif;padding:40px;text-align:center"><h2>Connection failed</h2><p>${msg}</p><a href="/dashboard">Back to dashboard</a></body></html>`,
            { status: 400, headers: { "Content-Type": "text/html" } },
          );

        if (err) return fail(err);
        if (!code || !state) return fail("Missing code or state");

        const verified = verifyState(state);
        if (!verified) return fail("Invalid state");

        const { userId, origin, category = "personal" } = verified;
        const redirectUri = `${origin}/api/oauth/google/callback`;

        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code,
            client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
            client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
            redirect_uri: redirectUri,
            grant_type: "authorization_code",
          }),
        });
        if (!tokenRes.ok) return fail(`Token exchange failed: ${await tokenRes.text()}`);
        const tok = (await tokenRes.json()) as {
          access_token: string;
          refresh_token?: string;
          expires_in: number;
          scope: string;
          id_token?: string;
        };

        let accountEmail: string | null = null;
        try {
          const ui = await fetch(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            { headers: { Authorization: `Bearer ${tok.access_token}` } },
          );
          if (ui.ok) accountEmail = ((await ui.json()) as { email?: string }).email ?? null;
        } catch {
          // ignore
        }

        const expiresAt = new Date(Date.now() + tok.expires_in * 1000).toISOString();

        // Manual upsert keyed by (user_id, provider, account_email)
        const { data: existing } = await supabaseAdmin
          .from("user_integrations")
          .select("id, refresh_token, category")
          .eq("user_id", userId)
          .eq("provider", "google")
          .eq("account_email", accountEmail ?? "")
          .maybeSingle();

        if (existing) {
          const { error } = await supabaseAdmin
            .from("user_integrations")
            .update({
              access_token: tok.access_token,
              refresh_token: tok.refresh_token ?? existing.refresh_token,
              expires_at: expiresAt,
              scope: tok.scope,
              // keep existing category — user can change it in the UI
            })
            .eq("id", existing.id);
          if (error) return fail(error.message);
        } else {
          const { error } = await supabaseAdmin.from("user_integrations").insert({
            user_id: userId,
            provider: "google",
            access_token: tok.access_token,
            refresh_token: tok.refresh_token ?? null,
            expires_at: expiresAt,
            scope: tok.scope,
            account_email: accountEmail,
            category,
          });
          if (error) return fail(error.message);
        }

        await supabaseAdmin
          .from("profiles")
          .update({ gmail_connected: true, calendar_connected: true })
          .eq("user_id", userId);

        return new Response(null, {
          status: 302,
          headers: { Location: `${origin}/dashboard?connected=google` },
        });
      },
    },
  },
});
