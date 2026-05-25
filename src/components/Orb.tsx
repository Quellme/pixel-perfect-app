type OrbProps = { size?: "large" | "mini" | "tiny"; className?: string };

export function Orb({ size = "mini", className = "" }: OrbProps) {
  const cls =
    size === "large" ? "orb-large" : size === "tiny" ? "orb-tiny" : "orb-mini";
  return <div aria-hidden className={`${cls} ${className}`} />;
}
