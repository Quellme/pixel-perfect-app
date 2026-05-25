import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Image as ImageIcon, Mic, MicOff, Sparkles, X, Check, Loader2 } from "lucide-react";
import { extractFromDump, commitDumpItems } from "@/lib/dump.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/dump")({
  component: BrainDumpView,
});

type Item = {
  kind: "task" | "event" | "note";
  title: string;
  notes?: string | null;
  due_at?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  priority?: "high" | "medium" | "low" | null;
};

// minimal Web Speech API typing
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onerror: (e: { error?: string }) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
};

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function BrainDumpView() {
  const extract = useServerFn(extractFromDump);
  const commit = useServerFn(commitDumpItems);
  const qc = useQueryClient();

  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [items, setItems] = useState<Item[] | null>(null);
  const [saving, setSaving] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const handleImage = async (file: File) => {
    if (file.size > 7 * 1024 * 1024) {
      toast.error("Image is over 7MB — try a smaller one.");
      return;
    }
    const buf = await file.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    const b64 = btoa(binary);
    setImageBase64(b64);
    setImageMime(file.type || "image/jpeg");
    setImagePreview(`data:${file.type};base64,${b64}`);
  };

  const startVoice = () => {
    const Rec = getSpeechRecognition();
    if (!Rec) {
      toast.error("Voice isn't supported in this browser yet. Try Chrome or Safari.");
      return;
    }
    const r = new Rec();
    r.continuous = true;
    r.interimResults = true;
    r.lang = "en-GB";
    let finalText = "";
    r.onresult = (e) => {
      let interim = "";
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i] as ArrayLike<{ transcript: string }> & { isFinal?: boolean };
        const transcript = res[0].transcript;
        if ((res as { isFinal?: boolean }).isFinal) finalText += transcript + " ";
        else interim += transcript;
      }
      setText((prev) => {
        const base = prev.replace(/\s*\[…\].*$/, "");
        return (base + (base.endsWith(" ") || base === "" ? "" : " ") + finalText + (interim ? `[…] ${interim}` : "")).trim();
      });
    };
    r.onerror = () => setListening(false);
    r.onend = () => {
      setListening(false);
      setText((prev) => prev.replace(/\s*\[…\].*$/, "").trim());
    };
    r.start();
    recRef.current = r;
    setListening(true);
  };

  const stopVoice = () => {
    recRef.current?.stop();
    setListening(false);
  };

  const handleExtract = async () => {
    if (!text.trim() && !imageBase64) {
      toast.error("Type, speak, or add an image first.");
      return;
    }
    setExtracting(true);
    try {
      const out = await extract({
        data: {
          text: text.trim() || null,
          imageBase64: imageBase64,
          imageMime: imageMime,
        },
      });
      if (!out.items.length) {
        toast.message("Nothing actionable spotted — try adding a bit more detail.");
        setItems([]);
      } else {
        setItems(out.items as Item[]);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't process that just now.");
    } finally {
      setExtracting(false);
    }
  };

  const removeItem = (i: number) => {
    setItems((prev) => (prev ? prev.filter((_, idx) => idx !== i) : prev));
  };

  const updateItem = (i: number, patch: Partial<Item>) => {
    setItems((prev) => (prev ? prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) : prev));
  };

  const handleSave = async () => {
    if (!items || !items.length) return;
    setSaving(true);
    try {
      const res = await commit({ data: { items } });
      const parts: string[] = [];
      if (res.tasks) parts.push(`${res.tasks} task${res.tasks > 1 ? "s" : ""}`);
      if (res.events) parts.push(`${res.events} event${res.events > 1 ? "s" : ""}`);
      if (res.notes) parts.push(`${res.notes} note${res.notes > 1 ? "s" : ""}`);
      toast.success(parts.length ? `Saved ${parts.join(", ")}. It's out of your head.` : "Saved.");
      setText("");
      setImageBase64(null);
      setImagePreview(null);
      setImageMime(null);
      setItems(null);
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["notes", "sidebar"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save just now.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-[760px] mx-auto px-6 lg:px-10 py-8">
      <header className="mb-6 fade-in">
        <h1 className="font-display text-[32px] leading-tight text-ink">Unload to Arelo</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Get it out of your head. Type, talk, or snap a photo — I'll sort it.
        </p>
      </header>

      <div className="surface-card p-5 fade-in">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Just start. Don't worry about order or detail. Example: pick up prescription tomorrow, call mum back, dentist Friday 3pm, idea for the project — try a weekly digest…"
          className="w-full min-h-[180px] rounded-xl border border-navy-line bg-surface p-4 text-sm text-ink focus:outline-none focus:border-teal resize-y leading-relaxed"
          disabled={extracting || saving || !!items}
        />

        {imagePreview && (
          <div className="mt-3 relative inline-block">
            <img src={imagePreview} alt="Attached" className="max-h-40 rounded-lg border border-navy-line" />
            <button
              onClick={() => {
                setImagePreview(null);
                setImageBase64(null);
                setImageMime(null);
              }}
              className="absolute -top-2 -right-2 bg-white rounded-full border border-navy-line p-1 shadow"
              aria-label="Remove image"
            >
              <X size={12} />
            </button>
          </div>
        )}

        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <button
            onClick={listening ? stopVoice : startVoice}
            disabled={extracting || saving || !!items}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-ui font-semibold border transition ${
              listening
                ? "bg-amber-50 border-amber-200 text-amber-900"
                : "bg-surface border-navy-line text-ink hover:border-teal"
            }`}
          >
            {listening ? <MicOff size={14} /> : <Mic size={14} />}
            {listening ? "Stop" : "Speak"}
          </button>

          <button
            onClick={() => fileRef.current?.click()}
            disabled={extracting || saving || !!items}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-ui font-semibold border border-navy-line bg-surface text-ink hover:border-teal transition"
          >
            <ImageIcon size={14} /> {imageBase64 ? "Replace image" : "Add image"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImage(f);
              e.target.value = "";
            }}
          />

          <div className="flex-1" />

          {!items && (
            <button
              onClick={handleExtract}
              disabled={extracting || saving || (!text.trim() && !imageBase64)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-navy text-white text-sm font-ui font-semibold hover:bg-navy-dark transition disabled:opacity-50"
            >
              {extracting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {extracting ? "Sorting…" : "Sort it for me"}
            </button>
          )}
        </div>
      </div>

      {items && items.length > 0 && (
        <div className="mt-6 fade-in">
          <p className="text-sm text-muted-foreground mb-3">
            Here's what I caught. Edit, remove, or save when it looks right.
          </p>
          <div className="space-y-2">
            {items.map((it, i) => (
              <div key={i} className="surface-card p-4 flex items-start gap-3">
                <select
                  value={it.kind}
                  onChange={(e) => updateItem(i, { kind: e.target.value as Item["kind"] })}
                  className="text-[11px] uppercase tracking-wider font-ui font-semibold rounded-md border border-navy-line px-2 py-1 bg-surface text-ink"
                >
                  <option value="task">Task</option>
                  <option value="event">Event</option>
                  <option value="note">Note</option>
                </select>
                <div className="flex-1 min-w-0">
                  <input
                    value={it.title}
                    onChange={(e) => updateItem(i, { title: e.target.value })}
                    className="w-full font-ui font-semibold text-ink bg-transparent border-0 p-0 focus:outline-none"
                  />
                  {(it.due_at || it.starts_at || it.notes) && (
                    <div className="text-xs text-muted-foreground mt-1 space-x-2">
                      {it.starts_at && <span>📅 {new Date(it.starts_at).toLocaleString()}</span>}
                      {!it.starts_at && it.due_at && <span>⏳ {new Date(it.due_at).toLocaleString()}</span>}
                      {it.notes && <span className="line-clamp-1">— {it.notes}</span>}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => removeItem(i)}
                  className="text-muted-foreground hover:text-ink p-1"
                  aria-label="Remove"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={() => setItems(null)}
              className="px-4 py-2 rounded-xl border border-navy-line text-sm font-ui font-semibold text-ink hover:bg-surface transition"
              disabled={saving}
            >
              Back
            </button>
            <div className="flex-1" />
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal text-white text-sm font-ui font-semibold hover:opacity-90 transition disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {saving ? "Saving…" : `Save ${items.length}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
