import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callAI, EMAIL_SYS } from "./enrichment-helpers.server";
import { signState } from "./google-oauth.server";

const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar.readonly",
].join(" ");

const CategoryEnum = z.enum(["work", "personal"]);

export const getGoogleAuthUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        origin: z.string().url(),
        category: CategoryEnum.default("personal"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    if (!clientId) throw new Error("GOOGLE_OAUTH_CLIENT_ID not configured");
    const redirectUri = `${data.origin}/api/oauth/google/callback`;
    const state = signState(
      JSON.stringify({
        userId: context.userId,
        origin: data.origin,
        category: data.category,
      }),
    );
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: SCOPES,
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      state,
    });
    return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` };
  });

export const listIntegrations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("user_integrations")
      .select("id, provider, account_email, category, label, scope, expires_at, updated_at")
      .eq("provider", "google")
      .order("created_at", { ascending: true });
    return data ?? [];
  });

export const updateIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        category: CategoryEnum.optional(),
        label: z.string().max(80).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const patch: { category?: "work" | "personal"; label?: string | null } = {};
    if (data.category) patch.category = data.category;
    if (data.label !== undefined) patch.label = data.label;
    if (!Object.keys(patch).length) return { ok: true };
    const { error } = await context.supabase
      .from("user_integrations")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const disconnectIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await context.supabase.from("user_integrations").delete().eq("id", data.id);
    // refresh profile flags
    const { data: remaining } = await context.supabase
      .from("user_integrations")
      .select("id")
      .eq("provider", "google")
      .limit(1);
    if (!remaining?.length) {
      await context.supabase
        .from("profiles")
        .update({ gmail_connected: false, calendar_connected: false })
        .eq("user_id", context.userId);
    }
    return { ok: true };
  });

type IntegrationRow = {
  id: string;
  user_id: string;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
};

async function getFreshAccessToken(row: IntegrationRow): Promise<string> {
  const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : 0;
  if (expiresAt - Date.now() > 60_000) return row.access_token;
  if (!row.refresh_token) throw new Error("No refresh token; reconnect Google");

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
    client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
    refresh_token: row.refresh_token,
    grant_type: "refresh_token",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`);
  const tok = (await res.json()) as { access_token: string; expires_in: number };
  const newExpiry = new Date(Date.now() + tok.expires_in * 1000).toISOString();
  await supabaseAdmin
    .from("user_integrations")
    .update({ access_token: tok.access_token, expires_at: newExpiry })
    .eq("id", row.id);
  return tok.access_token;
}

