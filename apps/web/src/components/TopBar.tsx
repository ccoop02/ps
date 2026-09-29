import Link from "next/link";
import { Bell, Search } from "lucide-react";
import { formatCents } from "@peerstock/shared";
import { Logo } from "./Logo";

export const nav = [
  { href: "/", label: "Home" },
  { href: "/markets", label: "Markets" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/baskets", label: "Baskets" },
];

export function TopBar({ cashCents }: { cashCents: number }) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
        <Link href="/" aria-label="Home">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {nav.map((item, i) => (
            <Link
              key={item.href}
              href={item.href}
              className={
                "rounded-lg px-3 py-1.5 text-sm " +
                (i === 0
                  ? "bg-surface-raised text-white"
                  : "text-muted hover:text-white")
              }
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <label className="ml-2 hidden flex-1 items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-muted lg:flex">
          <Search size={16} />
          <input
            type="search"
            placeholder="Search friends, tickers, event markets"
            className="w-full bg-transparent text-white outline-none placeholder:text-muted"
          />
        </label>
        <div className="ml-auto flex items-center gap-3">
          <div className="text-right leading-tight">
            <div className="text-[11px] text-muted">Play cash</div>
            <div className="font-display text-sm font-semibold">
              {formatCents(cashCents)}
            </div>
          </div>
          <button
            type="button"
            aria-label="Notifications"
            className="grid size-9 place-items-center rounded-lg border border-line text-muted hover:text-white"
          >
            <Bell size={16} />
          </button>
          <div className="grid size-9 place-items-center rounded-full bg-violet text-xs font-semibold">
            You
          </div>
        </div>
      </div>
    </header>
  );
}

/** Phone-width navigation, pinned to the bottom of the screen. */
export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      {nav.map((item, i) => (
        <Link
          key={item.href}
          href={item.href}
          className={
            "py-3 text-center text-xs " + (i === 0 ? "text-lime" : "text-muted")
          }
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
