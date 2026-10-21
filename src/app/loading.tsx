export default function Loading() {
  return (
    <div className="flex min-h-40 items-center gap-3 text-sm text-muted" role="status">
      <img src="/brand/relay-mark.png" alt="" width={28} height={28} className="size-7 rounded-md" />
      Loading RELAY
    </div>
  );
}
