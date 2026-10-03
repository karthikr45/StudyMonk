export default function WorkspaceSkeleton({
  label = 'Loading your workspace…',
}: {
  label?: string;
}) {
  return (
    <div role="status" aria-label={label} className="space-y-5 py-4">
      <span className="sr-only">{label}</span>
      <div className="skeleton h-8 w-2/3 max-w-sm rounded-xl" />
      <div className="grid gap-4 md:grid-cols-[1.5fr_1fr]">
        <div className="skeleton h-64 rounded-3xl" />
        <div className="skeleton h-64 rounded-3xl" />
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-36 rounded-3xl" />
        ))}
      </div>
    </div>
  );
}
