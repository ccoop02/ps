"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const nav = [
  { href: "/", label: "Home" },
  { href: "/markets", label: "Markets" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/baskets", label: "Baskets" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}

export function TopNavLinks() {
  const pathname = usePathname();
  return (
    <nav className="hidden items-center gap-1 md:flex">
      {nav.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={
            "rounded-lg px-3 py-1.5 text-sm " +
            (isActive(pathname, item.href) ? "bg-surface-raised text-white" : "text-muted hover:text-white")
          }
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

/** Phone-width navigation, pinned to the bottom of the screen. */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      {nav.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={"py-3 text-center text-xs " + (isActive(pathname, item.href) ? "text-lime" : "text-muted")}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
