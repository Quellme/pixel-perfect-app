import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAgentMessages, chatWithArelo } from "@/lib/agent.functions";
import { toast } from "sonner";

const SUGGESTIONS = [
  { icon: "🎯", text: "What should I do first?" },
  { icon: "🧘", text: "I'm feeling overwhelmed" },
  { icon: "📋", text: "Summarise my day" },
];

const GREETING = {
  id: "greeting",
  role: "assistant" as const,
  content: "Hello. I'm Arelo. Tell me what's on your mind, or ask me what to focus on.",
};

export function CompanionPanel() {
  const qc = useQueryClient();
  const [collapsed, setCollapsed] = useState(false);
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);

  const listMsgs = useServerFn(listAgentMessages);
  const chat = useServerFn(chatWithArelo);

  const { data: messages = [] } = useQuery({
    queryKey: ["agent-messages"],
    queryFn: () => listMsgs(),
  });

  const chatMut = useMutation({
    mutationFn: (message: string) => chat({ data: { message } }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["agent-messages"] });
      const r = res as { createdCount?: number; tasksChanged?: number; notesChanged?: number };
      if ((r?.tasksChanged ?? 0) > 0) qc.invalidateQueries({ queryKey: ["tasks"] });
      if ((r?.notesChanged ?? 0) > 0) qc.invalidateQueries({ queryKey: ["notes"] });
      if ((r?.createdCount ?? 0) > 0) {
        toast.success(
          r.createdCount === 1 ? "Arelo saved a task for you." : `Arelo saved ${r.createdCount} tasks.`,
        );
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const send = (text: string) => {
    const t = text.trim();
    if (!t || chatMut.isPending) return;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    chatMut.mutate(t);
  };

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages, chatMut.isPending]);

  const display = messages.length === 0 ? [GREETING] : messages;

  if (collapsed) {
    return (
      <aside className="companion-panel collapsed">
        <button
          onClick={() => setCollapsed(false)}
          aria-label="Open Arelo"
          style={{ display: "none" }}
        />
      </aside>
    );
  }

  return (
    <aside className="companion-panel">
      <div className="cp-header">
        <div className="cp-orb" />
        <div className="cp-identity">
          <div className="cp-name">Arelo</div>
          <div className="cp-status">
            <div className="cp-status-dot" />
            <span>Your personal AI</span>
          </div>
        </div>
        <button
          className="cp-collapse-btn"
          onClick={() => setCollapsed(true)}
          title="Minimise Arelo"
          aria-label="Minimise Arelo"
        >
          ×
        </button>
      </div>

      <div className="cp-context-ribbon">
        <span className="cp-context-tag">Calm mode</span>
        <span className="cp-context-tag amber">Listening</span>
      </div>

      <div className="cp-messages" ref={messagesRef}>
        {display.map((m) => (
          <div
            key={m.id}
            className={`cp-msg ${m.role === "user" ? "user" : "qwell"}`}
          >
            {m.content}
          </div>
        ))}
        {chatMut.isPending && <div className="cp-msg thinking">Thinking…</div>}
      </div>

      {messages.length === 0 && (
        <div className="cp-suggestions">
          {SUGGESTIONS.map((s) => (
            <button
              key={s.text}
              className="cp-suggestion-btn"
              onClick={() => send(s.text)}
              disabled={chatMut.isPending}
            >
              <span className="cp-suggestion-icon">{s.icon}</span>
              {s.text}
            </button>
          ))}
        </div>
      )}

      <form
        className="cp-input-area"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <textarea
          ref={textareaRef}
          className="cp-input"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = Math.min(el.scrollHeight, 120) + "px";
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={1}
          placeholder="Ask Arelo anything…"
        />
        <button
          type="submit"
          className="cp-send"
          disabled={chatMut.isPending || !input.trim()}
          aria-label="Send"
        >
          ↑
        </button>
      </form>
    </aside>
  );
}
