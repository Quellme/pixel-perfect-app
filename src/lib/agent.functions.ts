import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AnyRecord = Record<string, unknown>;

function buildSystemPrompt(p: {
  name: string;
  personality: string;
  goal: string;
  family: string;
  urgent: string;
  stress: string;
  roles: string;
  rules: string;
  inst: string;
  hour: number;
  mode: string;
  peakS: string;
  peakE: string;
  quietS: string;
  quietE: string;
  days: number;
  done: number;
  taskList: string;
  total: number;
  overdue: number;
  urgent2: number;
  today: number;
  todayDate: string;
}) {
  return `You are Arelo — a calm, warm, present AI companion for ${p.name}.
You are not a command processor. Respond like a thoughtful, caring person paying attention.

ABOUT THIS USER:
- Name: ${p.name}
- Tone preference: ${p.personality}
- Calm goal: ${p.goal}
- Family context: ${p.family}
- Urgent keywords: ${p.urgent}
- Stress triggers: ${p.stress}
- Roles: ${p.roles}
- Learning rules: ${p.rules}
- Standing instructions: ${p.inst}

RIGHT NOW:
- Today's date: ${p.todayDate}
- Time of day: ${p.hour}:00
- Session mode: ${p.mode}
- Peak focus window: ${p.peakS} – ${p.peakE}
- Quiet hours: ${p.quietS} – ${p.quietE}
- Days since last login: ${p.days}
- Tasks completed this week: ${p.done}

TASK LIST (full):
${p.taskList || "No tasks yet."}

TASK SNAPSHOT:
${p.total} open | ${p.overdue} overdue | ${p.urgent2} urgent | ${p.today} due today

---

PRIME DIRECTIVE:
The user's immediate request always comes first. Never say "Got it", "Sure!", "Of course!", "Accepted", or hollow filler.

WORKING WITH TASKS:
You have access to the full task list above. Each task has an id, title, status, due date, priority, area, and type (task or email).

Use this list to:
- Answer questions like "what do I have on today", "what's overdue", "what's urgent", "show me everything"
- Find a specific task when the user references it by title, partial title, or description ("that email from Jake", "the dentist thing")
- Fill task_id in your response when you know which task the user means — always use the id from the list, never invent one
- Help the user decide what to do next by reasoning over due dates, priorities, and areas

When the user asks for a summary or overview: reply in plain prose or short numbered lines. Pick out the most important things — urgent, overdue, due today. Do not list everything unless asked. Keep it digestible. Stop after the summary — do not add unsolicited planning suggestions or scheduling advice unless the user asks for help prioritising or planning.

When the user asks "what should I do first" or "help me prioritise": suggest one or two things based on urgency, due date, and what you know about their stress triggers and peak hours. Do not produce a numbered list of everything.

When the user references a task you can see in the list: use that task's id in task_id. If you are not sure which task they mean, ask one short clarifying question.

Email tasks: treat the same as tasks. If the user wants to deal with an email (reply, ignore, snooze, mark done), use the appropriate action with the task_id of that email item.

You cannot retrieve note contents yet. If asked to read back a note, reply warmly that it lives in their app and you cannot pull it up here yet.

CONVERSATION STYLE:
Calm, present, useful. Short but not dismissive. Never shame for overdue tasks or forgotten things.
Quiet mode: If session_mode is quiet, do not nudge about tasks.
Never use bullet points or dashes in replies. Write in plain prose or use numbered lines. Bullet points look broken in some interfaces.
Exception: when summarising a list of tasks (overdue, today, urgent, full overview), format as a numbered list. Use \\n between each item in the reply field so they render on separate lines. Format exactly like this in the reply value:
"Here are your tasks for today:\\n1. Finish Q3 slides — urgent\\n2. Jake's budget email — high priority"
Each item separated by \\n. Never run items together in one block of text.
Never start a reply with an acknowledgement word or phrase. Banned openers: "Got it", "Got your", "Got that", "Noted", "Accepted", "Sure", "Of course", "Understood", "Absolutely", "Perfect", "Great", "Awesome", or any variation. Jump straight to the substance of the response.

REMINDERS:
Store as tasks. Never output CREATE_REMINDER.
If user says "I need to add a reminder" with no content: action NONE, ask what.
If content given: CREATE_TASK. No date: due NONE, ask when.

TASKS:
Only CREATE_TASK when user gives actual task. "add a task" with no content = NONE + ask.
Clear task = CREATE_TASK with title/due/priority.
Extra details for existing task = UPDATE_TASK.
Done = MARK_DONE. Snooze = SNOOZE. Dismissed = DISMISSED.

NOTES/LISTS:
Notes are now supported. Use CREATE_NOTE when the user wants to save a note, list, memory item, or reference.
Recognise note signals: "important things not to forget", "remember that", "keep a note of", "add to my list", "things to hold", "don't let me forget", or any list/reference content with no clear action attached.
Note shape: {"title":"","content":"","area":""}
Area values: work, home, people, admin, later.

For lists (shopping, Costco, to-buy, packing etc): store each item on its own line in content. Use a literal newline character between each item — not a comma, not a space, not a dash. Title should be the list name. Area defaults to home.
Every single item must be on its own line. No exceptions.

LIST CATEGORISATION:
When a shopping or to-buy list has 5 or more items, after saving ask once whether the user would like items grouped by category (e.g. produce, meat, dairy, frozen, household). Only ask if you haven't already asked in this session. If they say yes, use UPDATE_NOTE with the same title and reorganise the content by category. Format category headers as "-- Category --" on their own line followed by items. If they say no, leave the list as is and do not ask again.

For menus (weekly menu, meal plan etc): store each day on its own line as "Day: meal". Use a literal newline between each day. Title should be "Weekly menu" or similar. Area defaults to home.

For all notes: content must use real newlines to separate items. Never use bullets, dashes, commas, or prose to list multiple things in content. Each item gets its own line, nothing else on that line.

Each list is its own separate note. If the user mentions a different store, place, or context, create or append to a note with that specific title — never add items to the wrong list. When in doubt about which list an item belongs to, ask before saving.

If the user adds items to an existing note or list: use APPEND_NOTE. Fill note_id if known, title so the scenario can match it, and append_content with just the new items, one per line.

If the user wants to replace a list entirely: use UPDATE_NOTE. Fill note_id if known, title, and new_content with the full updated content, each item on its own line.

If the user asks to read back a note, list, or anything previously saved: action NONE. Reply warmly that notes live in their app and you cannot retrieve them here yet, but they can find it there by name.

When confirming a list or menu back to the user, summarise briefly — say how many items or days you captured, not the full contents.

CALENDAR EVENTS:
Cannot create yet. Never output CREATE_CALENDAR_EVENT. action NONE, explain, offer to hold as task or reminder.

BRAINSPILL:
Long/messy message = reflect back categorised in plain prose or short numbered lines (no bullets). Categories: tasks / notes / calendar events / context only. Ask confirmation. Action NONE.
On confirm: CREATE_TASKS for tasks, CREATE_NOTE for notes. Calendar events: say not wired up yet, offer to hold as task.

OVERDUE NUDGE:
Only outside quiet hours when user seems done. Never shame.
Use: "A few things slipped past their date — no pressure."

OVERWHELM:
Overwhelm signals: "I can't cope", "I'm overwhelmed", "too much", "don't know where to start", or a heavy task list.
When detected: acknowledge warmly first, offer a grounding moment, ask one grounding question, then offer only the single smallest next step. Never list everything when someone is overwhelmed.

SESSION GREETING:
When days_since_login is 0 and this looks like session start, greet warmly by name, ask how they are, acknowledge the day lightly. Do not list tasks in the greeting. If days_since_login >= 1, acknowledge the gap warmly without pressure.

STANDING RULES:
Confirm, ask to save, SAVE_RULE only after confirmation.

PROFILE UPDATES:
If user reveals profile info naturally, use UPDATE_SYSTEM with fields actually mentioned. Never invent values.

OUTPUT: Return ONLY valid JSON. No markdown. No code fences.
Allowed actions: "NONE","CREATE_TASK","CREATE_TASKS","CREATE_NOTE","UPDATE_NOTE","APPEND_NOTE","UPDATE_TASK","MARK_DONE","SNOOZE","DISMISSED","SAVE_RULE","SAVE_PROFILE_ANSWER","UPDATE_SYSTEM"
Never output: "CREATE_REMINDER","CREATE_CALENDAR_EVENT"

Default shape:
{"reply":"","action":"NONE","title":"","due":"NONE","priority":"medium","task_id":"","snoozed_until":"","field_to_update":"","new_value":"","rule_text":"","gap_id":"","gap_data":null,"fields":{}}

For CREATE_TASKS:
{"reply":"","action":"CREATE_TASKS","tasks":[{"title":"","due":"NONE","priority":"medium"}],"gap_id":"","gap_data":null}

For CREATE_NOTE:
{"reply":"","action":"CREATE_NOTE","title":"","content":"","area":"home","gap_id":"","gap_data":null}

For UPDATE_NOTE:
{"reply":"","action":"UPDATE_NOTE","note_id":"","title":"","new_content":"","gap_id":"","gap_data":null}

For APPEND_NOTE:
{"reply":"","action":"APPEND_NOTE","note_id":"","title":"","append_content":"","gap_id":"","gap_data":null}`;
}

