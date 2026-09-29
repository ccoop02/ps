const COLORS = ["#5B8CFF", "#2EC4A6", "#F5C84B", "#8BD65B", "#F06FB0", "#F5A742", "#F2716B", "#A77BF3", "#EC4F9A", "#5CC8F0"];

function colorFor(key: string) {
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")).toUpperCase();
}

/** Round initials badge, colored consistently per person (as in the designs). */
export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-semibold text-black/80"
      style={{ width: size, height: size, background: colorFor(name), fontSize: size * 0.34 }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
