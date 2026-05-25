export type AiOut = {
  short_summary?: string;
  estimated_minutes?: number;
  action_required?: boolean;
  micro_steps?: string[];
  category?: "action" | "aware" | "delivery" | "promo" | "other";
};

export async function callAI(
  systemPrompt: string,
  userPrompt: string,
): Promise<AiOut> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 429) throw new Error("AI rate-limited. Try again shortly.");
    if (res.status === 402) throw new Error("AI credits exhausted.");
    throw new Error(`AI error: ${text}`);
  }
  const json = await res.json();
  const raw = json.choices?.[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(raw) as AiOut;
  } catch {
    return {};
  }
}

export const TASK_SYS = `You help a neurodivergent / overwhelmed user understand their tasks quickly.
Return JSON ONLY with this shape:
{"short_summary":"one calm sentence, max 14 words","estimated_minutes":N,"micro_steps":["step 1","step 2","step 3"]}

Rules:
- estimated_minutes: realistic for a focused adult. Snap to 5, 10, 15, 30, 45, 60, 90, 120.
- micro_steps: 2-5 concrete tiny steps. Each step <= 8 words. Action verbs. Include "open …", "send …" etc.
- short_summary: gentle, no shame, no exclamation marks.
- Never invent specifics not in the input.`;

export const EMAIL_SYS = `You triage an email for a neurodivergent / overwhelmed user.
Return JSON ONLY:
{"action_required":true|false,"category":"action|aware|delivery|promo|other","short_summary":"one calm sentence, max 14 words","estimated_minutes":N,"micro_steps":["…"]}

Rules:
- category:
  * "action" = user must reply, decide, click, pay, schedule, fill out, confirm
  * "delivery" = shipping, order confirmation, tracking, package arriving, refund, return, receipt for a physical/digital order
  * "promo" = newsletter, marketing, sale, "% off", anything they could safely unsubscribe from
  * "aware" = informational, FYI, security alerts, calendar invites already accepted, status updates that need no action
  * "other" = anything else (personal, social, ambiguous)
- action_required: true ONLY when category is "action".
- estimated_minutes: 5,10,15,30,45,60. 0 if no action.
- micro_steps: 2-4 tiny steps, max 8 words each. Empty array if no action.
- short_summary: what it's about + what's needed, in plain calm language. No exclamation marks.`;
