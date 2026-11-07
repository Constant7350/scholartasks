/**
 * A student's avatar: their initial in a colored circle, the same color for the same name
 * everywhere (Home, My students, the student switch). A photo can replace it later.
 */
const COLORS = ["var(--c-blue)", "var(--c-green)", "var(--c-coral)", "var(--c-purple)", "var(--c-gold)"];

export function avatarColor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return COLORS[h % COLORS.length]!;
}

export function Avatar({ name, size = 28, className }: { name: string; size?: number; className?: string }) {
  const letter = (name.trim()[0] ?? "?").toUpperCase();
  return (
    <span className={`avatar ${className ?? ""}`} style={{ width: size, height: size, fontSize: Math.round(size * 0.48), background: avatarColor(name) }} aria-hidden="true">
      {letter}
    </span>
  );
}
