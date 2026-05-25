import { createFileRoute } from "@tanstack/react-router";
import { Pin, Plus, Search } from "lucide-react";

const MOCK_NOTES = [
  { id: "1", title: "Things to ask the dentist", area: "health", pinned: true, preview: "Wisdom tooth — pain when chewing left side. Ask about night guard." },
  { id: "2", title: "Holiday packing list", area: "personal", pinned: true, preview: "Passports, kids' meds, swim things, hat, sun cream, charger…" },
  { id: "3", title: "Q4 review notes", area: "work", pinned: false, preview: "Wins: launched onboarding. Misses: docs slipped. Next quarter: focus on retention." },
  { id: "4", title: "Books to read", area: "personal", pinned: false, preview: "Four Thousand Weeks. Hidden Potential. The Creative Act." },
];

export const Route = createFileRoute("/_authenticated/dashboard/notes")({
  component: NotesView,
});

function NotesView() {
  return (
    <div className="max-w-[860px] mx-auto px-6 lg:px-10 py-8">
      <header className="mb-6 flex items-start justify-between gap-4 fade-in">
        <div>
          <h1 className="font-display text-[32px] leading-tight text-ink">Notes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            A quiet place for things before they become tasks.
          </p>
        </div>
        <button className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-navy text-white text-sm font-ui font-semibold hover:bg-navy-dark transition">
          <Plus size={14} /> New note
        </button>
      </header>

      <div className="relative mb-6">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          placeholder="Search notes…"
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-navy-line bg-surface text-sm focus:outline-none focus:border-teal text-ink"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {MOCK_NOTES.map((n) => (
          <article key={n.id} className="surface-card p-5 fade-in hover:shadow-md transition">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-ui font-bold text-ink">{n.title}</h3>
              {n.pinned && <Pin size={14} className="text-teal shrink-0 mt-1" />}
            </div>
            <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{n.preview}</p>
            <span className="inline-block mt-3 text-[11px] px-2 py-0.5 rounded-full bg-navy-soft text-navy-dark font-ui font-semibold uppercase tracking-wider">
              {n.area}
            </span>
          </article>
        ))}
      </div>
    </div>
  );
}
