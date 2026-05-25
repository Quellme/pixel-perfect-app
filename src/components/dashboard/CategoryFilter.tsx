export type AccountCategory = "all" | "work" | "personal";

export function CategoryFilter({
  value,
  onChange,
}: {
  value: AccountCategory;
  onChange: (v: AccountCategory) => void;
}) {
  const opts: { id: AccountCategory; label: string }[] = [
    { id: "all", label: "All" },
    { id: "personal", label: "Personal" },
    { id: "work", label: "Work" },
  ];
  return (
    <div className="inline-flex items-center gap-1 rounded-xl bg-muted p-1">
      {opts.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`px-3 py-1.5 rounded-lg text-xs font-ui font-semibold transition ${
            value === o.id
              ? "bg-white text-ink shadow-sm"
              : "text-muted-foreground hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