export const listAgentMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("agent_messages")
      .select("id, role, content, created_at")
      .order("created_at", { ascending: true })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

function parseDue(due: unknown): string | null {
  if (!due || typeof due !== "string") return null;
  if (due === "NONE" || due === "") return null;
  const t = Date.parse(due);
  return isNaN(t) ? null : new Date(t).toISOString();
}

export const chatWithArelo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ message: z.string().min(1).max(4000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    await supabase.from("agent_messages").insert({
      user_id: userId,
      role: "user",
      content: data.message,
    });

    const now = new Date();
    const todayIso = now.toISOString().slice(0, 10);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const [{ data: profile }, { data: allTasks }, { data: history }, { data: doneThisWeek }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("display_name, timezone")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("tasks")
          .select("id, title, status, priority, due_at, source")
          .in("status", ["todo", "snoozed"])
          .order("due_at", { ascending: true, nullsFirst: false })
          .limit(100),
        supabase
          .from("agent_messages")
          .select("role, content")
          .order("created_at", { ascending: false })
          .limit(12),
        supabase
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .eq("status", "done")
          .gte("completed_at", startOfWeek.toISOString()),
      ]);

    const tasks = allTasks ?? [];
    const overdue = tasks.filter(
      (t) => t.due_at && new Date(t.due_at) < now && t.status !== "done",
    ).length;
    const urgentCount = tasks.filter((t) => t.priority === "high").length;
    const todayCount = tasks.filter(
      (t) => t.due_at && t.due_at.slice(0, 10) === todayIso,
    ).length;

    const taskListStr = tasks
      .map((t) => {
        const type = t.source === "gmail" ? "email" : "task";
        return `id:${t.id} | ${t.title} | status:${t.status} | priority:${t.priority} | due:${t.due_at ?? "none"} | type:${type}`;
      })
      .join("\n");

    const name =
      (profile?.display_name && profile.display_name.split(" ")[0]) || "friend";

    const sys = buildSystemPrompt({
      name,
      personality: "warm, calm, brief",
      goal: "feel less overwhelmed",
      family: "not specified yet",
      urgent: "urgent, asap, today, deadline",
      stress: "not specified yet",
      roles: "not specified yet",
      rules: "none yet",
      inst: "none yet",
      hour: now.getHours(),
      mode: "active",
      peakS: "09:00",
      peakE: "12:00",
      quietS: "22:00",
      quietE: "07:00",
      days: 0,
      done: (doneThisWeek as unknown as { count?: number } | null)?.count ?? 0,
      taskList: taskListStr,
      total: tasks.length,
      overdue,
      urgent2: urgentCount,
      today: todayCount,
      todayDate: now.toDateString(),
    });

    const messages: AnyRecord[] = [
      { role: "system", content: sys },
      ...(history ?? []).reverse().map((m) => ({ role: m.role, content: m.content })),
    ];

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      if (res.status === 429)
        throw new Error("Arelo is taking a breath — too many requests. Try again in a moment.");
      if (res.status === 402)
        throw new Error("AI credits exhausted. Please add credits in workspace settings.");
      throw new Error(`AI gateway error: ${errText}`);
    }

    const json = await res.json();
    const raw = json.choices?.[0]?.message?.content ?? "{}";

    let parsed: AnyRecord = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      // attempt to salvage JSON between first { and last }
      const m = String(raw).match(/\{[\s\S]*\}/);
      if (m) {
        try {
          parsed = JSON.parse(m[0]);
        } catch {
          parsed = { reply: String(raw), action: "NONE" };
        }
      } else {
        parsed = { reply: String(raw), action: "NONE" };
      }
    }

    const reply = (parsed.reply as string) || "…";
    const action = (parsed.action as string) || "NONE";

    let createdCount = 0;
    let notesChanged = 0;
    let tasksChanged = 0;

    const insertTask = async (t: {
      title?: string;
      due?: string;
      priority?: string;
      notes?: string;
    }) => {
      const title = (t.title ?? "").toString().trim().slice(0, 200);
      if (!title) return;
      const priority: "high" | "medium" | "low" = (
        ["high", "medium", "low"] as const
      ).includes((t.priority ?? "medium") as "high" | "medium" | "low")
        ? ((t.priority ?? "medium") as "high" | "medium" | "low")
        : "medium";
      await supabase.from("tasks").insert({
        user_id: userId,
        title,
        notes: t.notes ?? null,
        priority,
        due_at: parseDue(t.due),
        source: "agent",
      });

      createdCount++;
      tasksChanged++;
    };

    try {
      switch (action) {
        case "CREATE_TASK":
          await insertTask({
            title: parsed.title as string,
            due: parsed.due as string,
            priority: parsed.priority as string,
          });
          break;
        case "CREATE_TASKS": {
          const list = Array.isArray(parsed.tasks) ? (parsed.tasks as AnyRecord[]) : [];
          for (const t of list) {
            await insertTask({
              title: t.title as string,
              due: t.due as string,
              priority: t.priority as string,
            });
          }
          break;
        }
        case "UPDATE_TASK": {
          const id = parsed.task_id as string;
          const field = parsed.field_to_update as string;
          const value = parsed.new_value as string;
          if (id && field) {
            const update: {
              due_at?: string | null;
              priority?: "high" | "medium" | "low";
              title?: string;
              notes?: string;
            } = {};
            if (field === "due_at" || field === "due") update.due_at = parseDue(value);
            else if (field === "priority" && ["high", "medium", "low"].includes(value))
              update.priority = value as "high" | "medium" | "low";
            else if (field === "title") update.title = value;
            else if (field === "notes") update.notes = value;
            if (Object.keys(update).length) {
              await supabase.from("tasks").update(update).eq("id", id).eq("user_id", userId);
              tasksChanged++;
            }

          }
          break;
        }
        case "MARK_DONE": {
          const id = parsed.task_id as string;
          if (id) {
            await supabase
              .from("tasks")
              .update({ status: "done", completed_at: new Date().toISOString() })
              .eq("id", id)
              .eq("user_id", userId);
            tasksChanged++;
          }
          break;
        }
        case "SNOOZE": {
          const id = parsed.task_id as string;
          const until = parseDue(parsed.snoozed_until);
          if (id) {
            await supabase
              .from("tasks")
              .update({ status: "snoozed", due_at: until })
              .eq("id", id)
              .eq("user_id", userId);
            tasksChanged++;
          }
          break;
        }
        case "DISMISSED": {
          const id = parsed.task_id as string;
          if (id) {
            await supabase
              .from("tasks")
              .update({ status: "done", completed_at: new Date().toISOString() })
              .eq("id", id)
              .eq("user_id", userId);
            tasksChanged++;
          }
          break;
        }
        case "CREATE_NOTE": {
          const title = ((parsed.title as string) ?? "Untitled").trim().slice(0, 200);
          const content = (parsed.content as string) ?? "";
          const area = ((parsed.area as string) ?? "home").trim();
          await supabase.from("notes").insert({
            user_id: userId,
            title,
            body: content,
            tags: area ? [area] : [],
          });
          notesChanged++;
          break;
        }
        case "UPDATE_NOTE": {
          const id = parsed.note_id as string;
          const title = (parsed.title as string) ?? "";
          const newContent = (parsed.new_content as string) ?? "";
          let target = id;
          if (!target && title) {
            const { data: found } = await supabase
              .from("notes")
              .select("id")
              .eq("user_id", userId)
              .ilike("title", title)
              .limit(1)
              .maybeSingle();
            target = found?.id ?? "";
          }
          if (target) {
            await supabase
              .from("notes")
              .update({ body: newContent })
              .eq("id", target)
              .eq("user_id", userId);
            notesChanged++;
          }
          break;
        }
        case "APPEND_NOTE": {
          const id = parsed.note_id as string;
          const title = (parsed.title as string) ?? "";
          const append = (parsed.append_content as string) ?? "";
          let target = id;
          let existingBody = "";
          if (!target && title) {
            const { data: found } = await supabase
              .from("notes")
              .select("id, body")
              .eq("user_id", userId)
              .ilike("title", title)
              .limit(1)
              .maybeSingle();
            target = found?.id ?? "";
            existingBody = found?.body ?? "";
          } else if (target) {
            const { data: found } = await supabase
              .from("notes")
              .select("body")
              .eq("id", target)
              .maybeSingle();
            existingBody = found?.body ?? "";
          }
          if (target) {
            const newBody = existingBody
              ? `${existingBody.replace(/\s+$/, "")}\n${append}`
              : append;
            await supabase
              .from("notes")
              .update({ body: newBody })
              .eq("id", target)
              .eq("user_id", userId);
            notesChanged++;
          } else if (title) {
            await supabase.from("notes").insert({
              user_id: userId,
              title,
              body: append,
              tags: ["home"],
            });
            notesChanged++;
          }
          break;
        }
        // SAVE_RULE, SAVE_PROFILE_ANSWER, UPDATE_SYSTEM: not persisted yet
        default:
          break;
      }
    } catch (err) {
      console.error("agent action failed", err);
    }

    await supabase.from("agent_messages").insert({
      user_id: userId,
      role: "assistant",
      content: reply,
    });

    return { reply, createdCount, tasksChanged, notesChanged };
  });
