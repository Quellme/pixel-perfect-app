import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ExtractedItem = z.object({
  kind: z.enum(["task", "event", "note"]),
  title: z.string().min(1).max(200),
  notes: z.string().max(2000).optional().nullable(),
  due_at: z.string().optional().nullable(), // ISO or null
  starts_at: z.string().optional().nullable(),
  ends_at: z.string().optional().nullable(),
  priority: z.enum(["high", "medium", "low"]).optional().nullable(),
});

const ExtractInput = z.object({
  text: z.string().max(8000).optional().nullable(),
  imageBase64: z.string().max(10_000_000).optional().nullable(), // ~7MB
  imageMime: z.string().max(80).optional().nullable(),
});

export const extractFromDump = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ExtractInput.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured yet.");

    if (!data.text && !data.imageBase64) {
      return { items: [] };
    }

    const now = new Date();
    const sys = `You are Arelo's brain-dump extractor. The user is dumping thoughts (text, photo of a list/whiteboard, or both). Extract concrete actionable items.

Today's date: ${now.toISOString().slice(0, 10)}. User timezone: assume UTC.

Return ONLY valid JSON with this exact shape:
{"items":[{"kind":"task|event|note","title":"...","notes":"...optional...","due_at":"ISO or null","starts_at":"ISO or null","ends_at":"ISO or null","priority":"high|medium|low or null"}]}

Rules:
- kind=task: actionable thing the user needs to do
- kind=event: has a clear time/date (meeting, appointment, flight)
- kind=note: reference info, list item, idea — not actionable yet
- Be generous: extract every distinct item, even tiny ones
- Resolve relative dates ("tomorrow", "Friday") against today's date
- If no due/time mentioned, set due_at/starts_at to null — never invent
- Keep titles short and human (max 80 chars). Put extra context in notes.
- Tone: warm and plain. No "URGENT!", no "MUST DO", no exclamation marks.
- If the input is empty or unreadable, return {"items":[]}.
- Never return markdown, never wrap in code fences.`;

    const userContent: Array<Record<string, unknown>> = [];
    if (data.text && data.text.trim()) {
      userContent.push({ type: "text", text: data.text.trim() });
    } else {
      userContent.push({ type: "text", text: "Extract everything actionable from the attached image." });
    }
    if (data.imageBase64) {
      const mime = data.imageMime || "image/jpeg";
      userContent.push({
        type: "image_url",
        image_url: { url: `data:${mime};base64,${data.imageBase64}` },
      });
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      if (res.status === 429) throw new Error("Lots of requests right now — give it a moment.");
      if (res.status === 402) throw new Error("AI credits are out. Top up in workspace settings.");
      throw new Error(`AI gateway error: ${err}`);
    }

    const json = await res.json();
    const raw = json.choices?.[0]?.message?.content ?? "{}";

    let parsed: { items?: unknown } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = String(raw).match(/\{[\s\S]*\}/);
      if (m) {
        try {
          parsed = JSON.parse(m[0]);
        } catch {
          parsed = { items: [] };
        }
      }
    }

    const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
    const items: z.infer<typeof ExtractedItem>[] = [];
    for (const it of rawItems) {
      const r = ExtractedItem.safeParse(it);
      if (r.success) items.push(r.data);
    }
    return { items };
  });

const CommitInput = z.object({
  items: z
    .array(
      z.object({
        kind: z.enum(["task", "event", "note"]),
        title: z.string().min(1).max(200),
        notes: z.string().max(2000).optional().nullable(),
        due_at: z.string().optional().nullable(),
        starts_at: z.string().optional().nullable(),
        ends_at: z.string().optional().nullable(),
        priority: z.enum(["high", "medium", "low"]).optional().nullable(),
      }),
    )
    .min(1)
    .max(50),
});

function safeIso(v: string | null | undefined): string | null {
  if (!v) return null;
  const t = Date.parse(v);
  return isNaN(t) ? null : new Date(t).toISOString();
}

export const commitDumpItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => CommitInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let tasks = 0;
    let events = 0;
    let notes = 0;

    for (const it of data.items) {
      if (it.kind === "task") {
        await supabase.from("tasks").insert({
          user_id: userId,
          title: it.title,
          notes: it.notes ?? null,
          priority: it.priority ?? "medium",
          due_at: safeIso(it.due_at),
          source: "agent",
        });
        tasks++;
      } else if (it.kind === "event") {
        const starts = safeIso(it.starts_at) ?? safeIso(it.due_at);
        if (!starts) continue;
        const ends = safeIso(it.ends_at) ?? new Date(new Date(starts).getTime() + 60 * 60 * 1000).toISOString();
        await supabase.from("calendar_events").insert({
          user_id: userId,
          title: it.title,
          description: it.notes ?? null,
          starts_at: starts,
          ends_at: ends,
          source: "manual",
        });
        events++;
      } else if (it.kind === "note") {
        await supabase.from("notes").insert({
          user_id: userId,
          title: it.title,
          body: it.notes ?? "",
          tags: ["brain-dump"],
        });
        notes++;
      }
    }

    return { tasks, events, notes };
  });
