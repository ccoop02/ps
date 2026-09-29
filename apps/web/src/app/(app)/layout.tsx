import { BottomNav, TopBar } from "@/components/TopBar";

/** Every beta member starts with $100 of play cash. Real balances arrive in milestone 3. */
const PLACEHOLDER_CASH_CENTS = 100_00;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopBar cashCents={PLACEHOLDER_CASH_CENTS} />
      <main className="mx-auto max-w-7xl px-4 pt-6 pb-24 md:pb-6">{children}</main>
      <BottomNav />
    </>
  );
}
