export function ComingSoon({ title, milestone }: { title: string; milestone: number }) {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-muted">Coming in milestone {milestone}.</p>
    </div>
  );
}