async function gFetch(token: string, url: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Google API ${res.status}: ${await res.text()}`);
  return res.json();
}

export const syncGmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: accounts } = await context.supabase
      .from("user_integrations")
      .select("id, user_id, access_token, refresh_token, expires_at")
      .eq("provider", "google");
    if (!accounts?.length) return { count: 0 };

    let total = 0;
    for (const acct of accounts) {
      const token = await getFreshAccessToken(acct);
      const list = (await gFetch(
        token,
        "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=15&q=in:inbox",
      )) as { messages?: Array<{ id: string; threadId: string }> };
      if (!list.messages?.length) continue;

      type ThreadRow = {
        user_id: string;
        account_id: string;
        gmail_thread_id: string;
        subject: string;
        from_address: string | null;
        snippet: string | null;
        received_at: string | null;
        importance_score: number;
        is_processed: boolean;
      };
      const seen = new Map<string, ThreadRow>();
      for (const m of list.messages) {
        const msg = (await gFetch(
          token,
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
        )) as {
          id: string;
          threadId: string;
          snippet?: string;
          internalDate?: string;
          payload?: { headers?: Array<{ name: string; value: string }> };
        };
        const headers = msg.payload?.headers ?? [];
        const get = (n: string) =>
          headers.find((h) => h.name.toLowerCase() === n.toLowerCase())?.value;
        seen.set(msg.threadId, {
          user_id: context.userId,
          account_id: acct.id,
          gmail_thread_id: msg.threadId,
          subject: get("Subject") ?? "(no subject)",
          from_address: get("From") ?? null,
          snippet: msg.snippet ?? null,
          received_at: msg.internalDate
            ? new Date(Number(msg.internalDate)).toISOString()
            : null,
          importance_score: 0,
          is_processed: false,
        });
      }

      for (const r of seen.values()) {
        // Manual upsert keyed by (user_id, account_id, gmail_thread_id).
        const { data: existing } = await context.supabase
          .from("email_threads")
          .select("id")
          .eq("user_id", r.user_id)
          .eq("account_id", r.account_id)
          .eq("gmail_thread_id", r.gmail_thread_id)
          .maybeSingle();
        if (existing) {
          await context.supabase
            .from("email_threads")
            .update({
              subject: r.subject,
              from_address: r.from_address,
              snippet: r.snippet,
              received_at: r.received_at,
            })
            .eq("id", existing.id);
        } else {
          await context.supabase.from("email_threads").insert(r);
        }
      }
      total += seen.size;
    }

    // Batch triage across all accounts
    try {
      const { data: untriaged } = await context.supabase
        .from("email_threads")
        .select("id, subject, from_address, snippet")
        .eq("user_id", context.userId)
        .is("short_summary", null)
        .order("received_at", { ascending: false })
        .limit(10);

      if (untriaged?.length) {
        await Promise.all(
          untriaged.map(async (row) => {
            try {
              const ai = await callAI(
                EMAIL_SYS,
                `SUBJECT: ${row.subject ?? "(no subject)"}\nFROM: ${row.from_address ?? "(unknown)"}\nPREVIEW: ${row.snippet ?? "(none)"}`,
              );
              const update: {
                action_required?: boolean;
                short_summary?: string;
                estimated_minutes?: number;
                category?: "action" | "aware" | "delivery" | "promo" | "other";
              } = {};
              if (typeof ai.action_required === "boolean")
                update.action_required = ai.action_required;
              if (ai.short_summary)
                update.short_summary = ai.short_summary.slice(0, 200);
              if (typeof ai.estimated_minutes === "number")
                update.estimated_minutes = ai.estimated_minutes;
              if (ai.category) update.category = ai.category;
              if (Object.keys(update).length) {
                await context.supabase.from("email_threads").update(update).eq("id", row.id);
              }
            } catch (e) {
              console.error("triage failed for", row.id, e);
            }
          }),
        );
      }
    } catch (e) {
      console.error("batch triage error", e);
    }

    return { count: total };
  });

export const syncCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: accounts } = await context.supabase
      .from("user_integrations")
      .select("id, user_id, access_token, refresh_token, expires_at")
      .eq("provider", "google");
    if (!accounts?.length) return { count: 0 };

    const timeMin = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const timeMax = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString();

    let total = 0;
    for (const acct of accounts) {
      const token = await getFreshAccessToken(acct);
      const url =
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
        new URLSearchParams({
          timeMin,
          timeMax,
          singleEvents: "true",
          orderBy: "startTime",
          maxResults: "50",
        });
      const list = (await gFetch(token, url)) as {
        items?: Array<{
          id: string;
          summary?: string;
          description?: string;
          location?: string;
          start?: { dateTime?: string; date?: string };
          end?: { dateTime?: string; date?: string };
        }>;
      };

      await context.supabase
        .from("calendar_events")
        .delete()
        .eq("source", "google")
        .eq("account_id", acct.id)
        .gte("starts_at", timeMin);

      type EventRow = {
        user_id: string;
        account_id: string;
        title: string;
        description: string | null;
        location: string | null;
        starts_at: string;
        ends_at: string;
        source: string;
        source_ref: string;
      };
      const rows: EventRow[] = [];
      for (const ev of list.items ?? []) {
        const start = ev.start?.dateTime ?? ev.start?.date;
        const end = ev.end?.dateTime ?? ev.end?.date;
        if (!start || !end) continue;
        rows.push({
          user_id: context.userId,
          account_id: acct.id,
          title: ev.summary ?? "(untitled)",
          description: ev.description ?? null,
          location: ev.location ?? null,
          starts_at: new Date(start).toISOString(),
          ends_at: new Date(end).toISOString(),
          source: "google",
          source_ref: ev.id,
        });
      }
      if (rows.length) {
        await context.supabase.from("calendar_events").insert(rows);
      }
      total += rows.length;
    }
    return { count: total };
  });

const CategoryFilter = z
  .object({ category: z.enum(["work", "personal", "all"]).default("all") })
  .default({ category: "all" });

async function accountIdsForCategory(
  supabase: typeof supabaseAdmin,
  category: "work" | "personal" | "all",
): Promise<string[] | null> {
  if (category === "all") return null;
  const { data } = await supabase
    .from("user_integrations")
    .select("id")
    .eq("provider", "google")
    .eq("category", category);
  return (data ?? []).map((r) => r.id);
}

export const listEmailThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => CategoryFilter.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const ids = await accountIdsForCategory(context.supabase, data.category);
    let q = context.supabase
      .from("email_threads")
      .select("*")
      .order("received_at", { ascending: false })
      .limit(30);
    if (ids !== null) {
      if (!ids.length) return [];
      q = q.in("account_id", ids);
    }
    const { data: rows } = await q;
    return rows ?? [];
  });

export const listCalendarEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => CategoryFilter.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const ids = await accountIdsForCategory(context.supabase, data.category);
    let q = context.supabase
      .from("calendar_events")
      .select("*")
      .gte("starts_at", new Date(Date.now() - 12 * 3600 * 1000).toISOString())
      .order("starts_at", { ascending: true })
      .limit(50);
    if (ids !== null) {
      if (!ids.length) return [];
      q = q.in("account_id", ids);
    }
    const { data: rows } = await q;
    return rows ?? [];
  });
