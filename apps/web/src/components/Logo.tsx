import { brand } from "@peerstock/shared";

/** "Level Up" mark: three friends growing as they rise. */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#000" />
      <circle cx="8" cy="23" r="3" fill="#fff" />
      <circle cx="15.5" cy="16" r="4" fill="#fff" />
      <circle cx="24" cy="8.5" r="5" fill="var(--color-lime)" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2">
      <LogoMark />
      <span className="font-display text-lg font-bold tracking-tight">
        {brand.wordmark}
      </span>
    </span>
  );
}
