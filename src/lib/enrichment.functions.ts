import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callAI, TASK_SYS, EMAIL_SYS } from "./enrichment-helpers.server";


export const enrichTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid(),
        withBreakdown: z.boolean().default(false),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: task, error } = await context.supabase
      .from("tasks")
      .select("id, title, notes, due_at, priority, estimated_minutes, micro_steps, short_summary")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !task) throw new Error(error?.message ?? "Task not found");

    const needsBase = !task.estimated_minutes || !task.short_summary;
    const needsSteps =
      data.withBreakdown && (!task.micro_steps || (task.micro_steps as unknown[]).length === 0);

    if (!needsBase && !needsSteps) {
      return {
        estimated_minutes: task.estimated_minutes,
        short_summary: task.short_summary,
        micro_steps: task.micro_steps,
      };
    }

    const userPrompt = `TITLE: ${task.title}
NOTES: ${task.notes ?? "(none)"}
DUE: ${task.due_at ?? "(no due date)"}
PRIORITY: ${task.priority}
${data.withBreakdown ? "Include micro_steps." : "micro_steps may be omitted or empty array."}`;

    const ai = await callAI(TASK_SYS, userPrompt);

    const update: {
      short_summary?: string;
      estimated_minutes?: number;
      micro_steps?: string[];
    } = {};
    if (ai.short_summary) update.short_summary = ai.short_summary.slice(0, 200);
    if (typeof ai.estimated_minutes === "number") update.estimated_minutes = ai.estimated_minutes;
    if (data.withBreakdown && Array.isArray(ai.micro_steps) && ai.micro_steps.length)
      update.micro_steps = ai.micro_steps.slice(0, 5);

    if (Object.keys(update).length) {
      await context.supabase.from("tasks").update(update).eq("id", task.id);
    }
    return {
      estimated_minutes: update.estimated_minutes ?? task.estimated_minutes,
      short_summary: update.short_summary ?? task.short_summary,
      micro_steps: update.micro_steps ?? task.micro_steps,
    };
  });

export const enrichEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid(),
        withBreakdown: z.boolean().default(false),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("email_threads")
      .select("id, subject, from_address, snippet, action_required, short_summary, estimated_minutes, micro_steps")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !row) throw new Error(error?.message ?? "Email not found");

    const needsBase = row.short_summary == null;
    const needsSteps =
      data.withBreakdown && (!row.micro_steps || (row.micro_steps as unknown[]).length === 0);

    if (!needsBase && !needsSteps) {
      return row;
    }

    const userPrompt = `SUBJECT: ${row.subject ?? "(no subject)"}
FROM: ${row.from_address ?? "(unknown)"}
PREVIEW: ${row.snippet ?? "(none)"}
${data.withBreakdown ? "Include micro_steps if actionable." : ""}`;

    const ai = await callAI(EMAIL_SYS, userPrompt);

    const update: {
      action_required?: boolean;
      short_summary?: string;
      estimated_minutes?: number;
      micro_steps?: string[];
    } = {};
    if (typeof ai.action_required === "boolean") update.action_required = ai.action_required;
    if (ai.short_summary) update.short_summary = ai.short_summary.slice(0, 200);
    if (typeof ai.estimated_minutes === "number") update.estimated_minutes = ai.estimated_minutes;
    if (data.withBreakdown && Array.isArray(ai.micro_steps) && ai.micro_steps.length)
      update.micro_steps = ai.micro_steps.slice(0, 5);

    if (Object.keys(update).length) {
      await context.supabase.from("email_threads").update(update).eq("id", row.id);
    }
    return { ...row, ...update };
  });

/**
 * Returns today+tomorrow items (tasks + actionable emails) for the carousel.
 * Auto-enriches missing estimates/summaries (base, no breakdown) lazily — up to 8 items per call.
 */
export const listTodayCarousel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const now = new Date();
    const endOfTomorrow = new Date(now);
    endOfTomorrow.setDate(now.getDate() + 2);
    endOfTomorrow.setHours(0, 0, 0, 0);

    const [{ data: tasks }, { data: emails }] = await Promise.all([
      context.supabase
        .from("tasks")
        .select("*")
        .neq("status", "done")
        .or(
          `due_at.lte.${endOfTomorrow.toISOString()},priority.eq.high`,
        )
        .order("due_at", { ascending: true, nullsFirst: false })
        .limit(20),
      context.supabase
        .from("email_threads")
        .select("*")
        .eq("action_required", true)
        .order("received_at", { ascending: false })
        .limit(10),
    ]);

    return {
      tasks: tasks ?? [],
      emails: emails ?? [],
    };
  });
