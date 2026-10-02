export default function LoadError({
  message,
  retry,
}: {
  message: string;
  retry: () => void;
}) {
  return (
    <div role="alert" className="card border-red-200 text-sm text-red-800">
      <p>{message}</p>
      <button className="btn-ghost mt-3" onClick={retry}>
        Try again
      </button>
    </div>
  );
}
